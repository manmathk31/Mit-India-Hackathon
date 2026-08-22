from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


# Verification Status Enum Types
VerificationStatus = Literal["verified", "resolved", "warning"]


class PolicyRecord(BaseModel):
    """Authoritative policy record passed by orchestrator."""
    owner_name: str = Field(..., description="Insured owner full name as per policy record")
    rc_number: str = Field(..., description="Vehicle registration certificate number")
    chassis_number: str = Field(..., description="Vehicle chassis / VIN number")
    claim_id: Optional[str] = Field(None, description="Optional claim reference ID for tracking/logging")
    vehicle_type: Optional[str] = Field("LMV", description="Vehicle category: e.g. LMV (Light Motor Vehicle/Car), MCWG (2-Wheeler), Commercial")

    @field_validator("owner_name", "rc_number", "chassis_number", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip()
        return v


class FieldVerificationResult(BaseModel):
    """Verification outcome for an individual document field."""
    name: str = Field(..., description="Field identifier, e.g. 'owner_name', 'rc_number', 'chassis_number', 'dl_validity', 'cross_doc_owner_match'")
    value: str = Field(..., description="Extracted or normalized field value")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    status: VerificationStatus = Field(..., description="Field verification status")
    note: str = Field(..., description="Explanation of verification result, fuzzy resolution details, or warning reasons")
    isResolved: Optional[bool] = Field(default=False, description="True if a mismatch was resolved via fuzzy match or secondary signals")


class ExtractedVehicleMeta(BaseModel):
    """Vehicle metadata extracted from RC used for downstream Cost/Depreciation Agent."""
    make: str = Field(..., description="Vehicle manufacturer, e.g. 'Maruti Suzuki', 'Hyundai' or 'UNKNOWN'")
    model: str = Field(..., description="Vehicle model, e.g. 'Swift Dzire', 'Creta' or 'UNKNOWN'")
    variant: str = Field(..., description="Vehicle variant/trim, e.g. 'VXI', 'SX (O)' or 'UNKNOWN'")
    registration_year: Optional[int] = Field(None, description="Year of vehicle registration or None if unknown")


class DocumentVerificationResponse(BaseModel):
    """Exact output contract enforced for downstream Orchestrator consumption."""
    overall_status: VerificationStatus = Field(..., description="Aggregate status: worst-case across all field verification results")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Overall aggregate confidence score")
    fields: List[FieldVerificationResult] = Field(..., description="List of verified document fields")
    extracted_plate_number: str = Field(..., description="Extracted vehicle number plate string for downstream plate-vs-RC fraud check")
    extracted_vehicle_meta: ExtractedVehicleMeta = Field(..., description="Extracted vehicle specifications for depreciation calculation")
    extracted_damage_description_from_form: str = Field(..., description="Verbatim free-text damage description from claim form")


# Granular Raw Extraction Structures with Per-Field Confidences
class ExtractedRCDocument(BaseModel):
    owner_name: str = "Unreadable / Missing"
    owner_name_confidence: float = 0.10
    rc_number: str = "Unreadable / Missing"
    rc_number_confidence: float = 0.10
    chassis_number: str = "Unreadable / Missing"
    chassis_number_confidence: float = 0.10
    engine_number: Optional[str] = ""
    make: str = "Unknown Make"
    model: str = "Unknown Model"
    variant: str = "Standard"
    registration_year: Optional[int] = None  # None when year cannot be extracted
    plate_number: str = "Unreadable / Missing"
    document_type_detected: str = "RC"
    confidence: float = 0.10


class ExtractedDLDocument(BaseModel):
    dl_number: str = "Unreadable / Missing"
    dl_number_confidence: float = 0.10
    holder_name: str = "Unreadable / Missing"
    holder_name_confidence: float = 0.10
    expiry_date: str = "Unreadable / Missing"
    expiry_date_confidence: float = 0.10
    issue_date: Optional[str] = ""
    vehicle_classes: Optional[List[str]] = Field(default_factory=list)
    document_type_detected: str = "DL"
    confidence: float = 0.10


class ExtractedClaimFormDocument(BaseModel):
    claimant_name: str = "Unreadable / Missing"
    claimant_name_confidence: float = 0.10
    vehicle_number: Optional[str] = ""
    policy_number: Optional[str] = ""
    incident_date: Optional[str] = ""
    damage_description: str = "No damage description parsed from uploaded document"
    damage_description_confidence: float = 0.10
    document_type_detected: str = "CLAIM_FORM"
    confidence: float = 0.10


class RawExtractedDocuments(BaseModel):
    rc: ExtractedRCDocument
    dl: ExtractedDLDocument
    claim_form: ExtractedClaimFormDocument
    fallback_invocations_count: int = 0  # Number of low-confidence fields repaired by targeted LLM


class ErrorDetail(BaseModel):
    error: str
    detail: str
    claim_id: Optional[str] = None
    timestamp: str
