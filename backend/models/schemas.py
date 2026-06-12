from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
from enum import Enum


# ─────────────────────────────────────────
# Enums
# ─────────────────────────────────────────

class InterviewDomain(str, Enum):
    AIML = "AIML"
    DATA_SCIENCE = "Data Science"
    WEB_DEV = "Web Development"
    ANDROID = "Android"
    HR = "HR Interview"
    DSA = "DSA"
    CUSTOM = "Custom"


class ExperienceLevel(str, Enum):
    FRESHER = "Fresher"
    JUNIOR = "Junior (1-2 years)"
    MID = "Mid (3-5 years)"
    SENIOR = "Senior (5+ years)"


class Difficulty(str, Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"


class AnswerMode(str, Enum):
    TEXT = "text"
    VOICE = "voice"


# ─────────────────────────────────────────
# Session Models
# ─────────────────────────────────────────

class SessionConfig(BaseModel):
    domain: InterviewDomain
    experience: ExperienceLevel
    difficulty: Difficulty
    duration_minutes: int = Field(default=20, ge=5, le=60)
    answer_mode: AnswerMode = AnswerMode.TEXT
    custom_domain: Optional[str] = None  # if domain == CUSTOM
    job_description: Optional[str] = None
    resume_text: Optional[str] = None    # extracted resume text


class SessionCreate(BaseModel):
    config: SessionConfig


class SessionResponse(BaseModel):
    session_id: str
    config: SessionConfig
    created_at: datetime
    status: str = "active"


# ─────────────────────────────────────────
# Question Models
# ─────────────────────────────────────────

class Question(BaseModel):
    question_id: str
    session_id: str
    text: str
    question_number: int
    is_followup: bool = False
    parent_question_id: Optional[str] = None
    domain: str
    difficulty: str


class QuestionResponse(BaseModel):
    question_id: str
    text: str
    question_number: int
    is_followup: bool = False
    total_questions: int


# ─────────────────────────────────────────
# Answer Models
# ─────────────────────────────────────────

class AnswerSubmit(BaseModel):
    session_id: str
    question_id: str
    answer_text: str
    answer_mode: AnswerMode = AnswerMode.TEXT
    audio_duration_seconds: Optional[float] = None


class AnswerEvaluation(BaseModel):
    technical_score: float = Field(ge=0, le=10)
    completeness_score: float = Field(ge=0, le=10)
    communication_score: float = Field(ge=0, le=10)
    overall_score: float = Field(ge=0, le=10)
    feedback: str
    missed_points: List[str] = []
    strengths: List[str] = []
    answer_quality: Literal["weak", "average", "strong"]


# ─────────────────────────────────────────
# Confidence / Audio Models
# ─────────────────────────────────────────

class ConfidenceAnalysis(BaseModel):
    confidence_score: float = Field(ge=0, le=100)
    speech_rate_wpm: Optional[float] = None
    filler_word_count: int = 0
    filler_words_found: List[str] = []
    pause_count: int = 0
    feedback: str


# ─────────────────────────────────────────
# Report Models
# ─────────────────────────────────────────

class ScoreBreakdown(BaseModel):
    technical_knowledge: float
    communication: float
    confidence: float
    problem_solving: float
    overall: float


class ImprovementPlan(BaseModel):
    strengths: List[str]
    weaknesses: List[str]
    recommendations: List[str]


class FinalReport(BaseModel):
    session_id: str
    scores: ScoreBreakdown
    improvement_plan: ImprovementPlan
    total_questions: int
    answered_questions: int
    duration_minutes: float
    generated_at: datetime
    per_question_breakdown: List[dict] = []
