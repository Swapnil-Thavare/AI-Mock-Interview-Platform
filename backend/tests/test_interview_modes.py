import pytest

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


async def _create_interview(db_client, auth_headers, monkeypatch, mode=None):
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
    resume_id = resume.json()["id"]

    job = await db_client.post(
        "/api/v1/job-descriptions",
        json={"title": "Backend Engineer", "description": "Python FastAPI role"},
        headers=auth_headers,
    )
    assert job.status_code == 200
    job_id = job.json()["id"]

    payload = {
        "title": "Mock Interview",
        "resume_id": resume_id,
        "job_description_id": job_id,
        "difficulty": "medium",
        "question_count": 1,
        "duration": 30,
        "question_types": ["technical"],
    }
    if mode is not None:
        payload["interview_mode"] = mode
    return await db_client.post(
        "/api/v1/interviews", json=payload, headers=auth_headers
    )


@pytest.mark.parametrize("mode", ["TEXT", "AUDIO", "VIDEO"])
async def test_create_interview_with_mode(db_client, auth_headers, monkeypatch, mode):
    response = await _create_interview(db_client, auth_headers, monkeypatch, mode=mode)
    assert response.status_code == 200
    data = response.json()
    assert data["interview_mode"] == mode
    # Existing creation behavior stays intact.
    assert data["status"] in ("in-progress", "in_progress")
    assert len(data["questions"]) >= 1
    assert data["difficulty"] == "medium"


async def test_create_interview_defaults_to_text(db_client, auth_headers, monkeypatch):
    response = await _create_interview(db_client, auth_headers, monkeypatch)
    assert response.status_code == 200
    assert response.json()["interview_mode"] == "TEXT"


async def test_interview_mode_returned_on_get_and_list(
    db_client, auth_headers, monkeypatch
):
    create = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="VIDEO"
    )
    interview_id = create.json()["id"]

    fetched = await db_client.get(
        f"/api/v1/interviews/{interview_id}", headers=auth_headers
    )
    assert fetched.status_code == 200
    assert fetched.json()["interview_mode"] == "VIDEO"

    listing = await db_client.get("/api/v1/interviews", headers=auth_headers)
    assert listing.status_code == 200
    modes = {i["id"]: i["interview_mode"] for i in listing.json()}
    assert modes[interview_id] == "VIDEO"


async def test_invalid_interview_mode_rejected(db_client, auth_headers, monkeypatch):
    response = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="HOLOGRAM"
    )
    assert response.status_code == 422


async def test_update_interview_mode(db_client, auth_headers, monkeypatch):
    create = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="VIDEO"
    )
    interview_id = create.json()["id"]

    updated = await db_client.patch(
        f"/api/v1/interviews/{interview_id}/mode",
        json={"interview_mode": "AUDIO"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["interview_mode"] == "AUDIO"

    fetched = await db_client.get(
        f"/api/v1/interviews/{interview_id}", headers=auth_headers
    )
    assert fetched.json()["interview_mode"] == "AUDIO"

    bad = await db_client.patch(
        f"/api/v1/interviews/{interview_id}/mode",
        json={"interview_mode": "HOLOGRAM"},
        headers=auth_headers,
    )
    assert bad.status_code == 422


async def test_update_mode_ownership_and_completed_interview(
    db_client, auth_headers, monkeypatch
):
    create = await _create_interview(
        db_client, auth_headers, monkeypatch, mode="AUDIO"
    )
    interview_id = create.json()["id"]
    question_id = create.json()["questions"][0]["id"]

    other_token = await _auth_token(
        db_client, "mode_other@example.com", "password", "Other User"
    )
    forbidden = await db_client.patch(
        f"/api/v1/interviews/{interview_id}/mode",
        json={"interview_mode": "TEXT"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert forbidden.status_code == 404

    await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "An answer."},
        headers=auth_headers,
    )
    await db_client.post(
        f"/api/v1/interviews/{interview_id}/complete", headers=auth_headers
    )

    completed = await db_client.patch(
        f"/api/v1/interviews/{interview_id}/mode",
        json={"interview_mode": "TEXT"},
        headers=auth_headers,
    )
    assert completed.status_code == 400
