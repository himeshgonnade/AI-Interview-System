import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, ChevronRight, StopCircle, Loader2,
  AlertCircle, CheckCircle2, BarChart2, RefreshCw,
  Zap, MessageSquare, Mic, MicOff, Send, SkipForward,
  Clock, TrendingUp, Star, AlertTriangle, Volume2,
  Square, Code2, Camera, CameraOff
} from 'lucide-react'
import Webcam from 'react-webcam'
import Editor from '@monaco-editor/react'
import { getNextQuestion, endSession, submitAnswer, transcribeAudio, analyzeEmotion, evaluateCode } from '../api/client'

// ─── Pre-generated waveform heights (stable across renders) ───
const WAVEFORM_BARS = Array.from({ length: 24 }, (_, i) => ({
  maxH: 8 + (((i * 7 + 13) % 20) + ((i * 3 + 5) % 12)),
  duration: 0.5 + (i % 4) * 0.12,
  delay: i * 0.042,
}))

// ─── Difficulty Badge ──────────────────────────────────────
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

// ─── Progress Bar ──────────────────────────────────────────
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

// ─── Session Timer ─────────────────────────────────────────
function SessionTimer({ startTime }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [startTime])

  const m = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const s = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
      <Clock size={12} className="text-gray-500" />
      {m}:{s}
    </div>
  )
}

