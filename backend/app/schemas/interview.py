from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
    parent_question_id: Optional[UUID] = None
    is_follow_up: bool = False
    follow_up_reason: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class InterviewAnswer(BaseModel):
    question_id: UUID
    answer_text: str
    skipped: bool = False
    model_config = ConfigDict(from_attributes=True)


class InterviewAnswerEvaluation(BaseModel):
    score: int = Field(..., ge=0, le=100)
    relevance_score: int = Field(..., ge=0, le=100)
    correctness_score: int = Field(..., ge=0, le=100)
    clarity_score: int = Field(..., ge=0, le=100)
    depth_score: int = Field(..., ge=0, le=100)
    strengths: List[str] = []
    weaknesses: List[str] = []
    missing_points: List[str] = []
    improvement_feedback: str = ""
    ideal_answer_summary: str = ""
    follow_up_required: bool = False
    follow_up_reason: str = ""
    confidence: int = Field(..., ge=0, le=100)
    uncertainty_notes: str = ""
    model_config = ConfigDict(from_attributes=True)


class InterviewResult(BaseModel):
    interview_id: Optional[UUID] = None
    score: float
    feedback: str
    strengths: List[str] = []
    weaknesses: List[str] = []
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    relevance_score: Optional[float] = None
    problem_solving_score: Optional[float] = None
    resume_alignment: Optional[str] = None
    missing_skills: List[str] = []
    suggestions: List[str] = []
    preparation_topics: List[str] = []
    question_results: List[Dict[str, Any]] = []
    total_questions: Optional[int] = None
    answered: Optional[int] = None
    skipped: Optional[int] = None
    completion_summary: Optional[str] = None
    overall_feedback: Optional[str] = None
    confidence: Optional[float] = None
    uncertainty_notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class Interview(BaseModel):
    id: Optional[UUID] = None
    title: str = "Untitled Interview"
    questions: List[InterviewQuestion] = []
    status: InterviewStatus = InterviewStatus.PENDING
    completed_at: Optional[datetime] = None
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
    score: Optional[float] = None
    evaluation: Optional[Dict[str, Any]] = None
    evaluated_at: Optional[datetime] = None
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
    completed_at: Optional[datetime] = None
    questions: List[InterviewQuestionResponse] = []
    answers: List[InterviewAnswerResponse] = []
    result: Optional[InterviewResultResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class SubmitAnswerResponse(BaseModel):
    answer: InterviewAnswerResponse
    evaluation: Optional[InterviewAnswerEvaluation] = None
    next_question: Optional[InterviewQuestionResponse] = None
    follow_up_generated: bool = False
    is_complete: bool = False
    message: str = "Answer submitted"
    model_config = ConfigDict(from_attributes=True)
