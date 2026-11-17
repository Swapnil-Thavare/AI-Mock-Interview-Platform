"""Shared Supabase Storage integration.

Holds the single Supabase service-role client used by all storage-backed
features (resume PDFs, per-answer interview recordings). Buckets stay
private; callers pass bucket-relative object keys, never client filenames.

Every environment — development and production — stores files in Supabase
Storage. Each environment points at its own Supabase project through
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, with the bucket names selected
by SUPABASE_STORAGE_BUCKET (resumes) and SUPABASE_MEDIA_BUCKET
(interview media). There is no filesystem fallback: missing configuration
fails fast instead of writing files to an unexpected location.
"""
from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings
from app.exception import CustomException


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def supabase_configured() -> bool:
    settings = get_settings()
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)


def _require_storage_config(bucket: str, bucket_var: str, feature: str) -> None:
    """Fail fast when this environment's Supabase Storage is not configured.

    Both local development and production must provide their own Supabase
    project credentials and bucket names; anything missing is a
    configuration error (503), never a reason to store files elsewhere.
    """
    if not supabase_configured():
        raise CustomException(
            503,
            f"{feature} is not configured: set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY for this environment.",
        )
    if not bucket:
        raise CustomException(
            503, f"{feature} is not configured: set {bucket_var}."
        )


def upload_supabase_object(
    bucket: str, storage_key: str, content: bytes, file_options: dict
) -> str:
    """Upload bytes to an existing private Supabase bucket.

    Buckets are provisioned outside the app; this never creates one, so a
    missing or misconfigured bucket surfaces as the storage API's error.
    """
    client = get_supabase_client()
    client.storage.from_(bucket).upload(
        path=storage_key, file=content, file_options=file_options
    )
    return storage_key


def download_supabase_object(bucket: str, storage_key: str) -> bytes:
    """Download an object's bytes from a private Supabase bucket."""
    return get_supabase_client().storage.from_(bucket).download(storage_key)


def delete_supabase_object(bucket: str, storage_key: str) -> None:
    """Delete an object from a private Supabase bucket."""
    get_supabase_client().storage.from_(bucket).remove([storage_key])


# ------------------------------------------------------------- resumes


def upload_resume_file(storage_key: str, content: bytes) -> str:
    """Store a resume PDF in the configured resume bucket."""
    settings = get_settings()
    _require_storage_config(
        settings.SUPABASE_STORAGE_BUCKET,
        "SUPABASE_STORAGE_BUCKET",
        "Resume storage",
    )
    try:
        upload_supabase_object(
            settings.SUPABASE_STORAGE_BUCKET,
            storage_key,
            content,
            {"content-type": "application/pdf"},
        )
    except CustomException:
        raise
    except Exception as exc:
        raise CustomException(502, f"Resume storage upload failed: {exc}") from exc
    return storage_key


def download_resume_file(storage_key: str) -> bytes:
    """Read back a stored resume PDF from the configured resume bucket."""
    settings = get_settings()
    _require_storage_config(
        settings.SUPABASE_STORAGE_BUCKET,
        "SUPABASE_STORAGE_BUCKET",
        "Resume storage",
    )
    try:
        return download_supabase_object(
            settings.SUPABASE_STORAGE_BUCKET, storage_key
        )
    except CustomException:
        raise
    except Exception as exc:
        raise CustomException(
            502, f"Resume storage download failed: {exc}"
        ) from exc


def delete_resume_file(storage_key: str) -> None:
    """Delete a stored resume PDF from the configured resume bucket."""
    settings = get_settings()
    _require_storage_config(
        settings.SUPABASE_STORAGE_BUCKET,
        "SUPABASE_STORAGE_BUCKET",
        "Resume storage",
    )
    try:
        delete_supabase_object(settings.SUPABASE_STORAGE_BUCKET, storage_key)
    except CustomException:
        raise
    except Exception as exc:
        raise CustomException(
            502, f"Resume storage deletion failed: {exc}"
        ) from exc


# ------------------------------------------------------- interview media


def upload_media_file(storage_key: str, content: bytes, content_type: str) -> str:
    """Store an interview recording and return its bucket-relative storage key."""
    settings = get_settings()
    _require_storage_config(
        settings.SUPABASE_MEDIA_BUCKET,
        "SUPABASE_MEDIA_BUCKET",
        "Interview media storage",
    )
    try:
        upload_supabase_object(
            settings.SUPABASE_MEDIA_BUCKET,
            storage_key,
            content,
            # Upsert is safe here: storage keys are server-generated per
            # answer (interviews/{user}/{interview}/{answer}/{uuid}), so a
            # retry can only overwrite that same answer's recording.
            {"content-type": content_type, "x-upsert": "true"},
        )
    except CustomException:
        raise
    except Exception as exc:
        raise CustomException(502, f"Media storage upload failed: {exc}") from exc
    return storage_key


def download_media_file(storage_key: str) -> bytes:
    """Read back a previously uploaded recording for server-side reprocessing.

    Used when a recording reached storage but transcription/evaluation did
    not complete — the candidate can retry without re-recording.
    """
    settings = get_settings()
    _require_storage_config(
        settings.SUPABASE_MEDIA_BUCKET,
        "SUPABASE_MEDIA_BUCKET",
        "Interview media storage",
    )
    try:
        return download_supabase_object(
            settings.SUPABASE_MEDIA_BUCKET, storage_key
        )
    except CustomException:
        raise
    except Exception as exc:
        raise CustomException(
            502, f"Stored recording download failed: {exc}"
        ) from exc


def delete_media_file(storage_key: str) -> None:
    """Delete a stored recording from the configured interview-media bucket."""
    settings = get_settings()
    _require_storage_config(
        settings.SUPABASE_MEDIA_BUCKET,
        "SUPABASE_MEDIA_BUCKET",
        "Interview media storage",
    )
    try:
        delete_supabase_object(settings.SUPABASE_MEDIA_BUCKET, storage_key)
    except CustomException:
        raise
    except Exception as exc:
        raise CustomException(
            502, f"Stored recording deletion failed: {exc}"
        ) from exc
