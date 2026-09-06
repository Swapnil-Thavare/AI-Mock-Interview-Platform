import uuid
from typing import List, Optional

from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.interview import Interview
from app.models.interview_answer import InterviewAnswer
from app.models.interview_question import InterviewQuestion
from app.schemas.interview import InterviewCreate


class InterviewQuery:
    def __init__(self, db: AsyncSession):
        self._db = db

    @staticmethod
    def _with_relationships(stmt):
        return stmt.options(
            selectinload(Interview.questions),
            selectinload(Interview.answers),
            selectinload(Interview.result),
        )

    async def create(
        self, obj: InterviewCreate, user_id: uuid.UUID
    ) -> Interview:
        interview = Interview(
            user_id=user_id,
            resume_id=obj.resume_id,
            job_description_id=obj.job_description_id,
            title=obj.title,
            difficulty=obj.difficulty,
            question_count=obj.question_count,
            duration=obj.duration,
            question_types=obj.question_types or ["technical"],
        )
        self._db.add(interview)
        await self._db.commit()
        await self._db.refresh(interview)
        return interview

    async def get_all(self, user_id: uuid.UUID) -> List[Interview]:
        stmt = (
            select(Interview)
            .where(Interview.user_id == user_id)
            .order_by(Interview.created_at.desc())
        )
        result = await self._db.exec(self._with_relationships(stmt))
        return result.all()

    async def get_by_id(self, interview_id) -> Optional[Interview]:
        if isinstance(interview_id, str):
            interview_id = uuid.UUID(interview_id)
        stmt = select(Interview).where(Interview.id == interview_id)
        result = await self._db.exec(self._with_relationships(stmt))
        return result.first()

    async def save(self, interview: Interview) -> Interview:
        self._db.add(interview)
        await self._db.commit()
        await self._db.refresh(interview)
        return interview

    async def get_question_by_id(
        self, question_id: uuid.UUID
    ) -> Optional[InterviewQuestion]:
        if isinstance(question_id, str):
            question_id = uuid.UUID(question_id)
        stmt = select(InterviewQuestion).where(InterviewQuestion.id == question_id)
        result = await self._db.exec(stmt)
        return result.first()

    async def get_answer_for_question(
        self, interview_id: uuid.UUID, question_id: uuid.UUID
    ) -> Optional[InterviewAnswer]:
        stmt = (
            select(InterviewAnswer)
            .where(
                InterviewAnswer.interview_id == interview_id,
                InterviewAnswer.question_id == question_id,
            )
        )
        result = await self._db.exec(stmt)
        return result.first()
