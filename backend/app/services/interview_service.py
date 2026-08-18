from typing import Dict, List

from app.repositories import InterviewRepository
from app.schemas import Interview, InterviewAnswer, InterviewQuestion, InterviewResult
from app.services.ai_service import AIService
from app.services.evaluation_service import EvaluationService


class InterviewService:
    def __init__(self):
        self._repo = InterviewRepository()
        self._ai = AIService()
        self._evaluator = EvaluationService()
        self._answers: Dict[int, List[dict]] = {}

    def create_interview(self, payload: dict) -> Interview:
        questions = self._ai.generate_questions({}, {})
        interview = Interview(
            id=0,
            title=payload.get("title", "Mock Interview"),
            questions=questions,
            status="in_progress",
        )
        created = self._repo.create(interview)
        self._answers[created.id] = []
        return created

    def list_interviews(self) -> List[Interview]:
        return self._repo.get_all()

    def get_interview(self, interview_id: int) -> Interview:
        return self._repo.get_by_id(interview_id)

    def submit_answer(self, interview_id: int, answer: InterviewAnswer) -> dict:
        self._answers.setdefault(interview_id, [])
        self._answers[interview_id].append(answer.model_dump())
        return {"message": "Answer submitted", "question_id": answer.question_id}

    def complete_interview(self, interview_id: int) -> InterviewResult:
        answers = self._answers.get(interview_id, [])
        result = self._evaluator.evaluate(interview_id, answers)
        interview = self._repo.get_by_id(interview_id)
        if interview:
            interview.status = "completed"
        return result
