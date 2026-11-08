import uuid
from typing import List, Optional, Set

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.interview import Interview, InterviewMode
from app.models.interview_answer import InterviewAnswer
from app.models.interview_answer_media import InterviewAnswerMedia
from app.models.interview_answer_speech_analysis import (
    InterviewAnswerSpeechAnalysis,
)
from app.models.interview_proctoring_event import InterviewProctoringEvent
from app.models.interview_question import InterviewQuestion
from app.schemas.interview import InterviewCreate


class InterviewQuery:
    def __init__(self, db: AsyncSession):
        self._db = db

    @staticmethod
    def _with_relationships(stmt):
        return stmt.options(
            selectinload(Interview.questions),
            selectinload(Interview.answers)
            .selectinload(InterviewAnswer.media)
            .selectinload(InterviewAnswerMedia.speech_analysis),
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
            interview_mode=InterviewMode(obj.interview_mode.value),
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

    async def get_answer_by_id(
        self, answer_id: uuid.UUID
    ) -> Optional[InterviewAnswer]:
        if isinstance(answer_id, str):
            answer_id = uuid.UUID(answer_id)
        stmt = (
            select(InterviewAnswer)
            .where(InterviewAnswer.id == answer_id)
            .options(selectinload(InterviewAnswer.media))
        )
        result = await self._db.exec(stmt)
        return result.first()

    async def get_media_for_answer(
        self, answer_id: uuid.UUID
    ) -> Optional[InterviewAnswerMedia]:
        stmt = (
            select(InterviewAnswerMedia)
            .where(InterviewAnswerMedia.answer_id == answer_id)
        )
        result = await self._db.exec(stmt)
        return result.first()

    async def save_media(
        self, media: InterviewAnswerMedia
    ) -> InterviewAnswerMedia:
        self._db.add(media)
        await self._db.commit()
        await self._db.refresh(media)
        return media

    async def get_speech_analysis_for_answer(
        self, answer_id: uuid.UUID
    ) -> Optional[InterviewAnswerSpeechAnalysis]:
        stmt = select(InterviewAnswerSpeechAnalysis).where(
            InterviewAnswerSpeechAnalysis.answer_id == answer_id
        )
        result = await self._db.exec(stmt)
        return result.first()

    async def save_speech_analysis(
        self, analysis: InterviewAnswerSpeechAnalysis
    ) -> InterviewAnswerSpeechAnalysis:
        self._db.add(analysis)
        try:
            await self._db.commit()
        except IntegrityError:
            # A concurrent upload already created the row for this answer.
            await self._db.rollback()
            existing = await self.get_speech_analysis_for_answer(
                analysis.answer_id
            )
            if existing is None:
                raise
            return existing
        await self._db.refresh(analysis)
        return analysis

    async def get_proctoring_events(
        self, interview_id: uuid.UUID
    ) -> List[InterviewProctoringEvent]:
        stmt = (
            select(InterviewProctoringEvent)
            .where(InterviewProctoringEvent.interview_id == interview_id)
            .order_by(
                InterviewProctoringEvent.started_at,
                InterviewProctoringEvent.created_at,
            )
        )
        result = await self._db.exec(stmt)
        return result.all()

    async def get_existing_proctoring_client_ids(
        self, interview_id: uuid.UUID, client_ids: List[uuid.UUID]
    ) -> Set[uuid.UUID]:
        if not client_ids:
            return set()
        stmt = select(InterviewProctoringEvent.client_event_id).where(
            InterviewProctoringEvent.interview_id == interview_id,
            InterviewProctoringEvent.client_event_id.in_(client_ids),
        )
        result = await self._db.exec(stmt)
        return set(result.all())

    async def count_proctoring_events(self, interview_id: uuid.UUID) -> int:
        stmt = select(func.count(InterviewProctoringEvent.id)).where(
            InterviewProctoringEvent.interview_id == interview_id
        )
        result = await self._db.exec(stmt)
        return result.one()