// ─── Voice Waveform ────────────────────────────────────────
function VoiceWaveform({ isActive }) {
  return (
    <div className="flex items-end gap-0.5 h-8">
      {WAVEFORM_BARS.map((bar, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full"
          style={{ background: isActive ? '#f87171' : 'rgba(255,255,255,0.1)' }}
          animate={
            isActive
              ? { height: ['4px', `${bar.maxH}px`, '4px'] }
              : { height: '4px' }
          }
          transition={{
            duration: bar.duration,
            repeat: Infinity,
            delay: bar.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// ─── Score Bar ─────────────────────────────────────────────
function ScoreBar({ label, score, delay = 0 }) {
  const pct = Math.min(100, (score / 10) * 100)
  const color =
    score >= 7.5 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444'

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {score.toFixed(1)}<span className="text-gray-600 font-normal">/10</span>
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay }}
          style={{ background: color }}
        />
      </div>
    </div>
  )
}

// ─── AI Evaluation Panel ───────────────────────────────────
function EvaluationPanel({ evaluation, confidence }) {
  const scoreColor =
    evaluation.overall_score >= 7.5
      ? { text: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' }
      : evaluation.overall_score >= 5
      ? { text: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' }
      : { text: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' }

  const qualityConfig = {
    strong:  { label: 'Strong Answer',       Icon: Star,          cls: 'text-emerald-400' },
    average: { label: 'Good Answer',         Icon: TrendingUp,    cls: 'text-yellow-400' },
    weak:    { label: 'Needs Improvement',   Icon: AlertTriangle, cls: 'text-red-400' },
  }
  const qc = qualityConfig[evaluation.answer_quality] || qualityConfig.average

  return (
    <motion.div
      key="eval-panel"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-2xl p-5 mb-5"
      style={{ background: scoreColor.bg, border: `1px solid ${scoreColor.border}` }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <qc.Icon size={16} className={qc.cls} />
          <span className={`text-sm font-semibold ${qc.cls}`}>{qc.label}</span>
        </div>
        {/* Overall score circle */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg leading-none"
          style={{
            border: `2px solid ${scoreColor.text}`,
            color: scoreColor.text,
            background: scoreColor.bg,
          }}
        >
          {evaluation.overall_score.toFixed(1)}
        </div>
      </div>

      {/* Score breakdown bars */}
      <div className="space-y-2.5 mb-4">
        <ScoreBar label="Technical Accuracy"  score={evaluation.technical_score}    delay={0.1} />
        <ScoreBar label="Completeness"        score={evaluation.completeness_score} delay={0.2} />
        <ScoreBar label="Communication"       score={evaluation.communication_score} delay={0.3} />
      </div>

      {/* AI Feedback */}
      <p className="text-sm text-gray-300 leading-relaxed italic mb-4 pl-3 border-l-2 border-white/10">
        "{evaluation.feedback}"
      </p>

      {/* Strengths */}
      {evaluation.strengths?.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-emerald-400 mb-1.5 flex items-center gap-1">
            <CheckCircle2 size={11} /> Strengths
          </p>
          <div className="flex flex-wrap gap-1.5">
            {evaluation.strengths.map((s, i) => (
              <span
                key={i}
                className="px-2.5 py-0.5 rounded-full text-xs bg-emerald-400/10 border border-emerald-400/20 text-emerald-300"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missed points */}
      {evaluation.missed_points?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1">
            <Zap size={11} /> Could Improve
          </p>
          <div className="flex flex-wrap gap-1.5">
            {evaluation.missed_points.map((m, i) => (
              <span
                key={i}
                className="px-2.5 py-0.5 rounded-full text-xs bg-amber-400/10 border border-amber-400/20 text-amber-300"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confidence badge — voice mode only */}
      {confidence && (
        <div className="mt-4 pt-4 border-t border-white/8">
          <p className="text-xs font-semibold text-sky-400 mb-2 flex items-center gap-1">
            <Volume2 size={11} /> Voice Confidence
          </p>
          <div className="flex items-center gap-4">
            {/* Score pill */}
            <div
              className="px-3 py-1 rounded-full text-sm font-bold"
              style={{
                color: confidence.confidence_score >= 70 ? '#10b981'
                     : confidence.confidence_score >= 45 ? '#f59e0b' : '#ef4444',
                background: confidence.confidence_score >= 70 ? 'rgba(16,185,129,0.1)'
                          : confidence.confidence_score >= 45 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${confidence.confidence_score >= 70 ? 'rgba(16,185,129,0.25)'
                       : confidence.confidence_score >= 45 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              {confidence.confidence_score.toFixed(0)}%
            </div>
            <div className="flex-1 text-xs text-gray-400 leading-relaxed">
              {confidence.speech_rate_wpm > 0 && (
                <span className="mr-3">🗣 {confidence.speech_rate_wpm.toFixed(0)} WPM</span>
              )}
              {confidence.filler_word_count > 0 && (
                <span>💬 {confidence.filler_word_count} filler{confidence.filler_word_count !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          {confidence.feedback && (
            <p className="text-xs text-gray-500 mt-2 italic">{confidence.feedback}</p>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────
export default function Interview() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Session info
  const sessionId    = searchParams.get('session') || sessionStorage.getItem('sessionId')
  const maxQuestions = parseInt(sessionStorage.getItem('maxQuestions') || '7', 10)
  const sessionConfig = (() => {
    try { return JSON.parse(sessionStorage.getItem('sessionConfig') || '{}') }
    catch { return {} }
  })()

  // Question state
  const [question, setQuestion]             = useState(null)
  const [questionHistory, setQuestionHistory] = useState([])
  const [isLoading, setIsLoading]           = useState(true)
  const [isComplete, setIsComplete]         = useState(false)
  const [error, setError]                   = useState('')
  const [isEnding, setIsEnding]             = useState(false)

  // Answer state
  const [answerText, setAnswerText]         = useState('')
  const [answerMode, setAnswerMode]         = useState('text')  // 'text' | 'voice'
  const [isSubmitting, setIsSubmitting]     = useState(false)
  const [evaluation, setEvaluation]         = useState(null)
  const [confidence, setConfidence]         = useState(null)  // Module 6
  const [isAnswered, setIsAnswered]         = useState(false)
  const [lastQuality, setLastQuality]       = useState(null)

  // Voice recording state
  const [isRecording, setIsRecording]       = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordingTime, setRecordingTime]   = useState(0)
  const [micError, setMicError]             = useState('')
  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])
  const recordTimerRef   = useRef(null)
  const audioDurationRef = useRef(0)

  // Coding round state (Module 10)
  const [codeValue, setCodeValue]           = useState('# Write your solution here\n')
  const [codeLanguage, setCodeLanguage]     = useState('python')
  const [isEvaluatingCode, setIsEvaluatingCode] = useState(false)

  // Webcam / Emotion detection state (Module 9)
  const [showWebcam, setShowWebcam]         = useState(false)
  const webcamRef = useRef(null)
  const emotionIntervalRef = useRef(null)

  // Session start time for elapsed timer
  const sessionStartRef = useRef(Date.now())

  // Textarea auto-resize ref
  const textareaRef = useRef(null)

  // ── Guard: redirect if no session ───────────────────────
  useEffect(() => {
    if (!sessionId) navigate('/')
  }, [sessionId, navigate])

  // ── Fetch first question ─────────────────────────────────
  const fetchNextQuestion = useCallback(async (quality = null) => {
    if (!sessionId) return
    setIsLoading(true)
    setError('')
    try {
      const q = await getNextQuestion(sessionId, quality)
      if (q.is_complete) {
        setIsComplete(true)
      } else {
        setQuestion(q)
        setQuestionHistory(prev => [
          ...prev,
          { id: q.question_id, text: q.text, number: q.question_number },
        ])
        // Reset answer state for new question
        setAnswerText('')
        setEvaluation(null)
        setConfidence(null)
        setIsAnswered(false)
        setLastQuality(null)
        setRecordingTime(0)
        setMicError('')
      }
    } catch (err) {
      setError(err.message || 'Failed to load question. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => { fetchNextQuestion() }, [fetchNextQuestion])

  // ── Emotion capture (Module 9) ───────────────────────────
  useEffect(() => {
    if (!showWebcam || !sessionId) return
    emotionIntervalRef.current = setInterval(async () => {
      if (!webcamRef.current) return
      const imageSrc = webcamRef.current.getScreenshot()
      if (!imageSrc) return
      try {
        await analyzeEmotion(sessionId, imageSrc)
      } catch {
        // Silent fail — never interrupt the interview
      }
    }, 10000) // capture every 10 seconds
    return () => clearInterval(emotionIntervalRef.current)
  }, [showWebcam, sessionId])

  // ── Auto-resize textarea ─────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(120, textareaRef.current.scrollHeight)}px`
    }
  }, [answerText])

  // ── End session ──────────────────────────────────────────
  const handleEndInterview = async () => {
    setIsEnding(true)
    try {
      await endSession(sessionId)
    } catch {
      // Ignore — navigate anyway
    }
    navigate(`/report/${sessionId}`)
  }

  // ── Submit text/voice answer ─────────────────────────────
  const handleSubmitAnswer = async () => {
    if (!answerText.trim() || !question) return
    setIsSubmitting(true)
    setError('')
    try {
      const result = await submitAnswer(
        sessionId,
        question.question_id,
        answerText.trim(),
        answerMode,
        answerMode === 'voice' ? audioDurationRef.current : null
      )
      setEvaluation(result.evaluation)
      setConfidence(result.confidence || null)
      setLastQuality(result.evaluation.answer_quality)
      setIsAnswered(true)
    } catch (err) {
      setError(err.message || 'Evaluation failed. You can still proceed.')
      setIsAnswered(true)
      setLastQuality(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Submit code answer (Module 10) ──────────────────────
  const handleSubmitCode = async () => {
    if (!codeValue.trim() || !question) return
    setIsEvaluatingCode(true)
    setError('')
    try {
      const result = await evaluateCode(
        sessionId,
        question.question_id,
        codeValue,
        codeLanguage
      )
      setEvaluation(result.evaluation)
      setLastQuality(result.evaluation.answer_quality)
      setIsAnswered(true)
    } catch (err) {
      setError(err.message || 'Code evaluation failed. You can still proceed.')
      setIsAnswered(true)
      setLastQuality(null)
    } finally {
      setIsEvaluatingCode(false)
    }
  }

  // ── Skip question ────────────────────────────────────────
  const handleSkip = () => {
    setIsAnswered(true)
    setLastQuality(null)
  }

  // ── Next question ────────────────────────────────────────
  const handleNextQuestion = () => {
    fetchNextQuestion(lastQuality)
  }

  // ── Voice: Start Recording ───────────────────────────────
  const startRecording = async () => {
    setMicError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      audioDurationRef.current = 0

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        audioDurationRef.current = recordingTime
        await handleTranscribe(blob)
      }

      recorder.start(250) // collect chunks every 250ms
      setIsRecording(true)
      setRecordingTime(0)

      recordTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setMicError('Microphone access denied. Please allow microphone access and try again.')
      } else {
        setMicError('Could not access microphone. Please check your browser settings.')
      }
    }
  }

  // ── Voice: Stop Recording ────────────────────────────────
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      clearInterval(recordTimerRef.current)
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsTranscribing(true)
    }
  }

  // ── Voice: Transcribe blob ───────────────────────────────
  const handleTranscribe = async (blob) => {
    try {
      const result = await transcribeAudio(blob, 'recording.webm')
      setAnswerText(result.transcript || '')
    } catch (err) {
      setMicError('Transcription failed. Please type your answer manually.')
      setAnswerMode('text')
    } finally {
      setIsTranscribing(false)
    }
  }

  // ── Format recording time ────────────────────────────────
  const formatRecTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

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
            Your detailed performance report is being generated…
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleEndInterview}
            disabled={isEnding}
            className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #059669 100%)' }}
          >
            {isEnding
              ? <><Loader2 size={18} className="animate-spin" /> Generating Report…</>
              : <><BarChart2 size={18} /> View Full Report</>
            }
          </motion.button>
        </motion.div>
      </div>
    )
  }

  // ── Main Interview Layout ────────────────────────────────
  return (
    <div className="min-h-screen pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto">

        {/* ── Header Bar ── */}
        <div className="glass rounded-2xl px-5 py-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Brain size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{sessionConfig.domain || 'Interview'}</p>
              <p className="text-sm font-semibold text-white">
                {sessionConfig.experience?.split(' ')[0] || ''} · {sessionConfig.difficulty || ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SessionTimer startTime={sessionStartRef.current} />
            {/* Webcam toggle (Module 9) */}
            <button
              id="btn-toggle-webcam"
              onClick={() => setShowWebcam(v => !v)}
              title={showWebcam ? 'Hide camera' : 'Enable emotion detection'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                showWebcam
                  ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                  : 'text-gray-500 border-white/10 hover:bg-white/5'
              }`}
            >
              {showWebcam ? <Camera size={12} /> : <CameraOff size={12} />}
              {showWebcam ? 'Camera On' : 'Camera'}
            </button>
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
        </div>

        {/* ── Webcam preview (Module 9) ── */}
        {showWebcam && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="glass rounded-2xl p-3 flex items-center gap-4">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                width={120}
                height={90}
                className="rounded-xl"
                style={{ transform: 'scaleX(-1)' }}
              />
              <div>
                <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Emotion Detection Active
                </p>
                <p className="text-xs text-gray-500">AI is analyzing your facial expressions every 10 seconds to detect confidence signals.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Progress ── */}
        <div className="mb-6">
          <ProgressBar
            current={question?.question_number || questionHistory.length}
            total={maxQuestions}
          />
        </div>

        {/* ── Question Card + Answer Area ── */}
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
                <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                  <Loader2 size={28} className="text-violet-400 animate-spin" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-white font-semibold text-lg mb-1">AI is thinking…</p>
              <p className="text-gray-500 text-sm">Generating your next question</p>
            </motion.div>

          ) : error && !isAnswered ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass rounded-3xl p-8 flex flex-col items-center text-center min-h-[220px] justify-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle size={24} className="text-red-400" />
              </div>
              <p className="text-white font-semibold mb-2">Something went wrong</p>
              <p className="text-gray-400 text-sm mb-6 max-w-sm">{error}</p>
              <button
                onClick={() => fetchNextQuestion()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-all"
              >
                <RefreshCw size={14} /> Try Again
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
              {/* Question Card */}
              <div
                className="rounded-3xl p-8 mb-5 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(124,58,237,0.06) 100%)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}
              >
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

                <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                  <p className="text-xs text-gray-600">
                    {question.questions_remaining > 0
                      ? `${question.questions_remaining} question${question.questions_remaining !== 1 ? 's' : ''} remaining`
                      : 'Last question!'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-gray-500">Live session</span>
                  </div>
                </div>
              </div>

              {/* ── Answer Section ── */}
              <AnimatePresence mode="wait">
                {!isAnswered ? (
                  <motion.div
                    key="answer-input"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="glass rounded-2xl p-5 mb-5"
                  >
                    {/* ── CODING ROUND (Module 10) ── */}
                    {question.is_coding ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                            <Code2 size={12} className="text-violet-400" />
                            Coding Round — Write Your Solution
                          </p>
                          {/* Language selector */}
                          <select
                            value={codeLanguage}
                            onChange={e => setCodeLanguage(e.target.value)}
                            className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-300 focus:outline-none focus:border-violet-500/50"
                          >
                            <option value="python">Python</option>
                            <option value="javascript">JavaScript</option>
                            <option value="java">Java</option>
                            <option value="cpp">C++</option>
                            <option value="typescript">TypeScript</option>
                          </select>
                        </div>

                        {/* Monaco Editor */}
                        <div className="rounded-xl overflow-hidden border border-white/10 mb-4" style={{ height: 320 }}>
                          <Editor
                            height="320px"
                            language={codeLanguage === 'cpp' ? 'cpp' : codeLanguage}
                            value={codeValue}
                            onChange={val => setCodeValue(val || '')}
                            theme="vs-dark"
                            options={{
                              fontSize: 14,
                              minimap: { enabled: false },
                              scrollBeyondLastLine: false,
                              padding: { top: 12, bottom: 12 },
                              fontFamily: '\'JetBrains Mono\', \'Fira Code\', monospace',
                              lineNumbers: 'on',
                              wordWrap: 'on',
                            }}
                          />
                        </div>

                        {error && (
                          <p className="text-xs text-red-400 mb-3 flex items-center gap-1">
                            <AlertCircle size={11} /> {error}
                          </p>
                        )}

                        <div className="flex gap-2">
                          <button
                            id="btn-skip-code"
                            onClick={handleSkip}
                            disabled={isEvaluatingCode}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-white/10 hover:bg-white/5 transition-all disabled:opacity-30"
                          >
                            <SkipForward size={14} /> Skip
                          </button>

                          <motion.button
                            id="btn-submit-code"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSubmitCode}
                            disabled={isEvaluatingCode || !codeValue.trim()}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 20px rgba(124,58,237,0.25)' }}
                          >
                            {isEvaluatingCode
                              ? <><Loader2 size={15} className="animate-spin" /> Evaluating Code…</>
                              : <><Code2 size={14} /> Submit Code</>
                            }
                          </motion.button>
                        </div>
                      </div>

                    ) : (
                      // ── TEXT / VOICE ANSWER (existing) ──
                      <div>
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-3 mb-4">
                      <p className="text-xs text-gray-500 font-medium">Your Answer</p>
                      <div className="ml-auto flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                        {['text', 'voice'].map(mode => (
                          <button
                            key={mode}
                            onClick={() => {
                              setAnswerMode(mode)
                              setMicError('')
                            }}
                            disabled={isRecording || isTranscribing}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                              answerMode === mode
                                ? 'bg-white/10 text-white'
                                : 'text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {mode === 'text'
                              ? <><MessageSquare size={11} /> Text</>
                              : <><Volume2 size={11} /> Voice</>
                            }
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Text Mode */}
                    {answerMode === 'text' && (
                      <textarea
                        id="answer-textarea"
                        ref={textareaRef}
                        value={answerText}
                        onChange={e => setAnswerText(e.target.value)}
                        placeholder="Type your answer here… Be thorough and explain your reasoning."
                        className="w-full border border-white/8 rounded-xl px-4 py-3 text-sm placeholder-gray-600 resize-none focus:outline-none focus:border-violet-500/50 transition-colors leading-relaxed"
                        style={{
                          backgroundColor: 'rgba(12, 12, 24, 0.85)',
                          color: '#e5e7eb',
                          minHeight: '120px',
                        }}
                        disabled={isSubmitting}
                      />
                    )}

                    {/* Voice Mode */}
                    {answerMode === 'voice' && (
                      <div className="space-y-3">
                        {/* Waveform / transcript area */}
                        <div
                          className="rounded-xl border border-white/8 p-4 min-h-[120px] flex flex-col"
                          style={{ background: 'rgba(255,255,255,0.02)' }}
                        >
                          {isTranscribing ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-2">
                              <Loader2 size={20} className="text-violet-400 animate-spin" />
                              <p className="text-xs text-gray-500">Transcribing with Whisper…</p>
                            </div>
                          ) : isRecording ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                              <VoiceWaveform isActive />
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-xs text-red-400 font-mono font-semibold">
                                  REC {formatRecTime(recordingTime)}
                                </span>
                              </div>
                            </div>
                          ) : answerText ? (
                            <div className="flex-1">
                              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                <CheckCircle2 size={11} className="text-emerald-400" />
                                Transcript — edit if needed
                              </p>
                              <textarea
                                ref={textareaRef}
                                value={answerText}
                                onChange={e => setAnswerText(e.target.value)}
                                className="w-full rounded text-sm leading-relaxed resize-none focus:outline-none"
                                style={{
                                  backgroundColor: 'transparent',
                                  color: '#e5e7eb',
                                  minHeight: '80px',
                                }}
                              />
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center gap-2">
                              <VoiceWaveform isActive={false} />
                              <p className="text-xs text-gray-600">Press the mic button to start recording</p>
                            </div>
                          )}
                        </div>

                        {/* Mic button */}
                        <div className="flex items-center justify-center gap-3">
                          {!isRecording && !isTranscribing ? (
                            <motion.button
                              id="btn-start-recording"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={startRecording}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
                              style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
                            >
                              <Mic size={16} /> Start Recording
                            </motion.button>
                          ) : isRecording ? (
                            <motion.button
                              id="btn-stop-recording"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={stopRecording}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
                              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                            >
                              <Square size={14} /> Stop & Transcribe
                            </motion.button>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Loader2 size={16} className="animate-spin" /> Transcribing…
                            </div>
                          )}
                        </div>

                        {micError && (
                          <p className="text-xs text-red-400 text-center flex items-center justify-center gap-1">
                            <AlertCircle size={11} /> {micError}
                          </p>
                        )}
                      </div>
                    )}

                        {/* Char count (text mode) */}
                        {answerMode === 'text' && (
                          <p className="text-right text-xs text-gray-700 mt-1.5">
                            {answerText.length} chars
                          </p>
                        )}

                        {/* Error from submit */}
                        {error && (
                          <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                            <AlertCircle size={11} /> {error}
                          </p>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 mt-4">
                          <button
                            id="btn-skip"
                            onClick={handleSkip}
                            disabled={isSubmitting || isRecording || isTranscribing}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-white/10 hover:bg-white/5 transition-all disabled:opacity-30"
                          >
                            <SkipForward size={14} /> Skip
                          </button>

                          <motion.button
                            id="btn-submit-answer"
                            whileHover={answerText.trim() && !isSubmitting ? { scale: 1.02 } : {}}
                            whileTap={answerText.trim() && !isSubmitting ? { scale: 0.98 } : {}}
                            onClick={handleSubmitAnswer}
                            disabled={!answerText.trim() || isSubmitting || isRecording || isTranscribing}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              background: answerText.trim()
                                ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                                : 'rgba(255,255,255,0.05)',
                              boxShadow: answerText.trim() ? '0 0 20px rgba(99,102,241,0.25)' : 'none',
                            }}
                          >
                            {isSubmitting
                              ? <><Loader2 size={15} className="animate-spin" /> Evaluating…</>
                              : <><Send size={14} /> Submit Answer</>
                            }
                          </motion.button>
                        </div>
                      </div> /* end text/voice div */
                    ) /* end ternary */}
                  </motion.div>
                ) : (
                  /* After answer submitted */
                  <motion.div
                    key="post-answer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Evaluation panel */}
                    {evaluation && (
                      <EvaluationPanel evaluation={evaluation} confidence={confidence} />
                    )}

                    {/* Next / End buttons */}
                    <div className="flex gap-3">
                      <button
                        id="btn-end-session"
                        onClick={handleEndInterview}
                        disabled={isEnding}
                        className="btn-secondary flex items-center gap-2 disabled:opacity-40"
                      >
                        <StopCircle size={15} />
                        {isEnding ? 'Ending…' : 'End & Report'}
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
                        {question.questions_remaining === 0
                          ? <><CheckCircle2 size={16} /> Finish Interview</>
                          : <>Next Question <ChevronRight size={16} /></>
                        }
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── Question history trail ── */}
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
              {questionHistory.slice(0, -1).map(q => (
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
