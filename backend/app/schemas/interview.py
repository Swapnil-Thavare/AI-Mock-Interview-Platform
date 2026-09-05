from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
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
    id: Optional[UUID] = None
    interview_id: Optional[UUID] = None
    question_text: str
    category: Optional[str] = None
    question_type: QuestionType = QuestionType.TECHNICAL
    difficulty: str = "medium"
    topic: Optional[str] = None
    expected_focus: Optional[str] = None
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
    title: str = "Untitled Interview"
    resume_id: Optional[UUID] = None
    job_description_id: Optional[UUID] = None
    difficulty: str = "medium"
    question_count: int = 5
    duration: int = 30
    question_types: List[str] = ["technical", "behavioral"]


class InterviewResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    resume_id: Optional[UUID] = None
    job_description_id: Optional[UUID] = None
    difficulty: str
    question_count: int
    duration: int
    question_types: List[str] = []
    status: InterviewStatus
    questions: List[InterviewQuestionResponse] = []
    answers: List[InterviewAnswerResponse] = []
    result: Optional[InterviewResultResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
