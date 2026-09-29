'use client'

import { motion, TargetAndTransition, Transition } from 'framer-motion'
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

interface FloatingNumber {
  id: number
  x: number
  y: number
  size: number
  color: string
  delay: number
  duration: number
}

// Wraps a floating element with three modes:
// - normal: flies its scripted auto-animated path
// - grabbed: dragged by the user; framer-motion's drag momentum takes over
//   and the scripted path stops for good (no snap-back), same as a fling
// - gravity: falls toward whichever edge is "down" (see the toggle button)
function Draggable({
  autoAnimate,
  transition,
  fallAnimate,
  fallTransition,
  gravityOn,
  initial,
  className,
  children
}: {
  autoAnimate: TargetAndTransition
  transition: Transition
  fallAnimate: TargetAndTransition
  fallTransition: Transition
  gravityOn: boolean
  initial: TargetAndTransition
  className?: string
  children: React.ReactNode
}) {
  const [grabbed, setGrabbed] = useState(false)

  // Re-arm normal floating+drag behavior each time gravity is switched off.
  useEffect(() => {
    if (gravityOn) setGrabbed(false)
  }, [gravityOn])

  const animate = gravityOn ? fallAnimate : grabbed ? undefined : autoAnimate
  const activeTransition = gravityOn
    ? fallTransition
    : grabbed
    ? { type: 'spring', stiffness: 300, damping: 20 }
    : transition

  return (
    <motion.div
      className={`pointer-events-auto cursor-grab active:cursor-grabbing ${className || ''}`}
      initial={initial}
      animate={animate}
      transition={activeTransition}
      drag={!gravityOn}
      dragMomentum
      dragElastic={0.2}
      whileDrag={{ scale: 1.3 }}
      onDragStart={() => setGrabbed(true)}
    >
      {children}
    </motion.div>
  )
}

export default function EnhancedButterflies() {
  const [butterflies, setButterflies] = useState<Butterfly[]>([])
  const [numbers, setNumbers] = useState<FloatingNumber[]>([])
  const [mounted, setMounted] = useState(false)
  const [gravityOn, setGravityOn] = useState(false)
  const [fallDirection, setFallDirection] = useState<'down' | 'up'>('down')

  useEffect(() => {
    setMounted(true)

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

    const newNumbers: FloatingNumber[] = Array.from({ length: 7 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 24 + Math.random() * 28,
      color: Math.random() > 0.5 ? '#6a0dad' : '#39ff14',
      delay: Math.random() * 8,
      duration: 18 + Math.random() * 12
    }))
    setNumbers(newNumbers)
  }, [])

  // While gravity is on, listen for device tilt so flipping the phone flips
  // which way things fall. Best-effort: not all browsers/devices expose
  // this, and iOS requires the permission prompt below.
  useEffect(() => {
    if (!gravityOn || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      return
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null) return
      setFallDirection(e.beta < 0 ? 'up' : 'down')
    }

    window.addEventListener('deviceorientation', handleOrientation)
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [gravityOn])

  const handleToggleGravity = async () => {
    // iOS 13+ requires this permission to be requested from a direct user
    // gesture -- this click is that gesture.
    const DeviceOrientationEventAny = (window as any).DeviceOrientationEvent
    if (!gravityOn && DeviceOrientationEventAny && typeof DeviceOrientationEventAny.requestPermission === 'function') {
      try {
        await DeviceOrientationEventAny.requestPermission()
      } catch {
        // Denied or unsupported -- gravity still works, it'll just always fall down.
      }
    }
    setGravityOn(prev => !prev)
  }

  if (!mounted) return null

  const fallTarget = fallDirection === 'down' ? '92vh' : '4vh'
  const spinDirection = fallDirection === 'down' ? 1 : -1
  const fallTransition: Transition = { duration: 1.5, ease: 'easeIn' }

  return (
    <>
      {/* Gravity toggle */}
      <button
        onClick={handleToggleGravity}
        className="fixed bottom-6 left-6 z-[46] pointer-events-auto flex items-center gap-2 rounded-full border border-accent/50 bg-black/80 px-4 py-3 text-sm font-medium text-white backdrop-blur-md transition-colors hover:border-accent"
        title="Toggle gravity for the floating butterflies and 999s"
      >
        <motion.span
          animate={{ rotate: gravityOn ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          🦋
        </motion.span>
        Gravity {gravityOn ? 'On' : 'Off'}
      </button>

      {/* z-[45]: must sit above the page's content sections (z-40) so the
          draggable elements are actually clickable wherever they overlap
          content, not just in the gaps between sections. */}
      <div className="fixed inset-0 pointer-events-none z-[45] overflow-hidden">
        {butterflies.map((butterfly) => (
          <Draggable
            key={butterfly.id}
            className={`absolute ${butterfly.color}`}
            gravityOn={gravityOn}
            initial={{
              x: `${butterfly.x}vw`,
              y: `${butterfly.y}vh`,
              rotate: butterfly.rotation,
              scale: 0,
              opacity: 0
            }}
            autoAnimate={{
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
              ease: 'easeInOut'
            }}
            fallAnimate={{
              y: fallTarget,
              rotate: butterfly.rotation + spinDirection * 720,
              scale: butterfly.scale,
              opacity: 0.8
            }}
            fallTransition={fallTransition}
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
          </Draggable>
        ))}

        {/* Floating grabbable 999s */}
        {numbers.map((num) => (
          <Draggable
            key={`num-${num.id}`}
            className="absolute font-bold select-none"
            gravityOn={gravityOn}
            initial={{
              x: `${num.x}vw`,
              y: `${num.y}vh`,
              opacity: 0,
              scale: 0
            }}
            autoAnimate={{
              x: [
                `${num.x}vw`,
                `${(num.x + 25) % 100}vw`,
                `${(num.x - 15) % 100}vw`,
                `${num.x}vw`
              ],
              y: [
                `${num.y}vh`,
                `${(num.y - 15) % 100}vh`,
                `${(num.y + 20) % 100}vh`,
                `${num.y}vh`
              ],
              opacity: [0, 0.5, 0.5, 0],
              scale: [0, 1, 1, 0]
            }}
            transition={{
              duration: num.duration,
              delay: num.delay,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            fallAnimate={{
              y: fallTarget,
              opacity: 0.5,
              scale: 1
            }}
            fallTransition={fallTransition}
          >
            <span
              style={{
                fontSize: num.size,
                color: num.color,
                textShadow: `0 0 15px ${num.color}, 0 0 5px ${num.color}`
              }}
            >
              999
            </span>
          </Draggable>
        ))}

        {/* Special 999 Butterfly */}
        <Draggable
          className="text-accent/80"
          gravityOn={gravityOn}
          initial={{ x: '-10%', y: '50%', scale: 0, opacity: 0 }}
          autoAnimate={{
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
          fallAnimate={{
            y: fallTarget,
            x: '50%',
            rotate: spinDirection * 720,
            scale: 1.5,
            opacity: 1
          }}
          fallTransition={fallTransition}
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
        </Draggable>
      </div>
    </>
  )
}
