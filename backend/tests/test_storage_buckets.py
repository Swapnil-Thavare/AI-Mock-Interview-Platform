"""Storage-bucket routing and environment-isolation tests.

Verifies that resume files and interview media are stored through the
centralized Supabase storage service using the environment-configured
bucket names (SUPABASE_STORAGE_BUCKET / SUPABASE_MEDIA_BUCKET), that
missing configuration fails fast with a clear error (no filesystem
fallback), and that no storage internals are exposed through the API.

These tests mock the Supabase client — they prove bucket routing and
error behavior, not real Supabase connectivity.
"""
import pytest

from app.exception import CustomException
from app.services.storage import storage_service

# asyncio_mode=auto — no module-level asyncio mark needed.


class _FakeBucket:
    def __init__(self, calls, bucket):
        self._calls = calls
        self._bucket = bucket

    def upload(self, path, file, file_options):
        self._calls.append(
            ("upload", self._bucket, path, file, dict(file_options))
        )

    def download(self, path):
        self._calls.append(("download", self._bucket, path))
        return b"stored-bytes"

    def remove(self, paths):
        self._calls.append(("remove", self._bucket, list(paths)))


class _FakeStorage:
    def __init__(self, calls):
        self._calls = calls

    def from_(self, bucket):
        return _FakeBucket(self._calls, bucket)


class _FakeClient:
    def __init__(self, calls):
        self.storage = _FakeStorage(calls)


@pytest.fixture
def fake_supabase(monkeypatch):
    """Stand-in Supabase client capturing (op, bucket, path) per call."""
    calls = []
    monkeypatch.setattr(storage_service, "supabase_configured", lambda: True)
    monkeypatch.setattr(
        storage_service, "get_supabase_client", lambda: _FakeClient(calls)
    )
    return calls


# ------------------------------------------------------------- resumes


def test_resume_upload_uses_resume_bucket(fake_supabase):
    key = storage_service.upload_resume_file("u/resume.pdf", b"%PDF data")
    assert key == "u/resume.pdf"
    assert fake_supabase == [
        (
            "upload",
            "resumes",
            "u/resume.pdf",
            b"%PDF data",
            {"content-type": "application/pdf"},
        )
    ]


def test_resume_download_uses_resume_bucket(fake_supabase):
    assert (
        storage_service.download_resume_file("u/resume.pdf") == b"stored-bytes"
    )
    assert fake_supabase == [("download", "resumes", "u/resume.pdf")]


def test_resume_delete_uses_resume_bucket(fake_supabase):
    storage_service.delete_resume_file("u/resume.pdf")
    assert fake_supabase == [("remove", "resumes", ["u/resume.pdf"])]


def test_resume_missing_bucket_configuration(monkeypatch):
    monkeypatch.setattr(storage_service, "supabase_configured", lambda: True)
    monkeypatch.setattr(
        storage_service.get_settings(), "SUPABASE_STORAGE_BUCKET", ""
    )
    for call in (
        lambda: storage_service.upload_resume_file("k.pdf", b"d"),
        lambda: storage_service.download_resume_file("k.pdf"),
        lambda: storage_service.delete_resume_file("k.pdf"),
    ):
        with pytest.raises(CustomException) as exc_info:
            call()
        assert exc_info.value.status_code == 503


def test_resume_upload_supabase_failure(monkeypatch):
    class FailingBucket:
        def upload(self, path, file, file_options):
            raise RuntimeError("bucket unavailable")

    class FailingStorage:
        def from_(self, bucket):
            return FailingBucket()

    class FailingClient:
        storage = FailingStorage()

    monkeypatch.setattr(storage_service, "supabase_configured", lambda: True)
    monkeypatch.setattr(
        storage_service, "get_supabase_client", lambda: FailingClient()
    )
    with pytest.raises(CustomException) as exc_info:
        storage_service.upload_resume_file("u/resume.pdf", b"%PDF data")
    assert exc_info.value.status_code == 502


