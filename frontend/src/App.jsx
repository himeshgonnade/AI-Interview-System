import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Interview from './pages/Interview'
import Report from './pages/Report'
import Navbar from './components/Navbar'

function App() {
  return (
    <BrowserRouter>
      {/* Ambient background orbs */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />

      <div className="relative z-10 min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/interview" element={<Interview />} />
          <Route path="/report/:sessionId" element={<Report />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
