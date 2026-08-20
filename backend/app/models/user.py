import uuid
from typing import List

from sqlalchemy import Boolean, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    skills: Mapped[List[str]] = mapped_column(JSONB, nullable=True, default=list)
    education: Mapped[List[str]] = mapped_column(JSONB, nullable=True, default=list)
    experience: Mapped[List[str]] = mapped_column(JSONB, nullable=True, default=list)

    resumes: Mapped[List["Resume"]] = relationship(
        "Resume", back_populates="owner", cascade="all, delete-orphan", lazy="selectin"
    )
    job_descriptions: Mapped[List["JobDescription"]] = relationship(
        "JobDescription",
        back_populates="owner",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    interviews: Mapped[List["Interview"]] = relationship(
        "Interview",
        back_populates="owner",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
