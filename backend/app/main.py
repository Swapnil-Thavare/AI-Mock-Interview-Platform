"""FastAPI root app — mirrors the reference's router mounting pattern."""
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import router_v1
from app.core.config import get_settings
from app.logging import setup_logging
from app.utils.response_utils.response_format import ResponseFormat

setup_logging()
settings = get_settings()

app = FastAPI(title=settings.PROJECT_NAME)

app.add_exception_handler(HTTPException, ResponseFormat.http_exception_handler)
app.add_exception_handler(
    RequestValidationError, ResponseFormat.validation_exception_handler
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.PROJECT_NAME}


app.include_router(router_v1, prefix="/api/v1")
