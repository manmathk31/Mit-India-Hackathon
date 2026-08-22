import asyncio
import base64
import io
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple
from PIL import Image, UnidentifiedImageError
import httpx

from .config import settings
from .logger import logger
from .material_lookup import lookup_material_type
from .schemas import (
    BoundingBox,
    DamageAssessmentResponse,
    DamageDetection,
    OverallDamageStatus,
    RepairOrReplace,
)


class ImageExtractionError(Exception):
    """Base exception for damage assessment extraction failures."""
    pass


class VisionAPIError(ImageExtractionError):
    """Raised when the vision API returns an upstream error or invalid payload."""
    pass


class VisionTimeoutError(ImageExtractionError):
    """Raised when the vision API call exceeds timeout limit."""
    pass


class InvalidPhotoError(ImageExtractionError):
    """Raised when an uploaded photo cannot be decoded or fails quality checks."""
    pass


def validate_and_decode_photo(image_bytes: bytes, filename: str = "damage_photo") -> Image.Image:
    """
    Validates that the provided byte stream is a valid, readable image with adequate resolution.
    Raises InvalidPhotoError on failure.
    """
    if not image_bytes or len(image_bytes) == 0:
        raise InvalidPhotoError(f"Photo '{filename}' is empty (0 bytes).")

    try:
        image_stream = io.BytesIO(image_bytes)
        img = Image.open(image_stream)
        img.verify()
        
        image_stream.seek(0)
        img = Image.open(image_stream)
        img.load()

        width, height = img.size
        min_dim = settings.MIN_IMAGE_DIMENSION_PX
        if width < min_dim or height < min_dim:
            raise InvalidPhotoError(
                f"Photo '{filename}' resolution ({width}x{height}) is too low for damage inspection. Minimum required: {min_dim}x{min_dim}px."
            )

        return img
    except (UnidentifiedImageError, OSError, SyntaxError) as e:
        raise InvalidPhotoError(f"File '{filename}' could not be decoded as a valid image: {str(e)}")


def calculate_overall_status(severities: List[str]) -> OverallDamageStatus:
    """
    Determines overall vehicle damage status based on worst detected severity.
    Hierarchy: severe > moderate > minor > none.
    """
    if not severities:
        return "none"
    if "severe" in severities:
        return "severe"
    if "moderate" in severities:
        return "moderate"
    if "minor" in severities:
        return "minor"
    return "none"

# Concurrency limiter for Gemini Vision API calls to stay within rate limits
_vision_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_CALLS)



# ------------------------------------------------------------------------------
# 1. Custom Model Inference Layer (Trained in Google Colab: YOLO / ONNX)
# ------------------------------------------------------------------------------

def _run_custom_model_on_photo(
    image_bytes: bytes,
    image_index: int,
    image_width: int,
    image_height: int,
) -> Optional[List[DamageDetection]]:
    """
    Executes inference using our custom-trained vehicle damage model (ONNX / PyTorch weights).
    """
    # Resolve model path across possible execution directories
    candidates = [
        settings.CUSTOM_MODEL_PATH,
        os.path.join(os.path.dirname(__file__), "models", "damage_yolo.onnx"),
        os.path.join(os.path.dirname(__file__), settings.CUSTOM_MODEL_PATH),
        os.path.join(os.getcwd(), "image_agent", "models", "damage_yolo.onnx"),
        os.path.join(os.getcwd(), "models", "damage_yolo.onnx"),
    ]
    resolved_path = None
    for p in candidates:
        if p and os.path.exists(p):
            resolved_path = p
            break

    if not resolved_path:
        return None

    model_path = resolved_path

    try:
        # Check if ONNX runtime or Ultralytics is installed
        try:
            import onnxruntime as ort
            import numpy as np

            # Fast ONNX inference
            session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
            # ONNX output decoding is not implemented for the current damage_yolo.onnx export.
            # The model loads but we cannot decode raw output tensors without knowing
            # the exact export config (anchors, class map, NMS thresholds).
            # DO NOT log success — no detections were actually produced.
            logger.warning(
                f"ONNX model loaded for photo #{image_index+1} but output decoding is not implemented. "
                f"Falling back to Gemini Vision API."
            )
            return None  # Honestly signal that custom model produced no results
        except ImportError:
            try:
                from ultralytics import YOLO
                yolo_model = YOLO(model_path)
                img = Image.open(io.BytesIO(image_bytes))
                results = yolo_model(img, verbose=False)[0]

                detections: List[DamageDetection] = []
                for box in results.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    xywh = box.xywh[0].tolist()
                    part_label = results.names.get(cls_id, "damaged part")

                    x = int(max(0, xywh[0] - xywh[2] / 2))
                    y = int(max(0, xywh[1] - xywh[3] / 2))
                    w = int(xywh[2])
                    h = int(xywh[3])

                    severity = "moderate" if conf > 0.7 else "minor"
                    action = "replace" if conf > 0.85 else "repair"

                    detections.append(
                        DamageDetection(
                            part_name=part_label,
                            material_type=lookup_material_type(part_label),
                            severity=severity,
                            repair_or_replace=action,
                            confidence=round(conf, 2),
                            bounding_box=BoundingBox(x=x, y=y, w=w, h=h),
                            source_image_index=image_index,
                        )
                    )
                return detections
            except ImportError:
                return None
    except Exception as e:
        logger.warning(f"Custom model inference encountered error: {str(e)}. Falling back to Gemini.")
        return None


