"""add interview proctoring events table and consent timestamp

Revision ID: 2e6b9d4c8f51
Revises: 5c9e1a7f3b28
Create Date: 2026-10-31 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '2e6b9d4c8f51'
down_revision: Union[str, None] = '5c9e1a7f3b28'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_EVENT_TYPES = (
    'FACE_NOT_DETECTED',
    'MULTIPLE_FACES_DETECTED',
    'CAMERA_DISCONNECTED',
    'CAMERA_INTERRUPTED',
    'TAB_HIDDEN',
    'WINDOW_FOCUS_LOST',
)
_SEVERITIES = ('INFO', 'WARNING')


def upgrade() -> None:
    event_type_enum = sa.Enum(*_EVENT_TYPES, name='proctoring_event_type')
    event_type_enum.create(op.get_bind(), checkfirst=True)

    severity_enum = sa.Enum(*_SEVERITIES, name='proctoring_severity')
    severity_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'interview_proctoring_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('interview_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('question_id', sa.UUID(), nullable=True),
        sa.Column('client_event_id', sa.UUID(), nullable=False),
        sa.Column(
            'event_type',
            postgresql.ENUM(
                *_EVENT_TYPES, name='proctoring_event_type', create_type=False
            ),
            nullable=False,
        ),
        sa.Column(
            'severity',
            postgresql.ENUM(
                *_SEVERITIES, name='proctoring_severity', create_type=False
            ),
            nullable=False,
        ),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('event_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['question_id'], ['interview_questions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('interview_id', 'client_event_id', name='uq_proctoring_events_interview_client'),
    )
    op.create_index(op.f('ix_interview_proctoring_events_interview_id'), 'interview_proctoring_events', ['interview_id'], unique=False)
    op.create_index(op.f('ix_interview_proctoring_events_user_id'), 'interview_proctoring_events', ['user_id'], unique=False)
    op.create_index(op.f('ix_interview_proctoring_events_question_id'), 'interview_proctoring_events', ['question_id'], unique=False)

    op.add_column(
        'interviews',
        sa.Column('proctoring_consent_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('interviews', 'proctoring_consent_at')
    op.drop_index(op.f('ix_interview_proctoring_events_question_id'), table_name='interview_proctoring_events')
    op.drop_index(op.f('ix_interview_proctoring_events_user_id'), table_name='interview_proctoring_events')
    op.drop_index(op.f('ix_interview_proctoring_events_interview_id'), table_name='interview_proctoring_events')
    op.drop_table('interview_proctoring_events')
    postgresql.ENUM(name='proctoring_severity', create_type=False).drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name='proctoring_event_type', create_type=False).drop(op.get_bind(), checkfirst=True)
