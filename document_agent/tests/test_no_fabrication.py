import pytest
from document_agent.extractor import _parse_rc_locally, _run_selective_llm_disambiguation
from document_agent.schemas import ExtractedRCDocument, ExtractedVehicleMeta
from document_agent.config import settings


def test_rc_extraction_empty_text_no_fabricated_vehicle():
    """When OCR returns empty/garbage text, make and model must be UNKNOWN, not Maruti/Swift/2021."""
    res = _parse_rc_locally("SOME RANDOM UNRELATED TEXT", 0.3)
    
    assert res["make"] == "UNKNOWN", f"Expected UNKNOWN make, got {res['make']}"
    assert res["model"] == "UNKNOWN", f"Expected UNKNOWN model, got {res['model']}"
    assert res["variant"] == "UNKNOWN", f"Expected UNKNOWN variant, got {res['variant']}"
    assert res["registration_year"] is None, f"Expected None year, got {res['registration_year']}"
    assert res["document_type_detected"] == "UNVERIFIED"


def test_rc_extraction_known_make_detected():
    """When OCR contains known brands, extract them accurately."""
    sample_text = "GOVERNMENT OF MAHARASHTRA REGISTRATION CERTIFICATE MARUTI SUZUKI SWIFT VXI 2022"
    res = _parse_rc_locally(sample_text, 0.9)
    
    assert res["make"] == "Maruti Suzuki"
    assert res["model"] == "Swift"
    assert res["variant"] == "VXI"
    assert res["registration_year"] == 2022


@pytest.mark.asyncio
async def test_disambiguation_missing_key_does_not_inflate_confidence(monkeypatch):
    """When GEMINI_API_KEY is not configured, confidence must NOT be inflated to 0.88."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    
    res = await _run_selective_llm_disambiguation(
        image_bytes=b"",
        document_type="RC",
        field_name="owner_name",
        initial_extracted_value="RAJESH K",
        initial_confidence=0.40,
        context_hint="Rajesh Kumar Sharma",
    )
    
    assert res["confidence"] <= 0.40, f"Confidence inflated unexpectedly: {res['confidence']}"
    assert res["repaired_value"] == "RAJESH K"
