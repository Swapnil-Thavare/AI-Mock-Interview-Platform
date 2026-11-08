"""Shared Supabase Storage integration.

Holds the single Supabase service-role client used by all storage-backed
features (resume PDFs, per-answer interview recordings). Buckets stay
private; callers pass bucket-relative object keys, never client filenames.
"""
import os
from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings
from app.exception import CustomException

MEDIA_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads",
    "interview_media",
)


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def supabase_configured() -> bool:
    settings = get_settings()
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)


def upload_media_file(storage_key: str, content: bytes, content_type: str) -> str:
    """Store an interview recording and return its bucket-relative storage key.

    Supabase Storage is used whenever it is configured. When it is not, local
    development falls back to uploads/interview_media on disk; production
    refuses to silently degrade and returns 503 instead.
    """
    settings = get_settings()
    if not supabase_configured():
        if settings.ENVIRONMENT.lower() == "production":
            raise CustomException(503, "Interview media storage is not configured.")
        local_path = os.path.join(MEDIA_UPLOAD_DIR, storage_key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(content)
        return storage_key
    try:
        get_supabase_client().storage.from_(settings.SUPABASE_MEDIA_BUCKET).upload(
            path=storage_key,
            file=content,
            # Upsert is safe here: storage keys are server-generated per
            # answer (interviews/{user}/{interview}/{answer}/{uuid}), so a
            # retry can only overwrite that same answer's recording.
            file_options={"content-type": content_type, "x-upsert": "true"},
        )
    except CustomException:
        raise
    except Exception as exc:
        raise CustomException(502, f"Media storage upload failed: {type(exc).__name__}") from exc
    return storage_key


def download_media_file(storage_key: str) -> bytes:
    """Read back a previously uploaded recording for server-side reprocessing.

    Used when a recording reached storage but transcription/evaluation did
    not complete — the candidate can retry without re-recording. Raises 503
    in production when Supabase is not configured, matching upload behavior.
    """
    settings = get_settings()
    if not supabase_configured():
        if settings.ENVIRONMENT.lower() == "production":
            raise CustomException(
                503, "Interview media storage is not configured."
            )
        local_path = os.path.join(MEDIA_UPLOAD_DIR, storage_key)
        try:
            with open(local_path, "rb") as f:
                return f.read()
        except OSError as exc:
            raise CustomException(502, "Stored recording is unavailable") from exc
    try:
        return get_supabase_client().storage.from_(
            settings.SUPABASE_MEDIA_BUCKET
        ).download(storage_key)
    except Exception as exc:
        raise CustomException(
            502, f"Stored recording download failed: {type(exc).__name__}"
        ) from exc
