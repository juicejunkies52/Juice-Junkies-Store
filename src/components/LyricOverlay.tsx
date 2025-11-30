'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

export default function LyricOverlay() {
  const [currentLyric, setCurrentLyric] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  const lyrics = [
    {
      text: "Legends never die",
      subtitle: "They become a part of you",
      position: "top"
    },
    {
      text: "999 forever",
      subtitle: "In my heart and on my sleeve",
      position: "center"
    },
    {
      text: "I want you to be happy",
      subtitle: "Free yourself",
      position: "bottom"
    },
    {
      text: "All girls are the same",
      subtitle: "But you're different",
      position: "top"
    },
    {
      text: "Righteous",
      subtitle: "I ain't living right",
      position: "center"
    },
    {
      text: "Life's not fair",
      subtitle: "But I'm still here",
      position: "bottom"
    },
    {
      text: "Graduation",
      subtitle: "Moving on to better things",
      position: "top"
    },
    {
      text: "Armed and dangerous",
      subtitle: "Love is a weapon",
      position: "center"
    }
  ]

  useEffect(() => {
    // Show first lyric after 10 seconds
    const initialTimer = setTimeout(() => {
      setIsVisible(true)
    }, 10000)

    // Cycle through lyrics
    const interval = setInterval(() => {
      setIsVisible(false)

      setTimeout(() => {
        setCurrentLyric((prev) => (prev + 1) % lyrics.length)
        setIsVisible(true)
      }, 1000)
    }, 15000) // New lyric every 15 seconds

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [lyrics.length])

  const currentLyricData = lyrics[currentLyric]

  const getPositionClasses = (position: string) => {
    switch (position) {
      case 'top':
        return 'top-20 left-1/2 transform -translate-x-1/2'
      case 'center':
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
      case 'bottom':
        return 'bottom-20 left-1/2 transform -translate-x-1/2'
      default:
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`fixed z-20 pointer-events-none ${getPositionClasses(currentLyricData.position)}`}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{
            duration: 1.5,
            ease: "easeOut"
          }}
        >
          <div className="text-center max-w-2xl px-8">
            {/* Main lyric text */}
            <motion.h2
              className="text-4xl md:text-6xl font-bold text-white mb-4 font-mono"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 1 }}
              style={{
                textShadow: '0 0 30px rgba(106, 13, 173, 0.8), 0 0 60px rgba(106, 13, 173, 0.4)'
              }}
            >
              {currentLyricData.text}
            </motion.h2>

            {/* Subtitle */}
            <motion.p
              className="text-xl md:text-2xl text-accent/80"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 1 }}
            >
              {currentLyricData.subtitle}
            </motion.p>

            {/* Decorative elements */}
            <motion.div
              className="flex items-center justify-center gap-4 mt-6"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.3, duration: 0.8 }}
            >
              <motion.div
                className="w-12 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent"
                animate={{
                  width: [0, 48, 48, 0]
                }}
                transition={{
                  duration: 2,
                  delay: 1.5,
                  ease: "easeInOut"
                }}
              />

              <motion.div
                className="text-2xl font-bold text-accent"
                animate={{
                  opacity: [0.5, 1, 0.5],
                  scale: [1, 1.2, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                999
              </motion.div>

              <motion.div
                className="w-12 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent"
                animate={{
                  width: [0, 48, 48, 0]
                }}
                transition={{
                  duration: 2,
                  delay: 1.5,
                  ease: "easeInOut"
                }}
              />
            </motion.div>

            {/* Floating particles around text */}
            <div className="absolute inset-0">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-accent/40 rounded-full"
                  style={{
                    left: `${20 + Math.random() * 60}%`,
                    top: `${20 + Math.random() * 60}%`
                  }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                    y: [0, -20, 0]
                  }}
                  transition={{
                    duration: 3,
                    delay: 1 + i * 0.2,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>

            {/* Background glow effect */}
            <motion.div
              className="absolute inset-0 -z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 2 }}
            >
              <div
                className="w-full h-full rounded-3xl"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(106, 13, 173, 0.1) 0%, transparent 70%)',
                  filter: 'blur(20px)'
                }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}