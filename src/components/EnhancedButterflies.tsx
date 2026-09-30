'use client'

import { motion, AnimatePresence, TargetAndTransition, Transition } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'

const GRAVITY_FLING_MESSAGES = [
  "Flings don't count in gravity mode 😤",
  "Nice try — gravity's not sharing credit",
  "That toss doesn't count. Rules are rules 🦋",
  "Gravity mode flings: for fun only, no clout",
  "Sorry, that one's off the books"
]

interface Butterfly {
  id: number
  x: number
  y: number
  rotation: number
  scale: number
  color: string
  hex: string
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

const BUTTERFLY_HEX: Record<string, string> = {
  'text-purple-400/60': '#c084fc',
  'text-blue-400/60': '#60a5fa',
  'text-green-400/60': '#4ade80',
  'text-pink-400/60': '#f472b6',
  'text-yellow-400/60': '#facc15',
  'text-accent/60': '#39ff14'
}

// Soft blurred glow sitting behind a butterfly/number -- the neon "pop"
// without changing the shape itself.
function Glow({ color, size }: { color: string; size: number }) {
  return (
    <div
      className="absolute inset-0 -z-10 rounded-full"
      style={{
        background: color,
        filter: `blur(${size * 0.4}px)`,
        opacity: 0.55
      }}
    />
  )
}

function ButterflySvg() {
  return (
    <motion.svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      className="drop-shadow-[0_0_6px_currentColor]"
      animate={{ rotateY: [0, 20, -20, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.line
        x1="20" y1="5" x2="20" y2="35"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.path
        d="M20,15 Q8,8 5,15 Q8,22 20,20"
        fill="currentColor" fillOpacity="0.75" stroke="currentColor" strokeWidth="1.2"
        animate={{ d: ["M20,15 Q8,8 5,15 Q8,22 20,20", "M20,15 Q6,6 3,15 Q6,24 20,20", "M20,15 Q8,8 5,15 Q8,22 20,20"] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.path
        d="M20,15 Q32,8 35,15 Q32,22 20,20"
        fill="currentColor" fillOpacity="0.75" stroke="currentColor" strokeWidth="1.2"
        animate={{ d: ["M20,15 Q32,8 35,15 Q32,22 20,20", "M20,15 Q34,6 37,15 Q34,24 20,20", "M20,15 Q32,8 35,15 Q32,22 20,20"] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.path
        d="M20,20 Q12,25 8,30 Q12,35 20,30"
        fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.2"
        animate={{ d: ["M20,20 Q12,25 8,30 Q12,35 20,30", "M20,20 Q10,27 6,32 Q10,37 20,30", "M20,20 Q12,25 8,30 Q12,35 20,30"] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
      />
      <motion.path
        d="M20,20 Q28,25 32,30 Q28,35 20,30"
        fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.2"
        animate={{ d: ["M20,20 Q28,25 32,30 Q28,35 20,30", "M20,20 Q30,27 34,32 Q30,37 20,30", "M20,20 Q28,25 32,30 Q28,35 20,30"] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
      />
      <motion.g animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
        <line x1="18" y1="8" x2="16" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="22" y1="8" x2="24" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <circle cx="16" cy="4" r="1" fill="currentColor" />
        <circle cx="24" cy="4" r="1" fill="currentColor" />
      </motion.g>
    </motion.svg>
  )
}

// Normal (non-gravity) mode: scripted flight path, grab-and-fling via
// framer-motion's own drag + momentum.
function FloatingItem({
  autoAnimate,
  transition,
  initial,
  className,
  children,
  onFling
}: {
  autoAnimate: TargetAndTransition
  transition: Transition
  initial: TargetAndTransition
  className?: string
  children: React.ReactNode
  onFling: () => void
}) {
  const [grabbed, setGrabbed] = useState(false)

  return (
    <motion.div
      className={`pointer-events-auto cursor-grab active:cursor-grabbing ${className || ''}`}
      initial={initial}
      animate={grabbed ? undefined : autoAnimate}
      transition={grabbed ? { type: 'spring', stiffness: 300, damping: 20 } : transition}
      drag
      dragMomentum
      dragElastic={0.2}
      whileDrag={{ scale: 1.3 }}
      onDragStart={() => setGrabbed(true)}
      onDragEnd={onFling}
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
  const [flingCount, setFlingCount] = useState<number | null>(null)
  const [gravityMessage, setGravityMessage] = useState<string | null>(null)

  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const gravityVectorRef = useRef({ x: 0, y: 1 })
  const gravityMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)

    const newButterflies: Butterfly[] = Array.from({ length: 12 }, (_, i) => {
      const color = [
        'text-purple-400/60',
        'text-blue-400/60',
        'text-green-400/60',
        'text-pink-400/60',
        'text-yellow-400/60',
        'text-accent/60'
      ][Math.floor(Math.random() * 6)]
      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        rotation: Math.random() * 360,
        scale: 0.8 + Math.random() * 0.7,
        color,
        hex: BUTTERFLY_HEX[color],
        delay: Math.random() * 10,
        duration: 15 + Math.random() * 10
      }
    })
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

    fetch('/api/flings')
      .then(r => r.json())
      .then(d => setFlingCount(typeof d.count === 'number' ? d.count : 0))
      .catch(() => setFlingCount(0))
  }, [])

  const registerFling = () => {
    setFlingCount(c => (c ?? 0) + 1)
    fetch('/api/flings', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (typeof d.count === 'number') setFlingCount(d.count) })
      .catch(() => {})
  }

  const showGravityFlingMessage = () => {
    if (gravityMessageTimeoutRef.current) clearTimeout(gravityMessageTimeoutRef.current)
    const msg = GRAVITY_FLING_MESSAGES[Math.floor(Math.random() * GRAVITY_FLING_MESSAGES.length)]
    setGravityMessage(msg)
    gravityMessageTimeoutRef.current = setTimeout(() => setGravityMessage(null), 2200)
  }

  // Continuously track device tilt while gravity is on, so flipping the
  // phone flips which way things fall in real time (not just a snapshot).
  useEffect(() => {
    if (!gravityOn || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      return
    }
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return
      gravityVectorRef.current = {
        x: Math.max(-1, Math.min(1, e.gamma / 45)),
        y: Math.max(-1, Math.min(1, e.beta / 45)) || 1
      }
    }
    window.addEventListener('deviceorientation', handleOrientation)
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [gravityOn])

  // Real physics: bodies fall, bounce off the floor/walls/each other, and
  // can be grabbed and flung. Dragging is handled with our own pointer
  // listeners scoped to each individual element -- NOT Matter's built-in
  // Mouse/MouseConstraint bound to the document, which was found to call
  // preventDefault() on touch events globally and block every tap on the
  // page (including the gravity toggle button itself) while active.
  useEffect(() => {
    if (!gravityOn) return

    const width = window.innerWidth
    const height = window.innerHeight
    const wallThickness = 80

    const engine = Matter.Engine.create()
    engine.gravity.x = 0
    engine.gravity.y = 1

    const walls = [
      Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width * 2, wallThickness, { isStatic: true }),
      Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width * 2, wallThickness, { isStatic: true }),
      Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true }),
      Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true })
    ]
    Matter.World.add(engine.world, walls)

    const tracked: { id: string; body: Matter.Body; radius: number }[] = []
    const cleanupFns: (() => void)[] = []

    itemRefs.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect()
      const radius = Math.max(rect.width, rect.height) / 2 || 20
      const body = Matter.Bodies.circle(rect.left + radius, rect.top + radius, radius, {
        restitution: 0.65,
        friction: 0.15,
        frictionAir: 0.008,
        density: 0.0012
      })
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.15)
      Matter.World.add(engine.world, body)
      tracked.push({ id, body, radius })

      // Manual kinematic drag: while held, the body follows the pointer
      // directly (frozen as static so gravity doesn't fight it); on
      // release, it's handed a velocity based on the recent pointer
      // movement so it actually flies off like a real throw.
      let dragging = false
      let lastX = 0, lastY = 0, lastTime = 0, vx = 0, vy = 0

      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return
        e.preventDefault()
        const now = performance.now()
        const dt = Math.max(now - lastTime, 1)
        vx = (e.clientX - lastX) / dt
        vy = (e.clientY - lastY) / dt
        Matter.Body.setPosition(body, { x: e.clientX, y: e.clientY })
        lastX = e.clientX
        lastY = e.clientY
        lastTime = now
      }

      const onPointerUp = () => {
        if (!dragging) return
        dragging = false
        Matter.Body.setStatic(body, false)
        Matter.Body.setVelocity(body, { x: vx * 16, y: vy * 16 })
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        showGravityFlingMessage()
      }

      const onPointerDown = (e: PointerEvent) => {
        e.preventDefault()
        dragging = true
        lastX = e.clientX
        lastY = e.clientY
        lastTime = performance.now()
        vx = 0
        vy = 0
        Matter.Body.setStatic(body, true)
        window.addEventListener('pointermove', onPointerMove, { passive: false })
        window.addEventListener('pointerup', onPointerUp, { passive: false })
      }

      el.style.touchAction = 'none'
      el.addEventListener('pointerdown', onPointerDown, { passive: false })
      cleanupFns.push(() => {
        el.removeEventListener('pointerdown', onPointerDown)
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
      })
    })

