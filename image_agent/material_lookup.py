import re
from typing import Literal

MaterialType = Literal["metal", "plastic-rubber", "glass", "fibreglass", "unknown"]

# Canonical Part to Material Type dictionary for standard Indian motor claims
PART_MATERIAL_MAP = {
    # Plastic / Rubber components (50% flat depreciation in standard Indian motor policies)
    "bumper": "plastic-rubber",
    "front bumper": "plastic-rubber",
    "rear bumper": "plastic-rubber",
    "bumper fascia": "plastic-rubber",
    "grille": "plastic-rubber",
    "radiator grille": "plastic-rubber",
    "lower grille": "plastic-rubber",
    "headlight housing": "plastic-rubber",
    "headlamp": "plastic-rubber",
    "tail light": "plastic-rubber",
    "taillamp": "plastic-rubber",
    "fog light": "plastic-rubber",
    "fog lamp": "plastic-rubber",
    "side mirror": "plastic-rubber",
    "mirror casing": "plastic-rubber",
    "orvm": "plastic-rubber",
    "cladding": "plastic-rubber",
    "wheel arch": "plastic-rubber",
    "mudguard": "plastic-rubber",
    "mud flap": "plastic-rubber",
    "underbody shield": "plastic-rubber",
    "number plate frame": "plastic-rubber",
    "wiper blade": "plastic-rubber",

    # Metal sheet & structural components (Age-based slab depreciation)
    "bonnet": "metal",
    "hood": "metal",
    "fender": "metal",
    "front fender": "metal",
    "rear fender": "metal",
    "quarter panel": "metal",
    "door": "metal",
    "front left door": "metal",
    "front right door": "metal",
    "rear left door": "metal",
    "rear right door": "metal",
    "boot": "metal",
    "boot lid": "metal",
    "trunk": "metal",
    "trunk lid": "metal",
    "tailgate": "metal",
    "roof": "metal",
    "pillar": "metal",
    "a-pillar": "metal",
    "b-pillar": "metal",
    "c-pillar": "metal",
    "rocker panel": "metal",
    "running board": "metal",
    "sill": "metal",
    "chassis": "metal",
    "crossmember": "metal",

    # Glass components (0% depreciation under standard IRDAI rules)
    "windshield": "glass",
    "front windshield": "glass",
    "rear windshield": "glass",
    "rear glass": "glass",
    "window": "glass",
    "door window": "glass",
    "quarter glass": "glass",
    "sunroof": "glass",
    "moonroof": "glass",
    "mirror glass": "glass",

    # Fibreglass components (30% flat depreciation)
    "spoiler": "fibreglass",
    "rear spoiler": "fibreglass",
    "body kit": "fibreglass",
    "side skirt": "fibreglass",
    "diffuser": "fibreglass",
    "canard": "fibreglass",
}


def lookup_material_type(part_name: str) -> MaterialType:
    """
    Deterministically maps vehicle part names to insurance material classifications.
    Crucial for downstream Cost Agent depreciation calculation:
      - plastic-rubber: 50% flat
      - fibreglass: 30% flat
      - glass: 0% flat
      - metal: age-dependent scale
    """
    if not part_name or not part_name.strip():
        return "unknown"

    cleaned = part_name.strip().lower()
    cleaned = re.sub(r"[^\w\s-]", "", cleaned)

    # 1. Exact match in lookup table
    if cleaned in PART_MATERIAL_MAP:
        return PART_MATERIAL_MAP[cleaned]

    # 2. Substring / Keyword heuristics
    if any(k in cleaned for k in ["glass", "windshield", "window", "sunroof"]):
        return "glass"
    if any(k in cleaned for k in ["spoiler", "fibreglass", "fiberglass", "diffuser", "skirt"]):
        return "fibreglass"
    if any(k in cleaned for k in ["bumper", "grille", "mirror", "lamp", "light", "cladding", "plastic", "rubber", "housing"]):
        return "plastic-rubber"
    if any(k in cleaned for k in ["door", "bonnet", "hood", "fender", "roof", "boot", "trunk", "panel", "pillar", "metal", "sill", "rocker"]):
        return "metal"

    return "unknown"
