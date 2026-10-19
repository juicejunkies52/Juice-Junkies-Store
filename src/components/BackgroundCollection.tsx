'use client'

import { motion } from 'framer-motion'
import { BACKGROUND_POOL } from '../../lib/backgrounds'

export default function BackgroundCollection({
  unlockedIds,
  onClose
}: {
  unlockedIds: string[]
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="fixed top-4 right-4 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        Close ✕
      </button>

      <div className="mx-auto max-w-lg px-4 py-20 text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-accent drop-shadow-[0_0_10px_rgba(57,255,20,0.6)] sm:text-3xl">
          🖼️ Background Collection
        </h2>
        <p className="mt-2 text-sm text-white/70">
          {unlockedIds.length}/{BACKGROUND_POOL.length} unlocked -- every Smash Juice Junkies session hides one of
          these behind the page. Destroy the whole thing to uncover it and add it here for good.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {BACKGROUND_POOL.map((bg) => {
            const unlocked = unlockedIds.includes(bg.id)
            return (
              <div
                key={bg.id}
                className={`flex flex-col items-center gap-2 overflow-hidden rounded-xl border p-2 ${
                  unlocked ? 'border-accent/40 bg-black/60' : 'border-white/10 bg-black/40'
                }`}
              >
                <div className="h-20 w-full overflow-hidden rounded-lg bg-black/60">
                  {unlocked ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bg.src} alt={bg.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/20">?</div>
                  )}
                </div>
                <p className={`text-xs font-semibold ${unlocked ? 'text-white' : 'text-white/30'}`}>
                  {unlocked ? bg.name : '???'}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
