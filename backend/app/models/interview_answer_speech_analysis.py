import enum
import uuid
from datetime import datetime
from typing import List, Optional

import sqlalchemy as sa
from sqlmodel import Field, SQLModel

from app.models.base import created_at_field, updated_at_field


class SpeechAnalysisStatus(str, enum.Enum):
    NONE = "NONE"
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class InterviewAnswerSpeechAnalysis(SQLModel, table=True):
    """Communication-analysis observations for one spoken answer (Phase 7E).

    One row per answer (answer_id unique). Deterministic metrics are always
    persisted; status FAILED means only the Gemini communication call failed
    and may be retried — deterministic fields stay populated either way.
    All values are descriptive observations, never scores.
    """

    __tablename__ = "interview_answer_speech_analysis"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID, primary_key=True),
    )
    answer_id: uuid.UUID = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("interview_answers.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
            unique=True,
        ),
    )
    media_id: uuid.UUID = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("interview_answer_media.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
            unique=True,
        ),
    )
    interview_id: uuid.UUID = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("interviews.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    status: SpeechAnalysisStatus = Field(
        default=SpeechAnalysisStatus.PENDING,
        sa_column=sa.Column(
            sa.Enum(
                SpeechAnalysisStatus,
                name="speech_analysis_status",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'PENDING'"),
        ),
    )
    word_count: Optional[int] = Field(
        default=None,
        sa_column=sa.Column(sa.Integer, nullable=True),
    )
    recording_seconds: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    speech_seconds: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    wpm_recording: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    wpm_speech: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    filler_count: Optional[int] = Field(
        default=None,
        sa_column=sa.Column(sa.Integer, nullable=True),
    )
    filler_per_100_words: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    filler_breakdown: Optional[dict] = Field(
        default=None,
        sa_column=sa.Column(sa.JSON, nullable=True),
    )
    pause_count: Optional[int] = Field(
        default=None,
        sa_column=sa.Column(sa.Integer, nullable=True),
    )
    pause_total_seconds: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    pause_avg_seconds: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    pause_longest_seconds: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    unique_word_ratio: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    top_repeated_words: Optional[List[dict]] = Field(
        default=None,
        sa_column=sa.Column(sa.JSON, nullable=True),
    )
    structure_summary: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.Text, nullable=True),
    )
    organization_notes: Optional[List[str]] = Field(
        default=None,
        sa_column=sa.Column(sa.JSON, nullable=True),
    )
    clarity_notes: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.Text, nullable=True),
    )
    communication_strengths: Optional[List[str]] = Field(
        default=None,
        sa_column=sa.Column(sa.JSON, nullable=True),
    )
    communication_improvements: Optional[List[str]] = Field(
        default=None,
        sa_column=sa.Column(sa.JSON, nullable=True),
    )
    analysis_error: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.String(512), nullable=True),
    )
    analyzed_at: Optional[datetime] = Field(
        default=None,
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True),
    )
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()
