import asyncio
import json
import time
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .auth import get_current_user, require_admin_role, router as auth_router
from .clients.cost_agent_client import call_cost_agent
from .clients.document_agent_client import call_document_agent
from .clients.image_agent_client import call_image_agent
from .config import settings
from .db import (
    Claim,
    ClaimAdminOverride,
    ClaimDecisionTrail,
    ClaimDetectedPart,
    ClaimFraudCheck,
    ClaimPhoto,
    Policy,
    User,
    get_db,
    init_db,
)
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
    description="Central coordination microservice with Supabase Database and JWT Authentication.",
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

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# Register Authentication Router
app.include_router(auth_router)

# Mount Static Assets & Serve Frontend Directly on Port 8000
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS_DIR = os.path.join(ROOT_DIR, "css")
JS_DIR = os.path.join(ROOT_DIR, "js")
INDEX_HTML = os.path.join(ROOT_DIR, "index.html")

if os.path.exists(CSS_DIR):
    app.mount("/css", StaticFiles(directory=CSS_DIR), name="css")
if os.path.exists(JS_DIR):
    app.mount("/js", StaticFiles(directory=JS_DIR), name="js")


@app.get("/", include_in_schema=False)
async def serve_frontend():
    """Serves the ClaimPilot AI frontend directly from FastAPI root."""
    if os.path.exists(INDEX_HTML):
        return FileResponse(INDEX_HTML)
    return {"status": "ok", "service": settings.SERVICE_NAME}


@app.on_event("startup")
async def startup_event():
    # Reloaded configuration with live Supabase IPv4 pooler
    logger.info(
        f"Starting {settings.SERVICE_NAME} v{settings.SERVICE_VERSION} "
        f"[DocAgent={settings.DOCUMENT_AGENT_URL}, ImgAgent={settings.IMAGE_AGENT_URL}, CostAgent={settings.COST_AGENT_URL}]"
    )
    # Initialize DB tables
    await init_db()


@app.get("/health", tags=["System"])
async def health_check():
    """Liveness probe reporting connected microservices and database."""
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "connected_services": {
            "document_agent": settings.DOCUMENT_AGENT_URL,
            "image_agent": settings.IMAGE_AGENT_URL,
            "cost_agent": settings.COST_AGENT_URL,
        },
        "database": "connected" if settings.DATABASE_URL else "local_sqlite",
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


# ------------------------------------------------------------------------------
# CLAIMS ADJUDICATION PIPELINE & PERSISTENCE
# ------------------------------------------------------------------------------

