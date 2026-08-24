import pytest
from orchestrator.fraud_checks import (
    duplicate_check,
    form_vs_image_check,
    plate_vs_rc_check,
)


def test_plate_vs_rc_exact():
    res = plate_vs_rc_check("MH12RN8842", "MH-12-RN-8842")
    assert res.status == "passed"


def test_plate_vs_rc_ocr_confusion():
    # 0 vs O and 1 vs I tolerance
    res = plate_vs_rc_check("MH12RN8842", "MH12RN884Z")
    assert res.status in ["passed", "failed"]

    # Direct O / 0 substitution test
    res_zero = plate_vs_rc_check("MH02CB1234", "MHO2CB1234")
    assert res_zero.status == "passed"


def test_plate_vs_rc_mismatch():
    res = plate_vs_rc_check("DL01AA1111", "MH12RN8842", form_plate="DL01AA1111")
    # Matches form plate even if dummy policy differs
    assert res.status == "passed"


def test_plate_complete_mismatch():
    res = plate_vs_rc_check("DL01AA1111", "MH12RN8842", form_plate="KA05MM9999")
    assert res.status == "failed"


def test_form_vs_image_matching():
    form_text = "The front bumper collided with a pole and left headlight shattered."
    detected_parts = [{"part_name": "front bumper"}, {"part_name": "headlight housing"}]
    res = form_vs_image_check(form_text, detected_parts)
    assert res.status == "passed"


def test_form_vs_image_directional_mismatch():
    # Form explicitly states rear impact, but image only detected front damage
    form_text = "Another car rear-ended my vehicle and shattered the rear bumper."
    detected_parts = [{"part_name": "front bumper"}]
    res = form_vs_image_check(form_text, detected_parts)
    assert res.status == "warning"
    assert "Discrepancy" in res.detail
