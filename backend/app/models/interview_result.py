import uuid
from datetime import datetime
from typing import List

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
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()

    interview: "Interview" = Relationship(back_populates="result")
