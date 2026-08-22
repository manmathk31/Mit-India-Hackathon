import asyncio
import base64
import io
import json
import re
from typing import Any, Dict, List, Optional, Tuple
from PIL import Image, ImageEnhance, ImageFilter, UnidentifiedImageError
import httpx

try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False

from .config import settings
from .logger import logger
from .schemas import (
    ExtractedClaimFormDocument,
    ExtractedDLDocument,
    ExtractedRCDocument,
    PolicyRecord,
    RawExtractedDocuments,
)


class ExtractionError(Exception):
    """Base exception for document extraction failures."""
    pass


class ExtractionAPIError(ExtractionError):
    """Raised when the vision/OCR API returns an error or malformed response."""
    pass


class ExtractionTimeoutError(ExtractionError):
    """Raised when the vision/OCR API request times out."""
    pass


class InvalidImageContentError(ExtractionError):
    """Raised when an uploaded file cannot be decoded or fails quality checks."""
    pass


def validate_and_check_image_quality(image_bytes: bytes, filename: str = "document") -> Image.Image:
    """
    Validates image decoding, dimensions, and basic quality metrics.
    Rejects corrupted, truncated, zero-byte, or excessively small images.
    """
    if not image_bytes or len(image_bytes) == 0:
        raise InvalidImageContentError(f"File '{filename}' is empty (0 bytes).")

    try:
        image_stream = io.BytesIO(image_bytes)
        img = Image.open(image_stream)
        img.verify()  # Header verification
        
        # Reload image after verify() since verify modifies stream position
        image_stream.seek(0)
        img = Image.open(image_stream)
        img.load()  # Load full pixel buffer into memory to detect truncated data

        width, height = img.size
        min_dim = settings.MIN_IMAGE_DIMENSION_PX
        if width < min_dim or height < min_dim:
            raise InvalidImageContentError(
                f"Image '{filename}' resolution ({width}x{height}) is too low for reliable OCR. Minimum required: {min_dim}x{min_dim}px."
            )

        return img
    except (UnidentifiedImageError, OSError, SyntaxError) as e:
        raise InvalidImageContentError(
            f"File '{filename}' could not be decoded as a valid image: {str(e)}"
        )


def _preprocess_image_for_ocr(img: Image.Image) -> Image.Image:
    """Preprocesses image with grayscale, contrast enhancement, and noise filtering for local OCR."""
    gray = img.convert("L")
    enhancer = ImageEnhance.Contrast(gray)
    enhanced = enhancer.enhance(1.8)
    return enhanced


def _run_local_tesseract_ocr(image_bytes: bytes) -> Tuple[str, float]:
    """
    Executes local Tesseract OCR on the image.
    Returns (extracted_raw_text, average_ocr_confidence_0_to_1).
    """
    if not PYTESSERACT_AVAILABLE:
        return "", 0.0

    if settings.TESSERACT_CMD_PATH:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD_PATH

    try:
        img = Image.open(io.BytesIO(image_bytes))
        preprocessed = _preprocess_image_for_ocr(img)

        # Get detailed OCR data including bounding boxes and per-word confidence
        data = pytesseract.image_to_data(preprocessed, output_type=pytesseract.Output.DICT)
        
        words = []
        confidences = []
        for i, text in enumerate(data["text"]):
            word = text.strip()
            conf = int(data["conf"][i])
            if word and conf > 0:
                words.append(word)
                confidences.append(conf)

        raw_text = " ".join(words)
        avg_confidence = (sum(confidences) / len(confidences) / 100.0) if confidences else 0.0
        return raw_text, round(avg_confidence, 2)
    except Exception as e:
        logger.warning(f"Local Tesseract OCR execution skipped/failed: {str(e)}")
        return "", 0.0


# ------------------------------------------------------------------------------
# Local Regex / Rule Parsers for Indian Documents
# ------------------------------------------------------------------------------

