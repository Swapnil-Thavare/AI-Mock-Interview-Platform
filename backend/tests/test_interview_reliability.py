"""Phase 7G regression tests — reliability hardening.

Covers: typed-notes vs transcript (F-002), immediate follow-up delivery
(F-005), stored-media reprocess endpoint (F-003 server side), concurrent
upload integrity (F-009), storage upsert semantics (F-001), JWT secret
validation (F-008) and storage-key exposure (F-011).
"""
import pytest
from pydantic import ValidationError

# asyncio_mode=auto — no module-level asyncio mark needed.

from app.core.config import Settings
from app.services.ai import schemas as ai_schemas
from app.services.ai.ai_service import AIService
from app.services.interview.interview_query import InterviewQuery
from app.services.storage import storage_service

FAKE_TRANSCRIPT = "This is the candidate's spoken answer."


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


def _upload_file_bytes(filename, content, content_type):
    return (filename, content, content_type)


async def _create_interview(
    db_client, auth_headers, monkeypatch, mode="TEXT", num_questions=1
):
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

    if num_questions > 1:
        async def _many_questions(*args, **kwargs):
            return [
                {
                    "question": f"Question {i}?",
                    "question_type": "technical",
                    "difficulty": "medium",
                    "topic": f"Topic {i}",
                    "expected_focus": f"focus {i}",
                }
                for i in range(1, num_questions + 1)
            ]

        monkeypatch.setattr(
            AIService, "generate_interview_questions", _many_questions
        )

    payload = {
        "title": "Mock Interview",
        "resume_id": resume.json()["id"],
        "job_description_id": job.json()["id"],
        "difficulty": "medium",
        "question_count": num_questions,
        "duration": 30,
        "question_types": ["technical"],
        "interview_mode": mode,
    }
    response = await db_client.post(
        "/api/v1/interviews", json=payload, headers=auth_headers
    )
    assert response.status_code == 200
    return response.json()


async def _submit_question(
    db_client, auth_headers, interview, question_id, answer_text="", skipped=False
):
    return await db_client.post(
        f"/api/v1/interviews/{interview['id']}/answers",
        json={
            "question_id": question_id,
            "answer_text": answer_text,
            "skipped": skipped,
        },
        headers=auth_headers,
    )


def _media_upload(answer_id, interview_id, content=b"fake-media", mime="audio/webm"):
    url = f"/api/v1/interviews/{interview_id}/answers/{answer_id}/media"
    return url, {"file": _upload_file_bytes("recording", content, mime)}


def _evaluation(follow_up=False):
    async def _eval(*args, **kwargs):
        return ai_schemas.AnswerEvaluationOutput(
            score=75,
            relevance_score=80,
            correctness_score=70,
            clarity_score=75,
            depth_score=70,
            strengths=["Clear"],
            weaknesses=["Detail"],
            missing_points=["Middleware"],
            improvement_feedback="More detail.",
            ideal_answer_summary="Summary.",
            follow_up_required=follow_up,
            follow_up_reason="Needs depth." if follow_up else "",
            confidence=85,
            uncertainty_notes="",
        )

    return _eval


# ---------------------------------------------------------------- F-002

