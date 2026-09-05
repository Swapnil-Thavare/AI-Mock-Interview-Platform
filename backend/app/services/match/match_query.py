import uuid
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.resume_job_match import ResumeJobMatch


class MatchQuery:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_by_resume_jd(
        self,
        user_id: uuid.UUID,
        resume_id: uuid.UUID,
        job_description_id: uuid.UUID,
    ) -> Optional[ResumeJobMatch]:
        result = await self._db.exec(
            select(ResumeJobMatch)
            .where(ResumeJobMatch.user_id == user_id)
            .where(ResumeJobMatch.resume_id == resume_id)
            .where(ResumeJobMatch.job_description_id == job_description_id)
            .order_by(ResumeJobMatch.created_at.desc())
        )
        return result.first()

    async def save(self, match: ResumeJobMatch) -> ResumeJobMatch:
        self._db.add(match)
        await self._db.commit()
        await self._db.refresh(match)
        return match