def _parse_rc_locally(raw_text: str, overall_conf: float) -> Dict[str, Any]:
    """Extracts RC fields from local OCR text using regex patterns."""
    text_upper = raw_text.upper()

    # Plate / RC Number: standard Indian registration pattern (e.g. MH02CB1234, DL01A1234)
    plate_match = re.search(r"\b([A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4})\b", text_upper)
    rc_number = plate_match.group(1) if plate_match else ""
    rc_conf = overall_conf if rc_number else 0.3

    # Chassis Number: 17-character VIN/chassis
    chassis_match = re.search(r"\b([A-HJ-NPR-Z0-9]{17})\b", text_upper)
    chassis_number = chassis_match.group(1) if chassis_match else ""
    chassis_conf = overall_conf if chassis_number else 0.3

    # Engine Number
    eng_match = re.search(r"(?:ENG(?:INE)?|E-NO)[:\s]+([A-Z0-9]{6,14})", text_upper)
    engine_number = eng_match.group(1) if eng_match else ""

    # Registration Year
    year_match = re.search(r"\b(20[0-2][0-9]|199[0-9])\b", text_upper)
    reg_year = int(year_match.group(1)) if year_match else None  # Never fabricate a year

    # Owner Name (Look around Name/Owner tokens)
    owner_match = re.search(r"(?:NAME|OWNER|S\/O|D\/O|W\/O)[:\s]+([A-Z\s]{4,30})", text_upper)
    owner_name = owner_match.group(1).strip() if owner_match else ""
    owner_conf = (overall_conf * 0.9) if owner_name else 0.2

    # Make & Model — extract ONLY if the keyword is actually found in OCR text.
    # Never fabricate a specific brand/model when OCR can't find one.
    make = "UNKNOWN"
    if "MARUTI" in text_upper or "SUZUKI" in text_upper:
        make = "Maruti Suzuki"
    elif "HYUNDAI" in text_upper:
        make = "Hyundai"
    elif "TATA" in text_upper:
        make = "Tata Motors"
    elif "MAHINDRA" in text_upper:
        make = "Mahindra"
    elif "HONDA" in text_upper:
        make = "Honda"
    elif "TOYOTA" in text_upper:
        make = "Toyota"
    elif "KIA" in text_upper:
        make = "Kia"

    model = "UNKNOWN"
    if "SWIFT" in text_upper:
        model = "Swift"
    elif "DZIRE" in text_upper:
        model = "Dzire"
    elif "CRETA" in text_upper:
        model = "Creta"
    elif "NEXON" in text_upper:
        model = "Nexon"
    elif "BALENO" in text_upper:
        model = "Baleno"
    elif "I20" in text_upper or "I 20" in text_upper:
        model = "i20"
    elif "CITY" in text_upper:
        model = "City"
    elif "SELTOS" in text_upper:
        model = "Seltos"
    # Add more models as needed — but never guess

    variant = "UNKNOWN"
    if "VXI" in text_upper:
        variant = "VXI"
    elif "ZXI" in text_upper:
        variant = "ZXI"
    elif "LXI" in text_upper:
        variant = "LXI"
    elif "VDI" in text_upper:
        variant = "VDI"
    elif "ZDI" in text_upper:
        variant = "ZDI"

    # Determine if vehicle identity was actually extracted vs unknown
    vehicle_identified = make != "UNKNOWN" and model != "UNKNOWN"
    doc_type = "RC" if (rc_number or chassis_number) else "UNVERIFIED"
    if not vehicle_identified:
        doc_type = "UNVERIFIED" if not rc_number else doc_type

    # Confidence reflects actual extraction quality
    if rc_number and chassis_number and vehicle_identified:
        doc_confidence = overall_conf
    elif rc_number or chassis_number:
        doc_confidence = min(overall_conf, 0.45)  # Partial extraction
    else:
        doc_confidence = 0.2  # Basically nothing extracted

    return {
        "owner_name": owner_name,
        "owner_name_confidence": owner_conf,
        "rc_number": rc_number,
        "rc_number_confidence": rc_conf,
        "chassis_number": chassis_number,
        "chassis_number_confidence": chassis_conf,
        "engine_number": engine_number,
        "make": make,
        "model": model,
        "variant": variant,
        "registration_year": reg_year,
        "plate_number": rc_number,
        "document_type_detected": doc_type,
        "confidence": doc_confidence,
    }


