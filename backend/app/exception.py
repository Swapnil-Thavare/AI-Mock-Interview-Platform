from fastapi import HTTPException


class CustomException(HTTPException):
    """Tagged HTTPException — services raise this so the response envelope
    can carry custom messages without losing FastAPI's machinery."""

    def __init__(self, status_code: int, message: str, details: dict | None = None):
        super().__init__(status_code=status_code, detail=message)
        self.message = message
        self.details = details
