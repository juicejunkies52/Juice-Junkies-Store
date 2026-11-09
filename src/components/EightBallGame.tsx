'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import { AblyRoom, randomRoomCode } from '../../lib/ablyRoom'

// 999 Sports: Pool -- 8-Ball. Real rules this time (unlike PoolGame.tsx's
// arcade mode): ball groups, fouls, ball-in-hand, win/loss on the 8-ball.
// Same table/rail/pocket/physics setup as PoolGame.tsx (same Matter.js
// zeroed-gravity approach, same window-level drag-vector aim/power input --
// not setPointerCapture, see PoolGame.tsx for why), kept as its own
// component rather than a mode switch there since the state shape is
// fundamentally different (turns, groups, fouls) and this keeps the
// already-shipped arcade mode untouched.
//
// Scope trims, deliberate: no call-shot/call-pocket (any legal 8-ball pot
// wins, a common simplification even in casual real-world play), no
// "contact a rail after contact" foul, ball-in-hand is anywhere on the
// table (bar rules) rather than behind the head string.
const BALL_RADIUS = 10
const POCKET_RADIUS = 20
// See PoolGame.tsx for why: the rail gap at each pocket is a square notch
// reaching further (~34px diagonally at corners) than the POCKET_RADIUS
// (20px) capture circle, so a ball could thread that corner zone without
// ever registering as sunk -- the real root cause behind balls escaping
// the table. The capture check matches this square shape instead.
const POCKET_GAP = POCKET_RADIUS + 4
const WALL_THICKNESS = 22
const MAX_DRAG = 160
const MAX_LAUNCH_SPEED = 34
const MIN_DRAG_TO_THROW = 18
const SETTLE_DELAY_MS = 550

// See PoolGame.tsx for why: fixed-timestep sub-stepping keeps per-step ball
// travel well under rail thickness so a hard shot can't tunnel through a
// rail in one discrete collision check, and a safety-net boundary well
// outside the table catches anything that slips past a pocket mouth
// (square rail gap vs. round capture radius) instead of letting it sail
// off into empty canvas space.
const FIXED_STEP_MS = 1000 / 120
const MAX_SUBSTEPS_PER_FRAME = 8
const SAFETY_MARGIN = 260

// Cue ball spin (English) -- see PoolGame.tsx for the full rationale and
// tuning methodology (a standalone matter-js harness, not guesswork). Same
// three bounded effects, same constants: draw/follow sets the post-contact
// cue-ball speed as a fraction of its pre-contact speed rather than adding
// to matter-js's own small, inconsistent post-collision residual; the
// pre-contact curve is a continuous per-substep perpendicular nudge; the
// rail-rebound deflection rotates the cue ball's post-bounce velocity on
// top of matter-js's own correct mirror-angle reflection. The AI never
// uses spin (always fires {x:0,y:0} via the same launchCue path) --
// teaching it spin strategy is a separate problem from a basic opponent.
const DRAW_FOLLOW_FACTOR = 0.35
const CURVE_STRENGTH = 0.18
// Capped to a bounded number of substeps regardless of contact -- real
// swerve is a brief transient right after the shot, not something that
// keeps bending the whole time the ball is moving. Without this cap, an
// open shot with nothing to hit curves forever and the perpendicular
// nudge eventually overwhelms the ball's actual direction of travel --
// caught live in PoolGame.tsx, fixed there and ported here.
const CURVE_MAX_SUBSTEPS = 20
const RAIL_ENGLISH_DEGREES = 10

// Index 1-7 -> solid color; the same color striped (9-15) renders as a
// white ball with a band of that color instead of a full fill.
const GROUP_COLORS: Record<number, string> = {
  1: '#facc15',
  2: '#3b82f6',
  3: '#ef4444',
  4: '#a855f7',
  5: '#fb923c',
  6: '#22c55e',
  7: '#92400e'
}

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
  number: number // 0 for the cue ball, 1-15 for object balls
}

type Group = 'solids' | 'stripes' | null
type ShotPhase = 'placing' | 'ready' | 'dragging' | 'rolling' | 'settling' | 'ended'
type MpRole = 'solo' | 'host' | 'guest'
type MpConnStatus = 'idle' | 'connecting' | 'connected' | 'error'

interface ShotResult {
  foul: boolean
  foulReason: string | null
  winner: 0 | 1 | null
  winReason: string | null
  continueTurn: boolean
  assignedGroup: Group
}

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

function groupOf(n: number): Group {
  if (n <= 0 || n === 8) return null
  return n <= 7 ? 'solids' : 'stripes'
}

// ---- Simple AI opponent --------------------------------------------------
// Fixed to seat 1 -- the human always breaks (seat 0), so the AI only ever
// enters play reactively, from the same post-shot hook that already drives
// turn switching. Not a full solver: classic "ghost ball" aiming geometry
// (where must the cue ball's center be at contact to send the object ball
// toward a given pocket) plus a straight-line obstruction check per
// candidate, scored by cut angle and distance. Deliberately imperfect --
// angle/power jitter on the chosen shot keeps it beatable rather than
// playing like an inhuman solver.
const AI_SEAT: 0 | 1 = 1

function legalAITargets(
  balls: { x: number; y: number; number: number; isCue: boolean }[],
  aiGroup: Group
): { x: number; y: number; number: number; isCue: boolean }[] {
  const objectBalls = balls.filter((b) => !b.isCue)
  if (!aiGroup) return objectBalls.filter((b) => b.number !== 8)
  const ownRemaining = objectBalls.filter((b) => b.number !== 8 && groupOf(b.number) === aiGroup)
  if (ownRemaining.length > 0) return ownRemaining
  return objectBalls.filter((b) => b.number === 8)
}

