# 🤖 AI Interview System

An advanced, full-stack AI Interview Simulator that provides adaptive questioning, real-time voice transcription, emotion analysis, and detailed performance feedback. 

This platform acts as a realistic AI interviewer to help candidates practice for behavioral, technical, and domain-specific interviews.

## ✨ Features

- **📄 Resume Parsing**: Upload your PDF resume, and the AI will extract your experience and skills to tailor the interview questions specifically to your background.
- **🧠 Adaptive AI Interviewer**: Powered by Groq and Llama 3, the interviewer adapts its follow-up questions based on the quality and depth of your previous answers.
- **🎙️ Voice & Text Answers**: Answer questions by typing or speaking naturally. Voice answers are transcribed with high accuracy using OpenAI Whisper.
- **😊 Real-time Emotion Analysis**: Periodically analyzes webcam frames during the interview to provide feedback on your confidence and facial expressions using DeepFace.
- **💻 Code Evaluation**: Includes a built-in code editor for technical interviews, capable of evaluating code logic and syntax.
- **📊 Detailed Performance Reports**: After the interview, receive a comprehensive breakdown of your performance, including scoring, a personalized improvement plan, and feedback on every single answer.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React (Vite)
- **Styling**: Tailwind CSS
- **API Client**: Axios

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB (Motor async driver)
- **AI/ML**: 
  - LLM Generation: Groq API (`llama-3.3-70b-versatile`)
  - Transcription: `openai-whisper`
  - Emotion Analysis: `deepface` (TensorFlow/Keras)
  - Embeddings: `sentence-transformers`
  - PDF Parsing: `PyMuPDF` / `pdfplumber`

## 🚀 Live Demo

- **Frontend**: https://ai-interview-system-delta-red.vercel.app
- **Backend API**: https://ai-interview-system-backend-rsp6.onrender.com

## 💻 Local Development Setup

### Prerequisites
- Node.js (v18+)
- Python (3.10 or 3.11 recommended)
- MongoDB Cluster (Atlas or local)
- Groq API Key

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv .venv
source .venv/Scripts/activate  # On Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your MONGODB_URI, GROQ_API_KEY, and a secure SECRET_KEY

# Run the server
uvicorn main:app --reload
```
*The backend will be running at `http://localhost:8000`*

### 2. Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# The VITE_API_URL is already configured for local dev via Vite proxy!
# Just start the dev server
npm run dev
```
*The frontend will be running at `http://localhost:5173`*

## 🌐 Deployment Architecture

This application is decoupled and designed to be hosted seamlessly in the cloud:

1. **Frontend**: Hosted on **Vercel**. Configured with a `VITE_API_URL` pointing to the backend.
2. **Backend**: Hosted as a Web Service on **Render**. Requires `PYTHON_VERSION` set to `3.11.8`, and all environment variables loaded.
3. **Database**: Hosted on **MongoDB Atlas**.

## 📝 License

This project is open-source and available under the MIT License.
