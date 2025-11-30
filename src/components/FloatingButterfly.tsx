'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface Butterfly {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
}

export default function FloatingButterfly() {
  const [butterflies, setButterflies] = useState<Butterfly[]>([])

  useEffect(() => {
    // Create butterflies with random positions and properties
    const newButterflies: Butterfly[] = []
    for (let i = 0; i < 8; i++) {
      newButterflies.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 20 + 15,
        duration: Math.random() * 10 + 8,
        delay: Math.random() * 5
      })
    }
    setButterflies(newButterflies)
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {butterflies.map((butterfly) => (
        <motion.div
          key={butterfly.id}
          className="absolute"
          style={{
            left: `${butterfly.x}%`,
            top: `${butterfly.y}%`,
          }}
          animate={{
            x: [0, 100, -50, 150, 0],
            y: [0, -80, 120, -60, 0],
            rotate: [0, 180, 360, 180, 0],
          }}
          transition={{
            duration: butterfly.duration,
            delay: butterfly.delay,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <svg
            width={butterfly.size}
            height={butterfly.size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="opacity-20 hover:opacity-40 transition-opacity"
          >
            <defs>
              <linearGradient id={`gradient-${butterfly.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6a0dad" />
                <stop offset="50%" stopColor="#39ff14" />
                <stop offset="100%" stopColor="#ffff00" />
              </linearGradient>
            </defs>

            {/* Butterfly Wings */}
            <path
              d="M12 2C12 2 8 6 8 12C8 18 12 22 12 22C12 22 16 18 16 12C16 6 12 2 12 2Z"
              fill={`url(#gradient-${butterfly.id})`}
              opacity="0.7"
            />
            <path
              d="M12 2C12 2 6 4 4 8C2 12 6 16 12 12C18 16 22 12 20 8C18 4 12 2 12 2Z"
              fill={`url(#gradient-${butterfly.id})`}
              opacity="0.5"
            />
            <path
              d="M12 12C12 12 6 14 4 18C2 22 6 24 12 20C18 24 22 22 20 18C18 14 12 12 12 12Z"
              fill={`url(#gradient-${butterfly.id})`}
              opacity="0.6"
            />

            {/* Butterfly Body */}
            <line x1="12" y1="2" x2="12" y2="22" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" />

            {/* Antennae */}
            <path d="M12 2C10 0 8 1 9 3" stroke="#39ff14" strokeWidth="1" fill="none" />
            <path d="M12 2C14 0 16 1 15 3" stroke="#39ff14" strokeWidth="1" fill="none" />
          </svg>
        </motion.div>
      ))}
    </div>
  )
}

// Additional butterfly component for memorial significance
export function MemorialButterfly() {
  return (
    <motion.div
      className="fixed bottom-10 right-10 z-50"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 2, duration: 1 }}
    >
      <motion.div
        animate={{
          y: [0, -10, 0],
          rotate: [0, 5, -5, 0]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="cursor-pointer"
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="hover:scale-110 transition-transform"
        >
          <defs>
            <linearGradient id="memorial-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6a0dad" />
              <stop offset="100%" stopColor="#39ff14" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <path
            d="M12 2C12 2 8 6 8 12C8 18 12 22 12 22C12 22 16 18 16 12C16 6 12 2 12 2Z"
            fill="url(#memorial-gradient)"
            filter="url(#glow)"
          />
          <path
            d="M12 2C12 2 6 4 4 8C2 12 6 16 12 12C18 16 22 12 20 8C18 4 12 2 12 2Z"
            fill="url(#memorial-gradient)"
            opacity="0.8"
            filter="url(#glow)"
          />
          <path
            d="M12 12C12 12 6 14 4 18C2 22 6 24 12 20C18 24 22 22 20 18C18 14 12 12 12 12Z"
            fill="url(#memorial-gradient)"
            opacity="0.9"
            filter="url(#glow)"
          />

          <line x1="12" y1="2" x2="12" y2="22" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" filter="url(#glow)" />
        </svg>
      </motion.div>
    </motion.div>
  )
}