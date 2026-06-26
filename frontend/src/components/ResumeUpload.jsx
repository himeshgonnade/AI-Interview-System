/**
 * ResumeUpload.jsx — Drag-and-drop PDF resume + Job Description input.
 *
 * Props:
 *   onResumeParsed(text: string)  — called with extracted plain text after PDF parse
 *   onJdChange(text: string)      — called on JD textarea changes
 *   jdValue: string               — controlled JD textarea value
 */

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Upload, X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { parseResume } from '../api/client'

export default function ResumeUpload({ onResumeParsed, onJdChange, jdValue = '' }) {
  const [isDragging, setIsDragging]   = useState(false)
  const [isParsing, setIsParsing]     = useState(false)
  const [parseError, setParseError]   = useState('')
  const [uploadedFile, setUploadedFile] = useState(null)  // { name, charCount }
  const fileInputRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setParseError('Only PDF files are supported.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setParseError('File too large (max 10 MB).')
      return
    }

    setIsParsing(true)
    setParseError('')
    try {
      const result = await parseResume(file)
      setUploadedFile({ name: file.name, charCount: result.char_count })
      onResumeParsed(result.text)
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Failed to parse PDF.'
      setParseError(msg)
    } finally {
      setIsParsing(false)
    }
  }, [onResumeParsed])

  // ── Drag handlers ─────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = ()  => setIsDragging(false)
  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const clearResume = () => {
    setUploadedFile(null)
    setParseError('')
    onResumeParsed('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* ── PDF Drop Zone ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          Resume / CV{' '}
          <span className="text-xs text-gray-500 font-normal">(optional — PDF only, max 10 MB)</span>
        </label>

        <AnimatePresence mode="wait">
          {uploadedFile ? (
            /* Uploaded state */
            <motion.div
              key="uploaded"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{uploadedFile.name}</p>
                <p className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 size={11} />
                  {uploadedFile.charCount.toLocaleString()} characters extracted
                </p>
              </div>
              <button
                onClick={clearResume}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors"
                title="Remove resume"
              >
                <X size={15} />
              </button>
            </motion.div>
          ) : (
            /* Drop zone */
            <motion.div
              key="dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-violet-500/60 bg-violet-500/8'
                  : 'border-white/12 hover:border-white/25 bg-white/2 hover:bg-white/4'
              }`}
            >
              {isParsing ? (
                <>
                  <Loader2 size={24} className="text-violet-400 animate-spin" />
                  <p className="text-sm text-gray-400">Extracting text from PDF…</p>
                </>
              ) : (
                <>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    isDragging ? 'bg-violet-500/20' : 'bg-white/5'
                  }`}>
                    <Upload size={20} className={isDragging ? 'text-violet-400' : 'text-gray-500'} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-300">
                      {isDragging ? 'Drop it here!' : 'Drag & drop your resume'}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">or click to browse (PDF only)</p>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {parseError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-xs text-red-400 flex items-center gap-1"
          >
            <AlertCircle size={11} /> {parseError}
          </motion.p>
        )}
      </div>
    </div>
  )
}
