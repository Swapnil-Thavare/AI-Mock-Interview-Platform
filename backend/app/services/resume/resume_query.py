import uuid
from typing import List, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.resume import Resume as ResumeModel
from app.schemas.resume import ResumeCreate


class ResumeQuery:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def create(
        self,
        obj: ResumeCreate,
        user_id: uuid.UUID,
        file_path: Optional[str],
    ) -> ResumeModel:
        resume = ResumeModel(
            user_id=user_id,
            filename=obj.filename,
            file_size=obj.file_size or 0,
            file_path=file_path,
            extracted_text=obj.extracted_text or "",
            skills=obj.skills or [],
            analysis=obj.analysis or {},
        )
        self._db.add(resume)
        await self._db.commit()
        await self._db.refresh(resume)
        return resume

    async def get_by_id(self, resume_id: uuid.UUID) -> Optional[ResumeModel]:
        return await self._db.get(ResumeModel, resume_id)

    async def get_all(self, user_id: uuid.UUID) -> List[ResumeModel]:
        result = await self._db.exec(
            select(ResumeModel)
            .where(ResumeModel.user_id == user_id)
            .order_by(ResumeModel.created_at.desc())
        )
        return result.all()

    async def get_latest(self, user_id: uuid.UUID) -> Optional[ResumeModel]:
        result = await self._db.exec(
            select(ResumeModel)
            .where(ResumeModel.user_id == user_id)
            .order_by(ResumeModel.created_at.desc())
        )
        return result.first()
