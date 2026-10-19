'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SecretBasketballGame from './SecretBasketballGame'

interface Signature {
  id: string
  name: string
  x: number
  y: number
  color: string
}

const NEON_COLORS = ['#39ff14', '#c084fc', '#60a5fa', '#f472b6', '#facc15', '#4ade80']

export default function SecretWall({ onClose }: { onClose: () => void }) {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Signing is gated behind the hoop game every time the wall is opened --
  // sink enough to earn the right to click and leave your name.
  const [gameComplete, setGameComplete] = useState(false)
  const [holdingButterfly, setHoldingButterfly] = useState(false)

  useEffect(() => {
    fetch('/api/wall-signatures')
      .then((r) => r.json())
      .then((d) => setSignatures(Array.isArray(d.signatures) ? d.signatures : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gameComplete || pending) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPending({ x, y })
    setNameInput('')
    setError(null)
  }

  const submitSignature = async () => {
    const name = nameInput.trim()
    if (!name) {
      setError('Type something first 👀')
      return
    }
    if (!pending) return
    setSubmitting(true)
    setError(null)
    try {
      const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)]
      const res = await fetch('/api/wall-signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, x: pending.x, y: pending.y, color })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not sign -- try again')
        return
      }
      setSignatures((s) => [...s, data.signature])
      setPending(null)
      setNameInput('')
    } catch {
      setError('Could not sign -- try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] overflow-hidden bg-black/95 backdrop-blur-sm"
      onClick={handleBackgroundClick}
    >
      {/* z-[120]: must stay above the hoop game's z-[110] full-screen hit
          area, or the game swallows every click and the button becomes
          visually present but functionally unreachable. */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute top-4 right-4 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        Close ✕
      </button>

      {!holdingButterfly && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-[101] -translate-x-1/2 px-4 text-center">
          <motion.h2
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-xl font-bold text-accent drop-shadow-[0_0_10px_rgba(57,255,20,0.6)] sm:text-2xl"
          >
            🔓 You found the secret wall
          </motion.h2>
          <p className="mt-1 text-xs text-white/70 sm:text-sm">
            {gameComplete ? 'Click anywhere to leave your mark, 999 Club.' : 'Sink 25 to earn your spot on the wall.'}
          </p>
        </div>
      )}

      <AnimatePresence>
        {!gameComplete && (
          <motion.div
            key="hoop-game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SecretBasketballGame onComplete={() => setGameComplete(true)} onDraggingChange={setHoldingButterfly} />
          </motion.div>
        )}
      </AnimatePresence>

      {!loading &&
        !holdingButterfly &&
        signatures.map((sig) => (
          <div
            key={sig.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none font-mono text-sm font-bold sm:text-base"
            style={{
              left: `${sig.x}%`,
              top: `${sig.y}%`,
              color: sig.color,
              textShadow: `0 0 10px ${sig.color}, 0 0 4px ${sig.color}`
            }}
          >
            {sig.name}
          </div>
        ))}

      {pending && (
        <div
          className="absolute z-[103] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-xl border border-accent/50 bg-black/90 p-3 shadow-2xl"
          style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            maxLength={24}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitSignature()
            }}
            placeholder="Your name"
            className="w-40 rounded-md border border-accent/40 bg-black/60 px-2 py-1 text-sm text-white outline-none focus:border-accent"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={submitSignature}
              disabled={submitting}
              className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-black disabled:opacity-50"
            >
              {submitting ? 'Signing...' : 'Sign it'}
            </button>
            <button
              onClick={() => setPending(null)}
              className="rounded-md border border-white/20 px-3 py-1 text-xs text-white/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
