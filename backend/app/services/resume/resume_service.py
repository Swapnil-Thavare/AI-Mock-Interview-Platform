import os
import uuid
from typing import List

from fastapi import UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from app.exception import CustomException
from app.schemas.resume import ResumeCreate, ResumeResponse
from app.services.ai.ai_service import AIService
from app.services.resume.resume_query import ResumeQuery

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads",
    "resumes",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
        analysis = self._ai.analyze_resume(file.filename, len(content))
        file_path = os.path.join(
            UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}"
        )
        with open(file_path, "wb") as f:
            f.write(content)
        create = ResumeCreate(
            filename=file.filename,
            file_size=len(content),
            skills=analysis.get("skills", []),
            extracted_text=analysis.get("summary", ""),
        )
        resume = await self._query.create(create, user_id, file_path)
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
