"""
resume_parser.py — PDF resume text extraction using PyMuPDF (fitz).

Extracts clean plain text from PDF bytes. Works entirely in-memory
(no temp files required). Used by routes/resume.py.
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


def _clean_text(raw: str) -> str:
    """Normalise whitespace and remove non-printable characters."""
    # Replace form feeds and carriage returns
    text = raw.replace("\r", "\n").replace("\f", "\n")
    # Collapse multiple blank lines into two at most
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse excessive spaces
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


async def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract plain text from PDF bytes using PyMuPDF.

    Args:
        pdf_bytes: Raw PDF file bytes.

    Returns:
        Extracted and cleaned plain text.

    Raises:
        ValueError: If the file is not a valid PDF or text extraction fails.
        RuntimeError: If PyMuPDF is not available.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise RuntimeError(
            "PyMuPDF (fitz) is not installed. Run: pip install PyMuPDF"
        )

    if not pdf_bytes:
        raise ValueError("Empty PDF bytes received.")

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Could not open PDF: {e}")

    page_count = doc.page_count  # save before closing
    pages_text: list[str] = []
    for page_num in range(page_count):
        try:
            page = doc.load_page(page_num)
            pages_text.append(page.get_text("text"))
        except Exception as e:
            logger.warning(f"Could not extract text from page {page_num}: {e}")

    doc.close()

    if not pages_text:
        raise ValueError("No text could be extracted from the PDF.")

    raw = "\n".join(pages_text)
    cleaned = _clean_text(raw)

    if len(cleaned) < 20:
        raise ValueError(
            "PDF appears to contain no readable text (possibly a scanned image). "
            "Please use a text-based PDF."
        )

    logger.info(f"PDF parsed: {page_count} pages, {len(cleaned)} chars extracted")
    return cleaned
