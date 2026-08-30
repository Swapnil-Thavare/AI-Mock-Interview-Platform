import uuid
from datetime import datetime
from typing import List, Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import created_at_field, updated_at_field


class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = (sa.Index("ix_users_email", "email", unique=True),)

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID, primary_key=True),
    )
    email: str = Field(sa_column=sa.Column(sa.String(255), nullable=False))
    full_name: str = Field(
        sa_column=sa.Column(sa.String(255), nullable=False)
    )
    hashed_password: str = Field(
        sa_column=sa.Column(sa.String(255), nullable=False)
    )
    is_active: bool = Field(
        default=True,
        sa_column=sa.Column(
            sa.Boolean, nullable=False, server_default=sa.text("true")
        ),
    )
    phone: Optional[str] = Field(
        default=None, sa_column=sa.Column(sa.String(50), nullable=True)
    )
    skills: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=True),
    )
    education: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=True),
    )
    experience: List[str] = Field(
        default=[],
        sa_column=sa.Column(sa.JSON, nullable=True),
    )
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()

    resumes: List["Resume"] = Relationship(
        back_populates="owner",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "lazy": "selectin",
        },
    )
    job_descriptions: List["JobDescription"] = Relationship(
        back_populates="owner",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "lazy": "selectin",
        },
    )
    interviews: List["Interview"] = Relationship(
        back_populates="owner",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "lazy": "selectin",
        },
    )
