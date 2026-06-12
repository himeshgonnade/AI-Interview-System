import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Brain, Code2, Globe, Smartphone, Users, Network, Zap,
  Clock, BarChart2, Mic, Type, ChevronRight, Sparkles,
  Star, ArrowRight, Loader2, AlertCircle
} from 'lucide-react'
import { startSession } from '../api/client'

// ─── Data ───────────────────────────────────────────────

const DOMAINS = [
  {
    id: 'AIML',
    label: 'AI / ML',
    icon: Brain,
    color: 'from-violet-500 to-purple-600',
    glow: 'rgba(139,92,246,0.3)',
    topics: ['Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision'],
  },
  {
    id: 'Data Science',
    label: 'Data Science',
    icon: BarChart2,
    color: 'from-blue-500 to-cyan-500',
    glow: 'rgba(59,130,246,0.3)',
    topics: ['Statistics', 'EDA', 'Feature Engineering', 'Model Selection'],
  },
  {
    id: 'Web Development',
    label: 'Web Dev',
    icon: Globe,
    color: 'from-emerald-500 to-teal-500',
    glow: 'rgba(16,185,129,0.3)',
    topics: ['React', 'Node.js', 'REST APIs', 'System Design'],
  },
  {
    id: 'DSA',
    label: 'DSA',
    icon: Code2,
    color: 'from-orange-500 to-red-500',
    glow: 'rgba(249,115,22,0.3)',
    topics: ['Arrays', 'Trees', 'Graphs', 'Dynamic Programming'],
  },
  {
    id: 'Android',
    label: 'Android',
    icon: Smartphone,
    color: 'from-green-500 to-emerald-600',
    glow: 'rgba(34,197,94,0.3)',
    topics: ['Kotlin', 'Jetpack Compose', 'MVVM', 'Firebase'],
  },
  {
    id: 'HR Interview',
    label: 'HR Round',
    icon: Users,
    color: 'from-pink-500 to-rose-500',
    glow: 'rgba(236,72,153,0.3)',
    topics: ['Communication', 'Teamwork', 'Leadership', 'Situational'],
  },
  {
    id: 'Custom',
    label: 'Custom',
    icon: Zap,
    color: 'from-yellow-500 to-amber-500',
    glow: 'rgba(234,179,8,0.3)',
    topics: ['Your Domain', 'Your Rules', 'Personalized', 'Flexible'],
  },
]

const EXPERIENCE_LEVELS = [
  { id: 'Fresher', label: 'Fresher', desc: '0–1 year' },
  { id: 'Junior (1-2 years)', label: 'Junior', desc: '1–2 years' },
  { id: 'Mid (3-5 years)', label: 'Mid-Level', desc: '3–5 years' },
  { id: 'Senior (5+ years)', label: 'Senior', desc: '5+ years' },
]

const DIFFICULTIES = [
  { id: 'Easy', label: 'Easy', color: 'text-green-400', badge: 'bg-green-400/10 border-green-400/30' },
  { id: 'Medium', label: 'Medium', color: 'text-yellow-400', badge: 'bg-yellow-400/10 border-yellow-400/30' },
  { id: 'Hard', label: 'Hard', color: 'text-red-400', badge: 'bg-red-400/10 border-red-400/30' },
]

const DURATIONS = [10, 15, 20, 30, 45]

// ─── Sub-components ──────────────────────────────────────

