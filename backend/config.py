"""
Configuration management for AI Interview Simulator.

All secrets are loaded from environment variables ONLY.
For local dev: create a .env file (see .env.example).
For production: set env vars directly in Render / Vercel dashboards.

⚠️  NEVER hardcode secrets here. NEVER commit .env to git.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from functools import lru_cache
from typing import List
import os


class Settings(BaseSettings):
    # ── LLM ────────────────────────────────────────────
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"  # Override via GROQ_MODEL env var
    max_questions_per_hour: int = 100             # Soft rate-limit awareness

    # ── Database ────────────────────────────────────────
    mongodb_uri: str = ""
    database_name: str = "ai_interview"

    # ── App ─────────────────────────────────────────────
    secret_key: str = "change-this-in-production"
    environment: str = "development"

    # ── CORS ────────────────────────────────────────────
    # Comma-separated allowed origins (set in Render dashboard for prod)
    # Example prod value: "https://your-app.vercel.app"
    frontend_url: str = "http://localhost:5173"

    # ── Derived ──────────────────────────────────────────
    @property
    def allowed_origins(self) -> List[str]:
        """Always include localhost for dev; add production URL for prod."""
        origins = [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:3000",
        ]
        if self.frontend_url and self.frontend_url not in origins:
            origins.append(self.frontend_url)
        return origins

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    # ── Startup Validation ───────────────────────────────
    @model_validator(mode="after")
    def validate_required_secrets(self) -> "Settings":
        """
        Fail fast at startup if required secrets are missing.
        This prevents silent failures in production.
        """
        errors = []

        if not self.groq_api_key:
            errors.append(
                "GROQ_API_KEY is not set. "
                "Get a free key at https://console.groq.com"
            )

        if not self.mongodb_uri:
            errors.append(
                "MONGODB_URI is not set. "
                "Get a free cluster at https://mongodb.com/atlas"
            )

        if self.is_production and self.secret_key == "change-this-in-production":
            errors.append(
                "SECRET_KEY must be changed for production. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )

        if errors:
            error_msg = "\n".join(f"  ❌ {e}" for e in errors)
            raise ValueError(
                f"\n\n🚨 Missing required environment variables:\n{error_msg}\n\n"
                f"  → For local dev: copy .env.example to .env and fill in values\n"
                f"  → For Render/Vercel: set these in the dashboard Environment Variables\n"
            )

        return self

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        # Allow extra fields to avoid errors from platform-injected vars
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """
    Cached settings singleton.
    On production platforms (Render, Vercel), env vars are injected
    automatically — no .env file needed.
    """
    return Settings()