# ------------------------------------------------------- interview media


def test_media_upload_uses_media_bucket(fake_supabase):
    key = storage_service.upload_media_file(
        "interviews/u/i/a/k.webm", b"data", "audio/webm"
    )
    assert key == "interviews/u/i/a/k.webm"
    assert fake_supabase == [
        (
            "upload",
            "interview-media",
            "interviews/u/i/a/k.webm",
            b"data",
            {"content-type": "audio/webm", "x-upsert": "true"},
        )
    ]


def test_media_download_uses_media_bucket(fake_supabase):
    """The transcription-reprocess path reads from the configured bucket."""
    assert (
        storage_service.download_media_file("interviews/u/i/a/k.webm")
        == b"stored-bytes"
    )
    assert fake_supabase == [
        ("download", "interview-media", "interviews/u/i/a/k.webm")
    ]


def test_media_delete_uses_media_bucket(fake_supabase):
    storage_service.delete_media_file("interviews/u/i/a/k.webm")
    assert fake_supabase == [
        ("remove", "interview-media", ["interviews/u/i/a/k.webm"])
    ]


def test_media_retry_reuses_key_with_upsert(fake_supabase):
    """A retry of the same answer re-uploads under the identical storage
    key with upsert semantics — safe overwrite of only that recording."""
    key = "interviews/u/i/a/k.webm"
    storage_service.upload_media_file(key, b"attempt-1", "audio/webm")
    storage_service.upload_media_file(key, b"attempt-2", "audio/webm")
    assert len(fake_supabase) == 2
    for call in fake_supabase:
        assert call[0] == "upload"
        assert call[1] == "interview-media"
        assert call[2] == key
        assert call[4]["x-upsert"] == "true"


def test_media_missing_bucket_configuration(monkeypatch):
    monkeypatch.setattr(storage_service, "supabase_configured", lambda: True)
    monkeypatch.setattr(
        storage_service.get_settings(), "SUPABASE_MEDIA_BUCKET", ""
    )
    for call in (
        lambda: storage_service.upload_media_file("k.webm", b"d", "audio/webm"),
        lambda: storage_service.download_media_file("k.webm"),
        lambda: storage_service.delete_media_file("k.webm"),
    ):
        with pytest.raises(CustomException) as exc_info:
            call()
        assert exc_info.value.status_code == 503


def test_media_upload_supabase_failure(monkeypatch):
    class FailingBucket:
        def upload(self, path, file, file_options):
            raise RuntimeError("bucket unavailable")

    class FailingStorage:
        def from_(self, bucket):
            return FailingBucket()

    class FailingClient:
        storage = FailingStorage()

    monkeypatch.setattr(storage_service, "supabase_configured", lambda: True)
    monkeypatch.setattr(
        storage_service, "get_supabase_client", lambda: FailingClient()
    )
    with pytest.raises(CustomException) as exc_info:
        storage_service.upload_media_file("k.webm", b"data", "audio/webm")
    assert exc_info.value.status_code == 502


# ---------------------------------------------------- missing credentials


def test_missing_supabase_credentials_fail_all_operations(monkeypatch):
    """No SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY -> 503 everywhere,
    never a silent write to local disk."""
    monkeypatch.setattr(storage_service, "supabase_configured", lambda: False)
    for call in (
        lambda: storage_service.upload_resume_file("k.pdf", b"d"),
        lambda: storage_service.download_resume_file("k.pdf"),
        lambda: storage_service.delete_resume_file("k.pdf"),
        lambda: storage_service.upload_media_file("k.webm", b"d", "audio/webm"),
        lambda: storage_service.download_media_file("k.webm"),
        lambda: storage_service.delete_media_file("k.webm"),
    ):
        with pytest.raises(CustomException) as exc_info:
            call()
        assert exc_info.value.status_code == 503


# -------------------------------------------------- environment isolation


