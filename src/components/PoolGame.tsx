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
// The rails deliberately stop short of each pocket center by this much on
// both axes, leaving a gap for balls to fall through. That gap is a square
// notch, not a circle -- its corners reach POCKET_GAP*sqrt(2) (~34px) from
// the pocket center, well past the POCKET_RADIUS (20px) capture circle.
// A ball threading that corner-of-the-notch zone was neither close enough
// to count as sunk nor blocked by any rail (none exists there by design),
// so it just sailed on through uncaptured -- the real root cause behind
// "the ball flies out of the arena". The capture check below matches this
// square shape exactly instead of a circle, so anything geometrically past
// the rails' own boundary is correctly recognized as sunk.
const POCKET_GAP = POCKET_RADIUS + 4
const WALL_THICKNESS = 22
const MAX_DRAG = 160
const MAX_LAUNCH_SPEED = 34
const MIN_DRAG_TO_THROW = 18
const STRIKES_TOTAL = 15
const SETTLE_DELAY_MS = 500

// Fixed-timestep physics sub-stepping -- a single Matter.Engine.update per
// animation frame let a hard-hit ball (up to MAX_LAUNCH_SPEED) cover more
// distance in one step than the rail is thick, which is classic tunneling:
// the discrete collision check never samples a moment where the ball and
// rail actually overlap, so the ball passes straight through. Running
// several smaller steps per frame (capped so a stalled tab can't spiral)
// keeps per-step travel well under rail thickness and reads as noticeably
// more solid/consistent contact in general, not just at the rails.
const FIXED_STEP_MS = 1000 / 120
const MAX_SUBSTEPS_PER_FRAME = 8
// Safety-net boundary well outside the table -- the rails deliberately
// leave gaps at the pocket mouths for balls to fall through, but that gap
// is slightly wider than the circular pocket-capture radius (a square
// opening vs. a round capture zone), so a ball can occasionally skim a
// pocket mouth without being captured. Rather than fight that geometry
// mismatch exactly, this backstop guarantees a ball that slips past a
// pocket still bounces back into play instead of sailing off into empty
// canvas space forever.
const SAFETY_MARGIN = 260

// Cue ball spin (English) -- a deliberately bounded approximation, not a
// full rolling-friction/contact-spin simulation (matter-js is 2D and has
// no notion of ball spin at all). Three effects, each tuned empirically
// against a standalone physics harness before landing here:
//  - Draw/follow: a ONE-TIME effect at the cue ball's first contact with
//    an object ball. Rather than adding an impulse on top of whatever
//    residual velocity matter-js's own collision resolution happens to
//    leave (verified to be small and inconsistent -- center-ball/no-spin
//    already approximates a real stun shot reasonably well on its own),
//    the post-contact velocity is set directly as a fraction of the
//    cue ball's PRE-contact speed along its incoming direction, scaled
//    by spinY. This gives predictable, designed control instead of being
//    a slave to the engine's own idiosyncratic post-collision residual.
const DRAW_FOLLOW_FACTOR = 0.35
//  - Pre-contact curve: a small continuous perpendicular nudge applied
//    every physics substep before the cue ball has touched anything,
//    proportional to spinX -- the visual "swerve" real side-spin produces
//    on the way to the object ball. Capped to a bounded number of
//    substeps regardless of contact -- real swerve is a brief transient
//    right after the shot (the ball sliding before it bites into a roll),
//    not something that keeps bending the whole time it's moving. Without
//    this cap, an open shot with nothing to hit curves forever and the
//    perpendicular nudge eventually overwhelms and corrupts the ball's
//    actual direction of travel -- caught live, not just in the harness.
const CURVE_STRENGTH = 0.18
const CURVE_MAX_SUBSTEPS = 20
//  - Rail-rebound deflection: every time the cue ball (not an object ball)
//    contacts a rail, its post-bounce velocity is rotated by up to this
//    many degrees (scaled by spinX) on top of matter-js's own correct
//    mirror-angle reflection -- real english visibly shifts the rebound
//    angle off a cushion.
const RAIL_ENGLISH_DEGREES = 10

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

