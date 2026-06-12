import { BarChart2 } from 'lucide-react'

// This page will be fully built in Module 7
export default function Report() {
  return (
    <div className="min-h-screen pt-24 flex items-center justify-center">
      <div className="text-center glass rounded-3xl p-12 max-w-md mx-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
          <BarChart2 size={28} className="text-white" />
        </div>
        <h2 className="font-display font-bold text-2xl mb-2">Interview Report</h2>
        <p className="text-gray-400 text-sm">
          Coming in <span className="text-accent-400 font-semibold">Module 7</span>.
          The detailed performance report with scores and improvement plan will be built here.
        </p>
      </div>
    </div>
  )
}
