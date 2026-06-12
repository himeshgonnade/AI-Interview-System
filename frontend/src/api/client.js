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
