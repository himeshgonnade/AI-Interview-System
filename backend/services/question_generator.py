"""
question_generator.py — Adaptive LLM-powered question generation.

Generates contextual, non-repeating interview questions that adapt
in difficulty based on the candidate's prior answer quality.

Flow:
    1. First call  → generate_first_question()
    2. Subsequent  → generate_next_question() with last_answer_quality
    3. If follow-up needed → generate_followup_question()
"""

import logging
from typing import Optional

from models.schemas import SessionConfig, InterviewDomain, ExperienceLevel, Difficulty
from services.llm_service import chat_completion

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Domain Persona System Prompts
# ──────────────────────────────────────────────────────────────

DOMAIN_PERSONAS: dict[str, str] = {
    InterviewDomain.AIML: (
        "You are a Senior ML Engineer at a top AI research lab (think DeepMind, OpenAI). "
        "You interview candidates for machine learning and AI roles. "
        "Your questions cover: ML fundamentals, model architectures, training techniques, "
        "evaluation metrics, production ML, LLMs, and AI ethics."
    ),
    InterviewDomain.DATA_SCIENCE: (
        "You are a Lead Data Scientist with expertise in statistics, Python, SQL, and business analytics. "
        "You interview candidates for data science roles. "
        "Your questions cover: statistics, probability, EDA, feature engineering, model selection, "
        "A/B testing, SQL, data pipelines, and translating insights to business decisions."
    ),
    InterviewDomain.WEB_DEV: (
        "You are a Senior Full-Stack Engineer with 10+ years experience in React, Node.js, and system design. "
        "You interview candidates for web development roles. "
        "Your questions cover: HTML/CSS/JS fundamentals, React, REST APIs, databases, "
        "authentication, performance, security, and system design."
    ),
    InterviewDomain.ANDROID: (
        "You are a Senior Android Engineer with deep expertise in Kotlin, Jetpack Compose, and Android architecture. "
        "You interview candidates for Android development roles. "
        "Your questions cover: Kotlin, Android lifecycle, Jetpack components, Compose, "
        "MVVM/MVI, coroutines, performance, and Play Store deployment."
    ),
    InterviewDomain.DSA: (
        "You are a FAANG-style technical interviewer specializing in data structures and algorithms. "
        "You conduct DSA/coding interview rounds. "
        "Your questions cover: arrays, strings, trees, graphs, dynamic programming, "
        "sorting, searching, time/space complexity, and problem-solving approach."
    ),
    InterviewDomain.HR: (
        "You are an experienced HR Manager and culture-fit interviewer at a growing tech company. "
        "You conduct behavioral and HR interviews. "
        "Your questions cover: teamwork, conflict resolution, leadership, motivation, "
        "work style, career goals, strengths/weaknesses, and company culture fit. "
        "Use the STAR method framework in your expectations."
    ),
    InterviewDomain.CUSTOM: (
        "You are an expert interviewer for the specified domain. "
        "Adapt your questions to be highly relevant to the given field."
    ),
}

# ──────────────────────────────────────────────────────────────
# Difficulty Adaptation Rules
# ──────────────────────────────────────────────────────────────

DIFFICULTY_STEP_DOWN = {
    Difficulty.HARD: Difficulty.MEDIUM,
    Difficulty.MEDIUM: Difficulty.EASY,
    Difficulty.EASY: Difficulty.EASY,   # can't go lower
}

DIFFICULTY_STEP_UP = {
    Difficulty.EASY: Difficulty.MEDIUM,
    Difficulty.MEDIUM: Difficulty.HARD,
    Difficulty.HARD: Difficulty.HARD,   # can't go higher
}

DIFFICULTY_DESCRIPTIONS = {
    Difficulty.EASY: (
        "Ask a foundational, conceptual question. "
        "Suitable for someone still learning. Keep it clear and approachable."
    ),
    Difficulty.MEDIUM: (
        "Ask an intermediate question that requires practical understanding. "
        "The candidate should be able to apply concepts, not just define them."
    ),
    Difficulty.HARD: (
        "Ask an advanced question involving system design, edge cases, trade-offs, "
        "or architectural decisions. Expect depth and nuance in the answer."
    ),
}

