import time
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .extractor import (
    ImageExtractionError,
    InvalidPhotoError,
    VisionAPIError,
    VisionTimeoutError,
    extract_damage_assessment,
)
from .logger import logger
from .schemas import DamageAssessmentResponse, ErrorDetail

app = FastAPI(
    title="ClaimPilot AI - Image Damage Assessment Agent",
    description="Microservice for multi-image vehicle damage detection, part classification, material mapping, and severity assessment.",
    version=settings.SERVICE_VERSION,
)

# CORS middleware for internal orchestrator / web gateway access
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
        f"[Engine={settings.DETECTION_ENGINE}, Model={settings.GEMINI_MODEL}]"
    )


@app.get("/health", tags=["System"])
async def health_check():
    """Liveness probe for orchestrator and load balancers."""
    api_key = settings.active_api_key
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "engine": settings.DETECTION_ENGINE,
        "gemini_key_configured": bool(api_key),
        "gemini_key_missing": not bool(api_key),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def _read_and_validate_photo(file: UploadFile, index: int) -> bytes:
    """Validates individual uploaded photo MIME type and size limit."""
    content_type = (file.content_type or "").lower()
    if content_type not in settings.ALLOWED_IMAGE_TYPES and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Photo #{index+1} ('{file.filename}') is not a valid image format. Received MIME: '{content_type}'",
        )

    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Photo #{index+1} ('{file.filename}') exceeds max allowed size of {settings.MAX_FILE_SIZE_MB}MB (Actual size: {len(content)/(1024*1024):.2f}MB)",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Photo #{index+1} ('{file.filename}') is empty (0 bytes).",
        )

    return content


@app.post(
    "/images/analyze",
    response_model=DamageAssessmentResponse,
    status_code=status.HTTP_200_OK,
    tags=["Assessment"],
    summary="Analyze 1 to N damage photos for vehicle damage, parts, materials, and severity",
)
async def analyze_damage_images(
    damage_photos: List[UploadFile] = File(
        ...,
        description="Multipart array of 1 to 8 damage photos of the vehicle",
    ),
    claim_id: Optional[str] = Form(None, description="Optional claim reference ID for tracking"),
):
    """
    Production endpoint for vehicle damage assessment.
    Detects damaged vehicle parts, assigns material classifications, measures severity, and determines repair/replace actions.
    """
    start_time = time.time()
    tracking_claim_id = claim_id or "UNKNOWN"

    if not damage_photos or len(damage_photos) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No damage photos provided. Upload at least 1 image in 'damage_photos'.",
        )

    if len(damage_photos) > settings.MAX_IMAGE_COUNT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Too many photos uploaded ({len(damage_photos)}). Maximum allowed is {settings.MAX_IMAGE_COUNT}.",
        )

    # 1. Read and validate incoming file buffers
    photo_buffers = []
    for idx, photo_file in enumerate(damage_photos):
        p_bytes = await _read_and_validate_photo(photo_file, idx)
        photo_buffers.append((idx, p_bytes))

    logger.info(
        f"Processing damage assessment request for claim '{tracking_claim_id}'. "
        f"Photos count: {len(photo_buffers)}"
    )

    # 2. Damage Extraction Phase
    try:
        assessment_response = await extract_damage_assessment(photo_buffers)
    except InvalidPhotoError as e:
        logger.warning(f"Photo validation failed for claim '{tracking_claim_id}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except VisionTimeoutError as e:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Vision API timeout after {duration_ms}ms for claim '{tracking_claim_id}': {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content=ErrorDetail(
                error="vision_timeout",
                detail=str(e),
                claim_id=tracking_claim_id,
                timestamp=datetime.now(timezone.utc).isoformat(),
            ).model_dump(),
        )
    except VisionAPIError as e:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Vision API failure for claim '{tracking_claim_id}': {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=ErrorDetail(
                error="vision_analysis_failed",
                detail=str(e),
                claim_id=tracking_claim_id,
                timestamp=datetime.now(timezone.utc).isoformat(),
            ).model_dump(),
        )
    except Exception as e:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Unexpected error in damage assessment for claim '{tracking_claim_id}': {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorDetail(
                error="internal_error",
                detail="An unexpected error occurred during damage image assessment.",
                claim_id=tracking_claim_id,
                timestamp=datetime.now(timezone.utc).isoformat(),
            ).model_dump(),
        )

    # 3. Structured completion metrics logging
    duration_ms = round((time.time() - start_time) * 1000, 2)
    logger.info(
        f"Damage assessment completed for claim '{tracking_claim_id}' in {duration_ms}ms. "
        f"Photos: {assessment_response.photos_analyzed}, Detections: {len(assessment_response.detections)}, "
        f"Overall Status: {assessment_response.overall_damage_status}"
    )

    return assessment_response
