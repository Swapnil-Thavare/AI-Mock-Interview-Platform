"""Gemini provider for structured JSON generation.

Uses the google-genai SDK with JSON-mode Pydantic schemas. All network calls are
async and isolated in this module; the rest of the app receives validated
Pydantic models or typed application errors.
"""
import json
from typing import Type, TypeVar

import anyio
from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.core.config import get_settings
from app.exception import CustomException

T = TypeVar("T", bound=BaseModel)

_MAX_RETRIES = 2
_DEFAULT_TIMEOUT = 60.0


def _get_client() -> genai.Client:
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise CustomException(503, "AI service is not configured (GEMINI_API_KEY missing).")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _get_model() -> str:
    settings = get_settings()
    return settings.GEMINI_MODEL or "gemini-3.6-flash"


class GeminiProvider:
    """Concrete Gemini provider that completes a prompt and returns a parsed
    Pydantic model. The prompt should already contain the task and rules; the
    `response_schema` enforces the JSON shape."""

    async def complete_json(
        self,
        prompt: str,
        response_schema: Type[T],
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> T:
        client = _get_client()
        model = _get_model()
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
        for attempt in range(_MAX_RETRIES + 1):
            try:
                with anyio.move_on_after(timeout) as cancel_scope:
                    response = await client.aio.models.generate_content(
                        model=model,
                        contents=prompt,
                        config=config,
                    )
                if cancel_scope.cancelled_caught:
                    raise CustomException(504, "Gemini request timed out.")

                if not response.text:
                    raise CustomException(502, "Gemini returned an empty response.")

                data = json.loads(response.text)
                if not isinstance(data, dict):
                    raise CustomException(502, "Gemini returned an invalid JSON structure.")
                return response_schema.model_validate(data)
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
                continue
            except TimeoutError as exc:
                raise CustomException(504, "Gemini request timed out.") from exc
            except CustomException:
                raise
            except Exception as exc:
                # Wrap unexpected SDK/transport errors so callers never see raw keys.
                raise CustomException(502, f"Gemini request failed: {type(exc).__name__}")

        raise CustomException(
            502,
            "Could not parse a valid structured response from Gemini.",
            {"detail": str(last_error)} if last_error else None,
        )
