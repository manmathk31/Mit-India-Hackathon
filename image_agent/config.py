import os
from typing import List, Literal, Optional
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Production Configuration settings for ClaimPilot Image/Damage Assessment Agent."""

    # Environment
    SERVICE_NAME: str = "ClaimPilot Image Damage Assessment Agent"
    SERVICE_VERSION: str = "1.0.0"
    LOG_LEVEL: str = "INFO"

    # Image Upload & Validation Limits
    MAX_FILE_SIZE_MB: int = 10
    MAX_IMAGE_COUNT: int = 8
    MIN_IMAGE_DIMENSION_PX: int = 200
    ALLOWED_IMAGE_TYPES: List[str] = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/tiff",
        "image/bmp",
    ]

    # Detection Engine: "custom" (Local Custom YOLO/ONNX model) with "gemini" as fallback
    DETECTION_ENGINE: Literal["custom", "gemini"] = "custom"
    CUSTOM_MODEL_PATH: str = "models/damage_yolo.onnx"
    CUSTOM_MODEL_CONFIDENCE_THRESHOLD: float = 0.65  # If custom model detection confidence < 0.65, triggers Gemini

    # Google Gemini Configuration (Pure Gemini fallback)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"

    # Timeouts & Rate-Limit Resilience
    REQUEST_TIMEOUT_SECONDS: float = 25.0
    MAX_RETRIES: int = 3
    RATE_LIMIT_BACKOFF_FACTOR: float = 2.0
    MAX_CONCURRENT_CALLS: int = 5

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def active_api_key(self) -> str:
        return self.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")

    model_config = SettingsConfigDict(
        env_file=[".env", "image_agent/.env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
