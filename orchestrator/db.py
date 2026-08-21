import os
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base, relationship

from .config import settings
from .logger import logger

# Base Model
Base = declarative_base()


# ------------------------------------------------------------------------------
# 1. ORM DATABASE MODELS
# ------------------------------------------------------------------------------

class User(Base):
    """High-Throughput custom user account model."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    phone_number = Column(String(20), nullable=True)
    role = Column(String(20), nullable=False, default="claimant")  # 'claimant' or 'admin'
    badge_number = Column(String(50), nullable=True)
    avatar_url = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    policies = relationship("Policy", back_populates="user", cascade="all, delete-orphan")
    claims = relationship("Claim", back_populates="user", cascade="all, delete-orphan")


class Policy(Base):
    """Insured vehicle policy contract model."""
    __tablename__ = "policies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    policy_number = Column(String(50), unique=True, nullable=False, index=True)
    holder_name = Column(String(150), nullable=False)
    plan_name = Column(String(100), nullable=False)
    start_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="Active")
    idv_amount = Column(Numeric(12, 2), nullable=False, default=550000.0)
    vehicle_make = Column(String(50), nullable=False)
    vehicle_model = Column(String(50), nullable=False)
    vehicle_variant = Column(String(50), nullable=False)
    vehicle_year = Column(Integer, nullable=False)
    rc_number = Column(String(20), nullable=False, index=True)
    chassis_number = Column(String(30), nullable=False)
    engine_number = Column(String(30), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="policies")
    claims = relationship("Claim", back_populates="policy")


class Claim(Base):
    """Core adjudicated claim record."""
    __tablename__ = "claims"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    claim_number = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    policy_id = Column(String(36), ForeignKey("policies.id", ondelete="SET NULL"), nullable=True)
    incident_date = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    incident_location = Column(String(200), nullable=True)
    incident_description = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="under_review")  # 'auto_approved', 'under_review', 'flagged'
    status_label = Column(String(50), nullable=False)
    status_description = Column(Text, nullable=True)
    overall_damage_severity = Column(String(20), nullable=True)
    estimated_cost_low = Column(Numeric(12, 2), nullable=True)
    estimated_cost_high = Column(Numeric(12, 2), nullable=True)
    recommended_payout = Column(Numeric(12, 2), nullable=True)
    
    # Store complete JSON snapshots for rapid frontend hydration
    document_check_json = Column(JSON, nullable=True)
    damage_assessment_json = Column(JSON, nullable=True)
    cost_estimate_json = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="claims")
    policy = relationship("Policy", back_populates="claims")
    photos = relationship("ClaimPhoto", back_populates="claim", cascade="all, delete-orphan")
    detected_parts = relationship("ClaimDetectedPart", back_populates="claim", cascade="all, delete-orphan")
    fraud_checks = relationship("ClaimFraudCheck", back_populates="claim", cascade="all, delete-orphan")
    decision_trails = relationship("ClaimDecisionTrail", back_populates="claim", cascade="all, delete-orphan")
    admin_overrides = relationship("ClaimAdminOverride", back_populates="claim", cascade="all, delete-orphan")


class ClaimPhoto(Base):
    __tablename__ = "claim_photos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    claim_id = Column(String(36), ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    slot_label = Column(String(50), nullable=False)
    storage_url = Column(Text, nullable=False)
    image_hash = Column(String(64), nullable=True)
    is_flagged = Column(Boolean, default=False)

    claim = relationship("Claim", back_populates="photos")


class ClaimDetectedPart(Base):
    __tablename__ = "claim_detected_parts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    claim_id = Column(String(36), ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    part_name = Column(String(100), nullable=False)
    material_type = Column(String(30), nullable=False)
    severity = Column(String(20), nullable=False)
    repair_or_replace = Column(String(20), nullable=False)
    confidence = Column(Float, nullable=False)
    bounding_box = Column(JSON, nullable=False)

    claim = relationship("Claim", back_populates="detected_parts")


class ClaimFraudCheck(Base):
    __tablename__ = "claim_fraud_checks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    claim_id = Column(String(36), ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    check_name = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False)
    detail = Column(Text, nullable=False)

    claim = relationship("Claim", back_populates="fraud_checks")


class ClaimDecisionTrail(Base):
    __tablename__ = "claim_decision_trails"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    claim_id = Column(String(36), ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    step_name = Column(String(100), nullable=False)
    outcome = Column(String(100), nullable=False)
    detail = Column(Text, nullable=False)
    status = Column(String(20), nullable=False)
    timestamp = Column(String(50), nullable=False)

    claim = relationship("Claim", back_populates="decision_trails")


class ClaimAdminOverride(Base):
    __tablename__ = "claim_admin_overrides"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    claim_id = Column(String(36), ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    admin_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    original_status = Column(String(30), nullable=False)
    override_status = Column(String(30), nullable=False)
    review_note = Column(Text, nullable=False)
    settlement_adjusted_amount = Column(Numeric(12, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    claim = relationship("Claim", back_populates="admin_overrides")


# ------------------------------------------------------------------------------
# 2. ASYNC DATABASE ENGINE & SESSION FACTORY
# ------------------------------------------------------------------------------

def get_engine_url() -> str:
    url = settings.DATABASE_URL or ""
    # Convert standard postgresql:// to asyncpg postgresql+asyncpg://
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


# Engine initialization with fallback to in-memory sqlite if url is empty
engine_url = get_engine_url()
if not engine_url or "yourproject" in engine_url:
    logger.warning("No valid DATABASE_URL provided. Defaulting to local SQLite for development.")
    engine = create_async_engine("sqlite+aiosqlite:///./claimpilot.db", echo=False)
else:
    engine = create_async_engine(engine_url, echo=False, pool_size=10, max_overflow=20)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """Initializes database tables if they do not exist."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema initialized successfully.")
    except Exception as e:
        logger.warning(f"Database table initialization warning (schema may already exist in Supabase): {str(e)}")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI async session dependency."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