// True if any body in `obstacles` sits close enough to segment A->B,
// between the endpoints, to physically block a ball travelling along it.
function segmentBlocked(ax: number, ay: number, bx: number, by: number, obstacles: { x: number; y: number }[], ballRadius: number): boolean {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy || 1
  for (const o of obstacles) {
    const t = ((o.x - ax) * dx + (o.y - ay) * dy) / lenSq
    if (t <= 0.02 || t >= 0.98) continue
    const px = ax + dx * t
    const py = ay + dy * t
    if (Math.hypot(o.x - px, o.y - py) < ballRadius * 2 - 1) return true
  }
  return false
}

function chooseAIShot(
  balls: { x: number; y: number; number: number; isCue: boolean }[],
  table: Table,
  pockets: { x: number; y: number }[],
  aiGroup: Group
): { angle: number; power: number } | null {
  const cue = balls.find((b) => b.isCue)
  if (!cue) return null
  const targets = legalAITargets(balls, aiGroup)
  if (targets.length === 0) return null
  const objectBalls = balls.filter((b) => !b.isCue)

  const candidates: { angle: number; power: number; score: number }[] = []

  for (const target of targets) {
    for (const pocket of pockets) {
      const dx = target.x - pocket.x
      const dy = target.y - pocket.y
      const potDist = Math.hypot(dx, dy)
      if (potDist < 1) continue
      const ux = dx / potDist
      const uy = dy / potDist
      // Ghost ball: where the cue ball's center must be at the moment of
      // contact to send the object ball along (object -> pocket).
      const ghostX = target.x + ux * BALL_RADIUS * 2
      const ghostY = target.y + uy * BALL_RADIUS * 2
      if (ghostX < table.left + BALL_RADIUS || ghostX > table.right - BALL_RADIUS || ghostY < table.top + BALL_RADIUS || ghostY > table.bottom - BALL_RADIUS) continue

      const aimDist = Math.hypot(ghostX - cue.x, ghostY - cue.y)
      if (aimDist < 1) continue
      const aimUx = (ghostX - cue.x) / aimDist
      const aimUy = (ghostY - cue.y) / aimDist

      // Cut angle: how far off a straight "stop shot" this is. Past ~80
      // degrees the geometry is near-impossible to reliably pocket, so
      // those candidates are dropped rather than scored low.
      const dot = Math.max(-1, Math.min(1, aimUx * ux + aimUy * uy))
      const cutAngleDeg = (Math.acos(dot) * 180) / Math.PI
      if (cutAngleDeg > 80) continue

      const otherBalls = objectBalls.filter((b) => b !== target)
      if (segmentBlocked(cue.x, cue.y, ghostX, ghostY, otherBalls, BALL_RADIUS)) continue
      if (segmentBlocked(target.x, target.y, pocket.x, pocket.y, otherBalls, BALL_RADIUS)) continue

      const totalDist = aimDist + potDist
      const score = -cutAngleDeg * 1.5 - totalDist * 0.05
      const angle = Math.atan2(aimUy, aimUx)
      const power = Math.min(1, 0.35 + totalDist / 700)
      candidates.push({ angle, power, score })
    }
  }

  if (candidates.length === 0) {
    // Nothing pockets cleanly -- just make legal contact with the nearest
    // target so the shot isn't an automatic "no contact" foul.
    let nearest = targets[0]
    let nearestDist = Infinity
    for (const t of targets) {
      const d = Math.hypot(t.x - cue.x, t.y - cue.y)
      if (d < nearestDist) {
        nearestDist = d
        nearest = t
      }
    }
    const angle = Math.atan2(nearest.y - cue.y, nearest.x - cue.x)
    return { angle: angle + (Math.random() - 0.5) * 0.05, power: 0.45 }
  }

  candidates.sort((a, b) => b.score - a.score)
  const top = candidates.slice(0, Math.min(3, candidates.length))
  const chosen = top[Math.floor(Math.random() * top.length)]
  const angleJitter = (Math.random() - 0.5) * 0.035
  const powerJitter = (Math.random() - 0.5) * 0.15
  return { angle: chosen.angle + angleJitter, power: Math.max(0.3, Math.min(1, chosen.power + powerJitter)) }
}

// Ball-in-hand placement: sample random spots and keep the one farthest
// from every other ball (clear sightlines, nothing to get snookered
// behind), rejecting anything that would overlap a ball outright.
function chooseAIPlacement(balls: { x: number; y: number; isCue: boolean }[], table: Table): { x: number; y: number } {
  const others = balls.filter((b) => !b.isCue)
  let best = { x: table.centerX, y: table.centerY }
  let bestScore = -Infinity
  for (let i = 0; i < 12; i++) {
    const x = table.left + BALL_RADIUS * 2 + Math.random() * (table.right - table.left - BALL_RADIUS * 4)
    const y = table.top + BALL_RADIUS * 2 + Math.random() * (table.bottom - table.top - BALL_RADIUS * 4)
    let minDist = others.length === 0 ? 9999 : Infinity
    for (const o of others) {
      const d = Math.hypot(o.x - x, o.y - y)
      if (d < minDist) minDist = d
    }
    if (minDist < BALL_RADIUS * 2.2) continue
    if (minDist > bestScore) {
      bestScore = minDist
      best = { x, y }
    }
  }
  return best
}

function ballColor(n: number): string {
  if (n === 8) return '#0a0a0a'
  const base = GROUP_COLORS[n <= 7 ? n : n - 8]
  return base
}

// ---- Render-layer caching -- see PoolGame.tsx for the full rationale:
// the table felt/rails/pockets never change shape frame-to-frame, and
// every ball of a given number always looks identical -- only its
// position moves. Redrawing all of it (plus a fillText call per ball)
// from scratch every single frame was pure waste and, combined with the
// per-frame setState this file used to also have, the real source of
// perceived lag while dragging to aim. Both get pre-rendered once to
// small offscreen canvases and blitted with drawImage() per frame.
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
// upper-left highlight) over the flat fill -- alpha compositing, so no
// hex-color-math helper is needed. The number is baked in last so the
// per-frame loop never needs a fillText call either.
function buildBallSprite(number: number): HTMLCanvasElement {
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

  const isCue = number === 0
  const group = groupOf(number)

  if (isCue) {
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.fillStyle = '#ffffff'
    c.fill()
  } else if (group === 'stripes') {
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.fillStyle = '#f4ecd8'
    c.fill()
    c.save()
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.clip()
    c.fillStyle = ballColor(number)
    c.fillRect(cx - r, cy - r * 0.42, r * 2, r * 0.84)
    c.restore()
  } else {
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.fillStyle = ballColor(number)
    c.fill()
  }

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

  if (!isCue) {
    c.font = 'bold 8px sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillStyle = number === 8 ? '#fff' : group === 'stripes' ? '#111' : '#fff'
    c.fillText(String(number), cx, cy + 0.5)
  }

  return cvs
}

