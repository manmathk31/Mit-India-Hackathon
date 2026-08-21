from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator
from .material_lookup import MaterialType, lookup_material_type

DamageSeverity = Literal["minor", "moderate", "severe"]
OverallDamageStatus = Literal["minor", "moderate", "severe", "none"]
RepairOrReplace = Literal["repair", "replace"]


class BoundingBox(BaseModel):
    """Pixel coordinates of detected damage area relative to source image dimensions."""
    x: int = Field(..., ge=0, description="X coordinate of top-left corner in pixels")
    y: int = Field(..., ge=0, description="Y coordinate of top-left corner in pixels")
    w: int = Field(..., gt=0, description="Width of bounding box in pixels")
    h: int = Field(..., gt=0, description="Height of bounding box in pixels")


class DamageDetection(BaseModel):
    """Individual vehicle part damage detection."""
    part_name: str = Field(..., description="Vehicle part name, e.g. 'front bumper', 'left fender'")
    material_type: MaterialType = Field(..., description="Material classification for depreciation: metal, plastic-rubber, glass, fibreglass, unknown")
    severity: DamageSeverity = Field(..., description="Damage severity level: minor, moderate, severe")
    repair_or_replace: RepairOrReplace = Field(..., description="Inferred insurance action: repair or replace")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score between 0.0 and 1.0")
    bounding_box: BoundingBox = Field(..., description="Bounding box on source image")
    source_image_index: int = Field(..., ge=0, description="0-indexed position of source photo in the uploaded batch")

    @field_validator("material_type", mode="before")
    @classmethod
    def validate_or_fallback_material(cls, v: str, info) -> str:
        # If model returned unknown or invalid, try resolving via part_name
        if not v or v not in ["metal", "plastic-rubber", "glass", "fibreglass", "unknown"]:
            part = info.data.get("part_name", "")
            return lookup_material_type(part)
        return v


class DamageAssessmentResponse(BaseModel):
    """Pydantic-enforced exact contract for downstream Orchestrator & UI consumption."""
    overall_damage_status: OverallDamageStatus = Field(..., description="Highest severity detected across all photos: minor, moderate, severe, none")
    detections: List[DamageDetection] = Field(default_factory=list, description="List of individual damage detections")
    photos_analyzed: int = Field(..., ge=0, description="Total number of valid damage photos analyzed")
    no_damage_detected: bool = Field(..., description="True if no damage was identified on any uploaded photos")


class ErrorDetail(BaseModel):
    """Structured error response model."""
    error: str
    detail: str
    claim_id: Optional[str] = None
    timestamp: str
