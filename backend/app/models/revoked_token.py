import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlmodel import Field, SQLModel

from app.models.base import created_at_field


class RevokedToken(SQLModel, table=True):
    __tablename__ = "revoked_tokens"
    __table_args__ = (sa.Index("ix_revoked_tokens_jti", "jti", unique=True),)

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID, primary_key=True),
    )
    jti: str = Field(
        sa_column=sa.Column(sa.String(64), nullable=False)
    )
    user_id: uuid.UUID = Field(
        sa_column=sa.Column(
            sa.UUID,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    expires_at: datetime = Field(
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=False)
    )
    created_at: datetime | None = created_at_field()
