from typing import List, Optional
import uuid

from sqlalchemy.orm import Session

from app.models.job_description import JobDescription
from app.schemas.job_description import JobDescriptionCreate


class JobDescriptionQuery:
    def __init__(self, db: Session):
        self._db = db

    def create(self, obj: JobDescriptionCreate, user_id: uuid.UUID) -> JobDescription:
        job = JobDescription(
            user_id=user_id,
            title=obj.title,
            company=obj.company,
            description=obj.description,
            required_skills=obj.required_skills or [],
        )
        self._db.add(job)
        self._db.commit()
        self._db.refresh(job)
        return job

    def get_all(self, user_id: uuid.UUID) -> List[JobDescription]:
        return (
            self._db.query(JobDescription)
            .filter(JobDescription.user_id == user_id)
            .order_by(JobDescription.created_at.desc())
            .all()
        )

    def get_by_id(self, job_id) -> Optional[JobDescription]:
        if isinstance(job_id, str):
            job_id = uuid.UUID(job_id)
        return self._db.get(JobDescription, job_id)

    def delete(self, job: JobDescription) -> None:
        self._db.delete(job)
        self._db.commit()
