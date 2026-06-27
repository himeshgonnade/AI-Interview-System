"""
routes/auth.py — User authentication endpoints.

Handles user registration, login (JWT), and profile retrieval.
Passwords are hashed with bcrypt directly (passlib 1.7.4 is incompatible
with bcrypt >= 4.0, so we use the bcrypt library directly).
Tokens are signed JWTs via python-jose.
"""

import uuid
import bcrypt
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from db.mongo import get_db
from models.schemas import UserCreate, UserLogin, UserResponse, Token
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

# ── Security primitives ─────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


# ── Helpers ─────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db=Depends(get_db),
) -> dict:
    """FastAPI dependency — returns the authenticated user doc, or raises 401."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    payload = _decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")
    user = await db["users"].find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user


# ── POST /api/auth/register ─────────────────────────────────

@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register(body: UserCreate):
    """Create a new user account and return a JWT token."""
    db = get_db()

    # Check for duplicate email
    existing = await db["users"].find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    user_doc = {
        "_id": user_id,
        "name": body.name.strip(),
        "email": body.email.lower().strip(),
        "password_hash": _hash_password(body.password),
        "created_at": now,
    }

    await db["users"].insert_one(user_doc)
    logger.info(f"New user registered: {user_doc['email']} ({user_id})")

    token = _create_access_token({"sub": user_id})
    return Token(
        access_token=token,
        user=UserResponse(
            user_id=user_id,
            name=user_doc["name"],
            email=user_doc["email"],
            created_at=now,
        ),
    )


# ── POST /api/auth/login ────────────────────────────────────

@router.post(
    "/login",
    response_model=Token,
    summary="Login and get JWT token",
)
async def login(body: UserLogin):
    """Authenticate with email + password and return a JWT token."""
    db = get_db()

    user = await db["users"].find_one({"email": body.email.lower().strip()})
    if not user or not _verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = _create_access_token({"sub": user["_id"]})
    logger.info(f"User logged in: {user['email']}")

    return Token(
        access_token=token,
        user=UserResponse(
            user_id=user["_id"],
            name=user["name"],
            email=user["email"],
            created_at=user["created_at"],
        ),
    )


# ── GET /api/auth/me ────────────────────────────────────────

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserResponse(
        user_id=current_user["_id"],
        name=current_user["name"],
        email=current_user["email"],
        created_at=current_user["created_at"],
    )
