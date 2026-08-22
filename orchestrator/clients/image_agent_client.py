import time
from typing import Any, Dict, List, Optional, Tuple
import httpx

from ..config import settings
from ..logger import logger


class ImageAgentClientError(Exception):
    """Exception raised when damage assessment image client fails."""
    pass


async def call_image_agent(
    damage_photos: List[Tuple[int, bytes]],
    claim_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Calls the live Image/Damage Assessment Agent at IMAGE_AGENT_URL/images/analyze.
    Sends multipart/form-data with 1 to N damage photos.
    """
    url = f"{settings.IMAGE_AGENT_URL.rstrip('/')}/images/analyze"
    timeout = settings.HTTP_TIMEOUT_SECONDS
    cid = claim_id or "UNKNOWN"

    total_bytes = sum(len(pb) for _, pb in damage_photos)
    files = [
        ("damage_photos", (f"damage_photo_{idx+1}.jpg", photo_bytes, "image/jpeg"))
        for idx, photo_bytes in damage_photos
    ]

    data = {
        "claim_id": cid,
    }

    logger.info(
        f"[OUTBOUND -> Image Agent] Calling {url} | Claim: '{cid}' | Photos: {len(files)} | "
        f"Payload size: {total_bytes / 1024:.1f} KB"
    )

    t0 = time.time()
    for attempt in range(settings.CLIENT_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, files=files, data=data)
                duration_ms = int((time.time() - t0) * 1000)

                if response.status_code == 200:
                    result = response.json()
                    dets = result.get("detections", [])
                    status = result.get("overall_damage_status", "none")
                    parts_summary = ", ".join(f"{d.get('part_name')}({d.get('severity')})" for d in dets[:5])
                    logger.info(
                        f"[INBOUND <- Image Agent] Success HTTP 200 in {duration_ms}ms | Claim: '{cid}' | "
                        f"Severity: {status} | Detections ({len(dets)}): [{parts_summary}]"
                    )
                    return result

                error_body = response.text
                logger.warning(
                    f"[INBOUND <- Image Agent] HTTP {response.status_code} in {duration_ms}ms (Attempt {attempt+1}): {error_body[:300]}"
                )
                if response.status_code == 422:
                    raise ImageAgentClientError(f"Image Agent validation error (422): {error_body}")

        except httpx.TimeoutException as e:
            duration_ms = int((time.time() - t0) * 1000)
            logger.warning(f"[Image Agent] Request timed out after {duration_ms}ms (Attempt {attempt+1}): {e}")
            if attempt == settings.CLIENT_RETRIES:
                logger.exception(f"[Image Agent] All retries exhausted due to timeout for claim '{cid}'")
                raise ImageAgentClientError(f"Image Agent timed out after {timeout}s: {str(e)}")
        except httpx.RequestError as e:
            duration_ms = int((time.time() - t0) * 1000)
            logger.warning(f"[Image Agent] Connection error to {url} after {duration_ms}ms (Attempt {attempt+1}): {e}")
            if attempt == settings.CLIENT_RETRIES:
                logger.exception(f"[Image Agent] Could not connect to {url} for claim '{cid}'")
                raise ImageAgentClientError(f"Could not connect to Image Agent at {url}: {str(e)}")
        except Exception as e:
            logger.exception(f"[Image Agent] Unexpected error during call for claim '{cid}': {e}")
            raise

    raise ImageAgentClientError(f"Image Agent call failed after {settings.CLIENT_RETRIES+1} attempts.")
