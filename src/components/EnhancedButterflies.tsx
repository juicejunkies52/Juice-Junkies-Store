'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import SecretWall from './SecretWall'
import CreatureSvg from './CreatureSvg'
import CreatureCollection from './CreatureCollection'
import BackgroundCollection from './BackgroundCollection'
import GamesHub from './GamesHub'
import DestroyModeOverlay from './DestroyModeOverlay'
import { pickRandomCreature, getCreature, CREATURES } from '../../lib/creatures'
import { BACKGROUND_POOL } from '../../lib/backgrounds'
import { getVisitorId } from '../../lib/visitorId'
import { hasPurchasedLocally } from '../../lib/purchaseStatus'

const SECRET_HITS_NEEDED = 15

// Vague for everyone who hasn't bought anything yet -- an actual nudge
// toward the real mechanic for people who have, as a small reward for
// supporting the store instead of just guessing forever.
const VAGUE_HINT_MESSAGES = [
  "👀 There's more to this site than meets the eye...",
  "🦋 Some of these butterflies aren't just decoration...",
  "✨ 999 might unlock more than you think...",
  "🔍 Legends say a secret lives somewhere in the gravity..."
]
const EXPLICIT_HINT_MESSAGES = [
  "🔓 Psst -- turn on Gravity, grab a 999, and hold it still until a butterfly lands on it.",
  "🎮 Hint: balance a butterfly on a held 999 in Gravity mode, then toss it and catch it 15 times.",
  "🦋 You've earned this one: Gravity on → hold a 999 → let one land → bounce it 15 times."
]

interface RareCreature {
  uid: string
  type: string
  hex: string
  x: number
  y: number
}

interface Butterfly {
  id: number
  x: number
  y: number
  color: string
  hex: string
  delay: number
}

