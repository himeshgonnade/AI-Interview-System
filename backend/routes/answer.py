"""
routes/answer.py — Answer submission, AI evaluation + confidence analysis.

POST /api/answer/submit
  Accepts answer text (already transcribed if voice mode), evaluates with LLM,
  runs confidence analysis for voice answers, stores result, returns scores.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from db.mongo import get_db
from models.schemas import (
    AnswerSubmit, AnswerEvaluation, ConfidenceAnalysis,
    SessionConfig, InterviewDomain, ExperienceLevel, Difficulty, AnswerMode,
)
from services.answer_evaluator import evaluate_answer
from services.confidence_analyzer import analyze_confidence

logger = logging.getLogger(__name__)
router = APIRouter()


# ──────────────────────────────────────────────────────────────
# Response Model
# ──────────────────────────────────────────────────────────────

class AnswerSubmitResponse(BaseModel):
    answer_id: str
    session_id: str
    question_id: str
    evaluation: AnswerEvaluation
    confidence: Optional[ConfidenceAnalysis] = None  # only for voice mode


# ──────────────────────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────────────────────

def _session_to_config(session: dict) -> SessionConfig:
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


# ──────────────────────────────────────────────────────────────
# POST /api/answer/submit
# ──────────────────────────────────────────────────────────────

@router.post(
    "/submit",
    response_model=AnswerSubmitResponse,
    summary="Submit and evaluate an answer",
    description=(
        "Evaluates the candidate's answer with an LLM rubric. "
        "For voice-mode answers, also runs confidence analysis. "
        "Stores all results in MongoDB and returns scores + feedback."
    ),
)
async def submit_answer(body: AnswerSubmit):
    db = get_db()

    # ── Validate session ─────────────────────────────────────
    session = await db["sessions"].find_one({"_id": body.session_id})
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{body.session_id}' not found.")
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Session not active (status: {session['status']}).")

    # ── Validate question ────────────────────────────────────
    question_doc = await db["questions"].find_one({"_id": body.question_id})
    if not question_doc:
        raise HTTPException(status_code=404, detail=f"Question '{body.question_id}' not found.")

    # ── Idempotency: return cached result if already answered ─
    existing = await db["answers"].find_one({
        "session_id": body.session_id,
        "question_id": body.question_id,
    })
    if existing:
        eval_data = {k: existing[k] for k in AnswerEvaluation.model_fields if k in existing}
        conf = None
        if existing.get("confidence_score") is not None:
            conf_fields = {k: existing.get(k) for k in ConfidenceAnalysis.model_fields if k in existing}
            conf = ConfidenceAnalysis(**conf_fields)
        return AnswerSubmitResponse(
            answer_id=existing["_id"],
            session_id=body.session_id,
            question_id=body.question_id,
            evaluation=AnswerEvaluation(**eval_data),
            confidence=conf,
        )

    # ── Evaluate answer ───────────────────────────────────────
    config = _session_to_config(session)
    evaluation = await evaluate_answer(
        question=question_doc["text"],
        answer_text=body.answer_text,
        config=config,
    )

    # ── Confidence analysis for voice answers ─────────────────
    is_voice = (body.answer_mode == AnswerMode.VOICE)
    confidence: Optional[ConfidenceAnalysis] = None
    if is_voice and body.answer_text and body.answer_text.strip():
        try:
            confidence = await analyze_confidence(
                transcript=body.answer_text,
                duration_seconds=body.audio_duration_seconds,
            )
        except Exception as e:
            logger.warning(f"Confidence analysis failed (non-fatal): {e}")

    # ── Persist ───────────────────────────────────────────────
    answer_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    doc = {
        "_id": answer_id,
        "session_id": body.session_id,
        "question_id": body.question_id,
        "answer_text": body.answer_text,
        "answer_mode": body.answer_mode.value if body.answer_mode else "text",
        "audio_duration_seconds": body.audio_duration_seconds,
        # Answer evaluation (flat for easy report aggregation)
        "technical_score": evaluation.technical_score,
        "completeness_score": evaluation.completeness_score,
        "communication_score": evaluation.communication_score,
        "overall_score": evaluation.overall_score,
        "answer_quality": evaluation.answer_quality,
        "feedback": evaluation.feedback,
        "strengths": evaluation.strengths,
        "missed_points": evaluation.missed_points,
        "submitted_at": now,
    }

    # Add confidence fields if available
    if confidence:
        doc.update({
            "confidence_score": confidence.confidence_score,
            "speech_rate_wpm": confidence.speech_rate_wpm,
            "filler_word_count": confidence.filler_word_count,
            "filler_words_found": confidence.filler_words_found,
            "confidence_feedback": confidence.feedback,
        })

    await db["answers"].insert_one(doc)

    logger.info(
        f"Answer saved: q={body.question_id}, "
        f"quality={evaluation.answer_quality}, score={evaluation.overall_score}"
        + (f", confidence={confidence.confidence_score:.0f}" if confidence else "")
    )

    return AnswerSubmitResponse(
        answer_id=answer_id,
        session_id=body.session_id,
        question_id=body.question_id,
        evaluation=evaluation,
        confidence=confidence,
    )
