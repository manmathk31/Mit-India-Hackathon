import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration settings for ClaimPilot Orchestrator and Decision Engine."""

    # Service Metadata
    SERVICE_NAME: str = "ClaimPilot Orchestrator & Decision Engine"
    SERVICE_VERSION: str = "1.0.0"
    LOG_LEVEL: str = "INFO"

    # Microservice Endpoints
    DOCUMENT_AGENT_URL: str = "http://localhost:8001"
    IMAGE_AGENT_URL: str = "http://localhost:8002"
    COST_AGENT_URL: str = "http://localhost:8080/api/cost/estimate"

    # Cost Agent Fallback: keeps pipeline fully functional if external Spring AI endpoint is in progress
    COST_AGENT_MOCK_FALLBACK: bool = True

    # Statutory & Adjudication Rules (IRDAI Regulations)
    IRDAI_MAX_AUTO_APPROVAL_LIMIT: float = 50000.0  # Mandatory ₹50,000 threshold for physical surveyor inspection

    # Timeouts and Client Resilience
    HTTP_TIMEOUT_SECONDS: float = 35.0
    CLIENT_RETRIES: int = 2

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
