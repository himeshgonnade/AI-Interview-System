"""
routes/session.py — Session management endpoints.

Handles creating, retrieving, and ending interview sessions.
Sessions are the root document that ties questions + answers together in MongoDB.
"""

import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status

from db.mongo import get_db
from models.schemas import (
    SessionCreate,
    SessionResponse,
    SessionConfig,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _calculate_max_questions(duration_minutes: int) -> int:
    """
    Derive number of questions from session duration.
    Rule: ~3 minutes per question (allows for reading + answering + transition).
    Min: 3 questions. Max: 20 questions.
    """
    count = max(3, min(20, duration_minutes // 3))
    return count


# ──────────────────────────────────────────────────────────────
# POST /api/session/start
# ──────────────────────────────────────────────────────────────

@router.post(
    "/start",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new interview session",
    description="Creates a new session in MongoDB and returns a session_id for all subsequent API calls.",
)
async def start_session(body: SessionCreate):
    """
    Create a new interview session.

    Request body: SessionCreate (contains SessionConfig)
    Returns: SessionResponse with session_id + config + status
    """
    db = get_db()
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    max_questions = _calculate_max_questions(body.config.duration_minutes)

    # Build the MongoDB document
    session_doc = {
        "_id": session_id,
        "config": body.config.model_dump(),
        "status": "active",
        "created_at": now,
        "ended_at": None,
        "question_count": 0,
        "max_questions": max_questions,
        "current_difficulty": body.config.difficulty.value,
        "user_id": body.user_id,  # None for anonymous sessions
    }

    try:
        await db["sessions"].insert_one(session_doc)
        logger.info(f"Session created: {session_id} ({body.config.domain.value}, {max_questions} questions)")
    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create session in database.",
        )

    return SessionResponse(
        session_id=session_id,
        config=body.config,
        created_at=now,
        status="active",
        max_questions=max_questions,
    )


# ──────────────────────────────────────────────────────────────
# GET /api/session/{session_id}
# ──────────────────────────────────────────────────────────────

@router.get(
    "/{session_id}",
    summary="Get session status",
    description="Returns the current session config, status, question count, and progress.",
)
async def get_session(session_id: str):
    """Retrieve session status and progress."""
    db = get_db()
    session = await db["sessions"].find_one({"_id": session_id})

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )

    return {
        "session_id": session["_id"],
        "status": session["status"],
        "domain": session["config"]["domain"],
        "experience": session["config"]["experience"],
        "difficulty": session["config"]["difficulty"],
        "question_count": session["question_count"],
        "max_questions": session["max_questions"],
        "current_difficulty": session.get("current_difficulty", session["config"]["difficulty"]),
        "created_at": session["created_at"],
        "ended_at": session.get("ended_at"),
    }


# ──────────────────────────────────────────────────────────────
# POST /api/session/{session_id}/end
# ──────────────────────────────────────────────────────────────

@router.post(
    "/{session_id}/end",
    summary="End an interview session",
    description="Marks the session as complete. Required before generating the final report.",
)
async def end_session(session_id: str):
    """Mark a session as complete."""
    db = get_db()
    now = datetime.now(timezone.utc)

    result = await db["sessions"].update_one(
        {"_id": session_id, "status": "active"},
        {"$set": {"status": "completed", "ended_at": now}},
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found or already ended.",
        )

    logger.info(f"Session ended: {session_id}")
    return {"session_id": session_id, "status": "completed", "ended_at": now}
