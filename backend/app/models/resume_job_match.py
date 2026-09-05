import uuid
from datetime import datetime
from typing import List

import sqlalchemy as sa
from sqlmodel import Field, SQLModel

from app.models.base import created_at_field, updated_at_field


class ResumeJobMatch(SQLModel, table=True):
    __tablename__ = "resume_job_matches"

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
    resume_id: uuid.UUID = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("resumes.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    job_description_id: uuid.UUID = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("job_descriptions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    overall_match_score: int = Field(
        default=0,
        sa_column=sa.Column(sa.Integer, nullable=False),
    )
    matched_skills: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    missing_skills: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    strengths: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    gaps: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    recommendations: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()