// ---- Render-layer caching ---------------------------------------------
// The table felt/rails/pockets never change shape frame-to-frame (only
// built once, or rebuilt on resize), and every ball of a given color
// always looks identical -- only its position moves. Redrawing all of
// that from scratch with arc()/fillRect()/gradient calls on every single
// animation frame was pure waste (and, combined with the per-frame
// setState below, the actual source of perceived lag while dragging to
// aim). Both get pre-rendered once to small offscreen canvases and
// blitted with a single drawImage() per frame instead -- cheaper AND the
// natural place to add real shading/gradients, since that detail is now
// free at runtime rather than costing real time every frame.
function buildTableBackground(canvasW: number, canvasH: number, table: Table, pockets: { x: number; y: number }[]): HTMLCanvasElement {
  const bg = document.createElement('canvas')
  bg.width = canvasW
  bg.height = canvasH
  const c = bg.getContext('2d')
  if (!c) return bg

  c.fillStyle = '#0a0a0f'
  c.fillRect(0, 0, canvasW, canvasH)

  c.fillStyle = '#0d3b24'
  c.fillRect(table.left - WALL_THICKNESS, table.top - WALL_THICKNESS, table.right - table.left + WALL_THICKNESS * 2, table.bottom - table.top + WALL_THICKNESS * 2)

  const feltRadius = Math.max(table.right - table.left, table.bottom - table.top) * 0.75
  const felt = c.createRadialGradient(table.centerX, table.centerY, 10, table.centerX, table.centerY, feltRadius)
  felt.addColorStop(0, '#1b7047')
  felt.addColorStop(1, '#0e3a24')
  c.fillStyle = felt
  c.fillRect(table.left, table.top, table.right - table.left, table.bottom - table.top)

  // Cushion highlight/shadow lines along the inner rail edge, suggesting
  // a raised cushion instead of a flat-colored border.
  c.strokeStyle = 'rgba(255,255,255,0.07)'
  c.lineWidth = 2
  c.strokeRect(table.left + 1, table.top + 1, table.right - table.left - 2, table.bottom - table.top - 2)
  c.strokeStyle = 'rgba(0,0,0,0.3)'
  c.lineWidth = 1
  c.strokeRect(table.left + 5, table.top + 5, table.right - table.left - 10, table.bottom - table.top - 10)

  for (const p of pockets) {
    const hole = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, POCKET_RADIUS)
    hole.addColorStop(0, '#000000')
    hole.addColorStop(0.8, '#000000')
    hole.addColorStop(1, 'rgba(0,0,0,0.55)')
    c.fillStyle = hole
    c.beginPath()
    c.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = 'rgba(255,255,255,0.1)'
    c.lineWidth = 1.5
    c.beginPath()
    c.arc(p.x, p.y, POCKET_RADIUS - 1, 0, Math.PI * 2)
    c.stroke()
  }

  return bg
}

