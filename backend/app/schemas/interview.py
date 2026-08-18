from typing import List, Optional

from pydantic import BaseModel


class InterviewQuestion(BaseModel):
    id: int
    question_text: str
    category: Optional[str] = None


class InterviewAnswer(BaseModel):
    question_id: int
    answer_text: str


class Interview(BaseModel):
    id: int
    title: str
    questions: List[InterviewQuestion] = []
    status: str = "pending"


class InterviewResult(BaseModel):
    interview_id: int
    score: float
    feedback: str
    strengths: List[str]
    weaknesses: List[str]
