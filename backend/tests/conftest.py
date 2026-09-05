import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv

# Load backend/.env so DATABASE_URL_TEST is available to pytest.
_dotenv_path = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), ".env"
)
load_dotenv(_dotenv_path)

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.db.db import get_session
from app.main import app
from app.models.user import User

TEST_DATABASE_URL = os.getenv("DATABASE_URL_TEST")


@pytest_asyncio.fixture
async def client():
    app.dependency_overrides.pop(get_session, None)
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def engine():
    if not TEST_DATABASE_URL:
        pytest.skip(
            "DATABASE_URL_TEST is not set", allow_module_level=True
        )
    _engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=pool.NullPool,
        future=True,
    )
    async with _engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield _engine
    async with _engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await _engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def db_client(db_session):
    async def _get_session():
        yield db_session

    app.dependency_overrides[get_session] = _get_session
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


@pytest_asyncio.fixture
async def test_user(db_session):
    user = User(
        email=f"test_{uuid.uuid4().hex}@example.com",
        full_name="Test User",
        hashed_password=get_password_hash("password"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    token = create_access_token({"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def mock_gemini(monkeypatch):
    """Replace the Gemini provider with a deterministic fake in every test.

    Real network calls to the Gemini API must never be required for tests.
    """
    from app.services.ai import schemas as ai_schemas

    class FakeGeminiProvider:
        async def complete_json(self, prompt, response_schema):
            name = response_schema.__name__
            if name == "ResumeAnalysisOutput":
                return ai_schemas.ResumeAnalysisOutput(
                    summary="Test resume summary",
                    technical_skills=["Python", "FastAPI"],
                    soft_skills=["Communication"],
                    programming_languages=["Python"],
                    frameworks=["FastAPI"],
                    tools=["PostgreSQL"],
                    education=["B.Tech"],
                    experience=["Backend engineer"],
                    projects=["API service"],
                    certifications=["AWS"],
                    strengths=["Backend"],
                    improvements=["System design"],
                )
            if name == "JobDescriptionAnalysisOutput":
                return ai_schemas.JobDescriptionAnalysisOutput(
                    job_title="Backend Engineer",
                    required_skills=["Python", "FastAPI"],
                    preferred_skills=["SQLModel"],
                    technologies=["PostgreSQL"],
                    responsibilities=["Build APIs"],
                    experience_requirements=["2+ years"],
                    education_requirements=["B.Tech"],
                    important_keywords=["Python", "FastAPI", "API"],
                )
            if name == "ResumeJDMatchOutput":
                return ai_schemas.ResumeJDMatchOutput(
                    overall_match_score=85,
                    matched_skills=["Python", "FastAPI"],
                    missing_skills=["Kubernetes"],
                    strengths=["Strong backend"],
                    gaps=["DevOps"],
                    recommendations=["Learn Docker"],
                )
            if name == "InterviewQuestionsOutput":
                return ai_schemas.InterviewQuestionsOutput(
                    questions=[
                        ai_schemas.InterviewQuestionOutput(
                            question="What is FastAPI?",
                            question_type="technical",
                            difficulty="easy",
                            topic="FastAPI",
                            expected_focus="Understanding of ASGI",
                        )
                    ]
                )
            return response_schema()

    monkeypatch.setattr(
        "app.services.ai.ai_service.GeminiProvider", FakeGeminiProvider
    )
