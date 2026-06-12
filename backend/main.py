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
        "mongodb_configured": bool(settings.mongodb_uri),
    }


# ─────────────────────────────────────────
# Routers (will be added module by module)
# ─────────────────────────────────────────

# from routes.session import router as session_router
# from routes.question import router as question_router
# from routes.answer import router as answer_router
# from routes.transcribe import router as transcribe_router
# from routes.confidence import router as confidence_router
# from routes.report import router as report_router
# from routes.resume import router as resume_router

# app.include_router(session_router, prefix="/api/session", tags=["Session"])
# app.include_router(question_router, prefix="/api/question", tags=["Questions"])
# app.include_router(answer_router, prefix="/api/answer", tags=["Answers"])
# app.include_router(transcribe_router, prefix="/api/transcribe", tags=["Transcription"])
# app.include_router(confidence_router, prefix="/api/confidence", tags=["Confidence"])
# app.include_router(report_router, prefix="/api/report", tags=["Reports"])
# app.include_router(resume_router, prefix="/api/resume", tags=["Resume"])
