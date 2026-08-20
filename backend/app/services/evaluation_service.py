from typing import List
import uuid

from app.schemas import InterviewResult


class EvaluationService:
    def evaluate(self, interview_id: uuid.UUID, answers: List[dict]) -> InterviewResult:
        return InterviewResult(
            interview_id=interview_id,
            score=0.82,
            feedback="Mock evaluation feedback.",
            strengths=["Technical clarity", "Structured answers"],
            weaknesses=["Could add more detail"],
        )