def test_supabase_client_uses_configured_credentials(monkeypatch):
    """The client is built from this environment's settings — nothing is
    hardcoded to a specific Supabase project."""
    settings = storage_service.get_settings()
    monkeypatch.setattr(
        settings, "SUPABASE_URL", "https://dev-project-ref.supabase.co"
    )
    monkeypatch.setattr(
        settings, "SUPABASE_SERVICE_ROLE_KEY", "dev-service-role-key"
    )
    created = {}

    def fake_create_client(url, key):
        created["url"] = url
        created["key"] = key
        return object()

    monkeypatch.setattr(storage_service, "create_client", fake_create_client)
    storage_service.get_supabase_client.cache_clear()
    try:
        storage_service.get_supabase_client()
    finally:
        storage_service.get_supabase_client.cache_clear()
    assert created == {
        "url": "https://dev-project-ref.supabase.co",
        "key": "dev-service-role-key",
    }


def test_resume_and_media_use_separate_configured_buckets(
    fake_supabase, monkeypatch
):
    """Bucket names come from settings — distinct values route each
    storage category to its own bucket."""
    settings = storage_service.get_settings()
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "dev-resumes")
    monkeypatch.setattr(settings, "SUPABASE_MEDIA_BUCKET", "dev-media")
    storage_service.upload_resume_file("r.pdf", b"r")
    storage_service.upload_media_file("m.webm", b"m", "audio/webm")
    buckets = [call[1] for call in fake_supabase]
    assert buckets == ["dev-resumes", "dev-media"]
    assert buckets[0] != buckets[1]


