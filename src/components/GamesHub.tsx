'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FlappyGame from './FlappyGame'
import LastStandGame from './LastStandGame'
import MineWorldGame from './MineWorldGame'
// ClubhouseGame and NightsGame are archived for now (not deleted -- just
// not wired into the hub) to cut scope/clutter while the destroy-mode
// rework is the focus. Re-add the imports + buttons + AnimatePresence
// blocks below (see git history) to bring them back.

// Site owner's own account -- the external Sprite Fusion link is kept
// visible only here (for comparison/reference) now that our own in-house
// version is the one visitors get pointed to.
const OWNER_EMAIL = 'wrecklessjay02@gmail.com'

// Dedicated entry point for mini-games -- separate from the Collection
// modal so new games land here instead of getting buried in the creature
// browsing flow.
export default function GamesHub({
  caughtTypes,
  visitorId,
  onClose,
  onActivateDestroyMode,
  onActivateHideSeek
}: {
  caughtTypes: string[]
  visitorId: string
  onClose: () => void
  onActivateDestroyMode: () => void
  onActivateHideSeek: () => void
}) {
  const [playingFlutter, setPlayingFlutter] = useState(false)
  const [playingLastStand, setPlayingLastStand] = useState(false)
  const [playingMineWorld, setPlayingMineWorld] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.email?.toLowerCase() === OWNER_EMAIL) setIsOwner(true)
      })
      .catch(() => {})
  }, [])

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

      <div className="mx-auto max-w-lg px-4 py-24 text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-accent drop-shadow-[0_0_10px_rgba(57,255,20,0.6)] sm:text-3xl">
          🎮 Games
        </h2>
        <p className="mt-2 text-sm text-white/70">More little games coming soon -- pick one to play.</p>

        <div className="mt-8 flex flex-col gap-4">
          <button
            onClick={() => setPlayingFlutter(true)}
            className="flex items-center gap-4 rounded-xl border border-accent/30 bg-black/60 p-4 text-left transition-colors hover:border-accent"
          >
            <span className="text-3xl">🦋</span>
            <span>
              <span className="block font-semibold text-white">999 Flutter</span>
              <span className="block text-xs text-white/50">
                Flap through obstacles, play as any creature you've caught.
              </span>
            </span>
          </button>

          <button
            onClick={() => setPlayingLastStand(true)}
            className="flex items-center gap-4 rounded-xl border border-accent/30 bg-black/60 p-4 text-left transition-colors hover:border-accent"
          >
            <span className="text-3xl">🧃</span>
            <span>
              <span className="block font-semibold text-white">999 Last Stand</span>
              <span className="block text-xs text-white/50">
                Survive waves, auto-fire at Fiends, build up your base between rounds.
              </span>
            </span>
          </button>

          <button
            onClick={() => setPlayingMineWorld(true)}
            className="flex items-center gap-4 rounded-xl border border-accent/30 bg-black/60 p-4 text-left transition-colors hover:border-accent"
          >
            <span className="text-3xl">⛏️</span>
            <span>
              <span className="block font-semibold text-white">999 Depths</span>
              <span className="block text-xs text-white/50">Dig, mine, and build in your own world. Saves as you go.</span>
            </span>
          </button>

          <button
            onClick={onActivateDestroyMode}
            className="flex items-center gap-4 rounded-xl border border-accent/30 bg-black/60 p-4 text-left transition-colors hover:border-accent"
          >
            <span className="text-3xl">🔫</span>
            <span>
              <span className="block font-semibold text-white">Smash Juice Junkies</span>
              <span className="block text-xs text-white/50">
                Shoot and shatter the actual page you're on -- weapons, flight, co-op, and more. Stays right here.
              </span>
            </span>
          </button>

          <button
            onClick={onActivateHideSeek}
            className="flex items-center gap-4 rounded-xl border border-accent/30 bg-black/60 p-4 text-left transition-colors hover:border-accent"
          >
            <span className="text-3xl">🫥</span>
            <span>
              <span className="block font-semibold text-white">Hide & Seek</span>
              <span className="block text-xs text-white/50">
                One Seeker hunts with every weapon, everyone else disguises as real elements on the page.
              </span>
            </span>
          </button>

          {/* Owner-only reference link -- kept around for comparison now
              that our own in-house version is what visitors get pointed
              to. Embedded exactly as Sprite Fusion documents and offers
              it for other sites to use, free; not a reskin or
              reverse-engineered copy of their game. */}
          {isOwner && (
            <a
              href="https://destroy.spritefusion.com/?url=https://juicejunkies.shop"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/40 p-4 text-left opacity-70 transition-colors hover:border-accent hover:opacity-100"
            >
              <span className="text-3xl">💥</span>
              <span>
                <span className="block font-semibold text-white">Destroy This Website (reference, owner-only)</span>
                <span className="block text-xs text-white/50">
                  The original Sprite Fusion tool, for comparison. Not shown to visitors. Opens in a new tab.
                </span>
              </span>
            </a>
          )}
        </div>
      </div>

      <AnimatePresence>
        {playingFlutter && (
          <FlappyGame caughtTypes={caughtTypes} visitorId={visitorId} onClose={() => setPlayingFlutter(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playingLastStand && (
          <LastStandGame caughtTypes={caughtTypes} visitorId={visitorId} onClose={() => setPlayingLastStand(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>{playingMineWorld && <MineWorldGame visitorId={visitorId} onClose={() => setPlayingMineWorld(false)} />}</AnimatePresence>

    </motion.div>
  )
}
