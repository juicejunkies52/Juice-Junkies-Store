'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Clock, Zap, Star, AlertTriangle } from 'lucide-react'
import EarlyAccessModal from './EarlyAccessModal'

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export default function LimitedDropBanner() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [isVisible, setIsVisible] = useState(true)
  const [showEarlyAccessModal, setShowEarlyAccessModal] = useState(false)

  // Set countdown to 7 days from now
  const dropDate = new Date()
  dropDate.setDate(dropDate.getDate() + 7)

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const distance = dropDate.getTime() - now

      if (distance < 0) {
        clearInterval(timer)
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24))
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      setTimeLeft({ days, hours, minutes, seconds })
    }, 1000)

    return () => clearInterval(timer)
  }, [dropDate])

  if (!isVisible) return null

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-900/90 via-purple-900/90 to-red-900/90 backdrop-blur-md border-b border-red-500/50"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 2, duration: 0.8, type: "spring" }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <motion.div
            className="flex items-center gap-4"
            animate={{
              scale: [1, 1.02, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {/* Alert Icon */}
            <motion.div
              animate={{
                rotate: [0, 10, -10, 0]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </motion.div>

            {/* Drop Info */}
            <div>
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                EXCLUSIVE 999 ANNIVERSARY DROP
              </h3>
              <p className="text-gray-300 text-sm">
                Limited edition memorial collection • Only 999 pieces available
              </p>
            </div>
          </motion.div>

          {/* Countdown */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-accent" />
              <div className="flex items-center gap-3">
                {[
                  { label: 'DAYS', value: timeLeft.days },
                  { label: 'HOURS', value: timeLeft.hours },
                  { label: 'MIN', value: timeLeft.minutes },
                  { label: 'SEC', value: timeLeft.seconds }
                ].map((item, index) => (
                  <div key={item.label} className="text-center">
                    <motion.div
                      className="bg-black/50 rounded-lg px-3 py-2 min-w-[50px]"
                      animate={{
                        backgroundColor: item.label === 'SEC' ?
                          ['rgba(0,0,0,0.5)', 'rgba(106,13,173,0.3)', 'rgba(0,0,0,0.5)'] :
                          'rgba(0,0,0,0.5)'
                      }}
                      transition={{
                        duration: 1,
                        repeat: item.label === 'SEC' ? Infinity : 0
                      }}
                    >
                      <span className="text-xl font-bold text-white font-mono">
                        {item.value.toString().padStart(2, '0')}
                      </span>
                    </motion.div>
                    <span className="text-xs text-gray-400 mt-1 block">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <motion.button
              className="btn-primary px-6 py-3 flex items-center gap-2 text-sm font-semibold neon-glow"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowEarlyAccessModal(true)}
              animate={{
                boxShadow: [
                  '0 0 20px rgba(106,13,173,0.5)',
                  '0 0 40px rgba(106,13,173,0.8)',
                  '0 0 20px rgba(106,13,173,0.5)'
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Star className="w-4 h-4" />
              GET EARLY ACCESS
            </motion.button>

            {/* Close Button */}
            <motion.button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-white transition-colors p-1"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              ✕
            </motion.button>
          </div>
        </div>

        {/* Progress Bar */}
        <motion.div
          className="mt-4 h-1 bg-gray-800 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 via-accent to-green-400"
            initial={{ width: '0%' }}
            animate={{ width: '67%' }} // Simulate 67% sold
            transition={{ delay: 1.5, duration: 2, ease: "easeOut" }}
          />
        </motion.div>

        <motion.div
          className="flex justify-between items-center mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <span className="text-xs text-gray-400">
            667 of 999 claimed
          </span>
          <span className="text-xs text-red-400 font-semibold">
            332 remaining
          </span>
        </motion.div>
      </div>

      {/* Floating sparkles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-yellow-400 rounded-full"
            style={{
              left: `${10 + i * 15}%`,
              top: `${20 + Math.random() * 60}%`
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
              y: [0, -10, 0]
            }}
            transition={{
              duration: 2,
              delay: i * 0.3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Early Access Modal */}
      <EarlyAccessModal
        isOpen={showEarlyAccessModal}
        onClose={() => setShowEarlyAccessModal(false)}
      />
    </motion.div>
  )
}