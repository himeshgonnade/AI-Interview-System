/**
 * Centralized Axios API client.
 *
 * The base URL comes from:
 *   - Local dev:  Vite proxy forwards /api/* to localhost:8000 (no env var needed)
 *   - Production: VITE_API_URL env var set in Vercel dashboard
 *
 * ⚠️  Never put GROQ_API_KEY or MONGODB_URI here.
 *     All sensitive calls go through the FastAPI backend.
 */
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'   // ← Vite proxy handles this in local dev

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s — generous for LLM calls
})

// ── Request interceptor (add auth header if needed in future) ──
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
)

// ── Response interceptor — normalize errors ───────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred'
    return Promise.reject(new Error(message))
  }
)

export default api

// ═══════════════════════════════════════════════════════════
// Session API
// ═══════════════════════════════════════════════════════════

/**
 * Create a new interview session.
 * @param {Object} config - SessionConfig (domain, experience, difficulty, etc.)
 * @returns {Promise<{session_id, config, created_at, status, max_questions}>}
 */
export const startSession = async (config) => {
  const { data } = await api.post('/session/start', { config })
  return data
}

/**
 * Get current session status + progress.
 * @param {string} sessionId
 * @returns {Promise<{session_id, status, question_count, max_questions, ...}>}
 */
export const getSession = async (sessionId) => {
  const { data } = await api.get(`/session/${sessionId}`)
  return data
}

/**
 * End an active interview session.
 * @param {string} sessionId
 * @returns {Promise<{session_id, status, ended_at}>}
 */
export const endSession = async (sessionId) => {
  const { data } = await api.post(`/session/${sessionId}/end`)
  return data
}

// ═══════════════════════════════════════════════════════════
// Question API
// ═══════════════════════════════════════════════════════════

/**
 * Get the next interview question (adaptive difficulty).
 * @param {string} sessionId
 * @param {string|null} lastAnswerQuality - "weak" | "average" | "strong" | null
 * @returns {Promise<{question_id, text, question_number, difficulty, questions_remaining, is_complete}>}
 */
export const getNextQuestion = async (sessionId, lastAnswerQuality = null) => {
  const { data } = await api.post('/question/next', {
    session_id: sessionId,
    last_answer_quality: lastAnswerQuality,
  })
  return data
}

/**
 * Get a follow-up question drilling into the previous answer.
 * @param {string} sessionId
 * @param {string} parentQuestionId
 * @param {string} answerText
 * @param {string} answerQuality - "weak" | "average" | "strong"
 */
export const getFollowupQuestion = async (sessionId, parentQuestionId, answerText, answerQuality) => {
  const { data } = await api.post('/question/followup', {
    session_id: sessionId,
    parent_question_id: parentQuestionId,
    answer_text: answerText,
    answer_quality: answerQuality,
  })
  return data
}

/**
 * Get the full question history for a session.
 * @param {string} sessionId
 * @returns {Promise<{session_id, questions: Array, total: number}>}
 */
export const getQuestionHistory = async (sessionId) => {
  const { data } = await api.get(`/question/${sessionId}/history`)
  return data
}

// ═══════════════════════════════════════════════════════════
// Answer API  (Module 3+5)
// ═══════════════════════════════════════════════════════════

/**
 * Submit a candidate's answer and get AI evaluation.
 * @param {string} sessionId
 * @param {string} questionId
 * @param {string} answerText
 * @param {string} answerMode - "text" | "voice"
 * @param {number|null} audioDurationSeconds - optional, for voice mode
 * @returns {Promise<{answer_id, session_id, question_id, evaluation}>}
 */
export const submitAnswer = async (
  sessionId,
  questionId,
  answerText,
  answerMode = 'text',
  audioDurationSeconds = null
) => {
  const { data } = await api.post('/answer/submit', {
    session_id: sessionId,
    question_id: questionId,
    answer_text: answerText,
    answer_mode: answerMode,
    audio_duration_seconds: audioDurationSeconds,
  })
  return data
}

// ═══════════════════════════════════════════════════════════
// Transcription API  (Module 4)
// ═══════════════════════════════════════════════════════════

/**
 * Transcribe an audio Blob via Groq Whisper.
 * @param {Blob} audioBlob - WebM audio from browser MediaRecorder
 * @param {string} filename - hint for MIME type, default "recording.webm"
 * @returns {Promise<{transcript: string, char_count: number, word_count: number}>}
 */
export const transcribeAudio = async (audioBlob, filename = 'recording.webm') => {
  const formData = new FormData()
  formData.append('audio', audioBlob, filename)

  const { data } = await api.post('/transcribe/', formData, {
    // Must delete Content-Type so the browser can set it with the correct multipart boundary
    headers: { 'Content-Type': null },
    transformRequest: [(data, headers) => {
      delete headers['Content-Type']
      delete headers.common?.['Content-Type']
      return data
    }],
    timeout: 60000, // Whisper can take longer for large recordings
  })
  return data
}

// ═══════════════════════════════════════════════════════════
// Report API  (Module 7)
// ═══════════════════════════════════════════════════════════

/**
 * Fetch the full performance report for a completed session.
 * First call generates report (~3s); subsequent calls return cached result instantly.
 * @param {string} sessionId
 * @returns {Promise<{scores, improvement_plan, per_question_breakdown, ...}>}
 */
export const getReport = async (sessionId) => {
  const { data } = await api.get(`/report/${sessionId}`, { timeout: 45000 })
  return data
}

// ═══════════════════════════════════════════════════════════
// Resume API  (Module 8)
// ═══════════════════════════════════════════════════════════

/**
 * Upload a PDF resume and get extracted plain text back.
 * @param {File} pdfFile - The PDF File object from a file input
 * @returns {Promise<{text: string, char_count: number, was_truncated: boolean, filename: string}>}
 */
export const parseResume = async (pdfFile) => {
  const formData = new FormData()
  formData.append('resume', pdfFile, pdfFile.name)

  const { data } = await api.post('/resume/parse', formData, {
    // Must delete Content-Type so the browser sets it with the correct multipart boundary
    headers: { 'Content-Type': null },
    transformRequest: [(data, headers) => {
      delete headers['Content-Type']
      delete headers.common?.['Content-Type']
      return data
    }],
    timeout: 30000,
  })
  return data
}

// ═══════════════════════════════════════════════════════════
// Emotion API  (Module 9)
// ═══════════════════════════════════════════════════════════

/**
 * Send a webcam frame (base64) to the backend for emotion analysis.
 * Called silently every ~10s during the interview.
 * @param {string} sessionId
 * @param {string} imageBase64 - base64 encoded JPEG from webcam
 * @returns {Promise<{status: string, emotion?: string}>}
 */
export const analyzeEmotion = async (sessionId, imageBase64) => {
  const { data } = await api.post('/emotion/analyze', {
    session_id: sessionId,
    image_base64: imageBase64,
  }, { timeout: 10000 })
  return data
}


// ═══════════════════════════════════════════════════════════
// Code Evaluation API  (Module 10)
// ═══════════════════════════════════════════════════════════

/**
 * Submit code for LLM-based evaluation.
 * @param {string} sessionId
 * @param {string} questionId
 * @param {string} code - user's code
 * @param {string} language - e.g. "python", "javascript", "java"
 * @returns {Promise<{status: string, evaluation: Object}>}
 */
export const evaluateCode = async (sessionId, questionId, code, language) => {
  const { data } = await api.post('/code/evaluate', {
    session_id: sessionId,
    question_id: questionId,
    code,
    language,
  }, { timeout: 45000 })
  return data
}
