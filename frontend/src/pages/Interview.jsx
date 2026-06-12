import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, ChevronRight, StopCircle, Loader2,
  AlertCircle, CheckCircle2, BarChart2, RefreshCw,
  Zap, MessageSquare
} from 'lucide-react'
import { getNextQuestion, endSession } from '../api/client'

// ─── Difficulty Badge ─────────────────────────────────────

function DifficultyBadge({ difficulty }) {
  const styles = {
    Easy:   { color: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/30' },
    Medium: { color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30' },
    Hard:   { color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/30' },
  }
  const s = styles[difficulty] || styles.Medium
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.color}`}>
      <Zap size={10} />
      {difficulty}
    </span>
  )
}

// ─── Progress Bar ─────────────────────────────────────────

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gray-400 font-medium">Progress</span>
        <span className="text-xs text-gray-400">
          <span className="text-white font-semibold">{current}</span> / {total} questions
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #4f46e5, #059669)' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────

export default function Interview() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Session state
  const sessionId = searchParams.get('session') || sessionStorage.getItem('sessionId')
  const maxQuestions = parseInt(sessionStorage.getItem('maxQuestions') || '7', 10)
  const sessionConfig = (() => {
    try { return JSON.parse(sessionStorage.getItem('sessionConfig') || '{}') }
    catch { return {} }
  })()

  // Question state
  const [question, setQuestion] = useState(null)         // current question object
  const [questionHistory, setQuestionHistory] = useState([]) // {id, text, number}
  const [isLoading, setIsLoading] = useState(true)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState('')
  const [isEnding, setIsEnding] = useState(false)

  // ── Redirect guard ──────────────────────────────────────
  useEffect(() => {
    if (!sessionId) {
      navigate('/')
    }
  }, [sessionId, navigate])

  // ── Fetch first question on mount ───────────────────────
  const fetchNextQuestion = useCallback(async (lastAnswerQuality = null) => {
    if (!sessionId) return
    setIsLoading(true)
    setError('')
    try {
      const q = await getNextQuestion(sessionId, lastAnswerQuality)
      if (q.is_complete) {
        setIsComplete(true)
      } else {
        setQuestion(q)
        setQuestionHistory(prev => [...prev, { id: q.question_id, text: q.text, number: q.question_number }])
      }
    } catch (err) {
      setError(err.message || 'Failed to load question. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchNextQuestion()
  }, [fetchNextQuestion])

  // ── End session ─────────────────────────────────────────
  const handleEndInterview = async () => {
    setIsEnding(true)
    try {
      await endSession(sessionId)
      navigate(`/report/${sessionId}`)
    } catch (err) {
      // Even if end-session fails, navigate to report with what we have
      navigate(`/report/${sessionId}`)
    }
  }

  // ── "Next Question" (Module 3 will add answer submission) ─
  const handleNextQuestion = () => {
    // In Module 3, this will submit the answer first, then get next question.
    // For now: just fetch the next question (no answer quality provided).
    fetchNextQuestion(null)
  }

  // ── Completion screen ────────────────────────────────────
  if (isComplete) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full glass rounded-3xl p-10 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={36} className="text-white" />
          </div>
          <h2 className="font-display font-bold text-3xl mb-3">Interview Complete!</h2>
          <p className="text-gray-400 mb-2">
            You answered <span className="text-white font-semibold">{questionHistory.length}</span> questions.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Your detailed performance report is being generated...
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleEndInterview}
            disabled={isEnding}
            className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #059669 100%)' }}
          >
            {isEnding ? (
              <><Loader2 size={18} className="animate-spin" /> Generating Report...</>
            ) : (
              <><BarChart2 size={18} /> View Full Report</>
            )}
          </motion.button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header Bar */}
        <div className="glass rounded-2xl px-5 py-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Brain size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{sessionConfig.domain || 'Interview'}</p>
              <p className="text-sm font-semibold text-white">{sessionConfig.experience?.split(' ')[0] || ''} · {sessionConfig.difficulty || ''}</p>
            </div>
          </div>

          <button
            id="btn-end-interview"
            onClick={handleEndInterview}
            disabled={isEnding || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-400/20 hover:bg-red-400/10 transition-all duration-200 disabled:opacity-40"
          >
            <StopCircle size={13} />
            End Interview
          </button>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <ProgressBar
            current={question?.question_number || questionHistory.length}
            total={maxQuestions}
          />
        </div>

        {/* Question Card */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass rounded-3xl p-10 flex flex-col items-center justify-center min-h-[280px]"
            >
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center">
                  <Loader2 size={28} className="text-primary-400 animate-spin" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent-500 animate-pulse" />
              </div>
              <p className="text-white font-semibold text-lg mb-1">AI is thinking...</p>
              <p className="text-gray-500 text-sm">Generating your next question</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass rounded-3xl p-8 flex flex-col items-center text-center min-h-[280px] justify-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle size={24} className="text-red-400" />
              </div>
              <p className="text-white font-semibold mb-2">Oops! Something went wrong</p>
              <p className="text-gray-400 text-sm mb-6 max-w-sm">{error}</p>
              <button
                onClick={() => fetchNextQuestion()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-all"
              >
                <RefreshCw size={14} />
                Try Again
              </button>
            </motion.div>
          ) : question ? (
            <motion.div
              key={question.question_id}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div
                className="rounded-3xl p-8 mb-6 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(124,58,237,0.06) 100%)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}
              >
                {/* Decorative gradient orb */}
                <div
                  className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, #4f46e5 0%, transparent 70%)' }}
                />

                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
                      <MessageSquare size={15} className="text-primary-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Question {question.question_number}</p>
                      {question.is_followup && (
                        <span className="text-xs text-accent-400 font-medium">↳ Follow-up</span>
                      )}
                    </div>
                  </div>
                  <DifficultyBadge difficulty={question.difficulty} />
                </div>

                <p className="text-white text-xl font-medium leading-relaxed relative z-10">
                  {question.text}
                </p>

                <div className="mt-5 pt-5 border-t border-white/5 flex items-center justify-between">
                  <p className="text-xs text-gray-600">
                    {question.questions_remaining > 0
                      ? `${question.questions_remaining} question${question.questions_remaining !== 1 ? 's' : ''} remaining`
                      : 'Last question!'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse" />
                    <span className="text-xs text-gray-500">Live session</span>
                  </div>
                </div>
              </div>

              {/* Answer area placeholder — Module 3 will fill this in */}
              <div className="glass rounded-2xl p-6 border border-white/5 mb-6">
                <p className="text-xs text-gray-500 font-medium mb-3 flex items-center gap-1.5">
                  <MessageSquare size={12} />
                  Your Answer
                  <span className="ml-auto text-gray-600 italic">(Answer input coming in Module 3)</span>
                </p>
                <div className="h-24 rounded-xl bg-white/2 border border-white/5 flex items-center justify-center">
                  <p className="text-gray-600 text-sm">Text & Voice answer modes will appear here</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  id="btn-end-session"
                  onClick={handleEndInterview}
                  disabled={isEnding}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-40"
                >
                  <StopCircle size={15} />
                  {isEnding ? 'Ending...' : 'End & Report'}
                </button>

                <motion.button
                  id="btn-next-question"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNextQuestion}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    boxShadow: '0 0 20px rgba(99,102,241,0.3)',
                  }}
                >
                  {question.questions_remaining === 0 ? (
                    <><CheckCircle2 size={16} /> Finish Interview</>
                  ) : (
                    <>Next Question <ChevronRight size={16} /></>
                  )}
                </motion.button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Question history trail */}
        {questionHistory.length > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8"
          >
            <p className="text-xs text-gray-600 font-medium mb-3 flex items-center gap-1.5">
              <BarChart2 size={12} />
              Questions Asked
            </p>
            <div className="space-y-2">
              {questionHistory.slice(0, -1).map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/2 border border-white/5"
                >
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs text-gray-500 shrink-0 mt-0.5">
                    {q.number}
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">{q.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  )
}