    let rafId: number
    let lastTime = performance.now()

    const loop = (time: number) => {
      const delta = Math.min(time - lastTime, 33)
      lastTime = time

      engine.gravity.x = gravityVectorRef.current.x
      engine.gravity.y = gravityVectorRef.current.y

      Matter.Engine.update(engine, delta)

      tracked.forEach(({ id, body, radius }) => {
        const el = itemRefs.current.get(id)
        if (el) {
          el.style.transform = `translate(${body.position.x - radius}px, ${body.position.y - radius}px) rotate(${body.angle}rad)`
        }
      })

      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      cleanupFns.forEach(fn => fn())
      Matter.World.clear(engine.world, false)
      Matter.Engine.clear(engine)
    }
  }, [gravityOn])

  const handleToggleGravity = async () => {
    const DeviceOrientationEventAny = (window as any).DeviceOrientationEvent
    if (!gravityOn && DeviceOrientationEventAny && typeof DeviceOrientationEventAny.requestPermission === 'function') {
      try {
        await DeviceOrientationEventAny.requestPermission()
      } catch {
        // Denied or unsupported -- gravity still works, just always falls down.
      }
    }
    setGravityOn(prev => !prev)
  }

  if (!mounted) return null

  return (
    <>
      {/* Gravity toggle + fling counter */}
      <div className="fixed bottom-6 left-6 z-[46] pointer-events-auto flex items-center gap-2">
        <button
          onClick={handleToggleGravity}
          className="flex items-center gap-2 rounded-full border border-accent/50 bg-black/80 px-4 py-3 text-sm font-medium text-white backdrop-blur-md transition-colors hover:border-accent"
          title="Toggle real gravity physics for the floating butterflies and 999s"
        >
          <motion.span animate={{ rotate: gravityOn ? 180 : 0 }} transition={{ duration: 0.3 }}>
            🦋
          </motion.span>
          Gravity {gravityOn ? 'On' : 'Off'}
        </button>
        {flingCount !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-full border border-accent/30 bg-black/80 px-3 py-3 text-xs font-mono text-accent backdrop-blur-md"
            title="Total butterflies/999s flung by everyone"
          >
            {flingCount.toLocaleString()} flung
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {gravityMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed bottom-24 left-6 z-[46] pointer-events-none max-w-[240px] rounded-lg border border-accent/40 bg-black/90 px-3 py-2 text-xs text-white"
          >
            {gravityMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* z-[45]: must sit above the page's content sections (z-40) so the
          floating elements are actually visible/grabbable over content. */}
      <div className="fixed inset-0 pointer-events-none z-[45] overflow-hidden">
        {butterflies.map((butterfly) =>
          gravityOn ? (
            <div
              key={`grav-b-${butterfly.id}`}
              ref={(el) => {
                if (el) itemRefs.current.set(`b-${butterfly.id}`, el)
                else itemRefs.current.delete(`b-${butterfly.id}`)
              }}
              className={`absolute top-0 left-0 pointer-events-auto cursor-grab active:cursor-grabbing ${butterfly.color}`}
              style={{ transform: `translate(${butterfly.x}vw, ${butterfly.y}vh)` }}
            >
              <Glow color={butterfly.hex} size={40} />
              <ButterflySvg />
            </div>
          ) : (
            <FloatingItem
              key={butterfly.id}
              className={butterfly.color}
              onFling={registerFling}
              initial={{
                x: `${butterfly.x}vw`, y: `${butterfly.y}vh`,
                rotate: butterfly.rotation, scale: 0, opacity: 0
              }}
              autoAnimate={{
                x: [`${butterfly.x}vw`, `${(butterfly.x + 30) % 100}vw`, `${(butterfly.x - 20) % 100}vw`, `${butterfly.x}vw`],
                y: [`${butterfly.y}vh`, `${(butterfly.y - 20) % 100}vh`, `${(butterfly.y + 15) % 100}vh`, `${butterfly.y}vh`],
                rotate: [butterfly.rotation, butterfly.rotation + 180, butterfly.rotation + 360],
                scale: [0, butterfly.scale, butterfly.scale, 0],
                opacity: [0, 0.85, 0.85, 0]
              }}
              transition={{ duration: butterfly.duration, delay: butterfly.delay, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="relative">
                <Glow color={butterfly.hex} size={40} />
                <ButterflySvg />
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                >
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 bg-current rounded-full"
                      style={{ left: `${15 + i * 8}px`, top: `${20 + i * 4}px` }}
                      animate={{ scale: [0, 1, 0], opacity: [0, 0.8, 0] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </motion.div>
              </div>
            </FloatingItem>
          )
        )}

        {numbers.map((num) =>
          gravityOn ? (
            <div
              key={`grav-n-${num.id}`}
              ref={(el) => {
                if (el) itemRefs.current.set(`n-${num.id}`, el)
                else itemRefs.current.delete(`n-${num.id}`)
              }}
              className="absolute top-0 left-0 pointer-events-auto cursor-grab active:cursor-grabbing font-mono font-bold select-none"
              style={{ transform: `translate(${num.x}vw, ${num.y}vh)` }}
            >
              <Glow color={num.color} size={num.size} />
              <span style={{ fontSize: num.size, color: num.color, textShadow: `0 0 18px ${num.color}, 0 0 6px ${num.color}` }}>
                999
              </span>
            </div>
          ) : (
            <FloatingItem
              key={`num-${num.id}`}
              className="font-mono font-bold select-none"
              onFling={registerFling}
              initial={{ x: `${num.x}vw`, y: `${num.y}vh`, opacity: 0, scale: 0 }}
              autoAnimate={{
                x: [`${num.x}vw`, `${(num.x + 25) % 100}vw`, `${(num.x - 15) % 100}vw`, `${num.x}vw`],
                y: [`${num.y}vh`, `${(num.y - 15) % 100}vh`, `${(num.y + 20) % 100}vh`, `${num.y}vh`],
                opacity: [0, 0.55, 0.55, 0],
                scale: [0, 1, 1, 0]
              }}
              transition={{ duration: num.duration, delay: num.delay, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="relative">
                <Glow color={num.color} size={num.size} />
                <span style={{ fontSize: num.size, color: num.color, textShadow: `0 0 18px ${num.color}, 0 0 6px ${num.color}` }}>
                  999
                </span>
              </div>
            </FloatingItem>
          )
        )}
      </div>
    </>
  )
}
