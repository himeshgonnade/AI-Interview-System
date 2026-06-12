import { Brain } from 'lucide-react'

// This page will be fully built in Module 3
export default function Interview() {
  return (
    <div className="min-h-screen pt-24 flex items-center justify-center">
      <div className="text-center glass rounded-3xl p-12 max-w-md mx-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Brain size={28} className="text-white" />
        </div>
        <h2 className="font-display font-bold text-2xl mb-2">Interview Session</h2>
        <p className="text-gray-400 text-sm">
          Coming in <span className="text-primary-400 font-semibold">Module 3</span>.
          The live interview UI with voice/text answering will be built here.
        </p>
      </div>
    </div>
  )
}
