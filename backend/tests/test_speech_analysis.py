import pytest

from app.exception import CustomException
from app.services.ai import schemas as ai_schemas
from app.services.ai.ai_service import AIService
from app.services.interview.speech_analysis import (
    compute_speech_metrics,
    detect_fillers,
    sanitize_pause_stats,
    tokenize,
    vocabulary_metrics,
    words_per_minute,
)

FAKE_TRANSCRIPT = "This is the candidate's spoken answer."


def _upload_file_bytes(filename: str, content: bytes, content_type: str):
    return (filename, content, content_type)


async def _create_interview(db_client, auth_headers, monkeypatch, mode="AUDIO"):
    monkeypatch.setattr(
        "app.services.resume.resume_service.extract_text_from_pdf",
        lambda _bytes: "Sample resume text",
    )
    resume = await db_client.post(
        "/api/v1/resume/upload",
        files={
            "file": _upload_file_bytes(
                "resume.pdf", b"%PDF fake", "application/pdf"
            )
        },
        headers=auth_headers,
    )
    assert resume.status_code == 200
    job = await db_client.post(
        "/api/v1/job-descriptions",
        json={
            "title": "Backend Engineer",
            "description": "Python FastAPI role",
        },
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


async def _submit_answer(db_client, auth_headers, interview):
    question_id = interview["questions"][0]["id"]
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/answers",
        json={
            "question_id": question_id,
            "answer_text": "",
            "skipped": False,
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    return response.json()["answer"]["id"]


def _media_request(
    answer_id,
    interview_id,
    mime="audio/webm",
    data=None,
):
    url = f"/api/v1/interviews/{interview_id}/answers/{answer_id}/media"
    return url, {"file": _upload_file_bytes("recording", b"fake-media", mime)}, data


async def _fetch_interview(db_client, auth_headers, interview_id):
    fetched = await db_client.get(
        f"/api/v1/interviews/{interview_id}", headers=auth_headers
    )
    assert fetched.status_code == 200
    return fetched.json()


# ---------------------------------------------------------------------------
# Pure deterministic metrics
# ---------------------------------------------------------------------------


def test_word_count():
    assert len(tokenize("This is the candidate's spoken answer.")) == 6
    assert compute_speech_metrics("")["word_count"] == 0


def test_words_per_minute():
    assert words_per_minute(120, 60) == 120.0
    assert words_per_minute(60, 120) == 30.0
    assert words_per_minute(50, None) is None
    assert words_per_minute(50, 0) is None


def test_speech_metrics_wpm_variants():
    metrics = compute_speech_metrics(
        "one two three four five six", recording_seconds=6.0,
        speech_seconds=3.0,
    )
    assert metrics["wpm_recording"] == 60.0
    assert metrics["wpm_speech"] == 120.0
    without_pauses = compute_speech_metrics(
        "one two three", recording_seconds=6.0
    )
    assert without_pauses["wpm_speech"] is None


def test_unambiguous_filler_detection():
    fillers = detect_fillers("um uh hmm, you know, I mean, sort of, kind of")
    assert fillers["unambiguous"] == 7
    assert fillers["ambiguous"] == 0
    assert fillers["breakdown"]["you know"]["count"] == 1
    assert fillers["breakdown"]["you know"]["ambiguous"] is False


def test_ambiguous_filler_discourse_marker_counted():
    fillers = detect_fillers(
        "So, um, like it was, you know, basically hard, actually."
    )
    assert fillers["ambiguous"] >= 3
    assert fillers["breakdown"]["so"]["ambiguous"] is True
    assert fillers["breakdown"]["like"]["ambiguous"] is True
    assert fillers["breakdown"]["basically"]["ambiguous"] is True


def test_legitimate_usage_not_counted_as_filler():
    # "like" as verb/preposition, "so" connective, "well"/"right" as words.
    fillers = detect_fillers(
        "I like FastAPI because it works like a charm, so that the tests "
        "run fast. It works well and returns the right answer."
    )
    assert fillers["count"] == 0


def test_technical_terms_not_counted():
    fillers = detect_fillers(
        "We use PostgreSQL with FastAPI, Redis for caching, and Docker "
        "for deployment."
    )
    assert fillers["count"] == 0


def test_filler_per_100_words():
    metrics = compute_speech_metrics(
        "um ".join([""] * 5) + " ".join(f"w{i}" for i in range(100))
    )
    # 4 "um" fillers in 104 words.
    assert metrics["filler_count"] == 4
    assert metrics["filler_per_100_words"] == pytest.approx(3.8, abs=0.1)


def test_vocabulary_metrics():
    metrics = vocabulary_metrics(
        "the the the cache cache cache cache api api api latency"
    )
    assert metrics["unique_word_ratio"] is not None
    repeated = {r["word"]: r["count"] for r in metrics["top_repeated_words"]}
    # "the" is a stopword — excluded; content words surface instead.
    assert "the" not in repeated
    assert repeated.get("cache") == 4
    assert repeated.get("api") == 3


def test_short_and_empty_transcripts():
    empty = compute_speech_metrics("")
    assert empty["word_count"] == 0
    assert empty["filler_count"] == 0
    assert empty["filler_per_100_words"] is None
    assert empty["unique_word_ratio"] is None
    short = compute_speech_metrics("yes", recording_seconds=2.0)
    assert short["word_count"] == 1
    assert short["wpm_recording"] == 30.0


def test_sanitize_pause_stats_valid():
    stats = sanitize_pause_stats(60.0, 4, 10.0, 3.0, 50.0)
    assert stats["pause_count"] == 4
    assert stats["pause_total_seconds"] == 10.0
    assert stats["pause_longest_seconds"] == 3.0
    assert stats["speech_seconds"] == 50.0


def test_sanitize_pause_stats_discards_invalid():
    assert sanitize_pause_stats(60.0, -1, 5.0, 2.0, 50.0)[
        "pause_count"
    ] is None
    assert sanitize_pause_stats(60.0, 0, 5.0, 2.0, 50.0)[
        "pause_total_seconds"
    ] is None
    assert sanitize_pause_stats(60.0, 4, -5.0, 2.0, 50.0) == {
        "pause_count": None,
        "pause_total_seconds": None,
        "pause_longest_seconds": None,
        "speech_seconds": None,
    }


def test_sanitize_pause_stats_clamps_to_duration():
    stats = sanitize_pause_stats(30.0, 5, 40.0, 12.0, 35.0)
    assert stats["pause_total_seconds"] == 30.0
    assert stats["pause_longest_seconds"] == 12.0
    assert stats["speech_seconds"] == 0.0
    # Longest cannot exceed the (clamped) total.
    stats2 = sanitize_pause_stats(30.0, 2, 10.0, 20.0, 25.0)
    assert stats2["pause_longest_seconds"] == 10.0


# ---------------------------------------------------------------------------
# Pipeline integration
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_speech_analysis_populated_on_upload(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    answer_id = await _submit_answer(db_client, auth_headers, interview)

    url, files, data = _media_request(
        answer_id, interview["id"], data={"duration_seconds": "12.0"}
    )
    response = await db_client.post(
        url, files=files, data=data, headers=auth_headers
    )
    assert response.status_code == 200
    analysis = response.json()["media"]["speech_analysis"]
    assert analysis["status"] == "COMPLETED"
    assert analysis["word_count"] == 6
    assert analysis["wpm_recording"] == 30.0
    assert analysis["filler_count"] == 0
    assert analysis["structure_summary"]
    assert analysis["communication_strengths"]
    assert analysis["analyzed_at"]

    fetched = await _fetch_interview(db_client, auth_headers, interview["id"])
    nested = fetched["answers"][0]["media"]["speech_analysis"]
    assert nested["id"] == analysis["id"]
    assert nested["word_count"] == 6


@pytest.mark.asyncio
async def test_speech_analysis_uses_client_pause_stats(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    answer_id = await _submit_answer(db_client, auth_headers, interview)

    url, files, data = _media_request(
        answer_id,
        interview["id"],
        data={
            "duration_seconds": "12.0",
            "pause_count": "2",
            "pause_total_seconds": "4.0",
            "pause_longest_seconds": "3.0",
            "speech_seconds": "8.0",
        },
    )
    response = await db_client.post(
        url, files=files, data=data, headers=auth_headers
    )
    assert response.status_code == 200
    analysis = response.json()["media"]["speech_analysis"]
    assert analysis["pause_count"] == 2
    assert analysis["pause_total_seconds"] == 4.0
    assert analysis["pause_longest_seconds"] == 3.0
    assert analysis["pause_avg_seconds"] == 2.0
    assert analysis["speech_seconds"] == 8.0
    assert analysis["wpm_speech"] == 45.0


@pytest.mark.asyncio
async def test_speech_analysis_invalid_pause_stats_discarded(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    answer_id = await _submit_answer(db_client, auth_headers, interview)

    url, files, data = _media_request(
        answer_id,
        interview["id"],
        data={
            "duration_seconds": "12.0",
            "pause_count": "-3",
            "pause_total_seconds": "4.0",
            "pause_longest_seconds": "3.0",
            "speech_seconds": "8.0",
        },
    )
    response = await db_client.post(
        url, files=files, data=data, headers=auth_headers
    )
    assert response.status_code == 200
    analysis = response.json()["media"]["speech_analysis"]
    assert analysis["status"] == "COMPLETED"
    assert analysis["pause_count"] is None
    assert analysis["speech_seconds"] is None


@pytest.mark.asyncio
async def test_speech_analysis_fillers_from_transcript(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    answer_id = await _submit_answer(db_client, auth_headers, interview)
    mock_transcription.transcript = (
        "Um, so, like, I would basically use FastAPI, you know, "
        "because I like it."
    )
    url, files, _ = _media_request(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=auth_headers)
    analysis = response.json()["media"]["speech_analysis"]
    assert analysis["filler_count"] >= 3
    breakdown = analysis["filler_breakdown"]
    assert breakdown["um"]["ambiguous"] is False
    assert breakdown["so"]["ambiguous"] is True


@pytest.mark.asyncio
async def test_ai_failure_preserves_deterministic_metrics(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    answer_id = await _submit_answer(db_client, auth_headers, interview)

    async def broken_communication(self, *args, **kwargs):
        raise CustomException(502, "Gemini request failed: Boom")

    monkeypatch.setattr(
        AIService, "analyze_communication", broken_communication
    )
    url, files, data = _media_request(
        answer_id, interview["id"], data={"duration_seconds": "12.0"}
    )
    response = await db_client.post(
        url, files=files, data=data, headers=auth_headers
    )
    # Upload itself succeeds — AI failure only marks the analysis FAILED.
    assert response.status_code == 200
    analysis = response.json()["media"]["speech_analysis"]
    assert analysis["status"] == "FAILED"
    assert analysis["analysis_error"]
    assert analysis["word_count"] == 6
    assert analysis["wpm_recording"] == 30.0
    assert analysis["structure_summary"] is None


@pytest.mark.asyncio
async def test_retry_after_ai_failure_skips_transcription(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    answer_id = await _submit_answer(db_client, auth_headers, interview)

    original = AIService.analyze_communication

    async def broken_communication(self, *args, **kwargs):
        raise CustomException(502, "Gemini request failed: Boom")

    monkeypatch.setattr(
        AIService, "analyze_communication", broken_communication
    )
    url, files, _ = _media_request(answer_id, interview["id"])
    first = await db_client.post(url, files=files, headers=auth_headers)
    assert first.json()["media"]["speech_analysis"]["status"] == "FAILED"

    monkeypatch.setattr(AIService, "analyze_communication", original)
    retry = await db_client.post(url, files=files, headers=auth_headers)
    analysis = retry.json()["media"]["speech_analysis"]
    assert analysis["status"] == "COMPLETED"
    assert analysis["structure_summary"]
    assert analysis["id"] == first.json()["media"]["speech_analysis"]["id"]
    # Transcription never re-ran — only the failed AI analysis retried.
    assert mock_transcription.calls == ["audio/webm"]


@pytest.mark.asyncio
async def test_completed_analysis_not_duplicated_or_recomputed(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    answer_id = await _submit_answer(db_client, auth_headers, interview)

    calls = []

    async def counting_communication(self, *args, **kwargs):
        calls.append(1)
        return ai_schemas.SpeechCommunicationOutput(
            structure_summary="x",
            organization_notes=[],
            clarity_notes="",
            communication_strengths=[],
            communication_improvements=[],
        )

    monkeypatch.setattr(
        AIService, "analyze_communication", counting_communication
    )
    url, files, _ = _media_request(answer_id, interview["id"])
    first = await db_client.post(url, files=files, headers=auth_headers)
    assert first.json()["media"]["speech_analysis"]["status"] == "COMPLETED"
    second = await db_client.post(url, files=files, headers=auth_headers)
    second_analysis = second.json()["media"]["speech_analysis"]
    assert second_analysis["id"] == first.json()["media"]["speech_analysis"]["id"]
    # One row, one AI call, one transcription — nothing duplicated.
    assert calls == [1]
    assert mock_transcription.calls == ["audio/webm"]

    fetched = await _fetch_interview(db_client, auth_headers, interview["id"])
    assert len(fetched["answers"]) == 1


@pytest.mark.asyncio
async def test_speech_analysis_cross_user_404(
    db_client, auth_headers, test_user, db_session, monkeypatch,
    mock_transcription,
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    answer_id = await _submit_answer(db_client, auth_headers, interview)

    from app.core.security import create_access_token
    from app.models.user import User
    import uuid as _uuid
    from app.core.security import get_password_hash

    other = User(
        email=f"other_{_uuid.uuid4().hex}@example.com",
        full_name="Other User",
        hashed_password=get_password_hash("password"),
    )
    db_session.add(other)
    await db_session.commit()
    await db_session.refresh(other)
    other_headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(other.id)})}"
    }
    url, files, _ = _media_request(answer_id, interview["id"])
    response = await db_client.post(url, files=files, headers=other_headers)
    assert response.status_code == 404
    fetched = await db_client.get(
        f"/api/v1/interviews/{interview['id']}", headers=other_headers
    )
    assert fetched.status_code == 404


@pytest.mark.asyncio
async def test_speech_analysis_completed_interview_rejects_upload(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    answer_id = await _submit_answer(db_client, auth_headers, interview)
    url, files, _ = _media_request(answer_id, interview["id"])
    await db_client.post(url, files=files, headers=auth_headers)
    completed = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/complete",
        headers=auth_headers,
    )
    assert completed.status_code == 200
    retry = await db_client.post(url, files=files, headers=auth_headers)
    assert retry.status_code == 400


@pytest.mark.asyncio
async def test_text_interview_has_no_speech_analysis(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="TEXT"
    )
    question_id = interview["questions"][0]["id"]
    submitted = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/answers",
        json={
            "question_id": question_id,
            "answer_text": "Typed answer.",
            "skipped": False,
        },
        headers=auth_headers,
    )
    assert submitted.status_code == 200
    fetched = await _fetch_interview(db_client, auth_headers, interview["id"])
    assert fetched["answers"][0]["media"] is None
