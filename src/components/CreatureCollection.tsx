'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CREATURES, Rarity } from '../../lib/creatures'
import CreatureSvg from './CreatureSvg'
import CreatureDecorationArea from './CreatureDecorationArea'

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  legendary: 'Legendary',
  exclusive: 'Purchase Exclusive'
}

export default function CreatureCollection({
  caughtTypes,
  visitorId,
  onClose
}: {
  caughtTypes: string[]
  visitorId: string
  onClose: () => void
}) {
  const [decorating, setDecorating] = useState(false)

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
          📖 Your Collection
        </h2>
        <p className="mt-2 text-sm text-white/70">
          {caughtTypes.length}/{CREATURES.length} caught -- rare critters occasionally drift in among the
          butterflies and 999s. Fling one to catch it.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {caughtTypes.length > 0 && (
            <button
              onClick={() => setDecorating(true)}
              className="rounded-full border border-accent/40 bg-black/60 px-4 py-2 text-sm font-medium text-accent transition-colors hover:border-accent"
            >
              🎨 Decorate with your creatures
            </button>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {CREATURES.map((creature) => {
            const caught = caughtTypes.includes(creature.type)
            return (
              <div
                key={creature.type}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
                  caught ? 'border-accent/40 bg-black/60' : 'border-white/10 bg-black/40'
                }`}
              >
                <div style={{ color: caught ? creature.hex : '#444' }}>
                  <CreatureSvg type={creature.type} size={44} />
                </div>
                <p className={`text-sm font-semibold ${caught ? 'text-white' : 'text-white/30'}`}>
                  {caught ? creature.name : '???'}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-white/40">
                  {RARITY_LABEL[creature.rarity]}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {decorating && (
          <CreatureDecorationArea
            caughtTypes={caughtTypes}
            visitorId={visitorId}
            onClose={() => setDecorating(false)}
          />
        )}
      </AnimatePresence>

    </motion.div>
  )
}
