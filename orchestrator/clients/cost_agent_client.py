from typing import Any, Dict, List, Optional
import httpx

from ..config import settings
from ..logger import logger
from ..schemas import CostReconciliation


class CostAgentClientError(Exception):
    """Exception raised when cost estimation client encounters an unrecoverable failure."""
    pass


# Built-in fallback estimator has been completely removed.
# The system now strictly relies on the external Spring Boot Cost Agent.


async def call_cost_agent(
    vehicle_meta: Dict[str, Any],
    damage_list: List[Dict[str, Any]],
    document_confidence: float = 0.95,
    region: Optional[str] = "Pune, Maharashtra",
    idv: Optional[float] = 550000.0,
    claim_id: Optional[str] = None,
) -> CostReconciliation:
    """
    Calls Pratik's Spring Boot Cost Agent microservice at COST_AGENT_URL.
    """
    url = settings.COST_AGENT_URL
    timeout = settings.HTTP_TIMEOUT_SECONDS

    # 1. Determine overall damage severity and location
    overall_severity = "LOW"
    severity_map = {"minor": "LOW", "moderate": "MEDIUM", "severe": "HIGH", "critical": "SEVERE"}
    
    parts_input = []
    avg_vision_confidence = 0.0
    if damage_list:
        worst_sev = "minor"
        for d in damage_list:
            s = d.get("severity", "minor").lower()
            if s == "severe" or s == "critical": worst_sev = "severe"
            elif s == "moderate" and worst_sev not in ["severe", "critical"]: worst_sev = "moderate"
            
            # Map Part Input Enums
            wt = d.get("repair_or_replace", "repair").upper()
            if wt not in ["REPAIR", "REPLACEMENT", "PAINTING"]: wt = "REPAIR"
            
            mt = str(d.get("material_type", "metal")).upper().replace("-", "_")
            if mt not in ["METAL", "PLASTIC_RUBBER", "GLASS", "FIBREGLASS", "UNKNOWN"]: mt = "METAL"
            
            parts_input.append({
                "partName": d.get("part_name", "Unknown Part"),
                "workType": wt,
                "materialType": mt,
                "severity": severity_map.get(s, "LOW")
            })
            avg_vision_confidence += float(d.get("confidence", 0.9))
        
        overall_severity = severity_map.get(worst_sev, "LOW")
        avg_vision_confidence = avg_vision_confidence / len(damage_list)
    else:
        avg_vision_confidence = 1.0

    # 2. Build Source Assessments
    source_assessments = [
        {
            "source": "Document Verification Agent",
            "confidence": min(1.0, max(0.0, document_confidence)),
            "agreesWithEstimate": True
        },
        {
            "source": "Computer Vision Damage Agent",
            "confidence": min(1.0, max(0.0, avg_vision_confidence)),
            "agreesWithEstimate": True
        }
    ]

    # 3. Build exact payload for CostEstimateRequest.java
    # CRITICAL: Never fabricate vehicle identity. If make/model/year are unknown,
    # we cannot produce a valid cost estimate — return insufficient_data instead.
    cid = claim_id or "UNKNOWN"
    make = vehicle_meta.get("make", "UNKNOWN")
    model = vehicle_meta.get("model", "UNKNOWN")
    variant = vehicle_meta.get("variant", "UNKNOWN")
    reg_year = vehicle_meta.get("registration_year")

    if make == "UNKNOWN" or model == "UNKNOWN" or not reg_year:
        logger.warning(
            f"Cannot call Cost Agent for claim '{claim_id or 'UNKNOWN'}': "
            f"vehicle identity incomplete (make={make}, model={model}, year={reg_year}). "
            f"Returning insufficient_data status."
        )
        return CostReconciliation(status="insufficient_data")

    payload = {
        "vehicleMake": make,
        "vehicleModel": model,
        "variant": variant if variant != "UNKNOWN" else "",
        "registrationYear": int(reg_year),
        "damageLocation": "Exterior Vehicle Panels",
        "damageSeverity": overall_severity,
        "city": region.split(",")[0].strip() if region else "Pune",
        "region": region,
        "sourceAssessments": source_assessments,
        "idv": idv,
        "affectedParts": parts_input
    }
    
    # If no parts are damaged, we return a 0 CostReconciliation early
    if not parts_input:
        logger.info(f"[Cost Agent] No damaged parts detected for claim '{cid}'. Returning zero-cost reconciliation.")
        return CostReconciliation(
            status="success",
            vehicle=None,
            partsCost={"replacementBeforeDepreciation": 0, "depreciationAmount": 0, "afterDepreciation": 0, "repairMaterialCost": 0, "paintingCost": 0, "totalPartsCost": 0},
            laborCost={"min": 0, "max": 0},
            combinedTotal={"min": 0, "max": 0},
            confidence={"overall": 1.0, "sourceAgreement": "High Agreement", "sourcesUsed": ["Vision Agent"]},
            totalLoss={"idv": idv, "threshold75Percent": idv * 0.75 if idv else 0, "repairCostForCheck": 0, "exceeds75Percent": False},
            partBreakdown=[]
        )

    logger.info(
        f"[OUTBOUND -> Cost Agent] Calling {url} | Claim: '{cid}' | Vehicle: {make} {model} ({reg_year}) | "
        f"Parts to estimate: {len(parts_input)}"
    )

    t0 = time.time()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
            duration_ms = int((time.time() - t0) * 1000)

            if response.status_code == 200:
                data = response.json()
                total_min = data.get("combinedTotal", {}).get("min", 0)
                total_max = data.get("combinedTotal", {}).get("max", 0)
                logger.info(
                    f"[INBOUND <- Cost Agent] Success HTTP 200 in {duration_ms}ms | Claim: '{cid}' | "
                    f"Estimate: ₹{total_min:,.0f} – ₹{total_max:,.0f} | Breakdown items: {len(data.get('partBreakdown', []))}"
                )

                # Parse the CostEstimateResponse shape
                return CostReconciliation(
                    status="success",
                    vehicle=data.get("vehicle"),
                    partsCost=data.get("partsCost"),
                    laborCost=data.get("laborCost"),
                    combinedTotal=data.get("combinedTotal"),
                    confidence=data.get("confidence"),
                    totalLoss=data.get("totalLoss"),
                    partBreakdown=data.get("partBreakdown", [])
                )

            logger.error(
                f"[INBOUND <- Cost Agent] HTTP {response.status_code} in {duration_ms}ms | Claim: '{cid}': {response.text[:300]}"
            )
    except Exception as e:
        duration_ms = int((time.time() - t0) * 1000)
        logger.exception(f"[Cost Agent] Error connecting to {url} after {duration_ms}ms for claim '{cid}': {e}")

    # Honest degraded state
    return CostReconciliation(status="unavailable")
