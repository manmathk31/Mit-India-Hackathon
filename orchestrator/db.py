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
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.types import CHAR, TypeDecorator

from .config import settings
from .logger import logger

# Base Model
Base = declarative_base()


class GUID(TypeDecorator):
    """
    Platform-independent GUID/UUID type.
    Uses PostgreSQL's native UUID type, otherwise uses CHAR(36) on SQLite.
    Automatically handles str <-> uuid.UUID conversions.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            if isinstance(value, uuid.UUID):
                return value
            try:
                return uuid.UUID(str(value))
            except (ValueError, TypeError):
                return value
        else:
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return str(value)


# ------------------------------------------------------------------------------
# 1. ORM DATABASE MODELS
# ------------------------------------------------------------------------------

class User(Base):
    """High-Throughput custom user account model."""
    __tablename__ = "users"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
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

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
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

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    claim_number = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    policy_id = Column(GUID, ForeignKey("policies.id", ondelete="SET NULL"), nullable=True)
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

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    claim_id = Column(GUID, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    slot_label = Column(String(50), nullable=False)
    storage_url = Column(Text, nullable=False)
    image_hash = Column(String(64), nullable=True)
    is_flagged = Column(Boolean, default=False)

    claim = relationship("Claim", back_populates="photos")


class ClaimDetectedPart(Base):
    __tablename__ = "claim_detected_parts"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    claim_id = Column(GUID, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    part_name = Column(String(100), nullable=False)
    material_type = Column(String(30), nullable=False)
    severity = Column(String(20), nullable=False)
    repair_or_replace = Column(String(20), nullable=False)
    confidence = Column(Float, nullable=False)
    bounding_box = Column(JSON, nullable=False)

    claim = relationship("Claim", back_populates="detected_parts")


class ClaimFraudCheck(Base):
    __tablename__ = "claim_fraud_checks"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    claim_id = Column(GUID, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    check_name = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False)
    detail = Column(Text, nullable=False)

    claim = relationship("Claim", back_populates="fraud_checks")


class ClaimDecisionTrail(Base):
    __tablename__ = "claim_decision_trails"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    claim_id = Column(GUID, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    step_name = Column(String(100), nullable=False)
    outcome = Column(String(100), nullable=False)
    detail = Column(Text, nullable=False)
    status = Column(String(20), nullable=False)
    timestamp = Column(String(50), nullable=False)

    claim = relationship("Claim", back_populates="decision_trails")


class ClaimAdminOverride(Base):
    __tablename__ = "claim_admin_overrides"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    claim_id = Column(GUID, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)
    admin_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
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
    connect_args = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }
    if "supabase" in engine_url:
        connect_args["ssl"] = "require"
    engine = create_async_engine(
        engine_url,
        echo=False,
        pool_size=10,
        max_overflow=20,
        connect_args=connect_args,
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """Initializes database tables if they do not exist, and auto-migrates missing columns."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
            # Auto-migrate any columns that might be missing from prior table creations in PostgreSQL
            migrations = [
                "ALTER TABLE claims ADD COLUMN IF NOT EXISTS document_check_json JSONB;",
                "ALTER TABLE claims ADD COLUMN IF NOT EXISTS damage_assessment_json JSONB;",
                "ALTER TABLE claims ADD COLUMN IF NOT EXISTS cost_estimate_json JSONB;",
                "ALTER TABLE claims ADD COLUMN IF NOT EXISTS status_label VARCHAR(50) DEFAULT 'Under Review';",
                "ALTER TABLE claims ADD COLUMN IF NOT EXISTS status_description TEXT;",
                "ALTER TABLE claims ADD COLUMN IF NOT EXISTS overall_damage_severity VARCHAR(20);",
                "ALTER TABLE claims ADD COLUMN IF NOT EXISTS estimated_cost_low NUMERIC(12, 2);",
                "ALTER TABLE claims ADD COLUMN IF NOT EXISTS estimated_cost_high NUMERIC(12, 2);",
                "ALTER TABLE claims ADD COLUMN IF NOT EXISTS recommended_payout NUMERIC(12, 2);",
                "ALTER TABLE claims ADD COLUMN IF NOT EXISTS incident_location VARCHAR(200);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'claimant';",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_number VARCHAR(50);"
            ]
            for mig in migrations:
                try:
                    await conn.execute(text(mig))
                except Exception as ex:
                    # Ignore if sqlite or syntax variance
                    pass
        logger.info("Database schema initialized and columns auto-migrated successfully.")

        # Seed default Admin and Claimant accounts if missing
        await _seed_default_users()
    except Exception as e:
        logger.warning(f"Database table initialization warning (schema may already exist in Supabase): {str(e)}")


async def _seed_default_users():
    """Seeds default admin/surveyor and claimant accounts into database."""
    try:
        import bcrypt
        async with AsyncSessionLocal() as session:
            # Check Admin
            stmt = select(User).where(User.email == "admin@claimpilot.ai")
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                pw_hash = bcrypt.hashpw("adminpassword123".encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")
                admin_user = User(
                    email="admin@claimpilot.ai",
                    password_hash=pw_hash,
                    full_name="Chief Claims Officer / Surveyor",
                    role="admin",
                    badge_number="SURVEYOR-IN-8890",
                    avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
                )
                session.add(admin_user)
                logger.info("Seeded default Admin account: admin@claimpilot.ai")

            # Check Claimant
            stmt = select(User).where(User.email == "claimant@claimpilot.ai")
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                pw_hash = bcrypt.hashpw("claimantpassword123".encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")
                claimant_user = User(
                    email="claimant@claimpilot.ai",
                    password_hash=pw_hash,
                    full_name="Rajesh Anand Kumar",
                    role="claimant",
                    avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
                )
                session.add(claimant_user)
                logger.info("Seeded default Claimant account: claimant@claimpilot.ai")

            await session.commit()
    except Exception as e:
        logger.warning(f"Error seeding default accounts: {e}")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency provider yielding async SQLAlchemy session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
