"""
whisper_service.py — Speech-to-Text via Groq's hosted Whisper API.

Uses Groq's `whisper-large-v3-turbo` model — fast, accurate, and free-tier available.
No local model weights required. Audio arrives as bytes from the frontend
MediaRecorder API (WebM/Opus format).
"""

import io
import logging
from groq import AsyncGroq
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Shared client (reuse across requests, same as llm_service pattern)
_groq_client: AsyncGroq | None = None


def _get_client() -> AsyncGroq:
    global _groq_client
    if _groq_client is None:
        _groq_client = AsyncGroq(api_key=settings.groq_api_key)
    return _groq_client


async def transcribe_audio(audio_bytes: bytes, filename: str = "recording.webm") -> str:
    """
    Transcribe audio bytes to text using Groq Whisper.

    Args:
        audio_bytes: Raw audio bytes. Browser MediaRecorder produces WebM/Opus.
        filename:    Filename hint used for MIME-type detection by the API.

    Returns:
        Transcribed text string (stripped of leading/trailing whitespace).

    Raises:
        RuntimeError: If the Groq API call fails after retries.
    """
    if not audio_bytes:
        raise ValueError("Empty audio received — nothing to transcribe.")

    client = _get_client()

    # Groq expects a file-like tuple: (filename, file_obj, content_type)
    audio_tuple = (filename, io.BytesIO(audio_bytes), "audio/webm")

    try:
        transcription = await client.audio.transcriptions.create(
            file=audio_tuple,
            model="whisper-large-v3-turbo",
            language="en",
            response_format="text",
        )

        # Groq returns a plain string when response_format="text"
        transcript = transcription if isinstance(transcription, str) else str(transcription)
        transcript = transcript.strip()

        logger.info(
            f"Whisper transcription complete: {len(audio_bytes):,} bytes → "
            f"{len(transcript)} chars"
        )
        return transcript

    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise RuntimeError(f"Transcription failed: {e}") from e
