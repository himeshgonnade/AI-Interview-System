from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, timezone
import logging

from db.mongo import get_db
from models.schemas import EmotionRequest
from services.emotion_analyzer import analyze_emotion_from_base64

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/analyze")
async def analyze_emotion(req: EmotionRequest):
    try:
        db = get_db()
        
        # Verify session is active
        session = await db["sessions"].find_one({"_id": req.session_id})
        if not session or session.get("status") != "active":
            raise HTTPException(status_code=400, detail="Invalid or inactive session")

        # Analyze emotion
        detected_emotion = analyze_emotion_from_base64(req.image_base64)
        
        if not detected_emotion:
            return {"status": "skipped", "reason": "No emotion detected or empty image"}

        # Store in session document
        record = {
            "timestamp": datetime.now(timezone.utc),
            "emotion": detected_emotion
        }
        
        await db["sessions"].update_one(
            {"_id": req.session_id},
            {"$push": {"emotion_data": record}}
        )

        return {"status": "success", "emotion": detected_emotion}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in analyze_emotion: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze emotion."
        )
