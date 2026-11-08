import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.core.security import create_access_token, get_password_hash
from app.exception import CustomException
from app.models.user import User
from app.services.ai import schemas as ai_schemas
from app.services.ai.ai_service import AIService

pytestmark = pytest.mark.asyncio


def _upload_file_bytes(filename: str, content: bytes, content_type: str):
    return (filename, content, content_type)


async def _create_interview(
    db_client, auth_headers, monkeypatch, mode="AUDIO", questions=None
):
    monkeypatch.setattr(
        "app.services.resume.resume_service.extract_text_from_pdf",
        lambda _bytes: "Sample resume text",
    )
    if questions is not None:

        async def _fixed_questions(self, *args, **kwargs):
            return questions

        monkeypatch.setattr(
            AIService, "generate_interview_questions", _fixed_questions
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
            "company": "Acme Corp",
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


def _q(text, qtype="technical"):
    return {
        "question": text,
        "question_type": qtype,
        "difficulty": "easy",
        "topic": "topic",
        "expected_focus": "focus",
    }


async def _submit_answer(db_client, auth_headers, interview, question, **kw):
    payload = {
        "question_id": question["id"],
        "answer_text": kw.get("answer_text", "An answer."),
        "skipped": kw.get("skipped", False),
    }
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/answers",
        json=payload,
        headers=auth_headers,
    )
    assert response.status_code == 200
    return response.json()


async def _upload_media(
    db_client, auth_headers, interview_id, answer_id, mime="audio/webm", data=None
):
    return await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers/{answer_id}/media",
        files={"file": _upload_file_bytes("recording", b"fake-media", mime)},
        data=data,
        headers=auth_headers,
    )


async def _complete(db_client, auth_headers, interview_id):
    response = await db_client.post(
        f"/api/v1/interviews/{interview_id}/complete",
        headers=auth_headers,
    )
    assert response.status_code == 200
    return response.json()


async def _get_report(db_client, headers, interview_id):
    return await db_client.get(
        f"/api/v1/interviews/{interview_id}/report", headers=headers
    )


def _event(client_id=None, event_type="TAB_HIDDEN", **overrides):
    now = datetime.now(timezone.utc)
    payload = {
        "client_event_id": client_id or str(uuid.uuid4()),
        "event_type": event_type,
        "started_at": now.isoformat(),
        "ended_at": (now + timedelta(seconds=3)).isoformat(),
        "duration_seconds": 3.0,
    }
    payload.update(overrides)
    return payload


def _walk_keys(node):
    if isinstance(node, dict):
        for key, value in node.items():
            yield key
            yield from _walk_keys(value)
    elif isinstance(node, list):
        for item in node:
            yield from _walk_keys(item)


# ---------------------------------------------------------------------------
# Mode coverage
# ---------------------------------------------------------------------------


