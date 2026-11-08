"""add transcription fields to interview answer media

Revision ID: 5c9e1a7f3b28
Revises: 8b2d4e6fa1c7
Create Date: 2026-10-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '5c9e1a7f3b28'
down_revision: Union[str, None] = '8b2d4e6fa1c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    transcription_status_enum = sa.Enum(
        'NONE', 'PENDING', 'COMPLETED', 'FAILED', name='transcription_status'
    )
    transcription_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        'interview_answer_media',
        sa.Column(
            'transcription_status',
            postgresql.ENUM(
                'NONE', 'PENDING', 'COMPLETED', 'FAILED',
                name='transcription_status', create_type=False,
            ),
            server_default=sa.text("'NONE'"),
            nullable=False,
        ),
    )
    op.add_column(
        'interview_answer_media',
        sa.Column('transcript_text', sa.Text(), nullable=True),
    )
    op.add_column(
        'interview_answer_media',
        sa.Column('transcription_error', sa.String(length=512), nullable=True),
    )
    op.add_column(
        'interview_answer_media',
        sa.Column('transcribed_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('interview_answer_media', 'transcribed_at')
    op.drop_column('interview_answer_media', 'transcription_error')
    op.drop_column('interview_answer_media', 'transcript_text')
    op.drop_column('interview_answer_media', 'transcription_status')
    postgresql.ENUM(name='transcription_status', create_type=False).drop(
        op.get_bind(), checkfirst=True
    )
