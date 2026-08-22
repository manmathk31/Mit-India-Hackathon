import json
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .config import settings
from .extractor import (
    ExtractionAPIError,
    ExtractionTimeoutError,
    InvalidImageContentError,
    extract_documents,
    validate_single_document,
)
from .logger import logger
from .schemas import (
    DocumentVerificationResponse,
    ErrorDetail,
    PolicyRecord,
)
from .verifier import verify_documents

app = FastAPI(
    title="ClaimPilot AI - Document Verification Agent",
    description="Production microservice for extracting, disambiguating, and cross-verifying RC, Driving Licence, and Claim Form documents with fraud detection.",
    version=settings.SERVICE_VERSION,
)

# Enable CORS for internal orchestrator / gateway access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    logger.info(
        f"Starting {settings.SERVICE_NAME} v{settings.SERVICE_VERSION} "
        f"[Provider={settings.VISION_PROVIDER}, Model={settings.GEMINI_MODEL if settings.VISION_PROVIDER == 'gemini' else 'N/A'}]"
    )


@app.get("/health", tags=["System"])
async def health_check():
    """Liveness & readiness probe for load balancers and orchestrator health checks."""
    api_key = settings.active_api_key
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "provider": settings.VISION_PROVIDER,
        "gemini_key_configured": bool(api_key),
        "gemini_key_missing": not bool(api_key),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def _read_and_validate_file(file: UploadFile, field_name: str) -> bytes:
    """
    Validates uploaded file MIME type and size limit before loading into memory.
    Raises HTTPException(422) on invalid input.
    """
    # 1. Content-Type validation
    content_type = (file.content_type or "").lower()
    if content_type not in settings.ALLOWED_IMAGE_TYPES and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Field '{field_name}' must be a valid image (JPEG/PNG/WebP). Received content-type: '{content_type}'",
        )

    # 2. File size validation
    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File '{field_name}' exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB (Actual size: {len(content) / (1024*1024):.2f}MB)",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Uploaded file for '{field_name}' is empty (0 bytes).",
        )

    return content


def _parse_policy_record(
    policy_record_raw: Optional[str] = None,
    owner_name: Optional[str] = None,
    rc_number: Optional[str] = None,
    chassis_number: Optional[str] = None,
    claim_id: Optional[str] = None,
    vehicle_type: Optional[str] = None,
) -> PolicyRecord:
    """Parses policy_record from JSON string or explicit fallback fields."""
    if policy_record_raw and policy_record_raw.strip():
        try:
            parsed = json.loads(policy_record_raw)
            if not isinstance(parsed, dict):
                raise ValueError("policy_record JSON must be an object/dictionary")
            return PolicyRecord(**parsed)
        except (json.JSONDecodeError, ValidationError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid 'policy_record' JSON payload: {str(e)}",
            )

    # Fallback to individual form fields if policy_record JSON string wasn't sent
    if owner_name and rc_number and chassis_number:
        return PolicyRecord(
            owner_name=owner_name,
            rc_number=rc_number,
            chassis_number=chassis_number,
            claim_id=claim_id,
            vehicle_type=vehicle_type or "LMV",
        )

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Missing policy record. Provide 'policy_record' as a JSON string containing {owner_name, rc_number, chassis_number}.",
    )


