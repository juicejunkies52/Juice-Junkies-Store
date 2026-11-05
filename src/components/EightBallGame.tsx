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
const WALL_THICKNESS = 16
const MAX_DRAG = 160
const MAX_LAUNCH_SPEED = 34
const MIN_DRAG_TO_THROW = 18
const SETTLE_DELAY_MS = 550

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

function ballColor(n: number): string {
  if (n === 8) return '#0a0a0a'
  const base = GROUP_COLORS[n <= 7 ? n : n - 8]
  return base
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

  const phaseRef = useRef<ShotPhase>('ready')
  const settleStartRef = useRef(0)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; curX: number; curY: number } | null>(null)

  // Per-shot tracking, reset when a shot is launched, read once the table
  // settles -- this is the whole rules engine's input.
  const firstContactRef = useRef<number | null>(null)
  const pottedThisShotRef = useRef<number[]>([])
  const scratchedThisShotRef = useRef(false)

  const playersRef = useRef<[Group, Group]>([null, null])
  const currentPlayerRef = useRef<0 | 1>(0)
  const [groups, setGroups] = useState<[Group, Group]>([null, null])
  const [currentPlayer, setCurrentPlayer] = useState<0 | 1>(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPower, setDragPower] = useState(0)
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
      Matter.Bodies.rectangle(table.left - WALL_THICKNESS / 2, table.centerY, WALL_THICKNESS, table.bottom - pocketGap - (table.top + pocketGap), {
        isStatic: true
      }),
      Matter.Bodies.rectangle(table.right + WALL_THICKNESS / 2, table.centerY, WALL_THICKNESS, table.bottom - pocketGap - (table.top + pocketGap), {
        isStatic: true
      })
    ]
    Matter.World.add(engine.world, rails)

    rackBalls(engine, table)

    Matter.Events.on(engine, 'collisionStart', (ev) => {
      if (phaseRef.current !== 'rolling' || firstContactRef.current !== null) return
      const cue = cueBallRef.current
      if (!cue) return
      for (const pair of ev.pairs) {
        const other = pair.bodyA === cue ? pair.bodyB : pair.bodyB === cue ? pair.bodyA : null
        if (!other) continue
        const entry = ballsRef.current.find((e) => e.body === other && !e.isCue)
        if (entry) {
          firstContactRef.current = entry.number
          break
        }
      }
    })

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

      // Guests never simulate -- they only ever render the host's last
      // broadcast state, applied via mpRenderBallsRef (see networking
      // effect below).
      if (mpRoleRef.current !== 'guest') {
        Matter.Engine.update(eng, delta)

        for (const entry of ballsRef.current) {
          if (entry.sunk) continue
          for (const p of pocketsRef.current) {
            const d = Math.hypot(entry.body.position.x - p.x, entry.body.position.y - p.y)
            if (d < POCKET_RADIUS) {
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
          }
        }

        broadcastCounterRef.current += 1
        if (broadcastCounterRef.current >= 3) {
          broadcastCounterRef.current = 0
          broadcastState()
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

      for (const entry of ballsRef.current) {
        if (entry.sunk) continue
        const { x, y } = entry.body.position
        if (entry.isCue) {
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2)
          ctx.fill()
        } else if (groupOf(entry.number) === 'stripes') {
          ctx.fillStyle = '#f4ecd8'
          ctx.beginPath()
          ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = ballColor(entry.number)
          ctx.save()
          ctx.beginPath()
          ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2)
          ctx.clip()
          ctx.fillRect(x - BALL_RADIUS, y - BALL_RADIUS * 0.42, BALL_RADIUS * 2, BALL_RADIUS * 0.84)
          ctx.restore()
        } else {
          ctx.fillStyle = ballColor(entry.number)
          ctx.beginPath()
          ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2)
          ctx.fill()
        }
        if (!entry.isCue) {
          ctx.fillStyle = entry.number === 8 || groupOf(entry.number) === 'stripes' ? '#fff' : '#fff'
          ctx.font = 'bold 8px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = entry.number === 8 ? '#fff' : groupOf(entry.number) === 'stripes' ? '#111' : '#fff'
          ctx.fillText(String(entry.number), x, y + 0.5)
        }
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
        room.subscribe('shot', (data: { angle: number; speed: number }) => {
          if (phaseRef.current !== 'ready' || currentPlayerRef.current !== 1) return
          const cue = cueBallRef.current
          if (!cue) return
          pottedThisShotRef.current = []
          scratchedThisShotRef.current = false
          firstContactRef.current = null
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
    }
  }, [])

  // ---- Local input: pointerdown starts a drag/placement, move/up are
  // window-level (not setPointerCapture -- see PoolGame.tsx) -------------
  const amShooter = () => {
    if (mpRoleRef.current === 'solo') return true
    return mySeatRef.current === currentPlayerRef.current
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameOver || !amShooter()) return
    if (phaseRef.current === 'placing') {
      const tbl = tableRef.current
      const cue = cueBallRef.current
      if (!tbl || !cue) return
      const x = Math.min(tbl.right - BALL_RADIUS, Math.max(tbl.left + BALL_RADIUS, e.clientX))
      const y = Math.min(tbl.bottom - BALL_RADIUS, Math.max(tbl.top + BALL_RADIUS, e.clientY))
      if (mpRoleRef.current === 'guest') {
        ablyRoomRef.current?.publish('place', { x, y })
      } else {
        Matter.Body.setPosition(cue, { x, y })
        phaseRef.current = 'ready'
        setIsPlacing(false)
      }
      return
    }
    if (phaseRef.current !== 'ready') return
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

      const clamped = Math.min(MAX_DRAG, dist)
      const power = clamped / MAX_DRAG
      const angle = Math.atan2(-dy, -dx)
      const speed = power * MAX_LAUNCH_SPEED

      if (mpRoleRef.current === 'guest') {
        ablyRoomRef.current?.publish('shot', { angle, speed })
        phaseRef.current = 'ready'
        return
      }

      const cue = cueBallRef.current
      if (!cue) return
      pottedThisShotRef.current = []
      scratchedThisShotRef.current = false
      firstContactRef.current = null
      Matter.Body.setVelocity(cue, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed })
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
        <button
          onClick={() => setShowLobby(true)}
          className="fixed top-4 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-accent"
        >
          🌐 Play online
        </button>
      )}

      <div className="pointer-events-none fixed top-14 left-1/2 z-[110] -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
        {mpRole === 'solo' ? `Player ${currentPlayer + 1}` : myTurn ? 'Your turn' : `Waiting on ${mpRole === 'host' ? 'guest' : 'host'}`} &middot; {groupLabel(groups[currentPlayer])}
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

      {!gameOver && !isDragging && !isPlacing && myTurn && (
        <div className="pointer-events-none fixed bottom-10 left-1/2 z-[110] -translate-x-1/2 text-xs text-white/40">
          Drag back from the cue ball and release to strike
        </div>
      )}
      {!gameOver && isPlacing && myTurn && (
        <div className="pointer-events-none fixed bottom-10 left-1/2 z-[110] -translate-x-1/2 text-xs text-accent">Ball in hand -- tap to place the cue ball</div>
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
              {mpRole === 'solo' ? `Player ${(winner ?? 0) + 1} Wins!` : winner === mySeatRef.current ? 'You Win!' : 'You Lose'}
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
