"""PDF text extraction for text-based resumes."""
import io

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.exception import CustomException

_MIN_TEXT_CHARS = 40


def validate_pdf_bytes(raw: bytes) -> None:
    if not raw:
        raise CustomException(422, "Uploaded file is empty.")
    if not raw.startswith(b"%PDF"):
        raise CustomException(422, "File does not appear to be a valid PDF.")


def extract_text_from_pdf(raw: bytes) -> str:
    validate_pdf_bytes(raw)
    try:
        reader = PdfReader(io.BytesIO(raw))
        pages = [p.extract_text() or "" for p in reader.pages]
        text = "\n".join(pages).strip()
    except PdfReadError as exc:
        raise CustomException(422, f"Could not read PDF: {exc}") from exc
    except Exception as exc:
        raise CustomException(422, f"PDF extraction failed: {exc}") from exc

    if len(text.replace(" ", "").replace("\n", "")) < _MIN_TEXT_CHARS:
        raise CustomException(
            422,
            "No meaningful text could be extracted from this PDF. "
            "Scanned image resumes are not supported yet.",
        )
    return text
