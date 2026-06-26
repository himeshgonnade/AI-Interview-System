"""
routes/report.py — Interview performance report endpoint.

GET /api/report/{session_id}
  Returns the full aggregated report: scores, improvement plan, per-question breakdown.
  First call generates the report (may take ~3s for LLM plan); subsequent calls are instant.
"""

import logging
from fastapi import APIRouter, HTTPException, status

from db.mongo import get_db
from services.report_generator import generate_report

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/{session_id}",
    summary="Get full performance report",
    description=(
        "Generates (or retrieves cached) the final interview performance report. "
        "Includes aggregated scores, per-question breakdown, and LLM improvement plan."
    ),
)
async def get_report(session_id: str):
    """Return the full performance report for a completed session."""
    db = get_db()

    # Session must exist
    session = await db["sessions"].find_one({"_id": session_id})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )

    try:
        report = await generate_report(session_id)
        return report
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Report generation failed for {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate report. Please try again.",
        )
