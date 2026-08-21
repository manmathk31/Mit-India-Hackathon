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
class CostSource(BaseModel):
    type: str = "vision"
    icon: str = "camera"
    label: str
    low: float
    high: float
    formatted: str
    desc: str


class CostReconciliation(BaseModel):
    """Normalized cost calculation contract for frontend rendering."""
    final_low: float
    final_high: float
    formatted_final: str
    recommended_payout: str
    currency: str = "INR"
    confidence: Literal["high", "medium", "low"] = "high"
    confidence_label: str
    sources: List[CostSource] = Field(default_factory=list)
    reasoning: str
    disclaimer: str
    total_loss_flag: bool = False
    parts_cost_total: float = 0.0
    labour_cost_total: float = 0.0


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
    claim_id: Optional[str] = None
    timestamp: str
