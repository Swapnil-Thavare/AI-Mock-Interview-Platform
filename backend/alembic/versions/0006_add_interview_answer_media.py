"""add interview answer media table

Revision ID: 8b2d4e6fa1c7
Revises: 3f7c2a1d9e54
Create Date: 2026-10-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8b2d4e6fa1c7'
down_revision: Union[str, None] = '3f7c2a1d9e54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    answer_media_type_enum = sa.Enum('AUDIO', 'VIDEO', name='answer_media_type')
    answer_media_type_enum.create(op.get_bind(), checkfirst=True)

    media_upload_status_enum = sa.Enum('PENDING', 'UPLOADED', 'FAILED', name='media_upload_status')
    media_upload_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'interview_answer_media',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('answer_id', sa.UUID(), nullable=False),
        sa.Column('interview_id', sa.UUID(), nullable=False),
        sa.Column('media_type', postgresql.ENUM('AUDIO', 'VIDEO', name='answer_media_type', create_type=False), server_default=sa.text("'AUDIO'"), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('storage_key', sa.String(length=512), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('status', postgresql.ENUM('PENDING', 'UPLOADED', 'FAILED', name='media_upload_status', create_type=False), server_default=sa.text("'PENDING'"), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['answer_id'], ['interview_answers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_interview_answer_media_answer_id'), 'interview_answer_media', ['answer_id'], unique=True)
    op.create_index(op.f('ix_interview_answer_media_interview_id'), 'interview_answer_media', ['interview_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_interview_answer_media_interview_id'), table_name='interview_answer_media')
    op.drop_index(op.f('ix_interview_answer_media_answer_id'), table_name='interview_answer_media')
    op.drop_table('interview_answer_media')
    postgresql.ENUM(name='media_upload_status', create_type=False).drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name='answer_media_type', create_type=False).drop(op.get_bind(), checkfirst=True)
