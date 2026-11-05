'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'

// 999 Sports: Pool (arcade mode). Same top-down, zeroed-gravity Matter
// setup as BowlingGame.tsx, same window-level drag-vector aim/power input
// (not setPointerCapture -- see BowlingGame.tsx for why). Arcade scoring
// only, by design: sink as many of the standard 15-ball rack as you can
// before scratching the cue ball or running out of strikes. No turn
// order, no solids/stripes assignment, no foul rules -- those (plus real
// 8-ball rules and multiplayer) are explicitly a later pass.
const BALL_RADIUS = 10
const POCKET_RADIUS = 20
const WALL_THICKNESS = 16
const MAX_DRAG = 160
const MAX_LAUNCH_SPEED = 34
const MIN_DRAG_TO_THROW = 18
const STRIKES_TOTAL = 15
const SETTLE_DELAY_MS = 500

const BALL_COLORS = [
  '#f4ecd8', '#facc15', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#39ff14', '#ef4444',
  '#38bdf8', '#eab308', '#ec4899', '#fb7185', '#34d399', '#c084fc', '#fdba74'
]

interface Table {
  left: number
  right: number
  top: number
  bottom: number
  centerX: number
  centerY: number
}

interface BallEntry {
  body: Matter.Body
  sunk: boolean
  isCue: boolean
}

type ShotPhase = 'ready' | 'dragging' | 'rolling' | 'settling' | 'ended'
type EndReason = 'scratch' | 'strikesOut' | 'cleared' | null

// The genre-standard "ghost line" while aiming: a single straight ray from
// the cue ball in the travel direction out to the first thing it would
// actually hit -- another ball or a rail. Not a full physics prediction
// (no bounce continuation past that first contact), just nearest-hit
// geometry, recomputed fresh every frame while dragging.
function castTrajectory(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  others: { x: number; y: number }[],
  table: Table,
  ballRadius: number
): { x: number; y: number } {
  let nearest = Math.max(table.right - table.left, table.bottom - table.top) * 1.5
  if (dirX > 0.0001) nearest = Math.min(nearest, (table.right - ballRadius - originX) / dirX)
  if (dirX < -0.0001) nearest = Math.min(nearest, (table.left + ballRadius - originX) / dirX)
  if (dirY > 0.0001) nearest = Math.min(nearest, (table.bottom - ballRadius - originY) / dirY)
  if (dirY < -0.0001) nearest = Math.min(nearest, (table.top + ballRadius - originY) / dirY)

  for (const b of others) {
    const ox = originX - b.x
    const oy = originY - b.y
    const bq = 2 * (dirX * ox + dirY * oy)
    const combined = ballRadius * 2
    const c = ox * ox + oy * oy - combined * combined
    const disc = bq * bq - 4 * c
    if (disc < 0) continue
    const t = (-bq - Math.sqrt(disc)) / 2
    if (t > 0 && t < nearest) nearest = t
  }

  return { x: originX + dirX * nearest, y: originY + dirY * nearest }
}

