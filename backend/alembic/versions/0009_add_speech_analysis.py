"""add interview answer speech analysis table

Revision ID: 4f7c2a91b5e3
Revises: 2e6b9d4c8f51
Create Date: 2026-10-31 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '4f7c2a91b5e3'
down_revision: Union[str, None] = '2e6b9d4c8f51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_STATUSES = ('NONE', 'PENDING', 'COMPLETED', 'FAILED')


def upgrade() -> None:
    status_enum = sa.Enum(*_STATUSES, name='speech_analysis_status')
    status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'interview_answer_speech_analysis',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('answer_id', sa.UUID(), nullable=False),
        sa.Column('media_id', sa.UUID(), nullable=False),
        sa.Column('interview_id', sa.UUID(), nullable=False),
        sa.Column(
            'status',
            postgresql.ENUM(
                *_STATUSES, name='speech_analysis_status', create_type=False
            ),
            server_default=sa.text("'PENDING'"),
            nullable=False,
        ),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('recording_seconds', sa.Float(), nullable=True),
        sa.Column('speech_seconds', sa.Float(), nullable=True),
        sa.Column('wpm_recording', sa.Float(), nullable=True),
        sa.Column('wpm_speech', sa.Float(), nullable=True),
        sa.Column('filler_count', sa.Integer(), nullable=True),
        sa.Column('filler_per_100_words', sa.Float(), nullable=True),
        sa.Column('filler_breakdown', sa.JSON(), nullable=True),
        sa.Column('pause_count', sa.Integer(), nullable=True),
        sa.Column('pause_total_seconds', sa.Float(), nullable=True),
        sa.Column('pause_avg_seconds', sa.Float(), nullable=True),
        sa.Column('pause_longest_seconds', sa.Float(), nullable=True),
        sa.Column('unique_word_ratio', sa.Float(), nullable=True),
        sa.Column('top_repeated_words', sa.JSON(), nullable=True),
        sa.Column('structure_summary', sa.Text(), nullable=True),
        sa.Column('organization_notes', sa.JSON(), nullable=True),
        sa.Column('clarity_notes', sa.Text(), nullable=True),
        sa.Column('communication_strengths', sa.JSON(), nullable=True),
        sa.Column('communication_improvements', sa.JSON(), nullable=True),
        sa.Column('analysis_error', sa.String(length=512), nullable=True),
        sa.Column('analyzed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['answer_id'], ['interview_answers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['media_id'], ['interview_answer_media.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('answer_id', name='uq_speech_analysis_answer'),
        sa.UniqueConstraint('media_id', name='uq_speech_analysis_media'),
    )
    op.create_index(op.f('ix_interview_answer_speech_analysis_answer_id'), 'interview_answer_speech_analysis', ['answer_id'], unique=True)
    op.create_index(op.f('ix_interview_answer_speech_analysis_media_id'), 'interview_answer_speech_analysis', ['media_id'], unique=True)
    op.create_index(op.f('ix_interview_answer_speech_analysis_interview_id'), 'interview_answer_speech_analysis', ['interview_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_interview_answer_speech_analysis_interview_id'), table_name='interview_answer_speech_analysis')
    op.drop_index(op.f('ix_interview_answer_speech_analysis_media_id'), table_name='interview_answer_speech_analysis')
    op.drop_index(op.f('ix_interview_answer_speech_analysis_answer_id'), table_name='interview_answer_speech_analysis')
    op.drop_table('interview_answer_speech_analysis')
    postgresql.ENUM(name='speech_analysis_status', create_type=False).drop(op.get_bind(), checkfirst=True)
