"""
report_generator.py — Aggregate session data and generate a comprehensive
                       performance report with LLM improvement plan.

Called by GET /api/report/{session_id} after the session ends.
Stores the report in MongoDB so repeat fetches are instant.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from db.mongo import get_db
from services.llm_service import chat_completion_json

logger = logging.getLogger(__name__)

_REPORT_SYSTEM = (
    "You are an expert career coach writing a post-interview performance report. "
    "Be specific, constructive, and encouraging. "
    "You MUST respond with valid JSON only. No preamble, no markdown."
)


# ──────────────────────────────────────────────────────────────
# Private helpers
# ──────────────────────────────────────────────────────────────

def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 1) if values else 0.0


async def _generate_improvement_plan(
    domain: str,
    experience: str,
    scores: dict,
    all_strengths: list[str],
    all_weaknesses: list[str],
    question_summaries: list[str],
) -> dict:
    """Call LLM to generate a personalised improvement plan."""

    q_text = "\n".join(f"- {q}" for q in question_summaries[:6]) or "No questions available."
    strengths_text = ", ".join(all_strengths[:6]) or "None identified."
    weaknesses_text = ", ".join(all_weaknesses[:6]) or "None identified."

    prompt = f"""Generate a personalised post-interview improvement report.

INTERVIEW CONTEXT:
- Domain: {domain}
- Experience Level: {experience}
- Technical Score: {scores['technical']}/10
- Communication Score: {scores['communication']}/10
- Overall Score: {scores['overall']}/10

QUESTIONS COVERED:
{q_text}

OBSERVED STRENGTHS: {strengths_text}
OBSERVED GAPS: {weaknesses_text}

Generate an improvement plan with:
1. top_strengths: 3 specific strengths demonstrated (short phrases, ≤8 words each)
2. top_weaknesses: 3 specific areas needing work (short phrases, ≤8 words each)
3. recommendations: 4 actionable, specific improvement steps (1 sentence each)
4. summary: 2-3 sentences of overall performance summary — encouraging but honest

