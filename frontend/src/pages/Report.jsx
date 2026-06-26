import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, BarChart2, CheckCircle2, AlertTriangle, Zap,
  TrendingUp, Star, ChevronDown, ChevronUp, Loader2,
  AlertCircle, Home, Download, RefreshCw, Clock,
  Target, MessageSquare, Mic, Award, Sparkles, Code2, Smile
} from 'lucide-react'
import { getReport } from '../api/client'

// ─── Utility ──────────────────────────────────────────────
const clamp = (v) => Math.max(0, Math.min(10, v || 0))

function gradeFromScore(score) {
  if (score >= 9)  return { grade: 'A+', label: 'Exceptional',    color: '#10b981' }
  if (score >= 8)  return { grade: 'A',  label: 'Excellent',      color: '#10b981' }
  if (score >= 7)  return { grade: 'B',  label: 'Good',           color: '#3b82f6' }
  if (score >= 6)  return { grade: 'C',  label: 'Average',        color: '#f59e0b' }
  if (score >= 5)  return { grade: 'D',  label: 'Below Average',  color: '#f97316' }
  return           { grade: 'F',  label: 'Needs Work',     color: '#ef4444' }
}

function qualityColor(q) {
  return q === 'strong' ? '#10b981' : q === 'average' ? '#f59e0b' : q === 'weak' ? '#ef4444' : '#6b7280'
}

// ─── Animated Score Bar ─────────────────────────────────
function ScoreBar({ label, score, icon: Icon, color, delay = 0 }) {
  const pct = (clamp(score) / 10) * 100
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon size={13} style={{ color }} />
          <span className="text-xs text-gray-400 font-medium">{label}</span>
        </div>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {score?.toFixed(1) ?? '—'}<span className="text-gray-600 text-xs font-normal">/10</span>
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay }}
          style={{ background: color }}
        />
      </div>
    </div>
  )
}

