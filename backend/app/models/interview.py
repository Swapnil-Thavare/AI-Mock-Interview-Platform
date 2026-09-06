import enum
import uuid
from datetime import datetime
from typing import List, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import created_at_field, updated_at_field


class InterviewStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Interview(SQLModel, table=True):
    __tablename__ = "interviews"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID, primary_key=True),
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
    resume_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("resumes.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    job_description_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("job_descriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    title: str = Field(
        sa_column=sa.Column(sa.String(255), nullable=False)
    )
    difficulty: str = Field(
        default="medium",
        sa_column=sa.Column(
            sa.String(20),
            nullable=False,
            server_default=sa.text("'medium'"),
        ),
    )
    question_count: int = Field(
        default=5,
        sa_column=sa.Column(sa.Integer, nullable=False),
    )
    duration: int = Field(
        default=30,
        sa_column=sa.Column(sa.Integer, nullable=False),
    )
    question_types: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    status: InterviewStatus = Field(
        default=InterviewStatus.PENDING,
        sa_column=sa.Column(
            sa.Enum(
                InterviewStatus,
                name="interview_status",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'PENDING'"),
        ),
    )
    completed_at: Optional[datetime] = Field(
        default=None,
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True),
    )
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()

    owner: "User" = Relationship(back_populates="interviews")
    resume: Optional["Resume"] = Relationship(back_populates="interviews")
    job_description: Optional["JobDescription"] = Relationship(
        back_populates="interviews"
    )
    questions: List["InterviewQuestion"] = Relationship(
        back_populates="interview",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "lazy": "selectin",
            "order_by": "InterviewQuestion.order",
        },
    )
    answers: List["InterviewAnswer"] = Relationship(
        back_populates="interview",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "lazy": "selectin",
        },
    )
    result: Optional["InterviewResult"] = Relationship(
        back_populates="interview",
        sa_relationship_kwargs={
            "lazy": "selectin",
            "uselist": False,
        },
    )
