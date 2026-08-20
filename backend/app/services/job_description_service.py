from typing import List
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.job_description_repository import JobDescriptionRepository
from app.schemas.job_description import JobDescriptionCreate, JobDescriptionResponse


class JobDescriptionService:
    def __init__(self, db: Session):
        self._repo = JobDescriptionRepository(db)

    def create(self, user_id: uuid.UUID, job: JobDescriptionCreate) -> JobDescriptionResponse:
        db_job = self._repo.create(job, user_id)
        return JobDescriptionResponse.model_validate(db_job)

    def get_all(self, user_id: uuid.UUID) -> List[JobDescriptionResponse]:
        return [JobDescriptionResponse.model_validate(j) for j in self._repo.get_all(user_id)]

    def get_by_id(self, user_id: uuid.UUID, job_id: uuid.UUID) -> JobDescriptionResponse:
        job = self._repo.get_by_id(job_id)
        if not job or job.user_id != user_id:
            raise HTTPException(status_code=404, detail="Job description not found")
        return JobDescriptionResponse.model_validate(job)

    def delete(self, user_id: uuid.UUID, job_id: uuid.UUID) -> None:
        job = self._repo.get_by_id(job_id)
        if not job or job.user_id != user_id:
            raise HTTPException(status_code=404, detail="Job description not found")
        self._repo.delete(job)
