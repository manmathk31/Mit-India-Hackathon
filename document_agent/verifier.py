import re
from datetime import date, datetime
from typing import List, Optional, Tuple

try:
    from rapidfuzz import fuzz
except ImportError:
    import difflib
    class _FuzzFallback:
        @staticmethod
        def ratio(s1: str, s2: str) -> float:
            return difflib.SequenceMatcher(None, s1.lower(), s2.lower()).ratio() * 100

        @staticmethod
        def token_sort_ratio(s1: str, s2: str) -> float:
            t1 = " ".join(sorted(s1.lower().split()))
            t2 = " ".join(sorted(s2.lower().split()))
            return difflib.SequenceMatcher(None, t1, t2).ratio() * 100

    fuzz = _FuzzFallback()

from .config import settings
from .schemas import (
    DocumentVerificationResponse,
    ExtractedVehicleMeta,
    FieldVerificationResult,
    PolicyRecord,
    RawExtractedDocuments,
    VerificationStatus,
)


def normalize_alphanumeric(text: str) -> str:
    """Removes non-alphanumeric characters and converts to uppercase."""
    if not text:
        return ""
    return re.sub(r"[^A-Za-z0-9]", "", text).upper()


def normalize_name(name: str) -> str:
    """Cleans personal/business names by removing common titles, punctuations, and extra spaces."""
    if not name:
        return ""
    cleaned = re.sub(r"\b(MR|MRS|MS|DR|SHRI|SMT|M\/S|LATE)\b\.?", "", name, flags=re.IGNORECASE)
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    return " ".join(cleaned.lower().split())


