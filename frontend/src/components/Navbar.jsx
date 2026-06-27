import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Sparkles, LogIn, UserPlus, History, LogOut, User, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const location   = useLocation()
  const navigate   = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const isHome     = location.pathname === '/'
  const [dropdown, setDropdown] = useState(false)
  const dropRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    setDropdown(false)
    navigate('/')
  }

  // Avatar initials
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #34d399)' }}
          >
            <Brain size={20} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl gradient-text">InterviewAI</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {!isHome && (
            <Link to="/" className="btn-secondary text-sm">← New Interview</Link>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
            <Sparkles size={14} className="text-accent-400" />
            <span className="text-xs font-medium text-gray-300">Powered by Groq</span>
          </div>

          {isAuthenticated ? (
            /* ── Logged-in: Avatar dropdown ── */
            <div className="relative" ref={dropRef}>
              <button
                id="nav-user-menu"
                onClick={() => setDropdown(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass hover:border-violet-500/30 transition-all duration-200"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #059669)' }}
                >
                  {initials}
                </div>
                <span className="text-sm text-gray-300 max-w-[80px] truncate">{user?.name?.split(' ')[0]}</span>
                <ChevronDown size={13} className={`text-gray-500 transition-transform ${dropdown ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {dropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 rounded-2xl overflow-hidden"
                    style={{
                      background: 'rgba(10,10,22,0.95)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(20px)',
                    }}
                  >
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-white/6">
                      <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>

                    {/* Menu items */}
                    <div className="p-1.5">
                      <Link
                        to="/history"
                        onClick={() => setDropdown(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                      >
                        <History size={14} className="text-violet-400" />
                        My Interviews
                      </Link>
                      <button
                        id="nav-logout"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:text-red-400 hover:bg-red-500/8 transition-all"
                      >
                        <LogOut size={14} className="text-red-400" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          ) : (
            /* ── Logged-out: Login + Register ── */
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-gray-300 border border-white/10 hover:bg-white/5 transition-all"
              >
                <LogIn size={14} /> Sign In
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #059669)' }}
              >
                <UserPlus size={14} /> Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