async def test_audio_typed_notes_become_placeholder_then_transcript_evaluated(
    db_client, auth_headers, monkeypatch, mock_media_storage
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    qid = interview["questions"][0]["id"]

    submitted = await _submit_question(
        db_client, auth_headers, interview, qid, answer_text="My notes here"
    )
    assert submitted.status_code == 200
    # Notes are never stored as the answer and never evaluated.
    assert submitted.json()["answer"]["answer_text"] == ""
    assert submitted.json()["evaluation"] is None
    assert submitted.json()["follow_up_generated"] is False
    answer_id = submitted.json()["answer"]["id"]

    url, files = _media_upload(answer_id, interview["id"])
    uploaded = await db_client.post(url, files=files, headers=auth_headers)
    assert uploaded.status_code == 200
    data = uploaded.json()
    assert data["answer"]["answer_text"] == FAKE_TRANSCRIPT
    assert data["evaluation"]["score"] == 75


async def test_video_typed_notes_become_placeholder_then_transcript_evaluated(
    db_client, auth_headers, monkeypatch, mock_media_storage
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="VIDEO"
    )
    qid = interview["questions"][0]["id"]

    submitted = await _submit_question(
        db_client, auth_headers, interview, qid, answer_text="My notes here"
    )
    assert submitted.status_code == 200
    assert submitted.json()["answer"]["answer_text"] == ""
    assert submitted.json()["evaluation"] is None
    answer_id = submitted.json()["answer"]["id"]

    url, files = _media_upload(
        answer_id, interview["id"], mime="video/webm"
    )
    uploaded = await db_client.post(url, files=files, headers=auth_headers)
    assert uploaded.status_code == 200
    assert uploaded.json()["answer"]["answer_text"] == FAKE_TRANSCRIPT
    assert uploaded.json()["evaluation"]["score"] == 75


async def test_text_answer_evaluation_unchanged(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="TEXT"
    )
    qid = interview["questions"][0]["id"]
    submitted = await _submit_question(
        db_client, auth_headers, interview, qid, answer_text="A real answer."
    )
    assert submitted.status_code == 200
    assert submitted.json()["answer"]["answer_text"] == "A real answer."
    assert submitted.json()["evaluation"]["score"] == 75


# ---------------------------------------------------------------- F-005

async def test_follow_up_returned_immediately_before_next_question(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, num_questions=3
    )
    q1, q2 = interview["questions"][0]["id"], interview["questions"][1]["id"]

    monkeypatch.setattr(AIService, "evaluate_answer", _evaluation(True))
    submitted = await _submit_question(
        db_client, auth_headers, interview, q1, answer_text="Weak answer."
    )
    assert submitted.status_code == 200
    data = submitted.json()
    assert data["follow_up_generated"] is True
    assert data["next_question"]["is_follow_up"] is True
    assert data["next_question"]["id"] != q2

    # After the follow-up is answered, normal ordering resumes at Q2 —
    # the follow-up is never presented twice.
    monkeypatch.setattr(AIService, "evaluate_answer", _evaluation(False))
    fu = await _submit_question(
        db_client,
        auth_headers,
        interview,
        data["next_question"]["id"],
        answer_text="Better.",
    )
    assert fu.status_code == 200
    assert fu.json()["next_question"]["id"] == q2
    assert fu.json()["next_question"]["is_follow_up"] is False


async def test_no_follow_up_normal_progression(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, num_questions=3
    )
    q1, q2 = interview["questions"][0]["id"], interview["questions"][1]["id"]
    submitted = await _submit_question(
        db_client, auth_headers, interview, q1, answer_text="Good."
    )
    assert submitted.status_code == 200
    assert submitted.json()["next_question"]["id"] == q2


async def test_nested_follow_up_delivered_immediately(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, num_questions=2
    )
    q1, q2 = interview["questions"][0]["id"], interview["questions"][1]["id"]

    monkeypatch.setattr(AIService, "evaluate_answer", _evaluation(True))
    r1 = await _submit_question(
        db_client, auth_headers, interview, q1, answer_text="Partial."
    )
    fu1 = r1.json()["next_question"]
    assert fu1["is_follow_up"] is True

    # A weak follow-up answer produces a nested follow-up, also delivered
    # immediately.
    r2 = await _submit_question(
        db_client, auth_headers, interview, fu1["id"], answer_text="Still weak."
    )
    fu2 = r2.json()["next_question"]
    assert fu2["is_follow_up"] is True
    assert fu2["parent_question_id"] == fu1["id"]

    monkeypatch.setattr(AIService, "evaluate_answer", _evaluation(False))
    r3 = await _submit_question(
        db_client, auth_headers, interview, fu2["id"], answer_text="Now good."
    )
    assert r3.json()["next_question"]["id"] == q2


async def test_audio_follow_up_immediate_after_transcription(
    db_client, auth_headers, monkeypatch, mock_media_storage
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO", num_questions=2
    )
    q1 = interview["questions"][0]["id"]

    submitted = await _submit_question(
        db_client, auth_headers, interview, q1
    )
    answer_id = submitted.json()["answer"]["id"]

    monkeypatch.setattr(AIService, "evaluate_answer", _evaluation(True))
    url, files = _media_upload(answer_id, interview["id"])
    uploaded = await db_client.post(url, files=files, headers=auth_headers)
    assert uploaded.status_code == 200
    data = uploaded.json()
    assert data["follow_up_generated"] is True
    assert data["next_question"]["is_follow_up"] is True


# ---------------------------------------------------------------- F-003 reprocess

async def test_reprocess_without_media_returns_404(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    qid = interview["questions"][0]["id"]
    submitted = await _submit_question(
        db_client, auth_headers, interview, qid
    )
    answer_id = submitted.json()["answer"]["id"]
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/answers/{answer_id}/media/reprocess",
        headers=auth_headers,
    )
    assert response.status_code == 404


async def test_reprocess_failed_transcription_recovers(
    db_client, auth_headers, monkeypatch, mock_media_storage, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    qid = interview["questions"][0]["id"]
    submitted = await _submit_question(
        db_client, auth_headers, interview, qid
    )
    answer_id = submitted.json()["answer"]["id"]

    # First upload transcribes to nothing — FAILED state, media UPLOADED.
    mock_transcription.transcript = ""
    url, files = _media_upload(answer_id, interview["id"])
    first = await db_client.post(url, files=files, headers=auth_headers)
    assert first.status_code == 422

    # Stored bytes are fetched server-side — no re-upload needed.
    monkeypatch.setattr(
        "app.services.interview.interview_service.download_media_file",
        lambda storage_key: b"fake-media",
    )
    mock_transcription.transcript = FAKE_TRANSCRIPT
    second = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/answers/{answer_id}/media/reprocess",
        headers=auth_headers,
    )
    assert second.status_code == 200
    data = second.json()
    assert data["media"]["transcription_status"] == "COMPLETED"
    assert data["answer"]["answer_text"] == FAKE_TRANSCRIPT
    assert data["evaluation"]["score"] == 75


async def test_reprocess_skips_completed_transcription(
    db_client, auth_headers, monkeypatch, mock_media_storage, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    qid = interview["questions"][0]["id"]
    submitted = await _submit_question(
        db_client, auth_headers, interview, qid
    )
    answer_id = submitted.json()["answer"]["id"]

    # Break evaluation so the first upload ends without an evaluation.
    async def broken_eval(*args, **kwargs):
        raise RuntimeError("eval down")

    monkeypatch.setattr(AIService, "evaluate_answer", broken_eval)
    url, files = _media_upload(answer_id, interview["id"])
    first = await db_client.post(url, files=files, headers=auth_headers)
    assert first.status_code == 200
    assert first.json()["evaluation"] is None
    calls_before = len(mock_transcription.calls)

    monkeypatch.setattr(AIService, "evaluate_answer", _evaluation(False))
    monkeypatch.setattr(
        "app.services.interview.interview_service.download_media_file",
        lambda storage_key: b"fake-media",
    )
    second = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/answers/{answer_id}/media/reprocess",
        headers=auth_headers,
    )
    assert second.status_code == 200
    assert second.json()["evaluation"]["score"] == 75
    # The completed transcription was not repeated.
    assert len(mock_transcription.calls) == calls_before


async def test_reprocess_rejects_text_and_completed(
    db_client, auth_headers, monkeypatch, mock_media_storage
):
    text_interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="TEXT"
    )
    submitted = await _submit_question(
        db_client,
        auth_headers,
        text_interview,
        text_interview["questions"][0]["id"],
        answer_text="Answer",
    )
    answer_id = submitted.json()["answer"]["id"]
    response = await db_client.post(
        f"/api/v1/interviews/{text_interview['id']}/answers/{answer_id}/media/reprocess",
        headers=auth_headers,
    )
    assert response.status_code == 400

    # Completed interview rejects reprocess.
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    qid = interview["questions"][0]["id"]
    submitted = await _submit_question(db_client, auth_headers, interview, qid)
    answer_id = submitted.json()["answer"]["id"]
    url, files = _media_upload(answer_id, interview["id"])
    await db_client.post(url, files=files, headers=auth_headers)
    await db_client.post(
        f"/api/v1/interviews/{interview['id']}/complete", headers=auth_headers
    )
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/answers/{answer_id}/media/reprocess",
        headers=auth_headers,
    )
    assert response.status_code == 400


