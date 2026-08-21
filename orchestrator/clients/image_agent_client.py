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

    files = [
        ("damage_photos", (f"damage_photo_{idx+1}.jpg", photo_bytes, "image/jpeg"))
        for idx, photo_bytes in damage_photos
    ]

    data = {
        "claim_id": claim_id or "UNKNOWN",
    }

    logger.info(f"Calling Image Agent at {url} with {len(files)} photos for claim '{data['claim_id']}'")

    for attempt in range(settings.CLIENT_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, files=files, data=data)

                if response.status_code == 200:
                    return response.json()

                error_body = response.text
                logger.warning(
                    f"Image Agent returned HTTP {response.status_code} on attempt {attempt+1}: {error_body}"
                )
                if response.status_code == 422:
                    raise ImageAgentClientError(f"Image Agent validation error (422): {error_body}")

        except httpx.TimeoutException as e:
            logger.warning(f"Image Agent call timed out after {timeout}s (Attempt {attempt+1})")
            if attempt == settings.CLIENT_RETRIES:
                raise ImageAgentClientError(f"Image Agent timed out after {timeout}s: {str(e)}")
        except httpx.RequestError as e:
            logger.warning(f"Network error connecting to Image Agent: {str(e)}")
            if attempt == settings.CLIENT_RETRIES:
                raise ImageAgentClientError(f"Could not connect to Image Agent at {url}: {str(e)}")

    raise ImageAgentClientError(f"Image Agent call failed after {settings.CLIENT_RETRIES+1} attempts.")