async def test_resume_response_exposes_no_storage_key(
    db_client, auth_headers, monkeypatch
):
    monkeypatch.setattr(
        "app.services.resume.resume_service.extract_text_from_pdf",
        lambda _bytes: "Sample resume text",
    )
    response = await db_client.post(
        "/api/v1/resume/upload",
        files={"file": ("resume.pdf", b"%PDF fake", "application/pdf")},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert "file_path" not in body
    assert "storage_key" not in body


async def _upload_resume(db_client, auth_headers, monkeypatch) -> str:
    monkeypatch.setattr(
        "app.services.resume.resume_service.extract_text_from_pdf",
        lambda _bytes: "Sample resume text",
    )
    response = await db_client.post(
        "/api/v1/resume/upload",
        files={"file": ("resume.pdf", b"%PDF fake", "application/pdf")},
        headers=auth_headers,
    )
    assert response.status_code == 200
    return response.json()["id"]


async def test_resume_delete_marks_row_deleted_and_removes_storage_object(
    db_client, auth_headers, monkeypatch
):
    """Deleting a resume removes the stored PDF and soft-deletes the row:
    it is excluded from lists and direct fetches, but kept for FK links."""
    deleted_paths = []
    monkeypatch.setattr(
        "app.services.resume.resume_service.delete_resume_file",
        lambda path: deleted_paths.append(path),
    )
    resume_id = await _upload_resume(db_client, auth_headers, monkeypatch)

    delete = await db_client.delete(
        f"/api/v1/resume/{resume_id}", headers=auth_headers
    )
    assert delete.status_code == 200
    assert deleted_paths, "stored file must be deleted with the row"

    listing = await db_client.get("/api/v1/resume", headers=auth_headers)
    assert all(r["id"] != resume_id for r in listing.json())

    gone = await db_client.get(
        f"/api/v1/resume/{resume_id}", headers=auth_headers
    )
    assert gone.status_code == 404


async def test_resume_delete_rejects_other_users_resume(
    db_client, auth_headers, test_user, monkeypatch
):
    """A resume can only be deleted by its owner."""
    resume_id = await _upload_resume(db_client, auth_headers, monkeypatch)

    # auth_headers belongs to test_user; register a second user so their
    # token is genuinely different.
    register = await db_client.post(
        "/api/v1/auth/register",
        json={
            "email": "someone-else@example.com",
            "full_name": "Someone Else",
            "password": "password",
        },
    )
    assert register.status_code == 200
    login = await db_client.post(
        "/api/v1/auth/login",
        json={"email": "someone-else@example.com", "password": "password"},
    )
    other_headers = {
        "Authorization": f"Bearer {login.cookies.get('access_token')}"
    }

    delete = await db_client.delete(
        f"/api/v1/resume/{resume_id}", headers=other_headers
    )
    assert delete.status_code == 404


async def test_interview_and_report_survive_resume_and_jd_deletion(
    db_client, auth_headers, monkeypatch
):
    """Interviews outlive their source rows: ON DELETE SET NULL clears the
    FKs, the completed interview and its report stay fetchable, and the
    deleted resume/JD no longer appear in setup lists."""
    monkeypatch.setattr(
        "app.services.resume.resume_service.delete_resume_file",
        lambda path: None,
    )
    monkeypatch.setattr(
        "app.services.resume.resume_service.extract_text_from_pdf",
        lambda _bytes: "Sample resume text",
    )

    resume = await db_client.post(
        "/api/v1/resume/upload",
        files={"file": ("resume.pdf", b"%PDF fake", "application/pdf")},
        headers=auth_headers,
    )
    job = await db_client.post(
        "/api/v1/job-descriptions",
        json={"title": "Backend Engineer", "description": "Python role"},
        headers=auth_headers,
    )
    resume_id = resume.json()["id"]
    job_id = job.json()["id"]

    interview = await db_client.post(
        "/api/v1/interviews",
        json={
            "title": "Mock Interview",
            "resume_id": resume_id,
            "job_description_id": job_id,
            "difficulty": "medium",
            "question_count": 1,
            "duration": 30,
            "question_types": ["technical"],
            "interview_mode": "TEXT",
        },
        headers=auth_headers,
    )
    assert interview.status_code == 200
    interview_id = interview.json()["id"]
    question_id = interview.json()["questions"][0]["id"]

    answer = await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "An answer."},
        headers=auth_headers,
    )
    assert answer.status_code == 200
    complete = await db_client.post(
        f"/api/v1/interviews/{interview_id}/complete", headers=auth_headers
    )
    assert complete.status_code == 200

    # Delete both source rows after the interview completed.
    assert (
        await db_client.delete(
            f"/api/v1/resume/{resume_id}", headers=auth_headers
        )
    ).status_code == 200
    assert (
        await db_client.delete(
            f"/api/v1/job-descriptions/{job_id}", headers=auth_headers
        )
    ).status_code == 200

    # Deleted items can no longer be picked in interview setup.
    resumes = await db_client.get("/api/v1/resume", headers=auth_headers)
    assert all(r["id"] != resume_id for r in resumes.json())
    jobs = await db_client.get("/api/v1/job-descriptions", headers=auth_headers)
    assert all(j["id"] != job_id for j in jobs.json())

    # Even a stale client cannot start an interview from a deleted row.
    reused = await db_client.post(
        "/api/v1/interviews",
        json={
            "title": "Stale Interview",
            "resume_id": resume_id,
            "job_description_id": job_id,
            "difficulty": "medium",
            "question_count": 1,
            "duration": 30,
            "question_types": ["technical"],
            "interview_mode": "TEXT",
        },
        headers=auth_headers,
    )
    assert reused.status_code == 404

    # The interview itself is unaffected; the soft-deleted rows keep their
    # FK references so reports retain full context.
    fetched = await db_client.get(
        f"/api/v1/interviews/{interview_id}", headers=auth_headers
    )
    assert fetched.status_code == 200
    assert fetched.json()["resume_id"] == resume_id
    assert fetched.json()["job_description_id"] == job_id
    assert fetched.json()["status"] == "completed"

    # The completed report remains available.
    report = await db_client.get(
        f"/api/v1/interviews/{interview_id}/report", headers=auth_headers
    )
    assert report.status_code == 200