Respond with EXACTLY this JSON:
{{
  "top_strengths": ["<strength>", "<strength>", "<strength>"],
  "top_weaknesses": ["<area>", "<area>", "<area>"],
  "recommendations": ["<step>", "<step>", "<step>", "<step>"],
  "summary": "<2-3 sentence summary>"
}}"""

    try:
        raw = await chat_completion_json(
            system_prompt=_REPORT_SYSTEM,
            user_prompt=prompt,
            temperature=0.4,
            max_tokens=600,
        )
        return {
            "strengths":        [str(s)[:80] for s in raw.get("top_strengths", [])[:4]],
            "weaknesses":       [str(w)[:80] for w in raw.get("top_weaknesses", [])[:4]],
            "recommendations":  [str(r)[:200] for r in raw.get("recommendations", [])[:5]],
            "summary":          str(raw.get("summary", ""))[:400],
        }
    except Exception as e:
        logger.error(f"Improvement plan generation failed: {e}")
        return {
            "strengths":       all_strengths[:3],
            "weaknesses":      all_weaknesses[:3],
            "recommendations": [
                "Practice explaining technical concepts out loud.",
                "Review fundamentals in your weakest topic areas.",
                "Do mock interviews regularly to build confidence.",
                "Study real-world examples and case studies in your domain.",
            ],
            "summary": (
                f"You completed the {domain} interview at {experience} level. "
                "Keep practising consistently to improve your scores."
            ),
        }


# ──────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────

async def generate_report(session_id: str) -> dict:
    """
    Build (or retrieve cached) the full performance report for a session.

    Returns a dict matching the FinalReport schema plus extra per-question data.
    Stores the result in the 'reports' collection to avoid re-generation.
    """
    db = get_db()

    # ── Return cached report if it exists ────────────────────
    cached = await db["reports"].find_one({"_id": session_id})
    if cached:
        cached.pop("_id", None)
        logger.info(f"Returning cached report for session {session_id}")
        return cached

    # ── Fetch session ────────────────────────────────────────
    session = await db["sessions"].find_one({"_id": session_id})
    if not session:
        raise ValueError(f"Session '{session_id}' not found.")

    cfg = session["config"]
    domain     = cfg.get("domain", "General")
    experience = cfg.get("experience", "Fresher")
    difficulty = cfg.get("difficulty", "Medium")

    # ── Fetch questions & answers ─────────────────────────────
    questions = await db["questions"].find(
        {"session_id": session_id}
    ).sort("question_number", 1).to_list(100)

    answers_list = await db["answers"].find(
        {"session_id": session_id}
    ).to_list(100)

    # Map question_id → answer doc
    answer_map = {a["question_id"]: a for a in answers_list}

    # ── Aggregate scores ─────────────────────────────────────
    # Fix: evaluation fields are nested in 'evaluation' subdoc when submitted
    def _get_eval_field(a, field):
        if a is None:
            return None
        # Try top level first (legacy), then nested evaluation dict
        val = a.get(field)
        if val is None and "evaluation" in a:
            val = a["evaluation"].get(field)
        return val

    tech_scores  = [_get_eval_field(a, "technical_score")    for a in answers_list if _get_eval_field(a, "technical_score") is not None]
    comp_scores  = [_get_eval_field(a, "completeness_score") for a in answers_list if _get_eval_field(a, "completeness_score") is not None]
    comm_scores  = [_get_eval_field(a, "communication_score") for a in answers_list if _get_eval_field(a, "communication_score") is not None]
    overall_list = [_get_eval_field(a, "overall_score")      for a in answers_list if _get_eval_field(a, "overall_score") is not None]
    conf_scores  = [a["confidence_score"]   for a in answers_list if a.get("confidence_score")]

    avg_tech    = _avg(tech_scores)
    avg_comp    = _avg(comp_scores)
    avg_comm    = _avg(comm_scores)
    avg_overall = _avg(overall_list)
    avg_conf_raw = _avg(conf_scores)          # 0-100 scale
    avg_conf_10  = round(avg_conf_raw / 10, 1)  # convert to 0-10 for display
    prob_solving = round(_avg(tech_scores) * 0.6 + _avg(comp_scores) * 0.4, 1)

    # Use fallback if no voice answers
    if not conf_scores:
        avg_conf_10 = round((avg_comm + avg_tech) / 2, 1)

    # ── Collect strengths / weaknesses across all answers ─────
    all_strengths  = []
    all_weaknesses = []
    for a in answers_list:
        eval_doc = a.get("evaluation", a)  # support both legacy flat and nested
        all_strengths.extend(eval_doc.get("strengths", []))
        all_weaknesses.extend(eval_doc.get("missed_points", []))

    # ── Per-question breakdown ────────────────────────────────
    per_question = []
    question_summaries = []
    for q in questions:
        a = answer_map.get(q["_id"])
        entry = {
            "question_number":    q["question_number"],
            "question":           q["text"],
            "difficulty":         q.get("difficulty", difficulty),
            "is_followup":        q.get("is_followup", False),
            "answer":             (a["answer_text"][:300] if a else "Skipped"),
            "overall_score":      _get_eval_field(a, "overall_score"),
            "technical_score":    _get_eval_field(a, "technical_score"),
            "completeness_score": _get_eval_field(a, "completeness_score"),
            "communication_score": _get_eval_field(a, "communication_score"),
            "confidence_score":   a.get("confidence_score") if a else None,
            "feedback":           _get_eval_field(a, "feedback") or "",
            "strengths":          _get_eval_field(a, "strengths") or [],
            "missed_points":      _get_eval_field(a, "missed_points") or [],
            "answer_quality":     _get_eval_field(a, "answer_quality") or "skipped",
            "answer_mode":        a.get("answer_mode", "text") if a else "text",
        }
        per_question.append(entry)
        question_summaries.append(q["text"][:80])

    # ── Duration ─────────────────────────────────────────────
    created_at = session.get("created_at")
    ended_at   = session.get("ended_at")
    duration_minutes = 0.0
    if created_at and ended_at:
        duration_minutes = round((ended_at - created_at).total_seconds() / 60, 1)

    # ── LLM Improvement Plan ──────────────────────────────────
    improvement_plan = await _generate_improvement_plan(
        domain=domain,
        experience=experience,
        scores={"technical": avg_tech, "communication": avg_comm, "overall": avg_overall},
        all_strengths=list(set(all_strengths))[:8],
        all_weaknesses=list(set(all_weaknesses))[:8],
        question_summaries=question_summaries,
    )

    # ── Emotion data (Module 9) ────────────────────────────────
    emotion_data = session.get("emotion_data", [])
    # Convert datetime objects to ISO strings for JSON serialization
    emotion_data_serializable = [
        {"timestamp": e["timestamp"].isoformat() if hasattr(e.get("timestamp"), "isoformat") else str(e.get("timestamp", "")), "emotion": e["emotion"]}
        for e in emotion_data
    ]

    # ── Assemble report ───────────────────────────────────────
    report = {
        "session_id":   session_id,
        "domain":       domain,
        "experience":   experience,
        "difficulty":   difficulty,
        "scores": {
            "technical_knowledge": avg_tech,
            "communication":       avg_comm,
            "confidence":          avg_conf_10,
            "problem_solving":     prob_solving,
            "overall":             avg_overall,
        },
        "improvement_plan":      improvement_plan,
        "total_questions":       session.get("max_questions", len(questions)),
        "answered_questions":    len(overall_list),
        "duration_minutes":      duration_minutes,
        "per_question_breakdown": per_question,
        "emotion_data":          emotion_data_serializable,
        "generated_at":          datetime.now(timezone.utc).isoformat(),
    }

    # ── Cache in MongoDB ──────────────────────────────────────
    try:
        await db["reports"].insert_one({"_id": session_id, **report})
    except Exception as e:
        logger.warning(f"Could not cache report: {e}")

    return report
