from datetime import datetime
import pytest

from orchestrator.decision_engine import evaluate_claim_decision
from orchestrator.schemas import (
    CombinedTotal,
    ConfidenceMetadata,
    CostReconciliation,
    FraudCheckResult,
    LaborCost,
    PartsCost,
    TotalLossCheck,
)


def _build_dummy_cost(
    final_low: float,
    final_high: float,
    confidence_score: float = 0.94,
    total_loss_flag: bool = False,
    status: str = "success",
) -> CostReconciliation:
    if status != "success":
        return CostReconciliation(status=status)

    parts_cost = final_low * 0.7
    return CostReconciliation(
        status="success",
        partsCost=PartsCost(
            replacementBeforeDepreciation=parts_cost,
            depreciationAmount=0.0,
            afterDepreciation=parts_cost,
            repairMaterialCost=0.0,
            paintingCost=0.0,
            totalPartsCost=parts_cost,
        ),
        laborCost=LaborCost(min=final_low * 0.3, max=final_high - parts_cost),
        combinedTotal=CombinedTotal(min=final_low, max=final_high),
        confidence=ConfidenceMetadata(
            overall=confidence_score,
            sourceAgreement="HIGH",
            sourcesUsed=["baseline", "IRDAI"],
        ),
        totalLoss=TotalLossCheck(
            idv=500000.0,
            threshold75Percent=375000.0,
            repairCostForCheck=final_high,
            exceeds75Percent=total_loss_flag,
        ),
    )


def test_clean_auto_approval():
    doc_check = {"overall_status": "verified", "confidence_score": 0.98}
    damage_assessment = {"overall_damage_status": "moderate", "detections": [{"part_name": "front bumper"}]}
    cost_est = _build_dummy_cost(18000.0, 24000.0, confidence_score=0.94, total_loss_flag=False)
    fraud_checks = [
        FraudCheckResult(name="Duplicate Check", status="passed", detail="Clean"),
        FraudCheckResult(name="Plate Parity", status="passed", detail="Clean"),
    ]
    policy = {"status": "Active", "number": "POL-12345"}

    status, label, desc, trail = evaluate_claim_decision(
        doc_check, damage_assessment, cost_est, fraud_checks, policy
    )

    assert status == "auto_approved"
    assert "Auto-Approved" in label
    assert len(trail) >= 5


def test_irdai_50k_threshold_flagged():
    # Cost exceeds 50,000 INR -> Must flag for physical surveyor regardless of high confidence
    doc_check = {"overall_status": "verified", "confidence_score": 0.99}
    damage_assessment = {"overall_damage_status": "severe", "detections": [{"part_name": "engine bay"}]}
    cost_est = _build_dummy_cost(52000.0, 68000.0, confidence_score=0.95, total_loss_flag=False)
    fraud_checks = [
        FraudCheckResult(name="Duplicate Check", status="passed", detail="Clean"),
        FraudCheckResult(name="Plate Parity", status="passed", detail="Clean"),
    ]
    policy = {"status": "Active", "number": "POL-12345"}

    status, label, desc, trail = evaluate_claim_decision(
        doc_check, damage_assessment, cost_est, fraud_checks, policy
    )

    assert status == "flagged"
    assert "Statutory Inspection" in label or "IRDAI" in desc


def test_total_loss_flagged():
    doc_check = {"overall_status": "verified", "confidence_score": 0.98}
    damage_assessment = {"overall_damage_status": "severe", "detections": [{"part_name": "chassis frame"}]}
    cost_est = _build_dummy_cost(35000.0, 45000.0, confidence_score=0.95, total_loss_flag=True)
    fraud_checks = [
        FraudCheckResult(name="Duplicate Check", status="passed", detail="Clean"),
    ]
    policy = {"status": "Active", "number": "POL-12345"}

    status, label, desc, trail = evaluate_claim_decision(
        doc_check, damage_assessment, cost_est, fraud_checks, policy
    )

    assert status == "flagged"
    assert "Total Loss" in label


def test_resolved_document_under_review():
    # Document check has "resolved" status (e.g. fuzzy match name) -> Routes to under_review
    doc_check = {"overall_status": "resolved", "confidence_score": 0.88}
    damage_assessment = {"overall_damage_status": "moderate", "detections": [{"part_name": "front bumper"}]}
    cost_est = _build_dummy_cost(18000.0, 24000.0, confidence_score=0.94, total_loss_flag=False)
    fraud_checks = [
        FraudCheckResult(name="Duplicate Check", status="passed", detail="Clean"),
    ]
    policy = {"status": "Active", "number": "POL-12345"}

    status, label, desc, trail = evaluate_claim_decision(
        doc_check, damage_assessment, cost_est, fraud_checks, policy
    )

    assert status == "under_review"
    assert "Under Review" in label


def test_fraud_failure_flagged():
    doc_check = {"overall_status": "verified", "confidence_score": 0.98}
    damage_assessment = {"overall_damage_status": "moderate", "detections": [{"part_name": "front bumper"}]}
    cost_est = _build_dummy_cost(18000.0, 24000.0, confidence_score=0.94, total_loss_flag=False)
    fraud_checks = [
        FraudCheckResult(name="Duplicate Claim Hash Check", status="failed", detail="Duplicate photo detected!"),
    ]
    policy = {"status": "Active", "number": "POL-12345"}

    status, label, desc, trail = evaluate_claim_decision(
        doc_check, damage_assessment, cost_est, fraud_checks, policy
    )

    assert status == "flagged"
    assert "Fraud" in label or "Discrepancy" in label


def test_cost_insufficient_data_flagged():
    # Unknown vehicle identity -> cost calculation cannot proceed -> claim flagged
    doc_check = {"overall_status": "warning", "confidence_score": 0.30}
    damage_assessment = {"overall_damage_status": "moderate", "detections": [{"part_name": "front bumper"}]}
    cost_est = _build_dummy_cost(0, 0, status="insufficient_data")
    fraud_checks = [
        FraudCheckResult(name="Duplicate Check", status="passed", detail="Clean"),
    ]
    policy = {"status": "Active", "number": "POL-12345"}

    status, label, desc, trail = evaluate_claim_decision(
        doc_check, damage_assessment, cost_est, fraud_checks, policy
    )

    assert status == "flagged"
    assert any("Vehicle Identity Unknown" in t.outcome for t in trail)


def test_missing_policy_status_not_assumed_active():
    # If policy has no status field, it must NOT be assumed Active
    doc_check = {"overall_status": "verified", "confidence_score": 0.98}
    damage_assessment = {"overall_damage_status": "moderate", "detections": [{"part_name": "front bumper"}]}
    cost_est = _build_dummy_cost(18000.0, 24000.0)
    fraud_checks = []
    policy = {"number": "POL-12345"}  # missing 'status'

    status, label, desc, trail = evaluate_claim_decision(
        doc_check, damage_assessment, cost_est, fraud_checks, policy
    )

    assert status == "flagged"
    assert "Policy Inactive" in label or "Unknown" in label

