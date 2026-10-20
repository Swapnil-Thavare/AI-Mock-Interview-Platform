"""add interview mode to interviews

Revision ID: 3f7c2a1d9e54
Revises: dab4f1eabb4c
Create Date: 2026-10-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '3f7c2a1d9e54'
down_revision: Union[str, None] = 'dab4f1eabb4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    interview_mode_enum = sa.Enum('TEXT', 'AUDIO', 'VIDEO', name='interview_mode')
    interview_mode_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        'interviews',
        sa.Column(
            'interview_mode',
            postgresql.ENUM('TEXT', 'AUDIO', 'VIDEO', name='interview_mode', create_type=False),
            server_default=sa.text("'TEXT'"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('interviews', 'interview_mode')
    postgresql.ENUM(name='interview_mode', create_type=False).drop(op.get_bind(), checkfirst=True)
