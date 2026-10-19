'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Music, X } from 'lucide-react'

// Spotify's own official embed widget for Juice WRLD's artist page --
// audio streams straight from Spotify's servers via this iframe, so
// nothing is ever hosted, downloaded, or proxied by this site.
const SPOTIFY_ARTIST_EMBED_URL = 'https://open.spotify.com/embed/artist/4MCBfE4596Uoi2O4DtmEMz?utm_source=generator&theme=0'

export default function AudioPlayer() {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Show the badge after 3 seconds, matching the old player's timing
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {isVisible && !isDismissed && (
        <motion.div
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
          initial={{ opacity: 0, scale: 0, rotate: -180 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0, rotate: 180 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="w-[260px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-accent/40 bg-black/90 shadow-2xl backdrop-blur-md"
              >
                <iframe
                  title="Juice WRLD on Spotify"
                  src={SPOTIFY_ARTIST_EMBED_URL}
                  width="100%"
                  height="280"
                  style={{ border: 0 }}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-black/80 backdrop-blur-md rounded-full border border-accent/50 p-3 shadow-2xl relative">
            <button
              onClick={() => setIsDismissed(true)}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white transition-colors"
              title="Dismiss"
            >
              <X className="w-2.5 h-2.5" />
            </button>

            <button onClick={() => setIsOpen((o) => !o)} title={isOpen ? 'Hide player' : 'Listen on Spotify'}>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Music className="w-4 h-4 text-accent" />
              </motion.div>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
