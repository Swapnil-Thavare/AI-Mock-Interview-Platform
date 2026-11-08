from functools import lru_cache
from typing import List

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    PROJECT_NAME: str = "IntelliInterview API"
    CORS_ORIGINS: str = "http://localhost:8080"
    DATABASE_URL: str = ""
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # AI Provider
    AI_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GEMINI_TIMEOUT: int = 60
    MAX_FOLLOW_UP_QUESTIONS: int = 3

    # Supabase Storage (resume files)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "resumes"

    # Interview media (separate private bucket, per-answer recordings).
    # Capped at 14 MB: Gemini inline transcription payloads are base64
    # encoded (~33% overhead), so 14 MB of media ≈ an 18.7 MB request —
    # safely under the provider's 20 MB inline request ceiling.
    SUPABASE_MEDIA_BUCKET: str = "interview-media"
    INTERVIEW_MEDIA_MAX_MB: int = 14

    # Transcription provider (voice-first AUDIO/VIDEO answers)
    TRANSCRIPTION_PROVIDER: str = "gemini"
    TRANSCRIPTION_TIMEOUT: int = 90

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def _require_strong_jwt_secret_in_production(self):
        """Fail closed in production: an empty or default JWT secret makes
        every issued token forgeable. Development keeps the convenience
        default so local setup keeps working."""
        if self.ENVIRONMENT.lower() == "production" and (
            not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY == "change-me"
        ):
            raise ValueError(
                "JWT_SECRET_KEY must be set to a strong secret when "
                "ENVIRONMENT=production"
            )
        return self

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
