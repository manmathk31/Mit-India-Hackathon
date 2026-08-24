from datetime import date
import pytest

from document_agent.schemas import (
    ExtractedClaimFormDocument,
    ExtractedDLDocument,
    ExtractedRCDocument,
    PolicyRecord,
    RawExtractedDocuments,
)
from document_agent.verifier import (
    calculate_worst_status,
    normalize_alphanumeric,
    normalize_name,
    parse_date_flexible,
    verify_chassis_number,
    verify_dl_and_incident_validity,
    verify_documents,
    verify_owner_name_and_cross_check,
    verify_rc_and_plate,
)


def test_normalize_name():
    assert normalize_name("MR. RAJESH KUMAR SHARMA") == "rajesh kumar sharma"
    assert normalize_name("Dr. Priya Verma") == "priya verma"
    assert normalize_name("  SMT.   ANITA   GUPTA  ") == "anita gupta"
    assert normalize_name("M/S ABC Logistics Ltd.") == "abc logistics ltd"


def test_normalize_alphanumeric():
    assert normalize_alphanumeric("MH-02-CB-1234") == "MH02CB1234"
    assert normalize_alphanumeric("MA3E JKD1 S00 123456") == "MA3EJKD1S00123456"


def test_parse_date_flexible():
    assert parse_date_flexible("2029-08-15") == date(2029, 8, 15)
    assert parse_date_flexible("15/08/2029") == date(2029, 8, 15)
    assert parse_date_flexible("15-Aug-2029") == date(2029, 8, 15)
    assert parse_date_flexible("invalid-date") is None


def test_owner_name_and_cross_check_exact():
    owner_res, cross_res = verify_owner_name_and_cross_check(
        policy_owner="Rajesh Kumar Sharma",
        rc_owner="Mr. Rajesh Kumar Sharma",
        dl_holder="Rajesh Kumar Sharma",
        claimant_name="Rajesh Kumar Sharma",
    )
    assert owner_res.status == "verified"
    assert cross_res.status == "verified"
    assert owner_res.confidence >= 0.95


def test_owner_name_fuzzy_resolved():
    owner_res, cross_res = verify_owner_name_and_cross_check(
        policy_owner="Rajesh Kumar Sharma",
        rc_owner="Rajesh K Sharma",
        dl_holder="Rajesh Kumar Sharma",
        claimant_name="Rajesh Kumar Sharma",
    )
    assert owner_res.status == "resolved"
    assert owner_res.isResolved is True
    assert "fuzzy match" in owner_res.note.lower()


def test_owner_name_fraud_mismatch():
    owner_res, cross_res = verify_owner_name_and_cross_check(
        policy_owner="Rajesh Kumar Sharma",
        rc_owner="Sunil Verma",
        dl_holder="Vikram Singh",
        claimant_name="Sunil Verma",
    )
    assert owner_res.status == "warning"
    assert "mismatch" in owner_res.note.lower()


def test_driver_different_from_owner_resolved():
    owner_res, cross_res = verify_owner_name_and_cross_check(
        policy_owner="Rajesh Kumar Sharma",
        rc_owner="Rajesh Kumar Sharma",
        dl_holder="Amit Kumar (Driver)",
        claimant_name="Rajesh Kumar Sharma",
    )
    assert owner_res.status == "verified"
    assert cross_res.status == "resolved"  # Flagged as distinct authorized driver
    assert "driver" in cross_res.note.lower()


def test_owner_name_across_rc_dl_form_independent_of_username():
    # User logged in as 'manmath', but RC, DL, and Claim form are all for 'RAHUL SINGH'
    owner_res, cross_res = verify_owner_name_and_cross_check(
        policy_owner="manmath",
        rc_owner="RAHUL SINGH",
        dl_holder="RAHUL SINGH",
        claimant_name="RAHUL SINGH",
    )
    assert owner_res.status == "verified"
    assert cross_res.status == "verified"
    assert owner_res.confidence >= 0.95
    assert "RAHUL SINGH" in owner_res.value
    assert "verified" in owner_res.note.lower() or "exact" in owner_res.note.lower()


def test_rc_number_verification():
    # Exact match across RC and Form
    res_exact = verify_rc_and_plate("MH02CB1234", "MH-02-CB-1234", "MH02CB1234")
    assert res_exact.status == "verified"

    # RC matches Form even if dummy policy was passed
    res_rc_form = verify_rc_and_plate("MH12RN8842", "MH12 CD 4567", "MH12 CD 4567")
    assert res_rc_form.status == "verified"

    # Minor typo (resolved)
    res_typo = verify_rc_and_plate("MH02CB1234", "MH02CB123A", "MH02CB1234")
    assert res_typo.status == "resolved"

    # Complete mismatch across RC and Form
    res_diff = verify_rc_and_plate("MH02CB1234", "DL01AA9999", "KA05MM8888")
    assert res_diff.status == "warning"


def test_dl_validity_on_incident_date():
    # DL expired BEFORE accident -> Policy breach / Fraud Warning
    num_res, exp_res = verify_dl_and_incident_validity(
        dl_number="DL-1420110012345",
        expiry_date_str="2023-01-01",
        incident_date_str="2024-05-10",
        reference_date=date(2026, 8, 21),
    )
    assert exp_res.status == "warning"
    assert "before the incident date" in exp_res.note.lower()


def test_dl_validity_active():
    num_res, exp_res = verify_dl_and_incident_validity(
        dl_number="DL-1420110012345",
        expiry_date_str="2029-08-15",
        incident_date_str="2024-05-10",
        reference_date=date(2026, 8, 21),
    )
    assert num_res.status == "verified"
    assert exp_res.status == "verified"
    assert "valid" in exp_res.note.lower()


def test_full_pipeline_verification():
    policy = PolicyRecord(
        owner_name="Rajesh Kumar Sharma",
        rc_number="MH02CB1234",
        chassis_number="MA3EJKD1S00123456",
        claim_id="CLM-98765",
    )

    raw_docs = RawExtractedDocuments(
        rc=ExtractedRCDocument(
            owner_name="Rajesh Kumar Sharma",
            rc_number="MH02CB1234",
            chassis_number="MA3EJKD1S00123456",
            make="Maruti Suzuki",
            model="Swift Dzire",
            variant="VXI",
            registration_year=2021,
            plate_number="MH02CB1234",
            confidence=0.96,
        ),
        dl=ExtractedDLDocument(
            dl_number="DL-1420110012345",
            holder_name="Rajesh Kumar Sharma",
            expiry_date="2029-08-15",
            confidence=0.95,
        ),
        claim_form=ExtractedClaimFormDocument(
            claimant_name="Rajesh Kumar Sharma",
            vehicle_number="MH02CB1234",
            damage_description="Front bumper cracked after hitting bollard.",
            confidence=0.94,
        ),
    )

    response = verify_documents(raw_docs, policy, reference_date=date(2026, 8, 21))

    assert response.overall_status == "verified"
    assert response.confidence_score >= 0.90
    assert response.extracted_plate_number == "MH02CB1234"
    assert response.extracted_vehicle_meta.make == "Maruti Suzuki"
    assert response.extracted_vehicle_meta.registration_year == 2021
    assert response.extracted_damage_description_from_form == "Front bumper cracked after hitting bollard."


def test_worst_status_hierarchy():
    assert calculate_worst_status(["verified", "verified"]) == "verified"
    assert calculate_worst_status(["verified", "resolved"]) == "resolved"
    assert calculate_worst_status(["verified", "resolved", "warning"]) == "warning"
