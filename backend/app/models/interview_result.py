import uuid
from datetime import datetime
from typing import List, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import created_at_field, updated_at_field


class InterviewResult(SQLModel, table=True):
    __tablename__ = "interview_results"

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
            unique=True,
        ),
    )
    score: float = Field(
        sa_column=sa.Column(sa.Float, nullable=False)
    )
    feedback: str = Field(
        sa_column=sa.Column(sa.Text, nullable=False)
    )
    strengths: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    weaknesses: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    technical_score: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    communication_score: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    relevance_score: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    problem_solving_score: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    resume_alignment: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.Text, nullable=True),
    )
    missing_skills: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    suggestions: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    preparation_topics: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    question_results: List[dict] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    completion_summary: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.Text, nullable=True),
    )
    overall_feedback: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.Text, nullable=True),
    )
    confidence: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    uncertainty_notes: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.Text, nullable=True),
    )
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()

    interview: "Interview" = Relationship(back_populates="result")
