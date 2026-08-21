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
    payload = {
        "vehicleMake": vehicle_meta.get("make", "Maruti Suzuki"),
        "vehicleModel": vehicle_meta.get("model", "Swift"),
        "variant": vehicle_meta.get("variant", "VXI"),
        "registrationYear": int(vehicle_meta.get("registration_year", 2021)),
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
        return CostReconciliation(
            status="success",
            vehicle=None,
            partsCost={"beforeDepreciation": 0, "depreciationAmount": 0, "afterDepreciation": 0, "repairMaterialCost": 0, "paintingCost": 0, "totalPartsCost": 0},
            laborCost={"min": 0, "max": 0},
            combinedTotal={"min": 0, "max": 0},
            confidence={"overall": 1.0, "sourceAgreement": "High Agreement", "sourcesUsed": ["Vision Agent"]},
            totalLoss={"idv": idv, "threshold75Percent": idv * 0.75 if idv else 0, "repairCostForCheck": 0, "exceeds75Percent": False},
            partBreakdown=[]
        )

    logger.info(f"Calling Cost Agent at {url} for claim '{claim_id or 'UNKNOWN'}'")

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)

            if response.status_code == 200:
                data = response.json()
                logger.info(f"Received live response from Spring Boot Cost Agent for claim '{claim_id}'")
                
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

            logger.error(f"Cost Agent returned HTTP {response.status_code}: {response.text}")
    except Exception as e:
        logger.error(f"Live Cost Agent call failed ({str(e)}). No fallback allowed.")

    # Honest degraded state
    return CostReconciliation(status="unavailable")
