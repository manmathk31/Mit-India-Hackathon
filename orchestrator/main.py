import asyncio
import json
import time
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .clients.cost_agent_client import call_cost_agent
from .clients.document_agent_client import call_document_agent
from .clients.image_agent_client import call_image_agent
from .config import settings
from .decision_engine import evaluate_claim_decision
from .fraud_checks import run_all_fraud_checks
from .logger import logger
from .schemas import (
    ClaimProcessResponse,
    ErrorDetail,
    PolicyRecordInput,
)

app = FastAPI(
    title="ClaimPilot AI - Orchestrator & Decision Engine",
    description="Central coordination microservice for multi-agent autonomous motor insurance claim adjudication.",
    version=settings.SERVICE_VERSION,
)

# Enable CORS for frontend and API gateway
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    logger.info(
        f"Starting {settings.SERVICE_NAME} v{settings.SERVICE_VERSION} "
        f"[DocAgent={settings.DOCUMENT_AGENT_URL}, ImgAgent={settings.IMAGE_AGENT_URL}, CostAgent={settings.COST_AGENT_URL}]"
    )


@app.get("/health", tags=["System"])
async def health_check():
    """Liveness probe reporting connected agent microservices."""
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "connected_services": {
            "document_agent": settings.DOCUMENT_AGENT_URL,
            "image_agent": settings.IMAGE_AGENT_URL,
            "cost_agent": settings.COST_AGENT_URL,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _parse_policy_record(policy_record_raw: str, claim_id: Optional[str] = None) -> PolicyRecordInput:
    """Parses policy record from incoming JSON form string."""
    try:
        data = json.loads(policy_record_raw)
        if not isinstance(data, dict):
            raise ValueError("policy_record must be a JSON dictionary")
        if claim_id and not data.get("claim_id"):
            data["claim_id"] = claim_id
        return PolicyRecordInput(**data)
    except (json.JSONDecodeError, ValidationError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid 'policy_record' JSON payload: {str(e)}",
        )


@app.post(
    "/claims/process",
    response_model=ClaimProcessResponse,
    status_code=status.HTTP_200_OK,
    tags=["Claims"],
    summary="End-to-end multi-agent claim adjudication pipeline",
)
async def process_claim(
    rc_image: UploadFile = File(..., description="Vehicle Registration Certificate image"),
    dl_image: UploadFile = File(..., description="Driver Driving Licence image"),
    claim_form_image: UploadFile = File(..., description="Claim Intimation Form image"),
    damage_photos: List[UploadFile] = File(..., description="1 to 8 physical vehicle damage photos"),
    policy_record: str = Form(
        ...,
        description="Authoritative policy record JSON string: {owner_name, rc_number, chassis_number, ...}",
    ),
    claim_id: Optional[str] = Form(None, description="Optional unique claim identifier"),
):
    """
    Core ClaimPilot AI Adjudication Endpoint.
    1. Concurrently calls Document Agent & Image Agent.
    2. Calls Spring AI Cost Agent with extracted vehicle specs & damage matrix.
    3. Runs comprehensive Fraud Verification scans.
    4. Evaluates pure deterministic Decision Engine (Statutory IRDAI limit, Total Loss, Auto-Approval).
    5. Returns unified response matching frontend contract.
    """
    start_time = time.time()
    submission_dt = datetime.now()

    # 1. Parse Policy Record
    policy = _parse_policy_record(policy_record, claim_id=claim_id)
    tracking_claim_id = policy.claim_id or claim_id or f"CLM-{int(time.time())}"

    logger.info(f"Received claim processing request for '{tracking_claim_id}'")

    # 2. Read incoming file buffers
    try:
        rc_bytes = await rc_image.read()
        dl_bytes = await dl_image.read()
        claim_form_bytes = await claim_form_image.read()

        photo_buffers = []
        raw_photos_bytes = []
        for idx, photo_file in enumerate(damage_photos):
            p_bytes = await photo_file.read()
            photo_buffers.append((idx, p_bytes))
            raw_photos_bytes.append(p_bytes)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to read uploaded image bytes: {str(e)}",
        )

    # 3. Concurrent Execution of Document Agent & Image Agent
    try:
        doc_task = call_document_agent(
            rc_bytes=rc_bytes,
            dl_bytes=dl_bytes,
            claim_form_bytes=claim_form_bytes,
            policy_record=policy.model_dump(),
            claim_id=tracking_claim_id,
        )
        img_task = call_image_agent(
            damage_photos=photo_buffers,
            claim_id=tracking_claim_id,
        )

        doc_result, img_result = await asyncio.gather(doc_task, img_task)

    except Exception as e:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Upstream agent execution failed for claim '{tracking_claim_id}': {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=ErrorDetail(
                error="agent_orchestration_failed",
                detail=f"Sub-agent service call failed: {str(e)}",
                claim_id=tracking_claim_id,
                timestamp=datetime.now(timezone.utc).isoformat(),
            ).model_dump(),
        )

    # 4. Extract vehicle specs and damage items for Cost Agent
    extracted_vehicle_meta = doc_result.get("extracted_vehicle_meta", {})
    if not extracted_vehicle_meta:
        extracted_vehicle_meta = {
            "make": "Maruti Suzuki",
            "model": "Swift",
            "variant": "VXI",
            "registration_year": 2021,
        }

    detections = img_result.get("detections", [])
    damage_list_for_cost = [
        {
            "part_name": d.get("part_name", ""),
            "material_type": d.get("material_type", "metal"),
            "severity": d.get("severity", "moderate"),
            "repair_or_replace": d.get("repair_or_replace", "repair"),
            "confidence": d.get("confidence", 0.90),
        }
        for d in detections
    ]

    # 5. Call Cost Agent (Spring AI / Fallback)
    try:
        cost_result = await call_cost_agent(
            vehicle_meta=extracted_vehicle_meta,
            damage_list=damage_list_for_cost,
            region=policy.region,
            idv=policy.idv,
            claim_id=tracking_claim_id,
        )
    except Exception as e:
        logger.warning(f"Cost agent failure for claim '{tracking_claim_id}': {str(e)}")
        # Gracefully handle cost agent partial failure
        from .clients.cost_agent_client import _calculate_fallback_cost_estimate
        cost_result = _calculate_fallback_cost_estimate(extracted_vehicle_meta, damage_list_for_cost, idv=policy.idv)

    # 6. Execute Fraud Checks Suite
    extracted_plate = doc_result.get("extracted_plate_number", policy.rc_number)
    damage_desc_form = doc_result.get("extracted_damage_description_from_form", "")

    fraud_checks = run_all_fraud_checks(
        damage_photos_bytes=raw_photos_bytes,
        extracted_plate=extracted_plate,
        policy_rc=policy.rc_number,
        damage_description_from_form=damage_desc_form,
        detected_parts=detections,
        claim_id=tracking_claim_id,
    )

    # 7. Evaluate Pure Deterministic Decision Engine
    policy_dict = {
        "number": policy.policy_number,
        "holder": policy.owner_name,
        "plan": policy.plan,
        "expiry": policy.expiry,
        "status": policy.status,
    }

    # Format Damage Assessment section to match frontend shape
    primary_location = "Front Bumper & Lower Grille" if any("bumper" in d.get("part_name", "") for d in detections) else "Body Structure"
    formatted_damage_assessment = {
        "severity": img_result.get("overall_damage_status", "moderate"),
        "severity_label": img_result.get("overall_damage_status", "moderate").capitalize(),
        "location": "front_impact" if "Front" in primary_location else "side_impact",
        "location_label": primary_location,
        "vehicle_tier": "economy",
        "vehicle_tier_label": f"{extracted_vehicle_meta.get('make', 'Standard')} {extracted_vehicle_meta.get('model', 'Sedan')}",
        "detected_parts": [
            {
                "part": d.get("part_name", "").title(),
                "type": f"{d.get('severity', 'moderate').capitalize()} Damage",
                "action": "Replace & Paint" if d.get("repair_or_replace") == "replace" else "Repair & Refit",
                "confidence": f"{int(d.get('confidence', 0.9) * 100)}%",
                "material_type": d.get("material_type", "metal"),
            }
            for d in detections
        ],
        "photos_analyzed": img_result.get("photos_analyzed", len(photo_buffers)),
        "no_damage_detected": img_result.get("no_damage_detected", False),
    }

    decision_status, status_label, status_desc, decision_trail = evaluate_claim_decision(
        document_check=doc_result,
        damage_assessment=formatted_damage_assessment,
        cost_estimate=cost_result,
        fraud_checks=fraud_checks,
        policy=policy_dict,
        base_time=submission_dt,
    )

    # 8. Assemble Final Claim Process Response
    duration_ms = round((time.time() - start_time) * 1000, 2)
    logger.info(
        f"Claim adjudication completed for '{tracking_claim_id}' in {duration_ms}ms. "
        f"Final Decision: {decision_status.upper()} ({status_label})"
    )

    return ClaimProcessResponse(
        id=tracking_claim_id.lower().replace("-", "_"),
        claim_id=tracking_claim_id,
        submission_timestamp=submission_dt.strftime("%d %b %Y, %I:%M %p IST"),
        status=decision_status,
        status_label=status_label,
        status_description=status_desc,
        vehicle={
            "make": extracted_vehicle_meta.get("make", "Maruti Suzuki"),
            "model": extracted_vehicle_meta.get("model", "Swift"),
            "variant": extracted_vehicle_meta.get("variant", "VXI"),
            "year": extracted_vehicle_meta.get("registration_year", 2021),
            "registration": policy.rc_number,
            "fuel": "Petrol",
        },
        policy=policy_dict,
        document_check=doc_result,
        damage_assessment=formatted_damage_assessment,
        cost_estimate=cost_result.model_dump(),
        fraud_checks=fraud_checks,
        decision_trail=decision_trail,
    )
