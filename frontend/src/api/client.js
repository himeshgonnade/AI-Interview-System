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
