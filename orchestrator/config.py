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

    # Database & Supabase Configuration
    DATABASE_URL: Optional[str] = "postgresql+asyncpg://postgres.yourproject:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    SUPABASE_URL: Optional[str] = "https://yourproject.supabase.co"
    SUPABASE_ANON_KEY: Optional[str] = ""
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = ""

    # AI Model Keys (Gemini Flash-Lite)
    GEMINI_API_KEY: Optional[str] = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"

    # JWT Authentication & Security
    JWT_SECRET_KEY: str = "claimpilot_super_secret_jwt_key_2026_change_in_prod"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Cost Agent Resilience: uses built-in estimator if external Spring AI endpoint is unreachable
    COST_AGENT_BUILTIN_ESTIMATOR: bool = True

    # Statutory & Adjudication Rules (IRDAI Regulations)
    IRDAI_MAX_AUTO_APPROVAL_LIMIT: float = 50000.0  # Mandatory ₹50,000 threshold for physical surveyor inspection

    # Timeouts and Client Resilience
    HTTP_TIMEOUT_SECONDS: float = 60.0
    CLIENT_RETRIES: int = 2

    model_config = SettingsConfigDict(
        env_file=[".env", "orchestrator/.env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
