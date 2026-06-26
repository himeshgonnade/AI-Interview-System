"""
confidence_analyzer.py — Text-based confidence analysis for interview answers.

Analyzes transcribed voice answers for confidence indicators:
  - Filler word frequency (umm, uh, like, basically…)
  - Speech rate (words per minute, if recording duration is available)
  - LLM-based holistic confidence score (0–100)

Called automatically from routes/answer.py when answer_mode == "voice".
"""

import re
import logging
from typing import Optional

from models.schemas import ConfidenceAnalysis
from services.llm_service import chat_completion_json

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Filler word dictionary (single words and common bigrams)
# ──────────────────────────────────────────────────────────────

_FILLER_UNIGRAMS = {
    "umm", "um", "uh", "uhh", "hmm", "hm", "er", "err",
    "like", "basically", "literally", "honestly", "actually",
    "obviously", "definitely", "totally", "right", "okay",
    "so", "well", "anyway", "whatever", "stuff", "things",
}

_FILLER_BIGRAMS = {
    "you know", "i mean", "you see", "kind of", "sort of",
    "i guess", "i think", "i feel", "more or less", "in a way",
}

_SYSTEM = (
    "You are an expert communication coach evaluating interview confidence. "
    "You MUST respond with valid JSON only. No preamble, no markdown."
)


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _detect_fillers(text: str) -> tuple[int, list[str]]:
    """Return (count, list_of_filler_instances) found in text."""
    lower = text.lower()
    # Strip punctuation for word matching
    clean = re.sub(r"[^\w\s]", " ", lower)
    words = clean.split()

    found: list[str] = []

    # Bigrams first
    for i in range(len(words) - 1):
        bigram = f"{words[i]} {words[i+1]}"
        if bigram in _FILLER_BIGRAMS:
            found.append(bigram)

    # Unigrams
    for word in words:
        if word in _FILLER_UNIGRAMS:
            found.append(word)

    return len(found), sorted(set(found))  # unique list for display


def _calc_wpm(text: str, duration_seconds: float) -> float:
    """Return words-per-minute for the transcript."""
    if not duration_seconds or duration_seconds <= 0:
        return 0.0
    word_count = len(text.split())
    return round((word_count / duration_seconds) * 60, 1)


def _build_confidence_prompt(
    transcript: str,
    filler_count: int,
    filler_words: list[str],
    wpm: float,
    duration_seconds: Optional[float],
) -> str:
    dur_note = f"Duration: {duration_seconds:.0f}s" if duration_seconds else "Duration: unknown"
    wpm_note = f"Speech rate: {wpm:.0f} WPM" if wpm > 0 else "Speech rate: not available"
    filler_note = (
        f"Filler words detected ({filler_count}): {', '.join(filler_words[:8]) or 'none'}"
        if filler_words else "No filler words detected"
    )

    return f"""Evaluate the speaking confidence of this interview answer transcript.

TRANSCRIPT:
{transcript[:800]}

METRICS:
- {filler_note}
- {wpm_note}
- {dur_note}

CONFIDENCE INDICATORS TO ASSESS:
1. Language certainty: assertive vs. hedging ("I know" vs "I think maybe")
2. Answer completeness: does it trail off or conclude strongly?
3. Vocabulary precision: clear technical terms vs. vague language
4. Sentence structure: complete, logical sentences vs. rambling
5. Filler word frequency (already detected above)

SCORING GUIDE (0–100):
- 85–100: Highly confident, assertive, clear structure, minimal fillers
- 65–84:  Mostly confident, minor hedging, occasional fillers
- 45–64:  Moderate confidence, some uncertainty/fillers, partially clear
- 25–44:  Low confidence, heavy hedging, many fillers, unclear
- 0–24:   Very low, incoherent or heavily filler-laden

Give a 1-sentence feedback on how to improve.

Respond with EXACTLY this JSON:
{{
  "confidence_score": <float 0-100>,
  "feedback": "<1 sentence actionable tip>"
}}"""


# ──────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────

async def analyze_confidence(
    transcript: str,
    duration_seconds: Optional[float] = None,
) -> ConfidenceAnalysis:
    """
    Analyze a voice answer transcript for confidence indicators.

    Args:
        transcript:        Whisper-transcribed text from the voice answer.
        duration_seconds:  Recording duration in seconds (for WPM calculation).

    Returns:
        ConfidenceAnalysis with confidence_score, filler stats, wpm, feedback.
    """
    if not transcript or not transcript.strip():
        return ConfidenceAnalysis(
            confidence_score=0.0,
            speech_rate_wpm=None,
            filler_word_count=0,
            filler_words_found=[],
            pause_count=0,
            feedback="No speech detected in the recording.",
        )

    filler_count, filler_words = _detect_fillers(transcript)
    wpm = _calc_wpm(transcript, duration_seconds) if duration_seconds else 0.0

    prompt = _build_confidence_prompt(
        transcript=transcript,
        filler_count=filler_count,
        filler_words=filler_words,
        wpm=wpm,
        duration_seconds=duration_seconds,
    )

    try:
        raw = await chat_completion_json(
            system_prompt=_SYSTEM,
            user_prompt=prompt,
            temperature=0.2,
            max_tokens=200,
        )

        score = max(0.0, min(100.0, float(raw.get("confidence_score", 60.0))))
        feedback = str(raw.get("feedback", "Focus on speaking with more certainty."))[:200]

    except Exception as e:
        logger.warning(f"Confidence LLM call failed, using heuristic: {e}")
        # Heuristic fallback: deduct from 80 based on filler ratio
        word_count = max(1, len(transcript.split()))
        filler_ratio = filler_count / word_count
        score = max(20.0, 80.0 - (filler_ratio * 200))
        feedback = "Reduce filler words and speak with more assertive language."

    logger.info(
        f"Confidence analysis — score={score:.1f}, "
        f"fillers={filler_count}, wpm={wpm:.0f}"
    )

    return ConfidenceAnalysis(
        confidence_score=round(score, 1),
        speech_rate_wpm=wpm if wpm > 0 else None,
        filler_word_count=filler_count,
        filler_words_found=filler_words[:6],  # show top 6 unique fillers
        pause_count=0,  # requires audio, not transcript
        feedback=feedback,
    )
