"""
answer_evaluator.py — LLM-powered answer evaluation service.

Evaluates candidate answers on three dimensions:
  - Technical Accuracy (0-10): Factual correctness and technical depth
  - Completeness (0-10):       Coverage of key concepts and sub-points
  - Communication (0-10):      Clarity, structure, articulation

Adaptive difficulty: answer_quality ("weak"/"average"/"strong") is returned
to the question router so the next question adapts accordingly.
"""

import logging
from models.schemas import SessionConfig, AnswerEvaluation
from services.llm_service import chat_completion_json

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# System prompt
# ──────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "You are an expert technical interviewer with 10+ years of experience. "
    "Your job is to evaluate a candidate's interview answer fairly, accurately, and constructively. "
    "Be calibrated to the candidate's stated experience level — a perfect answer from a fresher "
    "is different from a perfect answer from a senior engineer. "
    "You MUST respond with valid JSON only. No preamble, no explanation, no markdown fences."
)


# ──────────────────────────────────────────────────────────────
# Prompt builder
# ──────────────────────────────────────────────────────────────

def _build_eval_prompt(question: str, answer_text: str, config: SessionConfig) -> str:
    domain = config.domain.value
    experience = config.experience.value
    difficulty = config.difficulty.value

    resume_ctx = ""
    if config.resume_text:
        resume_ctx = (
            f"\nCANDIDATE RESUME (for context):\n"
            f"{config.resume_text[:600]}\n"
        )

    jd_ctx = ""
    if config.job_description:
        jd_ctx = (
            f"\nJOB DESCRIPTION (what the role requires):\n"
            f"{config.job_description[:400]}\n"
        )

    return f"""Evaluate the following interview answer.

INTERVIEW CONTEXT:
- Domain: {domain}
- Candidate Experience: {experience}
- Question Difficulty: {difficulty}
{resume_ctx}{jd_ctx}
QUESTION ASKED:
{question}

CANDIDATE'S ANSWER:
{answer_text}

EVALUATION CRITERIA (score each 0.0 – 10.0):
1. technical_score     — Factual correctness, depth of knowledge, accuracy of claims.
2. completeness_score  — Did the candidate cover the key points? What was missing?
3. communication_score — Clarity, logical structure, grammar, conciseness.

OVERALL SCORE:
  overall_score = (technical_score × 0.50) + (completeness_score × 0.30) + (communication_score × 0.20)
  Round to 1 decimal place.

QUALITY CLASSIFICATION:
  "weak"    → overall_score < 5.0
  "average" → 5.0 ≤ overall_score < 7.5
  "strong"  → overall_score ≥ 7.5

GUIDELINES:
- Calibrate for a {experience} candidate at {difficulty} difficulty.
- Strengths: 1–3 short, specific things done well (max 8 words each).
- Missed points: 0–3 important concepts or details that were omitted.
- Feedback: 2–3 constructive sentences. Be specific, not generic.
- If the answer is very short/vague, score accordingly.

Respond EXACTLY with this JSON (no extra keys, no markdown):
{{
  "technical_score": <float>,
  "completeness_score": <float>,
  "communication_score": <float>,
  "overall_score": <float>,
  "feedback": "<2-3 sentence constructive summary>",
  "strengths": ["<short phrase>", ...],
  "missed_points": ["<short phrase>", ...],
  "answer_quality": "weak" | "average" | "strong"
}}"""


# ──────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────

async def evaluate_answer(
    question: str,
    answer_text: str,
    config: SessionConfig,
) -> AnswerEvaluation:
    """
    Evaluate a candidate's answer using the LLM.

    Args:
        question:    The interview question text.
        answer_text: The candidate's answer (already transcribed if voice).
        config:      Session config (domain, experience, difficulty, etc.)

    Returns:
        AnswerEvaluation with scores, feedback, strengths, missed points, quality.
    """
    # Empty / whitespace-only answer → instant zero
    if not answer_text or not answer_text.strip():
        return AnswerEvaluation(
            technical_score=0.0,
            completeness_score=0.0,
            communication_score=0.0,
            overall_score=0.0,
            feedback="No answer was provided for this question.",
            missed_points=["A complete answer is required"],
            strengths=[],
            answer_quality="weak",
        )

    prompt = _build_eval_prompt(question, answer_text.strip(), config)

    try:
        raw = await chat_completion_json(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=prompt,
            temperature=0.25,   # Low temperature → consistent, reproducible scores
            max_tokens=600,
        )

        def _clamp(v, lo=0.0, hi=10.0) -> float:
            try:
                return round(max(lo, min(hi, float(v))), 1)
            except (TypeError, ValueError):
                return 5.0

        technical    = _clamp(raw.get("technical_score", 5.0))
        completeness = _clamp(raw.get("completeness_score", 5.0))
        communication = _clamp(raw.get("communication_score", 5.0))

        # Use LLM-computed overall if present, otherwise calculate
        raw_overall = raw.get("overall_score")
        overall = (
            _clamp(raw_overall)
            if raw_overall is not None
            else _clamp(technical * 0.5 + completeness * 0.3 + communication * 0.2)
        )

        quality = raw.get("answer_quality", "average")
        if quality not in ("weak", "average", "strong"):
            quality = "weak" if overall < 5.0 else ("strong" if overall >= 7.5 else "average")

        result = AnswerEvaluation(
            technical_score=technical,
            completeness_score=completeness,
            communication_score=communication,
            overall_score=overall,
            feedback=str(raw.get("feedback", "Answer recorded."))[:500],
            strengths=[str(s)[:60] for s in raw.get("strengths", [])[:3]],
            missed_points=[str(m)[:60] for m in raw.get("missed_points", [])[:3]],
            answer_quality=quality,
        )

        logger.info(
            f"Evaluation complete — overall={result.overall_score}, "
            f"quality={quality}, "
            f"technical={technical}, completeness={completeness}, communication={communication}"
        )
        return result

    except Exception as e:
        logger.error(f"Answer evaluation failed: {e}")
        # Graceful fallback — don't break the interview flow
        return AnswerEvaluation(
            technical_score=5.0,
            completeness_score=5.0,
            communication_score=5.0,
            overall_score=5.0,
            feedback=(
                "Your answer has been recorded. "
                "The AI evaluator encountered an issue — your answer quality is marked as average."
            ),
            missed_points=[],
            strengths=[],
            answer_quality="average",
        )
