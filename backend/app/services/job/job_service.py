from typing import List
import uuid

from sqlalchemy.orm import Session

from app.exception import CustomException
from app.schemas.job_description import JobDescriptionCreate, JobDescriptionResponse
from app.services.job.job_query import JobDescriptionQuery


class JobDescription:
    def __init__(self, db: Session):
        self._query = JobDescriptionQuery(db)

    def create(self, user_id: uuid.UUID, job: JobDescriptionCreate) -> JobDescriptionResponse:
        db_job = self._query.create(job, user_id)
        return JobDescriptionResponse.model_validate(db_job)

    def get_all(self, user_id: uuid.UUID) -> List[JobDescriptionResponse]:
        return [
            JobDescriptionResponse.model_validate(j)
            for j in self._query.get_all(user_id)
        ]

    def get_by_id(self, user_id: uuid.UUID, job_id: uuid.UUID) -> JobDescriptionResponse:
        job = self._query.get_by_id(job_id)
        if not job or job.user_id != user_id:
            raise CustomException(404, "Job description not found")
        return JobDescriptionResponse.model_validate(job)

    def delete(self, user_id: uuid.UUID, job_id: uuid.UUID) -> None:
        job = self._query.get_by_id(job_id)
        if not job or job.user_id != user_id:
            raise CustomException(404, "Job description not found")
        self._query.delete(job)
