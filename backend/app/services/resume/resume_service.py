import os
import uuid
from functools import lru_cache
from typing import List

import anyio
from fastapi import UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession
from supabase import Client, create_client

from app.core.config import get_settings
from app.exception import CustomException
from app.schemas.resume import ResumeCreate, ResumeResponse
from app.services.ai.ai_service import AIService
from app.services.resume.pdf_extractor import extract_text_from_pdf
from app.services.resume.resume_query import ResumeQuery

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads",
    "resumes",
)

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@lru_cache
def _get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def _supabase_configured() -> bool:
    settings = get_settings()
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)


def _upload_resume_file(storage_path: str, content: bytes) -> str:
    """Store a resume PDF and return the reference to persist in resumes.file_path.

    Supabase Storage is used whenever it is configured. When it is not, local
    development falls back to uploads/resumes on disk; production refuses to
    silently degrade and returns 503 instead.
    """
    settings = get_settings()
    if not _supabase_configured():
        if settings.ENVIRONMENT.lower() == "production":
            raise CustomException(503, "Resume storage is not configured.")
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        local_path = os.path.join(UPLOAD_DIR, storage_path)
        with open(local_path, "wb") as f:
            f.write(content)
        return local_path
    try:
        _get_supabase_client().storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": "application/pdf"},
        )
    except CustomException:
        raise
    except Exception as exc:
        raise CustomException(502, f"Resume storage upload failed: {type(exc).__name__}") from exc
    return storage_path


class Resume:
    def __init__(self, db: AsyncSession):
        self._query = ResumeQuery(db)
        self._ai = AIService()

    async def create_resume(
        self, user_id: uuid.UUID, file: UploadFile
    ) -> ResumeResponse:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise CustomException(400, "Only PDF files are allowed")
        content = await file.read()
        if len(content) > _MAX_UPLOAD_BYTES:
            raise CustomException(413, "PDF must be 10 MB or smaller")
        extracted_text = extract_text_from_pdf(content)
        analysis = await self._ai.analyze_resume(extracted_text)
        safe_name = os.path.basename(file.filename).replace("\\", "_").replace("/", "_")
        storage_path = f"{uuid.uuid4()}_{safe_name}"
        file_path = await anyio.to_thread.run_sync(
            _upload_resume_file, storage_path, content
        )
        skills = (
            analysis.technical_skills
            + analysis.programming_languages
            + analysis.frameworks
            + analysis.tools
        )
        create = ResumeCreate(
            filename=safe_name,
            file_size=len(content),
            file_path=file_path,
            extracted_text=extracted_text,
            skills=skills,
            analysis=analysis.model_dump(),
        )
        resume = await self._query.create(create, user_id, file_path)
        return ResumeResponse.model_validate(resume)

    async def get_by_id(
        self, user_id: uuid.UUID, resume_id: uuid.UUID
    ) -> ResumeResponse:
        resume = await self._query.get_by_id(resume_id)
        if not resume or resume.user_id != user_id:
            raise CustomException(404, "Resume not found")
        return ResumeResponse.model_validate(resume)

    async def get_latest(
        self, user_id: uuid.UUID
    ) -> ResumeResponse | None:
        resume = await self._query.get_latest(user_id)
        if resume:
            return ResumeResponse.model_validate(resume)
        return None

    async def get_all(self, user_id: uuid.UUID) -> List[ResumeResponse]:
        resumes = await self._query.get_all(user_id)
        return [ResumeResponse.model_validate(r) for r in resumes]
