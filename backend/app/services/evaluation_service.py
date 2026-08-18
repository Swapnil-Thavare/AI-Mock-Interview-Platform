from typing import List

from app.schemas import InterviewResult


class EvaluationService:
    def evaluate(self, interview_id: int, answers: List[dict]) -> InterviewResult:
        return InterviewResult(
            interview_id=interview_id,
            score=0.82,
            feedback="Mock evaluation feedback.",
            strengths=["Technical clarity", "Structured answers"],
            weaknesses=["Could add more detail"],
        )
