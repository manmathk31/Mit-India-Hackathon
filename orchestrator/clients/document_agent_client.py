import json
from typing import Any, Dict, Optional, Tuple
import httpx

from ..config import settings
from ..logger import logger


class DocumentAgentClientError(Exception):
    """Exception raised when document verification client fails."""
    pass


async def call_document_agent(
    rc_bytes: bytes,
    dl_bytes: bytes,
    claim_form_bytes: bytes,
    policy_record: Dict[str, Any],
    claim_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Calls the live Document Verification Agent at DOCUMENT_AGENT_URL/documents/verify.
    Sends multipart/form-data payload with image bytes and JSON policy record.
    """
    url = f"{settings.DOCUMENT_AGENT_URL.rstrip('/')}/documents/verify"
    timeout = getattr(settings, "DOCUMENT_AGENT_TIMEOUT_SECONDS", 45.0)
    retries = getattr(settings, "CLIENT_RETRIES", 0)

    files = [
        ("rc_image", ("rc_document.jpg", rc_bytes, "image/jpeg")),
        ("dl_image", ("dl_document.jpg", dl_bytes, "image/jpeg")),
        ("claim_form_image", ("claim_form.jpg", claim_form_bytes, "image/jpeg")),
    ]

    data = {
        "policy_record": json.dumps(policy_record),
        "claim_id": claim_id or policy_record.get("claim_id", "UNKNOWN"),
    }

    logger.info(f"Calling Document Agent at {url} (timeout={timeout}s) for claim '{data['claim_id']}'")

    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, files=files, data=data)
                
                if response.status_code == 200:
                    return response.json()
                
                error_body = response.text
                logger.warning(
                    f"Document Agent returned HTTP {response.status_code} on attempt {attempt+1}: {error_body}"
                )
                if response.status_code == 422:
                    raise DocumentAgentClientError(f"Document Agent validation error (422): {error_body}")
                if attempt == retries:
                    raise DocumentAgentClientError(f"Document Agent returned HTTP {response.status_code}: {error_body}")

        except httpx.TimeoutException as e:
            logger.warning(f"Document Agent call timed out after {timeout}s (Attempt {attempt+1}/{retries+1})")
            if attempt == retries:
                raise DocumentAgentClientError(f"Document Agent timed out after {timeout}s: {str(e)}")
        except httpx.RequestError as e:
            logger.warning(f"Network error connecting to Document Agent: {str(e)}")
            if attempt == retries:
                raise DocumentAgentClientError(f"Could not connect to Document Agent at {url}: {str(e)}")

    raise DocumentAgentClientError(f"Document Agent call failed after {retries+1} attempts.")
