import uuid
from typing import List, Optional

from sqlalchemy import ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Resume(Base, TimestampMixin):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    skills: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, default="", nullable=False)

    owner: Mapped["User"] = relationship("User", back_populates="resumes")
    interviews: Mapped[List["Interview"]] = relationship("Interview", back_populates="resume")
