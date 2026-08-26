"""Single source of truth for the success / error envelope."""
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ResponseFormat:
    @staticmethod
    def success(status_code: int, message: str, data: Any = None) -> dict:
        return {
            "success": True,
            "status_code": status_code,
            "message": message,
            "timestamp": _now_iso(),
            "data": data if data is not None else {},
        }

    @staticmethod
    def error(status_code: int, message: str, details: Any = None) -> dict:
        return {
            "success": False,
            "status_code": status_code,
            "message": message,
            "timestamp": _now_iso(),
            "error": {"details": details},
        }

    @staticmethod
    def validation_exception_handler(request: Request, exc: RequestValidationError):
        first = (exc.errors() or [{}])[0]
        error_msg = first.get("msg") or first.get("message") or "Validation failed"
        body = {
            "success": False,
            "status_code": 422,
            "message": error_msg,
            "timestamp": _now_iso(),
            "error": {
                "type": "validation_error",
                "loc": first.get("loc", []),
                "value": first.get("input"),
            },
        }
        return JSONResponse(status_code=422, content=body)

    @staticmethod
    def http_exception_handler(request: Request, exc: HTTPException):
        message = getattr(exc, "message", None) or (
            exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        )
        details = getattr(exc, "details", None)
        return JSONResponse(
            status_code=exc.status_code,
            content=ResponseFormat.error(exc.status_code, message, details),
            headers=getattr(exc, "headers", None) or None,
        )