function DomainCard({ domain, selected, onClick }) {
  const Icon = domain.icon
  return (
    <motion.button
      id={`domain-${domain.id.replace(/\s+/g, '-').toLowerCase()}`}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick(domain.id)}
      className={`relative p-4 rounded-2xl text-left transition-all duration-300 border ${
        selected
          ? 'border-primary-500 bg-primary-500/10'
          : 'border-white/8 glass'
      }`}
      style={selected ? { boxShadow: `0 0 25px ${domain.glow}` } : {}}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${domain.color} flex items-center justify-center mb-3`}>
        <Icon size={20} className="text-white" />
      </div>
      <p className="font-semibold text-white text-sm">{domain.label}</p>
      <p className="text-xs text-gray-500 mt-1">{domain.topics[0]}, {domain.topics[1]}...</p>
    </motion.button>
  )
}

function StepBadge({ number, label, active, done }) {
  return (
    <div className={`flex items-center gap-2 transition-all duration-300 ${active ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
        done ? 'bg-accent-500' : active ? 'bg-primary-500' : 'bg-white/10'
      }`}>
        {done ? '✓' : number}
      </div>
      <span className="text-sm font-medium text-gray-300 hidden sm:block">{label}</span>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1=domain, 2=config, 3=mode
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [config, setConfig] = useState({
    domain: '',
    experience: 'Fresher',
    difficulty: 'Medium',
    duration_minutes: 20,
    answer_mode: 'text',
    custom_domain: '',
    job_description: '',
  })

  const selectedDomain = DOMAINS.find(d => d.id === config.domain)

  const updateConfig = (key, value) => setConfig(prev => ({ ...prev, [key]: value }))

  const handleStart = async () => {
    setIsStarting(true)
    setStartError('')
    try {
      // Map frontend domain ids to backend enum values
      const domainMap = {
        'AIML': 'AIML',
        'Data Science': 'Data Science',
        'Web Development': 'Web Development',
        'DSA': 'DSA',
        'Android': 'Android',
        'HR Interview': 'HR Interview',
        'Custom': 'Custom',
      }

      const sessionConfig = {
        domain: domainMap[config.domain] || config.domain,
        experience: config.experience,
        difficulty: config.difficulty,
        duration_minutes: config.duration_minutes,
        answer_mode: config.answer_mode,
        custom_domain: config.custom_domain || null,
        job_description: config.job_description || null,
        resume_text: null,
      }

      const session = await startSession(sessionConfig)

      // Persist session info for the Interview page
      sessionStorage.setItem('sessionId', session.session_id)
      sessionStorage.setItem('sessionConfig', JSON.stringify(sessionConfig))
      sessionStorage.setItem('maxQuestions', String(session.max_questions))

      navigate(`/interview?session=${session.session_id}`)
    } catch (err) {
      setStartError(err.message || 'Failed to start interview. Please try again.')
      setIsStarting(false)
    }
  }

  const canProceedStep1 = config.domain !== ''
  const canProceedStep2 = config.experience && config.difficulty && config.duration_minutes
  const canStart = canProceedStep2 && (config.domain !== 'Custom' || config.custom_domain.trim())

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <Sparkles size={14} className="text-accent-400" />
            <span className="text-sm text-gray-300 font-medium">AI-Powered by Groq + Whisper</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold mb-4 leading-tight">
            Ace Your Next{' '}
            <span className="gradient-text">Interview</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Practice with an AI interviewer that asks real questions, evaluates your answers,
            and gives you a detailed performance report — just like the real thing.
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 mt-8">
            {[
              { value: '7+', label: 'Domains' },
              { value: 'Real-time', label: 'Feedback' },
              { value: 'AI', label: 'Powered' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div className="font-display font-bold text-2xl gradient-text">{stat.value}</div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Step Progress */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <StepBadge number={1} label="Choose Domain" active={step >= 1} done={step > 1} />
          <div className="w-8 h-px bg-white/10" />
          <StepBadge number={2} label="Configure" active={step >= 2} done={step > 2} />
          <div className="w-8 h-px bg-white/10" />
          <StepBadge number={3} label="Answer Mode" active={step >= 3} done={step > 3} />
        </div>

        {/* Step 1: Domain Selection */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="glass rounded-3xl p-8">
              <h2 className="font-display font-bold text-2xl mb-2">Select Interview Domain</h2>
              <p className="text-gray-400 text-sm mb-6">Choose the field you want to be interviewed in</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
                {DOMAINS.map(domain => (
                  <DomainCard
                    key={domain.id}
                    domain={domain}
                    selected={config.domain === domain.id}
                    onClick={(id) => updateConfig('domain', id)}
                  />
                ))}
              </div>

              {/* Custom domain input */}
              {config.domain === 'Custom' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Specify your domain
                  </label>
                  <input
                    id="custom-domain-input"
                    type="text"
                    placeholder="e.g. Cybersecurity, Blockchain, DevOps..."
                    className="input-field"
                    value={config.custom_domain}
                    onChange={e => updateConfig('custom_domain', e.target.value)}
                  />
                </motion.div>
              )}

              <button
                id="btn-next-step1"
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="glass rounded-3xl p-8 space-y-7">
              <div>
                <h2 className="font-display font-bold text-2xl mb-1">Configure Your Interview</h2>
                <p className="text-gray-400 text-sm">
                  Domain: <span className="text-primary-400 font-medium">{selectedDomain?.label}</span>
                </p>
              </div>

              {/* Experience Level */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">Experience Level</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {EXPERIENCE_LEVELS.map(lvl => (
                    <button
                      key={lvl.id}
                      id={`exp-${lvl.id.split(' ')[0].toLowerCase()}`}
                      onClick={() => updateConfig('experience', lvl.id)}
                      className={`p-3 rounded-xl text-center transition-all duration-200 border ${
                        config.experience === lvl.id
                          ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                          : 'border-white/8 glass text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <div className="font-semibold text-sm">{lvl.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{lvl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">Difficulty</label>
                <div className="flex gap-3">
                  {DIFFICULTIES.map(diff => (
                    <button
                      key={diff.id}
                      id={`diff-${diff.id.toLowerCase()}`}
                      onClick={() => updateConfig('difficulty', diff.id)}
                      className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 border ${
                        config.difficulty === diff.id
                          ? `${diff.badge} border-current ${diff.color}`
                          : 'border-white/8 glass text-gray-500 hover:border-white/20'
                      }`}
                    >
                      {diff.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Interview Duration
                </label>
                <div className="flex gap-3 flex-wrap">
                  {DURATIONS.map(d => (
                    <button
                      key={d}
                      id={`dur-${d}`}
                      onClick={() => updateConfig('duration_minutes', d)}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                        config.duration_minutes === d
                          ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                          : 'border-white/8 glass text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <Clock size={12} className="inline mr-1.5" />
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Job Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Job Description{' '}
                  <span className="text-accent-400 text-xs font-normal">(optional but recommended)</span>
                </label>
                <textarea
                  id="job-description-input"
                  placeholder="Paste the job description here. The AI will tailor questions to match the role requirements and identify skill gaps..."
                  className="input-field resize-none h-28 text-sm"
                  value={config.job_description}
                  onChange={e => updateConfig('job_description', e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <button
                  id="btn-back-step2"
                  onClick={() => setStep(1)}
                  className="btn-secondary flex-1"
                >
                  ← Back
                </button>
                <button
                  id="btn-next-step2"
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Answer Mode */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="glass rounded-3xl p-8">
              <h2 className="font-display font-bold text-2xl mb-2">Choose Answer Mode</h2>
              <p className="text-gray-400 text-sm mb-6">How will you answer the interview questions?</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {/* Text Mode */}
                <button
                  id="mode-text"
                  onClick={() => updateConfig('answer_mode', 'text')}
                  className={`p-6 rounded-2xl text-left transition-all duration-300 border ${
                    config.answer_mode === 'text'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-white/8 glass hover:border-white/20'
                  }`}
                  style={config.answer_mode === 'text' ? { boxShadow: '0 0 25px rgba(99,102,241,0.2)' } : {}}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4">
                    <Type size={22} className="text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Text Mode</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Type your answers using the keyboard. Great for DSA and coding-focused interviews.
                  </p>
                  <ul className="mt-3 space-y-1">
                    {['No microphone needed', 'Good for complex answers', 'Faster typing'].map(f => (
                      <li key={f} className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span className="text-accent-400">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </button>

                {/* Voice Mode */}
                <button
                  id="mode-voice"
                  onClick={() => updateConfig('answer_mode', 'voice')}
                  className={`p-6 rounded-2xl text-left transition-all duration-300 border ${
                    config.answer_mode === 'voice'
                      ? 'border-accent-500 bg-accent-500/10'
                      : 'border-white/8 glass hover:border-white/20'
                  }`}
                  style={config.answer_mode === 'voice' ? { boxShadow: '0 0 25px rgba(16,185,129,0.2)' } : {}}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
                    <Mic size={22} className="text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Voice Mode</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Speak your answers. The AI transcribes and also analyzes your confidence and fluency.
                  </p>
                  <ul className="mt-3 space-y-1">
                    {['Confidence analysis', 'Filler word detection', 'Speech pace tracking'].map(f => (
                      <li key={f} className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span className="text-accent-400">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </button>
              </div>

              {/* Summary Card */}
              <div className="glass rounded-2xl p-5 mb-6 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Star size={14} className="text-accent-400" />
                  <span className="text-sm font-semibold text-gray-300">Interview Summary</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Domain', value: selectedDomain?.label },
                    { label: 'Level', value: config.experience.split(' ')[0] },
                    { label: 'Difficulty', value: config.difficulty },
                    { label: 'Duration', value: `${config.duration_minutes} min` },
                  ].map(item => (
                    <div key={item.label} className="bg-white/3 rounded-xl p-3">
                      <div className="text-gray-500 text-xs mb-1">{item.label}</div>
                      <div className="text-white font-semibold text-sm">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error message */}
              {startError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4"
                >
                  <AlertCircle size={16} />
                  {startError}
                </motion.div>
              )}

              <div className="flex gap-3">
                <button
                  id="btn-back-step3"
                  onClick={() => setStep(2)}
                  disabled={isStarting}
                  className="btn-secondary flex-1 disabled:opacity-40"
                >
                  ← Back
                </button>
                <motion.button
                  id="btn-start-interview"
                  whileHover={canStart && !isStarting ? { scale: 1.02 } : {}}
                  whileTap={canStart && !isStarting ? { scale: 0.98 } : {}}
                  onClick={handleStart}
                  disabled={!canStart || isStarting}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #059669 100%)',
                    boxShadow: canStart && !isStarting ? '0 0 30px rgba(99,102,241,0.4)' : 'none',
                  }}
                >
                  {isStarting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Creating Session...
                    </>
                  ) : (
                    <>
                      <Brain size={18} />
                      Start Interview
                      <ChevronRight size={16} />
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Features section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            {
              icon: Brain,
              title: 'Adaptive Questions',
              desc: 'AI adjusts difficulty based on your answers — just like a real interviewer.',
              color: 'from-violet-500 to-purple-600',
            },
            {
              icon: BarChart2,
              title: 'Detailed Scoring',
              desc: 'Technical accuracy, communication clarity, and confidence — all measured.',
              color: 'from-blue-500 to-cyan-500',
            },
            {
              icon: Sparkles,
              title: 'Personalized Plan',
              desc: 'Get a custom improvement plan with your strengths and areas to work on.',
              color: 'from-emerald-500 to-teal-500',
            },
          ].map(feature => {
            const Icon = feature.icon
            return (
              <div key={feature.title} className="glass rounded-2xl p-5 hover:border-white/15 transition-all duration-300">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3`}>
                  <Icon size={18} className="text-white" />
                </div>
                <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{feature.desc}</p>
              </div>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}
