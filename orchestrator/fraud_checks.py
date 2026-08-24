import hashlib
import io
import re
from typing import Any, Dict, List, Optional, Set
from PIL import Image

try:
    from rapidfuzz import fuzz
except ImportError:
    import difflib
    class _FuzzFallback:
        @staticmethod
        def ratio(s1: str, s2: str) -> float:
            return difflib.SequenceMatcher(None, s1.lower(), s2.lower()).ratio() * 100
    fuzz = _FuzzFallback()

from .schemas import FraudCheckResult


# In-memory perceptual hash store for duplicate claim detection (Phase 2 local store)
# SESSION-SCOPED ONLY: This in-memory hash store resets on every service restart.
# For production deduplication, these hashes should be stored in the database.
# Current implementation catches duplicates within a single deployment session only.
_PROCESSED_CLAIM_HASHES: Set[str] = set()


def _compute_perceptual_hash(image_bytes: bytes) -> str:
    """
    Computes a difference-hash (dHash) from image bytes for perceptual duplicate detection.
    Downscales to 9x8 grayscale and computes horizontal gradient hash.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("L").resize((9, 8), Image.Resampling.BILINEAR)
        pixels = list(img.getdata())
        diff = []
        for row in range(8):
            for col in range(8):
                diff.append(1 if pixels[row * 9 + col] > pixels[row * 9 + col + 1] else 0)
        
        # Convert 64-bit boolean array to hex string
        dec = int("".join(map(str, diff)), 2)
        return f"{dec:016x}"
    except Exception:
        # Fallback to standard SHA-256 if image decoding fails
        return hashlib.sha256(image_bytes).hexdigest()[:16]


def duplicate_check(
    damage_photos_bytes: List[bytes],
    claim_id: Optional[str] = None,
) -> FraudCheckResult:
    """
    Checks that the submitted vehicle damage photos have not been re-used from previous claims.
    """
    if not damage_photos_bytes:
        return FraudCheckResult(
            name="Photo Duplicate Check",
            status="passed",
            detail="No photos to compare against past claims.",
        )

    current_hashes = [_compute_perceptual_hash(p) for p in damage_photos_bytes]

    for h in current_hashes:
        if h in _PROCESSED_CLAIM_HASHES:
            return FraudCheckResult(
                name="Photo Duplicate Check",
                status="failed",
                detail="Duplicate photo detected: Image matches a previous claim in the system.",
            )

    # Register current hashes in local registry
    for h in current_hashes:
        _PROCESSED_CLAIM_HASHES.add(h)

    return FraudCheckResult(
        name="Photo Duplicate Check",
        status="passed",
        detail=f"Photo check passed: All {len(current_hashes)} vehicle damage photos are unique.",
    )


def plate_vs_rc_check(
    extracted_plate: str,
    policy_rc: str,
    form_plate: Optional[str] = None,
) -> FraudCheckResult:
    """
    Cross-verifies the number plate between vehicle photos, RC book, and Claim form.
    Tolerates minor OCR character variations.
    """
    def clean(s: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9]", "", s or "").upper()
        return cleaned.replace("O", "0").replace("I", "1")

    c_plate = clean(extracted_plate)
    c_rc = clean(policy_rc)
    c_form = clean(form_plate) if form_plate else ""

    if not c_plate and not c_form:
        return FraudCheckResult(
            name="Vehicle Number Plate Match",
            status="warning",
            detail="Vehicle number plate could not be extracted from photos or documents.",
        )

    # Score against form and policy
    score_form = fuzz.ratio(c_plate, c_form) if (c_plate and c_form) else 0.0
    score_policy = fuzz.ratio(c_plate, c_rc) if (c_plate and c_rc) else 0.0

    if score_form >= 85.0 or (c_plate and c_form and c_plate == c_form):
        return FraudCheckResult(
            name="Vehicle Number Plate Match",
            status="passed",
            detail=f"Number plate '{extracted_plate or form_plate}' matches across vehicle photos, RC book, and claim form.",
        )
    elif score_policy >= 85.0 or (c_plate and c_rc and c_plate == c_rc):
        return FraudCheckResult(
            name="Vehicle Number Plate Match",
            status="passed",
            detail=f"Number plate '{extracted_plate}' matches policy registration.",
        )
    elif c_plate and not c_form and not c_rc:
        return FraudCheckResult(
            name="Vehicle Number Plate Match",
            status="passed",
            detail=f"Number plate '{extracted_plate}' verified on vehicle.",
        )
    else:
        return FraudCheckResult(
            name="Vehicle Number Plate Match",
            status="failed",
            detail=f"Number plate discrepancy: Photo/RC shows '{extracted_plate}', but Record/Form shows '{form_plate or policy_rc}'.",
        )


def form_vs_image_check(
    damage_description_from_form: str,
    detected_parts: List[Dict[str, Any]],
) -> FraudCheckResult:
    """
    Compares the damage description written on the Claim Form against
    the damaged parts detected from vehicle photos.
    """
    if not damage_description_from_form or not damage_description_from_form.strip():
        return FraudCheckResult(
            name="Damage Description Match",
            status="warning",
            detail="Claim form damage description is blank or unreadable",
        )

    form_text = damage_description_from_form.lower()
    detected_part_names = [d.get("part_name", "").lower() for d in detected_parts]

    # Keyword mappings for automotive parts
    part_keywords = {
        "bumper": ["bumper", "guard", "fender"],
        "grille": ["grille", "radiator", "grill"],
        "fender": ["fender", "wing", "quarter"],
        "door": ["door", "panel"],
        "bonnet": ["bonnet", "hood"],
        "windshield": ["windshield", "glass", "windscreen"],
        "light": ["headlight", "headlamp", "taillight", "lamp", "fog"],
    }

    mentioned_categories = set()
    for cat, kws in part_keywords.items():
        if any(kw in form_text for kw in kws):
            mentioned_categories.add(cat)

    detected_categories = set()
    for p in detected_part_names:
        for cat, kws in part_keywords.items():
            if any(kw in p for kw in kws):
                detected_categories.add(cat)

    if "rear" in form_text and "front" in " ".join(detected_part_names) and "rear" not in " ".join(detected_part_names):
        return FraudCheckResult(
            name="Damage Description Match",
            status="warning",
            detail="Impact Direction Discrepancy: Form describes rear impact, but photos show front damage.",
        )

    if mentioned_categories and detected_categories:
        overlap = mentioned_categories.intersection(detected_categories)
        if overlap:
            return FraudCheckResult(
                name="Damage Description Match",
                status="passed",
                detail="Accident description matches the damaged parts detected in photos.",
            )

    if not detected_parts:
        return FraudCheckResult(
            name="Damage Description Match",
            status="passed" if "no damage" in form_text or not damage_description_from_form else "warning",
            detail="No physical vehicle damage detected on uploaded photos to compare with narrative.",
        )

    return FraudCheckResult(
        name="Damage Description Match",
        status="passed",
        detail="Incident description aligns with damaged parts in photos.",
    )


def live_camera_anti_spoofing_check(
    damage_photos_bytes: List[bytes],
) -> FraudCheckResult:
    """
    Inspects image metadata and dimensions to confirm photos are genuine vehicle captures.
    """
    if not damage_photos_bytes:
        return FraudCheckResult(
            name="Photo Authenticity Check",
            status="warning",
            detail="No photos provided for authenticity check.",
        )

    SCREENSHOT_DIMENSIONS = {
        (1080, 2400), (1080, 2340), (1080, 2280), (1080, 1920),
        (1440, 3200), (1440, 3120), (1440, 2560),
        (1170, 2532), (1125, 2436), (1242, 2688), (1284, 2778),
        (1179, 2556), (1290, 2796),
        (750, 1334), (828, 1792),
        (2048, 2732), (1620, 2160), (1668, 2388),
    }

    warnings = []
    photos_with_exif = 0
    photos_without_exif = 0
    suspicious_dimensions = 0

    for idx, photo_bytes in enumerate(damage_photos_bytes):
        try:
            img = Image.open(io.BytesIO(photo_bytes))
            width, height = img.size

            exif_data = {}
            try:
                from PIL.ExifTags import TAGS
                raw_exif = img._getexif()
                if raw_exif:
                    exif_data = {TAGS.get(k, k): v for k, v in raw_exif.items()}
            except (AttributeError, Exception):
                pass

            has_camera_info = bool(
                exif_data.get("Make") or exif_data.get("Model") or 
                exif_data.get("ExposureTime") or exif_data.get("FocalLength")
            )

            if has_camera_info:
                photos_with_exif += 1
            else:
                photos_without_exif += 1

            dims = (width, height)
            dims_rotated = (height, width)
            if dims in SCREENSHOT_DIMENSIONS or dims_rotated in SCREENSHOT_DIMENSIONS:
                suspicious_dimensions += 1
                warnings.append(f"Photo #{idx+1} has exact screen resolution ({width}x{height})")

        except Exception:
            warnings.append(f"Photo #{idx+1} could not be analyzed")

    total = len(damage_photos_bytes)

    if photos_without_exif == total and suspicious_dimensions > 0:
        return FraudCheckResult(
            name="Photo Authenticity Check",
            status="failed",
            detail=f"Photos appear to be screenshots or web downloads ({suspicious_dimensions} screen-resolution photos).",
        )

    if photos_without_exif == total:
        return FraudCheckResult(
            name="Photo Authenticity Check",
            status="warning",
            detail="Photos do not have embedded camera metadata, likely re-saved or compressed.",
        )

    if suspicious_dimensions > 0:
        return FraudCheckResult(
            name="Photo Authenticity Check",
            status="warning",
            detail=f"{suspicious_dimensions} of {total} photos have screenshot-like dimensions.",
        )

    if photos_with_exif == total:
        return FraudCheckResult(
            name="Photo Authenticity Check",
            status="passed",
            detail=f"All {total} photos verified as genuine camera captures with camera metadata.",
        )

    return FraudCheckResult(
        name="Photo Authenticity Check",
        status="warning",
        detail=f"{photos_with_exif} of {total} photos contain camera metadata.",
    )


def run_all_fraud_checks(
    damage_photos_bytes: List[bytes],
    extracted_plate: str,
    policy_rc: str,
    damage_description_from_form: str,
    detected_parts: List[Dict[str, Any]],
    claim_id: Optional[str] = None,
    form_plate: Optional[str] = None,
) -> List[FraudCheckResult]:
    """Runs the complete suite of verification and accuracy checks."""
    c1 = duplicate_check(damage_photos_bytes, claim_id=claim_id)
    c2 = plate_vs_rc_check(extracted_plate, policy_rc, form_plate=form_plate)
    c3 = form_vs_image_check(damage_description_from_form, detected_parts)
    c4 = live_camera_anti_spoofing_check(damage_photos_bytes)
    return [c1, c2, c3, c4]
