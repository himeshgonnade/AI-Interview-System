========================================================================
                      AI INTERVIEW SIMULATOR
========================================================================

An advanced, end-to-end AI-powered interview simulator designed to help
candidates practice and improve their interview skills through dynamic 
questioning, speech evaluation, and audio confidence metrics.

------------------------------------------------------------------------
1. WHAT IT IS
------------------------------------------------------------------------
The AI Interview Simulator is a web application that provides a realistic
interviewing experience. Candidates can choose their target role, company,
experience level, and difficulty. The platform generates personalized 
questions (leveraging their uploaded resume), records verbal answers, 
transcribes speech, analyzes vocal confidence, and generates detailed 
reports with actionable feedback and scoring.

------------------------------------------------------------------------
2. KEY FEATURES
------------------------------------------------------------------------
* Resume Parsing: Extracts text and key skills from uploaded PDF resumes 
  using PyMuPDF (fitz) and pdfplumber.
* Dynamic Question Generation: Formulates relevant technical, behavioral, 
  and resume-specific questions using LLMs (via Groq API).
* Voice Transcription: Uses OpenAI's Whisper model to transcribe audio 
  answers into written text in real-time.
* Confidence & Audio Analysis: Employs Librosa, NumPy, and Soundfile to 
  analyze audio features:
  - Speech rate (words per minute)
  - Pauses/silences (hesitations)
  - Volume/energy consistency
* Detailed AI Evaluation: Scores each answer based on accuracy, relevance, 
  and depth using Llama/Groq models.
* Comprehensive Feedback Reports: Provides an overall score, component 
  breakdowns (e.g., communication, technical skill), lists of strengths 
  and areas of improvement, and detailed feedback for each question.
* Sleek UI: Interactive, animated interface built with React, Framer Motion, 
  and Tailwind CSS.

------------------------------------------------------------------------
3. PROJECT STRUCTURE & ARCHITECTURE
------------------------------------------------------------------------
The project is split into a frontend client and a backend API:

AI-Interview-System/
├── backend/
│   ├── db/                 # MongoDB connection logic (Motor/PyMongo)
│   ├── models/             # Pydantic schemas and database models
│   ├── routes/             # FastAPI router endpoints:
│   │   ├── session.py      # Session creation and settings
│   │   ├── resume.py       # Resume parsing & upload
│   │   ├── question.py     # Question fetching and generation
│   │   ├── transcribe.py   # Whisper speech-to-text transcription
│   │   ├── answer.py       # Answer submission and evaluation
│   │   └── report.py       # Final report generation and retrieval
│   ├── services/           # Core AI & processing engines:
│   │   ├── llm_service.py         # Handles Groq LLM completions
│   │   ├── resume_parser.py       # Extracts content from PDFs
│   │   ├── question_generator.py  # Generates contextual questions
│   │   ├── whisper_service.py     # Local or API-based Whisper STT
│   │   ├── answer_evaluator.py    # Scores and critiques responses
│   │   ├── confidence_analyzer.py # Extracts audio properties/metrics
│   │   └── report_generator.py    # Aggregates overall performance
│   ├── config.py           # Configuration and environment settings
│   ├── main.py             # FastAPI main application entrypoint
│   └── requirements.txt    # Backend Python dependencies
│
└── frontend/
    ├── public/             # Static public assets
    ├── src/
    │   ├── api/            # Axios API clients
    │   ├── components/     # Shared UI components (Navbar, ResumeUpload)
    │   ├── pages/          # Application views:
    │   │   ├── Home.jsx       # Landing page / setup configuration
    │   │   ├── Interview.jsx  # Active session with recorder
    │   │   └── Report.jsx     # Final scorecard and evaluation detail
    │   ├── App.jsx         # Layout and routing configuration
    │   └── main.jsx        # React application entrypoint
    ├── package.json        # Frontend NPM configurations and scripts
    └── vite.config.js      # Vite compilation configuration

------------------------------------------------------------------------
4. TECH STACK USED
------------------------------------------------------------------------
BACKEND:
* Framework: FastAPI (Asynchronous Python web framework)
* Database: MongoDB (via Motor async driver)
* LLM Provider: Groq API (running Llama models)
* Speech-to-Text: OpenAI Whisper
* Audio Processing: Librosa, Soundfile, NumPy
* Document Parsing: PyMuPDF, pdfplumber

FRONTEND:
* Core: React (Vite bundler)
* Styling: Tailwind CSS
* Animations: Framer Motion
* Icons: Lucide React
* Routing: React Router
* HTTP Client: Axios

------------------------------------------------------------------------
5. HOW IT WORKS (END-TO-END FLOW)
------------------------------------------------------------------------
1. Setup: The user enters the role, company, difficulty, number of questions,
   and optionally uploads their resume.
2. Initialization: The backend parses the resume, matches it with the 
   interview target parameters, and creates a session in MongoDB.
3. Question Loop: 
   - A question is generated based on the session context.
   - The user reads the question and records their answer verbally.
   - The audio file is recorded via the browser MediaRecorder API and sent 
     to the `/api/transcribe` endpoint.
   - The audio is transcribed to text.
   - The text transcription and raw audio file are evaluated:
     - The LLM evaluates response accuracy and relevance.
     - Librosa/NumPy evaluates speech rhythm, pauses, and tone.
   - Results are saved, and the next question is generated.
4. Completion: Once all questions are answered, the backend consolidates
   scores, strengths, and weaknesses to generate a permanent Report.
5. Report Viewer: The candidate gets redirected to a beautifully styled 
   report page showing detailed performance charts and personalized advice.

------------------------------------------------------------------------
6. HOW TO GET STARTED
------------------------------------------------------------------------

PREREQUISITES:
* Python 3.10+
* Node.js v18+
* MongoDB database instance running locally or on Atlas.
* Groq API Key (for LLM services)

BACKEND SETUP:
1. Navigate to the backend directory:
   cd backend
2. Create and activate a virtual environment:
   python -m venv .venv
   .venv\Scripts\activate      # On Windows
   source .venv/bin/activate    # On Unix/macOS
3. Install dependencies:
   pip install -r requirements.txt
4. Configure variables:
   Copy `.env.example` to `.env` and fill in:
   - `GROQ_API_KEY`
   - `MONGODB_URI`
5. Run the FastAPI server:
   uvicorn main:app --reload
   The API will be available at: http://localhost:8000
   Interactive API docs: http://localhost:8000/docs

FRONTEND SETUP:
1. Navigate to the frontend directory:
   cd ../frontend
2. Install dependencies:
   npm install
3. Configure variables:
   Copy `.env.example` to `.env` and configure:
   - `VITE_API_URL=http://localhost:8000`
4. Start the development server:
   npm run dev
   The application will be accessible at: http://localhost:5173
========================================================================
