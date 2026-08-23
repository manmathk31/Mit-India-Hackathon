import json
import time
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
    timeout = settings.HTTP_TIMEOUT_SECONDS
    cid = claim_id or policy_record.get("claim_id", "UNKNOWN")

    total_bytes = len(rc_bytes) + len(dl_bytes) + len(claim_form_bytes)
    files = [
        ("rc_image", ("rc_document.jpg", rc_bytes, "image/jpeg")),
        ("dl_image", ("dl_document.jpg", dl_bytes, "image/jpeg")),
        ("claim_form_image", ("claim_form.jpg", claim_form_bytes, "image/jpeg")),
    ]

    data = {
        "policy_record": json.dumps(policy_record),
        "claim_id": cid,
    }

    logger.info(
        f"[OUTBOUND -> Document Agent] Calling {url} | Claim: '{cid}' | Payload size: {total_bytes / 1024:.1f} KB "
        f"(RC: {len(rc_bytes)/1024:.1f}KB, DL: {len(dl_bytes)/1024:.1f}KB, Form: {len(claim_form_bytes)/1024:.1f}KB)"
    )

    t0 = time.time()
    for attempt in range(settings.CLIENT_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, files=files, data=data)
                duration_ms = int((time.time() - t0) * 1000)

                if response.status_code == 200:
                    result = response.json()
                    status = result.get("overall_status", "unknown")
                    conf = result.get("confidence_score", 0.0)
                    make = result.get("extracted_vehicle_meta", {}).get("make", "UNKNOWN")
                    model = result.get("extracted_vehicle_meta", {}).get("model", "UNKNOWN")
                    logger.info(
                        f"[INBOUND <- Document Agent] Success HTTP 200 in {duration_ms}ms | Claim: '{cid}' | "
                        f"Status: {status} (Conf: {conf:.2f}) | Vehicle: {make} {model}"
                    )
                    return result

                error_body = response.text
                logger.warning(
                    f"[INBOUND <- Document Agent] HTTP {response.status_code} in {duration_ms}ms (Attempt {attempt+1}): {error_body[:300]}"
                )
                if response.status_code == 422:
                    raise DocumentAgentClientError(f"Document Agent validation error (422): {error_body}")

        except httpx.TimeoutException as e:
            duration_ms = int((time.time() - t0) * 1000)
            logger.warning(f"[Document Agent] Request timed out after {duration_ms}ms (Attempt {attempt+1}): {e}")
            if attempt == settings.CLIENT_RETRIES:
                logger.exception(f"[Document Agent] All retries exhausted due to timeout for claim '{cid}'")
                raise DocumentAgentClientError(f"Document Agent timed out after {timeout}s: {str(e)}")
        except httpx.RequestError as e:
            duration_ms = int((time.time() - t0) * 1000)
            logger.warning(f"[Document Agent] Connection error to {url} after {duration_ms}ms (Attempt {attempt+1}): {e}")
            if attempt == settings.CLIENT_RETRIES:
                logger.exception(f"[Document Agent] Could not connect to {url} for claim '{cid}'")
                raise DocumentAgentClientError(f"Could not connect to Document Agent at {url}: {str(e)}")
        except Exception as e:
            logger.exception(f"[Document Agent] Unexpected error during call for claim '{cid}': {e}")
            raise

    raise DocumentAgentClientError(f"Document Agent call failed after {settings.CLIENT_RETRIES+1} attempts.")
