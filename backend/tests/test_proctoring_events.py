import uuid
from datetime import datetime, timedelta, timezone

import pytest

pytestmark = pytest.mark.asyncio


def _upload_file_bytes(filename: str, content: bytes, content_type: str):
    return (filename, content, content_type)


async def _create_interview(db_client, auth_headers, monkeypatch, mode="VIDEO"):
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


async def _complete_interview(db_client, auth_headers, interview):
    question_id = interview["questions"][0]["id"]
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/answers",
        json={"question_id": question_id, "answer_text": "An answer."},
        headers=auth_headers,
    )
    assert response.status_code == 200
    complete = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/complete",
        headers=auth_headers,
    )
    assert complete.status_code == 200


def _event(client_id=None, event_type="TAB_HIDDEN", **overrides):
    now = datetime.now(timezone.utc)
    payload = {
        "client_event_id": client_id or str(uuid.uuid4()),
        "event_type": event_type,
        "severity": "INFO",
        "started_at": now.isoformat(),
        "ended_at": (now + timedelta(seconds=3)).isoformat(),
        "duration_seconds": 3.0,
        "question_id": None,
        "event_metadata": None,
    }
    payload.update(overrides)
    return payload


async def test_proctoring_events_require_auth(db_client):
    response = await db_client.post(
        f"/api/v1/interviews/{uuid.uuid4()}/proctoring-events",
        json={"events": [_event()]},
    )
    assert response.status_code == 401
    response = await db_client.get(
        f"/api/v1/interviews/{uuid.uuid4()}/proctoring-events"
    )
    assert response.status_code == 401
    response = await db_client.get(
        f"/api/v1/interviews/{uuid.uuid4()}/proctoring-summary"
    )
    assert response.status_code == 401


