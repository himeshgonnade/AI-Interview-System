import { Link, useLocation } from 'react-router-dom'
import { Brain, GitBranch, Sparkles } from 'lucide-react'

export default function Navbar() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #4f46e5, #34d399)' }}>
            <Brain size={20} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl gradient-text">
            InterviewAI
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-3">
          {!isHome && (
            <Link to="/" className="btn-secondary text-sm">
              ← New Interview
            </Link>
          )}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-xl glass flex items-center justify-center hover:border-primary-500 transition-all duration-300 hover:glow-purple"
            aria-label="GitHub"
          >
            <GitBranch size={18} className="text-gray-400" />
          </a>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
            <Sparkles size={14} className="text-accent-400" />
            <span className="text-xs font-medium text-gray-300">Powered by Groq</span>
          </div>
        </div>
      </div>
    </nav>
  )
}
