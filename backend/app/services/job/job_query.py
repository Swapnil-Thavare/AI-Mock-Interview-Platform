import uuid
from typing import List, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.job_description import JobDescription
from app.schemas.job_description import JobDescriptionCreate


class JobDescriptionQuery:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def create(
        self, obj: JobDescriptionCreate, user_id: uuid.UUID
    ) -> JobDescription:
        job = JobDescription(
            user_id=user_id,
            title=obj.title,
            company=obj.company,
            description=obj.description,
            required_skills=obj.required_skills or [],
        )
        self._db.add(job)
        await self._db.commit()
        await self._db.refresh(job)
        return job

    async def get_all(self, user_id: uuid.UUID) -> List[JobDescription]:
        result = await self._db.exec(
            select(JobDescription)
            .where(JobDescription.user_id == user_id)
            .order_by(JobDescription.created_at.desc())
        )
        return result.all()

    async def get_by_id(self, job_id) -> Optional[JobDescription]:
        if isinstance(job_id, str):
            job_id = uuid.UUID(job_id)
        return await self._db.get(JobDescription, job_id)

    async def delete(self, job: JobDescription) -> None:
        self._db.delete(job)
        await self._db.commit()
