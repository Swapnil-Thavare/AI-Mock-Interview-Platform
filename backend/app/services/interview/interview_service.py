from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import get_settings
from app.exception import CustomException
from app.models.interview import Interview as InterviewModel, InterviewStatus
from app.models.interview_answer import InterviewAnswer
from app.models.interview_question import InterviewQuestion, QuestionType
from app.models.interview_result import InterviewResult as InterviewResultModel
from app.schemas.interview import (
    InterviewAnswer as InterviewAnswerSchema,
    InterviewAnswerEvaluation,
    InterviewAnswerResponse,
    InterviewCreate,
    InterviewQuestionResponse,
    InterviewResponse,
    InterviewResult as InterviewResultSchema,
    InterviewResultResponse,
    SubmitAnswerResponse,
)
from app.services.ai.ai_service import AIService
from app.services.interview.interview_query import InterviewQuery
from app.services.job.job_query import JobDescriptionQuery
from app.services.match.match_query import MatchQuery
from app.services.resume.resume_query import ResumeQuery


_MAX_ANSWER_LENGTH = 20000


class Interview:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._query = InterviewQuery(db)
        self._ai = AIService()

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

    async def _load_context(
        self, interview: InterviewModel
    ) -> tuple[dict, dict, Optional[dict]]:
        resume_analysis: dict = {}
        jd_analysis: dict = {}
        match_data: Optional[dict] = None

        if interview.resume_id:
            resume = await ResumeQuery(self._db).get_by_id(interview.resume_id)
            if resume:
                resume_analysis = resume.analysis or {}
        if interview.job_description_id:
            job = await JobDescriptionQuery(self._db).get_by_id(
                interview.job_description_id
            )
            if job:
                jd_analysis = job.analysis or {}
                match = await MatchQuery(self._db).get_by_resume_jd(
                    interview.user_id, interview.resume_id, interview.job_description_id
                )
                if match:
                    match_data = {
                        "overall_match_score": match.overall_match_score,
                        "matched_skills": match.matched_skills,
                        "missing_skills": match.missing_skills,
                        "strengths": match.strengths,
                        "gaps": match.gaps,
                        "recommendations": match.recommendations,
                    }
        return resume_analysis, jd_analysis, match_data

    async def _get_next_question(
        self, interview: InterviewModel
    ) -> Optional[InterviewQuestion]:
        stmt = (
            select(InterviewAnswer)
            .where(InterviewAnswer.interview_id == interview.id)
        )
        result = await self._db.exec(stmt)
        answered_ids = {a.question_id for a in result.all()}

        stmt = (
            select(InterviewQuestion)
            .where(InterviewQuestion.interview_id == interview.id)
            .order_by(InterviewQuestion.order)
        )
        result = await self._db.exec(stmt)
        questions = result.all()
        for q in questions:
            if q.id not in answered_ids:
                return q
        return None

    async def _count_follow_ups(self, interview: InterviewModel) -> int:
        return sum(1 for q in interview.questions if q.is_follow_up)

    @staticmethod
    def _question_to_dict(question: InterviewQuestion) -> Dict[str, Any]:
        return {
            "id": str(question.id),
            "question_text": question.question_text,
            "question_type": question.question_type.value,
            "difficulty": question.difficulty,
            "topic": question.topic,
            "expected_focus": question.expected_focus,
            "order": question.order,
            "category": question.category,
        }

    async def _evaluate_answer(
        self,
        interview: InterviewModel,
        question: InterviewQuestion,
        answer: InterviewAnswer,
    ) -> Optional[InterviewAnswerEvaluation]:
        resume_analysis, jd_analysis, _ = await self._load_context(interview)
        try:
            evaluation = await self._ai.evaluate_answer(
                self._question_to_dict(question),
                answer.answer_text,
                resume_analysis,
                jd_analysis,
                interview.difficulty,
            )
            return InterviewAnswerEvaluation.model_validate(
                evaluation.model_dump(mode="json")
            )
        except CustomException:
            raise
        except Exception:
            return None

    async def _generate_follow_up(
        self,
        interview: InterviewModel,
        question: InterviewQuestion,
        answer: InterviewAnswer,
        evaluation: InterviewAnswerEvaluation,
    ) -> Optional[InterviewQuestion]:
        resume_analysis, jd_analysis, _ = await self._load_context(interview)
        try:
            follow_up = await self._ai.generate_follow_up_question(
                self._question_to_dict(question),
                answer.answer_text,
                evaluation.model_dump(mode="json"),
                resume_analysis,
                jd_analysis,
                interview.difficulty,
            )
        except Exception:
            return None

        max_order = max((q.order for q in interview.questions), default=-1)
        raw_type = (follow_up.question_type or "technical").lower()
        q_type = QuestionType.BEHAVIORAL
        if raw_type == "technical":
            q_type = QuestionType.TECHNICAL

        follow_up_question = InterviewQuestion(
            interview_id=interview.id,
            question_text=follow_up.question,
            question_type=q_type,
            difficulty=follow_up.difficulty or interview.difficulty,
            order=max_order + 1,
            topic=follow_up.topic,
            expected_focus=follow_up.expected_focus,
            category=raw_type,
            parent_question_id=question.id,
            is_follow_up=True,
            follow_up_reason=evaluation.follow_up_reason,
        )
        self._db.add(follow_up_question)
        await self._db.commit()
        await self._db.refresh(follow_up_question)
        return follow_up_question

    async def create_interview(
        self, user_id: uuid.UUID, payload: InterviewCreate
    ) -> InterviewResponse:
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
    ) -> SubmitAnswerResponse:
        interview = await self._get_owned_interview(user_id, interview_id)
        if interview.status == InterviewStatus.COMPLETED:
            raise CustomException(400, "Interview is already completed")

        question_ids = {q.id for q in interview.questions}
        question_id = answer.question_id
        if question_id not in question_ids:
            raise CustomException(
                400, "Question does not belong to this interview"
            )

        existing = await self._query.get_answer_for_question(
            interview.id, question_id
        )
        if existing:
            raise CustomException(400, "Answer already submitted for this question")

        answer_text = answer.answer_text.strip()
        if not answer_text and not answer.skipped:
            raise CustomException(400, "Answer cannot be empty")
        if len(answer.answer_text) > _MAX_ANSWER_LENGTH:
            raise CustomException(400, "Answer exceeds maximum length")

        question = next(q for q in interview.questions if q.id == question_id)
        db_answer = InterviewAnswer(
            interview_id=interview.id,
            question_id=question_id,
            answer_text=answer_text,
        )
        self._db.add(db_answer)
        await self._db.commit()
        await self._db.refresh(db_answer)

        evaluation_schema: Optional[InterviewAnswerEvaluation] = None
        try:
            evaluation_schema = await self._evaluate_answer(
                interview, question, db_answer
            )
            if evaluation_schema:
                db_answer.score = float(evaluation_schema.score)
                db_answer.evaluation = evaluation_schema.model_dump(mode="json")
                db_answer.evaluated_at = datetime.now(timezone.utc)
                self._db.add(db_answer)
                await self._db.commit()
                await self._db.refresh(db_answer)
        except CustomException:
            pass

        follow_up_generated = False
        if evaluation_schema and evaluation_schema.follow_up_required:
            follow_up_count = await self._count_follow_ups(interview)
            settings = get_settings()
            max_follow_ups = max(0, settings.MAX_FOLLOW_UP_QUESTIONS)
            if follow_up_count < max_follow_ups:
                follow_up = await self._generate_follow_up(
                    interview, question, db_answer, evaluation_schema
                )
                if follow_up:
                    follow_up_generated = True
                    interview = await self._query.get_by_id(interview.id)

        if not follow_up_generated:
            await self._db.refresh(interview)
        next_q = await self._get_next_question(interview)
        is_complete = next_q is None and not follow_up_generated

        return SubmitAnswerResponse(
            answer=InterviewAnswerResponse.model_validate(db_answer),
            evaluation=evaluation_schema,
            next_question=InterviewQuestionResponse.model_validate(next_q)
            if next_q
            else None,
            follow_up_generated=follow_up_generated,
            is_complete=is_complete,
            message="Answer submitted",
        )

    async def complete_interview(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> InterviewResultResponse:
        interview = await self._get_owned_interview(user_id, interview_id)
        if interview.result is not None:
            return InterviewResultResponse.model_validate(interview.result)

        report = await self._generate_report(interview)
        result = InterviewResultModel(
            interview_id=interview.id,
            score=report.score,
            feedback=report.feedback,
            strengths=report.strengths,
            weaknesses=report.weaknesses,
            technical_score=report.technical_score,
            communication_score=report.communication_score,
            relevance_score=report.relevance_score,
            problem_solving_score=report.problem_solving_score,
            resume_alignment=report.resume_alignment,
            missing_skills=report.missing_skills,
            suggestions=report.suggestions,
            preparation_topics=report.preparation_topics,
            question_results=report.question_results,
            completion_summary=report.completion_summary,
            overall_feedback=report.overall_feedback,
            confidence=report.confidence,
            uncertainty_notes=report.uncertainty_notes,
        )
        self._db.add(result)
        interview.status = InterviewStatus.COMPLETED
        interview.completed_at = datetime.now(timezone.utc)
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

    async def _generate_report(
        self, interview: InterviewModel
    ) -> InterviewResultSchema:
        resume_analysis, jd_analysis, match_data = await self._load_context(interview)
        qa_data: List[Dict[str, Any]] = []
        for answer in interview.answers:
            question = next(
                (q for q in interview.questions if q.id == answer.question_id), None
            )
            qa_data.append(
                {
                    "question_id": str(answer.question_id),
                    "question": question.question_text if question else "",
                    "answer": answer.answer_text,
                    "evaluation": answer.evaluation or {},
                    "score": answer.score,
                }
            )

        config = {
            "difficulty": interview.difficulty,
            "question_count": interview.question_count,
            "duration": interview.duration,
            "question_types": interview.question_types,
            "answered_count": len(interview.answers),
            "total_questions": len(interview.questions),
        }

        try:
            report = await self._ai.generate_interview_report(
                config,
                resume_analysis,
                jd_analysis,
                match_data or {},
                qa_data,
            )
        except Exception:
            answered = len(interview.answers)
            total = max(1, len(interview.questions))
            avg_score = 0.0
            if answered:
                scores = [a.score for a in interview.answers if a.score is not None]
                avg_score = sum(scores) / len(scores) if scores else 0.0
            answered = len(interview.answers)
            skipped = 0
            total = len(interview.questions)
            return InterviewResultSchema(
                interview_id=interview.id,
                score=avg_score,
                feedback="Final report generation is unavailable. Based on submitted answers, additional review may be needed.",
                strengths=[],
                weaknesses=["Report generation failed"],
                confidence=0.0,
                uncertainty_notes="Could not generate a full report at this time.",
                total_questions=total,
                answered=answered,
                skipped=skipped,
            )

        return InterviewResultSchema(
            interview_id=interview.id,
            score=float(report.overall_score),
            feedback=report.overall_feedback or report.answer_quality_summary,
            strengths=report.strengths,
            weaknesses=report.weaknesses,
            technical_score=float(report.technical_score)
            if report.technical_score is not None
            else None,
            communication_score=float(report.communication_score)
            if report.communication_score is not None
            else None,
            relevance_score=float(report.relevance_score)
            if report.relevance_score is not None
            else None,
            problem_solving_score=float(report.problem_solving_score)
            if report.problem_solving_score is not None
            else None,
            resume_alignment=report.resume_alignment,
            missing_skills=report.missing_or_weak_skills,
            suggestions=report.recommended_preparation_topics,
            preparation_topics=report.recommended_preparation_topics,
            question_results=[q.model_dump(mode="json") for q in report.question_wise_summary],
            completion_summary=report.interview_completion_summary,
            overall_feedback=report.overall_feedback,
            confidence=float(report.confidence),
            uncertainty_notes=report.uncertainty_notes,
            total_questions=len(interview.questions),
            answered=sum(1 for a in interview.answers if a.answer_text.strip()),
            skipped=sum(1 for a in interview.answers if not a.answer_text.strip()),
        )

    async def _get_owned_interview(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> InterviewModel:
        interview = await self._query.get_by_id(interview_id)
        if not interview or interview.user_id != user_id:
            raise CustomException(404, "Interview not found")
        return interview