// Standard 8-ball rack: ball 8 at the exact center of the triangle (3rd
// row, middle slot), the other 14 shuffled into the remaining slots. The
// center slot is the 5th ball placed in row-by-row (1,2,3,4,5) order --
// index 4 in a flat 0-14 walk.
function buildRackNumbers(): number[] {
  const others = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[others[i], others[j]] = [others[j], others[i]]
  }
  const nums: number[] = new Array(15)
  nums[4] = 8
  let oi = 0
  for (let i = 0; i < 15; i++) {
    if (i === 4) continue
    nums[i] = others[oi++]
  }
  return nums
}

export default function EightBallGame({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
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

  // Per-shot tracking, reset when a shot is launched, read once the table
  // settles -- this is the whole rules engine's input.
  const firstContactRef = useRef<number | null>(null)
  const pottedThisShotRef = useRef<number[]>([])
  const scratchedThisShotRef = useRef(false)

  // ---- Spin (English) -- see PoolGame.tsx for the full design. spinRef
  // is the PENDING spin the player has dialed in; shotSpinRef is what's
  // actually in effect for the shot currently in flight (captured at
  // launch, carried over the wire for a guest's shot -- see launchCue and
  // the 'shot' subscription below). firstContactRef doing double duty as
  // the "has the cue ball made contact yet this shot" gate (it's already
  // exactly that, reset on every launch) saves a redundant boolean ref.
  const spinRef = useRef({ x: 0, y: 0 })
  const [spin, setSpin] = useState({ x: 0, y: 0 })
  const shotSpinRef = useRef({ x: 0, y: 0 })
  const pendingFollowDrawRef = useRef<{ dirX: number; dirY: number; targetSpeed: number } | null>(null)
  const pendingRailDeflectRef = useRef(false)
  const curveSubstepsLeftRef = useRef(0)
  const spinDialRef = useRef<HTMLDivElement>(null)
  const draggingSpinRef = useRef(false)

  const playersRef = useRef<[Group, Group]>([null, null])
  const currentPlayerRef = useRef<0 | 1>(0)
  const [groups, setGroups] = useState<[Group, Group]>([null, null])
  const [currentPlayer, setCurrentPlayer] = useState<0 | 1>(0)
  const [isDragging, setIsDragging] = useState(false)
  // Updated every animation frame while dragging -- a ref + direct DOM
  // write, not React state (see PoolGame.tsx for why the old setState-
  // per-frame here was the real source of perceived lag).
  const dragPowerRef = useRef(0)
  const powerBarRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const ballSpritesRef = useRef<HTMLCanvasElement[]>([])
  const [sunkNumbers, setSunkNumbers] = useState<Set<number>>(new Set())
  // Mirrors phaseRef.current === 'placing' for the ball-in-hand hint text
  // -- phaseRef itself is a ref precisely so the render-loop closure always
  // sees the latest value, but that means reading it directly in JSX is
  // wrong (a ref change alone doesn't trigger a re-render, so the hint
  // would go stale for a render cycle). This state is set at every site
  // that transitions phaseRef into or out of 'placing'.
  const [isPlacing, setIsPlacing] = useState(false)
  const [foulToast, setFoulToast] = useState<string | null>(null)
  const foulToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState<0 | 1 | null>(null)
  const [winReason, setWinReason] = useState<string | null>(null)
  // Mirrors of the three above, read instead of the state itself anywhere
  // that's invoked from inside the render-loop effect closure below (that
  // closure is frozen at mount -- state read there would always see its
  // first-render value, refs always see the latest).
  const gameOverRef = useRef(false)
  const winnerRef = useRef<0 | 1 | null>(null)
  const winReasonRef = useRef<string | null>(null)

  // ---- Multiplayer (optional) -- mirrors LastStandGame.tsx's connectRoom
  // pattern near-verbatim: host runs the real rules+physics simulation and
  // periodically broadcasts a state snapshot; guest sends only a resolved
  // shot vector when it's their turn and otherwise just renders whatever
  // the host last broadcast.
  const [mpRole, setMpRole] = useState<MpRole>('solo')
  const mpRoleRef = useRef<MpRole>('solo')
  const [mpConnStatus, setMpConnStatus] = useState<MpConnStatus>('idle')
  const [mpRoomCode, setMpRoomCode] = useState('')
  const [mpJoinInput, setMpJoinInput] = useState('')
  const [peerPresent, setPeerPresent] = useState(false)
  const peerPresentRef = useRef(false)
  const [peerDisconnected, setPeerDisconnected] = useState<'host' | 'guest' | null>(null)
  const ablyRoomRef = useRef<AblyRoom | null>(null)
  const broadcastCounterRef = useRef(0)
  const [showLobby, setShowLobby] = useState(false)

  // A host-assigned seat: host is always seat 0, guest is always seat 1.
  // mySeatRef gates local input -- in solo play it's irrelevant (both
  // seats are "mine").
  const mySeatRef = useRef<0 | 1>(0)

  // ---- vs AI (optional, solo only) -- AI is always seat 1, human always
  // breaks. Driven from the same post-shot hook that already resolves
  // turn-switching, so it needs no polling of its own.
  const vsAIRef = useRef(false)
  const [vsAI, setVsAI] = useState(false)
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rackBalls = useCallback((engine: Matter.Engine, table: Table) => {
    for (const entry of ballsRef.current) {
      if (!entry.sunk) Matter.World.remove(engine.world, entry.body)
    }
    const tableWidth = table.right - table.left
    const ballOpts = { restitution: 0.9, friction: 0.05, frictionAir: 0.012, density: 0.0015 }

    const cueBall = Matter.Bodies.circle(table.left + tableWidth * 0.22, table.centerY, BALL_RADIUS, { label: 'cue', ...ballOpts })
    cueBallRef.current = cueBall
    Matter.World.add(engine.world, cueBall)

    const entries: BallEntry[] = [{ body: cueBall, sunk: false, isCue: true, number: 0 }]
    const rackNumbers = buildRackNumbers()
    const apexX = table.left + tableWidth * 0.72
    const rowGap = BALL_RADIUS * 1.85
    const colGap = BALL_RADIUS * 2.08
    let flatIdx = 0
    for (let row = 0; row < 5; row++) {
      const count = row + 1
      const x = apexX + row * rowGap
      const startY = table.centerY - ((count - 1) * colGap) / 2
      for (let i = 0; i < count; i++) {
        const number = rackNumbers[flatIdx]
        const body = Matter.Bodies.circle(x, startY + i * colGap, BALL_RADIUS, { label: `ball-${number}`, ...ballOpts })
        Matter.World.add(engine.world, body)
        entries.push({ body, sunk: false, isCue: false, number })
        flatIdx++
      }
    }
    ballsRef.current = entries
  }, [])

  const flashFoul = (msg: string) => {
    setFoulToast(msg)
    if (foulToastTimeoutRef.current) clearTimeout(foulToastTimeoutRef.current)
    foulToastTimeoutRef.current = setTimeout(() => setFoulToast(null), 2600)
  }

  // The actual rules engine -- called once per shot, right after the
  // table finishes settling. Reads only the per-shot refs populated by
  // collision/pocket tracking during 'rolling'.
  const resolveShot = useCallback((): ShotResult => {
    const shooter = currentPlayerRef.current
    const shooterGroup = playersRef.current[shooter]
    const potted = pottedThisShotRef.current
    const scratch = scratchedThisShotRef.current
    const noContact = firstContactRef.current === null
    const eightPotted = potted.includes(8)

    let foul = scratch || noContact
    let foulReason: string | null = scratch ? 'Scratch' : noContact ? 'No contact' : null
    let assignedGroup: Group = null

    if (!shooterGroup) {
      const legalFirst = potted.find((n) => n !== 8)
      if (legalFirst) assignedGroup = groupOf(legalFirst)
    } else if (firstContactRef.current !== null) {
      const fc = firstContactRef.current
      const fcGroup = groupOf(fc)
      const ownGroupRemains = ballsRef.current.some((e) => !e.sunk && !e.isCue && e.number !== 8 && groupOf(e.number) === shooterGroup)
      const fcIsEight = fc === 8
      if (fcGroup !== shooterGroup && !(fcIsEight && !ownGroupRemains)) {
        foul = true
        foulReason = 'Wrong ball first'
      }
    }

    const effectiveGroup = shooterGroup || assignedGroup
    let winnerOut: 0 | 1 | null = null
    let winReasonOut: string | null = null

    if (eightPotted) {
      const ownGroupRemains = effectiveGroup
        ? ballsRef.current.some((e) => !e.sunk && !e.isCue && e.number !== 8 && groupOf(e.number) === effectiveGroup)
        : true
      if (ownGroupRemains || scratch) {
        winnerOut = shooter === 0 ? 1 : 0
        winReasonOut = scratch ? 'Scratched on the 8-ball' : 'Potted the 8-ball early'
      } else {
        winnerOut = shooter
        winReasonOut = 'Legally potted the 8-ball'
      }
    }

    const pottedOwnLegal = !foul && effectiveGroup && potted.some((n) => n !== 8 && groupOf(n) === effectiveGroup)
    const continueTurn = winnerOut === null && !foul && !!pottedOwnLegal

    return { foul, foulReason, winner: winnerOut, winReason: winReasonOut, continueTurn, assignedGroup }
  }, [])

  const applyShotResult = useCallback(
    (res: ShotResult) => {
      const shooter = currentPlayerRef.current
      setSunkNumbers(new Set(ballsRef.current.filter((e) => e.sunk && !e.isCue).map((e) => e.number)))
      if (res.assignedGroup && !playersRef.current[shooter]) {
        playersRef.current[shooter] = res.assignedGroup
        playersRef.current[shooter === 0 ? 1 : 0] = res.assignedGroup === 'solids' ? 'stripes' : 'solids'
        setGroups([...playersRef.current])
      }

      if (res.winner !== null) {
        winnerRef.current = res.winner
        winReasonRef.current = res.winReason
        gameOverRef.current = true
        setWinner(res.winner)
        setWinReason(res.winReason)
        setGameOver(true)
        phaseRef.current = 'ended'
        return
      }

      if (res.foul) {
        flashFoul(`Foul${res.foulReason ? ` -- ${res.foulReason}` : ''}! Ball in hand`)
      }

      if (!res.continueTurn) {
        currentPlayerRef.current = shooter === 0 ? 1 : 0
        setCurrentPlayer(currentPlayerRef.current)
      }

      phaseRef.current = res.foul ? 'placing' : 'ready'
      setIsPlacing(res.foul)
    },
    []
  )

  const broadcastState = useCallback(() => {
    const room = ablyRoomRef.current
    if (!room || mpRoleRef.current !== 'host') return
    room.publish('state', {
      balls: ballsRef.current.filter((e) => !e.sunk).map((e) => ({ x: e.body.position.x, y: e.body.position.y, isCue: e.isCue, number: e.number })),
      currentPlayer: currentPlayerRef.current,
      groups: playersRef.current,
      gameOver: gameOverRef.current,
      winner: winnerRef.current,
      winReason: winReasonRef.current,
      phase: phaseRef.current
    })
  }, [])

  // Shared by the local human (solo/host) pointerup handler and the AI --
  // same per-shot ref resets + velocity set either way.
  const launchCue = useCallback((angle: number, power: number, spin: { x: number; y: number }) => {
    const cue = cueBallRef.current
    if (!cue) return
    pottedThisShotRef.current = []
    scratchedThisShotRef.current = false
    firstContactRef.current = null
    shotSpinRef.current = spin
    pendingFollowDrawRef.current = null
    pendingRailDeflectRef.current = false
    curveSubstepsLeftRef.current = CURVE_MAX_SUBSTEPS
    const speed = power * MAX_LAUNCH_SPEED
    Matter.Body.setVelocity(cue, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed })
    phaseRef.current = 'rolling'
  }, [])

  // Shared by the local human (solo/host) placing-phase pointerdown and
  // the AI's ball-in-hand placement.
  const placeCue = useCallback((x: number, y: number) => {
    const cue = cueBallRef.current
    const tbl = tableRef.current
    if (!cue || !tbl) return
    const cx = Math.min(tbl.right - BALL_RADIUS, Math.max(tbl.left + BALL_RADIUS, x))
    const cy = Math.min(tbl.bottom - BALL_RADIUS, Math.max(tbl.top + BALL_RADIUS, y))
    Matter.Body.setPosition(cue, { x: cx, y: cy })
    phaseRef.current = 'ready'
    setIsPlacing(false)
  }, [])

  // Called right after every turn-resolution (see the settling branch of
  // the render loop below) -- a no-op unless it's now the AI's turn. Reads
  // only refs, so it's safe to call from the loop's frozen closure.
  const maybeTriggerAI = useCallback(() => {
    if (!vsAIRef.current || gameOverRef.current || currentPlayerRef.current !== AI_SEAT) return
    if (aiTimeoutRef.current) return
    const phase = phaseRef.current
    if (phase !== 'ready' && phase !== 'placing') return

    aiTimeoutRef.current = setTimeout(
      () => {
        aiTimeoutRef.current = null
        const tbl = tableRef.current
        if (!tbl || gameOverRef.current || currentPlayerRef.current !== AI_SEAT) return

        if (phaseRef.current === 'placing') {
          const balls = ballsRef.current.filter((e) => !e.sunk).map((e) => ({ x: e.body.position.x, y: e.body.position.y, isCue: e.isCue }))
          const spot = chooseAIPlacement(balls, tbl)
          placeCue(spot.x, spot.y)
          maybeTriggerAI()
          return
        }

        if (phaseRef.current === 'ready') {
          const balls = ballsRef.current
            .filter((e) => !e.sunk)
            .map((e) => ({ x: e.body.position.x, y: e.body.position.y, number: e.number, isCue: e.isCue }))
          const shot = chooseAIShot(balls, tbl, pocketsRef.current, playersRef.current[AI_SEAT])
          if (shot) launchCue(shot.angle, shot.power, { x: 0, y: 0 })
        }
      },
      phaseRef.current === 'placing' ? 500 : 900
    )
  }, [launchCue, placeCue])

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
    ballSpritesRef.current = Array.from({ length: 16 }, (_, n) => buildBallSprite(n))

    const engine = Matter.Engine.create()
    engine.gravity.x = 0
    engine.gravity.y = 0
    engineRef.current = engine

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
      Matter.Bodies.rectangle(table.left - WALL_THICKNESS / 2, table.centerY, WALL_THICKNESS, table.bottom - POCKET_GAP - (table.top + POCKET_GAP), {
        isStatic: true,
        label: 'rail'
      }),
      Matter.Bodies.rectangle(table.right + WALL_THICKNESS / 2, table.centerY, WALL_THICKNESS, table.bottom - POCKET_GAP - (table.top + POCKET_GAP), {
        isStatic: true,
        label: 'rail'
      })
    ]
    Matter.World.add(engine.world, rails)

    const safetyNet = [
      Matter.Bodies.rectangle(table.centerX, table.top - SAFETY_MARGIN, (table.right - table.left) + SAFETY_MARGIN * 2, 20, { isStatic: true, label: 'safetyNet' }),
      Matter.Bodies.rectangle(table.centerX, table.bottom + SAFETY_MARGIN, (table.right - table.left) + SAFETY_MARGIN * 2, 20, { isStatic: true, label: 'safetyNet' }),
      Matter.Bodies.rectangle(table.left - SAFETY_MARGIN, table.centerY, 20, (table.bottom - table.top) + SAFETY_MARGIN * 2, { isStatic: true, label: 'safetyNet' }),
      Matter.Bodies.rectangle(table.right + SAFETY_MARGIN, table.centerY, 20, (table.bottom - table.top) + SAFETY_MARGIN * 2, { isStatic: true, label: 'safetyNet' })
    ]
    Matter.World.add(engine.world, safetyNet)

    rackBalls(engine, table)

    // Rail-deflection (spin) applies on every cushion contact for the
    // whole shot, so this no longer early-returns once firstContactRef is
    // set the way it used to -- only the foul-tracking/draw-follow half
    // of the body stays gated to the first object-ball contact.
    Matter.Events.on(engine, 'collisionStart', (ev) => {
      if (phaseRef.current !== 'rolling') return
      const cue = cueBallRef.current
      if (!cue) return
      for (const pair of ev.pairs) {
        const other = pair.bodyA === cue ? pair.bodyB : pair.bodyB === cue ? pair.bodyA : null
        if (!other) continue
        if (other.label === 'rail') {
          if (shotSpinRef.current.x !== 0) pendingRailDeflectRef.current = true
          continue
        }
        if (firstContactRef.current !== null) continue
        const entry = ballsRef.current.find((e) => e.body === other && !e.isCue)
        if (entry) {
          firstContactRef.current = entry.number
          if (shotSpinRef.current.y !== 0) {
            const preSpeed = Math.hypot(cue.velocity.x, cue.velocity.y) || 1
            const dirX = cue.velocity.x / preSpeed
            const dirY = cue.velocity.y / preSpeed
            // See PoolGame.tsx for why this is negated: shotSpinRef.y is
            // screen-aligned (negative = clicked above the dial's
            // center), negated here to match the real-world follow
            // convention (above center = positive = follow).
            pendingFollowDrawRef.current = { dirX, dirY, targetSpeed: preSpeed * -shotSpinRef.current.y * DRAW_FOLLOW_FACTOR }
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

      // Guests never simulate -- they only ever render the host's last
      // broadcast state, applied via mpRenderBallsRef (see networking
      // effect below).
      if (mpRoleRef.current !== 'guest') {
        accumulatorRef.current += frameDelta
        let substeps = 0
        while (accumulatorRef.current >= FIXED_STEP_MS && substeps < MAX_SUBSTEPS_PER_FRAME) {
          // Pre-contact curve -- see PoolGame.tsx; a continuous
          // perpendicular nudge each substep while the cue ball hasn't
          // touched anything yet this shot, capped to CURVE_MAX_SUBSTEPS
          // regardless of contact (see that constant above for why).
          if (shotSpinRef.current.x !== 0 && firstContactRef.current === null && curveSubstepsLeftRef.current > 0) {
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
        // collisionStart listener above -- see PoolGame.tsx for why this
        // is deferred to here rather than applied inside the event.
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

        for (const entry of ballsRef.current) {
          if (entry.sunk) continue
          for (const p of pocketsRef.current) {
            const d = Math.hypot(entry.body.position.x - p.x, entry.body.position.y - p.y)
            const inGapNotch = Math.abs(entry.body.position.x - p.x) <= POCKET_GAP && Math.abs(entry.body.position.y - p.y) <= POCKET_GAP
            if (d < POCKET_RADIUS || inGapNotch) {
              entry.sunk = true
              Matter.World.remove(eng.world, entry.body)
              if (entry.isCue) scratchedThisShotRef.current = true
              else pottedThisShotRef.current.push(entry.number)
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
            const result = resolveShot()
            applyShotResult(result)
            if (scratchedThisShotRef.current && cueBallRef.current && !ballsRef.current.some((e) => e.isCue && !e.sunk)) {
              // Cue ball was removed on the scratch -- bring it back for
              // the incoming player's ball-in-hand placement.
              const freshCue = Matter.Bodies.circle(tbl.centerX, tbl.centerY, BALL_RADIUS, {
                label: 'cue',
                restitution: 0.9,
                friction: 0.05,
                frictionAir: 0.012,
                density: 0.0015
              })
              Matter.World.add(eng.world, freshCue)
              cueBallRef.current = freshCue
              ballsRef.current = [{ body: freshCue, sunk: false, isCue: true, number: 0 }, ...ballsRef.current.filter((e) => !e.isCue)]
            }
            maybeTriggerAI()
          }
        }

        broadcastCounterRef.current += 1
        if (broadcastCounterRef.current >= 3) {
          broadcastCounterRef.current = 0
          broadcastState()
        }
      }

      // ---- Render ----
      // Table felt/rails/pockets and every ball appearance are pre-
      // rendered bitmaps (see buildTableBackground/buildBallSprite above)
      // -- one drawImage each instead of the fillRect/arc/gradient/
      // fillText calls that used to run here every frame.
      if (bgCanvasRef.current) ctx.drawImage(bgCanvasRef.current, 0, 0)

      for (const entry of ballsRef.current) {
        if (entry.sunk) continue
        const { x, y } = entry.body.position

        ctx.fillStyle = 'rgba(0,0,0,0.28)'
        ctx.beginPath()
        ctx.ellipse(x + 2, y + 3, BALL_RADIUS * 0.92, BALL_RADIUS * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()

        const sprite = ballSpritesRef.current[entry.number]
        if (sprite) ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2)

        // Spin marker -- where the next shot will strike, mirroring the
        // dial's own marker (see PoolGame.tsx).
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

        if (tbl) {
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
        }

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

      if (phaseRef.current === 'placing' && cue) {
        ctx.strokeStyle = 'rgba(57,255,20,0.7)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cue.position.x, cue.position.y, BALL_RADIUS + 6, 0, Math.PI * 2)
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

  // ---- Multiplayer: connect / disconnect / message handling ------------
  const connectRoom = async (code: string, role: 'host' | 'guest') => {
    setMpConnStatus('connecting')
    try {
      const clientId = `${role}-${Math.random().toString(36).slice(2, 10)}`
      const room = await AblyRoom.connect(code, clientId, 'pool')
      ablyRoomRef.current = room
      mpRoleRef.current = role
      setMpRole(role)
      mySeatRef.current = role === 'host' ? 0 : 1
      setMpRoomCode(code)
      setMpConnStatus('connected')
      setShowLobby(false)

      room.onPresence((members) => {
        const otherRole = role === 'host' ? 'guest' : 'host'
        const present = members.some((m) => (m.data as { role?: string } | undefined)?.role === otherRole)
        const wasPresent = peerPresentRef.current
        peerPresentRef.current = present
        setPeerPresent(present)
        if (wasPresent && !present && !gameOver) setPeerDisconnected(otherRole)
        else if (present) setPeerDisconnected(null)
      })
      room.enterPresence({ role })

      if (role === 'host') {
        room.subscribe('shot', (data: { angle: number; speed: number; spin?: { x: number; y: number } }) => {
          if (phaseRef.current !== 'ready' || currentPlayerRef.current !== 1) return
          const cue = cueBallRef.current
          if (!cue) return
          pottedThisShotRef.current = []
          scratchedThisShotRef.current = false
          firstContactRef.current = null
          shotSpinRef.current = data.spin ?? { x: 0, y: 0 }
          pendingFollowDrawRef.current = null
          pendingRailDeflectRef.current = false
          curveSubstepsLeftRef.current = CURVE_MAX_SUBSTEPS
          Matter.Body.setVelocity(cue, { x: Math.cos(data.angle) * data.speed, y: Math.sin(data.angle) * data.speed })
          phaseRef.current = 'rolling'
        })
        room.subscribe('place', (data: { x: number; y: number }) => {
          if (phaseRef.current !== 'placing' || currentPlayerRef.current !== 1) return
          const cue = cueBallRef.current
          const tbl = tableRef.current
          if (!cue || !tbl) return
          const x = Math.min(tbl.right - BALL_RADIUS, Math.max(tbl.left + BALL_RADIUS, data.x))
          const y = Math.min(tbl.bottom - BALL_RADIUS, Math.max(tbl.top + BALL_RADIUS, data.y))
          Matter.Body.setPosition(cue, { x, y })
          phaseRef.current = 'ready'
          setIsPlacing(false)
        })
      } else {
        room.subscribe(
          'state',
          (data: {
            balls: { x: number; y: number; isCue: boolean; number: number }[]
            currentPlayer: 0 | 1
            groups: [Group, Group]
            gameOver: boolean
            winner: 0 | 1 | null
            winReason: string | null
            phase: ShotPhase
          }) => {
            for (const b of data.balls) {
              const entry = ballsRef.current.find((e) => e.number === b.number && e.isCue === b.isCue)
              if (entry) Matter.Body.setPosition(entry.body, { x: b.x, y: b.y })
            }
            for (const entry of ballsRef.current) {
              if (!data.balls.some((b) => b.number === entry.number && b.isCue === entry.isCue)) entry.sunk = true
            }
            setSunkNumbers(new Set(ballsRef.current.filter((e) => e.sunk && !e.isCue).map((e) => e.number)))
            currentPlayerRef.current = data.currentPlayer
            setCurrentPlayer(data.currentPlayer)
            playersRef.current = data.groups
            setGroups(data.groups)
            phaseRef.current = data.phase
            setIsPlacing(data.phase === 'placing')
            if (data.gameOver && !gameOverRef.current) {
              gameOverRef.current = true
              winnerRef.current = data.winner
              winReasonRef.current = data.winReason
              setWinner(data.winner)
              setWinReason(data.winReason)
              setGameOver(true)
            }
          }
        )
      }
    } catch (err) {
      console.error('Ably connect error:', err)
      setMpConnStatus('error')
    }
  }

  const disconnectRoom = () => {
    ablyRoomRef.current?.close()
    ablyRoomRef.current = null
    mpRoleRef.current = 'solo'
    setMpRole('solo')
    setMpConnStatus('idle')
    setPeerPresent(false)
    setPeerDisconnected(null)
  }

  useEffect(() => {
    return () => {
      ablyRoomRef.current?.close()
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current)
    }
  }, [])

  // ---- Local input: pointerdown starts a drag/placement, move/up are
  // window-level (not setPointerCapture -- see PoolGame.tsx) -------------
  const amShooter = () => {
    if (mpRoleRef.current === 'solo') return !(vsAIRef.current && currentPlayerRef.current === AI_SEAT)
    return mySeatRef.current === currentPlayerRef.current
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameOver || !amShooter()) return
    if (phaseRef.current === 'placing') {
      if (mpRoleRef.current === 'guest') {
        ablyRoomRef.current?.publish('place', { x: e.clientX, y: e.clientY })
      } else {
        placeCue(e.clientX, e.clientY)
      }
      return
    }
    if (phaseRef.current !== 'ready') return
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY }
    phaseRef.current = 'dragging'
    setIsDragging(true)
  }

  // Small always-visible dial for setting spin before a shot -- see
  // PoolGame.tsx for the full reasoning (own local pointer handling, not
  // setPointerCapture; clamped to the unit circle).
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
    if (phaseRef.current !== 'ready' || gameOver || !amShooter()) return
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

      const clamped = Math.min(MAX_DRAG, dist)
      const power = clamped / MAX_DRAG
      const angle = Math.atan2(-dy, -dx)

      if (mpRoleRef.current === 'guest') {
        ablyRoomRef.current?.publish('shot', { angle, speed: power * MAX_LAUNCH_SPEED, spin: spinRef.current })
        spinRef.current = { x: 0, y: 0 }
        setSpin({ x: 0, y: 0 })
        phaseRef.current = 'ready'
        return
      }

      launchCue(angle, power, spinRef.current)
      spinRef.current = { x: 0, y: 0 }
      setSpin({ x: 0, y: 0 })
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
      window.removeEventListener('pointermove', onSpinMove)
      window.removeEventListener('pointerup', onSpinUp)
      window.removeEventListener('pointercancel', onSpinUp)
    }
  }, [])

  const playAgain = () => {
    const engine = engineRef.current
    const table = tableRef.current
    if (!engine || !table) return
    rackBalls(engine, table)
    playersRef.current = [null, null]
    setGroups([null, null])
    currentPlayerRef.current = 0
    setCurrentPlayer(0)
    gameOverRef.current = false
    winnerRef.current = null
    winReasonRef.current = null
    setGameOver(false)
    setWinner(null)
    setWinReason(null)
    phaseRef.current = 'ready'
    setIsPlacing(false)
    setSunkNumbers(new Set())
    spinRef.current = { x: 0, y: 0 }
    setSpin({ x: 0, y: 0 })
    pendingFollowDrawRef.current = null
    pendingRailDeflectRef.current = false
    curveSubstepsLeftRef.current = 0
  }

  // Toggling restarts the rack -- simplest way to guarantee a clean state
  // (human always breaking, no AI turn left mid-flight) rather than trying
  // to splice AI control into/out of a game already in progress.
  const toggleVsAI = () => {
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current)
      aiTimeoutRef.current = null
    }
    vsAIRef.current = !vsAIRef.current
    setVsAI(vsAIRef.current)
    playAgain()
  }

  const groupLabel = (g: Group) => (g === 'solids' ? 'Solids' : g === 'stripes' ? 'Stripes' : 'Open table')
  const myTurn = amShooter()

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

      {mpRole === 'solo' && !showLobby && (
        <div className="fixed top-4 left-1/2 z-[120] flex -translate-x-1/2 gap-2">
          <button
            onClick={toggleVsAI}
            className="rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-accent"
          >
            🤖 {vsAI ? 'vs AI: ON' : 'vs AI'}
          </button>
          <button
            onClick={() => setShowLobby(true)}
            className="rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-accent"
          >
            🌐 Play online
          </button>
        </div>
      )}

      <div className="pointer-events-none fixed top-14 left-1/2 z-[110] -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
        {mpRole === 'solo'
          ? vsAI
            ? currentPlayer === 0
              ? 'Your turn'
              : 'AI thinking...'
            : `Player ${currentPlayer + 1}`
          : myTurn
            ? 'Your turn'
            : `Waiting on ${mpRole === 'host' ? 'guest' : 'host'}`}{' '}
        &middot; {groupLabel(groups[currentPlayer])}
        {mpRole !== 'solo' && <span className="ml-2 text-white/40">(you: {mpRole === 'host' ? 'Player 1' : 'Player 2'})</span>}
      </div>

      {groups[currentPlayer] && (
        <div className="pointer-events-none fixed top-[5.5rem] left-1/2 z-[110] flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-black/60 px-3 py-1">
          {(groups[currentPlayer] === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15]).map((n) => (
            <span
              key={n}
              className="h-3 w-3 rounded-full border border-black/30"
              style={{ background: sunkNumbers.has(n) ? 'rgba(255,255,255,0.15)' : ballColor(n), opacity: sunkNumbers.has(n) ? 0.35 : 1 }}
            />
          ))}
        </div>
      )}

      {isDragging && (
        <div className="pointer-events-none fixed top-1/2 right-6 z-[110] flex -translate-y-1/2 flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-white/50">Power</span>
          <div className="flex h-40 w-4 flex-col-reverse overflow-hidden rounded-full border border-white/20 bg-black/50">
            <div ref={powerBarRef} className="w-full rounded-full" style={{ height: '0%' }} />
          </div>
        </div>
      )}

      {!gameOver && !isDragging && !isPlacing && myTurn && (
        <div className="pointer-events-none fixed bottom-10 left-1/2 z-[110] -translate-x-1/2 text-xs text-white/40">
          Drag back from the cue ball and release to strike
        </div>
      )}
      {!gameOver && isPlacing && myTurn && (
        <div className="pointer-events-none fixed bottom-10 left-1/2 z-[110] -translate-x-1/2 text-xs text-accent">Ball in hand -- tap to place the cue ball</div>
      )}

      {!gameOver && !isPlacing && myTurn && (
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

      {foulToast && (
        <div className="pointer-events-none fixed top-24 left-1/2 z-[115] -translate-x-1/2 rounded-full border border-red-400/50 bg-black/90 px-4 py-2 text-sm text-white">
          {foulToast}
        </div>
      )}

      {peerDisconnected && !gameOver && (
        <div className="pointer-events-none fixed top-32 left-1/2 z-[115] -translate-x-1/2 rounded-full border border-yellow-400/50 bg-black/90 px-4 py-2 text-sm text-white">
          ⚠️ {peerDisconnected === 'host' ? 'Host' : 'Guest'} disconnected
        </div>
      )}

      {showLobby && mpRole === 'solo' && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80" onClick={(e) => e.stopPropagation()}>
          <div className="w-80 rounded-xl border border-accent/50 bg-black/90 p-6 text-center">
            <div className="text-lg font-bold text-accent">Play Online</div>
            {mpConnStatus === 'connecting' ? (
              <div className="mt-4 text-sm text-white/60">Connecting...</div>
            ) : (
              <>
                <button
                  onClick={() => connectRoom(randomRoomCode(), 'host')}
                  className="mt-4 w-full rounded-full border border-accent/50 bg-black/60 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
                >
                  Host a Game
                </button>
                <div className="mt-4 flex gap-2">
                  <input
                    value={mpJoinInput}
                    onChange={(e) => setMpJoinInput(e.target.value.toUpperCase())}
                    placeholder="Room code"
                    className="w-full rounded-full border border-white/20 bg-black/50 px-3 py-2 text-center text-sm text-white outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => mpJoinInput && connectRoom(mpJoinInput, 'guest')}
                    className="shrink-0 rounded-full border border-accent/50 bg-black/60 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
                  >
                    Join
                  </button>
                </div>
              </>
            )}
            <button onClick={() => setShowLobby(false)} className="mt-4 block w-full text-xs text-white/40 hover:text-white/60">
              Cancel
            </button>
          </div>
        </div>
      )}

      {mpRole === 'host' && mpConnStatus === 'connected' && !peerPresent && !gameOver && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80" onClick={(e) => e.stopPropagation()}>
          <div className="w-80 rounded-xl border border-accent/50 bg-black/90 p-6 text-center">
            <div className="text-lg font-bold text-accent">Waiting for your friend...</div>
            <div className="mt-3 font-mono text-2xl tracking-widest text-white">{mpRoomCode}</div>
            <div className="mt-2 text-xs text-white/50">Send them this code to join</div>
            <button onClick={disconnectRoom} className="mt-4 text-xs text-white/40 hover:text-white/60">
              Cancel
            </button>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70" onClick={(e) => e.stopPropagation()}>
          <div className="w-72 rounded-xl border border-accent/50 bg-black/90 p-6 text-center">
            <div className="text-lg font-bold text-accent">
              {mpRole === 'solo'
                ? vsAI
                  ? winner === 0
                    ? 'You Win!'
                    : 'AI Wins'
                  : `Player ${(winner ?? 0) + 1} Wins!`
                : winner === mySeatRef.current
                  ? 'You Win!'
                  : 'You Lose'}
            </div>
            <div className="mt-2 text-sm text-white/60">{winReason}</div>
            <div className="mt-4 flex flex-col gap-2">
              {mpRole === 'solo' && (
                <button
                  onClick={playAgain}
                  className="rounded-full border border-accent/50 bg-black/60 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
                >
                  Play Again
                </button>
              )}
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