EXPERIENCE_CONTEXT = {
    ExperienceLevel.FRESHER: (
        "The candidate is a fresher/student with no industry experience. "
        "Focus on fundamentals, academic projects, and theoretical understanding."
    ),
    ExperienceLevel.JUNIOR: (
        "The candidate has 1-2 years of experience. "
        "Focus on practical skills, real-world problems, and basic system design."
    ),
    ExperienceLevel.MID: (
        "The candidate has 3-5 years of experience. "
        "Expect solid technical depth, design decisions, and team collaboration."
    ),
    ExperienceLevel.SENIOR: (
        "The candidate is senior (5+ years). "
        "Expect leadership, architectural decisions, mentoring, and deep expertise."
    ),
}


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _get_persona(config: SessionConfig) -> str:
    """Return the domain persona, inserting custom domain name if needed."""
    persona = DOMAIN_PERSONAS.get(config.domain, DOMAIN_PERSONAS[InterviewDomain.CUSTOM])
    if config.domain == InterviewDomain.CUSTOM and config.custom_domain:
        persona = (
            f"You are an expert interviewer specializing in {config.custom_domain}. "
            f"Ask highly relevant, technical questions about {config.custom_domain}."
        )
    return persona


def _build_system_prompt(config: SessionConfig, current_difficulty: Difficulty) -> str:
    """Assemble the full system prompt for question generation."""
    persona = _get_persona(config)
    difficulty_desc = DIFFICULTY_DESCRIPTIONS[current_difficulty]
    experience_desc = EXPERIENCE_CONTEXT[config.experience]

    resume_context = ""
    if config.resume_text:
        resume_context = (
            f"\n\nCANDIDATE RESUME CONTEXT:\n{config.resume_text[:1500]}\n"
            "Reference specific projects, skills, or experience from the resume in your questions."
        )

    jd_context = ""
    if config.job_description:
        jd_context = (
            f"\n\nJOB DESCRIPTION:\n{config.job_description[:1000]}\n"
            "Align your questions with the skills and requirements listed in the job description."
        )

    return f"""{persona}

CANDIDATE PROFILE:
- Experience Level: {config.experience.value}
- {experience_desc}

CURRENT QUESTION DIFFICULTY: {current_difficulty.value}
- {difficulty_desc}
{resume_context}{jd_context}

STRICT RULES:
1. Ask EXACTLY ONE question — no preamble, no numbering, no "Question:", no explanation.
2. The question must be a single, clear sentence or short paragraph.
3. Do NOT ask the candidate to introduce themselves or state their name.
4. Do NOT repeat any topic already covered in the question history.
5. Match the difficulty level precisely — do not make it easier or harder than specified.
6. Output ONLY the question text. Nothing else."""


def _format_history(question_history: list[str]) -> str:
    """Format question history for the prompt."""
    if not question_history:
        return "No previous questions asked yet."
    history_lines = "\n".join(
        f"{i+1}. {q}" for i, q in enumerate(question_history)
    )
    return f"Questions already asked (DO NOT repeat these topics):\n{history_lines}"


# ──────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────

async def generate_first_question(config: SessionConfig) -> str:
    """
    Generate the opening question for an interview session.

    The first question is always at the configured difficulty level
    and serves as a warm-up that matches the candidate's domain + experience.

    Returns:
        The question text as a plain string.
    """
    system_prompt = _build_system_prompt(config, config.difficulty)

    user_prompt = (
        f"Generate the FIRST question for a {config.domain.value} interview. "
        f"This is an opening question — it should be engaging and set the tone. "
        f"Difficulty: {config.difficulty.value}. "
        "Output ONLY the question text."
    )

    question = await chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.75,
        max_tokens=256,
    )
    return question.strip()