def _parse_dl_locally(raw_text: str, overall_conf: float) -> Dict[str, Any]:
    """Extracts DL fields from local OCR text using regex patterns."""
    text_upper = raw_text.upper()

    # DL Number: Indian DL pattern (e.g. DL-1420110012345, MH0220180001234)
    dl_match = re.search(r"\b([A-Z]{2}[-\s]?[0-9]{2,4}[-\s]?[0-9]{7,11})\b", text_upper)
    dl_number = dl_match.group(1).replace(" ", "") if dl_match else ""
    dl_conf = overall_conf if dl_number else 0.3

    # Expiry Date: Look for dates following Valid/Expiry/NT
    date_matches = re.findall(r"(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})", text_upper)
    expiry_date = date_matches[-1] if date_matches else ""
    expiry_conf = overall_conf if expiry_date else 0.3

    # Holder Name
    holder_match = re.search(r"(?:NAME|HOLDER)[:\s]+([A-Z\s]{4,30})", text_upper)
    holder_name = holder_match.group(1).strip() if holder_match else ""
    holder_conf = (overall_conf * 0.9) if holder_name else 0.2

    # Vehicle Classes
    classes = []
    if "LMV" in text_upper:
        classes.append("LMV")
    if "MCWG" in text_upper:
        classes.append("MCWG")
    if "TRANS" in text_upper or "COMM" in text_upper:
        classes.append("COMMERCIAL")

    return {
        "dl_number": dl_number,
        "dl_number_confidence": dl_conf,
        "holder_name": holder_name,
        "holder_name_confidence": holder_conf,
        "expiry_date": expiry_date,
        "expiry_date_confidence": expiry_conf,
        "issue_date": date_matches[0] if len(date_matches) > 1 else "",
        "vehicle_classes": classes or ["LMV"],
        "document_type_detected": "DL",
        "confidence": overall_conf if dl_number and expiry_date else 0.5,
    }


def _parse_claim_form_locally(raw_text: str, overall_conf: float) -> Dict[str, Any]:
    """Extracts Claim Form details from local OCR text."""
    text_raw = raw_text

    # Incident Date
    date_match = re.search(r"(?:INCIDENT|LOSS|ACCIDENT|DATE)[:\s]+(\d{2}[/-]\d{2}[/-]\d{4})", text_raw, re.IGNORECASE)
    incident_date = date_match.group(1) if date_match else ""

    # Damage Description: verbatim text block
    damage_match = re.search(r"(?:DAMAGE|DETAILS|DESCRIPTION|HOW ACCIDENT OCCURRED)[:\s]+([^\n\r]{10,250})", text_raw, re.IGNORECASE)
    damage_description = damage_match.group(1).strip() if damage_match else raw_text[:200]
    damage_conf = overall_conf if len(damage_description) > 15 else 0.3

    return {
        "claimant_name": "",
        "claimant_name_confidence": 0.3,
        "vehicle_number": "",
        "policy_number": "",
        "incident_date": incident_date,
        "damage_description": damage_description,
        "damage_description_confidence": damage_conf,
        "document_type_detected": "CLAIM_FORM",
        "confidence": overall_conf if damage_description else 0.4,
    }


# ------------------------------------------------------------------------------
# Selective LLM Fallback (Targeted Disambiguation on Low Confidence Fields Only)
# ------------------------------------------------------------------------------

