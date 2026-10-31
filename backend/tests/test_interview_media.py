import pytest

from app.core.config import get_settings
from app.exception import CustomException

pytestmark = pytest.mark.asyncio


def _upload_file_bytes(filename: str, content: bytes, content_type: str):
    return (filename, content, content_type)


async def _auth_token(db_client, email, password, full_name):
    await db_client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": full_name, "password": password},
    )
    login = await db_client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    return login.json()["access_token"]


@pytest.fixture(autouse=True)
def mock_media_storage(monkeypatch):
    """Media uploads must never hit real Supabase Storage in tests."""
    calls = []

    def fake_upload(storage_key, content, content_type):
        calls.append((storage_key, len(content), content_type))
        return storage_key

    monkeypatch.setattr(
        "app.services.interview.interview_service.upload_media_file",
        fake_upload,
    )
    return calls


async def _create_interview(db_client, auth_headers, monkeypatch, mode="TEXT"):
    monkeypatch.setattr(
        "app.services.resume.resume_service.extract_text_from_pdf",
        lambda _bytes: "Sample resume text",
    )
    resume = await db_client.post(
        "/api/v1/resume/upload",
        files={"file": _upload_file_bytes("resume.pdf", b"%PDF fake", "application/pdf")},
        headers=auth_headers,
    )
    assert resume.status_code == 200
    job = await db_client.post(
        "/api/v1/job-descriptions",
        json={"title": "Backend Engineer", "description": "Python FastAPI role"},
        headers=auth_headers,
    )
    assert job.status_code == 200
    payload = {
        "title": "Mock Interview",
        "resume_id": resume.json()["id"],
        "job_description_id": job.json()["id"],
        "difficulty": "medium",
        "question_count": 1,
        "duration": 30,
        "question_types": ["technical"],
        "interview_mode": mode,
    }
    response = await db_client.post(
        "/api/v1/interviews", json=payload, headers=auth_headers
    )
    assert response.status_code == 200
    return response.json()


async def _submit_first_answer(db_client, auth_headers, interview):
    question_id = interview["questions"][0]["id"]
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/answers",
        json={"question_id": question_id, "answer_text": "A recorded answer."},
        headers=auth_headers,
    )
    assert response.status_code == 200
    return response.json()["answer"]["id"]


def _media_upload(answer_id, interview_id, content=b"fake-media", mime="audio/webm"):
    url = f"/api/v1/interviews/{interview_id}/answers/{answer_id}/media"
    return url, {"file": _upload_file_bytes("recording", content, mime)}


async def test_audio_media_upload_success(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)

    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(
        url, files=files, data={"duration_seconds": "12.5"}, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()["media"]
    assert data["answer_id"] == answer_id
    assert data["interview_id"] == interview["id"]
    assert data["media_type"] == "AUDIO"
    assert data["mime_type"] == "audio/webm"
    assert data["file_size"] == len(b"fake-media")
    assert data["status"] == "UPLOADED"
    assert data["uploaded_at"]
    assert data["duration_seconds"] == 12.5
    assert data["storage_key"].startswith("interviews/")
    assert "recording" not in data["storage_key"]

    # Metadata is attached to the answer on subsequent fetches.
    fetched = await db_client.get(
        f"/api/v1/interviews/{interview['id']}", headers=auth_headers
    )
    answer = fetched.json()["answers"][0]
    assert answer["media"]["id"] == data["id"]
    assert answer["media"]["status"] == "UPLOADED"


async def test_video_media_upload_success(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="VIDEO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)

    url, files = _media_upload(
        answer_id, interview["id"], mime="video/webm"
    )
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["media"]["media_type"] == "VIDEO"


async def test_media_upload_unauthenticated(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)

    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files)
    assert response.status_code == 401


async def test_media_upload_requires_interview_ownership(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)

    other_token = await _auth_token(
        db_client, "media_other@example.com", "password", "Other User"
    )
    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(
        url, files=files, headers={"Authorization": f"Bearer {other_token}"}
    )
    assert response.status_code == 404


async def test_media_upload_answer_must_belong_to_interview(
    db_client, auth_headers, monkeypatch
):
    first = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    second = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, first)

    url, files = _media_upload(answer_id, second["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 404


async def test_media_upload_to_completed_interview(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)
    await db_client.post(
        f"/api/v1/interviews/{interview['id']}/complete", headers=auth_headers
    )

    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 400


async def test_media_upload_rejected_for_text_interview(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="TEXT"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)

    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 400


async def test_media_upload_media_type_must_match_mode(
    db_client, auth_headers, monkeypatch
):
    audio_interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    audio_answer = await _submit_first_answer(
        db_client, auth_headers, audio_interview
    )
    url, files = _media_upload(
        audio_answer, audio_interview["id"], mime="video/webm"
    )
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 400

    video_interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="VIDEO"
    )
    video_answer = await _submit_first_answer(
        db_client, auth_headers, video_interview
    )
    url, files = _media_upload(
        video_answer, video_interview["id"], mime="audio/webm"
    )
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 400


async def test_media_upload_invalid_mime_type(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)

    url, files = _media_upload(answer_id, interview["id"], mime="text/plain")
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 415


async def test_media_upload_empty_recording(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)

    url, files = _media_upload(answer_id, interview["id"], content=b"")
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 400


async def test_media_upload_oversized(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)

    monkeypatch.setattr(get_settings(), "INTERVIEW_MEDIA_MAX_MB", 0)
    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 413


async def test_media_upload_storage_unavailable(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)

    # Restore the real storage helper and simulate production with no
    # Supabase configuration — it must refuse instead of degrading.
    from app.services.storage import storage_service

    monkeypatch.setattr(get_settings(), "ENVIRONMENT", "production")
    monkeypatch.setattr(
        "app.services.interview.interview_service.upload_media_file",
        storage_service.upload_media_file,
    )
    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 503


async def test_media_upload_storage_failure_marks_failed(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)

    def failing_upload(storage_key, content, content_type):
        raise CustomException(502, "Media storage upload failed: Boom")

    monkeypatch.setattr(
        "app.services.interview.interview_service.upload_media_file",
        failing_upload,
    )
    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 502

    fetched = await db_client.get(
        f"/api/v1/interviews/{interview['id']}", headers=auth_headers
    )
    media = fetched.json()["answers"][0]["media"]
    assert media["status"] == "FAILED"

    # Retrying the same answer reuses the media row and succeeds.
    monkeypatch.setattr(
        "app.services.interview.interview_service.upload_media_file",
        lambda storage_key, content, content_type: storage_key,
    )
    retry = await db_client.post(url, files=files, headers=auth_headers)
    assert retry.status_code == 200
    assert retry.json()["media"]["status"] == "UPLOADED"
    assert retry.json()["media"]["id"] == media["id"]


async def test_media_upload_retry_reuses_record(
    db_client, auth_headers, monkeypatch, mock_media_storage
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    answer_id = await _submit_first_answer(db_client, auth_headers, interview)
    url, files = _media_upload(answer_id, interview["id"])

    first = await db_client.post(url, files=files, headers=auth_headers)
    assert first.status_code == 200
    second = await db_client.post(url, files=files, headers=auth_headers)
    assert second.status_code == 200
    assert second.json()["media"]["id"] == first.json()["media"]["id"]
    assert (
        second.json()["media"]["storage_key"]
        == first.json()["media"]["storage_key"]
    )
    # Same storage object overwritten — one upload call per attempt.
    assert len(mock_media_storage) == 2
