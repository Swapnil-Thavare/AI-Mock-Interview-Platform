import enum
import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlmodel import Field, SQLModel

from app.models.base import created_at_field, updated_at_field


class ProctoringEventType(str, enum.Enum):
    FACE_NOT_DETECTED = "FACE_NOT_DETECTED"
    MULTIPLE_FACES_DETECTED = "MULTIPLE_FACES_DETECTED"
    CAMERA_DISCONNECTED = "CAMERA_DISCONNECTED"
    CAMERA_INTERRUPTED = "CAMERA_INTERRUPTED"
    TAB_HIDDEN = "TAB_HIDDEN"
    WINDOW_FOCUS_LOST = "WINDOW_FOCUS_LOST"


class ProctoringSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"


class InterviewProctoringEvent(SQLModel, table=True):
    """Objective session-integrity observation for AUDIO/VIDEO interviews.

    One row per continuous occurrence (a period), never per detection frame.
    (interview_id, client_event_id) is unique so batched client retries are
    idempotent. No frames, images, landmarks, or biometric data are stored.
    """

    __tablename__ = "interview_proctoring_events"
    __table_args__ = (
        sa.UniqueConstraint(
            "interview_id",
            "client_event_id",
            name="uq_proctoring_events_interview_client",
        ),
    )

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID, primary_key=True),
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
    user_id: uuid.UUID = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    question_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("interview_questions.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    client_event_id: uuid.UUID = Field(
        default=None,
        sa_column=sa.Column(sa.UUID, nullable=False),
    )
    event_type: ProctoringEventType = Field(
        sa_column=sa.Column(
            sa.Enum(
                ProctoringEventType,
                name="proctoring_event_type",
                create_type=False,
            ),
            nullable=False,
        ),
    )
    severity: ProctoringSeverity = Field(
        sa_column=sa.Column(
            sa.Enum(
                ProctoringSeverity,
                name="proctoring_severity",
                create_type=False,
            ),
            nullable=False,
        ),
    )
    started_at: datetime = Field(
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=False),
    )
    ended_at: Optional[datetime] = Field(
        default=None,
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True),
    )
    duration_seconds: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    event_metadata: Optional[dict] = Field(
        default=None,
        sa_column=sa.Column(sa.JSON, nullable=True),
    )
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()
