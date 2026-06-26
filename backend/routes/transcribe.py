"""
routes/transcribe.py — Audio-to-text transcription endpoint.

POST /api/transcribe/
  Receives a WebM audio blob from the browser MediaRecorder API,
  sends it to Groq Whisper, and returns the transcript text.

The frontend uses this in voice mode:
  MediaRecorder → audio Blob → FormData → POST here → transcript text
  → user reviews/edits → submits via /api/answer/submit
"""

import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, status

from services.whisper_service import transcribe_audio

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/",
    summary="Transcribe audio to text (Whisper)",
    description=(
        "Accepts a WebM/MP4/WAV audio file upload (from browser MediaRecorder) "
        "and returns the transcript via Groq Whisper-large-v3-turbo."
    ),
)
async def transcribe(audio: UploadFile = File(..., description="Audio file to transcribe")):
    """
    Transcribe uploaded audio to text.

    Accepts any audio format that Groq Whisper supports:
    WebM (default from Chrome/Firefox MediaRecorder), MP4, WAV, M4A, OGG.
    """
    try:
        audio_bytes = await audio.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded audio: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read the uploaded audio file.",
        )

    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty audio file received. Please record at least a few seconds.",
        )

    filename = audio.filename or "recording.webm"

    try:
        transcript = await transcribe_audio(audio_bytes, filename=filename)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Transcription endpoint error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transcription service unavailable. Please try again.",
        )

    return {
        "transcript": transcript,
        "char_count": len(transcript),
        "word_count": len(transcript.split()) if transcript else 0,
    }
