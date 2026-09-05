import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import created_at_field, updated_at_field


class Resume(SQLModel, table=True):
    __tablename__ = "resumes"

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
    filename: str = Field(
        sa_column=sa.Column(sa.String(255), nullable=False)
    )
    file_size: int = Field(
        default=0,
        sa_column=sa.Column(sa.Integer, nullable=False),
    )
    file_path: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.String(512), nullable=True),
    )
    skills: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    extracted_text: str = Field(
        default="",
        sa_column=sa.Column(sa.Text, nullable=False),
    )
    analysis: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=sa.Column(sa.JSON, nullable=False),
    )
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()

    owner: "User" = Relationship(back_populates="resumes")
    interviews: List["Interview"] = Relationship(
        back_populates="resume",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
