'use client'

import { useState } from 'react'
import BowlingGame from './BowlingGame'

// Wii-Sports-style hub: one Games Hub entry holding multiple sport modes
// instead of a separate top-level card per sport. Bowling is the only
// playable mode for now; Pool is a visible "Coming soon" placeholder so
// the menu shape is already right when that build starts.
export default function SportsGame({ onClose }: { visitorId: string; onClose: () => void }) {
  const [activeSport, setActiveSport] = useState<'menu' | 'bowling'>('menu')

  if (activeSport === 'bowling') {
    return <BowlingGame onBack={() => setActiveSport('menu')} onClose={onClose} />
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/95 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        Close ✕
      </button>

      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-accent drop-shadow-[0_0_10px_rgba(57,255,20,0.6)] sm:text-3xl">🏆 999 Sports</h2>
        <p className="mt-2 text-sm text-white/70">Pick a sport.</p>

        <div className="mt-8 flex flex-col gap-4">
          <button
            onClick={() => setActiveSport('bowling')}
            className="flex items-center gap-4 rounded-xl border border-accent/30 bg-black/60 p-4 text-left transition-colors hover:border-accent"
          >
            <span className="text-3xl">🎳</span>
            <span>
              <span className="block font-semibold text-white">Bowling</span>
              <span className="block text-xs text-white/50">Drag back and release to bowl -- 10 throws, see how many pins you can knock down.</span>
            </span>
          </button>

          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/40 p-4 text-left opacity-50">
            <span className="text-3xl">🎱</span>
            <span>
              <span className="block font-semibold text-white">Pool -- Coming soon</span>
              <span className="block text-xs text-white/50">Sink as many balls as you can.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
