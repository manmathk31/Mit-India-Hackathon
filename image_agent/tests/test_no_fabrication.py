import pytest
from image_agent.extractor import extract_damage_assessment, InvalidPhotoError
from image_agent.config import settings
from image_agent.schemas import DamageAssessmentResponse, DamageDetection, BoundingBox


@pytest.mark.asyncio
async def test_empty_photo_buffer_rejected():
    """Empty or unreadable photo bytes must raise InvalidPhotoError."""
    with pytest.raises(InvalidPhotoError):
        await extract_damage_assessment([(0, b"")])


@pytest.mark.asyncio
async def test_corrupt_photo_buffer_rejected():
    """Corrupted bytes must raise InvalidPhotoError."""
    with pytest.raises(InvalidPhotoError):
        await extract_damage_assessment([(0, b"not-a-valid-image-bytes")])


def test_damage_detection_validation():
    """Damage detection schema strictly validates severity."""
    with pytest.raises(Exception):
        DamageDetection(
            part_name="bumper",
            material_type="plastic-rubber",
            severity="invalid_severity",  # Not in Literal["minor", "moderate", "severe"]
            repair_or_replace="repair",
            confidence=0.9,
            bounding_box=BoundingBox(x=0, y=0, w=10, h=10),
            source_image_index=0,
        )