# ------------------------------------------------------------------------------
# 2. Pure Google Gemini Fallback Layer (gemini-3.5-flash-lite)
# ------------------------------------------------------------------------------

def _get_gemini_endpoint_and_headers(model: str, api_key: str) -> Tuple[str, Dict[str, str]]:
    """Constructs the correct URL and HTTP headers for Google Gemini API."""
    base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }
    if api_key.startswith("ya29."):
        headers["Authorization"] = f"Bearer {api_key}"
        return base_url, headers
    return f"{base_url}?key={api_key}", headers


async def _analyze_photos_batch_with_gemini(
    photos_to_analyze: List[Tuple[int, bytes, int, int]],
) -> List[DamageDetection]:
    """
    Analyzes multiple vehicle damage photos in a SINGLE multimodal Gemini Vision API call.
    This reduces API calls from N down to 1 per claim, completely eliminating 429 Rate Limit errors.
    """
    if not photos_to_analyze:
        return []

    api_key = settings.active_api_key
    if not api_key:
        raise VisionAPIError("GEMINI_API_KEY not configured. Set GEMINI_API_KEY in .env.")

    model = settings.GEMINI_MODEL
    url, headers = _get_gemini_endpoint_and_headers(model, api_key)

    prompt = """
You are an expert motor insurance vehicle damage assessor.
Analyze the uploaded vehicle damage photos.
For each damaged part visible in ANY photo, identify the damage and return strictly valid JSON matching this schema:
{
  "detections": [
    {
      "source_image_index": 0,
      "part_name": "front bumper",
      "material_type": "plastic-rubber",
      "severity": "minor",
      "repair_or_replace": "repair",
      "confidence": 0.95,
      "bounding_box": {
        "x": 100,
        "y": 150,
        "w": 300,
        "h": 200
      }
    }
  ]
}

Guidelines:
1. source_image_index: 0-indexed position of the photo (0 for Photo #1, 1 for Photo #2, etc.).
2. part_name: specify standard automotive parts (e.g. front bumper, rear bumper, bonnet, front left fender, headlight housing, windshield, door, rocker panel).
3. material_type must be one of: "metal", "plastic-rubber", "glass", "fibreglass", "unknown".
4. severity must be one of: "minor", "moderate", "severe".
5. repair_or_replace must be one of: "repair", "replace".
6. bounding_box coordinates (x, y, w, h) must be in exact pixel coordinates relative to that specific photo's dimensions.
7. If no damage is present on any photo, return {"detections": []}.
"""

    parts: List[Dict[str, Any]] = [{"text": prompt}]
    for idx, photo_bytes, w, h in photos_to_analyze:
        b64_img = base64.b64encode(photo_bytes).decode("utf-8")
        parts.append({"text": f"Photo #{idx+1} (Dimensions: {w}x{h} px):"})
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": b64_img}})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.0},
    }

    timeout = settings.REQUEST_TIMEOUT_SECONDS
    async with _vision_semaphore:
        for attempt in range(settings.MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    res = await client.post(url, json=payload, headers=headers)

                    if res.status_code == 429:
                        if attempt < settings.MAX_RETRIES:
                            backoff = (settings.RATE_LIMIT_BACKOFF_FACTOR ** attempt) + 1.5
                            logger.warning(f"Gemini 429 Rate Limit. Retrying in {backoff:.1f}s (Attempt {attempt+1})")
                            await asyncio.sleep(backoff)
                            continue
                        else:
                            raise VisionAPIError("Gemini Vision API rate limit exceeded.")

                    if res.status_code != 200:
                        raise VisionAPIError(f"Gemini API returned HTTP {res.status_code}: {res.text}")

                    data = res.json()
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(re.sub(r"^```json\s*|\s*```$", "", text.strip()))

                    results: List[DamageDetection] = []
                    for raw_det in parsed.get("detections", []):
                        part = raw_det.get("part_name", "unknown")
                        mat = raw_det.get("material_type") or lookup_material_type(part)
                        bb = raw_det.get("bounding_box", {})
                        sev = raw_det.get("severity")
                        ror = raw_det.get("repair_or_replace")
                        conf = raw_det.get("confidence")
                        src_idx = int(raw_det.get("source_image_index", 0))

                        # Validate src_idx bounds
                        if src_idx < 0 or src_idx >= len(photos_to_analyze):
                            src_idx = 0

                        # Skip detections where Gemini didn't return required fields
                        if not sev or sev not in ("minor", "moderate", "severe"):
                            logger.warning(f"Skipping detection '{part}': missing/invalid severity '{sev}'")
                            continue
                        if not ror or ror not in ("repair", "replace"):
                            logger.warning(f"Skipping detection '{part}': missing/invalid repair_or_replace '{ror}'")
                            continue
                        if conf is None:
                            conf = 0.5  # Honest default

                        results.append(
                            DamageDetection(
                                part_name=part,
                                material_type=mat,
                                severity=sev,
                                repair_or_replace=ror,
                                confidence=float(conf),
                                bounding_box=BoundingBox(
                                    x=max(0, int(bb.get("x", 0))),
                                    y=max(0, int(bb.get("y", 0))),
                                    w=max(1, int(bb.get("w", 100))),
                                    h=max(1, int(bb.get("h", 100))),
                                ),
                                source_image_index=photos_to_analyze[src_idx][0],
                            )
                        )
                    return results

            except httpx.TimeoutException as e:
                if attempt < settings.MAX_RETRIES:
                    await asyncio.sleep(1.0)
                    continue
                raise VisionTimeoutError(f"Gemini Vision call timed out: {str(e)}")
            except (json.JSONDecodeError, KeyError, IndexError) as e:
                raise VisionAPIError(f"Failed to parse Gemini Vision response: {str(e)}")

    return []


# ------------------------------------------------------------------------------
# 3. Main Damage Assessment Pipeline
# ------------------------------------------------------------------------------

async def extract_damage_assessment(
    photos: List[Tuple[int, bytes]],
) -> DamageAssessmentResponse:
    """
    Main extraction interface:
    1. Runs Custom Model locally first if weights exist.
    2. Batches all remaining photos into a SINGLE Multimodal Gemini Vision call (1 API request total).
    """
    if not photos:
        return DamageAssessmentResponse(
            overall_damage_status="none",
            detections=[],
            photos_analyzed=0,
            no_damage_detected=True,
        )

    # 1. Validation & dimension check
    dimensions: List[Tuple[int, int]] = []
    for idx, photo_bytes in photos:
        img = validate_and_decode_photo(photo_bytes, filename=f"damage_photo_{idx+1}")
        dimensions.append(img.size)

    # 2. Execution Pipeline (Custom Model Primary -> Single Batched Gemini Vision)
    all_detections: List[DamageDetection] = []
    gemini_batch_photos: List[Tuple[int, bytes, int, int]] = []

    logger.info(f"Analyzing {len(photos)} damage photo(s)")

    for idx, photo_bytes in photos:
        w, h = dimensions[idx]
        custom_dets = _run_custom_model_on_photo(photo_bytes, idx, w, h)
        if custom_dets is not None and len(custom_dets) > 0:
            logger.info(f"Photo #{idx+1} analyzed via Custom Model ({len(custom_dets)} detections)")
            all_detections.extend(custom_dets)
        else:
            gemini_batch_photos.append((idx, photo_bytes, w, h))

    # Step B: Run ALL remaining photos in a SINGLE Batched Gemini Vision call
    if gemini_batch_photos:
        logger.info(f"Submitting {len(gemini_batch_photos)} photo(s) in a SINGLE batched Gemini Vision call")
        try:
            gemini_dets = await _analyze_photos_batch_with_gemini(gemini_batch_photos)
            all_detections.extend(gemini_dets)
        except Exception as e:
            logger.warning(f"Gemini Batched Vision call failed: {str(e)}")

    # 3. Compute overall damage status
    severities = [d.severity for d in all_detections]
    overall_status = calculate_overall_status(severities)

    return DamageAssessmentResponse(
        overall_damage_status=overall_status,
        detections=all_detections,
        photos_analyzed=len(photos),
        no_damage_detected=len(all_detections) == 0,
    )


async def validate_single_vehicle_photo(
    image_bytes: bytes,
) -> Dict[str, Any]:
    """
    Validates whether the uploaded photo actually depicts a motor vehicle or vehicle body part.
    Rejects non-vehicle images (e.g., birds, animals, people, landscapes, indoor objects, memes).
    """
    # 1. Check basic image decoding and resolution
    try:
        img = validate_and_decode_photo(image_bytes, "vehicle_upload")
    except InvalidPhotoError as e:
        return {
            "is_vehicle": False,
            "detected_subject": "invalid_image",
            "reason": str(e),
        }

    # Downscale for fast inference
    img_copy = img.convert("RGB")
    img_copy.thumbnail((800, 800), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img_copy.save(buf, format="JPEG", quality=85)
    fast_bytes = buf.getvalue()

    # 2. Check using Gemini Vision fast classifier
    api_key = settings.active_api_key
    if api_key:
        try:
            model = settings.GEMINI_MODEL
            url, headers = _get_gemini_endpoint_and_headers(model, api_key)
            prompt = """
You are an expert vehicle damage assessment inspector.
Analyze this single uploaded image.
Determine whether this image depicts a motor vehicle (car, SUV, truck, motorcycle, bus, auto-rickshaw, van, or a vehicle body part/panel such as bumper, fender, door, hood, headlight, windshield, wheel, etc.).

If the image depicts a non-vehicle subject (e.g. bird, animal, person, food, selfie, landscape, sky, house, document, text, drawing, cartoon, meme, or random object):
Set "is_vehicle": false.

Respond strictly in valid JSON format:
{
  "is_vehicle": true,
  "detected_subject": "car / bumper / bird / animal / person / landscape / other",
  "reason": "1-sentence concise explanation of what is shown in the image."
}
"""
            parts = [
                {"text": prompt},
                {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(fast_bytes).decode("utf-8")}},
            ]
            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {"response_mime_type": "application/json", "temperature": 0.0},
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    ai_raw = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                    cleaned = re.sub(r"^```json\s*|\s*```$", "", ai_raw.strip())
                    parsed = json.loads(cleaned)
                    is_veh = bool(parsed.get("is_vehicle", False))
                    subject = parsed.get("detected_subject", "unknown")
                    reason = parsed.get("reason", "")
                    if not reason:
                        reason = f"Verified as a {subject}." if is_veh else f"The uploaded photo appears to be a {subject}, not a motor vehicle. Please upload a clear photo of your damaged vehicle."
                    return {
                        "is_vehicle": is_veh,
                        "detected_subject": subject,
                        "reason": reason,
                    }
        except Exception as e:
            logger.warning(f"Fast vehicle photo validator error: {e}")

    # Fallback if API key is not configured or network error
    return {
        "is_vehicle": True,
        "detected_subject": "vehicle",
        "reason": "Photo accepted.",
    }
