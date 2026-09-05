import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import created_at_field, updated_at_field


class JobDescription(SQLModel, table=True):
    __tablename__ = "job_descriptions"

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
    title: str = Field(
        sa_column=sa.Column(sa.String(255), nullable=False)
    )
    company: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.String(255), nullable=True),
    )
    description: str = Field(
        sa_column=sa.Column(sa.Text, nullable=False)
    )
    required_skills: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    analysis: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()

    owner: "User" = Relationship(back_populates="job_descriptions")
    interviews: List["Interview"] = Relationship(
        back_populates="job_description",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
