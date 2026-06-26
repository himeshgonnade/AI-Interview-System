from fastapi import APIRouter, HTTPException, status
import logging
from datetime import datetime, timezone

from db.mongo import get_db
from models.schemas import CodeSubmit
from services.code_evaluator import evaluate_code_answer
from routes.question import _get_active_session, _session_to_config

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/evaluate")
async def evaluate_code(req: CodeSubmit):
    try:
        db = get_db()
        session = await _get_active_session(req.session_id, db)
        config = _session_to_config(session)
        
        # Verify question exists
        question = await db["questions"].find_one({
            "session_id": req.session_id,
            "question_id": req.question_id
        })
        if not question:
            raise HTTPException(404, "Question not found.")

        # Evaluate code using LLM
        evaluation = await evaluate_code_answer(
            question=question["text"],
            code=req.code,
            language=req.language,
            config=config
        )

        # Build answer doc
        answer_doc = {
            "session_id": req.session_id,
            "question_id": req.question_id,
            "answer_text": f"```{req.language}\n{req.code}\n```",
            "answer_mode": "code",
            "evaluation": evaluation.dict(),
            "submitted_at": datetime.now(timezone.utc)
        }

        await db["answers"].insert_one(answer_doc)
        
        return {
            "status": "success",
            "evaluation": evaluation
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in evaluate_code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to evaluate code submission."
        )
