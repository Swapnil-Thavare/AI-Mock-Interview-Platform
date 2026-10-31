"""Speech-to-text provider for interview answer recordings.

Follows the same conventions as gemini_provider.py: one provider, all
network calls isolated in this module, sanitized CustomException errors so
callers never see raw SDK responses or credentials.

Recordings are sent inline via generate_content (google-genai is already a
dependency — no new packages). Documented Gemini-supported containers cover
the ones the app accepts: audio/webm, audio/ogg, audio/mp4, video/webm,
video/mp4, video/quicktime. Inline requests are officially recommended
below a 20 MB total request size; the app's 25 MB upload cap can exceed
that for very large recordings, which then surface as a FAILED
transcription state recoverable by retry/re-upload.
"""
import anyio
from google import genai
from google.genai import types

from app.core.config import get_settings
from app.exception import CustomException

_TRANSCRIBE_PROMPT = (
    "Transcribe the speech in this recording into plain text. "
    "Return only the spoken words in the order they were said, without "
    "timestamps, speaker labels, descriptions, or commentary. If the "
    "recording contains no intelligible speech, return an empty response."
)

_DEFAULT_TIMEOUT = 90.0


class TranscriptionProvider:
    """Minimal protocol the interview service depends on."""

    async def transcribe(self, content: bytes, mime_type: str) -> str:
        raise NotImplementedError


class GeminiTranscriptionProvider(TranscriptionProvider):
    """Transcribes audio/video bytes with Gemini and returns plain text."""

    async def transcribe(self, content: bytes, mime_type: str) -> str:
        settings = get_settings()
        if not settings.GEMINI_API_KEY:
            raise CustomException(
                503, "Transcription service is not configured."
            )
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        model = settings.GEMINI_MODEL or "gemini-3.6-flash"
        timeout = float(settings.TRANSCRIPTION_TIMEOUT or _DEFAULT_TIMEOUT)

        try:
            with anyio.move_on_after(timeout) as cancel_scope:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=[
                        types.Part.from_bytes(
                            data=content, mime_type=mime_type
                        ),
                        _TRANSCRIBE_PROMPT,
                    ],
                )
            if cancel_scope.cancelled_caught:
                raise CustomException(
                    504, "Transcription request timed out."
                )
            return (response.text or "").strip()
        except CustomException:
            raise
        except TimeoutError as exc:
            raise CustomException(
                504, "Transcription request timed out."
            ) from exc
        except Exception as exc:
            raise CustomException(
                502,
                f"Transcription request failed: {type(exc).__name__}",
            ) from exc


def default_transcription_provider() -> TranscriptionProvider:
    provider_name = (
        get_settings().TRANSCRIPTION_PROVIDER or "gemini"
    ).strip().lower()
    if provider_name == "gemini":
        return GeminiTranscriptionProvider()
    raise CustomException(
        503, f"Unsupported transcription provider: {provider_name}"
    )
