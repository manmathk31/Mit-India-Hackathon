from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator

# Decision Outcomes
ClaimDecisionStatus = Literal["auto_approved", "under_review", "flagged"]
FraudCheckStatus = Literal["passed", "warning", "failed"]


class PolicyRecordInput(BaseModel):
    """Authoritative policy record passed into the claim adjudication pipeline."""
    owner_name: str = Field(..., description="Insured policyholder name")
    rc_number: str = Field(..., description="Vehicle registration number")
    chassis_number: Optional[str] = Field("MA3EKB21S00129845", description="17-character vehicle chassis number")
    claim_id: Optional[str] = Field(None, description="Claim identifier")
    policy_number: Optional[str] = Field("POL-PAC-9920194", description="Policy contract number")
    plan: Optional[str] = Field("Comprehensive Bumper-to-Bumper Zero Dep", description="Policy insurance tier")
    expiry: Optional[str] = Field("18 Nov 2026", description="Policy expiration date")
    status: Optional[str] = Field("Active", description="Policy validity status")
    idv: Optional[float] = Field(550000.0, description="Insured Declared Value of vehicle in INR")
    region: Optional[str] = Field("Pune, Maharashtra", description="Accident / settlement jurisdiction region")


class FraudCheckResult(BaseModel):
    """Result of an individual fraud detection check."""
    name: str = Field(..., description="Fraud check name, e.g. 'Duplicate Claim Hash Check'")
    status: FraudCheckStatus = Field(..., description="Check status: passed, warning, failed")
    detail: str = Field(..., description="Detailed explanation of the findings")


class DecisionTrailEntry(BaseModel):
    """Step-by-step audit record for automated claim adjudication decision."""
    step: str = Field(..., description="Pipeline execution stage, e.g. 'Validation Gate', 'Document Verification'")
    outcome: str = Field(..., description="High-level result, e.g. 'Passed', 'Auto-Approved'")
    detail: str = Field(..., description="Audit explanation")
    status: str = Field(..., description="Status indicator: 'completed', 'success', 'warning', 'flagged'")
    timestamp: str = Field(..., description="Formatted timestamp of step completion")


# Cost Agent Normalized Data Contract (Spring AI Adapter)
class VehicleSummary(BaseModel):
    make: str
    model: str
    variant: Optional[str] = None
    registrationYear: int
    vehicleAge: int


class PartsCost(BaseModel):
    beforeDepreciation: float
    depreciationAmount: float
    afterDepreciation: float
    repairMaterialCost: float
    paintingCost: float
    totalPartsCost: float


class LaborCost(BaseModel):
    min: float
    max: float


class CombinedTotal(BaseModel):
    min: float
    max: float


class ConfidenceMetadata(BaseModel):
    overall: float
    sourceAgreement: str
    sourcesUsed: List[str]


class TotalLossCheck(BaseModel):
    idv: Optional[float] = None
    threshold75Percent: Optional[float] = None
    repairCostForCheck: float
    exceeds75Percent: bool


class PartCostResult(BaseModel):
    partName: str
    workType: str
    materialType: str
    baseCost: float
    depreciationRate: float
    depreciationAmount: float
    postDepreciationCost: float


class CostReconciliation(BaseModel):
    """Normalized cost calculation contract mapped from Spring Boot CostEstimateResponse."""
    status: Literal["success", "unavailable"] = "success"
    vehicle: Optional[VehicleSummary] = None
    partsCost: Optional[PartsCost] = None
    laborCost: Optional[LaborCost] = None
    combinedTotal: Optional[CombinedTotal] = None
    confidence: Optional[ConfidenceMetadata] = None
    totalLoss: Optional[TotalLossCheck] = None
    partBreakdown: Optional[List[PartCostResult]] = None

    @property
    def final_low(self) -> float:
        """Lower bound of total repair estimate (parts + labour min)."""
        if self.combinedTotal:
            return float(self.combinedTotal.min)
        if self.partsCost:
            return float(self.partsCost.totalPartsCost)
        return 0.0

    @property
    def final_high(self) -> float:
        """Upper bound of total repair estimate (parts + labour max)."""
        if self.combinedTotal:
            return float(self.combinedTotal.max)
        if self.partsCost:
            return float(self.partsCost.totalPartsCost * 1.15)
        return 0.0

    @property
    def recommended_payout(self) -> str:
        """Formatted INR string of the recommended settlement payout (midpoint)."""
        mid = (self.final_low + self.final_high) / 2.0
        return f"₹{mid:,.0f}"

    @property
    def formatted_final(self) -> str:
        """Formatted INR range string for the frontend cost table."""
        return f"₹{self.final_low:,.0f} – ₹{self.final_high:,.0f}"


# Final Required Output Shape (Frontend API Contract)
class ClaimProcessResponse(BaseModel):
    """Unified ClaimPilot AI Adjudication & Decision Response."""
    id: Optional[str] = None
    claim_id: str
    submission_timestamp: str
    status: ClaimDecisionStatus
    status_label: str
    status_description: str
    vehicle: Dict[str, Any]
    policy: Dict[str, Any]
    document_check: Dict[str, Any]
    damage_assessment: Dict[str, Any]
    cost_estimate: Dict[str, Any]
    fraud_checks: List[FraudCheckResult]
    decision_trail: List[DecisionTrailEntry]


class ErrorDetail(BaseModel):
    error: str
    detail: str
    stage: Optional[str] = None  # e.g. 'document_agent', 'image_agent', 'cost_agent', 'orchestration'
    claim_id: Optional[str] = None
    timestamp: str
