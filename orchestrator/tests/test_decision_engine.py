from datetime import datetime
import pytest

from orchestrator.decision_engine import evaluate_claim_decision
from orchestrator.schemas import CostReconciliation, CostSource, FraudCheckResult


def _build_dummy_cost(
    final_low: float,
    final_high: float,
    confidence: str = "high",
    total_loss_flag: bool = False,
) -> CostReconciliation:
    return CostReconciliation(
        final_low=final_low,
        final_high=final_high,
        formatted_final=f"₹{int(final_low):,} — ₹{int(final_high):,}",
        recommended_payout=f"₹{int((final_low+final_high)/2):,}",
        currency="INR",
        confidence=confidence,
        confidence_label="High Agreement (94%)" if confidence == "high" else "Medium Agreement (78%)",
        sources=[],
        reasoning="Multi-agent pricing agreement verified.",
        disclaimer="Pre-inspection estimate.",
        total_loss_flag=total_loss_flag,
    )


def test_clean_auto_approval():
    doc_check = {"overall_status": "verified", "confidence_score": 0.98}
    damage_assessment = {"overall_damage_status": "moderate", "detections": [{"part_name": "front bumper"}]}
    cost_est = _build_dummy_cost(18000.0, 24000.0, confidence="high", total_loss_flag=False)
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
    cost_est = _build_dummy_cost(52000.0, 68000.0, confidence="high", total_loss_flag=False)
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
    cost_est = _build_dummy_cost(35000.0, 45000.0, confidence="high", total_loss_flag=True)
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
    cost_est = _build_dummy_cost(18000.0, 24000.0, confidence="high", total_loss_flag=False)
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
    cost_est = _build_dummy_cost(18000.0, 24000.0, confidence="high", total_loss_flag=False)
    fraud_checks = [
        FraudCheckResult(name="Duplicate Claim Hash Check", status="failed", detail="Duplicate photo detected!"),
    ]
    policy = {"status": "Active", "number": "POL-12345"}

    status, label, desc, trail = evaluate_claim_decision(
        doc_check, damage_assessment, cost_est, fraud_checks, policy
    )

    assert status == "flagged"
    assert "Fraud" in label or "Discrepancy" in label
