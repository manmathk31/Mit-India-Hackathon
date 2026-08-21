import pytest
from image_agent.extractor import calculate_overall_status
from image_agent.material_lookup import lookup_material_type


def test_material_lookup_plastic_rubber():
    assert lookup_material_type("front bumper") == "plastic-rubber"
    assert lookup_material_type("Rear Bumper Fascia") == "plastic-rubber"
    assert lookup_material_type("radiator grille") == "plastic-rubber"
    assert lookup_material_type("headlight housing") == "plastic-rubber"
    assert lookup_material_type("side mirror casing") == "plastic-rubber"
    assert lookup_material_type("fog lamp") == "plastic-rubber"
    assert lookup_material_type("wheel arch cladding") == "plastic-rubber"


def test_material_lookup_metal():
    assert lookup_material_type("bonnet") == "metal"
    assert lookup_material_type("hood") == "metal"
    assert lookup_material_type("front left fender") == "metal"
    assert lookup_material_type("rear right door") == "metal"
    assert lookup_material_type("boot lid") == "metal"
    assert lookup_material_type("trunk") == "metal"
    assert lookup_material_type("roof panel") == "metal"
    assert lookup_material_type("a-pillar") == "metal"


def test_material_lookup_glass():
    assert lookup_material_type("front windshield") == "glass"
    assert lookup_material_type("rear glass") == "glass"
    assert lookup_material_type("door window") == "glass"
    assert lookup_material_type("sunroof glass") == "glass"
    assert lookup_material_type("quarter glass") == "glass"


def test_material_lookup_fibreglass():
    assert lookup_material_type("rear spoiler") == "fibreglass"
    assert lookup_material_type("body kit") == "fibreglass"
    assert lookup_material_type("side skirt") == "fibreglass"


def test_material_lookup_unknown():
    assert lookup_material_type("") == "unknown"
    assert lookup_material_type("some_unrecognized_custom_part") == "unknown"


def test_calculate_overall_status():
    assert calculate_overall_status(["minor", "minor"]) == "minor"
    assert calculate_overall_status(["minor", "moderate"]) == "moderate"
    assert calculate_overall_status(["minor", "moderate", "severe"]) == "severe"
    assert calculate_overall_status([]) == "none"
