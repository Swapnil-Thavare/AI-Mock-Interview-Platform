"""Alembic async environment for SQLModel + asyncpg."""
import asyncio
import os
import sys
from logging.config import fileConfig
from urllib.parse import urlsplit, urlunsplit

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlmodel import SQLModel

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import get_settings  # noqa: E402
from app.models import SQLModel  # noqa: E402, F401

settings = get_settings()

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

_db_url = settings.DATABASE_URL
if _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
if _db_url.startswith("postgresql+psycopg"):
    _db_url = _db_url.replace("postgresql+psycopg", "postgresql+asyncpg", 1)

# asyncpg rejects libpq-only query parameters (sslmode, channel_binding) when
# they are passed as connection kwargs, so strip the query string here. SSL is
# driven via connect_args in the application if required.
_parts = urlsplit(_db_url)
_db_url = urlunsplit((_parts.scheme, _parts.netloc, _parts.path, "", ""))
config.set_main_option("sqlalchemy.url", _db_url)

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=_db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section) or {}
    engine = async_engine_from_config(section, prefix="sqlalchemy.", future=True)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