async def test_proctoring_events_cross_user_404(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    other = await db_client.post(
        "/api/v1/auth/register",
        json={
            "email": f"other_{uuid.uuid4().hex}@example.com",
            "full_name": "Other User",
            "password": "password",
        },
    )
    assert other.status_code == 200
    login = await db_client.post(
        "/api/v1/auth/login",
        json={"email": other.json()["email"], "password": "password"},
    )
    other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    for method in ("post", "get"):
        func = getattr(db_client, method)
        response = await func(
            f"/api/v1/interviews/{interview['id']}/proctoring-events",
            **({"json": {"events": [_event()]}} if method == "post" else {}),
            headers=other_headers,
        )
        assert response.status_code == 404
    response = await db_client.get(
        f"/api/v1/interviews/{interview['id']}/proctoring-summary",
        headers=other_headers,
    )
    assert response.status_code == 404


async def test_proctoring_batch_insert_and_retrieve(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    question_id = interview["questions"][0]["id"]
    first = _event(event_type="FACE_NOT_DETECTED", severity="WARNING",
                   question_id=question_id,
                   event_metadata={"face_count": 0, "consecutive_samples": 5})
    second = _event(event_type="WINDOW_FOCUS_LOST")
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        json={"events": [first, second]},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] == 2
    assert body["duplicates"] == 0
    assert body["rejected"] == 0

    listed = await db_client.get(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    events = listed.json()
    assert len(events) == 2
    assert {e["event_type"] for e in events} == {
        "FACE_NOT_DETECTED",
        "WINDOW_FOCUS_LOST",
    }
    face = next(e for e in events if e["event_type"] == "FACE_NOT_DETECTED")
    assert face["question_id"] == question_id
    assert face["event_metadata"]["consecutive_samples"] == 5
    # Chronological ordering
    assert events[0]["started_at"] <= events[1]["started_at"]


async def test_proctoring_duplicate_client_event_id(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    client_id = str(uuid.uuid4())
    for expected in ((1, 0), (0, 1)):
        response = await db_client.post(
            f"/api/v1/interviews/{interview['id']}/proctoring-events",
            json={"events": [_event(client_id=client_id)]},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["accepted"] == expected[0]
        assert response.json()["duplicates"] == expected[1]
    listed = await db_client.get(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        headers=auth_headers,
    )
    assert len(listed.json()) == 1


async def test_proctoring_invalid_event_type(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        json={"events": [_event(event_type="NOT_A_REAL_TYPE")]},
        headers=auth_headers,
    )
    assert response.status_code == 422


async def test_proctoring_invalid_timestamps(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    now = datetime.now(timezone.utc)
    far_future = _event(started_at=(now + timedelta(hours=2)).isoformat())
    inverted = _event(
        started_at=now.isoformat(),
        ended_at=(now - timedelta(seconds=5)).isoformat(),
    )
    future_end = _event(
        started_at=now.isoformat(),
        ended_at=(now + timedelta(hours=1)).isoformat(),
    )
    too_old = _event(
        started_at=(now - timedelta(hours=2)).isoformat(),
        ended_at=(now - timedelta(hours=2) + timedelta(seconds=3)).isoformat(),
    )
    inconsistent_duration = _event(
        started_at=(now - timedelta(seconds=10)).isoformat(),
        ended_at=now.isoformat(),
        duration_seconds=500.0,
    )
    recent_skew_ok = _event(
        started_at=(now - timedelta(minutes=30)).isoformat(),
        ended_at=(now - timedelta(minutes=30) + timedelta(seconds=3)).isoformat(),
    )
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        json={
            "events": [
                far_future,
                inverted,
                future_end,
                too_old,
                inconsistent_duration,
                recent_skew_ok,
            ]
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] == 1
    assert body["rejected"] == 5


async def test_proctoring_negative_duration_rejected(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        json={"events": [_event(duration_seconds=-1.5)]},
        headers=auth_headers,
    )
    assert response.status_code == 422


async def test_proctoring_question_ownership(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    other = await _create_interview(db_client, auth_headers, monkeypatch)
    foreign_question = other["questions"][0]["id"]
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        json={
            "events": [
                _event(question_id=foreign_question),
                _event(question_id=str(uuid.uuid4())),
                _event(question_id=interview["questions"][0]["id"]),
            ]
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["accepted"] == 3
    listed = await db_client.get(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        headers=auth_headers,
    )
    events = listed.json()
    # A question from another interview is nulled, never linked.
    assert events[0]["question_id"] is None
    assert events[1]["question_id"] is None
    assert events[2]["question_id"] == interview["questions"][0]["id"]


async def test_proctoring_metadata_validation(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    oversized = _event(event_metadata={"reason": "x" * 3000})
    whitelisted = _event(
        event_metadata={"face_count": 2, "unknown_key": "stripped"}
    )
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        json={"events": [oversized, whitelisted]},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] == 1
    assert body["rejected"] == 1
    listed = await db_client.get(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        headers=auth_headers,
    )
    stored = listed.json()[0]["event_metadata"]
    assert stored == {"face_count": 2}


async def test_proctoring_event_count_limit(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    url = f"/api/v1/interviews/{interview['id']}/proctoring-events"
    for _ in range(10):
        response = await db_client.post(
            url,
            json={"events": [_event() for _ in range(100)]},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["accepted"] == 100
    response = await db_client.post(
        url, json={"events": [_event()]}, headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] == 0
    assert body["limit_reached"] is True


async def test_proctoring_completed_interview_drops_events(
    db_client, auth_headers, monkeypatch
):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    await _complete_interview(db_client, auth_headers, interview)
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        json={"events": [_event(), _event()]},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] == 0
    assert body["rejected"] == 2
    listed = await db_client.get(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        headers=auth_headers,
    )
    assert listed.json() == []


async def test_proctoring_summary(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    now = datetime.now(timezone.utc)
    events = [
        _event(
            event_type="FACE_NOT_DETECTED",
            severity="WARNING",
            started_at=(now - timedelta(seconds=30)).isoformat(),
            ended_at=(now - timedelta(seconds=20)).isoformat(),
            duration_seconds=10.0,
        ),
        _event(
            event_type="FACE_NOT_DETECTED",
            severity="WARNING",
            started_at=(now - timedelta(seconds=10)).isoformat(),
            ended_at=now.isoformat(),
            duration_seconds=10.0,
        ),
        _event(event_type="TAB_HIDDEN"),
    ]
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/proctoring-events",
        json={"events": events},
        headers=auth_headers,
    )
    assert response.json()["accepted"] == 3

    summary = await db_client.get(
        f"/api/v1/interviews/{interview['id']}/proctoring-summary",
        headers=auth_headers,
    )
    assert summary.status_code == 200
    body = summary.json()
    assert body["total_events"] == 3
    assert body["counts"]["FACE_NOT_DETECTED"] == 2
    assert body["counts"]["TAB_HIDDEN"] == 1
    assert body["durations_seconds"]["FACE_NOT_DETECTED"] == 20.0
    assert body["first_event_at"] is not None
    assert body["last_event_at"] is not None
    assert body["event_window_seconds"] > 0


async def test_proctoring_consent(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    response = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/proctoring-consent",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["proctoring_consent_at"] is not None

    # Idempotent — earliest acknowledgement is kept.
    first_ts = response.json()["proctoring_consent_at"]
    again = await db_client.post(
        f"/api/v1/interviews/{interview['id']}/proctoring-consent",
        headers=auth_headers,
    )
    assert again.json()["proctoring_consent_at"] == first_ts

    summary = await db_client.get(
        f"/api/v1/interviews/{interview['id']}/proctoring-summary",
        headers=auth_headers,
    )
    assert summary.json()["consent_acknowledged_at"] == first_ts
