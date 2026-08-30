from typing import List
import uuid

from sqlmodel.ext.asyncio.session import AsyncSession

from app.exception import CustomException
from app.schemas.job_description import (
    JobDescriptionCreate,
    JobDescriptionResponse,
)
from app.services.job.job_query import JobDescriptionQuery


class JobDescription:
    def __init__(self, db: AsyncSession):
        self._query = JobDescriptionQuery(db)

    async def create(
        self, user_id: uuid.UUID, job: JobDescriptionCreate
    ) -> JobDescriptionResponse:
        db_job = await self._query.create(job, user_id)
        return JobDescriptionResponse.model_validate(db_job)

    async def get_all(
        self, user_id: uuid.UUID
    ) -> List[JobDescriptionResponse]:
        jobs = await self._query.get_all(user_id)
        return [JobDescriptionResponse.model_validate(j) for j in jobs]

    async def get_by_id(
        self, user_id: uuid.UUID, job_id: uuid.UUID
    ) -> JobDescriptionResponse:
        job = await self._query.get_by_id(job_id)
        if not job or job.user_id != user_id:
            raise CustomException(404, "Job description not found")
        return JobDescriptionResponse.model_validate(job)

    async def delete(self, user_id: uuid.UUID, job_id: uuid.UUID) -> None:
        job = await self._query.get_by_id(job_id)
        if not job or job.user_id != user_id:
            raise CustomException(404, "Job description not found")
        await self._query.delete(job)