# ---------------------------------------------------------------- F-009

async def test_concurrent_media_insert_adopts_existing_row(
    db_client, auth_headers, monkeypatch, mock_media_storage
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    qid = interview["questions"][0]["id"]
    submitted = await _submit_question(
        db_client, auth_headers, interview, qid
    )
    answer_id = submitted.json()["answer"]["id"]

    url, files = _media_upload(answer_id, interview["id"])
    first = await db_client.post(url, files=files, headers=auth_headers)
    assert first.status_code == 200
    first_media_id = first.json()["media"]["id"]

    # Simulate a race: the existence check misses the row created by the
    # competing request, but the unique constraint catches the insert.
    calls = {"n": 0}
    original = InterviewQuery.get_media_for_answer

    async def first_miss(self, answer_id):
        calls["n"] += 1
        if calls["n"] == 1:
            return None
        return await original(self, answer_id)

    monkeypatch.setattr(
        InterviewQuery, "get_media_for_answer", first_miss
    )
    second = await db_client.post(url, files=files, headers=auth_headers)
    assert second.status_code == 200
    assert second.json()["media"]["id"] == first_media_id
    # Three storage calls: the original upload, the losing request's
    # minted key, then the adopted re-upload under the original key.
    assert len(mock_media_storage) == 3
    assert mock_media_storage[2][0] == mock_media_storage[0][0]
    assert mock_media_storage[1][0] != mock_media_storage[0][0]


# ---------------------------------------------------------------- F-001/F-011

def test_supabase_upload_sends_upsert(monkeypatch):
    captured = {}

    class FakeBucket:
        def upload(self, path, file, file_options):
            captured["path"] = path
            captured["options"] = file_options

    class FakeStorage:
        def from_(self, bucket):
            return FakeBucket()

    class FakeClient:
        storage = FakeStorage()

    monkeypatch.setattr(storage_service, "supabase_configured", lambda: True)
    monkeypatch.setattr(
        storage_service, "get_supabase_client", lambda: FakeClient()
    )
    storage_service.upload_media_file(
        "interviews/u/i/a/k.webm", b"data", "audio/webm"
    )
    assert captured["path"] == "interviews/u/i/a/k.webm"
    assert captured["options"]["x-upsert"] == "true"
    assert captured["options"]["content-type"] == "audio/webm"


def test_local_upload_fallback_unchanged(monkeypatch, tmp_path):
    monkeypatch.setattr(storage_service, "supabase_configured", lambda: False)
    monkeypatch.setattr(
        storage_service.get_settings(), "ENVIRONMENT", "development"
    )
    monkeypatch.setattr(storage_service, "MEDIA_UPLOAD_DIR", str(tmp_path))
    key = storage_service.upload_media_file("k/a.webm", b"data", "audio/webm")
    assert key == "k/a.webm"
    assert (tmp_path / "k" / "a.webm").read_bytes() == b"data"


async def test_no_storage_keys_exposed_in_interview_response(
    db_client, auth_headers, monkeypatch, mock_media_storage
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    qid = interview["questions"][0]["id"]
    submitted = await _submit_question(
        db_client, auth_headers, interview, qid
    )
    answer_id = submitted.json()["answer"]["id"]
    url, files = _media_upload(answer_id, interview["id"])
    await db_client.post(url, files=files, headers=auth_headers)

    fetched = await db_client.get(
        f"/api/v1/interviews/{interview['id']}", headers=auth_headers
    )
    assert fetched.status_code == 200

    def check_no_internal_keys(node):
        if isinstance(node, dict):
            for k, v in node.items():
                assert "storage_key" not in k
                assert "file_path" not in k
                check_no_internal_keys(v)
        elif isinstance(node, list):
            for item in node:
                check_no_internal_keys(item)

    check_no_internal_keys(fetched.json())


# ---------------------------------------------------------------- F-008

def test_production_rejects_default_jwt_secret():
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production", JWT_SECRET_KEY="change-me")


def test_production_rejects_empty_jwt_secret():
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production", JWT_SECRET_KEY="")


def test_production_accepts_real_jwt_secret():
    s = Settings(ENVIRONMENT="production", JWT_SECRET_KEY="a-real-secret-value")
    assert s.ENVIRONMENT == "production"


def test_development_allows_default_jwt_secret():
    s = Settings(ENVIRONMENT="development", JWT_SECRET_KEY="change-me")
    assert s.JWT_SECRET_KEY == "change-me"