# Concurrency Semaphore to prevent bursting beyond rate limits (15 RPM)
_llm_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_LLM_CALLS)


def _get_gemini_endpoint_and_headers(model: str, api_key: str) -> Tuple[str, Dict[str, str]]:
    """Constructs the correct URL and HTTP headers for Google Gemini API supporting both AIza keys and AQ. auth tokens."""
    base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }
    if api_key.startswith("AQ.") or api_key.startswith("ya29."):
        headers["Authorization"] = f"Bearer {api_key}"
        return base_url, headers
    return f"{base_url}?key={api_key}", headers


async def _run_selective_llm_disambiguation(
    image_bytes: bytes,
    document_type: str,
    field_name: str,
    initial_extracted_value: str,
    initial_confidence: float,
    context_hint: str = "",
) -> Dict[str, Any]:
    """
    Selective LLM Fallback:
    Triggered ONLY for specific low-confidence fields (< 70%).
    Includes built-in Rate Limit (429) protection, exponential backoff, and graceful fallback.
    """
    logger.info(
        f"Selective LLM Fallback Triggered for field '{field_name}' in {document_type} "
        f"[Local OCR Confidence: {initial_confidence:.2f}, Raw Value: '{initial_extracted_value}']"
    )

    api_key = settings.active_api_key
    if not api_key:
        # API key not configured — return honest low confidence, never inflate
        logger.warning(
            f"GEMINI_API_KEY not configured. Cannot disambiguate '{field_name}'. "
            f"Returning local OCR reading with original confidence {initial_confidence:.2f}."
        )
        return {
            "field_name": field_name,
            "repaired_value": initial_extracted_value or "UNREADABLE",
            "confidence": max(0.2, initial_confidence),  # Never inflate — no API call was made
        }

    disambiguate_prompt = f"""
You are an expert Indian motor insurance document forensic examiner.
Inspect this {document_type} image with extreme precision to extract the exact value for the field: '{field_name}'.

Current low-confidence OCR reading: "{initial_extracted_value}"
Context hint: "{context_hint}"

Analyze the visual pixels carefully (watch for standard OCR errors like 0 vs O, 1 vs I, 8 vs B, 5 vs S).
Return strictly valid JSON with this format:
{{
  "field_name": "{field_name}",
  "repaired_value": "STRING",
  "confidence": 0.96,
  "reasoning": "Brief explanation of verified pixels"
}}
"""
    b64_img = base64.b64encode(image_bytes).decode("utf-8")
    timeout = settings.REQUEST_TIMEOUT_SECONDS

    # Protect against exceeding RPM limit using Semaphore
    async with _llm_semaphore:
        for attempt in range(settings.MAX_RETRIES + 1):
            try:
                if settings.VISION_PROVIDER == "gemini":
                    model = settings.GEMINI_MODEL
                    url, headers = _get_gemini_endpoint_and_headers(model, api_key)
                    parts = [
                        {"text": disambiguate_prompt},
                        {"inline_data": {"mime_type": "image/jpeg", "data": b64_img}},
                    ]
                    payload = {
                        "contents": [{"parts": parts}],
                        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.0},
                    }
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        res = await client.post(url, json=payload, headers=headers)
                        
                        # Handle Rate Limit (HTTP 429 / ResourceExhausted)
                        if res.status_code == 429:
                            if attempt < settings.MAX_RETRIES:
                                backoff_seconds = (settings.RATE_LIMIT_BACKOFF_FACTOR ** attempt) + 1.0
                                logger.warning(
                                    f"Gemini 429 Rate Limit encountered for '{field_name}'. Retrying in {backoff_seconds:.1f}s (Attempt {attempt+1}/{settings.MAX_RETRIES})"
                                )
                                await asyncio.sleep(backoff_seconds)
                                continue
                            else:
                                logger.error(f"Gemini 429 Rate Limit exceeded after {settings.MAX_RETRIES} retries for '{field_name}'. Gracefully degrading to local reading.")
                                break

                        if res.status_code == 200:
                            data = res.json()
                            text = data["candidates"][0]["content"]["parts"][0]["text"]
                            return json.loads(re.sub(r"^```json\s*|\s*```$", "", text.strip()))
            except httpx.TimeoutException:
                # For timeouts (not rate limits), only retry once to prevent burning
                # excessive time on unrelated/stock images that Gemini can't process.
                if attempt < 1:
                    await asyncio.sleep(1.0)
                    continue
                logger.warning(f"Selective LLM timeout for '{field_name}'. Gracefully falling back.")
                break
            except Exception as e:
                logger.warning(f"Selective LLM error for '{field_name}': {str(e)}. Gracefully falling back.")
                break

    # Graceful degradation: If rate-limited or failed, app NEVER crashes.
    # But we NEVER inflate confidence — no LLM verification actually happened.
    logger.warning(
        f"LLM disambiguation failed for '{field_name}'. Returning local OCR reading "
        f"with original confidence {initial_confidence:.2f} (not inflated)."
    )
    return {
        "field_name": field_name,
        "repaired_value": initial_extracted_value or "UNREADABLE",
        "confidence": max(0.2, initial_confidence),  # Never inflate — LLM call failed
    }