@app.post(
    "/claims/process",
    response_model=ClaimProcessResponse,
    status_code=status.HTTP_200_OK,
    tags=["Claims"],
    summary="End-to-end multi-agent claim adjudication pipeline with database persistence",
)
async def process_claim(
    rc_image: UploadFile = File(..., description="Vehicle Registration Certificate image"),
    dl_image: UploadFile = File(..., description="Driver Driving Licence image"),
    claim_form_image: UploadFile = File(..., description="Claim Intimation Form image"),
    damage_photos: List[UploadFile] = File(..., description="1 to 8 physical vehicle damage photos"),
    policy_record: str = Form(..., description="Authoritative policy record JSON string"),
    claim_id: Optional[str] = Form(None, description="Optional unique claim identifier"),
    db: AsyncSession = Depends(get_db),
):
    """
    Core ClaimPilot AI Adjudication & DB Persistence Endpoint.
    1. Concurrently calls Document Agent & Image Agent.
    2. Calls Spring AI Cost Agent with extracted vehicle specs & damage matrix.
    3. Runs comprehensive Fraud Verification scans.
    4. Evaluates pure deterministic Decision Engine (Statutory IRDAI limit, Total Loss, Auto-Approval).
    5. Saves full claim, detections, and audit trails to PostgreSQL / Supabase.
    6. Returns unified response matching frontend contract.
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

    # 5. Call Cost Agent (Spring Boot)
    try:
        cost_result = await call_cost_agent(
            vehicle_meta=extracted_vehicle_meta,
            damage_list=damage_list_for_cost,
            document_confidence=doc_result.get("confidence_score", 0.95),
            region=policy.region,
            idv=policy.idv,
            claim_id=tracking_claim_id,
        )
    except Exception as e:
        logger.error(f"Cost agent failure for claim '{tracking_claim_id}': {str(e)}")
        # Honest fallback if even the HTTP call wrapper fails unexpectedly
        from .schemas import CostReconciliation
        cost_result = CostReconciliation(status="unavailable")

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

    # 8. Persist to PostgreSQL / Supabase Database
    try:
        claim_row = Claim(
            claim_number=tracking_claim_id,
            incident_date=submission_dt,
            incident_description=damage_desc_form or "Motor damage collision intake",
            status=decision_status,
            status_label=status_label,
            status_description=status_desc,
            overall_damage_severity=img_result.get("overall_damage_status", "moderate"),
            estimated_cost_low=cost_result.final_low,
            estimated_cost_high=cost_result.final_high,
            recommended_payout=float(cost_result.recommended_payout.replace("₹", "").replace(",", "")),
            document_check_json=doc_result,
            damage_assessment_json=formatted_damage_assessment,
            cost_estimate_json=cost_result.model_dump(),
        )
        db.add(claim_row)
        await db.flush()

        # Add detected parts
        for d in detections:
            part_row = ClaimDetectedPart(
                claim_id=claim_row.id,
                part_name=d.get("part_name", ""),
                material_type=d.get("material_type", "metal"),
                severity=d.get("severity", "moderate"),
                repair_or_replace=d.get("repair_or_replace", "repair"),
                confidence=float(d.get("confidence", 0.9)),
                bounding_box=d.get("bounding_box", {}),
            )
            db.add(part_row)

        # Add fraud checks
        for fc in fraud_checks:
            fc_row = ClaimFraudCheck(
                claim_id=claim_row.id,
                check_name=fc.name,
                status=fc.status,
                detail=fc.detail,
            )
            db.add(fc_row)

        # Add decision trails
        for dt in decision_trail:
            dt_row = ClaimDecisionTrail(
                claim_id=claim_row.id,
                step_name=dt.step,
                outcome=dt.outcome,
                detail=dt.detail,
                status=dt.status,
                timestamp=dt.timestamp,
            )
            db.add(dt_row)

        await db.commit()
        logger.info(f"Persisted claim '{tracking_claim_id}' successfully to database (UUID: {claim_row.id})")

    except Exception as e:
        logger.warning(f"Database write exception for claim '{tracking_claim_id}': {str(e)}")
        # Don't fail customer response if DB commit encountered a non-fatal constraint
        await db.rollback()

    # 9. Return Unified Response
    duration_ms = round((time.time() - start_time) * 1000, 2)
    logger.info(f"Claim adjudication completed for '{tracking_claim_id}' in {duration_ms}ms")

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


# ------------------------------------------------------------------------------
# CLAIMS RETRIEVAL & SURVEYOR OVERRIDE ENDPOINTS
# ------------------------------------------------------------------------------

class AdminOverrideRequest(BaseModel):
    override_status: str  # 'auto_approved', 'under_review', 'flagged'
    review_note: str
    settlement_adjusted_amount: Optional[float] = None


@app.get("/claims", tags=["Claims"])
async def list_all_claims(db: AsyncSession = Depends(get_db)):
    """Retrieves all registered claims from the database formatted for the frontend."""
    stmt = select(Claim).order_by(desc(Claim.created_at))
    result = await db.execute(stmt)
    claims = result.scalars().all()
    
    formatted = []
    for c in claims:
        doc_data = c.document_check_json or {}
        dmg_data = c.damage_assessment_json or {}
        cost_data = c.cost_estimate_json or {}

        formatted.append({
            "id": c.claim_number.lower().replace("-", "_"),
            "claim_id": c.claim_number,
            "submission_timestamp": c.created_at.strftime("%d %b %Y, %I:%M %p IST") if c.created_at else "Just now",
            "status": c.status,
            "status_label": c.status_label or c.status.replace("_", " ").title(),
            "status_description": c.status_description or "Autonomous claim processing complete.",
            "vehicle": {
                "make": dmg_data.get("vehicle_tier_label", "Maruti Suzuki Swift").split(" ")[0],
                "model": " ".join(dmg_data.get("vehicle_tier_label", "Maruti Suzuki Swift").split(" ")[1:]),
                "year": 2021,
                "registration": doc_data.get("extracted_plate_number", "MH-12-RN-8842"),
                "fuel": "Petrol"
            },
            "policy": {
                "number": "POL-PAC-9920194",
                "holder": doc_data.get("extracted_name_rc", "Manmath Kumar"),
                "plan": "Comprehensive Bumper-to-Bumper Zero Dep",
                "expiry": "18 Nov 2026",
                "status": "Active"
            },
            "document_check": doc_data,
            "damage_assessment": dmg_data,
            "cost_estimate": cost_data,
            "fraud_checks": [],
            "decision_trail": []
        })
    return formatted


@app.post("/claims/{claim_number}/override", tags=["Admin"])
async def apply_surveyor_override(
    claim_number: str,
    payload: AdminOverrideRequest,
    current_admin: User = Depends(require_admin_role),
    db: AsyncSession = Depends(get_db),
):
    """Allows an authorized Surveyor/Admin to apply a manual decision override."""
    stmt = select(Claim).where(Claim.claim_number == claim_number)
    result = await db.execute(stmt)
    claim = result.scalar_one_or_none()

    if not claim:
        raise HTTPException(status_code=404, detail=f"Claim '{claim_number}' not found")

    orig_status = claim.status
    claim.status = payload.override_status
    claim.status_label = f"Settled (Surveyor Override)" if payload.override_status == "auto_approved" else "Review (Surveyor Override)"
    claim.status_description = f"Overridden by Surveyor {current_admin.full_name}: {payload.review_note}"

    override_record = ClaimAdminOverride(
        claim_id=claim.id,
        admin_id=current_admin.id,
        original_status=orig_status,
        override_status=payload.override_status,
        review_note=payload.review_note,
        settlement_adjusted_amount=payload.settlement_adjusted_amount,
    )
    db.add(override_record)
    await db.commit()

    logger.info(f"Surveyor override applied to '{claim_number}' by {current_admin.email}")
    return {"status": "success", "claim_number": claim_number, "new_status": payload.override_status}