async def generate_next_question(
    config: SessionConfig,
    question_history: list[str],
    last_answer_quality: Optional[str] = None,
    current_difficulty: Optional[Difficulty] = None,
) -> tuple[str, Difficulty]:
    """
    Generate the next question, adapting difficulty based on last answer quality.

    Adaptive logic:
        - "weak"    → step difficulty DOWN (simpler clarifying question)
        - "strong"  → step difficulty UP (harder, edge-case question)
        - "average" → maintain current difficulty (probe a related concept)
        - None      → use configured difficulty (first few questions)

    Args:
        config: The session configuration.
        question_history: List of all question texts asked so far.
        last_answer_quality: "weak" | "average" | "strong" | None
        current_difficulty: Current difficulty level (adapts from this).

    Returns:
        Tuple of (question_text, new_difficulty_level)
    """
    # Determine difficulty for this question
    if current_difficulty is None:
        current_difficulty = config.difficulty

    new_difficulty = current_difficulty
    if last_answer_quality == "weak":
        new_difficulty = DIFFICULTY_STEP_DOWN[current_difficulty]
    elif last_answer_quality == "strong":
        new_difficulty = DIFFICULTY_STEP_UP[current_difficulty]
    # "average" or None → keep same difficulty

    system_prompt = _build_system_prompt(config, new_difficulty)
    history_text = _format_history(question_history)

    adaptation_note = ""
    if last_answer_quality == "weak":
        adaptation_note = (
            "The candidate's last answer was weak/incomplete. "
            "Ask a simpler, more foundational question to help them build confidence. "
        )
    elif last_answer_quality == "strong":
        adaptation_note = (
            "The candidate's last answer was excellent. "
            "Escalate with a more challenging question — edge cases, trade-offs, or architecture. "
        )
    elif last_answer_quality == "average":
        adaptation_note = (
            "The candidate's last answer was average. "
            "Probe a related concept at the same difficulty level. "
        )

    user_prompt = (
        f"{history_text}\n\n"
        f"{adaptation_note}"
        f"Generate the NEXT interview question for {config.domain.value}. "
        f"Difficulty: {new_difficulty.value}. "
        "Output ONLY the question text — no preamble, no numbering."
    )

    question = await chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.75,
        max_tokens=256,
    )
    return question.strip(), new_difficulty


async def generate_followup_question(
    config: SessionConfig,
    question_history: list[str],
    parent_question: str,
    answer_text: str,
    answer_quality: str,
) -> tuple[str, Difficulty]:
    """
    Generate a targeted follow-up to a specific answer.

    Unlike generate_next_question (which moves to a new topic),
    this drills deeper into the same topic based on what the candidate said.

    Args:
        config: Session config.
        question_history: All prior questions.
        parent_question: The question being followed up on.
        answer_text: What the candidate actually said.
        answer_quality: "weak" | "average" | "strong"

    Returns:
        Tuple of (followup_question_text, difficulty_level)
    """
    difficulty = config.difficulty
    if answer_quality == "weak":
        difficulty = DIFFICULTY_STEP_DOWN[difficulty]
    elif answer_quality == "strong":
        difficulty = DIFFICULTY_STEP_UP[difficulty]

    system_prompt = _build_system_prompt(config, difficulty)

    user_prompt = (
        f"Original question: {parent_question}\n\n"
        f"Candidate's answer: {answer_text[:500]}\n\n"
        f"The answer was {answer_quality}. "
        "Generate ONE targeted follow-up question that either: "
        "(a) if weak: clarifies a misconception or asks to explain a key concept they missed, "
        "(b) if average: asks them to elaborate on one specific aspect, "
        "(c) if strong: pushes them to a harder edge case or deeper architectural implication. "
        "Output ONLY the follow-up question text."
    )

    question = await chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.65,
        max_tokens=256,
    )
    return question.strip(), difficulty
