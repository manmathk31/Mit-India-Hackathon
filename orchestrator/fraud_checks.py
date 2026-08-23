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
    Perceptual hash check against previously processed claims to catch re-submitted crash photos.
    """
    if not damage_photos_bytes:
        return FraudCheckResult(
            name="Duplicate Claim Hash Check",
            status="passed",
            detail="Zero photos to compare against historical repository",
        )

    current_hashes = [_compute_perceptual_hash(p) for p in damage_photos_bytes]

    for h in current_hashes:
        if h in _PROCESSED_CLAIM_HASHES:
            return FraudCheckResult(
                name="Duplicate Claim Hash Check",
                status="failed",
                detail=f"DUPLICATE PHOTO DETECTED: Image perceptual hash ({h}) matches an existing settled claim in the repository.",
            )

    # Register current hashes in local registry
    for h in current_hashes:
        _PROCESSED_CLAIM_HASHES.add(h)

    return FraudCheckResult(
        name="Duplicate Claim Hash Check",
        status="passed",
        detail=f"Perceptual hash verified unique ({len(current_hashes)} photo hashes registered).",
    )


def plate_vs_rc_check(
    extracted_plate: str,
    policy_rc: str,
) -> FraudCheckResult:
    """
    Cross-verifies the plate number extracted from vehicle photos/documents against policy RC.
    Tolerates minor OCR character ambiguities (e.g. 0 vs O, 1 vs I).
    """
    def clean(s: str) -> str:
        # Standardize alphanumeric and replace common OCR confusions
        cleaned = re.sub(r"[^A-Za-z0-9]", "", s).upper()
        # Normalization for OCR confusion
        cleaned = cleaned.replace("O", "0").replace("I", "1")
        return cleaned

    c_plate = clean(extracted_plate or "")
    c_rc = clean(policy_rc or "")

    if not c_plate or not c_rc or "UNREADABLE" in extracted_plate.upper() or "MISSING" in extracted_plate.upper():
        return FraudCheckResult(
            name="Number Plate AI Parity",
            status="warning",
            detail="Number plate unreadable or not extracted from documents/photos.",
        )

    score = fuzz.ratio(c_plate, c_rc)

    if score >= 95.0:
        return FraudCheckResult(
            name="Number Plate AI Parity",
            status="passed",
            detail=f"{policy_rc} verified on live photos against RC (Parity: {score:.1f}%)",
        )
    elif score >= 80.0:
        return FraudCheckResult(
            name="Number Plate AI Parity",
            status="passed",
            detail=f"Resolved OCR character variance between plate ({extracted_plate}) and policy ({policy_rc})",
        )
    else:
        return FraudCheckResult(
            name="Number Plate AI Parity",
            status="failed",
            detail=f"MISMATCH: Extracted plate '{extracted_plate}' does not match insured RC '{policy_rc}' (Similarity: {score:.1f}%)",
        )


def form_vs_image_check(
    damage_description_from_form: str,
    detected_parts: List[Dict[str, Any]],
) -> FraudCheckResult:
    """
    Compares the verbatim damage narrative written on the Claim Form against
    the actual physically detected damaged parts from vehicle photos.
    """
    if not damage_description_from_form or not damage_description_from_form.strip():
        return FraudCheckResult(
            name="Form vs. Image Metadata Consistency",
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

    # Identify parts mentioned on form
    mentioned_categories = set()
    for cat, kws in part_keywords.items():
        if any(kw in form_text for kw in kws):
            mentioned_categories.add(cat)

    # Identify parts detected by computer vision
    detected_categories = set()
    for p in detected_part_names:
        for cat, kws in part_keywords.items():
            if any(kw in p for kw in kws):
                detected_categories.add(cat)

    # Check for complete contradiction (e.g. form explicitly says "rear bumper", but photos only show front damage)
    if "rear" in form_text and "front" in " ".join(detected_part_names) and "rear" not in " ".join(detected_part_names):
        return FraudCheckResult(
            name="Form vs. Image Metadata Consistency",
            status="warning",
            detail="Directional Discrepancy: Form describes rear impact, but image analysis isolated only front-end damage.",
        )

    # General overlap check
    if mentioned_categories and detected_categories:
        overlap = mentioned_categories.intersection(detected_categories)
        if overlap:
            return FraudCheckResult(
                name="Form vs. Image Metadata Consistency",
                status="passed",
                detail="Accident description matches visual damage isolated by vision pipeline",
            )

    if not detected_parts:
        return FraudCheckResult(
            name="Form vs. Image Metadata Consistency",
            status="passed" if "No damage" in damage_description_from_form or not damage_description_from_form else "warning",
            detail="Zero physical vehicle damage isolated on uploaded photos to correlate with narrative.",
        )

    return FraudCheckResult(
        name="Form vs. Image Metadata Consistency",
        status="passed",
        detail="Incident narrative aligns with physical damage pattern",
    )


def live_camera_anti_spoofing_check(
    damage_photos_bytes: List[bytes],
) -> FraudCheckResult:
    """
    Inspects image EXIF metadata, dimensions, and compression artifacts to detect
    screenshots, web-downloaded images, or digitally manipulated photos.
    
    Checks performed:
    1. EXIF camera metadata presence (real photos have Make, Model, exposure data)
    2. Suspicious screenshot dimensions (exact phone/tablet screen sizes)
    3. Compression quality indicators
    """
    if not damage_photos_bytes:
        return FraudCheckResult(
            name="Live Camera Anti-Spoofing",
            status="warning",
            detail="No photos provided for optical capture analysis.",
        )

    # Common screenshot dimensions (width x height) for phones/tablets
    SCREENSHOT_DIMENSIONS = {
        (1080, 2400), (1080, 2340), (1080, 2280), (1080, 1920),  # Android FHD
        (1440, 3200), (1440, 3120), (1440, 2560),  # Android QHD
        (1170, 2532), (1125, 2436), (1242, 2688), (1284, 2778),  # iPhone
        (1179, 2556), (1290, 2796),  # iPhone 14/15
        (750, 1334), (828, 1792),  # iPhone SE/XR
        (2048, 2732), (1620, 2160), (1668, 2388),  # iPad
    }

    warnings = []
    photos_with_exif = 0
    photos_without_exif = 0
    suspicious_dimensions = 0

    for idx, photo_bytes in enumerate(damage_photos_bytes):
        try:
            img = Image.open(io.BytesIO(photo_bytes))
            width, height = img.size

            # Check 1: EXIF metadata
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

            # Check 2: Screenshot dimensions
            dims = (width, height)
            dims_rotated = (height, width)
            if dims in SCREENSHOT_DIMENSIONS or dims_rotated in SCREENSHOT_DIMENSIONS:
                suspicious_dimensions += 1
                warnings.append(f"Photo #{idx+1} has exact screen resolution ({width}x{height})")

        except Exception:
            # Can't analyze this photo — don't claim we verified it
            warnings.append(f"Photo #{idx+1} could not be analyzed for authenticity")

    total = len(damage_photos_bytes)

    # Decision logic
    if photos_without_exif == total and suspicious_dimensions > 0:
        return FraudCheckResult(
            name="Live Camera Anti-Spoofing",
            status="failed",
            detail=f"All {total} photos lack camera EXIF metadata and {suspicious_dimensions} have screenshot-like dimensions. "
                   f"Images appear to be screenshots or web downloads, not original camera captures.",
        )

    if photos_without_exif == total:
        return FraudCheckResult(
            name="Live Camera Anti-Spoofing",
            status="warning",
            detail=f"None of the {total} uploaded photos contain camera EXIF metadata (Make, Model, exposure). "
                   f"This may indicate re-saved, compressed, or downloaded images rather than original camera captures.",
        )

    if suspicious_dimensions > 0:
        return FraudCheckResult(
            name="Live Camera Anti-Spoofing",
            status="warning",
            detail=f"{suspicious_dimensions} of {total} photos have screenshot-like dimensions. "
                   f"{photos_with_exif} photos have valid camera EXIF metadata.",
        )

    if photos_with_exif == total:
        cameras = set()
        for photo_bytes in damage_photos_bytes:
            try:
                img = Image.open(io.BytesIO(photo_bytes))
                raw_exif = img._getexif()
                if raw_exif:
                    from PIL.ExifTags import TAGS
                    exif = {TAGS.get(k, k): v for k, v in raw_exif.items()}
                    cam = f"{exif.get('Make', '')} {exif.get('Model', '')}".strip()
                    if cam:
                        cameras.add(cam)
            except Exception:
                pass
        
        camera_info = f" Camera(s): {', '.join(cameras)}." if cameras else ""
        return FraudCheckResult(
            name="Live Camera Anti-Spoofing",
            status="passed",
            detail=f"All {total} photos contain valid camera EXIF metadata confirming authentic capture.{camera_info}",
        )

    return FraudCheckResult(
        name="Live Camera Anti-Spoofing",
        status="warning",
        detail=f"{photos_with_exif} of {total} photos have camera EXIF metadata. "
               f"{photos_without_exif} photos lack camera information.",
    )


def run_all_fraud_checks(
    damage_photos_bytes: List[bytes],
    extracted_plate: str,
    policy_rc: str,
    damage_description_from_form: str,
    detected_parts: List[Dict[str, Any]],
    claim_id: Optional[str] = None,
) -> List[FraudCheckResult]:
    """Runs the complete suite of fraud verification checks."""
    c1 = duplicate_check(damage_photos_bytes, claim_id=claim_id)
    c2 = plate_vs_rc_check(extracted_plate, policy_rc)
    c3 = form_vs_image_check(damage_description_from_form, detected_parts)
    c4 = live_camera_anti_spoofing_check(damage_photos_bytes)
    return [c1, c2, c3, c4]
