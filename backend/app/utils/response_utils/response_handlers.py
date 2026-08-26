"""ResponseHandler — wraps every endpoint's success/error path."""
from typing import Any

from fastapi.responses import JSONResponse

from app.utils.response_utils.response_format import ResponseFormat


class ResponseHandler:
    @staticmethod
    def handle_success_response(
        message: str,
        data: Any = None,
        status_code: int = 200,
    ) -> JSONResponse:
        body = ResponseFormat.success(status_code, message, data)
        return JSONResponse(status_code=status_code, content=body)

    @staticmethod
    def handle_error_response(exc: Exception) -> JSONResponse:
        status_code = getattr(exc, "status_code", 500)
        message = getattr(exc, "message", None) or getattr(exc, "detail", None) or str(exc)
        details = getattr(exc, "details", None)
        body = ResponseFormat.error(status_code, message, details)
        return JSONResponse(status_code=status_code, content=body)