# ------------------------------------------------------------------------------
# Full Multimodal Vision Fallback (When whole document requires live vision)
# ------------------------------------------------------------------------------

async def _call_full_vision_api(
    rc_bytes: bytes,
    dl_bytes: bytes,
    claim_form_bytes: bytes,
) -> Dict[str, Any]:
    """Invokes full multimodal Vision API when running in vision_api primary mode."""
    api_key = settings.active_api_key
    if not api_key:
        raise ExtractionAPIError("API key for vision provider is not configured.")

    prompt = """
You are an expert Indian motor insurance document reader.
Analyze the 3 uploaded claim document images:
Image 1: Vehicle Registration Certificate (RC)
Image 2: Driver's Driving Licence (DL)
Image 3: Claim Intimation Form (which may be handwritten, typed, or a filled-in paper form)

Guidelines:
1. Documents may be printed, typed, or handwritten. Read all visible text carefully.
2. If text is handwritten but legible, extract it and assign confidence between 0.70 and 0.95.
3. If a field is illegible, obscured, or absent from the image, set its string value to "Unreadable / Missing" and set its confidence to 0.10.
4. Do NOT hallucinate or invent missing vehicle numbers or dates.

Return strictly valid JSON matching this structure:
{
  "rc": {
    "owner_name": "string", "owner_name_confidence": 0.95,
    "rc_number": "string", "rc_number_confidence": 0.95,
    "chassis_number": "string", "chassis_number_confidence": 0.95,
    "engine_number": "string", "make": "string", "model": "string", "variant": "string",
    "registration_year": null, "plate_number": "string", "document_type_detected": "RC", "confidence": 0.95
  },
  "dl": {
    "dl_number": "string", "dl_number_confidence": 0.95,
    "holder_name": "string", "holder_name_confidence": 0.95,
    "expiry_date": "YYYY-MM-DD", "expiry_date_confidence": 0.95,
    "issue_date": "YYYY-MM-DD", "vehicle_classes": ["LMV"], "document_type_detected": "DL", "confidence": 0.95
  },
  "claim_form": {
    "claimant_name": "string", "claimant_name_confidence": 0.95,
    "vehicle_number": "string", "policy_number": "string", "incident_date": "YYYY-MM-DD",
    "damage_description": "VERBATIM FREE-TEXT DAMAGE DESCRIPTION AS WRITTEN",
    "damage_description_confidence": 0.95, "document_type_detected": "CLAIM_FORM", "confidence": 0.95
  }
}
"""
    if settings.VISION_PROVIDER == "gemini":
        model = settings.GEMINI_MODEL
        url, headers = _get_gemini_endpoint_and_headers(model, api_key)
        parts = [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(rc_bytes).decode("utf-8")}},
            {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(dl_bytes).decode("utf-8")}},
            {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(claim_form_bytes).decode("utf-8")}},
        ]
        payload = {"contents": [{"parts": parts}], "generationConfig": {"response_mime_type": "application/json", "temperature": 0.0}}
        async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code != 200:
                logger.warning(f"Vision API returned HTTP {res.status_code}: {res.text}")
                return {"rc": {}, "dl": {}, "claim_form": {}}
            try:
                raw = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                cleaned_json = re.sub(r"^```json\s*|\s*```$", "", raw.strip())
                return json.loads(cleaned_json)
            except Exception as parse_err:
                logger.warning(f"Could not parse Vision API JSON: {parse_err}")
                return {"rc": {}, "dl": {}, "claim_form": {}}
    else:
        raise ExtractionAPIError(
            f"Unsupported VISION_PROVIDER: '{settings.VISION_PROVIDER}'. Only 'gemini' is supported."
        )


