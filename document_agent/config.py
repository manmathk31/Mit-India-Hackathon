import os
from typing import List, Literal, Optional
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Production Configuration settings for ClaimPilot Document Verification Agent."""

    # Mode & Environment
    MOCK_MODE: bool = False  # Production-first: live vision engine is default
    SERVICE_NAME: str = "ClaimPilot Document Verification Agent"
    SERVICE_VERSION: str = "2.0.0"
    LOG_LEVEL: str = "INFO"

    # File Upload & Pre-check Constraints
    MAX_FILE_SIZE_MB: int = 10
    MIN_IMAGE_DIMENSION_PX: int = 200
    ALLOWED_IMAGE_TYPES: List[str] = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/tiff",
        "image/bmp",
    ]

    # External Vision / LLM API Provider Configuration
    # Supported: "gemini" (Google Gemini 1.5/2.0 Flash) or "openai" (GPT-4o / GPT-4o-mini)
    VISION_PROVIDER: Literal["gemini", "openai", "custom"] = "gemini"
    
    # API Keys & URLs
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"  # Fast, cheap, high-accuracy multimodal
    
    OPENAI_API_KEY: str = ""
    OPENAI_API_URL: str = "https://api.openai.com/v1/chat/completions"
    OPENAI_MODEL: str = "gpt-4o-mini"
    
    # Timeouts & Retries
    REQUEST_TIMEOUT_SECONDS: float = 25.0
    MAX_RETRIES: int = 2

    # Tiered Selective LLM Fallback Thresholds
    # If initial OCR/vision field confidence is below this, selective LLM disambiguation is triggered
    OCR_CONFIDENCE_FALLBACK_THRESHOLD: float = 0.85

    # Verification & Matching Thresholds (Deterministic rapidfuzz)
    FUZZY_EXACT_THRESHOLD: float = 98.0
    FUZZY_MATCH_THRESHOLD: float = 80.0
    FUZZY_CROSS_DOC_SUSPICIOUS_THRESHOLD: float = 65.0

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def active_api_key(self) -> str:
        """Returns the appropriate API key based on the configured VISION_PROVIDER."""
        if self.VISION_PROVIDER == "gemini":
            return self.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
        return self.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

