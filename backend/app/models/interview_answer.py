import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import created_at_field, updated_at_field

if TYPE_CHECKING:
    from app.models.interview import Interview
    from app.models.interview_question import InterviewQuestion


class InterviewAnswer(SQLModel, table=True):
    __tablename__ = "interview_answers"

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
    question_id: uuid.UUID = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("interview_questions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    answer_text: str = Field(
        sa_column=sa.Column(sa.Text, nullable=False)
    )
    score: Optional[float] = Field(
        default=None,
        sa_column=sa.Column(sa.Float, nullable=True),
    )
    evaluation: Optional[dict] = Field(
        default=None,
        sa_column=sa.Column(sa.JSON, nullable=True),
    )
    evaluated_at: Optional[datetime] = Field(
        default=None,
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True),
    )
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()

    interview: "Interview" = Relationship(back_populates="answers")
    question: "InterviewQuestion" = Relationship(back_populates="answers")
