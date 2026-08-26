from typing import List
import uuid

from sqlalchemy.orm import Session

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


class Interview:
    def __init__(self, db: Session):
        self._db = db
        self._query = InterviewQuery(db)
        self._ai = AIService()
        self._evaluator = EvaluationService()

    def create_interview(self, user_id: uuid.UUID, payload: InterviewCreate) -> InterviewResponse:
        interview = self._query.create(payload, user_id)
        questions = self._ai.generate_questions({}, {})
        for idx, q in enumerate(questions):
            q_type = q.question_type.value
            if q.category and q.category.lower() in {"technical", "behavioral"}:
                q_type = q.category.lower()
            db_question = InterviewQuestion(
                interview_id=interview.id,
                question_text=q.question_text,
                question_type=QuestionType(q_type),
                order=idx,
                category=q.category,
            )
            self._db.add(db_question)
        interview.status = InterviewStatus.IN_PROGRESS
        self._db.commit()
        self._db.refresh(interview)
        return InterviewResponse.model_validate(interview)

    def list_interviews(self, user_id: uuid.UUID) -> List[InterviewResponse]:
        return [
            InterviewResponse.model_validate(i)
            for i in self._query.get_all(user_id)
        ]

    def get_interview(self, user_id: uuid.UUID, interview_id: uuid.UUID) -> InterviewResponse:
        interview = self._get_owned_interview(user_id, interview_id)
        return InterviewResponse.model_validate(interview)

    def submit_answer(
        self, user_id: uuid.UUID, interview_id: uuid.UUID, answer: InterviewAnswerSchema
    ) -> dict:
        interview = self._get_owned_interview(user_id, interview_id)
        question_ids = {q.id for q in interview.questions}
        question_id = answer.question_id
        if question_id not in question_ids:
            raise CustomException(400, "Question does not belong to this interview")
        db_answer = InterviewAnswer(
            interview_id=interview.id,
            question_id=question_id,
            answer_text=answer.answer_text,
        )
        self._db.add(db_answer)
        self._db.commit()
        self._db.refresh(db_answer)
        return {"message": "Answer submitted", "question_id": str(question_id)}

    def complete_interview(self, user_id: uuid.UUID, interview_id: uuid.UUID) -> InterviewResultResponse:
        interview = self._get_owned_interview(user_id, interview_id)
        answers = [
            {"question_id": str(a.question_id), "answer_text": a.answer_text}
            for a in interview.answers
        ]
        result_schema: InterviewResultSchema = self._evaluator.evaluate(interview.id, answers)
        result = InterviewResultModel(
            interview_id=interview.id,
            score=result_schema.score,
            feedback=result_schema.feedback,
            strengths=result_schema.strengths,
            weaknesses=result_schema.weaknesses,
        )
        self._db.add(result)
        interview.status = InterviewStatus.COMPLETED
        self._db.commit()
        self._db.refresh(result)
        return InterviewResultResponse.model_validate(result)

    def _get_owned_interview(
        self, user_id: uuid.UUID, interview_id: uuid.UUID
    ) -> InterviewModel:
        interview = self._query.get_by_id(interview_id)
        if not interview or interview.user_id != user_id:
            raise CustomException(404, "Interview not found")
        return interview