// ─── Overall Score Ring (SVG) ────────────────────────────
function ScoreRing({ score, grade, label }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const pct = clamp(score) / 10
  const dash = circ * pct
  const [animDash, setAnimDash] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setAnimDash(dash), 200)
    return () => clearTimeout(t)
  }, [dash])

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke={grade.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${animDash} ${circ}`}
            style={{ transition: 'stroke-dasharray 1.4s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-black text-3xl" style={{ color: grade.color }}>
            {grade.grade}
          </span>
          <span className="text-white font-bold text-lg leading-none">
            {score?.toFixed(1)}
          </span>
          <span className="text-gray-500 text-xs">/ 10</span>
        </div>
      </div>
      <p className="mt-2 font-semibold text-lg">{label}</p>
    </div>
  )
}

// ─── Question Accordion Card ─────────────────────────────
function QuestionCard({ item, index }) {
  const [open, setOpen] = useState(false)
  const qc = qualityColor(item.answer_quality)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl overflow-hidden border border-white/8"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        {/* Question number */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: `${qc}20`, color: qc, border: `1px solid ${qc}40` }}
        >
          {item.question_number}
        </div>

        {/* Question text */}
        <p className="flex-1 text-sm text-gray-300 text-left line-clamp-2 leading-snug">
          {item.question}
        </p>

        <div className="flex items-center gap-3 shrink-0">
          {/* Difficulty badge */}
          <span className={`hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full font-medium
            ${item.difficulty === 'Hard'   ? 'bg-red-400/10 text-red-400' :
              item.difficulty === 'Medium' ? 'bg-yellow-400/10 text-yellow-400' :
              'bg-green-400/10 text-green-400'}`}>
            {item.difficulty}
          </span>

          {/* Score */}
          {item.overall_score != null ? (
            <span className="text-sm font-bold tabular-nums" style={{ color: qc }}>
              {item.overall_score.toFixed(1)}
            </span>
          ) : (
            <span className="text-xs text-gray-600">Skipped</span>
          )}

          {/* Mode icon */}
          {item.answer_mode === 'voice'
            ? <Mic size={13} className="text-gray-600" />
            : item.answer_mode === 'code'
            ? <Code2 size={13} className="text-violet-400" />
            : <MessageSquare size={13} className="text-gray-600" />
          }

          {open ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />}
        </div>
      </button>

      {/* Expanded */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-white/5 overflow-hidden"
          >
            <div className="px-5 py-4 space-y-4">
              {/* Score row */}
              {item.overall_score != null && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Technical',      v: item.technical_score },
                    { label: 'Completeness',   v: item.completeness_score },
                    { label: 'Communication',  v: item.communication_score },
                    { label: 'Overall',        v: item.overall_score, bold: true },
                  ].map(s => (
                    <div key={s.label} className="bg-white/3 rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                      <div
                        className={`font-bold tabular-nums ${s.bold ? 'text-lg' : 'text-base'}`}
                        style={{ color: qualityColor(item.answer_quality) }}
                      >
                        {s.v?.toFixed(1) ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Answer preview */}
              {item.answer && item.answer !== 'Skipped' && (
                <div>
                  <p className="text-xs text-gray-600 mb-1.5 font-medium">Your Answer</p>
                  <p className="text-sm text-gray-400 leading-relaxed italic bg-white/2 rounded-xl px-4 py-3 border border-white/5">
                    "{item.answer}{item.answer.length >= 300 ? '…' : ''}"
                  </p>
                </div>
              )}

              {/* AI Feedback */}
              {item.feedback && (
                <div className="pl-3 border-l-2 border-white/10">
                  <p className="text-xs text-gray-500 mb-0.5 font-medium">AI Feedback</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{item.feedback}</p>
                </div>
              )}

              {/* Strengths & missed */}
              <div className="flex flex-wrap gap-4">
                {item.strengths?.length > 0 && (
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-xs text-emerald-400 font-semibold mb-1.5 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Strengths
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.strengths.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400/10 border border-emerald-400/20 text-emerald-300">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {item.missed_points?.length > 0 && (
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-xs text-amber-400 font-semibold mb-1.5 flex items-center gap-1">
                      <Zap size={11} /> Missed Points
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.missed_points.map((m, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-amber-400/10 border border-amber-400/20 text-amber-300">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Emotion Timeline (Module 9) ────────────────────────────
const EMOTION_CONFIG = {
  Confident: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', emoji: '😎' },
  Happy:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  emoji: '😊' },
  Neutral:   { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', emoji: '😐' },
  Nervous:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   emoji: '😰' },
}

function EmotionTimeline({ emotionData }) {
  if (!emotionData || emotionData.length === 0) return null

  // Tally each emotion
  const counts = emotionData.reduce((acc, r) => {
    acc[r.emotion] = (acc[r.emotion] || 0) + 1
    return acc
  }, {})
  const total = emotionData.length

  const sorted = Object.entries(counts)
    .map(([emotion, count]) => ({
      emotion,
      count,
      pct: Math.round((count / total) * 100),
      ...EMOTION_CONFIG[emotion] || EMOTION_CONFIG.Neutral,
    }))
    .sort((a, b) => b.count - a.count)

  const dominant = sorted[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="glass rounded-3xl p-6"
    >
      <h2 className="font-display font-bold text-xl mb-1 flex items-center gap-2">
        <Smile size={18} className="text-yellow-400" />
        Emotion Analysis
      </h2>
      <p className="text-gray-500 text-sm mb-5">
        AI detected your facial expressions during the interview ({total} samples)
      </p>

      {/* Dominant emotion highlight */}
      <div
        className="rounded-2xl p-4 mb-5 flex items-center gap-4"
        style={{ background: dominant.bg, border: `1px solid ${dominant.border}` }}
      >
        <span className="text-4xl">{dominant.emoji}</span>
        <div>
          <p className="text-xs text-gray-500 font-medium mb-0.5">Dominant Emotion</p>
          <p className="text-xl font-bold" style={{ color: dominant.color }}>{dominant.emotion}</p>
          <p className="text-xs text-gray-500">Detected {dominant.pct}% of the time</p>
        </div>
      </div>

      {/* Emotion bars */}
      <div className="space-y-3">
        {sorted.map(({ emotion, pct, color, emoji }) => (
          <div key={emotion}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <span>{emoji}</span> {emotion}
              </span>
              <span className="text-xs font-bold tabular-nums" style={{ color }}>{pct}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                style={{ background: color }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main Report Page ────────────────────────────────────
export default function Report() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const hasFetched = useRef(false)

  const sid = sessionId || sessionStorage.getItem('sessionId')

  useEffect(() => {
    if (!sid || hasFetched.current) return
    hasFetched.current = true

    const load = async () => {
      try {
        const data = await getReport(sid)
        setReport(data)
      } catch (err) {
        setError(err?.response?.data?.detail || err.message || 'Failed to load report.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sid])

  // ── Loading state ────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="w-24 h-24 rounded-full border-2 border-violet-500/20 flex items-center justify-center">
              <Brain size={36} className="text-violet-400" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
          <h2 className="font-display font-bold text-2xl mb-2">Generating Your Report</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            The AI is analysing your performance and crafting a personalised improvement plan…
          </p>
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-600">
            {['Aggregating scores', 'Analysing patterns', 'Writing plan'].map((s, i) => (
              <motion.div
                key={s}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.8 }}
                className="flex items-center gap-1"
              >
                <Loader2 size={10} className="animate-spin" />
                {s}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-3xl p-10 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <h2 className="font-display font-bold text-xl mb-2">Report Unavailable</h2>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/')} className="btn-secondary flex items-center gap-2">
              <Home size={15} /> New Interview
            </button>
            <button
              onClick={() => { setError(''); setLoading(true); hasFetched.current = false }}
              className="btn-primary flex items-center gap-2"
            >
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!report) return null

  const { scores, improvement_plan: plan, per_question_breakdown: questions } = report
  const grade = gradeFromScore(scores.overall)

  const SCORE_METRICS = [
    { label: 'Technical Knowledge', key: 'technical_knowledge', icon: Brain,     color: '#8b5cf6' },
    { label: 'Communication',        key: 'communication',       icon: MessageSquare, color: '#3b82f6' },
    { label: 'Confidence',           key: 'confidence',          icon: TrendingUp, color: '#10b981' },
    { label: 'Problem Solving',      key: 'problem_solving',     icon: Target,    color: '#f59e0b' },
  ]

  return (
    <div className="min-h-screen pt-20 pb-20 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Hero Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-8 overflow-hidden relative"
        >
          {/* Background glow */}
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none opacity-20"
            style={{ background: `radial-gradient(circle, ${grade.color} 0%, transparent 70%)` }}
          />

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 relative z-10">
            {/* Score Ring */}
            <ScoreRing
              score={scores.overall}
              grade={grade}
              label={grade.label}
            />

            {/* Session details */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-3">
                <Award size={18} className="text-yellow-400" />
                <span className="text-yellow-400 font-semibold text-sm">Interview Complete</span>
              </div>
              <h1 className="font-display font-black text-3xl sm:text-4xl mb-3">
                Performance Report
              </h1>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-4">
                {[
                  report.domain,
                  report.experience?.split(' ')[0],
                  report.difficulty,
                ].map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-semibold bg-white/8 text-gray-300 border border-white/10">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Questions', value: `${report.answered_questions}/${report.total_questions}`, icon: MessageSquare },
                  { label: 'Duration',  value: `${report.duration_minutes || '—'} min`,                  icon: Clock },
                  { label: 'Overall',   value: `${scores.overall?.toFixed(1)}/10`,                        icon: BarChart2 },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/3 rounded-xl p-3 text-center border border-white/5">
                    <stat.icon size={13} className="text-gray-500 mx-auto mb-1" />
                    <div className="font-bold text-white text-sm">{stat.value}</div>
                    <div className="text-xs text-gray-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Score Breakdown ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-3xl p-6"
        >
          <h2 className="font-display font-bold text-xl mb-5 flex items-center gap-2">
            <BarChart2 size={18} className="text-violet-400" />
            Score Breakdown
          </h2>
          <div className="space-y-4">
            {SCORE_METRICS.map((m, i) => (
              <ScoreBar
                key={m.key}
                label={m.label}
                score={scores[m.key]}
                icon={m.icon}
                color={m.color}
                delay={0.2 + i * 0.12}
              />
            ))}
          </div>
        </motion.div>

        {/* ── Emotion Timeline (Module 9) ── */}
        {report.emotion_data && report.emotion_data.length > 0 && (
          <EmotionTimeline emotionData={report.emotion_data} />
        )}

        {/* ── Improvement Plan ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-3xl p-6"
        >
          <h2 className="font-display font-bold text-xl mb-1 flex items-center gap-2">
            <Sparkles size={18} className="text-accent-400" />
            AI Improvement Plan
          </h2>
          <p className="text-gray-500 text-sm mb-5">Personalised recommendations from your AI interviewer</p>

          {/* Summary */}
          {plan?.summary && (
            <div className="rounded-2xl p-5 mb-5 border border-white/8" style={{ background: 'rgba(99,102,241,0.06)' }}>
              <p className="text-gray-300 leading-relaxed text-sm">{plan.summary}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-5 mb-5">
            {/* Strengths */}
            <div>
              <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Top Strengths
              </h3>
              <div className="space-y-2">
                {plan?.strengths?.map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-400/5 border border-emerald-400/10">
                    <Star size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-300">{s}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Weaknesses */}
            <div>
              <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Areas to Improve
              </h3>
              <div className="space-y-2">
                {plan?.weaknesses?.map((w, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-400/5 border border-amber-400/10">
                    <Zap size={12} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-300">{w}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {plan?.recommendations?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-1.5">
                <TrendingUp size={14} /> Action Steps
              </h3>
              <div className="space-y-2">
                {plan.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-blue-400/5 border border-blue-400/10">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Per-Question Breakdown ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <h2 className="font-display font-bold text-xl mb-4 flex items-center gap-2 px-1">
            <MessageSquare size={18} className="text-blue-400" />
            Question-by-Question Breakdown
          </h2>
          <div className="space-y-3">
            {questions?.map((q, i) => (
              <QuestionCard key={i} item={q} index={i} />
            ))}
          </div>
        </motion.div>

        {/* ── Actions ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <button
            onClick={() => navigate('/')}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <Home size={16} /> New Interview
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.print()}
            className="flex-1 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #059669)' }}
          >
            <Download size={16} /> Save / Print Report
          </motion.button>
        </motion.div>

      </div>
    </div>
  )
}