@app.post(
    "/documents/verify",
    response_model=DocumentVerificationResponse,
    status_code=status.HTTP_200_OK,
    tags=["Verification"],
    summary="Extract, disambiguate, and cross-verify claim documents against policy record",
)
async def verify_claim_documents(
    rc_image: UploadFile = File(..., description="Image of Vehicle Registration Certificate (RC)"),
    dl_image: UploadFile = File(..., description="Image of Driver Driving Licence (DL)"),
    claim_form_image: UploadFile = File(..., description="Image of Claim Intimation Form"),
    policy_record: Optional[str] = Form(
        None,
        description="JSON string containing authoritative policy record: {owner_name, rc_number, chassis_number, claim_id?}",
    ),
    # Optional form fields for direct multipart convenience
    owner_name: Optional[str] = Form(None),
    rc_number: Optional[str] = Form(None),
    chassis_number: Optional[str] = Form(None),
    claim_id: Optional[str] = Form(None),
    vehicle_type: Optional[str] = Form(None),
):
    """
    Production document verification endpoint.
    Performs quality checks, multimodal extraction, selective LLM disambiguation for low-confidence fields,
    and cross-document fraud reconciliation.
    """
    start_time = time.time()

    # 1. Parse policy record
    policy = _parse_policy_record(
        policy_record_raw=policy_record,
        owner_name=owner_name,
        rc_number=rc_number,
        chassis_number=chassis_number,
        claim_id=claim_id,
        vehicle_type=vehicle_type,
    )
    tracking_claim_id = policy.claim_id or claim_id or "UNKNOWN"

    # 2. Read and validate incoming file uploads
    rc_bytes = await _read_and_validate_file(rc_image, "rc_image")
    dl_bytes = await _read_and_validate_file(dl_image, "dl_image")
    claim_form_bytes = await _read_and_validate_file(claim_form_image, "claim_form_image")

    logger.info(
        f"Processing document verification request for claim '{tracking_claim_id}'. "
        f"RC: {len(rc_bytes)}B, DL: {len(dl_bytes)}B, Form: {len(claim_form_bytes)}B"
    )

    # 3. Multimodal Extraction & Selective LLM Disambiguation
    try:
        raw_documents = await extract_documents(
            rc_bytes=rc_bytes,
            dl_bytes=dl_bytes,
            claim_form_bytes=claim_form_bytes,
            policy_hint=policy,
        )
    except InvalidImageContentError as e:
        logger.warning(f"Image validation/quality check failed for claim '{tracking_claim_id}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except ExtractionTimeoutError as e:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Vision API timeout after {duration_ms}ms for claim '{tracking_claim_id}': {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content=ErrorDetail(
                error="extraction_timeout",
                detail=str(e),
                claim_id=tracking_claim_id,
                timestamp=datetime.now(timezone.utc).isoformat(),
            ).model_dump(),
        )
    except ExtractionAPIError as e:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Vision API extraction failure for claim '{tracking_claim_id}': {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=ErrorDetail(
                error="extraction_failed",
                detail=str(e),
                claim_id=tracking_claim_id,
                timestamp=datetime.now(timezone.utc).isoformat(),
            ).model_dump(),
        )
    except Exception as e:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Unexpected extraction error for claim '{tracking_claim_id}': {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorDetail(
                error="internal_error",
                detail="An unexpected error occurred during document processing.",
                claim_id=tracking_claim_id,
                timestamp=datetime.now(timezone.utc).isoformat(),
            ).model_dump(),
        )

    # 4. Deterministic cross-verification and fraud reconciliation
    try:
        response_data = verify_documents(
            extracted=raw_documents,
            policy=policy,
        )
    except Exception as e:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Verification rule error for claim '{tracking_claim_id}': {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorDetail(
                error="verification_failed",
                detail=f"Verification logic error: {str(e)}",
                claim_id=tracking_claim_id,
                timestamp=datetime.now(timezone.utc).isoformat(),
            ).model_dump(),
        )

    # 5. Structured completion logging
    duration_ms = round((time.time() - start_time) * 1000, 2)
    logger.info(
        f"Document verification completed for claim '{tracking_claim_id}' in {duration_ms}ms. "
        f"Overall Status: {response_data.overall_status}, Confidence: {response_data.confidence_score}, "
        f"Selective LLM Fallbacks: {raw_documents.fallback_invocations_count}"
    )

    return response_data


@app.post(
    "/documents/validate-single",
    tags=["Validation"],
    summary="Lightweight single-document pre-validation on upload",
)
async def validate_single_upload(
    file: UploadFile = File(..., description="Uploaded document image file"),
    expected_type: str = Form(..., description="Expected document type: rc | dl | claim_form"),
):
    """
    Instantly validates whether the uploaded file appears to be the expected document type (RC, DL, or Claim Form).
    Rejects wrong document types (e.g. uploading DL in RC slot or arbitrary selfie/damage photos) before submission.
    """
    try:
        image_bytes = await _read_and_validate_file(file, f"upload_{expected_type}")
        result = await validate_single_document(image_bytes, expected_type)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Error during single document pre-validation: {e}")
        return {
            "valid": False,
            "expected_type": expected_type,
            "detected_type": "UNKNOWN",
            "reason": f"Could not validate document: {str(e)}",
        }
