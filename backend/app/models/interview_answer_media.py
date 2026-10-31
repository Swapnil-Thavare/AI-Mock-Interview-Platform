import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import created_at_field, updated_at_field

if TYPE_CHECKING:
    from app.models.interview_answer import InterviewAnswer


class MediaKind(str, enum.Enum):
    AUDIO = "AUDIO"
    VIDEO = "VIDEO"


class MediaUploadStatus(str, enum.Enum):
    PENDING = "PENDING"
    UPLOADED = "UPLOADED"
    FAILED = "FAILED"


class TranscriptionStatus(str, enum.Enum):
    NONE = "NONE"
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class InterviewAnswerMedia(SQLModel, table=True):
    __tablename__ = "interview_answer_media"

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
    interview_id: uuid.UUID = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("interviews.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    media_type: MediaKind = Field(
        default=MediaKind.AUDIO,
        sa_column=sa.Column(
            sa.Enum(
                MediaKind,
                name="answer_media_type",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'AUDIO'"),
        ),
    )
    mime_type: str = Field(
        sa_column=sa.Column(sa.String(100), nullable=False)
    )
    storage_key: str = Field(
        sa_column=sa.Column(sa.String(512), nullable=False)
    )
    file_size: int = Field(
        default=0,
        sa_column=sa.Column(sa.Integer, nullable=False),
    )
    duration_seconds: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    status: MediaUploadStatus = Field(
        default=MediaUploadStatus.PENDING,
        sa_column=sa.Column(
            sa.Enum(
                MediaUploadStatus,
                name="media_upload_status",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'PENDING'"),
        ),
    )
    uploaded_at: Optional[datetime] = Field(
        default=None,
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True),
    )
    transcription_status: TranscriptionStatus = Field(
        default=TranscriptionStatus.NONE,
        sa_column=sa.Column(
            sa.Enum(
                TranscriptionStatus,
                name="transcription_status",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'NONE'"),
        ),
    )
    transcript_text: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.Text, nullable=True),
    )
    transcription_error: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.String(512), nullable=True),
    )
    transcribed_at: Optional[datetime] = Field(
        default=None,
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True),
    )
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()

    answer: "InterviewAnswer" = Relationship(back_populates="media")