async def test_text_report(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(
        db_client,
        auth_headers,
        monkeypatch,
        mode="TEXT",
        questions=[_q("First?"), _q("Second?")],
    )
    await _submit_answer(
        db_client, auth_headers, interview, interview["questions"][0]
    )
    await _submit_answer(
        db_client,
        auth_headers,
        interview,
        interview["questions"][1],
        answer_text="",
        skipped=True,
    )
    await _complete(db_client, auth_headers, interview["id"])

    response = await _get_report(db_client, auth_headers, interview["id"])
    assert response.status_code == 200
    report = response.json()

    assert report["candidate_name"] == "Test User"
    assert report["job_title"] == "Backend Engineer"
    assert report["company"] == "Acme Corp"
    assert report["report_id"] == report["result"]["id"]
    assert report["generated_at"]

    overview = report["overview"]
    assert overview["interview_mode"] == "TEXT"
    assert overview["status"] == "completed"
    assert overview["total_questions"] == 2
    assert overview["answered_count"] == 1
    assert overview["skipped_count"] == 1
    assert overview["pending_count"] == 0
    assert overview["unavailable_count"] == 0
    assert overview["follow_up_count"] == 0
    assert overview["configured_duration_minutes"] == 30
    assert overview["elapsed_seconds"] is not None
    assert overview["elapsed_seconds"] >= 0

    # TEXT interviews have no voice sections at all.
    assert report["communication"] is None
    assert report["session_integrity"] is None

    assert len(report["questions"]) == 2
    assert report["questions"][0]["answer_status"] == "answered"
    assert report["questions"][1]["answer_status"] == "skipped"


async def test_audio_report_with_speech_aggregate(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client,
        auth_headers,
        monkeypatch,
        mode="AUDIO",
        questions=[_q("First?"), _q("Second?")],
    )
    mock_transcription.transcript = (
        "Um, so, like, I would basically use FastAPI, you know, "
        "because I like it."
    )

    first = await _submit_answer(
        db_client,
        auth_headers,
        interview,
        interview["questions"][0],
        answer_text="",
    )
    second = await _submit_answer(
        db_client,
        auth_headers,
        interview,
        interview["questions"][1],
        answer_text="",
    )
    r1 = await _upload_media(
        db_client,
        auth_headers,
        interview["id"],
        first["answer"]["id"],
        data={
            "duration_seconds": "12.0",
            "pause_count": "2",
            "pause_total_seconds": "4.0",
            "pause_longest_seconds": "3.0",
            "speech_seconds": "8.0",
        },
    )
    assert r1.status_code == 200
    r2 = await _upload_media(
        db_client,
        auth_headers,
        interview["id"],
        second["answer"]["id"],
        data={"duration_seconds": "6.0"},
    )
    assert r2.status_code == 200
    await _complete(db_client, auth_headers, interview["id"])

    report = (await _get_report(db_client, auth_headers, interview["id"])).json()

    overview = report["overview"]
    assert overview["interview_mode"] == "AUDIO"
    assert overview["answered_count"] == 2
    assert overview["skipped_count"] == 0
    assert overview["pending_count"] == 0

    aggregate = report["communication"]
    assert aggregate is not None
    assert aggregate["answers_analyzed"] == 2
    # 14 words over 12s = 70 wpm; over 6s = 140 wpm -> avg 105.
    assert aggregate["avg_wpm_recording"] == 105.0
    # Only the first answer reported speech_seconds -> 14 words/8s = 105 wpm.
    assert aggregate["avg_wpm_speech"] == 105.0
    assert aggregate["total_pause_seconds"] == 4.0
    # Per transcript: definite = um + "you know" = 2; possible = so/like/
    # basically = 3. Two answers -> 4 definite, 6 possible.
    assert aggregate["definite_filler_total"] == 4
    assert aggregate["possible_filler_total"] == 6

    block = report["questions"][0]
    assert block["answer_status"] == "answered"
    assert block["media"]["transcript_text"].startswith("Um, so, like")
    assert block["media"]["transcription_status"] == "COMPLETED"
    assert block["speech_analysis"]["status"] == "COMPLETED"
    assert block["speech_analysis"]["wpm_recording"] == 70.0


async def test_video_report_with_proctoring(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="VIDEO"
    )
    submitted = await _submit_answer(
        db_client,
        auth_headers,
        interview,
        interview["questions"][0],
        answer_text="",
    )
    upload = await _upload_media(
        db_client,
        auth_headers,
        interview["id"],
        submitted["answer"]["id"],
        mime="video/webm",
        data={"duration_seconds": "10.0"},
    )
    assert upload.status_code == 200

    events = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        json={
            "events": [
                _event(event_type="FACE_NOT_DETECTED"),
                _event(event_type="TAB_HIDDEN"),
            ]
        },
        headers=auth_headers,
    )
    assert events.status_code == 200
    await _complete(db_client, auth_headers, interview["id"])

    report = (await _get_report(db_client, auth_headers, interview["id"])).json()

    integrity = report["session_integrity"]
    assert integrity is not None
    assert integrity["summary"]["total_events"] == 2
    assert integrity["summary"]["counts"]["FACE_NOT_DETECTED"] == 1
    assert integrity["summary"]["counts"]["TAB_HIDDEN"] == 1
    assert len(integrity["events"]) == 2
    assert integrity["disclaimer"]
    # Raw client metadata must not be echoed into the report.
    assert "event_metadata" not in integrity["events"][0]
    assert "storage_key" not in integrity["events"][0]

    assert report["communication"] is not None
    assert report["communication"]["answers_analyzed"] == 1


