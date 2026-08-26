"""Application logging — mirrors the reference's `app.logging` module."""
import logging
import os
from pathlib import Path

_INITIALIZED = False
_LOG_DIR = Path("tmp")
_LOG_FILE = _LOG_DIR / "app.log"


def setup_logging() -> None:
    global _INITIALIZED
    if _INITIALIZED:
        return

    _LOG_DIR.mkdir(parents=True, exist_ok=True)
    root = logging.getLogger()
    root.handlers.clear()
    level = logging.DEBUG if os.getenv("DEBUG") == "true" else logging.INFO
    root.setLevel(level)

    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    console = logging.StreamHandler()
    console.setFormatter(formatter)
    root.addHandler(console)

    file_handler = logging.FileHandler(_LOG_FILE, encoding="utf-8")
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    _INITIALIZED = True


def get_logger(name: str) -> logging.Logger:
    if not _INITIALIZED:
        setup_logging()
    return logging.getLogger(name)
