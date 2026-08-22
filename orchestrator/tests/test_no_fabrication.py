import pytest
import io
from PIL import Image

from orchestrator.clients.cost_agent_client import call_cost_agent
from orchestrator.fraud_checks import (
    duplicate_check,
    live_camera_anti_spoofing_check,
    plate_vs_rc_check,
)
from orchestrator.schemas import CostReconciliation


@pytest.mark.asyncio
async def test_cost_client_guards_against_unknown_vehicle_meta():
    """Cost client must fall back gracefully to default specs and calculate costs when vehicle_meta is incomplete."""
    unknown_meta = {"make": "UNKNOWN", "model": "UNKNOWN", "registration_year": None}
    
    res = await call_cost_agent(
        vehicle_meta=unknown_meta,
        damage_list=[{"part_name": "front bumper", "material_type": "plastic-rubber", "severity": "minor", "repair_or_replace": "repair", "confidence": 0.9}],
        document_confidence=0.9,
        region="Mumbai",
        idv=500000.0,
        claim_id="CLM-TEST-001",
    )
    
    assert res.status == "success"
    assert res.final_low > 0


def test_anti_spoofing_flags_images_without_exif():
    """Images created in memory (without camera EXIF) must be flagged with warning, not blindly passed."""
    # Generate clean in-memory image
    img = Image.new("RGB", (800, 600), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    photo_bytes = buf.getvalue()

    result = live_camera_anti_spoofing_check([photo_bytes])
    
    # Must NOT blindly pass — lack of camera EXIF is noted honestly
    assert result.status in ("warning", "failed")
    assert "EXIF" in result.detail or "camera" in result.detail.lower()


def test_anti_spoofing_empty_photos():
    result = live_camera_anti_spoofing_check([])
    assert result.status == "warning"