# ---------------------------------------------------------------------------
# Question-wise content
# ---------------------------------------------------------------------------


async def test_report_question_evaluation_fields(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="TEXT"
    )
    await _submit_answer(
        db_client, auth_headers, interview, interview["questions"][0]
    )
    await _complete(db_client, auth_headers, interview["id"])

    report = (await _get_report(db_client, auth_headers, interview["id"])).json()
    block = report["questions"][0]

    assert block["question_text"] == "What is FastAPI?"
    assert block["expected_focus"] == "Understanding of ASGI"
    assert block["score"] == 75
    evaluation = block["evaluation"]
    assert evaluation["score"] == 75
    assert evaluation["relevance_score"] == 80
    assert evaluation["correctness_score"] == 70
    assert evaluation["clarity_score"] == 75
    assert evaluation["depth_score"] == 70
    assert evaluation["missing_points"] == ["Middleware"]
    assert evaluation["improvement_feedback"]
    assert evaluation["ideal_answer_summary"]


async def test_report_follow_up_relationship(
    db_client, auth_headers, monkeypatch
):
    calls = {"count": 0}

    async def needs_follow_up(self, *args, **kwargs):
        calls["count"] += 1
        return ai_schemas.AnswerEvaluationOutput(
            score=40,
            relevance_score=40,
            correctness_score=40,
            clarity_score=40,
            depth_score=40,
            # Only the first answer should trigger a follow-up — otherwise
            # the follow-up's own evaluation chains another one.
            follow_up_required=calls["count"] == 1,
            follow_up_reason="Probe the missing middleware detail",
            confidence=80,
            uncertainty_notes="",
        )

    monkeypatch.setattr(AIService, "evaluate_answer", needs_follow_up)
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="TEXT"
    )
    first = await _submit_answer(
        db_client, auth_headers, interview, interview["questions"][0]
    )
    assert first["follow_up_generated"] is True
    follow_up = first["next_question"]
    assert follow_up["is_follow_up"] is True
    await _submit_answer(
        db_client, auth_headers, interview, follow_up
    )
    await _complete(db_client, auth_headers, interview["id"])

    report = (await _get_report(db_client, auth_headers, interview["id"])).json()

    assert report["overview"]["total_questions"] == 2
    assert report["overview"]["follow_up_count"] == 1
    parent, child = report["questions"]
    assert parent["is_follow_up"] is False
    assert child["is_follow_up"] is True
    assert child["parent_question_id"] == parent["question_id"]
    assert child["follow_up_reason"] == "Probe the missing middleware detail"
    assert child["order"] > parent["order"]


# ---------------------------------------------------------------------------
# Answer-state classification
# ---------------------------------------------------------------------------


