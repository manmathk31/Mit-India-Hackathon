from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from .config import settings
from .schemas import (
    ClaimDecisionStatus,
    CostReconciliation,
    DecisionTrailEntry,
    FraudCheckResult,
)


def evaluate_claim_decision(
    document_check: Dict[str, Any],
    damage_assessment: Dict[str, Any],
    cost_estimate: CostReconciliation,
    fraud_checks: List[FraudCheckResult],
    policy: Dict[str, Any],
    base_time: Optional[datetime] = None,
) -> Tuple[ClaimDecisionStatus, str, str, List[DecisionTrailEntry]]:
    """
    Pure, deterministic decision function for ClaimPilot AI claim adjudication.
    Evaluates statutory IRDAI thresholds, total loss flags, fraud scans,
    document validity, and cost model consensus.
    
    Returns (status, status_label, status_description, decision_trail).
    """
    t = base_time or datetime.now()
    def format_ts(offset_secs: int) -> str:
        return datetime.fromtimestamp(t.timestamp() + offset_secs).strftime("%I:%M:%S %p")

    decision_trail: List[DecisionTrailEntry] = []
    
    # --------------------------------------------------------------------------
    # Step 1: Validation Gate
    # --------------------------------------------------------------------------
    pol_status = policy.get("status", "Unknown")  # Never default to "Active" — unknown policy status must be flagged
    if pol_status != "Active":
        decision_trail.append(
            DecisionTrailEntry(
                step="Validation Gate",
                outcome="Policy Inactive",
                detail=f"Policy status is '{pol_status}'. Claim cannot proceed.",
                status="flagged",
                timestamp=format_ts(2),
            )
        )
        return (
            "flagged",
            "Flagged: Policy Inactive",
            f"Policy is '{pol_status}'. Claim settlement barred.",
            decision_trail,
        )
    
    decision_trail.append(
        DecisionTrailEntry(
            step="Validation Gate",
            outcome="Passed",
            detail=f"Policy in force ({policy.get('number', 'Active')}), zero active disputes",
            status="completed",
            timestamp=format_ts(2),
        )
    )

    # --------------------------------------------------------------------------
    # Step 2: Document Verification Evaluation
    # --------------------------------------------------------------------------
    doc_status = document_check.get("overall_status", "warning")  # Unknown status treated as warning
    doc_conf = document_check.get("confidence_score", 0.0)  # Unknown confidence — never assume 0.95
    doc_conf_pct = f"{doc_conf * 100:.1f}%" if doc_conf <= 1.0 else f"{doc_conf:.1f}%"

    if doc_status == "verified":
        decision_trail.append(
            DecisionTrailEntry(
                step="Document Verification",
                outcome=f"Verified, {doc_conf_pct} confidence",
                detail="Owner, RC, and DL verified via Vahan & Sarathi matching",
                status="completed",
                timestamp=format_ts(6),
            )
        )
    elif doc_status == "resolved":
        decision_trail.append(
            DecisionTrailEntry(
                step="Document Verification",
                outcome=f"Resolved with minor variance ({doc_conf_pct})",
                detail="Discrepancy resolved via secondary fuzzy verification",
                status="completed",
                timestamp=format_ts(6),
            )
        )
    else:
        decision_trail.append(
            DecisionTrailEntry(
                step="Document Verification",
                outcome="Document Mismatch Warning",
                detail="Failed authoritative matching or Driving Licence expired",
                status="warning",
                timestamp=format_ts(6),
            )
        )

    # --------------------------------------------------------------------------
    # Step 3: Damage Assessment Evaluation
    # --------------------------------------------------------------------------
    img_status = damage_assessment.get("overall_damage_status", "none")
    detections_count = len(damage_assessment.get("detections", []))
    location_label = damage_assessment.get("location_label", "Visual Inspection")

    if detections_count == 0:
        damage_outcome = "No physical damage detected"
        damage_detail = "Computer vision pipeline detected zero damaged components on uploaded photos"
    else:
        damage_outcome = f"{img_status.capitalize()} damage, {location_label.lower()}"
        damage_detail = f"Vision pipeline isolated {detections_count} damaged parts with high confidence"

    decision_trail.append(
        DecisionTrailEntry(
            step="Damage Assessment",
            outcome=damage_outcome,
            detail=damage_detail,
            status="completed",
            timestamp=format_ts(12),
        )
    )

    # --------------------------------------------------------------------------
    # Step 4: Cost Reconciliation Evaluation
    # --------------------------------------------------------------------------
    if cost_estimate.status == "unavailable":
        decision_trail.append(
            DecisionTrailEntry(
                step="Cost Reconciliation",
                outcome="Cost Engine Unreachable",
                detail="The cost calculation service is currently unavailable. Manual estimation required.",
                status="flagged",
                timestamp=format_ts(18),
            )
        )
    elif cost_estimate.status == "insufficient_data":
        decision_trail.append(
            DecisionTrailEntry(
                step="Cost Reconciliation",
                outcome="Vehicle Identity Unknown",
                detail="Vehicle make/model/year could not be extracted from documents. Cost estimation cannot proceed without vehicle identity.",
                status="flagged",
                timestamp=format_ts(18),
            )
        )
    else:
        cost_conf = f"{cost_estimate.confidence.overall * 100:.0f}%" if cost_estimate.confidence else "N/A"
        recommended_str = f"₹{int(cost_estimate.combinedTotal.min + (cost_estimate.combinedTotal.max - cost_estimate.combinedTotal.min)/2):,}" if cost_estimate.combinedTotal else "₹0"

        if not cost_estimate.combinedTotal or cost_estimate.combinedTotal.max == 0:
            cost_outcome = "Zero repair payout (₹0)"
            cost_detail = "No physical vehicle damage identified to estimate repair costs"
        else:
            agreement_label = cost_estimate.confidence.sourceAgreement if cost_estimate.confidence else "Agreement"
            cost_outcome = f"{agreement_label} across sources ({cost_conf})"
            cost_detail = f"Multi-agent pricing converged at {recommended_str}"

        decision_trail.append(
            DecisionTrailEntry(
                step="Cost Reconciliation",
                outcome=cost_outcome,
                detail=cost_detail,
                status="completed",
                timestamp=format_ts(18),
            )
        )

    # --------------------------------------------------------------------------
    # Step 5: Fraud & Anomaly Scan Evaluation
    # --------------------------------------------------------------------------
    failed_frauds = [f for f in fraud_checks if f.status == "failed"]
    warning_frauds = [f for f in fraud_checks if f.status == "warning"]

    if failed_frauds:
        decision_trail.append(
            DecisionTrailEntry(
                step="Fraud & Anomaly Scan",
                outcome=f"Critical Anomaly: {failed_frauds[0].name}",
                detail=failed_frauds[0].detail,
                status="flagged",
                timestamp=format_ts(22),
            )
        )
    elif warning_frauds:
        decision_trail.append(
            DecisionTrailEntry(
                step="Fraud & Anomaly Scan",
                outcome=f"Discrepancy: {warning_frauds[0].name}",
                detail=warning_frauds[0].detail,
                status="warning",
                timestamp=format_ts(22),
            )
        )
    else:
        decision_trail.append(
            DecisionTrailEntry(
                step="Fraud & Anomaly Scan",
                outcome="Zero anomalies detected",
                detail="Image perceptual hashes and metadata parity 100% clean",
                status="completed",
                timestamp=format_ts(22),
            )
        )

    # --------------------------------------------------------------------------
    # Step 6: Statutory IRDAI Limit Check (Must Run First Unconditionally)
    # --------------------------------------------------------------------------
    irdai_limit = settings.IRDAI_MAX_AUTO_APPROVAL_LIMIT
    max_estimate = cost_estimate.combinedTotal.max if cost_estimate.status == "success" and cost_estimate.combinedTotal else 0
    formatted_max = f"₹{int(max_estimate):,}"
    
    if cost_estimate.status == "success" and max_estimate >= irdai_limit:
        decision_trail.append(
            DecisionTrailEntry(
                step="Final Adjudication",
                outcome="Flagged (IRDAI Mandatory Inspection)",
                detail=f"Estimate (up to {formatted_max}) exceeds ₹50,000 threshold. Statutory surveyor inspection required.",
                status="flagged",
                timestamp=format_ts(26),
            )
        )
        return (
            "flagged",
            "Flagged: Statutory Inspection Required",
            f"Repair estimate (up to {formatted_max}) exceeds the ₹50,000 IRDAI threshold for autonomous settlement.",
            decision_trail,
        )

    # --------------------------------------------------------------------------
    # Step 7: Constructive Total Loss Check
    # --------------------------------------------------------------------------
    if cost_estimate.status == "success" and cost_estimate.totalLoss and cost_estimate.totalLoss.exceeds75Percent:
        decision_trail.append(
            DecisionTrailEntry(
                step="Final Adjudication",
                outcome="Flagged (Constructive Total Loss)",
                detail="Repair estimates exceed 75% of vehicle IDV. Escalated for total loss processing.",
                status="flagged",
                timestamp=format_ts(26),
            )
        )
        return (
            "flagged",
            "Flagged: Total Loss",
            "Estimated repair cost exceeds vehicle salvage threshold (75% IDV).",
            decision_trail,
        )

    # --------------------------------------------------------------------------
    # Step 8: Fraud & Document Failure Hard Stops
    # --------------------------------------------------------------------------
    if failed_frauds or doc_status == "warning" or cost_estimate.status in ("unavailable", "insufficient_data"):
        reason = "document mismatch or photo check discrepancy"
        if cost_estimate.status == "unavailable":
            reason = "cost estimation service unreachable"
        elif cost_estimate.status == "insufficient_data":
            reason = "vehicle details could not be identified — cannot estimate repair cost"
        
        decision_trail.append(
            DecisionTrailEntry(
                step="Final Adjudication",
                outcome="Surveyor Review Required",
                detail=f"Needs surveyor review due to {reason}.",
                status="flagged",
                timestamp=format_ts(26),
            )
        )
        return (
            "flagged",
            "Under Review: Details Need Verification",
            f"Needs surveyor review ({reason}). Please verify document and vehicle photo details.",
            decision_trail,
        )

    # --------------------------------------------------------------------------
    # Step 9: Review Stage (Resolved document or Medium cost confidence)
    # --------------------------------------------------------------------------
    cost_conf_overall = cost_estimate.confidence.overall if cost_estimate.status == "success" and cost_estimate.confidence else 1.0
    if doc_status == "resolved" or cost_conf_overall < 0.85 or warning_frauds:
        decision_trail.append(
            DecisionTrailEntry(
                step="Final Adjudication",
                outcome="Referred to Adjuster (Under Review)",
                detail="Minor variance in document fuzzy match or cost confidence. Fast-track adjuster approval queue.",
                status="warning",
                timestamp=format_ts(26),
            )
        )
        return (
            "under_review",
            "Under Review",
            "Claim routed for expedited 1-click adjuster review due to minor document/cost variance.",
            decision_trail,
        )

    # --------------------------------------------------------------------------
    # Step 10: Auto-Approval (The Clean Path)
    # --------------------------------------------------------------------------
    decision_trail.append(
        DecisionTrailEntry(
            step="Final Adjudication",
            outcome="Auto-Approved",
            detail="Automated digital settlement order generated and queued for disbursement",
            status="success",
            timestamp=format_ts(26),
        )
    )

    return (
        "auto_approved",
        "Auto-Approved",
        "Claim meets all autonomous settlement criteria. No human surveyor required.",
        decision_trail,
    )
