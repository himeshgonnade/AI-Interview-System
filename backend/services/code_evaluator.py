import logging
from models.schemas import SessionConfig, AnswerEvaluation
from services.llm_service import chat_completion_json

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are an expert technical interviewer with 10+ years of experience. "
    "Your job is to evaluate a candidate's coding interview answer fairly, accurately, and constructively. "
    "Be calibrated to the candidate's stated experience level."
    "You MUST respond with valid JSON only. No preamble, no explanation, no markdown fences."
)

def _build_code_eval_prompt(question: str, code: str, language: str, config: SessionConfig) -> str:
    experience = config.experience.value
    difficulty = config.difficulty.value

    return f"""Evaluate the following code submission for a coding interview.

INTERVIEW CONTEXT:
- Candidate Experience: {experience}
- Question Difficulty: {difficulty}

QUESTION ASKED:
{question}

CANDIDATE'S CODE (Language: {language}):
{code}

EVALUATION CRITERIA (score each 0.0 – 10.0):
1. technical_score     — Logic correctness, handles edge cases, bug-free.
2. completeness_score  — Is the solution complete and optimal? (Time/Space Complexity).
3. communication_score — Code readability, naming conventions, structure, comments.

OVERALL SCORE:
  overall_score = (technical_score × 0.50) + (completeness_score × 0.30) + (communication_score × 0.20)
  Round to 1 decimal place.

QUALITY CLASSIFICATION:
  "weak"    → overall_score < 5.0
  "average" → 5.0 ≤ overall_score < 7.5
  "strong"  → overall_score ≥ 7.5

GUIDELINES:
- Calibrate for a {experience} candidate at {difficulty} difficulty.
- Strengths: 1–3 short things done well (e.g. "Good variable names", "Optimal O(N) time").
- Missed points: 0–3 issues (e.g. "Fails on empty array", "O(N^2) instead of O(N)").
- Feedback: 2–3 sentences. Mention the time/space complexity explicitly.

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

async def evaluate_code_answer(
    question: str,
    code: str,
    language: str,
    config: SessionConfig,
) -> AnswerEvaluation:
    if not code or not code.strip():
        return AnswerEvaluation(
            technical_score=0.0,
            completeness_score=0.0,
            communication_score=0.0,
            overall_score=0.0,
            feedback="No code was submitted for this question.",
            missed_points=["A solution is required"],
            strengths=[],
            answer_quality="weak",
        )

    prompt = _build_code_eval_prompt(question, code.strip(), language, config)

    try:
        raw = await chat_completion_json(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=prompt,
            temperature=0.1,
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
        raw_overall = raw.get("overall_score")
        overall = _clamp(raw_overall) if raw_overall is not None else _clamp(technical * 0.5 + completeness * 0.3 + communication * 0.2)

        quality = raw.get("answer_quality", "average")
        if quality not in ("weak", "average", "strong"):
            quality = "weak" if overall < 5.0 else ("strong" if overall >= 7.5 else "average")

        return AnswerEvaluation(
            technical_score=technical,
            completeness_score=completeness,
            communication_score=communication,
            overall_score=overall,
            feedback=str(raw.get("feedback", "Code reviewed."))[:500],
            strengths=[str(s)[:60] for s in raw.get("strengths", [])[:3]],
            missed_points=[str(m)[:60] for m in raw.get("missed_points", [])[:3]],
            answer_quality=quality,
        )
    except Exception as e:
        logger.error(f"Code evaluation failed: {e}")
        return AnswerEvaluation(
            technical_score=5.0,
            completeness_score=5.0,
            communication_score=5.0,
            overall_score=5.0,
            feedback="Your code has been submitted. The AI evaluator encountered an issue.",
            missed_points=[],
            strengths=[],
            answer_quality="average",
        )
