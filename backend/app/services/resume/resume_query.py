from typing import List, Optional
import uuid

from sqlalchemy.orm import Session

from app.models.resume import Resume as ResumeModel
from app.schemas.resume import ResumeCreate


class ResumeQuery:
    def __init__(self, db: Session):
        self._db = db

    def create(
        self, obj: ResumeCreate, user_id: uuid.UUID, file_path: Optional[str]
    ) -> ResumeModel:
        resume = ResumeModel(
            user_id=user_id,
            filename=obj.filename,
            file_size=obj.file_size or 0,
            file_path=file_path,
            extracted_text=obj.extracted_text or "",
            skills=obj.skills or [],
        )
        self._db.add(resume)
        self._db.commit()
        self._db.refresh(resume)
        return resume

    def get_all(self, user_id: uuid.UUID) -> List[ResumeModel]:
        return (
            self._db.query(ResumeModel)
            .filter(ResumeModel.user_id == user_id)
            .order_by(ResumeModel.created_at.desc())
            .all()
        )

    def get_latest(self, user_id: uuid.UUID) -> Optional[ResumeModel]:
        return (
            self._db.query(ResumeModel)
            .filter(ResumeModel.user_id == user_id)
            .order_by(ResumeModel.created_at.desc())
            .first()
        )
