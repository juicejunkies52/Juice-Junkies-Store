'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Music, X } from 'lucide-react'

export default function AudioPlayer() {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  // Show the badge after 3 seconds, matching the old player's timing
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {isVisible && !isDismissed && (
        <motion.div
          className="fixed bottom-6 right-6 z-50"
          initial={{ opacity: 0, scale: 0, rotate: -180 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0, rotate: 180 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="bg-black/80 backdrop-blur-md rounded-full border border-accent/50 pl-4 pr-5 py-3 shadow-2xl relative flex items-center gap-2">
            <button
              onClick={() => setIsDismissed(true)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white text-xs transition-colors"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>

            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Music className="w-5 h-5 text-accent" />
            </motion.div>
            <span className="text-white text-sm font-medium whitespace-nowrap">
              Sounds Dropping Soon 🎧
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
