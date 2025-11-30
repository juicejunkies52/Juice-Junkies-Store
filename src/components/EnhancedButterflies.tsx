'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface Butterfly {
  id: number
  x: number
  y: number
  rotation: number
  scale: number
  color: string
  delay: number
  duration: number
}

export default function EnhancedButterflies() {
  const [butterflies, setButterflies] = useState<Butterfly[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Create random butterflies
    const newButterflies: Butterfly[] = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      rotation: Math.random() * 360,
      scale: 0.8 + Math.random() * 0.7,
      color: [
        'text-purple-400/60',
        'text-blue-400/60',
        'text-green-400/60',
        'text-pink-400/60',
        'text-yellow-400/60',
        'text-accent/60'
      ][Math.floor(Math.random() * 6)],
      delay: Math.random() * 10,
      duration: 15 + Math.random() * 10
    }))

    setButterflies(newButterflies)
  }, [])

  if (!mounted) return null

  const butterflyPaths = {
    path1: "M0,0 Q25,-20 50,0 Q75,20 100,0 Q125,-15 150,5 Q175,25 200,10",
    path2: "M0,0 Q-25,30 -50,10 Q-75,-20 -100,0 Q-125,25 -150,-5 Q-175,-30 -200,-10",
    path3: "M0,0 Q30,40 60,20 Q90,-30 120,10 Q150,50 180,30 Q210,-20 240,0"
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {butterflies.map((butterfly) => (
        <motion.div
          key={butterfly.id}
          className={`absolute ${butterfly.color}`}
          initial={{
            x: `${butterfly.x}vw`,
            y: `${butterfly.y}vh`,
            rotate: butterfly.rotation,
            scale: 0,
            opacity: 0
          }}
          animate={{
            x: [
              `${butterfly.x}vw`,
              `${(butterfly.x + 30) % 100}vw`,
              `${(butterfly.x - 20) % 100}vw`,
              `${butterfly.x}vw`
            ],
            y: [
              `${butterfly.y}vh`,
              `${(butterfly.y - 20) % 100}vh`,
              `${(butterfly.y + 15) % 100}vh`,
              `${butterfly.y}vh`
            ],
            rotate: [
              butterfly.rotation,
              butterfly.rotation + 180,
              butterfly.rotation + 360
            ],
            scale: [0, butterfly.scale, butterfly.scale, 0],
            opacity: [0, 0.8, 0.8, 0]
          }}
          transition={{
            duration: butterfly.duration,
            delay: butterfly.delay,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Butterfly SVG */}
          <motion.svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            className="drop-shadow-lg"
            animate={{
              rotateY: [0, 20, -20, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {/* Body */}
            <motion.line
              x1="20"
              y1="5"
              x2="20"
              y2="35"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              animate={{
                opacity: [0.6, 1, 0.6]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Left Wing Top */}
            <motion.path
              d="M20,15 Q8,8 5,15 Q8,22 20,20"
              fill="currentColor"
              fillOpacity="0.7"
              stroke="currentColor"
              strokeWidth="1"
              animate={{
                d: [
                  "M20,15 Q8,8 5,15 Q8,22 20,20",
                  "M20,15 Q6,6 3,15 Q6,24 20,20",
                  "M20,15 Q8,8 5,15 Q8,22 20,20"
                ]
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Right Wing Top */}
            <motion.path
              d="M20,15 Q32,8 35,15 Q32,22 20,20"
              fill="currentColor"
              fillOpacity="0.7"
              stroke="currentColor"
              strokeWidth="1"
              animate={{
                d: [
                  "M20,15 Q32,8 35,15 Q32,22 20,20",
                  "M20,15 Q34,6 37,15 Q34,24 20,20",
                  "M20,15 Q32,8 35,15 Q32,22 20,20"
                ]
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Left Wing Bottom */}
            <motion.path
              d="M20,20 Q12,25 8,30 Q12,35 20,30"
              fill="currentColor"
              fillOpacity="0.5"
              stroke="currentColor"
              strokeWidth="1"
              animate={{
                d: [
                  "M20,20 Q12,25 8,30 Q12,35 20,30",
                  "M20,20 Q10,27 6,32 Q10,37 20,30",
                  "M20,20 Q12,25 8,30 Q12,35 20,30"
                ]
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.1
              }}
            />

            {/* Right Wing Bottom */}
            <motion.path
              d="M20,20 Q28,25 32,30 Q28,35 20,30"
              fill="currentColor"
              fillOpacity="0.5"
              stroke="currentColor"
              strokeWidth="1"
              animate={{
                d: [
                  "M20,20 Q28,25 32,30 Q28,35 20,30",
                  "M20,20 Q30,27 34,32 Q30,37 20,30",
                  "M20,20 Q28,25 32,30 Q28,35 20,30"
                ]
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.1
              }}
            />

            {/* Antennae */}
            <motion.g
              animate={{
                rotate: [0, 5, -5, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <line x1="18" y1="8" x2="16" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="22" y1="8" x2="24" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <circle cx="16" cy="4" r="1" fill="currentColor" />
              <circle cx="24" cy="4" r="1" fill="currentColor" />
            </motion.g>
          </motion.svg>

          {/* Sparkle trail */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5
            }}
          >
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-current rounded-full"
                style={{
                  left: `${15 + i * 8}px`,
                  top: `${20 + i * 4}px`
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 0.8, 0]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      ))}

      {/* Special 999 Butterfly */}
      <motion.div
        className="absolute text-accent/80"
        initial={{ x: '-10%', y: '50%', scale: 0, opacity: 0 }}
        animate={{
          x: ['110%', '50%', '110%'],
          y: ['50%', '30%', '70%', '50%'],
          scale: [0, 1.5, 1.5, 0],
          opacity: [0, 1, 1, 0],
          rotate: [0, 360]
        }}
        transition={{
          duration: 20,
          delay: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <div className="relative">
          <motion.svg
            width="60"
            height="60"
            viewBox="0 0 60 60"
            className="drop-shadow-2xl"
          >
            {/* Enhanced butterfly for special 999 appearance */}
            <motion.path
              d="M30,25 Q15,10 8,20 Q15,35 30,30 Q45,10 52,20 Q45,35 30,30"
              fill="currentColor"
              fillOpacity="0.8"
              stroke="currentColor"
              strokeWidth="2"
              animate={{
                fillOpacity: [0.8, 1, 0.8]
              }}
              transition={{
                duration: 2,
                repeat: Infinity
              }}
            />
            <line x1="30" y1="10" x2="30" y2="50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </motion.svg>

          {/* 999 text overlay */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center text-black font-bold text-xs"
            animate={{
              opacity: [0.7, 1, 0.7]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity
            }}
          >
            999
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}