# ------------------------------------------------------------------------------
# Main Extraction Pipeline
# ------------------------------------------------------------------------------

async def extract_documents(
    rc_bytes: bytes,
    dl_bytes: bytes,
    claim_form_bytes: bytes,
    policy_hint: Optional[PolicyRecord] = None,
) -> RawExtractedDocuments:
    """
    Main extraction interface:
    1. Validates image integrity and pixel dimensions.
    2. Runs Local OCR first (Tesseract / Regex Parsing) to extract raw text & per-field confidences.
    3. Evaluates per-field confidences: if any field is low-confidence (< 0.85) or missing,
       selectively triggers targeted LLM disambiguation fallback ONLY for that specific field.
    """
    # 1. Quality & decoding pre-checks
    validate_and_check_image_quality(rc_bytes, filename="rc_image")
    validate_and_check_image_quality(dl_bytes, filename="dl_image")
    validate_and_check_image_quality(claim_form_bytes, filename="claim_form_image")

    fallback_count = 0
    th = settings.OCR_CONFIDENCE_FALLBACK_THRESHOLD

    rc_data = {}
    dl_data = {}
    form_data = {}

    # 2. Primary Extraction
    if settings.PRIMARY_OCR_ENGINE == "local":
        logger.info("Executing Primary Layer: Local OCR extraction")
        rc_text, rc_conf = _run_local_tesseract_ocr(rc_bytes)
        dl_text, dl_conf = _run_local_tesseract_ocr(dl_bytes)
        form_text, form_conf = _run_local_tesseract_ocr(claim_form_bytes)

        # If local OCR failed to extract meaningful text (e.g. non-standard image, handwriting, or missing tesseract)
        total_text_len = len(rc_text.strip()) + len(dl_text.strip()) + len(form_text.strip())
        if total_text_len < 20:
            logger.info("Local OCR returned minimal text. Elevating directly to Full Vision API.")
            extracted_dict = await _call_full_vision_api(rc_bytes, dl_bytes, claim_form_bytes)
            rc_data = extracted_dict.get("rc", {}) or {}
            dl_data = extracted_dict.get("dl", {}) or {}
            form_data = extracted_dict.get("claim_form", {}) or {}
            fallback_count += 1

            # Fast-fail: If all 3 documents returned empty from Vision API, this is likely
            # a completely unrelated/stock image set. Skip expensive LLM disambiguation.
            all_empty = not any([rc_data, dl_data, form_data])
            if all_empty:
                logger.warning(
                    "Vision API returned empty for all 3 documents. "
                    "Likely unrelated/stock images uploaded. Skipping LLM disambiguation to prevent timeout."
                )
                return RawExtractedDocuments(
                    rc=ExtractedRCDocument(),
                    dl=ExtractedDLDocument(),
                    claim_form=ExtractedClaimFormDocument(),
                    fallback_invocations_count=fallback_count,
                )
        else:
            rc_data = _parse_rc_locally(rc_text, rc_conf)
            dl_data = _parse_dl_locally(dl_text, dl_conf)
            form_data = _parse_claim_form_locally(form_text, form_conf)
    else:
        logger.info("Executing Primary Layer: Full Vision API extraction")
        extracted_dict = await _call_full_vision_api(rc_bytes, dl_bytes, claim_form_bytes)
        rc_data = extracted_dict.get("rc", {}) or {}
        dl_data = extracted_dict.get("dl", {}) or {}
        form_data = extracted_dict.get("claim_form", {}) or {}

    # 3. Selective LLM Disambiguation — run all 3 documents IN PARALLEL for 3x speedup
    if settings.PRIMARY_OCR_ENGINE == "local":
        async def _disambiguate_doc(data_dict: Dict[str, Any], doc_type: str, img_bytes: bytes, hint: str):
            """Runs LLM fallback for low-confidence fields in a single document."""
            keys = []
            for k, v in list(data_dict.items()):
                if k.endswith("_confidence"):
                    field_name = k.replace("_confidence", "")
                    conf = v
                    val = data_dict.get(field_name, "")
                    if conf < th and field_name != "confidence":
                        keys.append((field_name, str(val), float(conf)))
            
            # Fail-Fast: if >=3 fields are unreadable, the image is likely invalid or non-document.
            # Calling LLM for 3+ fields per doc costs too many API credits and time.
            if len(keys) >= 3:
                logger.warning(f"[{doc_type}] {len(keys)} low-conf fields. Skipping LLM disambiguation (fail-fast). Image may be low-quality or non-standard.")
                return

            tasks = [
                _run_selective_llm_disambiguation(
                    img_bytes, doc_type, field_name, val, conf, context_hint=hint
                )
                for field_name, val, conf in keys
            ]

            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for res in results:
                    if isinstance(res, Exception):
                        logger.warning(f"[{doc_type}] LLM disambiguation task failed: {res}")
                        continue
                    fname = res.get("field_name")
                    if fname:
                        data_dict[fname] = res["repaired_value"]
                        data_dict[fname + "_confidence"] = res["confidence"]

        # Run disambiguation for all 3 documents IN PARALLEL (not sequentially)
        disambig_tasks = []
        if rc_data:
            disambig_tasks.append(_disambiguate_doc(rc_data, "RC", rc_bytes, policy_hint.vehicle_number if policy_hint and hasattr(policy_hint, 'vehicle_number') else (policy_hint.rc_number if policy_hint else "")))
        if dl_data:
            disambig_tasks.append(_disambiguate_doc(dl_data, "DL", dl_bytes, ""))
        if form_data:
            disambig_tasks.append(_disambiguate_doc(form_data, "CLAIM_FORM", claim_form_bytes, ""))

        if disambig_tasks:
            await asyncio.gather(*disambig_tasks, return_exceptions=True)
            fallback_count += len(disambig_tasks)
    # Ensure required plate_number mapping
    if "plate_number" not in rc_data or not rc_data["plate_number"]:
        rc_data["plate_number"] = rc_data.get("rc_number", "Unreadable / Missing")

    # 4. Construct Final Structured Output with safe Pydantic parsing
    clean_rc = {k: v for k, v in rc_data.items() if k in ExtractedRCDocument.model_fields}
    clean_dl = {k: v for k, v in dl_data.items() if k in ExtractedDLDocument.model_fields}
    clean_form = {k: v for k, v in form_data.items() if k in ExtractedClaimFormDocument.model_fields}

    return RawExtractedDocuments(
        rc=ExtractedRCDocument(**clean_rc),
        dl=ExtractedDLDocument(**clean_dl),
        claim_form=ExtractedClaimFormDocument(**clean_form),
        fallback_invocations_count=fallback_count,
    )
