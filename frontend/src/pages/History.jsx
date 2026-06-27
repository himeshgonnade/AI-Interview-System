import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, BarChart2, Clock, CheckCircle2, AlertCircle,
  ChevronRight, Loader2, Calendar, TrendingUp, Zap, Activity
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getUserHistory } from '../api/client'

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-xs text-gray-600 italic">No score</span>
  const color = score >= 7.5 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444'
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold"
      style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
    >
      {score.toFixed(1)}<span className="font-normal opacity-60">/10</span>
    </span>
  )
}

function StatusBadge({ status }) {
  const cfg = {
    completed: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', label: 'Completed' },
    active:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  label: 'In Progress' },
  }[status] || { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', label: status }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
    >
      {cfg.label}
    </span>
  )
}

const DOMAIN_COLORS = {
  'AIML':            { from: '#7c3aed', to: '#4f46e5' },
  'Data Science':    { from: '#2563eb', to: '#06b6d4' },
  'Web Development': { from: '#059669', to: '#0d9488' },
  'DSA':             { from: '#ea580c', to: '#dc2626' },
  'Android':         { from: '#16a34a', to: '#059669' },
  'HR Interview':    { from: '#db2777', to: '#e11d48' },
  'Custom':          { from: '#d97706', to: '#b45309' },
}

function SessionCard({ session, index, onClick }) {
  const colors = DOMAIN_COLORS[session.domain] || { from: '#6366f1', to: '#8b5cf6' }
  const date = session.created_at
    ? new Date(session.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'
  const duration = session.ended_at && session.created_at
    ? Math.round((new Date(session.ended_at) - new Date(session.created_at)) / 60000)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      onClick={onClick}
      className="group rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:scale-[1.01]"
      style={{
        background: 'rgba(10,10,22,0.8)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
      whileHover={{ borderColor: 'rgba(99,102,241,0.3)', boxShadow: '0 4px 32px rgba(79,70,229,0.12)' }}
    >
      <div className="flex items-start gap-4">
        {/* Domain icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)` }}
        >
          <Brain size={18} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-sm font-semibold text-white">{session.domain || 'Interview'}</h3>
            <StatusBadge status={session.status} />
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={10} /> {date}
            </span>
            <span className="flex items-center gap-1">
              <Zap size={10} /> {session.difficulty}
            </span>
            <span className="flex items-center gap-1">
              <Activity size={10} />
              {session.question_count}/{session.max_questions} questions
            </span>
            {duration != null && (
              <span className="flex items-center gap-1">
                <Clock size={10} /> {duration} min
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <ScoreBadge score={session.overall_score} />
          <ChevronRight size={16} className="text-gray-600 group-hover:text-violet-400 transition-colors" />
        </div>
      </div>
    </motion.div>
  )
}

export default function History() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    loadHistory()
  }, [isAuthenticated])

  const loadHistory = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getUserHistory(user.user_id)
      setSessions(res.sessions || [])
    } catch (err) {
      setError(err.message || 'Failed to load interview history.')
    } finally {
      setLoading(false)
    }
  }

  // Aggregate stats
  const completed = sessions.filter(s => s.status === 'completed')
  const avgScore  = completed.filter(s => s.overall_score != null).length > 0
    ? completed.filter(s => s.overall_score != null).reduce((acc, s) => acc + s.overall_score, 0) /
      completed.filter(s => s.overall_score != null).length
    : null
  const totalQs = sessions.reduce((a, s) => a + s.question_count, 0)

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #059669)' }}
            >
              <BarChart2 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">My Interviews</h1>
              <p className="text-sm text-gray-500">
                {user?.name ? `Hello, ${user.name.split(' ')[0]}!` : ''} Here's your interview history.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        {!loading && sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            {[
              { label: 'Total Sessions', value: sessions.length, icon: Brain, color: '#7c3aed' },
              { label: 'Completed',      value: completed.length, icon: CheckCircle2, color: '#10b981' },
              { label: 'Avg Score',      value: avgScore != null ? avgScore.toFixed(1) : '—', icon: TrendingUp, color: '#f59e0b' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-2xl p-4 text-center"
                style={{
                  background: 'rgba(10,10,22,0.8)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <Icon size={16} className="mx-auto mb-2" style={{ color }} />
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <Loader2 size={32} className="text-violet-400 animate-spin" />
              <p className="text-gray-500 text-sm">Loading your interview history…</p>
            </motion.div>

          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-gray-400 text-sm">{error}</p>
              <button
                onClick={loadHistory}
                className="px-4 py-2 rounded-xl text-sm text-violet-400 border border-violet-400/20 hover:bg-violet-400/10 transition-all"
              >
                Try Again
              </button>
            </motion.div>

          ) : sessions.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-4 text-center"
            >
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mb-2"
                style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <Brain size={32} className="text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">No interviews yet</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                Complete your first AI interview to see your results and track your progress here.
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/')}
                className="mt-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #059669)', boxShadow: '0 0 24px rgba(79,70,229,0.25)' }}
              >
                Start First Interview
              </motion.button>
            </motion.div>

          ) : (
            <motion.div key="list" className="space-y-3">
              {sessions.map((session, i) => (
                <SessionCard
                  key={session.session_id}
                  session={session}
                  index={i}
                  onClick={() => session.status === 'completed'
                    ? navigate(`/report/${session.session_id}`)
                    : navigate(`/interview?session=${session.session_id}`)
                  }
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