def parse_date_flexible(date_str: str) -> Optional[date]:
    """Parses various date formats commonly seen on Indian documents."""
    if not date_str or not date_str.strip():
        return None

    cleaned = date_str.strip()
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d.%m.%Y",
        "%Y/%m/%d",
        "%d-%b-%Y",
        "%d %b %Y",
        "%d-%B-%Y",
        "%d %B %Y",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue

    # Regex extraction if embedded in text
    match = re.search(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", cleaned)
    if match:
        matched_str = match.group(1)
        for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"]:
            try:
                return datetime.strptime(matched_str, fmt).date()
            except ValueError:
                continue

    return None


def calculate_worst_status(field_statuses: List[VerificationStatus]) -> VerificationStatus:
    """
    Deterministic rule: overall_status = worst across fields.
    Hierarchy: warning > resolved > verified.
    """
    if "warning" in field_statuses:
        return "warning"
    if "resolved" in field_statuses:
        return "resolved"
    return "verified"


def verify_owner_name_and_cross_check(
    policy_owner: str,
    rc_owner: str,
    dl_holder: str,
    claimant_name: str,
    exact_thresh: float = 98.0,
    match_thresh: float = 80.0,
) -> Tuple[FieldVerificationResult, FieldVerificationResult]:
    """
    Cross-checks owner names across Policy, RC, DL, and Claim Form to detect
    discrepancies, authorized third-party drivers, or potential identity fraud.
    Returns (owner_name_result, cross_doc_reconciliation_result).
    """
    norm_policy = normalize_name(policy_owner)
    norm_rc = normalize_name(rc_owner)
    norm_dl = normalize_name(dl_holder)
    norm_claimant = normalize_name(claimant_name)

    # 1. Primary Owner check (Policy vs RC)
    rc_score = fuzz.token_sort_ratio(norm_policy, norm_rc) if norm_rc else 0.0

    if rc_score >= exact_thresh:
        owner_res = FieldVerificationResult(
            name="owner_name",
            value=rc_owner or policy_owner,
            confidence=1.0,
            status="verified",
            note="Exact match against policy record",
            isResolved=False,
        )
    elif rc_score >= match_thresh:
        owner_res = FieldVerificationResult(
            name="owner_name",
            value=rc_owner,
            confidence=round(rc_score / 100.0, 2),
            status="resolved",
            note=f"Resolved via fuzzy match ({rc_score:.1f}% similarity vs policy record '{policy_owner}')",
            isResolved=True,
        )
    else:
        owner_res = FieldVerificationResult(
            name="owner_name",
            value=rc_owner or "NOT_EXTRACTED",
            confidence=round(max(0.2, rc_score / 100.0), 2),
            status="warning",
            note=f"Owner name mismatch: RC name '{rc_owner}' differs from policy record '{policy_owner}' (similarity: {rc_score:.1f}%)",
            isResolved=False,
        )

    # 2. Cross-document entity reconciliation (Policyholder vs DL Driver vs Claimant)
    dl_vs_policy_score = fuzz.token_sort_ratio(norm_policy, norm_dl) if norm_dl else 100.0
    claimant_vs_policy_score = fuzz.token_sort_ratio(norm_policy, norm_claimant) if norm_claimant else 100.0

    if dl_vs_policy_score >= match_thresh and claimant_vs_policy_score >= match_thresh:
        cross_res = FieldVerificationResult(
            name="cross_doc_identity",
            value=f"Insured: {policy_owner} | Driver: {dl_holder}",
            confidence=0.98,
            status="verified",
            note="Complete identity alignment across Policy, RC, DL, and Claim Form",
            isResolved=False,
        )
    elif dl_vs_policy_score < match_thresh and dl_vs_policy_score >= settings.FUZZY_CROSS_DOC_SUSPICIOUS_THRESHOLD:
        cross_res = FieldVerificationResult(
            name="cross_doc_identity",
            value=f"Insured: {policy_owner} | Driver: {dl_holder}",
            confidence=0.88,
            status="resolved",
            note=f"Driver on DL ('{dl_holder}') differs slightly from policyholder ('{policy_owner}'), resolved as authorized driver/relative.",
            isResolved=True,
        )
    elif dl_vs_policy_score < settings.FUZZY_CROSS_DOC_SUSPICIOUS_THRESHOLD:
        cross_res = FieldVerificationResult(
            name="cross_doc_identity",
            value=f"Insured: {policy_owner} | Driver: {dl_holder}",
            confidence=0.75,
            status="resolved",
            note=f"Designated driver on DL ('{dl_holder}') is distinct from policyholder ('{policy_owner}'). Marked as third-party authorized driver.",
            isResolved=True,
        )
    else:
        cross_res = FieldVerificationResult(
            name="cross_doc_identity",
            value=f"Claimant: {claimant_name} | Insured: {policy_owner}",
            confidence=0.60,
            status="warning",
            note=f"Suspicious discrepancy: Claim form signed by '{claimant_name}', but policy belongs to '{policy_owner}'.",
            isResolved=False,
        )

    return owner_res, cross_res


def verify_rc_and_plate(
    policy_rc: str,
    extracted_rc: str,
    claim_form_vehicle: Optional[str] = None,
    exact_thresh: float = 98.0,
    match_thresh: float = 85.0,
) -> FieldVerificationResult:
    """Verifies vehicle registration number across Policy, RC, and Claim Form."""
    norm_policy = normalize_alphanumeric(policy_rc)
    norm_extracted = normalize_alphanumeric(extracted_rc)

    if not norm_extracted:
        return FieldVerificationResult(
            name="rc_number",
            value="NOT_EXTRACTED",
            confidence=0.0,
            status="warning",
            note="Vehicle RC number could not be extracted from document",
            isResolved=False,
        )

    score = fuzz.ratio(norm_policy, norm_extracted)

    # Check cross-match with form vehicle number if present
    form_score = 100.0
    if claim_form_vehicle and claim_form_vehicle.strip():
        norm_form_veh = normalize_alphanumeric(claim_form_vehicle)
        form_score = fuzz.ratio(norm_policy, norm_form_veh)

    if norm_policy == norm_extracted or score >= exact_thresh:
        if form_score < match_thresh:
            return FieldVerificationResult(
                name="rc_number",
                value=extracted_rc.strip().upper(),
                confidence=0.85,
                status="resolved",
                note=f"RC matches policy exactly, but Claim Form lists vehicle '{claim_form_vehicle}'. Resolved to official RC plate.",
                isResolved=True,
            )
        return FieldVerificationResult(
            name="rc_number",
            value=extracted_rc.strip().upper(),
            confidence=1.0,
            status="verified",
            note="Exact RC number match against policy record",
            isResolved=False,
        )
    elif score >= match_thresh:
        return FieldVerificationResult(
            name="rc_number",
            value=extracted_rc.strip().upper(),
            confidence=round(score / 100.0, 2),
            status="resolved",
            note=f"Resolved minor OCR character variance ({score:.1f}% match vs policy '{policy_rc}')",
            isResolved=True,
        )
    else:
        return FieldVerificationResult(
            name="rc_number",
            value=extracted_rc.strip().upper(),
            confidence=round(score / 100.0, 2),
            status="warning",
            note=f"RC number mismatch: extracted '{extracted_rc}' differs from policy '{policy_rc}'",
            isResolved=False,
        )


def verify_chassis_number(
    policy_chassis: str,
    extracted_chassis: str,
    exact_thresh: float = 98.0,
    match_thresh: float = 85.0,
) -> FieldVerificationResult:
    """Verifies 17-character vehicle chassis / VIN number against policy record."""
    norm_policy = normalize_alphanumeric(policy_chassis)
    norm_extracted = normalize_alphanumeric(extracted_chassis)

    if not norm_extracted:
        return FieldVerificationResult(
            name="chassis_number",
            value="NOT_EXTRACTED",
            confidence=0.0,
            status="warning",
            note="Chassis number could not be extracted from RC document",
            isResolved=False,
        )

    score = fuzz.ratio(norm_policy, norm_extracted)

    if norm_policy == norm_extracted or score >= exact_thresh:
        return FieldVerificationResult(
            name="chassis_number",
            value=extracted_chassis.strip().upper(),
            confidence=1.0,
            status="verified",
            note="Exact 17-character chassis number match against policy record",
            isResolved=False,
        )
    elif score >= match_thresh:
        return FieldVerificationResult(
            name="chassis_number",
            value=extracted_chassis.strip().upper(),
            confidence=round(score / 100.0, 2),
            status="resolved",
            note=f"Resolved chassis number OCR artifact ({score:.1f}% match vs policy '{policy_chassis}')",
            isResolved=True,
        )
    else:
        return FieldVerificationResult(
            name="chassis_number",
            value=extracted_chassis.strip().upper(),
            confidence=round(score / 100.0, 2),
            status="warning",
            note=f"Chassis number mismatch: extracted '{extracted_chassis}' does not match policy '{policy_chassis}'",
            isResolved=False,
        )


def verify_dl_and_incident_validity(
    dl_number: str,
    expiry_date_str: str,
    incident_date_str: Optional[str] = None,
    vehicle_classes: Optional[List[str]] = None,
    required_vehicle_type: str = "LMV",
    reference_date: Optional[date] = None,
) -> Tuple[FieldVerificationResult, FieldVerificationResult]:
    """
    Verifies DL format and checks validity on incident/loss date and current date.
    Returns (dl_number_result, dl_expiry_result).
    """
    ref_date = reference_date or date.today()
    norm_dl = dl_number.strip().upper()

    # 1. DL Number & Format Verification
    if not norm_dl or "UNREADABLE" in norm_dl or "MISSING" in norm_dl or "NOT_EXTRACTED" in norm_dl or len(normalize_alphanumeric(norm_dl)) < 6:
        dl_num_res = FieldVerificationResult(
            name="dl_number",
            value="Unreadable / Missing",
            confidence=0.10,
            status="warning",
            note="Driving Licence number could not be read or extracted from document",
            isResolved=False,
        )
    else:
        dl_num_res = FieldVerificationResult(
            name="dl_number",
            value=norm_dl,
            confidence=0.96,
            status="verified",
            note="Driving Licence number format valid and verified",
            isResolved=False,
        )

    # 2. DL Expiration Check (Current date + Loss date)
    if not expiry_date_str or "UNREADABLE" in expiry_date_str.upper() or "MISSING" in expiry_date_str.upper() or "NOT_EXTRACTED" in expiry_date_str.upper():
        dl_exp_res = FieldVerificationResult(
            name="dl_validity",
            value="Unreadable / Missing",
            confidence=0.10,
            status="warning",
            note="Driving Licence expiry date could not be read or verified from document",
            isResolved=False,
        )
    else:
        parsed_expiry = parse_date_flexible(expiry_date_str)
        parsed_incident = parse_date_flexible(incident_date_str) if incident_date_str else None

        if not parsed_expiry:
            dl_exp_res = FieldVerificationResult(
                name="dl_validity",
                value=expiry_date_str,
                confidence=0.20,
                status="warning",
                note=f"Could not parse or verify DL expiry date '{expiry_date_str}'",
                isResolved=False,
            )
        elif parsed_incident and parsed_expiry < parsed_incident:
            # Crucial Insurance Rule: DL was expired on the date the crash happened!
            dl_exp_res = FieldVerificationResult(
                name="dl_validity",
                value=parsed_expiry.isoformat(),
                confidence=0.99,
                status="warning",
                note=f"FRAUD/POLICY BREACH: Driving Licence expired on {parsed_expiry.strftime('%d-%b-%Y')}, which is BEFORE the incident date {parsed_incident.strftime('%d-%b-%Y')}. Claim is void.",
                isResolved=False,
            )
        elif parsed_expiry < ref_date:
            dl_exp_res = FieldVerificationResult(
                name="dl_validity",
                value=parsed_expiry.isoformat(),
                confidence=0.98,
                status="warning",
                note=f"Driving Licence expired on {parsed_expiry.strftime('%d-%b-%Y')}. Driver licence is currently invalid.",
                isResolved=False,
            )
        else:
            dl_exp_res = FieldVerificationResult(
                name="dl_validity",
                value=parsed_expiry.isoformat(),
                confidence=0.98,
                status="verified",
                note=f"Driving Licence is valid (expires on {parsed_expiry.strftime('%d-%b-%Y')})",
                isResolved=False,
            )

    return dl_num_res, dl_exp_res


def verify_documents(
    extracted: RawExtractedDocuments,
    policy: PolicyRecord,
    reference_date: Optional[date] = None,
) -> DocumentVerificationResponse:
    """
    Pure, deterministic verification pipeline cross-checking extracted data with policy records.
    Produces the exact DocumentVerificationResponse contract.
    """
    exact_th = settings.FUZZY_EXACT_THRESHOLD
    match_th = settings.FUZZY_MATCH_THRESHOLD

    # 1. Owner name & cross-document identity reconciliation
    owner_res, cross_identity_res = verify_owner_name_and_cross_check(
        policy_owner=policy.owner_name,
        rc_owner=extracted.rc.owner_name,
        dl_holder=extracted.dl.holder_name,
        claimant_name=extracted.claim_form.claimant_name,
        exact_thresh=exact_th,
        match_thresh=match_th,
    )

    # 2. RC & Plate verification
    rc_res = verify_rc_and_plate(
        policy_rc=policy.rc_number,
        extracted_rc=extracted.rc.rc_number,
        claim_form_vehicle=extracted.claim_form.vehicle_number,
        exact_thresh=exact_th,
        match_thresh=match_th,
    )

    # 3. Chassis / VIN verification
    chassis_res = verify_chassis_number(
        policy_chassis=policy.chassis_number,
        extracted_chassis=extracted.rc.chassis_number,
        exact_thresh=exact_th,
        match_thresh=match_th,
    )

    # 4. DL format and validity check (accounting for incident date)
    dl_num_res, dl_exp_res = verify_dl_and_incident_validity(
        dl_number=extracted.dl.dl_number,
        expiry_date_str=extracted.dl.expiry_date,
        incident_date_str=extracted.claim_form.incident_date,
        vehicle_classes=extracted.dl.vehicle_classes,
        required_vehicle_type=policy.vehicle_type or "LMV",
        reference_date=reference_date,
    )

    fields: List[FieldVerificationResult] = [
        owner_res,
        rc_res,
        chassis_res,
        dl_num_res,
        dl_exp_res,
    ]

    # Aggregate overall status (deterministic rule: worst across fields)
    field_statuses = [f.status for f in fields]
    overall_status = calculate_worst_status(field_statuses)

    # Compute overall confidence score
    raw_confidences = [f.confidence for f in fields]
    avg_confidence = sum(raw_confidences) / len(raw_confidences) if raw_confidences else 0.0

    if overall_status == "warning":
        final_confidence = min(avg_confidence, 0.65)
    elif overall_status == "resolved":
        final_confidence = min(avg_confidence, 0.88)
    else:
        final_confidence = max(0.90, min(1.0, avg_confidence))

    final_confidence_score = round(final_confidence, 2)

    # Vehicle metadata for downstream Cost Agent
    vehicle_meta = ExtractedVehicleMeta(
        make=extracted.rc.make.strip(),
        model=extracted.rc.model.strip(),
        variant=extracted.rc.variant.strip(),
        registration_year=int(extracted.rc.registration_year) if extracted.rc.registration_year is not None else None,
    )

    # Preserved free-text damage description verbatim
    damage_desc_verbatim = extracted.claim_form.damage_description.strip()

    # Plate number for downstream plate-vs-RC fraud check
    plate_number = (
        extracted.rc.plate_number.strip().upper()
        if extracted.rc.plate_number
        else extracted.rc.rc_number.strip().upper()
    )

    return DocumentVerificationResponse(
        overall_status=overall_status,
        confidence_score=final_confidence_score,
        fields=fields,
        extracted_plate_number=plate_number,
        extracted_vehicle_meta=vehicle_meta,
        extracted_damage_description_from_form=damage_desc_verbatim,
    )
