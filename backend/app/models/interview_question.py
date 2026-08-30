import enum
import uuid
from datetime import datetime
from typing import List, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import created_at_field, updated_at_field


class QuestionType(str, enum.Enum):
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"


class InterviewQuestion(SQLModel, table=True):
    __tablename__ = "interview_questions"

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
    question_text: str = Field(
        sa_column=sa.Column(sa.Text, nullable=False)
    )
    question_type: QuestionType = Field(
        default=QuestionType.TECHNICAL,
        sa_column=sa.Column(
            sa.Enum(
                QuestionType,
                name="question_type",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'TECHNICAL'"),
        ),
    )
    order: int = Field(
        default=0,
        sa_column=sa.Column(sa.Integer, nullable=False),
    )
    category: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.String(255), nullable=True),
    )
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()

    interview: "Interview" = Relationship(back_populates="questions")
    answers: List["InterviewAnswer"] = Relationship(
        back_populates="question",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "lazy": "selectin",
        },
    )