// A glossy-sphere look via two clipped radial gradients (dark rim +
// upper-left highlight) layered over the flat base color -- alpha
// compositing, so no hex-color-math helper is needed to lighten/darken.
function buildBallSprite(baseColor: string): HTMLCanvasElement {
  const pad = 3
  const size = (BALL_RADIUS + pad) * 2
  const r = BALL_RADIUS
  const cvs = document.createElement('canvas')
  cvs.width = size
  cvs.height = size
  const c = cvs.getContext('2d')
  if (!c) return cvs
  const cx = size / 2
  const cy = size / 2

  c.beginPath()
  c.arc(cx, cy, r, 0, Math.PI * 2)
  c.fillStyle = baseColor
  c.fill()

  c.save()
  c.beginPath()
  c.arc(cx, cy, r, 0, Math.PI * 2)
  c.clip()

  const rim = c.createRadialGradient(cx, cy, r * 0.55, cx, cy, r)
  rim.addColorStop(0, 'rgba(0,0,0,0)')
  rim.addColorStop(1, 'rgba(0,0,0,0.35)')
  c.fillStyle = rim
  c.fillRect(0, 0, size, size)

  const highlight = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 0.9)
  highlight.addColorStop(0, 'rgba(255,255,255,0.6)')
  highlight.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  highlight.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = highlight
  c.fillRect(0, 0, size, size)

  c.restore()
  return cvs
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
  const accumulatorRef = useRef(0)

  const phaseRef = useRef<ShotPhase>('ready')
  const settleStartRef = useRef(0)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; curX: number; curY: number } | null>(null)

  // ---- Spin (English) -- see the constants above for the approximation
  // this implements. spinRef is the PENDING spin the player has dialed in
  // (settable any time it's their turn to aim); shotSpinRef is what's
  // actually in effect for the shot currently in flight, captured at
  // launch so a mid-flight dial change can't retroactively alter it.
  const spinRef = useRef({ x: 0, y: 0 })
  const [spin, setSpin] = useState({ x: 0, y: 0 })
  const shotSpinRef = useRef({ x: 0, y: 0 })
  const firstContactAppliedRef = useRef(false)
  const pendingFollowDrawRef = useRef<{ dirX: number; dirY: number; targetSpeed: number } | null>(null)
  const pendingRailDeflectRef = useRef(false)
  const curveSubstepsLeftRef = useRef(0)
  const spinDialRef = useRef<HTMLDivElement>(null)
  const draggingSpinRef = useRef(false)

  const strikesLeftRef = useRef(STRIKES_TOTAL)
  const sunkCountRef = useRef(0)
  const scratchedRef = useRef(false)
  const [strikesLeft, setStrikesLeft] = useState(STRIKES_TOTAL)
  const [sunkCount, setSunkCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  // Updated every animation frame while dragging -- a ref + direct DOM
  // write, not React state, since the previous setState-per-frame here
  // forced a full component re-render 60-120 times/sec during the most
  // interactive moment of play (the real source of perceived lag).
  const dragPowerRef = useRef(0)
  const powerBarRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const ballSpritesRef = useRef<HTMLCanvasElement[]>([])
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
    bgCanvasRef.current = buildTableBackground(width, height, table, pockets)
    ballSpritesRef.current = [buildBallSprite('#ffffff'), ...BALL_COLORS.map((c) => buildBallSprite(c))]

    const engine = Matter.Engine.create()
    engine.gravity.x = 0
    engine.gravity.y = 0
    engineRef.current = engine

    // Rails as 6 straight segments (not one solid rectangle per side) --
    // the gaps between segments are exactly where the 6 pockets sit, so a
    // ball drifting into a gap has nothing to bounce off and falls through
    // to the pocket-capture check in the loop below.
    const rails = [
      Matter.Bodies.rectangle(
        (table.left + POCKET_GAP + (table.centerX - POCKET_GAP)) / 2,
        table.top - WALL_THICKNESS / 2,
        table.centerX - POCKET_GAP - (table.left + POCKET_GAP),
        WALL_THICKNESS,
        { isStatic: true, label: 'rail' }
      ),
      Matter.Bodies.rectangle(
        (table.centerX + POCKET_GAP + (table.right - POCKET_GAP)) / 2,
        table.top - WALL_THICKNESS / 2,
        table.right - POCKET_GAP - (table.centerX + POCKET_GAP),
        WALL_THICKNESS,
        { isStatic: true, label: 'rail' }
      ),
      Matter.Bodies.rectangle(
        (table.left + POCKET_GAP + (table.centerX - POCKET_GAP)) / 2,
        table.bottom + WALL_THICKNESS / 2,
        table.centerX - POCKET_GAP - (table.left + POCKET_GAP),
        WALL_THICKNESS,
        { isStatic: true, label: 'rail' }
      ),
      Matter.Bodies.rectangle(
        (table.centerX + POCKET_GAP + (table.right - POCKET_GAP)) / 2,
        table.bottom + WALL_THICKNESS / 2,
        table.right - POCKET_GAP - (table.centerX + POCKET_GAP),
        WALL_THICKNESS,
        { isStatic: true, label: 'rail' }
      ),
      Matter.Bodies.rectangle(
        table.left - WALL_THICKNESS / 2,
        table.centerY,
        WALL_THICKNESS,
        table.bottom - POCKET_GAP - (table.top + POCKET_GAP),
        { isStatic: true, label: 'rail' }
      ),
      Matter.Bodies.rectangle(
        table.right + WALL_THICKNESS / 2,
        table.centerY,
        WALL_THICKNESS,
        table.bottom - POCKET_GAP - (table.top + POCKET_GAP),
        { isStatic: true, label: 'rail' }
      )
    ]
    Matter.World.add(engine.world, rails)

    const safetyNet = [
      Matter.Bodies.rectangle(table.centerX, table.top - SAFETY_MARGIN, (table.right - table.left) + SAFETY_MARGIN * 2, 20, { isStatic: true, label: 'safetyNet' }),
      Matter.Bodies.rectangle(table.centerX, table.bottom + SAFETY_MARGIN, (table.right - table.left) + SAFETY_MARGIN * 2, 20, { isStatic: true, label: 'safetyNet' }),
      Matter.Bodies.rectangle(table.left - SAFETY_MARGIN, table.centerY, 20, (table.bottom - table.top) + SAFETY_MARGIN * 2, { isStatic: true, label: 'safetyNet' }),
      Matter.Bodies.rectangle(table.right + SAFETY_MARGIN, table.centerY, 20, (table.bottom - table.top) + SAFETY_MARGIN * 2, { isStatic: true, label: 'safetyNet' })
    ]
    Matter.World.add(engine.world, safetyNet)

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

    // Spin detection -- queues the draw/follow and rail-deflection effects
    // (see the constants above) for the first physics step after this
    // collision, rather than trying to apply them mid-resolution. The
    // pre-contact curve (the third spin effect) instead runs continuously
    // each substep in the loop below, since it's not tied to a discrete
    // collision event.
    Matter.Events.on(engine, 'collisionStart', (ev) => {
      const cue = cueBallRef.current
      if (!cue) return
      for (const pair of ev.pairs) {
        const other = pair.bodyA === cue ? pair.bodyB : pair.bodyB === cue ? pair.bodyA : null
        if (!other) continue
        if (other.label === 'rail') {
          if (shotSpinRef.current.x !== 0) pendingRailDeflectRef.current = true
        } else if (!firstContactAppliedRef.current) {
          const entry = ballsRef.current.find((e) => e.body === other && !e.isCue)
          if (entry) {
            firstContactAppliedRef.current = true
            if (shotSpinRef.current.y !== 0) {
              const preSpeed = Math.hypot(cue.velocity.x, cue.velocity.y) || 1
              const dirX = cue.velocity.x / preSpeed
              const dirY = cue.velocity.y / preSpeed
              // shotSpinRef.current.y is screen-aligned (negative = clicked
              // above the dial's center, matching where the marker renders
              // on the cue ball) -- negate it here so "above center" maps
              // to the real-world follow convention (positive), "below
              // center" to draw (negative), independent of that display
              // convention.
              pendingFollowDrawRef.current = { dirX, dirY, targetSpeed: preSpeed * -shotSpinRef.current.y * DRAW_FOLLOW_FACTOR }
            }
          }
        }
      }
    })

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      bgCanvasRef.current = buildTableBackground(canvas.width, canvas.height, table, pockets)
    }
    window.addEventListener('resize', resize)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loop = (time: number) => {
      const frameDelta = Math.min(time - (lastTimeRef.current || time), 250)
      lastTimeRef.current = time
      const eng = engineRef.current
      const tbl = tableRef.current
      if (!eng || !tbl) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      accumulatorRef.current += frameDelta
      let substeps = 0
      while (accumulatorRef.current >= FIXED_STEP_MS && substeps < MAX_SUBSTEPS_PER_FRAME) {
        // Pre-contact curve -- a continuous perpendicular nudge each
        // substep while the cue ball is rolling and hasn't touched
        // anything yet this shot, capped to CURVE_MAX_SUBSTEPS regardless
        // of contact (see that constant above for why).
        if (shotSpinRef.current.x !== 0 && !firstContactAppliedRef.current && curveSubstepsLeftRef.current > 0) {
          const cue = cueBallRef.current
          if (cue) {
            const speed = Math.hypot(cue.velocity.x, cue.velocity.y)
            if (speed > 0.01) {
              const dirX = cue.velocity.x / speed
              const dirY = cue.velocity.y / speed
              const perpX = -dirY
              const perpY = dirX
              Matter.Body.setVelocity(cue, {
                x: cue.velocity.x + perpX * shotSpinRef.current.x * CURVE_STRENGTH,
                y: cue.velocity.y + perpY * shotSpinRef.current.x * CURVE_STRENGTH
              })
            }
            curveSubstepsLeftRef.current--
          }
        }
        Matter.Engine.update(eng, FIXED_STEP_MS)
        accumulatorRef.current -= FIXED_STEP_MS
        substeps++
      }
      if (substeps === MAX_SUBSTEPS_PER_FRAME) accumulatorRef.current = 0

      // Apply the draw/follow and rail-deflection effects queued by the
      // collisionStart listener above -- deferred to here (right after
      // matter-js has fully resolved its own collision physics for this
      // frame) so the adjustment composes on top of that instead of being
      // overwritten by it.
      if (pendingFollowDrawRef.current) {
        const p = pendingFollowDrawRef.current
        const cue = cueBallRef.current
        if (cue) Matter.Body.setVelocity(cue, { x: p.dirX * p.targetSpeed, y: p.dirY * p.targetSpeed })
        pendingFollowDrawRef.current = null
      }
      if (pendingRailDeflectRef.current) {
        const cue = cueBallRef.current
        if (cue) {
          const rot = (shotSpinRef.current.x * RAIL_ENGLISH_DEGREES * Math.PI) / 180
          const vx = cue.velocity.x
          const vy = cue.velocity.y
          const cos = Math.cos(rot)
          const sin = Math.sin(rot)
          Matter.Body.setVelocity(cue, { x: vx * cos - vy * sin, y: vx * sin + vy * cos })
        }
        pendingRailDeflectRef.current = false
      }

      // Pocket capture -- checked every frame regardless of shot phase,
      // since a ball can drop in mid-roll well before everything settles.
      for (const entry of ballsRef.current) {
        if (entry.sunk) continue
        for (const p of pocketsRef.current) {
          const d = Math.hypot(entry.body.position.x - p.x, entry.body.position.y - p.y)
          const inGapNotch = Math.abs(entry.body.position.x - p.x) <= POCKET_GAP && Math.abs(entry.body.position.y - p.y) <= POCKET_GAP
          if (d < POCKET_RADIUS || inGapNotch) {
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
      // Table felt/rails/pockets are a single pre-rendered bitmap (see
      // buildTableBackground above) -- one drawImage instead of the
      // fillRect/arc/gradient calls that used to run here every frame.
      if (bgCanvasRef.current) ctx.drawImage(bgCanvasRef.current, 0, 0)

      let ballIdx = 0
      for (const entry of ballsRef.current) {
        if (entry.sunk) continue
        const spriteIdx = entry.isCue ? 0 : 1 + (ballIdx % BALL_COLORS.length)
        if (!entry.isCue) ballIdx++
        const { x, y } = entry.body.position

        // Shadow stays live (position changes every frame); the ball
        // itself is a cached sprite (see buildBallSprite above) blitted
        // at its current position instead of redrawn from scratch.
        ctx.fillStyle = 'rgba(0,0,0,0.28)'
        ctx.beginPath()
        ctx.ellipse(x + 2, y + 3, BALL_RADIUS * 0.92, BALL_RADIUS * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()

        const sprite = ballSpritesRef.current[spriteIdx]
        if (sprite) ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2)

        // Spin marker -- shows where on the cue ball the next shot will
        // strike, mirroring the dial's own marker so the chosen spin is
        // also visible on the ball itself while aiming.
        if (entry.isCue && (spinRef.current.x !== 0 || spinRef.current.y !== 0)) {
          ctx.fillStyle = '#39ff14'
          ctx.beginPath()
          ctx.arc(x + spinRef.current.x * BALL_RADIUS * 0.6, y + spinRef.current.y * BALL_RADIUS * 0.6, 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const drag = dragRef.current
      const cue = cueBallRef.current
      if (drag && cue && phaseRef.current === 'dragging') {
        const dx = drag.curX - drag.startX
        const dy = drag.curY - drag.startY
        const dist = Math.min(MAX_DRAG, Math.hypot(dx, dy))
        const power = dist / MAX_DRAG
        dragPowerRef.current = power
        if (powerBarRef.current) {
          powerBarRef.current.style.height = `${Math.round(power * 100)}%`
          powerBarRef.current.style.background = `linear-gradient(to top, #39ff14, rgb(${Math.round(255 * power)},${Math.round(255 * (1 - power * 0.5))},60))`
        }
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

  // Small always-visible dial for setting spin before a shot -- own local
  // pointer handling (not setPointerCapture, same reasoning as the main
  // table drag above), clamped to the unit circle since you can't strike
  // the cue ball outside its own face.
  const updateSpinFromPoint = useCallback((clientX: number, clientY: number) => {
    const dial = spinDialRef.current
    if (!dial) return
    const rect = dial.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const r = rect.width / 2
    let x = (clientX - cx) / r
    let y = (clientY - cy) / r
    const mag = Math.hypot(x, y)
    if (mag > 1) {
      x /= mag
      y /= mag
    }
    spinRef.current = { x, y }
    setSpin({ x, y })
  }, [])

  const onSpinDialPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== 'ready' || gameOver) return
    draggingSpinRef.current = true
    updateSpinFromPoint(e.clientX, e.clientY)
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
      shotSpinRef.current = spinRef.current
      firstContactAppliedRef.current = false
      pendingFollowDrawRef.current = null
      pendingRailDeflectRef.current = false
      curveSubstepsLeftRef.current = CURVE_MAX_SUBSTEPS
      spinRef.current = { x: 0, y: 0 }
      setSpin({ x: 0, y: 0 })
      Matter.Body.setVelocity(cue, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed })
      strikesLeftRef.current -= 1
      setStrikesLeft(strikesLeftRef.current)
      phaseRef.current = 'rolling'
    }
    const onSpinMove = (e: PointerEvent) => {
      if (!draggingSpinRef.current) return
      updateSpinFromPoint(e.clientX, e.clientY)
    }
    const onSpinUp = () => {
      draggingSpinRef.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    window.addEventListener('pointermove', onSpinMove)
    window.addEventListener('pointerup', onSpinUp)
    window.addEventListener('pointercancel', onSpinUp)
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
    spinRef.current = { x: 0, y: 0 }
    setSpin({ x: 0, y: 0 })
    firstContactAppliedRef.current = false
    pendingFollowDrawRef.current = null
    pendingRailDeflectRef.current = false
    curveSubstepsLeftRef.current = 0
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
            <div ref={powerBarRef} className="w-full rounded-full" style={{ height: '0%' }} />
          </div>
        </div>
      )}

      {!gameOver && !isDragging && (
        <div className="pointer-events-none fixed bottom-10 left-1/2 z-[110] -translate-x-1/2 text-xs text-white/40">
          Drag back from the cue ball and release to strike
        </div>
      )}

      {!gameOver && (
        <div className="fixed bottom-24 left-6 z-[110] flex flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-white/50">Spin</span>
          <div
            ref={spinDialRef}
            onPointerDown={onSpinDialPointerDown}
            className="relative h-14 w-14 touch-none rounded-full border border-white/25 bg-black/60"
          >
            <div className="absolute top-1/2 left-1/2 h-[1px] w-full -translate-x-1/2 -translate-y-1/2 bg-white/10" />
            <div className="absolute top-1/2 left-1/2 h-full w-[1px] -translate-x-1/2 -translate-y-1/2 bg-white/10" />
            <div
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
              style={{ left: `${50 + spin.x * 50}%`, top: `${50 + spin.y * 50}%` }}
            />
          </div>
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