interface FloatingNumber {
  id: number
  x: number
  y: number
  size: number
  color: string
  delay: number
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
function Glow({ color, size, intensity = 0.55 }: { color: string; size: number; intensity?: number }) {
  return (
    <div
      data-glow
      className="absolute inset-0 -z-10 rounded-full"
      style={{
        background: color,
        filter: `blur(${size * 0.4}px)`,
        opacity: intensity
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

interface TrackedBody {
  id: string
  body: Matter.Body
  radius: number
  dragging: boolean
  wanderVX: number
  wanderVY: number
  nextWanderAt: number
}

const BRIGHTNESS_STORAGE_KEY = 'jj-butterfly-brightness'
const LAYER_STORAGE_KEY = 'jj-butterfly-layer-behind'

export default function EnhancedButterflies({ subtle = false }: { subtle?: boolean }) {
  // "subtle" only dims how visible the butterflies/999s are (opacity + glow
  // strength) for pages like the shop/home page where they'd otherwise
  // compete with content -- it never touches physics, drag, gravity, or
  // count, so interaction stays identical everywhere. brightness is a
  // visitor-chosen multiplier on top of that (persisted locally), for
  // anyone who wants them dimmer/brighter than the default.
  const [brightness, setBrightness] = useState(1)
  // z-[45] sits above page content (z-40) so butterflies are grabbable over
  // it; z-[1] sits above the animated background but behind every content
  // section, for anyone who'd rather they stay out of the way entirely.
  const [layerBehind, setLayerBehind] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const butterflyOpacity = (subtle ? 0.35 : 0.85) * brightness
  const numberOpacity = (subtle ? 0.2 : 0.55) * brightness
  const glowIntensity = (subtle ? 0.3 : 0.55) * brightness

  const [butterflies, setButterflies] = useState<Butterfly[]>([])
  const [numbers, setNumbers] = useState<FloatingNumber[]>([])
  const [mounted, setMounted] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [gravityOn, setGravityOn] = useState(false)
  const [flingCount, setFlingCount] = useState<number | null>(null)

  // Hidden easter egg: grab a 999, then land a butterfly on it (via
  // physics collisions) ten times to open the secret signature wall.
  // Discovery resets every visit -- no account system, just in-memory
  // state for the current session.
  const [secretFound, setSecretFound] = useState(false)
  const [secretWallOpen, setSecretWallOpen] = useState(false)
  const chosenNumberIdRef = useRef<string | null>(null)
  const hitCountRef = useRef(0)
  const discoveredEverRef = useRef(false)

  // Catch-and-collect v1: a rare creature occasionally spawns among the
  // regular butterflies/999s; flinging it "catches" it. No accounts --
  // persisted against an anonymous per-browser id (see lib/visitorId).
  const [rareCreature, setRareCreature] = useState<RareCreature | null>(null)
  const [caughtTypes, setCaughtTypes] = useState<string[]>([])
  const [catchToast, setCatchToast] = useState<string | null>(null)
  const [collectionOpen, setCollectionOpen] = useState(false)
  // Unlocked by fully destroying a Smash Juice Junkies session's hidden
  // background image -- see DestroyModeOverlay's onBackgroundUnlocked.
  const [unlockedBackgrounds, setUnlockedBackgrounds] = useState<string[]>([])
  const [backgroundCollectionOpen, setBackgroundCollectionOpen] = useState(false)
  const [gamesOpen, setGamesOpen] = useState(false)
  const [destroyModeActive, setDestroyModeActive] = useState(false)
  const [hideSeekActive, setHideSeekActive] = useState(false)
  const visitorIdRef = useRef('')
  const catchToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Occasional drifting message hinting that a mini-game exists. Anyone
  // who's actually bought something gets a real nudge toward how to find
  // it; everyone else just gets a vague tease and has to go looking.
  const [hintMessage, setHintMessage] = useState<{ id: number; text: string } | null>(null)
  const hasPurchasedRef = useRef(false)
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const gravityVectorRef = useRef({ x: 0, y: 1 })
  const gravityOnRef = useRef(false)
  const engineRef = useRef<Matter.Engine | null>(null)

  useEffect(() => {
    gravityOnRef.current = gravityOn
  }, [gravityOn])

  useEffect(() => {
    try {
      const storedBrightness = localStorage.getItem(BRIGHTNESS_STORAGE_KEY)
      if (storedBrightness) setBrightness(Math.min(1.6, Math.max(0, parseFloat(storedBrightness))))
      setLayerBehind(localStorage.getItem(LAYER_STORAGE_KEY) === 'true')
    } catch {
      // Private browsing or storage disabled -- defaults are fine.
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(BRIGHTNESS_STORAGE_KEY, String(brightness))
    } catch {}
  }, [brightness])

  useEffect(() => {
    try {
      localStorage.setItem(LAYER_STORAGE_KEY, String(layerBehind))
    } catch {}
  }, [layerBehind])

  useEffect(() => {
    setMounted(true)
    const revealTimer = setTimeout(() => setRevealed(true), 50)

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
        color,
        hex: BUTTERFLY_HEX[color],
        delay: Math.random() * 2
      }
    })
    setButterflies(newButterflies)

    const newNumbers: FloatingNumber[] = Array.from({ length: 7 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 24 + Math.random() * 28,
      color: Math.random() > 0.5 ? '#6a0dad' : '#39ff14',
      delay: Math.random() * 2
    }))
    setNumbers(newNumbers)

    fetch('/api/flings')
      .then(r => r.json())
      .then(d => setFlingCount(typeof d.count === 'number' ? d.count : 0))
      .catch(() => setFlingCount(0))

    const visitorId = getVisitorId()
    visitorIdRef.current = visitorId

    // Guest catches don't restore across visits -- only a real account's
    // collection persists, so creating one actually gets you something.
    // Still fine to catch things as a guest this session (and it's still
    // saved server-side against visitorId, so nothing's lost if they sign
    // up before reloading); it just won't be there if they just reload.
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.user) return
        fetch('/api/creatures/collection')
          .then(r => r.json())
          .then(cd => setCaughtTypes(Array.isArray(cd.caught) ? cd.caught : []))
        return fetch('/api/backgrounds/collection')
          .then(r => r.json())
          .then(bd => setUnlockedBackgrounds(Array.isArray(bd.unlocked) ? bd.unlocked : []))
      })
      .catch(() => {})

    hasPurchasedRef.current = hasPurchasedLocally()
    if (!hasPurchasedRef.current) {
      fetch('/api/orders/has-purchased')
        .then(r => r.json())
        .then(d => { if (d.hasPurchased) hasPurchasedRef.current = true })
        .catch(() => {})
    }

