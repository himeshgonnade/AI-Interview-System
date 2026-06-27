from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import get_settings
from db.mongo import connect_db, close_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_db()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title="AI Interview Simulator API",
    description="Backend API for the AI Interview Simulator — generates questions, evaluates answers, and produces detailed feedback reports.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "online",
        "app": "AI Interview Simulator API",
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.environment,
        "groq_configured": bool(settings.groq_api_key),
        "groq_model": settings.groq_model,
        "mongodb_configured": bool(settings.mongodb_uri),
    }


# ─────────────────────────────────────────
# Routers
# ─────────────────────────────────────────

# ✔ Module 2: Session + Question Generation
from routes.session import router as session_router
from routes.question import router as question_router

app.include_router(session_router, prefix="/api/session", tags=["Session"])
app.include_router(question_router, prefix="/api/question", tags=["Questions"])

# ✔ Module 3+4+5: Answer Submission, Whisper STT, AI Evaluation
from routes.answer import router as answer_router
from routes.transcribe import router as transcribe_router

app.include_router(answer_router, prefix="/api/answer", tags=["Answers"])
app.include_router(transcribe_router, prefix="/api/transcribe", tags=["Transcription"])

# ✔ Module 6+7+8: Confidence (via answer route), Report, Resume
from routes.report import router as report_router
from routes.resume import router as resume_router
from routes.emotion import router as emotion_router
from routes.code import router as code_router

app.include_router(report_router, prefix="/api/report", tags=["Reports"])
app.include_router(resume_router, prefix="/api/resume", tags=["Resume"])
app.include_router(emotion_router, prefix="/api/emotion", tags=["Emotion"])
app.include_router(code_router, prefix="/api/code", tags=["Code"])

# ✔ Auth + History
from routes.auth import router as auth_router
from routes.history import router as history_router

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(history_router, prefix="/api/history", tags=["History"])
