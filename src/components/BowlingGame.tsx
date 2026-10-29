'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'

// 999 Sports: Bowling. Top-down lane (not a side-on view -- keeps the
// physics flat, no real gravity needed, same zeroed-gravity Matter setup
// EnhancedButterflies.tsx uses before it turns tilt-gravity on; we never
// turn it on here). Simple arcade scoring -- a fresh rack of 10 pins every
// throw, 10 throws total, running pin total is the score. Not real bowling
// frame/strike/spare math by design (see the 999 Sports plan).
const LANE_WIDTH = 240
const GUTTER_WIDTH = 28
const PIN_RADIUS = 11
const BALL_RADIUS = 15
const MAX_DRAG = 160
const MAX_LAUNCH_SPEED = 30
const MIN_DRAG_TO_THROW = 18
const TOTAL_THROWS = 10
const KNOCKDOWN_DISPLACEMENT = 20

interface Lane {
  left: number
  right: number
  top: number // pin end
  bottom: number // foul line / ball start
  centerX: number
}

interface PinEntry {
  body: Matter.Body
  startX: number
  startY: number
  down: boolean
}

type ThrowPhase = 'ready' | 'dragging' | 'rolling' | 'settling'

export default function BowlingGame({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const ballRef = useRef<Matter.Body | null>(null)
  const pinsRef = useRef<PinEntry[]>([])
  const laneRef = useRef<Lane | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const phaseRef = useRef<ThrowPhase>('ready')
  const settleStartRef = useRef(0)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; curX: number; curY: number } | null>(null)

  const throwCountRef = useRef(0)
  const totalPinsRef = useRef(0)
  const [throwCount, setThrowCount] = useState(0)
  const [totalPins, setTotalPins] = useState(0)
  const [lastThrowPins, setLastThrowPins] = useState<number | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [personalBest, setPersonalBest] = useState<number | null>(null)
  const [loggedIn, setLoggedIn] = useState(true)
  const [isDragging, setIsDragging] = useState(false)

  // Fresh rack every throw -- removes any old pin bodies, creates 10 new
  // ones in standard triangle formation, resets per-pin "down" tracking.
  const rackPins = useCallback(() => {
    const engine = engineRef.current
    const lane = laneRef.current
    if (!engine || !lane) return
    for (const p of pinsRef.current) Matter.World.remove(engine.world, p.body)
    pinsRef.current = []

    const rows = [4, 3, 2, 1]
    const rowGap = PIN_RADIUS * 2.3
    const colGap = PIN_RADIUS * 2.2
    const startY = lane.top + rowGap
    let y = startY
    for (const count of rows) {
      const rowWidth = (count - 1) * colGap
      let x = lane.centerX - rowWidth / 2
      for (let i = 0; i < count; i++) {
        const body = Matter.Bodies.circle(x, y, PIN_RADIUS, {
          label: 'pin',
          restitution: 0.25,
          friction: 0.05,
          frictionAir: 0.02,
          density: 0.0008
        })
        Matter.World.add(engine.world, body)
        pinsRef.current.push({ body, startX: x, startY: y, down: false })
        x += colGap
      }
      y += rowGap
    }
  }, [])

  const resetBall = useCallback(() => {
    const engine = engineRef.current
    const ball = ballRef.current
    const lane = laneRef.current
    if (!engine || !ball || !lane) return
    Matter.Body.setPosition(ball, { x: lane.centerX, y: lane.bottom - 20 })
    Matter.Body.setVelocity(ball, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(ball, 0)
  }, [])

  const saveScore = useCallback(
    (finalPins: number) => {
      try {
        const savedBest = parseInt(localStorage.getItem('jj-bowling-best') || '0', 10) || 0
        if (finalPins > savedBest) localStorage.setItem('jj-bowling-best', String(finalPins))
      } catch {
        // Fine -- just won't remember the new best locally.
      }
      fetch('/api/bowling/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pins: finalPins })
      })
        .then((r) => {
          setLoggedIn(r.status !== 401)
          return r.ok ? r.json() : null
        })
        .then((d) => {
          if (typeof d?.personalBest === 'number') setPersonalBest(d.personalBest)
        })
        .catch(() => {})
    },
    []
  )

  // ---- Setup: engine, walls, ball, first rack -------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = width
    canvas.height = height

    const lane: Lane = {
      left: width / 2 - LANE_WIDTH / 2,
      right: width / 2 + LANE_WIDTH / 2,
      top: 110,
      bottom: height - 140,
      centerX: width / 2
    }
    laneRef.current = lane

    const engine = Matter.Engine.create()
    engine.gravity.x = 0
    engine.gravity.y = 0
    engineRef.current = engine

    // Side walls just outside the gutters, and a back wall behind the
    // pins -- gutter/out-of-bounds itself is a plain numeric check each
    // frame (simpler and more foolproof than sensor-collision for a thin,
    // fast-moving ball), these walls just stop things flying off-canvas.
    const wallThickness = 60
    const walls = [
      Matter.Bodies.rectangle(lane.left - GUTTER_WIDTH - wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true }),
      Matter.Bodies.rectangle(lane.right + GUTTER_WIDTH + wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true }),
      Matter.Bodies.rectangle(lane.centerX, lane.top - 50 - wallThickness / 2, LANE_WIDTH + GUTTER_WIDTH * 2, wallThickness, { isStatic: true })
    ]
    Matter.World.add(engine.world, walls)

    const ball = Matter.Bodies.circle(lane.centerX, lane.bottom - 20, BALL_RADIUS, {
      label: 'ball',
      restitution: 0.3,
      friction: 0.05,
      frictionAir: 0.012,
      density: 0.002
    })
    ballRef.current = ball
    Matter.World.add(engine.world, ball)

    rackPins()

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', resize)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loop = (time: number) => {
      const delta = Math.min(time - (lastTimeRef.current || time), 33)
      lastTimeRef.current = time
      const lane2 = laneRef.current
      const eng = engineRef.current
      const b = ballRef.current
      if (!lane2 || !eng || !b) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      Matter.Engine.update(eng, delta)

      if (phaseRef.current === 'rolling') {
        const speed = Math.hypot(b.velocity.x, b.velocity.y)
        const outOfBounds = b.position.x < lane2.left - 4 || b.position.x > lane2.right + 4
        const pastPins = b.position.y < lane2.top - 55
        if (outOfBounds || pastPins || speed < 0.05) {
          phaseRef.current = 'settling'
          settleStartRef.current = time
        }
      } else if (phaseRef.current === 'settling') {
        // Give knocked pins a moment to actually finish moving before
        // tallying, so a pin still skidding from a late hit still counts.
        if (time - settleStartRef.current > 650) {
          let knockedThisThrow = 0
          for (const p of pinsRef.current) {
            if (p.down) continue
            const d = Math.hypot(p.body.position.x - p.startX, p.body.position.y - p.startY)
            if (d > KNOCKDOWN_DISPLACEMENT) {
              p.down = true
              knockedThisThrow++
            }
          }
          throwCountRef.current += 1
          totalPinsRef.current += knockedThisThrow
          setThrowCount(throwCountRef.current)
          setTotalPins(totalPinsRef.current)
          setLastThrowPins(knockedThisThrow)

          if (throwCountRef.current >= TOTAL_THROWS) {
            setGameOver(true)
            saveScore(totalPinsRef.current)
            phaseRef.current = 'ready'
          } else {
            rackPins()
            resetBall()
            phaseRef.current = 'ready'
          }
        }
      }

      // ---- Render ----
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#1a1310'
      ctx.fillRect(lane2.left - GUTTER_WIDTH, lane2.top - 50, LANE_WIDTH + GUTTER_WIDTH * 2, lane2.bottom - lane2.top + 70)
      ctx.fillStyle = '#3a2a1a'
      ctx.fillRect(lane2.left, lane2.top - 50, LANE_WIDTH, lane2.bottom - lane2.top + 70)
      ctx.strokeStyle = 'rgba(57,255,20,0.4)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(lane2.left, lane2.bottom)
      ctx.lineTo(lane2.right, lane2.bottom)
      ctx.stroke()

      for (const p of pinsRef.current) {
        if (p.down) continue
        ctx.fillStyle = '#f4ecd8'
        ctx.beginPath()
        ctx.arc(p.body.position.x, p.body.position.y, PIN_RADIUS, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(200,40,40,0.6)'
        ctx.beginPath()
        ctx.arc(p.body.position.x, p.body.position.y, PIN_RADIUS * 0.35, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.fillStyle = '#39ff14'
      ctx.beginPath()
      ctx.arc(b.position.x, b.position.y, BALL_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.beginPath()
      ctx.arc(b.position.x - 4, b.position.y - 4, BALL_RADIUS * 0.3, 0, Math.PI * 2)
      ctx.fill()

      const drag = dragRef.current
      if (drag && phaseRef.current === 'dragging') {
        const dx = drag.curX - drag.startX
        const dy = drag.curY - drag.startY
        const dist = Math.min(MAX_DRAG, Math.hypot(dx, dy))
        const power = dist / MAX_DRAG
        const angle = Math.atan2(-dy, -dx)
        const len = 40 + power * 140
        const ex = b.position.x + Math.cos(angle) * len
        const ey = b.position.y + Math.sin(angle) * len
        const r = Math.round(255 * power)
        const g = Math.round(255 * (1 - power * 0.5))
        ctx.strokeStyle = `rgb(${r},${g},60)`
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(b.position.x, b.position.y)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        ctx.fillStyle = `rgb(${r},${g},60)`
        ctx.beginPath()
        ctx.arc(ex, ey, 6, 0, Math.PI * 2)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem('jj-bowling-best') || '0', 10)
      if (saved > 0) setPersonalBest(saved)
    } catch {
      // Fine -- best just won't show until the next save round-trip.
    }
  }, [])

  // pointerdown is a React handler on the canvas itself (gates "did this
  // gesture start on the canvas"), but move/up are plain window listeners
  // rather than relying on setPointerCapture -- capture can throw (e.g. no
  // currently-active pointer with that id) and the canvas already covers
  // the full viewport anyway, so a window-level net is simpler and more
  // robust than fighting pointer capture for a gesture that can legitimately
  // end past the canvas edge (dragging toward the Back/Close buttons, etc).
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'ready' || gameOver) return
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY }
    phaseRef.current = 'dragging'
    setIsDragging(true)
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      drag.curX = e.clientX
      drag.curY = e.clientY
    }
    const endDrag = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      const dx = drag.curX - drag.startX
      const dy = drag.curY - drag.startY
      const dist = Math.hypot(dx, dy)
      dragRef.current = null
      setIsDragging(false)

      if (dist < MIN_DRAG_TO_THROW) {
        phaseRef.current = 'ready'
        return
      }

      const ball = ballRef.current
      if (!ball) return
      const clamped = Math.min(MAX_DRAG, dist)
      const power = clamped / MAX_DRAG
      const angle = Math.atan2(-dy, -dx)
      const speed = power * MAX_LAUNCH_SPEED
      Matter.Body.setVelocity(ball, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed })
      phaseRef.current = 'rolling'
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
    }
  }, [])

  const playAgain = () => {
    throwCountRef.current = 0
    totalPinsRef.current = 0
    setThrowCount(0)
    setTotalPins(0)
    setLastThrowPins(null)
    setGameOver(false)
    rackPins()
    resetBall()
    phaseRef.current = 'ready'
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black" onClick={(e) => e.stopPropagation()}>
      <canvas ref={canvasRef} className="block touch-none" onPointerDown={onPointerDown} />

      <button
        onClick={onBack}
        className="fixed top-4 left-4 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        ← Back
      </button>
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        Close ✕
      </button>

      <div className="pointer-events-none fixed top-4 left-1/2 z-[110] -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
        🎳 Throw {Math.min(throwCount + 1, TOTAL_THROWS)}/{TOTAL_THROWS} &middot; Pins: {totalPins}
        {lastThrowPins !== null && !gameOver && <span className="ml-2 text-accent">+{lastThrowPins}</span>}
      </div>

      {!gameOver && !isDragging && throwCount < TOTAL_THROWS && (
        <div className="pointer-events-none fixed bottom-10 left-1/2 z-[110] -translate-x-1/2 text-xs text-white/40">
          Drag back from the ball and release to bowl
        </div>
      )}

      {gameOver && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70" onClick={(e) => e.stopPropagation()}>
          <div className="w-72 rounded-xl border border-accent/50 bg-black/90 p-6 text-center">
            <div className="text-lg font-bold text-accent">Game Over</div>
            <div className="mt-2 text-3xl font-bold text-white">{totalPins} pins</div>
            {loggedIn && personalBest !== null && (
              <div className="mt-1 text-xs text-white/50">
                Personal best: {personalBest} {personalBest === totalPins && totalPins > 0 ? '-- new best!' : ''}
              </div>
            )}
            {!loggedIn && <div className="mt-1 text-xs text-white/40">Sign in to save your score to a leaderboard.</div>}
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={playAgain}
                className="rounded-full border border-accent/50 bg-black/60 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
              >
                Play Again
              </button>
              <button
                onClick={onBack}
                className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/30"
              >
                Back to Sports
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
