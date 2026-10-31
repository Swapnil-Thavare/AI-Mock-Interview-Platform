import pytest

from app.exception import CustomException
from app.services.ai import schemas as ai_schemas
from app.services.ai.ai_service import AIService

pytestmark = pytest.mark.asyncio

FAKE_TRANSCRIPT = "This is the candidate's spoken answer."


def _upload_file_bytes(filename: str, content: bytes, content_type: str):
    return (filename, content, content_type)


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


async def _submit_answer(
    db_client, auth_headers, interview, answer_text="", skipped=False
):
    question_id = interview["questions"][0]["id"]
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/answers",
        json={
            "question_id": question_id,
            "answer_text": answer_text,
            "skipped": skipped,
        },
        headers=auth_headers,
    )
    return response


def _media_upload(answer_id, interview_id, content=b"fake-media", mime="audio/webm"):
    url = f"/api/v1/interviews/{interview_id}/answers/{answer_id}/media"
    return url, {"file": _upload_file_bytes("recording", content, mime)}


async def _fetch_interview(db_client, auth_headers, interview_id):
    fetched = await db_client.get(
        f"/api/v1/interviews/{interview_id}", headers=auth_headers
    )
    assert fetched.status_code == 200
    return fetched.json()


async def test_audio_voice_answer_transcribed_and_evaluated(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    # Voice-first submission: empty text is accepted and not yet evaluated.
    submitted = await _submit_answer(db_client, auth_headers, interview)
    assert submitted.status_code == 200
    assert submitted.json()["answer"]["answer_text"] == ""
    assert submitted.json()["evaluation"] is None
    answer_id = submitted.json()["answer"]["id"]

    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["media"]["status"] == "UPLOADED"
    assert data["media"]["transcription_status"] == "COMPLETED"
    assert data["media"]["transcript_text"] == FAKE_TRANSCRIPT
    assert data["media"]["transcribed_at"]
    assert data["answer"]["answer_text"] == FAKE_TRANSCRIPT
    # Evaluation ran on the transcript through the existing pipeline.
    assert data["evaluation"]["score"] == 75
    assert data["is_complete"] is True
    assert mock_transcription.calls == ["audio/webm"]

    fetched = await _fetch_interview(db_client, auth_headers, interview["id"])
    answer = fetched["answers"][0]
    assert answer["answer_text"] == FAKE_TRANSCRIPT
    assert answer["score"] == 75
    assert answer["media"]["transcription_status"] == "COMPLETED"


async def test_video_voice_answer_transcribed(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="VIDEO"
    )
    submitted = await _submit_answer(db_client, auth_headers, interview)
    assert submitted.status_code == 200
    answer_id = submitted.json()["answer"]["id"]

    url, files = _media_upload(answer_id, interview["id"], mime="video/webm")
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["media"]["transcription_status"] == "COMPLETED"
    assert data["answer"]["answer_text"] == FAKE_TRANSCRIPT
    assert data["evaluation"]["score"] == 75
    assert mock_transcription.calls == ["video/webm"]


async def test_empty_text_submit_still_rejected(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="TEXT"
    )
    response = await _submit_answer(db_client, auth_headers, interview)
    assert response.status_code == 400


async def test_text_interview_never_transcribes(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="TEXT"
    )
    submitted = await _submit_answer(
        db_client, auth_headers, interview, answer_text="Typed answer."
    )
    assert submitted.status_code == 200
    assert submitted.json()["evaluation"]["score"] == 75
    assert mock_transcription.calls == []


async def test_transcription_provider_failure_preserves_records(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    submitted = await _submit_answer(db_client, auth_headers, interview)
    answer_id = submitted.json()["answer"]["id"]

    mock_transcription.error = CustomException(
        502, "Transcription request failed: Boom"
    )
    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 502

    fetched = await _fetch_interview(db_client, auth_headers, interview["id"])
    answer = fetched["answers"][0]
    # The recording and answer survive; transcription is a recoverable FAILED.
    assert answer["media"]["status"] == "UPLOADED"
    assert answer["media"]["transcription_status"] == "FAILED"
    assert answer["media"]["transcription_error"]
    assert answer["answer_text"] == ""
    assert answer["evaluation"] is None


async def test_empty_transcript_marked_failed(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    submitted = await _submit_answer(db_client, auth_headers, interview)
    answer_id = submitted.json()["answer"]["id"]

    mock_transcription.transcript = ""
    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 422

    fetched = await _fetch_interview(db_client, auth_headers, interview["id"])
    media = fetched["answers"][0]["media"]
    assert media["transcription_status"] == "FAILED"
    assert "speech" in media["transcription_error"].lower()


async def test_evaluation_failure_preserves_transcript(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    submitted = await _submit_answer(db_client, auth_headers, interview)
    answer_id = submitted.json()["answer"]["id"]

    async def broken_evaluate(self, *args, **kwargs):
        raise CustomException(502, "Gemini request failed: Boom")

    monkeypatch.setattr(AIService, "evaluate_answer", broken_evaluate)
    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Transcript is kept so evaluation alone can be retried.
    assert data["media"]["transcription_status"] == "COMPLETED"
    assert data["answer"]["answer_text"] == FAKE_TRANSCRIPT
    assert data["evaluation"] is None


async def test_retry_after_eval_failure_skips_transcription(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    submitted = await _submit_answer(db_client, auth_headers, interview)
    answer_id = submitted.json()["answer"]["id"]

    original_evaluate = AIService.evaluate_answer

    async def broken_evaluate(self, *args, **kwargs):
        raise CustomException(502, "Gemini request failed: Boom")

    monkeypatch.setattr(AIService, "evaluate_answer", broken_evaluate)
    url, files = _media_upload(answer_id, interview["id"])
    first = await db_client.post(url, files=files, headers=auth_headers)
    assert first.status_code == 200
    assert first.json()["evaluation"] is None

    monkeypatch.setattr(AIService, "evaluate_answer", original_evaluate)
    retry = await db_client.post(url, files=files, headers=auth_headers)
    assert retry.status_code == 200
    data = retry.json()
    assert data["evaluation"]["score"] == 75
    assert data["media"]["id"] == first.json()["media"]["id"]
    # Transcription was not repeated — only the evaluation ran again.
    assert mock_transcription.calls == ["audio/webm"]


async def test_retry_upload_does_not_duplicate_eval_or_follow_up(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    submitted = await _submit_answer(db_client, auth_headers, interview)
    answer_id = submitted.json()["answer"]["id"]

    url, files = _media_upload(answer_id, interview["id"])
    first = await db_client.post(url, files=files, headers=auth_headers)
    assert first.status_code == 200
    second = await db_client.post(url, files=files, headers=auth_headers)
    assert second.status_code == 200
    assert second.json()["media"]["id"] == first.json()["media"]["id"]
    # No re-transcription, no re-evaluation, no extra questions.
    assert mock_transcription.calls == ["audio/webm"]
    assert second.json()["evaluation"]["score"] == 75

    fetched = await _fetch_interview(db_client, auth_headers, interview["id"])
    assert len(fetched["answers"]) == 1
    assert len(fetched["questions"]) == 1


async def test_follow_up_generated_after_transcription(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    submitted = await _submit_answer(db_client, auth_headers, interview)
    answer_id = submitted.json()["answer"]["id"]

    async def eval_needs_follow_up(self, *args, **kwargs):
        return ai_schemas.AnswerEvaluationOutput(
            score=55,
            relevance_score=60,
            correctness_score=50,
            clarity_score=55,
            depth_score=40,
            strengths=["Partial answer"],
            weaknesses=["Missing depth"],
            missing_points=["Async support"],
            improvement_feedback="Expand on async handling.",
            ideal_answer_summary="Covers FastAPI's async model.",
            follow_up_required=True,
            follow_up_reason="Answer lacks depth.",
            confidence=80,
            uncertainty_notes="",
        )

    monkeypatch.setattr(AIService, "evaluate_answer", eval_needs_follow_up)
    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["follow_up_generated"] is True
    assert data["next_question"] is not None
    assert data["is_complete"] is False

    fetched = await _fetch_interview(db_client, auth_headers, interview["id"])
    assert len(fetched["questions"]) == 2
    assert fetched["questions"][1]["is_follow_up"] is True


async def test_typed_audio_answer_also_transcribed_and_evaluated(
    db_client, auth_headers, monkeypatch
):
    # A typed answer in AUDIO mode is evaluated at submit; the uploaded
    # recording's transcript then becomes the authoritative answer text
    # while the existing evaluation is preserved (not duplicated).
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    submitted = await _submit_answer(
        db_client, auth_headers, interview, answer_text="Typed fallback."
    )
    assert submitted.status_code == 200
    assert submitted.json()["evaluation"]["score"] == 75
    answer_id = submitted.json()["answer"]["id"]

    url, files = _media_upload(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["answer"]["answer_text"] == FAKE_TRANSCRIPT
    assert data["evaluation"]["score"] == 75
