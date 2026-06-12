"""
llm_service.py — Groq API wrapper for AI Interview Simulator.

Handles all LLM communication:
- Async chat completions via the Groq Python SDK
- Structured JSON response extraction with fallback
- Retry logic for transient API errors
"""

import json
import re
import asyncio
import logging
from typing import Optional
from groq import AsyncGroq, APIStatusError, APITimeoutError
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Singleton async client (reused across requests)
_groq_client: Optional[AsyncGroq] = None


def get_groq_client() -> AsyncGroq:
    """Return a cached AsyncGroq client."""
    global _groq_client
    if _groq_client is None:
        _groq_client = AsyncGroq(api_key=settings.groq_api_key)
    return _groq_client


async def chat_completion(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 1024,
    retries: int = 3,
) -> str:
    """
    Send a chat completion request to Groq and return the raw text response.

    Args:
        system_prompt: Sets the LLM's role/persona.
        user_prompt: The actual instruction / question prompt.
        temperature: 0.0 = deterministic, 1.0 = creative. Default 0.7 for variety.
        max_tokens: Response length cap.
        retries: Number of retry attempts on transient failures.

    Returns:
        Raw text content from the LLM.

    Raises:
        RuntimeError: If all retries fail.
    """
    client = get_groq_client()
    last_error: Optional[Exception] = None

    for attempt in range(1, retries + 1):
        try:
            response = await client.chat.completions.create(
                model=settings.groq_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            content = response.choices[0].message.content
            logger.debug(f"Groq response (attempt {attempt}): {content[:120]}...")
            return content

        except APITimeoutError as e:
            last_error = e
            logger.warning(f"Groq timeout on attempt {attempt}/{retries}")
            await asyncio.sleep(2 ** attempt)  # exponential back-off

        except APIStatusError as e:
            # 429 = rate limit → back off; others → re-raise immediately
            if e.status_code == 429:
                last_error = e
                wait = 2 ** attempt
                logger.warning(f"Groq rate-limited. Waiting {wait}s (attempt {attempt}/{retries})")
                await asyncio.sleep(wait)
            else:
                logger.error(f"Groq API error {e.status_code}: {e.message}")
                raise RuntimeError(f"Groq API error: {e.message}") from e

        except Exception as e:
            logger.error(f"Unexpected Groq error: {e}")
            raise RuntimeError(f"LLM request failed: {e}") from e

    raise RuntimeError(
        f"Groq API failed after {retries} attempts. Last error: {last_error}"
    )


async def chat_completion_json(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.5,
    max_tokens: int = 1024,
    retries: int = 3,
) -> dict:
    """
    Like chat_completion() but extracts and parses a JSON object from the response.

    The LLM is instructed to respond with JSON only. We extract the first
    JSON object found in the response (handles models that add preamble text).

    Returns:
        Parsed dict from the LLM JSON response.

    Raises:
        ValueError: If no valid JSON could be extracted.
        RuntimeError: If the API call itself fails.
    """
    # Append JSON enforcement instruction
    json_system = (
        system_prompt
        + "\n\nIMPORTANT: You MUST respond with valid JSON only. "
        "No preamble, no explanation, no markdown code fences — pure JSON."
    )

    raw = await chat_completion(
        system_prompt=json_system,
        user_prompt=user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        retries=retries,
    )

    return _extract_json(raw)


def _extract_json(text: str) -> dict:
    """
    Robustly extract the first JSON object from a string.
    Handles markdown fences (```json ... ```) and trailing text.
    """
    # 1. Strip markdown code fences if present
    text = re.sub(r"```(?:json)?\s*", "", text).strip()
    text = text.rstrip("`").strip()

    # 2. Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3. Find first {...} block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract JSON from LLM response: {text[:300]}")
