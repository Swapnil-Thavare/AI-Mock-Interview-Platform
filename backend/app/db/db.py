"""Database entry-point — mirrors the reference's `app.db.db` layout."""
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=Session,
)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class _Database:
    """Sync SQLAlchemy wrapper that gives services the same module shape as
    the reference's asyncpg `Database` singleton."""

    @contextmanager
    def session(self):
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    @contextmanager
    def transaction(self):
        db = SessionLocal()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()


Database = _Database()

__all__ = ["Database", "engine", "get_db", "SessionLocal"]
