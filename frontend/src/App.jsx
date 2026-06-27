import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Home from './pages/Home'
import Interview from './pages/Interview'
import Report from './pages/Report'
import Login from './pages/Login'
import Register from './pages/Register'
import History from './pages/History'
import Navbar from './components/Navbar'

// ── Protected route — redirects to /login if not authenticated ──
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <BrowserRouter>
      {/* Ambient background orbs */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />

      <div className="relative z-10 min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/"          element={<Home />} />
          <Route path="/login"     element={<Login />} />
          <Route path="/register"  element={<Register />} />
          <Route path="/interview" element={
            <ProtectedRoute><Interview /></ProtectedRoute>
          } />
          <Route path="/report/:sessionId" element={
            <ProtectedRoute><Report /></ProtectedRoute>
          } />
          <Route path="/history"   element={
            <ProtectedRoute><History /></ProtectedRoute>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
