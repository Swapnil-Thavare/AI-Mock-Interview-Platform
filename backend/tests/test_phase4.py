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
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return login.json()["access_token"]


async def test_resume_upload_pdf_validation(db_client, auth_headers):
    response = await db_client.post(
        "/api/v1/resume/upload",
        files={"file": _upload_file_bytes("resume.txt", b"not a pdf", "text/plain")},
        headers=auth_headers,
    )
    assert response.status_code == 400


async def test_resume_upload_and_analysis(db_client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "app.services.resume.resume_service.extract_text_from_pdf",
        lambda _bytes: "Sample resume text",
    )
    response = await db_client.post(
        "/api/v1/resume/upload",
        files={"file": _upload_file_bytes("resume.pdf", b"%PDF fake", "application/pdf")},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "resume.pdf"
    assert "id" in data
    assert data["analysis"]["summary"] == "Test resume summary"
    assert "Python" in data["analysis"]["technical_skills"]
    assert "Python" in data["skills"]


async def test_job_description_creation_and_analysis(db_client, auth_headers):
    response = await db_client.post(
        "/api/v1/job-descriptions",
        json={
            "title": "Backend Engineer",
            "company": "TestCo",
            "description": "We need a Python and FastAPI expert.",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Backend Engineer"
    assert data["analysis"]["job_title"] == "Backend Engineer"
    assert "Python" in data["analysis"]["required_skills"]


async def test_resume_jd_match(db_client, auth_headers, monkeypatch):
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

    match = await db_client.post(
        "/api/v1/matches",
        json={"resume_id": resume_id, "job_description_id": job_id},
        headers=auth_headers,
    )
    assert match.status_code == 200
    data = match.json()
    assert 0 <= data["overall_match_score"] <= 100
    assert data["overall_match_score"] == 85


async def test_interview_creation_ownership_and_question_generation(
    db_client, auth_headers, monkeypatch
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
    resume_id = resume.json()["id"]

    job = await db_client.post(
        "/api/v1/job-descriptions",
        json={"title": "Backend Engineer", "description": "Python FastAPI role"},
        headers=auth_headers,
    )
    assert job.status_code == 200
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
        },
        headers=auth_headers,
    )
    assert interview.status_code == 200
    data = interview.json()
    assert data["status"] in ("in-progress", "in_progress")
    assert len(data["questions"]) >= 1
    assert data["questions"][0]["question_text"]
    assert data["difficulty"] == "medium"

    # Another user should not be able to create an interview using these resources.
    other_token = await _auth_token(
        db_client, "other2@example.com", "password", "Other User"
    )
    forbidden = await db_client.post(
        "/api/v1/interviews",
        json={
            "title": "Bad Interview",
            "resume_id": resume_id,
            "job_description_id": job_id,
            "difficulty": "easy",
            "question_count": 1,
            "duration": 15,
            "question_types": ["technical"],
        },
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert forbidden.status_code == 404