async def test_audio_placeholder_is_pending_not_skipped(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    await _submit_answer(
        db_client,
        auth_headers,
        interview,
        interview["questions"][0],
        answer_text="",
    )
    await _complete(db_client, auth_headers, interview["id"])

    report = (await _get_report(db_client, auth_headers, interview["id"])).json()

    assert report["questions"][0]["answer_status"] == "pending"
    assert report["overview"]["skipped_count"] == 0
    assert report["overview"]["pending_count"] == 1
    assert report["communication"]["answers_analyzed"] == 0


async def test_failed_transcription_marks_answer_unavailable(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    submitted = await _submit_answer(
        db_client,
        auth_headers,
        interview,
        interview["questions"][0],
        answer_text="",
    )
    mock_transcription.error = CustomException(502, "Transcription failed")
    upload = await _upload_media(
        db_client,
        auth_headers,
        interview["id"],
        submitted["answer"]["id"],
    )
    assert upload.status_code == 502
    await _complete(db_client, auth_headers, interview["id"])

    report = (await _get_report(db_client, auth_headers, interview["id"])).json()
    block = report["questions"][0]

    assert block["answer_status"] == "unavailable"
    assert block["answer_text"] is None
    assert block["media"]["transcription_status"] == "FAILED"
    assert block["media"]["transcript_text"] is None
    assert report["overview"]["unavailable_count"] == 1
    assert report["overview"]["skipped_count"] == 0


async def test_failed_speech_analysis_excluded_from_aggregate(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    submitted = await _submit_answer(
        db_client,
        auth_headers,
        interview,
        interview["questions"][0],
        answer_text="",
    )

    async def broken_communication(self, *args, **kwargs):
        raise CustomException(502, "Gemini request failed: Boom")

    monkeypatch.setattr(
        AIService, "analyze_communication", broken_communication
    )
    upload = await _upload_media(
        db_client,
        auth_headers,
        interview["id"],
        submitted["answer"]["id"],
        data={"duration_seconds": "12.0"},
    )
    assert upload.status_code == 200
    assert upload.json()["media"]["speech_analysis"]["status"] == "FAILED"
    await _complete(db_client, auth_headers, interview["id"])

    report = (await _get_report(db_client, auth_headers, interview["id"])).json()

    block = report["questions"][0]
    # Deterministic metrics are still attached to the question.
    assert block["speech_analysis"]["status"] == "FAILED"
    assert block["speech_analysis"]["word_count"] == 6
    # But FAILED rows do not feed the aggregate.
    assert report["communication"]["answers_analyzed"] == 0
    assert report["communication"]["avg_wpm_recording"] is None


async def test_video_report_without_proctoring_events(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="VIDEO"
    )
    submitted = await _submit_answer(
        db_client,
        auth_headers,
        interview,
        interview["questions"][0],
        answer_text="",
    )
    upload = await _upload_media(
        db_client,
        auth_headers,
        interview["id"],
        submitted["answer"]["id"],
        mime="video/webm",
    )
    assert upload.status_code == 200
    await _complete(db_client, auth_headers, interview["id"])

    report = (await _get_report(db_client, auth_headers, interview["id"])).json()

    integrity = report["session_integrity"]
    assert integrity is not None
    assert integrity["summary"]["total_events"] == 0
    assert integrity["events"] == []


# ---------------------------------------------------------------------------
# Availability and authorization
# ---------------------------------------------------------------------------


async def test_report_requires_completion(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="TEXT"
    )
    await _submit_answer(
        db_client, auth_headers, interview, interview["questions"][0]
    )
    response = await _get_report(db_client, auth_headers, interview["id"])
    assert response.status_code == 404


async def test_report_missing_interview_404(db_client, auth_headers):
    response = await _get_report(db_client, auth_headers, uuid.uuid4())
    assert response.status_code == 404


async def test_report_requires_auth(db_client):
    response = await db_client.get(
        f"/api/v1/interviews/{uuid.uuid4()}/report"
    )
    assert response.status_code == 401


async def test_report_other_user_404(
    db_client, auth_headers, db_session, monkeypatch
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="TEXT"
    )
    await _submit_answer(
        db_client, auth_headers, interview, interview["questions"][0]
    )
    await _complete(db_client, auth_headers, interview["id"])

    other = User(
        email=f"other_{uuid.uuid4().hex}@example.com",
        full_name="Other User",
        hashed_password=get_password_hash("password"),
    )
    db_session.add(other)
    await db_session.commit()
    other_headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(other.id)})}"
    }
    response = await _get_report(db_client, other_headers, interview["id"])
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# No storage internals leaked
# ---------------------------------------------------------------------------


async def test_report_exposes_no_storage_keys(
    db_client, auth_headers, monkeypatch, mock_transcription
):
    interview = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="VIDEO"
    )
    submitted = await _submit_answer(
        db_client,
        auth_headers,
        interview,
        interview["questions"][0],
        answer_text="",
    )
    upload = await _upload_media(
        db_client,
        auth_headers,
        interview["id"],
        submitted["answer"]["id"],
        mime="video/webm",
    )
    assert upload.status_code == 200
    await _complete(db_client, auth_headers, interview["id"])

    report = (await _get_report(db_client, auth_headers, interview["id"])).json()
    keys = set(_walk_keys(report))
    assert "storage_key" not in keys
    assert "file_path" not in keys
    assert "event_metadata" not in keys
