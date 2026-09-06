import pytest

pytestmark = pytest.mark.asyncio


async def _auth_token(db_client, email, password, full_name):
    await db_client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": full_name, "password": password},
    )
    login = await db_client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    return login.json()["access_token"]


def _upload_file_bytes(filename: str, content: bytes, content_type: str):
    return (filename, content, content_type)


async def _create_interview(db_client, auth_headers, monkeypatch):
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
    return interview.json()


async def test_submit_answer_and_evaluation(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    interview_id = interview["id"]
    question_id = interview["questions"][0]["id"]

    response = await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "FastAPI is a modern Python web framework."},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Answer submitted"
    assert data["answer"]["question_id"] == question_id
    assert "evaluation" in data
    if data["evaluation"]:
        assert 0 <= data["evaluation"]["score"] <= 100


async def test_empty_answer_validation(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    interview_id = interview["id"]
    question_id = interview["questions"][0]["id"]

    response = await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "   "},
        headers=auth_headers,
    )
    assert response.status_code == 400


async def test_duplicate_answer_submission(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    interview_id = interview["id"]
    question_id = interview["questions"][0]["id"]

    first = await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "Answer one."},
        headers=auth_headers,
    )
    assert first.status_code == 200

    second = await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "Answer two."},
        headers=auth_headers,
    )
    assert second.status_code == 400


async def test_complete_interview_generates_report(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    interview_id = interview["id"]
    question_id = interview["questions"][0]["id"]

    await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "FastAPI is a modern Python web framework."},
        headers=auth_headers,
    )

    response = await db_client.post(
        f"/api/v1/interviews/{interview_id}/complete",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert 0 <= data["score"] <= 100
    assert data["feedback"]
    assert isinstance(data["strengths"], list)
    assert isinstance(data["weaknesses"], list)


async def test_complete_is_idempotent(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    interview_id = interview["id"]
    question_id = interview["questions"][0]["id"]

    await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "FastAPI is a modern Python web framework."},
        headers=auth_headers,
    )

    first = await db_client.post(
        f"/api/v1/interviews/{interview_id}/complete",
        headers=auth_headers,
    )
    assert first.status_code == 200

    second = await db_client.post(
        f"/api/v1/interviews/{interview_id}/complete",
        headers=auth_headers,
    )
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]


async def test_interview_ownership_on_answer(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    interview_id = interview["id"]
    question_id = interview["questions"][0]["id"]

    other_token = await _auth_token(db_client, "other5@example.com", "password", "Other User")
    response = await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "Answer from another user."},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert response.status_code == 404


async def test_answer_to_completed_interview(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    interview_id = interview["id"]
    question_id = interview["questions"][0]["id"]

    await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "FastAPI."},
        headers=auth_headers,
    )
    await db_client.post(
        f"/api/v1/interviews/{interview_id}/complete",
        headers=auth_headers,
    )

    response = await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "Another answer."},
        headers=auth_headers,
    )
    assert response.status_code == 400


async def _evaluation_with_follow_up():
    from app.services.ai import schemas as ai_schemas
    return ai_schemas.AnswerEvaluationOutput(
        score=55,
        relevance_score=60,
        correctness_score=50,
        clarity_score=60,
        depth_score=45,
        strengths=["Some understanding"],
        weaknesses=["Lacks detail"],
        missing_points=["Async support"],
        improvement_feedback="Add more detail about async features.",
        ideal_answer_summary="A strong answer covers FastAPI async capabilities.",
        follow_up_required=True,
        follow_up_reason="Need to probe technical depth.",
        confidence=80,
        uncertainty_notes="",
    )


async def test_follow_up_question_generation_and_limit(db_client, auth_headers, monkeypatch):
    interview = await _create_interview(db_client, auth_headers, monkeypatch)
    interview_id = interview["id"]
    question_id = interview["questions"][0]["id"]

    monkeypatch.setattr(
        "app.services.ai.ai_service.AIService.evaluate_answer",
        lambda *args, **kwargs: _evaluation_with_follow_up(),
    )

    response = await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": question_id, "answer_text": "FastAPI is a framework."},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["follow_up_generated"] is True
    assert data["next_question"] is not None
    assert data["next_question"]["is_follow_up"] is True

    follow_up_id = data["next_question"]["id"]
    response2 = await db_client.post(
        f"/api/v1/interviews/{interview_id}/answers",
        json={"question_id": follow_up_id, "answer_text": "It uses async functions."},
        headers=auth_headers,
    )
    assert response2.status_code == 200

    # After max follow-ups the limit should be respected.
    interview_data = await db_client.get(
        f"/api/v1/interviews/{interview_id}", headers=auth_headers
    )
    follow_up_count = sum(1 for q in interview_data.json()["questions"] if q.get("is_follow_up"))
    assert follow_up_count <= 3
