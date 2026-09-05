from typing import List
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.exception import CustomException
from app.models.interview import Interview as InterviewModel, InterviewStatus
from app.models.interview_answer import InterviewAnswer
from app.models.interview_question import InterviewQuestion, QuestionType
from app.models.interview_result import InterviewResult as InterviewResultModel
from app.schemas.interview import (
    InterviewAnswer as InterviewAnswerSchema,
    InterviewCreate,
    InterviewResponse,
    InterviewResult as InterviewResultSchema,
    InterviewResultResponse,
)
from app.services.ai.ai_service import AIService
from app.services.evaluation.evaluation_service import EvaluationService
from app.services.interview.interview_query import InterviewQuery
from app.services.job.job_query import JobDescriptionQuery
from app.services.resume.resume_query import ResumeQuery


class Interview:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._query = InterviewQuery(db)
        self._ai = AIService()
        self._evaluator = EvaluationService()

    async def _ensure_resume_analysis(self, resume) -> dict:
        if resume.analysis:
            return resume.analysis
        analysis = await self._ai.analyze_resume(resume.extracted_text or "")
        resume.analysis = analysis.model_dump()
        self._db.add(resume)
        await self._db.commit()
        await self._db.refresh(resume)
        return resume.analysis

    async def _ensure_jd_analysis(self, job) -> dict:
        if job.analysis:
            return job.analysis
        analysis = await self._ai.analyze_job_description(job.description or "")
        job.analysis = analysis.model_dump()
        self._db.add(job)
        await self._db.commit()
        await self._db.refresh(job)
        return job.analysis

    async def create_interview(
        self, user_id: uuid.UUID, payload: InterviewCreate
    ) -> InterviewResponse:
        # Validate ownership of resume and JD.
        if payload.resume_id:
            resume = await ResumeQuery(self._db).get_by_id(payload.resume_id)
            if not resume or resume.user_id != user_id:
                raise CustomException(404, "Resume not found")
            resume_analysis = await self._ensure_resume_analysis(resume)
        else:
            resume_analysis = {}

        if payload.job_description_id:
            job = await JobDescriptionQuery(self._db).get_by_id(
                payload.job_description_id
            )
            if not job or job.user_id != user_id:
                raise CustomException(404, "Job description not found")
            job_analysis = await self._ensure_jd_analysis(job)
        else:
            job_analysis = {}

        interview = await self._query.create(payload, user_id)
        count = max(1, min(20, payload.question_count))
        questions = await self._ai.generate_interview_questions(
            resume_analysis,
            job_analysis,
            payload.difficulty,
            count,
            payload.question_types or ["technical"],
        )
        for idx, q in enumerate(questions):
            raw_type = (q.get("question_type") or "technical").lower()
            q_type = QuestionType.BEHAVIORAL
            if raw_type == "technical":
                q_type = QuestionType.TECHNICAL
            db_question = InterviewQuestion(
                interview_id=interview.id,
                question_text=q["question"],
                question_type=q_type,
                difficulty=q.get("difficulty", "medium"),
                order=idx,
                topic=q.get("topic"),
                expected_focus=q.get("expected_focus"),
                category=raw_type,
            )
            self._db.add(db_question)
        interview.status = InterviewStatus.IN_PROGRESS
        await self._db.commit()
        await self._db.refresh(interview)
        stmt = (
            select(InterviewQuestion)
            .where(InterviewQuestion.interview_id == interview.id)
            .order_by(InterviewQuestion.order)
        )
        result = await self._db.exec(stmt)
        interview.questions = result.all()
        return InterviewResponse.model_validate(interview)

    async def list_interviews(
        self, user_id: uuid.UUID
    ) -> List[InterviewResponse]:
        interviews = await self._query.get_all(user_id)
        return [
            InterviewResponse.model_validate(i) for i in interviews
        ]

    async def get_interview(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> InterviewResponse:
        interview = await self._get_owned_interview(user_id, interview_id)
        return InterviewResponse.model_validate(interview)

    async def submit_answer(
        self,
        user_id: uuid.UUID,
        interview_id: uuid.UUID,
        answer: InterviewAnswerSchema,
    ) -> dict:
        interview = await self._get_owned_interview(user_id, interview_id)
        question_ids = {q.id for q in interview.questions}
        question_id = answer.question_id
        if question_id not in question_ids:
            raise CustomException(
                400, "Question does not belong to this interview"
            )
        db_answer = InterviewAnswer(
            interview_id=interview.id,
            question_id=question_id,
            answer_text=answer.answer_text,
        )
        self._db.add(db_answer)
        await self._db.commit()
        await self._db.refresh(db_answer)
        return {"message": "Answer submitted", "question_id": str(question_id)}

    async def complete_interview(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> InterviewResultResponse:
        interview = await self._get_owned_interview(user_id, interview_id)
        if interview.result is not None:
            return InterviewResultResponse.model_validate(interview.result)
        answers = [
            {"question_id": str(a.question_id), "answer_text": a.answer_text}
            for a in interview.answers
        ]
        result_schema: InterviewResultSchema = self._evaluator.evaluate(
            interview.id, answers
        )
        result = InterviewResultModel(
            interview_id=interview.id,
            score=result_schema.score,
            feedback=result_schema.feedback,
            strengths=result_schema.strengths,
            weaknesses=result_schema.weaknesses,
        )
        self._db.add(result)
        interview.status = InterviewStatus.COMPLETED
        try:
            await self._db.commit()
        except IntegrityError:
            await self._db.rollback()
            existing = await self._query.get_by_id(interview.id)
            if existing is None or existing.result is None:
                raise
            return InterviewResultResponse.model_validate(existing.result)
        await self._db.refresh(result)
        return InterviewResultResponse.model_validate(result)

    async def _get_owned_interview(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> InterviewModel:
        interview = await self._query.get_by_id(interview_id)
        if not interview or interview.user_id != user_id:
            raise CustomException(404, "Interview not found")
        return interview
