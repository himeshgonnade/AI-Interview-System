"""
routes/question.py — Question generation endpoints.

Generates the next interview question using the LLM, stores it in MongoDB,
and returns it to the frontend. Handles adaptive difficulty automatically.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from db.mongo import get_db
from models.schemas import Difficulty, SessionConfig, InterviewDomain, ExperienceLevel, AnswerMode
from services.question_generator import (
    generate_first_question,
    generate_next_question,
    generate_followup_question,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ──────────────────────────────────────────────────────────────
# Request / Response Models (local to this route)
# ──────────────────────────────────────────────────────────────

class NextQuestionRequest(BaseModel):
    session_id: str
    last_answer_quality: Optional[str] = None  # "weak" | "average" | "strong"


class FollowupRequest(BaseModel):
    session_id: str
    parent_question_id: str
    answer_text: str
    answer_quality: str  # "weak" | "average" | "strong"


class QuestionOut(BaseModel):
    question_id: str
    session_id: str
    text: str
    question_number: int
    is_followup: bool
    difficulty: str
    questions_remaining: int
    is_complete: bool   # True when session has reached max questions


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

async def _get_active_session(session_id: str, db) -> dict:
    """Fetch an active session or raise 404."""
    session = await db["sessions"].find_one({"_id": session_id})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )
    if session["status"] != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session '{session_id}' is not active (status: {session['status']}).",
        )
    return session


def _session_to_config(session: dict) -> SessionConfig:
    """Reconstruct a SessionConfig from a MongoDB session document."""
    cfg = session["config"]
    return SessionConfig(
        domain=InterviewDomain(cfg["domain"]),
        experience=ExperienceLevel(cfg["experience"]),
        difficulty=Difficulty(cfg["difficulty"]),
        duration_minutes=cfg.get("duration_minutes", 20),
        answer_mode=AnswerMode(cfg.get("answer_mode", "text")),
        custom_domain=cfg.get("custom_domain"),
        job_description=cfg.get("job_description"),
        resume_text=cfg.get("resume_text"),
    )


async def _get_question_history(session_id: str, db) -> list[str]:
    """Return the text of all questions asked in this session, in order."""
    cursor = db["questions"].find(
        {"session_id": session_id},
        {"text": 1, "_id": 0},
    ).sort("question_number", 1)
    docs = await cursor.to_list(length=100)
    return [d["text"] for d in docs]


async def _save_question(
    db,
    session_id: str,
    question_text: str,
    question_number: int,
    difficulty: Difficulty,
    domain: str,
    is_followup: bool = False,
    parent_question_id: Optional[str] = None,
) -> str:
    """Persist a question to MongoDB and return its ID."""
    question_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    await db["questions"].insert_one({
        "_id": question_id,
        "session_id": session_id,
        "text": question_text,
        "question_number": question_number,
        "is_followup": is_followup,
        "parent_question_id": parent_question_id,
        "domain": domain,
        "difficulty": difficulty.value,
        "created_at": now,
    })
    return question_id


# ──────────────────────────────────────────────────────────────
# POST /api/question/next
# ──────────────────────────────────────────────────────────────

@router.post(
    "/next",
    response_model=QuestionOut,
    summary="Get the next interview question",
    description=(
        "Generates the next question using the LLM. "
        "Adapts difficulty based on last_answer_quality (weak/average/strong). "
        "Returns is_complete=true when the session has reached its question quota."
    ),
)
async def get_next_question(body: NextQuestionRequest):
    """
    Generate and return the next interview question for a session.

    - First call (question_count == 0): generates the opening question.
    - Subsequent calls: generates adaptive next question.
    - When question_count >= max_questions: returns is_complete=True (no new question).
    """
    db = get_db()
    session = await _get_active_session(body.session_id, db)
    config = _session_to_config(session)

    question_count = session["question_count"]
    max_questions = session["max_questions"]

    # Check if session is already complete
    if question_count >= max_questions:
        return QuestionOut(
            question_id="",
            session_id=body.session_id,
            text="",
            question_number=question_count,
            is_followup=False,
            difficulty=session.get("current_difficulty", config.difficulty.value),
            questions_remaining=0,
            is_complete=True,
            is_coding=(config.domain.value == "DSA"),
        )

    # Retrieve current difficulty (may have adapted from previous questions)
    current_difficulty_str = session.get("current_difficulty", config.difficulty.value)
    current_difficulty = Difficulty(current_difficulty_str)

    # Generate the question
    question_history = await _get_question_history(body.session_id, db)

    if question_count == 0:
        # First question
        question_text = await generate_first_question(config)
        new_difficulty = current_difficulty
    else:
        # Adaptive next question
        question_text, new_difficulty = await generate_next_question(
            config=config,
            question_history=question_history,
            last_answer_quality=body.last_answer_quality,
            current_difficulty=current_difficulty,
        )

    new_question_number = question_count + 1

    # Persist to MongoDB
    question_id = await _save_question(
        db=db,
        session_id=body.session_id,
        question_text=question_text,
        question_number=new_question_number,
        difficulty=new_difficulty,
        domain=config.domain.value,
        is_followup=False,
    )

    # Update session counters + current difficulty
    await db["sessions"].update_one(
        {"_id": body.session_id},
        {
            "$set": {
                "question_count": new_question_number,
                "current_difficulty": new_difficulty.value,
            }
        },
    )

    questions_remaining = max(0, max_questions - new_question_number)
    # IMPORTANT: is_complete must be False here — a question was just generated
    # and the user still needs to answer it. The guard at the top of this function
    # (question_count >= max_questions) is the ONLY place that returns is_complete=True.
    # Previously this was: is_complete = new_question_number >= max_questions
    # which caused the frontend to discard the last question without displaying it.
    is_complete = False

    logger.info(
        f"Question {new_question_number}/{max_questions} generated for session {body.session_id} "
        f"(difficulty: {new_difficulty.value})"
    )

    return QuestionOut(
        question_id=question_id,
        session_id=body.session_id,
        text=question_text,
        question_number=new_question_number,
        is_followup=False,
        difficulty=new_difficulty.value,
        questions_remaining=questions_remaining,
        is_complete=is_complete,
        is_coding=(config.domain.value == "DSA"),
    )


# ──────────────────────────────────────────────────────────────
# POST /api/question/followup
# ──────────────────────────────────────────────────────────────

@router.post(
    "/followup",
    response_model=QuestionOut,
    summary="Generate a follow-up question",
    description=(
        "Generates a targeted follow-up to the previous question based on the candidate's answer. "
        "Follow-ups count toward the session's total question quota."
    ),
)
async def get_followup_question(body: FollowupRequest):
    """Generate a follow-up question drilling deeper into the previous answer."""
    db = get_db()
    session = await _get_active_session(body.session_id, db)
    config = _session_to_config(session)

    question_count = session["question_count"]
    max_questions = session["max_questions"]

    if question_count >= max_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has reached its maximum question count.",
        )

    # Get parent question text
    parent_doc = await db["questions"].find_one({"_id": body.parent_question_id})
    if not parent_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parent question '{body.parent_question_id}' not found.",
        )

    question_history = await _get_question_history(body.session_id, db)

    question_text, new_difficulty = await generate_followup_question(
        config=config,
        question_history=question_history,
        parent_question=parent_doc["text"],
        answer_text=body.answer_text,
        answer_quality=body.answer_quality,
    )

    new_question_number = question_count + 1

    question_id = await _save_question(
        db=db,
        session_id=body.session_id,
        question_text=question_text,
        question_number=new_question_number,
        difficulty=new_difficulty,
        domain=config.domain.value,
        is_followup=True,
        parent_question_id=body.parent_question_id,
    )

    await db["sessions"].update_one(
        {"_id": body.session_id},
        {
            "$set": {
                "question_count": new_question_number,
                "current_difficulty": new_difficulty.value,
            }
        },
    )

    questions_remaining = max(0, max_questions - new_question_number)
    is_complete = new_question_number >= max_questions

    return QuestionOut(
        question_id=question_id,
        session_id=body.session_id,
        text=question_text,
        question_number=new_question_number,
        is_followup=True,
        difficulty=new_difficulty.value,
        questions_remaining=questions_remaining,
        is_complete=is_complete,
        is_coding=(config.domain.value == "DSA"),
    )


# ──────────────────────────────────────────────────────────────
# GET /api/question/{session_id}/history
# ──────────────────────────────────────────────────────────────

@router.get(
    "/{session_id}/history",
    summary="Get all questions for a session",
    description="Returns all questions asked in the session, in order.",
)
async def get_question_history(session_id: str):
    """Return the full question history for a session."""
    db = get_db()

    # Verify session exists
    session = await db["sessions"].find_one({"_id": session_id}, {"_id": 1})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )

    cursor = db["questions"].find(
        {"session_id": session_id}
    ).sort("question_number", 1)
    questions = await cursor.to_list(length=100)

    # Convert ObjectId / _id to string
    result = []
    for q in questions:
        result.append({
            "question_id": q["_id"],
            "text": q["text"],
            "question_number": q["question_number"],
            "is_followup": q.get("is_followup", False),
            "difficulty": q["difficulty"],
            "domain": q["domain"],
            "created_at": q["created_at"],
        })

    return {"session_id": session_id, "questions": result, "total": len(result)}
