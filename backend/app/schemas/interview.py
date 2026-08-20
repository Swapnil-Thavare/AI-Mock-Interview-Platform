from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class InterviewStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class QuestionType(str, Enum):
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"


class InterviewQuestion(BaseModel):
    id: Optional[int] = None
    question_text: str
    category: Optional[str] = None
    question_type: QuestionType = QuestionType.TECHNICAL
    order: int = 0
    model_config = ConfigDict(from_attributes=True)


class InterviewAnswer(BaseModel):
    question_id: UUID
    answer_text: str
    model_config = ConfigDict(from_attributes=True)


class InterviewResult(BaseModel):
    interview_id: Optional[UUID] = None
    score: float
    feedback: str
    strengths: List[str] = []
    weaknesses: List[str] = []
    model_config = ConfigDict(from_attributes=True)


class Interview(BaseModel):
    id: Optional[UUID] = None
    title: str = "Untitled Interview"
    questions: List[InterviewQuestion] = []
    status: InterviewStatus = InterviewStatus.PENDING
    model_config = ConfigDict(from_attributes=True)


class InterviewQuestionResponse(InterviewQuestion):
    id: UUID
    interview_id: UUID
    model_config = ConfigDict(from_attributes=True)


class InterviewAnswerResponse(BaseModel):
    id: UUID
    interview_id: UUID
    question_id: UUID
    answer_text: str
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class InterviewResultResponse(InterviewResult):
    id: UUID
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class InterviewCreate(BaseModel):
    title: str
    resume_id: Optional[UUID] = None
    job_description_id: Optional[UUID] = None


class InterviewResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    resume_id: Optional[UUID] = None
    job_description_id: Optional[UUID] = None
    status: InterviewStatus
    questions: List[InterviewQuestionResponse] = []
    answers: List[InterviewAnswerResponse] = []
    result: Optional[InterviewResultResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
