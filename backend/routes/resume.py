"""
routes/resume.py — PDF resume parsing endpoint.

POST /api/resume/parse
  Accepts a PDF upload, extracts plain text, and returns it.
  The frontend stores the text in state and sends it as `resume_text`
  when creating the session — no binary storage in MongoDB.
"""

import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, status

from services.resume_parser import extract_text_from_pdf

logger = logging.getLogger(__name__)
router = APIRouter()

_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/parse",
    summary="Parse PDF resume",
    description=(
        "Upload a PDF resume. Returns the extracted plain text which the frontend "
        "sends as resume_text in the session config for personalised questions."
    ),
)
async def parse_resume(resume: UploadFile = File(..., description="PDF resume file")):
    """Extract text from an uploaded PDF resume."""

    if resume.content_type not in ("application/pdf", "application/octet-stream"):
        # Be lenient — some browsers send octet-stream for PDFs
        if not (resume.filename or "").lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only PDF files are supported. Please upload a .pdf file.",
            )

    try:
        pdf_bytes = await resume.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read uploaded file: {e}")

    if len(pdf_bytes) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="PDF is too large (max 10 MB). Please compress and try again.",
        )

    try:
        text = await extract_text_from_pdf(pdf_bytes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        logger.error(f"Resume parsing error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse resume. Please try again.")

    # Truncate to 3000 chars to stay within LLM context budgets
    truncated = text[:3000]
    was_truncated = len(text) > 3000

    return {
        "text": truncated,
        "char_count": len(text),
        "was_truncated": was_truncated,
        "filename": resume.filename,
    }
