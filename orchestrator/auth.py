from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import User, get_db
from .logger import logger

# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ------------------------------------------------------------------------------
# 1. AUTH SCHEMAS
# ------------------------------------------------------------------------------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone_number: Optional[str] = None
    role: Optional[str] = "claimant"  # 'claimant' or 'admin'
    badge_number: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    phone_number: Optional[str] = None
    badge_number: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None


# ------------------------------------------------------------------------------
# 2. UTILITY FUNCTIONS
# ------------------------------------------------------------------------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


# ------------------------------------------------------------------------------
# 3. FASTAPI AUTH DEPENDENCIES
# ------------------------------------------------------------------------------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticates the Bearer token and returns the current user."""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user account")

    return user


async def require_admin_role(current_user: User = Depends(get_current_user)) -> User:
    """Strictly gates access to Insurance Surveyors and Admins."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Licensed Surveyor / Admin role required",
        )
    return current_user


# ------------------------------------------------------------------------------
# 4. AUTH ROUTES
# ------------------------------------------------------------------------------

@router.post("/signup", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Registers a new user without external rate limits."""
    # Check if email exists
    stmt = select(User).where(User.email == payload.email)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    # Hash password and create user
    hashed = get_password_hash(payload.password)
    user = User(
        email=payload.email,
        password_hash=hashed,
        full_name=payload.full_name,
        phone_number=payload.phone_number,
        role=payload.role or "claimant",
        badge_number=payload.badge_number,
        avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"New user registered: {user.email} (Role: {user.role})")

    token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role, "name": user.full_name}
    )

    return AuthTokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.full_name,
            "role": user.role,
            "badge_number": user.badge_number,
            "avatar": user.avatar_url,
        },
    )


@router.post("/login", response_model=AuthTokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticates credentials and returns JWT."""
    stmt = select(User).where(User.email == payload.email)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    logger.info(f"User logged in: {user.email} (Role: {user.role})")

    token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role, "name": user.full_name}
    )

    return AuthTokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.full_name,
            "role": user.role,
            "badge_number": user.badge_number,
            "avatar": user.avatar_url,
        },
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user profile."""
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        phone_number=current_user.phone_number,
        badge_number=current_user.badge_number,
        avatar_url=current_user.avatar_url,
        created_at=current_user.created_at,
    )