    return () => clearTimeout(revealTimer)
  }, [])

  // Occasionally drift a hint message across the screen -- a tease for
  // most people, a real clue for anyone who's actually bought something.
  useEffect(() => {
    if (!mounted) return
    const trySpawnHint = () => {
      setHintMessage((current) => {
        if (current) return current
        if (Math.random() > 0.4) return current
        const pool = hasPurchasedRef.current ? EXPLICIT_HINT_MESSAGES : VAGUE_HINT_MESSAGES
        const text = pool[Math.floor(Math.random() * pool.length)]
        return { id: Date.now(), text }
      })
    }
    const interval = setInterval(trySpawnHint, 120000)
    const firstTimer = setTimeout(trySpawnHint, 45000)
    return () => {
      clearInterval(interval)
      clearTimeout(firstTimer)
    }
  }, [mounted])

  useEffect(() => {
    if (!hintMessage) return
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current)
    hintTimeoutRef.current = setTimeout(() => setHintMessage(null), 13000)
    return () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current)
    }
  }, [hintMessage])

  // Rare creature spawn timer: every so often, if nothing is currently out
  // there to catch, roll a chance to spawn one somewhere on screen.
  useEffect(() => {
    if (!mounted) return
    const trySpawn = () => {
      setRareCreature((current) => {
        if (current) return current
        if (Math.random() > 0.35) return current
        const def = pickRandomCreature()
        return {
          uid: `rare-${Date.now()}`,
          type: def.type,
          hex: def.hex,
          x: 15 + Math.random() * 70,
          y: 15 + Math.random() * 60
        }
      })
    }
    const interval = setInterval(trySpawn, 60000)
    const firstTimer = setTimeout(trySpawn, 20000)
    return () => {
      clearInterval(interval)
      clearTimeout(firstTimer)
    }
  }, [mounted])

  const registerFling = () => {
    setFlingCount(c => (c ?? 0) + 1)
    fetch('/api/flings', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (typeof d.count === 'number') setFlingCount(d.count) })
      .catch(() => {})
  }

  // Landing enough bounces opens the wall every time -- the first time also
  // reveals the running bounce counter for the rest of this visit.
  const openSecretWall = () => {
    if (!discoveredEverRef.current) {
      discoveredEverRef.current = true
      setSecretFound(true)
    }
    setSecretWallOpen(true)
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

  // One persistent physics world for the whole lifetime of the component --
  // it used to be torn down and rebuilt every time gravity mode was
  // toggled, which reset every position/velocity and made switching feel
  // janky. Now gravity itself is just a value the loop reads each frame
  // (via gravityOnRef / gravityVectorRef), so toggling is seamless.
  //
  // In normal mode gravity is zero and idle items get a gentle "wander"
  // steering force so they still drift around on their own. Grabbing and
  // flinging one always uses the same real Matter constraint, so a fling
  // in EITHER mode bounces off the walls and bumps into other items --
  // it just settles back into a lazy drift after a couple seconds instead
  // of continuing to fall once gravity mode is off.
  useEffect(() => {
    if (butterflies.length === 0 || numbers.length === 0) return

    const width = window.innerWidth
    const height = window.innerHeight
    const wallThickness = 80

    const engine = Matter.Engine.create()
    engine.gravity.x = 0
    engine.gravity.y = 0
    engineRef.current = engine

    const walls = [
      Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width * 2, wallThickness, { isStatic: true }),
      Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width * 2, wallThickness, { isStatic: true }),
      Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true }),
      Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true })
    ]
    Matter.World.add(engine.world, walls)

    const tracked: TrackedBody[] = []
    const cleanupFns: (() => void)[] = []

    // Secret wall easter egg state: which butterfly (if any) has settled
    // into resting contact on the currently-held 999 -- only bounces from
    // THAT specific butterfly count, so scooping a fast-moving 999 through
    // a whole pile of butterflies doesn't rack up free hits.
    let balancedButterflyId: string | null = null
    let balanceContactSince: number | null = null
    let lastRelevantContactAt = performance.now()

    itemRefs.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect()
      const radius = Math.max(rect.width, rect.height) / 2 || 20
      const body = Matter.Bodies.circle(rect.left + radius, rect.top + radius, radius, {
        label: id,
        restitution: 0.65,
        friction: 0.15,
        frictionAir: 0.008,
        density: 0.0012
      })
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.15)
      const angle = Math.random() * Math.PI * 2
      const speed = 0.3 + Math.random() * 0.4
      Matter.Body.setVelocity(body, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed })
      Matter.World.add(engine.world, body)

      const trackedEntry: TrackedBody = {
        id,
        body,
        radius,
        dragging: false,
        wanderVX: Math.cos(angle) * speed,
        wanderVY: Math.sin(angle) * speed,
        nextWanderAt: 0
      }
      tracked.push(trackedEntry)

      // A real spring constraint pulling the body toward the pointer, the
      // same technique Matter's own MouseConstraint uses internally. The
      // body stays fully dynamic the whole time it's held, so it keeps
      // colliding normally -- it shoves other bodies out of the way as it's
      // dragged through them -- and releasing it just removes the
      // constraint, leaving whatever velocity the drag naturally produced
      // (a real "fling", not a manually-computed one).
      let activePointerId: number | null = null
      let constraint: Matter.Constraint | null = null

      const endDrag = () => {
        if (!trackedEntry.dragging) return
        trackedEntry.dragging = false
        activePointerId = null
        el.style.zIndex = ''
        if (constraint) {
          Matter.World.remove(engine.world, constraint)
          constraint = null
        }
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)
        registerFling()
      }

      const onPointerMove = (e: PointerEvent) => {
        if (!trackedEntry.dragging || e.pointerId !== activePointerId || !constraint) return
        e.preventDefault()
        constraint.pointA = { x: e.clientX, y: e.clientY }
      }

      const onPointerUp = (e: PointerEvent) => {
        if (e.pointerId !== activePointerId) return
        endDrag()
      }

      // Mobile browsers can cancel an in-progress touch (a system gesture,
      // a notification, scrolling heuristics kicking in) without ever
      // firing pointerup -- without this, that left the drag "stuck" with
      // its constraint and listeners still attached, which is exactly the
      // kind of works-sometimes flakiness only touch devices would hit.
      const onPointerCancel = (e: PointerEvent) => {
        if (e.pointerId !== activePointerId) return
        endDrag()
      }

      const onPointerDown = (e: PointerEvent) => {
        e.preventDefault()
        trackedEntry.dragging = true
        activePointerId = e.pointerId
        // Grabbing a 999 marks it as "the chosen one" for the secret wall
        // easter egg. Re-grabbing the SAME one keeps your progress (you're
        // allowed to catch it, lose it, and pick it back up); grabbing a
        // different 999 starts a fresh count on that one instead.
        if (id.startsWith('n-') && chosenNumberIdRef.current !== id) {
          chosenNumberIdRef.current = id
          hitCountRef.current = 0
          balancedButterflyId = null
          balanceContactSince = null
          isAirborne = false
        }
        // Bring the grabbed item above its neighbors -- helps both the
        // visual (it reads clearly as "the one you're holding") and
        // re-grabbing reliably once several items are piled together.
        el.style.zIndex = '10'
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          // Some browsers refuse capture on elements moved via transform --
          // harmless, drag still works via the window-level listeners.
        }
        constraint = Matter.Constraint.create({
          bodyB: body,
          pointA: { x: e.clientX, y: e.clientY },
          pointB: { x: 0, y: 0 },
          length: 0,
          // Strong enough to shove through a pile of other bodies rather
          // than getting overpowered by their collision resistance and
          // feeling like the grip broke -- 0.4 held fine in open space but
          // lost the fight against a cluster.
          stiffness: 0.85,
          damping: 0.25
        })
        Matter.World.add(engine.world, constraint)
        window.addEventListener('pointermove', onPointerMove, { passive: false })
        window.addEventListener('pointerup', onPointerUp, { passive: false })
        window.addEventListener('pointercancel', onPointerCancel, { passive: false })
      }

      el.style.touchAction = 'none'
      el.addEventListener('pointerdown', onPointerDown, { passive: false })
      cleanupFns.push(() => {
        el.removeEventListener('pointerdown', onPointerDown)
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)
        if (constraint) Matter.World.remove(engine.world, constraint)
      })
    })

    // Secret wall easter egg. Two phases:
    //  1. Balance -- hold a 999 nearly still until one specific butterfly
    //     settles into resting contact on it (not just grazing past).
    //  2. Bounce -- once balanced, each time THAT SAME butterfly separates
    //     from the 999 by a real distance (an actual toss, not a jitter)
    //     and then lands back on it, that's one hit. Falling back into the
    //     pile and drifting away instead of landing again resets you back
    //     to phase 1.
    const BALANCE_MS = 250
    const BALANCE_MAX_SPEED = 1.5
    const MIN_LAUNCH_DIST = 50 // px of separation beyond touching, not just instantaneous speed
    const REBALANCE_GAP_MS = 1500

    const recolorButterfly = (butterflyId: string) => {
      const el = itemRefs.current.get(butterflyId)
      if (!el) return
      const palette = Object.values(BUTTERFLY_HEX)
      const color = palette[Math.floor(Math.random() * palette.length)]
      el.style.color = color
      const glow = el.querySelector<HTMLElement>('[data-glow]')
      if (glow) glow.style.background = color
    }

    const findButterflyLabel = (pair: Matter.Pair) => {
      const labelA = pair.bodyA.label
      const labelB = pair.bodyB.label
      if (labelA === chosenNumberIdRef.current && labelB.startsWith('b-')) return labelB
      if (labelB === chosenNumberIdRef.current && labelA.startsWith('b-')) return labelA
      return null
    }

    // Tracks whether the balanced butterfly is currently off the 999 (in
    // the air, between a separation and its next landing) and how far it
    // got during that hop -- set by collisionEnd/collisionStart below and
    // updated every frame in the main loop while airborne.
    let isAirborne = false
    let maxSeparationDist = 0

    // Phase 1: sustained near-still contact establishes which butterfly is
    // "balanced" and therefore eligible to count bounces. Gravity mode must
    // be on -- one more thing standing between people and the easter egg.
    const handleCollisionActive = (event: Matter.IEventCollision<Matter.Engine>) => {
      if (!gravityOnRef.current) return
      if (!chosenNumberIdRef.current) return
      const heldEntry = tracked.find(t => t.id === chosenNumberIdRef.current)
      if (!heldEntry || !heldEntry.dragging) return

      for (const pair of event.pairs) {
        const butterflyLabel = findButterflyLabel(pair)
        if (!butterflyLabel) continue

        if (balancedButterflyId && butterflyLabel === balancedButterflyId) {
          lastRelevantContactAt = performance.now()
          break
        }
        if (balancedButterflyId) break

        if (heldEntry.body.speed > BALANCE_MAX_SPEED) {
          balanceContactSince = null
          continue
        }
        if (balanceContactSince === null) {
          balanceContactSince = performance.now()
        } else if (performance.now() - balanceContactSince >= BALANCE_MS) {
          balancedButterflyId = butterflyLabel
          lastRelevantContactAt = performance.now()
          isAirborne = false
          recolorButterfly(butterflyLabel)
        }
        break
      }
    }
    Matter.Events.on(engine, 'collisionActive', handleCollisionActive)

    // The balanced butterfly separating from the 999 starts a new "hop" --
    // from here the main loop tracks how far it gets before landing again.
    const handleCollisionEnd = (event: Matter.IEventCollision<Matter.Engine>) => {
      if (!gravityOnRef.current || !balancedButterflyId) return
      for (const pair of event.pairs) {
        const butterflyLabel = findButterflyLabel(pair)
        if (!butterflyLabel || butterflyLabel !== balancedButterflyId) continue
        isAirborne = true
        maxSeparationDist = 0
        break
      }
    }
    Matter.Events.on(engine, 'collisionEnd', handleCollisionEnd)

    // Phase 2: landing back on the 999 after a hop that actually gained
    // real height counts as a bounce -- a hop that barely left contact
    // (jitter, not a real toss) doesn't, but stays balanced so it's not
    // punishing, just not free.
    const handleCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
      if (!gravityOnRef.current) return
      if (!chosenNumberIdRef.current || !balancedButterflyId) return
      const heldEntry = tracked.find(t => t.id === chosenNumberIdRef.current)
      if (!heldEntry || !heldEntry.dragging) return

      for (const pair of event.pairs) {
        const butterflyLabel = findButterflyLabel(pair)
        if (!butterflyLabel || butterflyLabel !== balancedButterflyId) continue
        if (!isAirborne) continue

        isAirborne = false
        if (maxSeparationDist < MIN_LAUNCH_DIST) continue

        lastRelevantContactAt = performance.now()
        hitCountRef.current += 1
        recolorButterfly(butterflyLabel)

        if (hitCountRef.current >= SECRET_HITS_NEEDED) {
          hitCountRef.current = 0
          balancedButterflyId = null
          balanceContactSince = null
          openSecretWall()
        }
        break
      }
    }
    Matter.Events.on(engine, 'collisionStart', handleCollision)

    let rafId: number
    let lastTime = performance.now()

    const loop = (time: number) => {
      const delta = Math.min(time - lastTime, 33)
      lastTime = time

      // If the balanced butterfly wandered off and hasn't touched back in
      // a while, the balance is lost -- have to settle a new one before
      // bounces count again.
      if (balancedButterflyId && time - lastRelevantContactAt > REBALANCE_GAP_MS) {
        balancedButterflyId = null
        balanceContactSince = null
        isAirborne = false
      }

      // While the balanced butterfly is off the 999, track how far it's
      // gotten so a landing can check whether this hop actually went high
      // enough to count.
      if (isAirborne && chosenNumberIdRef.current && balancedButterflyId) {
        const heldEntry = tracked.find(t => t.id === chosenNumberIdRef.current)
        const butterflyEntry = tracked.find(t => t.id === balancedButterflyId)
        if (heldEntry && butterflyEntry) {
          const dx = heldEntry.body.position.x - butterflyEntry.body.position.x
          const dy = heldEntry.body.position.y - butterflyEntry.body.position.y
          const dist = Math.sqrt(dx * dx + dy * dy) - (heldEntry.radius + butterflyEntry.radius)
          if (dist > maxSeparationDist) maxSeparationDist = dist
        }
      }

      if (gravityOnRef.current) {
        engine.gravity.x = gravityVectorRef.current.x
        engine.gravity.y = gravityVectorRef.current.y
      } else {
        engine.gravity.x = 0
        engine.gravity.y = 0
        // Idle wander: every so often, pick a new lazy drift direction and
        // gently steer the body's velocity toward it. This is also what
        // pulls a flung item's speed back down after it bounces around for
        // a bit, so the fling feels "brief" rather than permanent.
        tracked.forEach(t => {
          if (t.dragging) return
          if (time >= t.nextWanderAt) {
            const angle = Math.random() * Math.PI * 2
            const speed = 0.3 + Math.random() * 0.4
            t.wanderVX = Math.cos(angle) * speed
            t.wanderVY = Math.sin(angle) * speed
            t.nextWanderAt = time + 1500 + Math.random() * 2000
          }
          const lerp = 0.015
          Matter.Body.setVelocity(t.body, {
            x: t.body.velocity.x + (t.wanderVX - t.body.velocity.x) * lerp,
            y: t.body.velocity.y + (t.wanderVY - t.body.velocity.y) * lerp
          })
        })
      }

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
      Matter.Events.off(engine, 'collisionStart', handleCollision)
      Matter.Events.off(engine, 'collisionActive', handleCollisionActive)
      Matter.Events.off(engine, 'collisionEnd', handleCollisionEnd)
      cleanupFns.forEach(fn => fn())
      Matter.World.clear(engine.world, false)
      Matter.Engine.clear(engine)
      if (engineRef.current === engine) engineRef.current = null
    }
  }, [butterflies, numbers])

  // The rare creature spawns/despawns independently of the main item set,
  // so it gets its own small effect that adds/removes just one body (and
  // its drag listeners) on the already-running shared engine, instead of
  // tearing down and rebuilding everything else every time one appears.
  useEffect(() => {
    if (!rareCreature) return
    const engine = engineRef.current
    const el = itemRefs.current.get(rareCreature.uid)
    if (!engine || !el) return

    const rect = el.getBoundingClientRect()
    const radius = Math.max(rect.width, rect.height) / 2 || 18
    const body = Matter.Bodies.circle(rect.left + radius, rect.top + radius, radius, {
      label: rareCreature.uid,
      restitution: 0.6,
      friction: 0.15,
      frictionAir: 0.01,
      density: 0.001
    })
    Matter.World.add(engine.world, body)

    let activePointerId: number | null = null
    let constraint: Matter.Constraint | null = null
    let caught = false

    const catchIt = () => {
      if (caught) return
      caught = true
      const visitorId = visitorIdRef.current
      const def = getCreature(rareCreature.type)
      if (visitorId && def) {
        fetch('/api/creatures/catch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId, creatureType: def.type })
        })
          .then(r => r.json())
          .then(d => {
            setCaughtTypes(prev => (prev.includes(def.type) ? prev : [...prev, def.type]))
            if (catchToastTimeoutRef.current) clearTimeout(catchToastTimeoutRef.current)
            setCatchToast(d.isNew ? `✨ Caught: ${def.name}!` : `Already caught: ${def.name}`)
            catchToastTimeoutRef.current = setTimeout(() => setCatchToast(null), 2600)
          })
          .catch(() => {})
      }
      setRareCreature(null)
    }

    const endDrag = () => {
      activePointerId = null
      if (constraint) {
        Matter.World.remove(engine.world, constraint)
        constraint = null
      }
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      catchIt()
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId || !constraint) return
      e.preventDefault()
      constraint.pointA = { x: e.clientX, y: e.clientY }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return
      endDrag()
    }
    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return
      endDrag()
    }
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault()
      activePointerId = e.pointerId
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // Harmless -- drag still works via the window-level listeners.
      }
      constraint = Matter.Constraint.create({
        bodyB: body,
        pointA: { x: e.clientX, y: e.clientY },
        pointB: { x: 0, y: 0 },
        length: 0,
        stiffness: 0.85,
        damping: 0.25
      })
      Matter.World.add(engine.world, constraint)
      window.addEventListener('pointermove', onPointerMove, { passive: false })
      window.addEventListener('pointerup', onPointerUp, { passive: false })
      window.addEventListener('pointercancel', onPointerCancel, { passive: false })
    }

    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', onPointerDown, { passive: false })

    let rafId: number
    const draw = () => {
      el.style.transform = `translate(${body.position.x - radius}px, ${body.position.y - radius}px) rotate(${body.angle}rad)`
      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      if (constraint) Matter.World.remove(engine.world, constraint)
      Matter.World.remove(engine.world, body)
    }
  }, [rareCreature])

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
        {secretFound && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setSecretWallOpen(true)}
            className="rounded-full border border-accent/30 bg-black/80 px-3 py-3 text-xs font-mono text-accent backdrop-blur-md transition-colors hover:border-accent"
            title="Reopen the secret wall -- land 10 more bounces to get back here"
          >
            🔓 Wall
          </motion.button>
        )}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setCollectionOpen(true)}
          className="rounded-full border border-accent/30 bg-black/80 px-3 py-3 text-xs font-mono text-accent backdrop-blur-md transition-colors hover:border-accent"
          title="View your caught creatures"
        >
          📖 {caughtTypes.length}/{CREATURES.length}
        </motion.button>
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setGamesOpen(true)}
          className="rounded-full border border-accent/30 bg-black/80 px-3 py-3 text-xs font-mono text-accent backdrop-blur-md transition-colors hover:border-accent"
          title="Play mini-games"
        >
          🎮 Games
        </motion.button>
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setSettingsOpen((prev) => !prev)}
          className="rounded-full border border-accent/30 bg-black/80 px-3 py-3 text-xs font-mono text-accent backdrop-blur-md transition-colors hover:border-accent"
          title="Butterfly display settings"
        >
          ⚙️
        </motion.button>
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-24 left-6 z-[46] w-72 rounded-xl border border-accent/30 bg-black/90 p-4 backdrop-blur-md"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Butterfly Display</span>
              <button onClick={() => setSettingsOpen(false)} className="text-white/50 hover:text-white">
                ✕
              </button>
            </div>

            <label className="mb-1 flex items-center justify-between text-xs text-white/70">
              <span>Brightness</span>
              <span className="text-accent">{Math.round(brightness * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={1.6}
              step={0.05}
              value={brightness}
              onChange={(e) => setBrightness(parseFloat(e.target.value))}
              className="w-full accent-[color:var(--accent)]"
            />

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-white">Keep behind products</p>
                <p className="text-[10px] text-white/50">Moves them behind page content instead of floating on top</p>
              </div>
              <button
                onClick={() => setLayerBehind((prev) => !prev)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${layerBehind ? 'bg-accent' : 'bg-white/20'}`}
                title={layerBehind ? 'Butterflies are behind page content' : 'Butterflies float above page content'}
              >
                <motion.span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-black"
                  animate={{ left: layerBehind ? '1.375rem' : '0.125rem' }}
                  transition={{ duration: 0.2 }}
                />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {catchToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 left-1/2 z-[46] -translate-x-1/2 rounded-full border border-accent/40 bg-black/90 px-4 py-2 text-sm text-white"
          >
            {catchToast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hintMessage && (
          <motion.div
            key={hintMessage.id}
            initial={{ opacity: 0, x: '-10vw', y: `${20 + Math.random() * 50}vh` }}
            animate={{ opacity: [0, 0.8, 0.8, 0], x: '110vw' }}
            transition={{ duration: 13, ease: 'linear' }}
            className="pointer-events-none fixed z-[46] max-w-[260px] rounded-lg border border-accent/30 bg-black/80 px-3 py-2 text-xs text-white/90 backdrop-blur-sm"
          >
            {hintMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {secretWallOpen && <SecretWall onClose={() => setSecretWallOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {collectionOpen && (
          <CreatureCollection
            caughtTypes={caughtTypes}
            visitorId={visitorIdRef.current}
            onClose={() => setCollectionOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {backgroundCollectionOpen && (
          <BackgroundCollection
            unlockedIds={unlockedBackgrounds}
            onClose={() => setBackgroundCollectionOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gamesOpen && (
          <GamesHub
            caughtTypes={caughtTypes}
            visitorId={visitorIdRef.current}
            onClose={() => setGamesOpen(false)}
            onActivateDestroyMode={() => {
              setGamesOpen(false)
              setDestroyModeActive(true)
            }}
            onActivateHideSeek={() => {
              setGamesOpen(false)
              setHideSeekActive(true)
            }}
          />
        )}
      </AnimatePresence>

      {destroyModeActive && (
        <DestroyModeOverlay
          onExit={() => setDestroyModeActive(false)}
          onBackgroundUnlocked={(id) => setUnlockedBackgrounds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
          onOpenBackgroundCollection={() => setBackgroundCollectionOpen(true)}
          unlockedBackgroundCount={unlockedBackgrounds.length}
          totalBackgrounds={BACKGROUND_POOL.length}
        />
      )}
      {hideSeekActive && (
        <DestroyModeOverlay
          mode="hideseek"
          onExit={() => setHideSeekActive(false)}
          onBackgroundUnlocked={(id) => setUnlockedBackgrounds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
          onOpenBackgroundCollection={() => setBackgroundCollectionOpen(true)}
          unlockedBackgroundCount={unlockedBackgrounds.length}
          totalBackgrounds={BACKGROUND_POOL.length}
        />
      )}

      {/* z-[45] (default) sits above the page's content sections (z-40) so
          the floating elements are visible/grabbable over content. z-[1]
          (layerBehind) sits above the animated background but behind every
          content section instead, for visitors who toggle it out of the way. */}
      <div className={`fixed inset-0 pointer-events-none overflow-hidden ${layerBehind ? 'z-[1]' : 'z-[45]'}`}>
        {butterflies.map((butterfly) => (
          <div
            key={`b-${butterfly.id}`}
            ref={(el) => {
              if (el) itemRefs.current.set(`b-${butterfly.id}`, el)
              else itemRefs.current.delete(`b-${butterfly.id}`)
            }}
            className={`absolute top-0 left-0 pointer-events-auto cursor-grab active:cursor-grabbing select-none [-webkit-tap-highlight-color:transparent] ${butterfly.color}`}
            style={{
              transform: `translate(${butterfly.x}vw, ${butterfly.y}vh)`,
              opacity: revealed ? butterflyOpacity : 0,
              transition: `opacity 1.2s ease ${butterfly.delay}s`
            }}
          >
            {/* Invisible hit-slop -- bigger than the visible svg so a
                slightly-off tap on mobile still grabs it. */}
            <div className="absolute -inset-3" />
            <Glow color={butterfly.hex} size={40} intensity={glowIntensity} />
            <ButterflySvg />
          </div>
        ))}

        {numbers.map((num) => (
          <div
            key={`n-${num.id}`}
            ref={(el) => {
              if (el) itemRefs.current.set(`n-${num.id}`, el)
              else itemRefs.current.delete(`n-${num.id}`)
            }}
            className="absolute top-0 left-0 pointer-events-auto cursor-grab active:cursor-grabbing font-mono font-bold select-none [-webkit-tap-highlight-color:transparent]"
            style={{
              transform: `translate(${num.x}vw, ${num.y}vh)`,
              opacity: revealed ? numberOpacity : 0,
              transition: `opacity 1.2s ease ${num.delay}s`
            }}
          >
            <div className="absolute -inset-3" />
            <Glow color={num.color} size={num.size} intensity={glowIntensity} />
            <span style={{ fontSize: num.size, color: num.color, textShadow: `0 0 18px ${num.color}, 0 0 6px ${num.color}` }}>
              999
            </span>
          </div>
        ))}

        {rareCreature && (
          <motion.div
            key={rareCreature.uid}
            ref={(el) => {
              if (el) itemRefs.current.set(rareCreature.uid, el)
              else itemRefs.current.delete(rareCreature.uid)
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-0 left-0 pointer-events-auto cursor-grab active:cursor-grabbing select-none [-webkit-tap-highlight-color:transparent]"
            style={{ transform: `translate(${rareCreature.x}vw, ${rareCreature.y}vh)`, color: rareCreature.hex }}
          >
            <div className="absolute -inset-3" />
            {/* Brighter, pulsing glow -- signals "this one's special" at a
                glance against the dimmer regular butterflies/999s. */}
            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}>
              <Glow color={rareCreature.hex} size={44} intensity={0.8} />
            </motion.div>
            <CreatureSvg type={rareCreature.type} size={36} />
          </motion.div>
        )}
      </div>
    </>
  )
}