export default function PoolGame({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const ballsRef = useRef<BallEntry[]>([])
  const cueBallRef = useRef<Matter.Body | null>(null)
  const tableRef = useRef<Table | null>(null)
  const pocketsRef = useRef<{ x: number; y: number }[]>([])
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const phaseRef = useRef<ShotPhase>('ready')
  const settleStartRef = useRef(0)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; curX: number; curY: number } | null>(null)

  const strikesLeftRef = useRef(STRIKES_TOTAL)
  const sunkCountRef = useRef(0)
  const scratchedRef = useRef(false)
  const [strikesLeft, setStrikesLeft] = useState(STRIKES_TOTAL)
  const [sunkCount, setSunkCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPower, setDragPower] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [endReason, setEndReason] = useState<EndReason>(null)
  const [personalBest, setPersonalBest] = useState<number | null>(null)
  const [loggedIn, setLoggedIn] = useState(true)

  const saveScore = useCallback((finalSunk: number) => {
    try {
      const savedBest = parseInt(localStorage.getItem('jj-pool-best') || '0', 10) || 0
      if (finalSunk > savedBest) localStorage.setItem('jj-pool-best', String(finalSunk))
    } catch {
      // Fine -- just won't remember the new best locally.
    }
    fetch('/api/pool/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sunk: finalSunk })
    })
      .then((r) => {
        setLoggedIn(r.status !== 401)
        return r.ok ? r.json() : null
      })
      .then((d) => {
        if (typeof d?.personalBest === 'number') setPersonalBest(d.personalBest)
      })
      .catch(() => {})
  }, [])

  const endGame = useCallback(
    (reason: EndReason) => {
      setEndReason(reason)
      setGameOver(true)
      saveScore(sunkCountRef.current)
    },
    [saveScore]
  )

  // ---- Setup: engine, rails, rack, render/physics loop -----------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = width
    canvas.height = height

    const tableWidth = Math.min(760, width - 80)
    const tableHeight = tableWidth / 2
    const table: Table = {
      left: width / 2 - tableWidth / 2,
      right: width / 2 + tableWidth / 2,
      top: height / 2 - tableHeight / 2,
      bottom: height / 2 + tableHeight / 2,
      centerX: width / 2,
      centerY: height / 2
    }
    tableRef.current = table

    const pockets = [
      { x: table.left, y: table.top },
      { x: table.centerX, y: table.top },
      { x: table.right, y: table.top },
      { x: table.left, y: table.bottom },
      { x: table.centerX, y: table.bottom },
      { x: table.right, y: table.bottom }
    ]
    pocketsRef.current = pockets

    const engine = Matter.Engine.create()
    engine.gravity.x = 0
    engine.gravity.y = 0
    engineRef.current = engine

    // Rails as 6 straight segments (not one solid rectangle per side) --
    // the gaps between segments are exactly where the 6 pockets sit, so a
    // ball drifting into a gap has nothing to bounce off and falls through
    // to the pocket-capture check in the loop below.
    const pocketGap = POCKET_RADIUS + 8
    const rails = [
      Matter.Bodies.rectangle(
        (table.left + pocketGap + (table.centerX - pocketGap)) / 2,
        table.top - WALL_THICKNESS / 2,
        table.centerX - pocketGap - (table.left + pocketGap),
        WALL_THICKNESS,
        { isStatic: true }
      ),
      Matter.Bodies.rectangle(
        (table.centerX + pocketGap + (table.right - pocketGap)) / 2,
        table.top - WALL_THICKNESS / 2,
        table.right - pocketGap - (table.centerX + pocketGap),
        WALL_THICKNESS,
        { isStatic: true }
      ),
      Matter.Bodies.rectangle(
        (table.left + pocketGap + (table.centerX - pocketGap)) / 2,
        table.bottom + WALL_THICKNESS / 2,
        table.centerX - pocketGap - (table.left + pocketGap),
        WALL_THICKNESS,
        { isStatic: true }
      ),
      Matter.Bodies.rectangle(
        (table.centerX + pocketGap + (table.right - pocketGap)) / 2,
        table.bottom + WALL_THICKNESS / 2,
        table.right - pocketGap - (table.centerX + pocketGap),
        WALL_THICKNESS,
        { isStatic: true }
      ),
      Matter.Bodies.rectangle(
        table.left - WALL_THICKNESS / 2,
        table.centerY,
        WALL_THICKNESS,
        table.bottom - pocketGap - (table.top + pocketGap),
        { isStatic: true }
      ),
      Matter.Bodies.rectangle(
        table.right + WALL_THICKNESS / 2,
        table.centerY,
        WALL_THICKNESS,
        table.bottom - pocketGap - (table.top + pocketGap),
        { isStatic: true }
      )
    ]
    Matter.World.add(engine.world, rails)

    const ballOpts = {
      restitution: 0.9,
      friction: 0.05,
      frictionAir: 0.012,
      density: 0.0015
    }

    const cueBall = Matter.Bodies.circle(table.left + tableWidth * 0.22, table.centerY, BALL_RADIUS, { label: 'cue', ...ballOpts })
    cueBallRef.current = cueBall
    Matter.World.add(engine.world, cueBall)

    const entries: BallEntry[] = [{ body: cueBall, sunk: false, isCue: true }]
    const apexX = table.left + tableWidth * 0.72
    const rowGap = BALL_RADIUS * 1.85
    const colGap = BALL_RADIUS * 2.08
    let colorIdx = 0
    for (let row = 0; row < 5; row++) {
      const count = row + 1
      const x = apexX + row * rowGap
      const startY = table.centerY - ((count - 1) * colGap) / 2
      for (let i = 0; i < count; i++) {
        const body = Matter.Bodies.circle(x, startY + i * colGap, BALL_RADIUS, {
          label: `ball-${colorIdx + 1}`,
          ...ballOpts
        })
        Matter.World.add(engine.world, body)
        entries.push({ body, sunk: false, isCue: false })
        colorIdx++
      }
    }
    ballsRef.current = entries

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
      const eng = engineRef.current
      const tbl = tableRef.current
      if (!eng || !tbl) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      Matter.Engine.update(eng, delta)

      // Pocket capture -- checked every frame regardless of shot phase,
      // since a ball can drop in mid-roll well before everything settles.
      for (const entry of ballsRef.current) {
        if (entry.sunk) continue
        for (const p of pocketsRef.current) {
          const d = Math.hypot(entry.body.position.x - p.x, entry.body.position.y - p.y)
          if (d < POCKET_RADIUS) {
            entry.sunk = true
            Matter.World.remove(eng.world, entry.body)
            if (entry.isCue) {
              scratchedRef.current = true
            } else {
              sunkCountRef.current += 1
              setSunkCount(sunkCountRef.current)
            }
            break
          }
        }
      }

      if (phaseRef.current === 'rolling') {
        const stillMoving = ballsRef.current.some((e) => !e.sunk && Math.hypot(e.body.velocity.x, e.body.velocity.y) > 0.05)
        if (!stillMoving) {
          phaseRef.current = 'settling'
          settleStartRef.current = time
        }
      } else if (phaseRef.current === 'settling') {
        if (time - settleStartRef.current > SETTLE_DELAY_MS) {
          if (scratchedRef.current) {
            phaseRef.current = 'ended'
            endGame('scratch')
          } else if (sunkCountRef.current >= 15) {
            phaseRef.current = 'ended'
            endGame('cleared')
          } else if (strikesLeftRef.current <= 0) {
            phaseRef.current = 'ended'
            endGame('strikesOut')
          } else {
            phaseRef.current = 'ready'
          }
        }
      }

      // ---- Render ----
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#0d3b24'
      ctx.fillRect(tbl.left - WALL_THICKNESS, tbl.top - WALL_THICKNESS, tbl.right - tbl.left + WALL_THICKNESS * 2, tbl.bottom - tbl.top + WALL_THICKNESS * 2)
      ctx.fillStyle = '#145c38'
      ctx.fillRect(tbl.left, tbl.top, tbl.right - tbl.left, tbl.bottom - tbl.top)

      for (const p of pocketsRef.current) {
        ctx.fillStyle = '#000'
        ctx.beginPath()
        ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }

      let ballIdx = 0
      for (const entry of ballsRef.current) {
        if (entry.sunk) continue
        const color = entry.isCue ? '#ffffff' : BALL_COLORS[ballIdx % BALL_COLORS.length]
        if (!entry.isCue) ballIdx++
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(entry.body.position.x, entry.body.position.y, BALL_RADIUS, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = entry.isCue ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.35)'
        ctx.beginPath()
        ctx.arc(entry.body.position.x - 3, entry.body.position.y - 3, BALL_RADIUS * 0.3, 0, Math.PI * 2)
        ctx.fill()
      }

      const drag = dragRef.current
      const cue = cueBallRef.current
      if (drag && cue && phaseRef.current === 'dragging') {
        const dx = drag.curX - drag.startX
        const dy = drag.curY - drag.startY
        const dist = Math.min(MAX_DRAG, Math.hypot(dx, dy))
        const power = dist / MAX_DRAG
        setDragPower(power)
        const aimAngle = Math.atan2(-dy, -dx)
        const dirX = Math.cos(aimAngle)
        const dirY = Math.sin(aimAngle)

        const others = ballsRef.current.filter((e) => !e.isCue && !e.sunk).map((e) => ({ x: e.body.position.x, y: e.body.position.y }))
        const hit = castTrajectory(cue.position.x, cue.position.y, dirX, dirY, others, tbl, BALL_RADIUS)
        ctx.save()
        ctx.setLineDash([6, 6])
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cue.position.x, cue.position.y)
        ctx.lineTo(hit.x, hit.y)
        ctx.stroke()
        ctx.restore()
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(hit.x, hit.y, BALL_RADIUS * 0.6, 0, Math.PI * 2)
        ctx.stroke()

        // Cue stick -- pulled back opposite the travel direction, gap and
        // length both growing with power so a hard shot visibly winds up.
        const gap = 16 + power * 24
        const stickLen = 90 + power * 70
        const pbX = -dirX
        const pbY = -dirY
        const tipX = cue.position.x + pbX * gap
        const tipY = cue.position.y + pbY * gap
        const buttX = cue.position.x + pbX * (gap + stickLen)
        const buttY = cue.position.y + pbY * (gap + stickLen)
        ctx.strokeStyle = '#b4895c'
        ctx.lineWidth = 5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tipX, tipY)
        ctx.lineTo(buttX, buttY)
        ctx.stroke()
        ctx.strokeStyle = '#f0e6d2'
        ctx.lineWidth = 5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tipX, tipY)
        ctx.lineTo(tipX + pbX * 10, tipY + pbY * 10)
        ctx.stroke()
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
      const saved = parseInt(localStorage.getItem('jj-pool-best') || '0', 10)
      if (saved > 0) setPersonalBest(saved)
    } catch {
      // Fine -- best just won't show until the next save round-trip.
    }
  }, [])

  // Same window-level drag tracking BowlingGame.tsx uses -- pointerdown is
  // a React handler gating "did this start on the canvas", move/up are
  // plain window listeners so the gesture can't get stuck if it ends past
  // the canvas edge (setPointerCapture can throw, confirmed there).
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'ready' || gameOver || scratchedRef.current) return
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

      const cue = cueBallRef.current
      if (!cue) return
      const clamped = Math.min(MAX_DRAG, dist)
      const power = clamped / MAX_DRAG
      const angle = Math.atan2(-dy, -dx)
      const speed = power * MAX_LAUNCH_SPEED
      Matter.Body.setVelocity(cue, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed })
      strikesLeftRef.current -= 1
      setStrikesLeft(strikesLeftRef.current)
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
    const engine = engineRef.current
    const table = tableRef.current
    if (!engine || !table) return

    for (const entry of ballsRef.current) {
      if (!entry.sunk) Matter.World.remove(engine.world, entry.body)
    }

    const tableWidth = table.right - table.left
    const ballOpts = { restitution: 0.9, friction: 0.05, frictionAir: 0.012, density: 0.0015 }
    const cueBall = Matter.Bodies.circle(table.left + tableWidth * 0.22, table.centerY, BALL_RADIUS, { label: 'cue', ...ballOpts })
    cueBallRef.current = cueBall
    Matter.World.add(engine.world, cueBall)

    const entries: BallEntry[] = [{ body: cueBall, sunk: false, isCue: true }]
    const apexX = table.left + tableWidth * 0.72
    const rowGap = BALL_RADIUS * 1.85
    const colGap = BALL_RADIUS * 2.08
    let colorIdx = 0
    for (let row = 0; row < 5; row++) {
      const count = row + 1
      const x = apexX + row * rowGap
      const startY = table.centerY - ((count - 1) * colGap) / 2
      for (let i = 0; i < count; i++) {
        const body = Matter.Bodies.circle(x, startY + i * colGap, BALL_RADIUS, { label: `ball-${colorIdx + 1}`, ...ballOpts })
        Matter.World.add(engine.world, body)
        entries.push({ body, sunk: false, isCue: false })
        colorIdx++
      }
    }
    ballsRef.current = entries

    strikesLeftRef.current = STRIKES_TOTAL
    sunkCountRef.current = 0
    scratchedRef.current = false
    setStrikesLeft(STRIKES_TOTAL)
    setSunkCount(0)
    setGameOver(false)
    setEndReason(null)
    phaseRef.current = 'ready'
  }

  const endMessage =
    endReason === 'cleared' ? 'Table cleared!' : endReason === 'scratch' ? 'Scratched!' : 'Out of strikes'

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
        🎱 Sunk: {sunkCount}/15 &middot; Strikes left: {strikesLeft}
      </div>

      {isDragging && (
        <div className="pointer-events-none fixed top-1/2 right-6 z-[110] flex -translate-y-1/2 flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-white/50">Power</span>
          <div className="flex h-40 w-4 flex-col-reverse overflow-hidden rounded-full border border-white/20 bg-black/50">
            <div
              className="w-full rounded-full transition-[height]"
              style={{
                height: `${Math.round(dragPower * 100)}%`,
                background: `linear-gradient(to top, #39ff14, rgb(${Math.round(255 * dragPower)},${Math.round(255 * (1 - dragPower * 0.5))},60))`
              }}
            />
          </div>
        </div>
      )}

      {!gameOver && !isDragging && (
        <div className="pointer-events-none fixed bottom-10 left-1/2 z-[110] -translate-x-1/2 text-xs text-white/40">
          Drag back from the cue ball and release to strike
        </div>
      )}

      {gameOver && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70" onClick={(e) => e.stopPropagation()}>
          <div className="w-72 rounded-xl border border-accent/50 bg-black/90 p-6 text-center">
            <div className="text-lg font-bold text-accent">{endMessage}</div>
            <div className="mt-2 text-3xl font-bold text-white">{sunkCount} sunk</div>
            {loggedIn && personalBest !== null && (
              <div className="mt-1 text-xs text-white/50">
                Personal best: {personalBest} {personalBest === sunkCount && sunkCount > 0 ? '-- new best!' : ''}
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
