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


@pytest.mark.asyncio
async def test_validate_single_document_corrupted_image():
    """Corrupted bytes must be flagged with valid: False."""
    from document_agent.extractor import validate_single_document
    result = await validate_single_document(b"not an image", "rc")
    assert result["valid"] is False
    assert result["detected_type"] == "INVALID_IMAGE"


@pytest.mark.asyncio
async def test_validate_single_document_dl_uploaded_as_rc(monkeypatch):
    """When a Driving Licence is uploaded into the RC slot, it must be detected and rejected."""
    import io
    from PIL import Image
    from document_agent.extractor import validate_single_document
    import document_agent.extractor as ext_mod

    # Mock OCR returning DL text
    monkeypatch.setattr(
        ext_mod,
        "_run_local_tesseract_ocr",
        lambda img_bytes: ("UNION OF INDIA DRIVING LICENCE LICENCE NO DL-0420110023456 HOLDER LMV", 0.95)
    )

    img = Image.new("RGB", (400, 300), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    result = await validate_single_document(buf.getvalue(), "rc")
    assert result["valid"] is False
    assert result["detected_type"] == "DL"
    assert "Driver's Licence" in result["reason"] or "DL" in result["reason"]
