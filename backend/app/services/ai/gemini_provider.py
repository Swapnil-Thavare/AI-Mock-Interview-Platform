"""Gemini provider for structured JSON generation.

Uses the google-genai SDK with JSON-mode Pydantic schemas. All network calls are
async and isolated in this module; the rest of the app receives validated
Pydantic models or typed application errors.
"""
import json
import logging
import random
from typing import Type, TypeVar

import anyio
import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.core.config import get_settings
from app.exception import CustomException

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_MAX_ATTEMPTS = 6
_DEFAULT_TIMEOUT = 60.0
_RETRY_BASE_DELAY = 1.0
_RETRYABLE_CODES = {408, 409, 425, 429, 500, 502, 503, 504}


def _is_retryable(exc: Exception) -> bool:
    """Transient failures worth retrying: rate limits, server errors, and
    network/timeout issues. Client errors (bad request, auth, etc.) are not."""
    if isinstance(exc, genai_errors.ServerError):
        return True
    if isinstance(exc, genai_errors.APIError):
        return exc.code in _RETRYABLE_CODES
    if isinstance(exc, (httpx.TransportError, TimeoutError)):
        return True
    return False


def _retry_delay(attempt: int) -> float:
    """Exponential backoff with jitter: ~1s, ~2s, ~4s (+/-50%)."""
    return _RETRY_BASE_DELAY * (2 ** attempt) * random.uniform(0.5, 1.5)


def _get_client() -> genai.Client:
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise CustomException(503, "AI service is not configured (GEMINI_API_KEY missing).")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def get_model_chain() -> list[str]:
    """Ordered model failover list: primary first, then fallbacks.

    GEMINI_FALLBACK_MODEL accepts a comma-separated list; each entry is a
    separate quota/capacity pool, so a longer chain survives saturated models.
    """
    settings = get_settings()
    primary = settings.GEMINI_MODEL or "gemini-3.8-flash"
    chain = [primary]
    for name in (settings.GEMINI_FALLBACK_MODEL or "").split(","):
        name = name.strip()
        if name and name not in chain:
            chain.append(name)
    if len(chain) == 1:
        chain.append("gemini-3.7-flash")
    return chain


class GeminiProvider:
    """Concrete Gemini provider that completes a prompt and returns a parsed
    Pydantic model. The prompt should already contain the task and rules; the
    `response_schema` enforces the JSON shape."""

    async def complete_json(
        self,
        prompt: str,
        response_schema: Type[T],
        timeout: float | None = None,
    ) -> T:
        client = _get_client()
        models = get_model_chain()
        model_index = 0
        effective_timeout = float(
            timeout or get_settings().GEMINI_TIMEOUT or _DEFAULT_TIMEOUT
        )
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=0.2,
            max_output_tokens=8192,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(
                disable=True
            ),
        )

        last_error: Exception | None = None
        for attempt in range(_MAX_ATTEMPTS):
            model = models[model_index]
            try:
                with anyio.move_on_after(effective_timeout) as cancel_scope:
                    response = await client.aio.models.generate_content(
                        model=model,
                        contents=prompt,
                        config=config,
                    )
                if cancel_scope.cancelled_caught:
                    raise TimeoutError("Gemini request timed out.")

                if not response.text:
                    raise CustomException(502, "Gemini returned an empty response.")

                data = json.loads(response.text)
                if not isinstance(data, dict):
                    raise CustomException(
                        502, "Gemini returned an invalid JSON structure."
                    )
                return response_schema.model_validate(data)
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
            except TimeoutError as exc:
                last_error = exc
                if model_index < len(models) - 1:
                    model_index += 1
                    logger.warning(
                        "Gemini timed out on %s; switching to %s",
                        model,
                        models[model_index],
                    )
            except CustomException as exc:
                # Empty/malformed responses are often transient — retry them.
                last_error = exc
            except Exception as exc:
                if not _is_retryable(exc):
                    # Wrap unexpected errors so callers never see raw keys.
                    raise CustomException(
                        502, f"Gemini request failed: {type(exc).__name__}"
                    ) from exc
                last_error = exc
                # Capacity/rate-limit errors: fail over to the next model.
                if model_index < len(models) - 1:
                    model_index += 1
                    logger.warning(
                        "Gemini %s failed on %s; switching to %s",
                        type(exc).__name__,
                        model,
                        models[model_index],
                    )

            if attempt < _MAX_ATTEMPTS - 1:
                delay = _retry_delay(attempt)
                logger.warning(
                    "Gemini attempt %d/%d failed (%s: %s); retrying in %.1fs",
                    attempt + 1,
                    _MAX_ATTEMPTS,
                    type(last_error).__name__,
                    last_error,
                    delay,
                )
                await anyio.sleep(delay)

        if isinstance(last_error, CustomException):
            raise last_error
        if isinstance(last_error, (json.JSONDecodeError, ValidationError)):
            raise CustomException(
                502,
                "Could not parse a valid structured response from Gemini.",
                {"reason": "invalid_response"},
            )
        if isinstance(last_error, TimeoutError):
            raise CustomException(
                504, "Gemini request timed out."
            ) from last_error
        raise CustomException(
            502, f"Gemini request failed: {type(last_error).__name__}"
        ) from last_error
