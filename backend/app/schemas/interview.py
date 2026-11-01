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


class InterviewMode(str, Enum):
    TEXT = "TEXT"
    AUDIO = "AUDIO"
    VIDEO = "VIDEO"


class MediaKind(str, Enum):
    AUDIO = "AUDIO"
    VIDEO = "VIDEO"


class SpeechAnalysisStatus(str, Enum):
    NONE = "NONE"
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ProctoringEventType(str, Enum):
    FACE_NOT_DETECTED = "FACE_NOT_DETECTED"
    MULTIPLE_FACES_DETECTED = "MULTIPLE_FACES_DETECTED"
    CAMERA_DISCONNECTED = "CAMERA_DISCONNECTED"
    CAMERA_INTERRUPTED = "CAMERA_INTERRUPTED"
    TAB_HIDDEN = "TAB_HIDDEN"
    WINDOW_FOCUS_LOST = "WINDOW_FOCUS_LOST"


class ProctoringSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"


class MediaUploadStatus(str, Enum):
    PENDING = "PENDING"
    UPLOADED = "UPLOADED"
    FAILED = "FAILED"


class TranscriptionStatus(str, Enum):
    NONE = "NONE"
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


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
    interview_mode: InterviewMode = InterviewMode.TEXT
    completed_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class InterviewModeUpdate(BaseModel):
    interview_mode: InterviewMode
    model_config = ConfigDict(from_attributes=True)


class InterviewQuestionResponse(InterviewQuestion):
    id: UUID
    interview_id: UUID
    model_config = ConfigDict(from_attributes=True)


class SpeechAnalysisResponse(BaseModel):
    """Communication-analysis observations for one spoken answer (Phase 7E).

    Descriptive metrics only — no scores. Missing values mean the metric
    could not be computed (e.g., no pause statistics from the client).
    """
    id: UUID
    interview_id: UUID
    answer_id: UUID
    media_id: UUID
    status: SpeechAnalysisStatus = SpeechAnalysisStatus.PENDING
    word_count: Optional[int] = None
    recording_seconds: Optional[float] = None
    speech_seconds: Optional[float] = None
    wpm_recording: Optional[float] = None
    wpm_speech: Optional[float] = None
    filler_count: Optional[int] = None
    filler_per_100_words: Optional[float] = None
    filler_breakdown: Optional[Dict[str, Any]] = None
    pause_count: Optional[int] = None
    pause_total_seconds: Optional[float] = None
    pause_avg_seconds: Optional[float] = None
    pause_longest_seconds: Optional[float] = None
    unique_word_ratio: Optional[float] = None
    top_repeated_words: Optional[List[Dict[str, Any]]] = None
    structure_summary: Optional[str] = None
    organization_notes: Optional[List[str]] = None
    clarity_notes: Optional[str] = None
    communication_strengths: Optional[List[str]] = None
    communication_improvements: Optional[List[str]] = None
    analysis_error: Optional[str] = None
    analyzed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class InterviewAnswerMediaResponse(BaseModel):
    id: UUID
    interview_id: UUID
    answer_id: UUID
    media_type: MediaKind
    mime_type: str
    storage_key: str
    file_size: int
    duration_seconds: Optional[float] = None
    status: MediaUploadStatus
    uploaded_at: Optional[datetime] = None
    transcription_status: TranscriptionStatus = TranscriptionStatus.NONE
    transcript_text: Optional[str] = None
    transcription_error: Optional[str] = None
    transcribed_at: Optional[datetime] = None
    speech_analysis: Optional[SpeechAnalysisResponse] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class InterviewAnswerResponse(BaseModel):
    id: UUID
    interview_id: UUID
    question_id: UUID
    answer_text: str
    score: Optional[float] = None
    evaluation: Optional[Dict[str, Any]] = None
    evaluated_at: Optional[datetime] = None
    media: Optional[InterviewAnswerMediaResponse] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class InterviewResultResponse(InterviewResult):
    id: UUID
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class InterviewCreate(BaseModel):
    title: str = Field(default="Untitled Interview", max_length=255)
    resume_id: Optional[UUID] = None
    job_description_id: Optional[UUID] = None
    difficulty: str = "medium"
    question_count: int = Field(default=5, ge=1, le=20)
    duration: int = Field(default=30, ge=1, le=180)
    question_types: List[str] = ["technical", "behavioral"]
    interview_mode: InterviewMode = InterviewMode.TEXT


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
    interview_mode: InterviewMode = InterviewMode.TEXT
    completed_at: Optional[datetime] = None
    questions: List[InterviewQuestionResponse] = []
    answers: List[InterviewAnswerResponse] = []
    result: Optional[InterviewResultResponse] = None
    proctoring_consent_at: Optional[datetime] = None
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


class InterviewAnswerMediaSubmitResponse(BaseModel):
    """Response contract for the media upload endpoint.

    The upload endpoint finishes the voice-first pipeline (upload →
    transcribe → evaluate → follow-up), so in addition to the media record
    it returns the same progression data a submit-answer call would.
    """
    media: InterviewAnswerMediaResponse
    answer: InterviewAnswerResponse
    evaluation: Optional[InterviewAnswerEvaluation] = None
    next_question: Optional[InterviewQuestionResponse] = None
    follow_up_generated: bool = False
    is_complete: bool = False
    message: str = "Media uploaded"
    model_config = ConfigDict(from_attributes=True)


class ProctoringEventIn(BaseModel):
    """A single client-reported proctoring observation.

    Events represent continuous occurrences (periods), not detection frames.
    Severity is optional; the server derives a default from the event type.
    """
    client_event_id: UUID
    event_type: ProctoringEventType
    severity: Optional[ProctoringSeverity] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[float] = Field(default=None, ge=0, le=86400)
    question_id: Optional[UUID] = None
    event_metadata: Optional[Dict[str, Any]] = None
    model_config = ConfigDict(from_attributes=True)


class ProctoringEventBatchIn(BaseModel):
    events: List[ProctoringEventIn] = Field(default=[], max_length=100)
    model_config = ConfigDict(from_attributes=True)


class ProctoringEventBatchResponse(BaseModel):
    accepted: int = 0
    duplicates: int = 0
    rejected: int = 0
    limit_reached: bool = False
    message: str = "Proctoring events processed"
    model_config = ConfigDict(from_attributes=True)


class ProctoringEventResponse(BaseModel):
    id: UUID
    interview_id: UUID
    event_type: ProctoringEventType
    severity: ProctoringSeverity
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    question_id: Optional[UUID] = None
    event_metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ProctoringSummaryResponse(BaseModel):
    interview_id: UUID
    total_events: int = 0
    counts: Dict[str, int] = {}
    durations_seconds: Dict[str, float] = {}
    first_event_at: Optional[datetime] = None
    last_event_at: Optional[datetime] = None
    event_window_seconds: Optional[float] = None
    consent_acknowledged_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
