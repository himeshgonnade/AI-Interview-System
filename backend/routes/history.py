"""
routes/history.py — Per-user interview history endpoints.

Returns a summary list of all sessions for a given user_id.
"""

import logging
from fastapi import APIRouter, HTTPException, status

from db.mongo import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/{user_id}",
    summary="Get interview history for a user",
    description="Returns all sessions (completed or active) linked to a user_id, "
                "with summary info: domain, date, question count, scores.",
)
async def get_user_history(user_id: str):
    """Retrieve all interviews taken by a specific user."""
    db = get_db()

    cursor = db["sessions"].find(
        {"user_id": user_id},
    ).sort("created_at", -1)  # newest first

    sessions = await cursor.to_list(length=100)

    result = []
    for s in sessions:
        session_id = s["_id"]

        # Fetch the report if it exists for score info
        report = await db["reports"].find_one({"session_id": session_id}, {"scores": 1})
        overall_score = None
        if report and "scores" in report:
            overall_score = report["scores"].get("overall")

        result.append({
            "session_id": session_id,
            "domain": s["config"].get("domain", ""),
            "experience": s["config"].get("experience", ""),
            "difficulty": s["config"].get("difficulty", ""),
            "duration_minutes": s["config"].get("duration_minutes", 0),
            "status": s.get("status", "active"),
            "question_count": s.get("question_count", 0),
            "max_questions": s.get("max_questions", 0),
            "created_at": s.get("created_at"),
            "ended_at": s.get("ended_at"),
            "overall_score": overall_score,
        })

    return {"user_id": user_id, "sessions": result, "total": len(result)}
