from typing import List, Optional
import uuid

from sqlalchemy.orm import Session

from app.models.interview import Interview
from app.schemas.interview import InterviewCreate


class InterviewQuery:
    def __init__(self, db: Session):
        self._db = db

    def create(self, obj: InterviewCreate, user_id: uuid.UUID) -> Interview:
        interview = Interview(
            user_id=user_id,
            resume_id=obj.resume_id,
            job_description_id=obj.job_description_id,
            title=obj.title,
        )
        self._db.add(interview)
        self._db.commit()
        self._db.refresh(interview)
        return interview

    def get_all(self, user_id: uuid.UUID) -> List[Interview]:
        return (
            self._db.query(Interview)
            .filter(Interview.user_id == user_id)
            .order_by(Interview.created_at.desc())
            .all()
        )

    def get_by_id(self, interview_id) -> Optional[Interview]:
        if isinstance(interview_id, str):
            interview_id = uuid.UUID(interview_id)
        return self._db.get(Interview, interview_id)

    def save(self, interview: Interview) -> Interview:
        self._db.add(interview)
        self._db.commit()
        self._db.refresh(interview)
        return interview
