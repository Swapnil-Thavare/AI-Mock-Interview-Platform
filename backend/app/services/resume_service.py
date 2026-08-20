import os
import uuid
from typing import List

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.repositories.resume_repository import ResumeRepository
from app.schemas.resume import ResumeCreate, ResumeResponse
from app.services.ai_service import AIService

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "resumes")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class ResumeService:
    def __init__(self, db: Session):
        self._repo = ResumeRepository(db)
        self._ai = AIService()

    async def create_resume(self, user_id: uuid.UUID, file: UploadFile) -> ResumeResponse:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise ValueError("Only PDF files are allowed")
        content = await file.read()
        analysis = self._ai.analyze_resume(file.filename, len(content))
        file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
        with open(file_path, "wb") as f:
            f.write(content)
        create = ResumeCreate(
            filename=file.filename,
            file_size=len(content),
            skills=analysis.get("skills", []),
            extracted_text=analysis.get("summary", ""),
        )
        resume = self._repo.create(create, user_id, file_path)
        return ResumeResponse.model_validate(resume)

    def get_latest(self, user_id: uuid.UUID) -> ResumeResponse | None:
        resume = self._repo.get_latest(user_id)
        if resume:
            return ResumeResponse.model_validate(resume)
        return None

    def get_all(self, user_id: uuid.UUID) -> List[ResumeResponse]:
        return [ResumeResponse.model_validate(r) for r in self._repo.get_all(user_id)]
