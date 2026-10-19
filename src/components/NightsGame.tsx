'use client'

import { useEffect, useRef, useState } from 'react'
import { sfx, setSfxMuted, isSfxMuted } from '../../lib/sfx'

// Original survival-crafting mini-game -- own art, own name, own mechanics
// (gather resources, craft/build, survive a day/night cycle). Day/night
// survival-crafting is a whole genre (countless games do this), not any
// one title's specific IP -- nothing here borrows a character, story, map,
// or specific design from any existing game.

type ResourceType = 'wood' | 'stone' | 'food'

const RESOURCE_DEFS: Record<ResourceType, { icon: string; label: string }> = {
  wood: { icon: '🌳', label: 'Wood' },
  stone: { icon: '🪨', label: 'Stone' },
  food: { icon: '🍓', label: 'Food' }
}

function ShadeSvg({ flashed }: { flashed: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      className="drop-shadow-[0_0_6px_rgba(124,58,237,0.6)]"
      style={flashed ? { filter: 'brightness(2.4)' } : undefined}
    >
      <path
        d="M13,2 C18,2 22,7 22,13 C22,18 18,22 13,24 C8,22 4,18 4,13 C4,7 8,2 13,2 Z"
        fill="#241433"
        fillOpacity="0.95"
        stroke="#7c3aed"
        strokeWidth="1"
      />
      <circle cx="10" cy="11" r="1.5" fill="#a78bfa" />
      <circle cx="16" cy="11" r="1.5" fill="#a78bfa" />
    </svg>
  )
}

const PLAYER_SIZE = 30
const PLAYER_MAX_HP = 100
const CAMP_MAX_HP = 150
const BASE_MOVE_SPEED = 2.9
const PROJECTILE_SPEED = 7.5
const CONTACT_RADIUS = 24
const GATHER_RADIUS = 36
const GATHER_INTERVAL = 56 // frame ticks (~16ms each) between gather awards
const DAY_SECONDS = 40
const NIGHT_SECONDS = 28
const PLAYER_RANGE = 200
const WALL_TIER_HP = [0, 40, 85]
const WALL_COST = 5 // wood
const TRAP_COST = 6 // stone
const TRAP_RADIUS = 60
const TRAP_DAMAGE = 5
const SPEAR_COST = { wood: 4, stone: 2 }

interface Node {
  id: number
  type: ResourceType
  x: number
  y: number
}

interface Shade {
  id: number
  dirX: number
  dirY: number
  travelled: number
  hp: number
  maxHp: number
  speed: number
  damage: number
  flashUntil: number
}

interface Projectile {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  damage: number
}

interface Wall {
  id: number
  x: number
  y: number
  hp: number
}

type Phase = 'day' | 'night'
type Status = 'ready' | 'playing' | 'over'

export default function NightsGame({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [status, setStatus] = useState<Status>('ready')
  const [phase, setPhase] = useState<Phase>('day')
  const [dayNumber, setDayNumber] = useState(1)
  const [bestNights, setBestNights] = useState(0)
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(DAY_SECONDS)
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 })
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP)
  const [campHp, setCampHp] = useState(CAMP_MAX_HP)
  const [hunger, setHunger] = useState(100)
  const [inventory, setInventory] = useState({ wood: 0, stone: 0, food: 0 })
  const [spearLevel, setSpearLevel] = useState(0)
  const [nodes, setNodes] = useState<Node[]>([])
  const [shades, setShades] = useState<Shade[]>([])
  const [projectiles, setProjectiles] = useState<Projectile[]>([])
  const [walls, setWalls] = useState<Wall[]>([])
  const [trapBuilt, setTrapBuilt] = useState(false)
  const [buildMode, setBuildMode] = useState<'none' | 'wall' | 'trap'>('none')
  const [toast, setToast] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)

  const statusRef = useRef<Status>('ready')
  const phaseRef = useRef<Phase>('day')
  const dayNumberRef = useRef(1)
  const playerPosRef = useRef({ x: 0, y: 0 })
  const playerHpRef = useRef(PLAYER_MAX_HP)
  const campHpRef = useRef(CAMP_MAX_HP)
  const hungerRef = useRef(100)
  const inventoryRef = useRef({ wood: 0, stone: 0, food: 0 })
  const spearLevelRef = useRef(0)
  const nodesRef = useRef<Node[]>([])
  const shadesRef = useRef<Shade[]>([])
  const projectilesRef = useRef<Projectile[]>([])
  const wallsRef = useRef<Wall[]>([])
  const trapRef = useRef(false)
  const trapTimerRef = useRef(0)
  const buildModeRef = useRef<'none' | 'wall' | 'trap'>('none')
  const keysRef = useRef<Set<string>>(new Set())
  const joystickVecRef = useRef({ x: 0, y: 0 })
  const joystickActiveRef = useRef(false)
  const gatherTimerRef = useRef(0)
  const hungerTickRef = useRef(0)
  const playerFireRef = useRef(0)
  const toSpawnRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const nextShadeId = useRef(0)
  const nextProjectileId = useRef(0)
  const nextWallId = useRef(0)
  const rafRef = useRef<number>(0)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setDims({ width: rect.width, height: rect.height })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    try {
      const b = parseInt(localStorage.getItem('jj-nights-best') || '0', 10)
      setBestNights(Number.isFinite(b) ? b : 0)
      const mutedSaved = localStorage.getItem('jj-nights-muted') === 'true'
      setMuted(mutedSaved)
      setSfxMuted(mutedSaved)
    } catch {
      // Fine -- best/mute preference just won't persist.
    }
  }, [])

  const toggleMuted = () => {
    const next = !isSfxMuted()
    setSfxMuted(next)
    setMuted(next)
    try {
      localStorage.setItem('jj-nights-muted', String(next))
    } catch {
      // Fine.
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        keysRef.current.add(e.key.toLowerCase())
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase())
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const center = () => ({ x: dims.width / 2, y: dims.height / 2 })

  const flashToast = (msg: string) => {
    setToast(msg)
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(null), 1800)
  }

  const makeNodes = (): Node[] => {
    const c = center()
    const list: Node[] = []
    let id = 0
    const types: ResourceType[] = ['wood', 'stone', 'food']
    for (const type of types) {
      for (let i = 0; i < 3; i++) {
        let x = 0
        let y = 0
        let tries = 0
        do {
          x = 40 + Math.random() * Math.max(dims.width - 80, 1)
          y = 40 + Math.random() * Math.max(dims.height - 80, 1)
          tries++
        } while (Math.hypot(x - c.x, y - c.y) < 90 && tries < 20)
        list.push({ id: id++, type, x, y })
      }
    }
    return list
  }

  const startRun = () => {
    if (dims.width === 0) return
    const c = center()
    playerPosRef.current = { ...c, y: c.y + 60 }
    setPlayerPos(playerPosRef.current)
    playerHpRef.current = PLAYER_MAX_HP
    setPlayerHp(PLAYER_MAX_HP)
    campHpRef.current = CAMP_MAX_HP
    setCampHp(CAMP_MAX_HP)
    hungerRef.current = 100
    setHunger(100)
    inventoryRef.current = { wood: 0, stone: 0, food: 0 }
    setInventory({ wood: 0, stone: 0, food: 0 })
    spearLevelRef.current = 0
    setSpearLevel(0)
    wallsRef.current = []
    setWalls([])
    trapRef.current = false
    setTrapBuilt(false)
    buildModeRef.current = 'none'
    setBuildMode('none')
    shadesRef.current = []
    setShades([])
    projectilesRef.current = []
    setProjectiles([])
    nodesRef.current = makeNodes()
    setNodes(nodesRef.current)
    dayNumberRef.current = 1
    setDayNumber(1)
    phaseRef.current = 'day'
    setPhase('day')
    setPhaseSecondsLeft(DAY_SECONDS)
    statusRef.current = 'playing'
    setStatus('playing')
    sfx.waveStart()
  }

  const beginNight = () => {
    phaseRef.current = 'night'
    setPhase('night')
    setPhaseSecondsLeft(NIGHT_SECONDS)
    toSpawnRef.current = 3 + dayNumberRef.current * 2
    spawnTimerRef.current = 0
    sfx.waveStart()
  }

  const beginDay = () => {
    dayNumberRef.current += 1
    setDayNumber(dayNumberRef.current)
    phaseRef.current = 'day'
    setPhase('day')
    setPhaseSecondsLeft(DAY_SECONDS)
    sfx.waveClear()
  }

  const endRun = () => {
    statusRef.current = 'over'
    setStatus('over')
    cancelAnimationFrame(rafRef.current)
    sfx.gameOver()
    const nights = dayNumberRef.current - 1
    if (nights > bestNights) {
      setBestNights(nights)
      try {
        localStorage.setItem('jj-nights-best', String(nights))
      } catch {
        // Fine.
      }
    }
  }

  // Phase countdown
  useEffect(() => {
    if (status !== 'playing') return
    if (phaseSecondsLeft <= 0) {
      if (phase === 'day') beginNight()
      else beginDay()
      return
    }
    const t = setTimeout(() => setPhaseSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, phase, phaseSecondsLeft])

  // Main simulation loop
  useEffect(() => {
    if (status !== 'playing') return

    const loop = () => {
      const c = center()

      // Movement
      let mx = 0
      let my = 0
      if (joystickActiveRef.current) {
        mx = joystickVecRef.current.x
        my = joystickVecRef.current.y
      } else {
        const k = keysRef.current
        if (k.has('w') || k.has('arrowup')) my -= 1
        if (k.has('s') || k.has('arrowdown')) my += 1
        if (k.has('a') || k.has('arrowleft')) mx -= 1
        if (k.has('d') || k.has('arrowright')) mx += 1
        const len = Math.hypot(mx, my)
        if (len > 0) {
          mx /= len
          my /= len
        }
      }
      let px = playerPosRef.current.x + mx * BASE_MOVE_SPEED
      let py = playerPosRef.current.y + my * BASE_MOVE_SPEED
      px = Math.max(PLAYER_SIZE / 2, Math.min(dims.width - PLAYER_SIZE / 2, px))
      py = Math.max(PLAYER_SIZE / 2, Math.min(dims.height - PLAYER_SIZE / 2, py))
      playerPosRef.current = { x: px, y: py }

      // Hunger ticks down; low hunger drains HP
      hungerTickRef.current -= 16
      if (hungerTickRef.current <= 0) {
        hungerRef.current = Math.max(0, hungerRef.current - 1)
        setHunger(hungerRef.current)
        hungerTickRef.current = 3000
        if (hungerRef.current <= 0) {
          playerHpRef.current = Math.max(0, playerHpRef.current - 2)
        }
      }

      // Gather from nearby nodes (day only)
      if (phaseRef.current === 'day') {
        gatherTimerRef.current -= 1
        if (gatherTimerRef.current <= 0) {
          for (const node of nodesRef.current) {
            if (Math.hypot(node.x - playerPosRef.current.x, node.y - playerPosRef.current.y) < GATHER_RADIUS) {
              inventoryRef.current = { ...inventoryRef.current, [node.type]: inventoryRef.current[node.type] + 1 }
              setInventory(inventoryRef.current)
              gatherTimerRef.current = GATHER_INTERVAL
              break
            }
          }
          if (gatherTimerRef.current <= 0) gatherTimerRef.current = 8
        }
      }

      const spawnRadius = Math.max(dims.width, dims.height)

      // Night: spawn shades gradually
      if (phaseRef.current === 'night') {
        spawnTimerRef.current -= 1
        if (toSpawnRef.current > 0 && spawnTimerRef.current <= 0) {
          const angle = Math.random() * Math.PI * 2
          const dayN = dayNumberRef.current
          shadesRef.current.push({
            id: nextShadeId.current++,
            dirX: Math.cos(angle),
            dirY: Math.sin(angle),
            travelled: 0,
            hp: 16 + dayN * 5,
            maxHp: 16 + dayN * 5,
            speed: 0.75 + Math.min(dayN * 0.04, 0.7),
            damage: 6 + Math.min(dayN, 10),
            flashUntil: 0
          })
          toSpawnRef.current -= 1
          spawnTimerRef.current = 32
        }
      }

      // Shade movement + collision
      const nextShades: Shade[] = []
      for (const sh of shadesRef.current) {
        if (sh.flashUntil > 0) sh.flashUntil -= 1
        const distFromCenter = spawnRadius - sh.travelled
        const sx = c.x + sh.dirX * distFromCenter
        const sy = c.y + sh.dirY * distFromCenter

        let blockingWall: Wall | null = null
        let blockingDist = 22
        for (const w of wallsRef.current) {
          if (w.hp <= 0) continue
          const d = Math.hypot(sx - w.x, sy - w.y)
          if (d < blockingDist) {
            blockingDist = d
            blockingWall = w
          }
        }

        if (blockingWall) {
          blockingWall.hp -= sh.damage * 0.12
          if (blockingWall.hp < 0) blockingWall.hp = 0
        } else {
          sh.travelled += sh.speed
        }

        const dist2 = spawnRadius - sh.travelled
        const fx = c.x + sh.dirX * dist2
        const fy = c.y + sh.dirY * dist2

        if (dist2 <= 14) {
          campHpRef.current = Math.max(0, campHpRef.current - sh.damage * 0.12)
        }
        if (Math.hypot(fx - playerPosRef.current.x, fy - playerPosRef.current.y) < CONTACT_RADIUS) {
          playerHpRef.current = Math.max(0, playerHpRef.current - sh.damage * 0.1)
        }

        if (sh.hp > 0) nextShades.push(sh)
      }
      shadesRef.current = nextShades
      wallsRef.current = wallsRef.current.filter((w) => w.hp > 0)

      // Trap pulse
      if (trapRef.current) {
        trapTimerRef.current -= 16
        if (trapTimerRef.current <= 0) {
          for (const sh of shadesRef.current) {
            const dist2 = spawnRadius - sh.travelled
            if (dist2 <= TRAP_RADIUS) sh.hp -= TRAP_DAMAGE
          }
          trapTimerRef.current = 900
        }
      }

      // Player auto-attack at night
      if (phaseRef.current === 'night') {
        playerFireRef.current -= 16
        if (playerFireRef.current <= 0) {
          let nearest: Shade | null = null
          let nearestDist = PLAYER_RANGE
          let nearestPos = { x: 0, y: 0 }
          for (const sh of shadesRef.current) {
            const dist2 = spawnRadius - sh.travelled
            const fx = c.x + sh.dirX * dist2
            const fy = c.y + sh.dirY * dist2
            const d = Math.hypot(fx - playerPosRef.current.x, fy - playerPosRef.current.y)
            if (d < nearestDist) {
              nearestDist = d
              nearest = sh
              nearestPos = { x: fx, y: fy }
            }
          }
          if (nearest) {
            const ang = Math.atan2(nearestPos.y - playerPosRef.current.y, nearestPos.x - playerPosRef.current.x)
            projectilesRef.current.push({
              id: nextProjectileId.current++,
              x: playerPosRef.current.x,
              y: playerPosRef.current.y,
              vx: Math.cos(ang) * PROJECTILE_SPEED,
              vy: Math.sin(ang) * PROJECTILE_SPEED,
              damage: 10 + spearLevelRef.current * 6
            })
            sfx.playerShoot()
            playerFireRef.current = 420
          }
        }
      }

      // Move projectiles + collide
      const nextProjectiles: Projectile[] = []
      for (const p of projectilesRef.current) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -20 || p.x > dims.width + 20 || p.y < -20 || p.y > dims.height + 20) continue
        let hit = false
        for (const sh of shadesRef.current) {
          const dist2 = spawnRadius - sh.travelled
          const fx = c.x + sh.dirX * dist2
          const fy = c.y + sh.dirY * dist2
          if (Math.hypot(p.x - fx, p.y - fy) < 13) {
            sh.hp -= p.damage
            sh.flashUntil = 6
            hit = true
            sfx.hit()
            if (sh.hp <= 0) sfx.fiendDeath()
            break
          }
        }
        if (!hit) nextProjectiles.push(p)
      }
      projectilesRef.current = nextProjectiles
      shadesRef.current = shadesRef.current.filter((sh) => sh.hp > 0)

      setPlayerPos({ ...playerPosRef.current })
      setShades([...shadesRef.current])
      setProjectiles([...projectilesRef.current])
      setWalls([...wallsRef.current])
      setPlayerHp(playerHpRef.current)
      setCampHp(campHpRef.current)

      if (playerHpRef.current <= 0 || campHpRef.current <= 0) {
        endRun()
        return
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dims.width, dims.height])

  const eatFood = () => {
    if (inventoryRef.current.food <= 0) {
      flashToast('No food to eat')
      return
    }
    if (hungerRef.current >= 90) {
      flashToast('Not hungry enough')
      return
    }
    inventoryRef.current = { ...inventoryRef.current, food: inventoryRef.current.food - 1 }
    setInventory(inventoryRef.current)
    hungerRef.current = Math.min(100, hungerRef.current + 30)
    setHunger(hungerRef.current)
    sfx.upgrade()
  }

  const craftSpear = () => {
    if (inventoryRef.current.wood < SPEAR_COST.wood || inventoryRef.current.stone < SPEAR_COST.stone) {
      flashToast(`Need ${SPEAR_COST.wood} Wood + ${SPEAR_COST.stone} Stone`)
      return
    }
    inventoryRef.current = {
      ...inventoryRef.current,
      wood: inventoryRef.current.wood - SPEAR_COST.wood,
      stone: inventoryRef.current.stone - SPEAR_COST.stone
    }
    setInventory(inventoryRef.current)
    spearLevelRef.current += 1
    setSpearLevel(spearLevelRef.current)
    sfx.upgrade()
  }

  const handleArenaClick = (x: number, y: number) => {
    if (statusRef.current !== 'playing' || buildModeRef.current === 'none') return

    if (buildModeRef.current === 'wall') {
      if (inventoryRef.current.wood < WALL_COST) {
        flashToast(`Need ${WALL_COST} Wood`)
        return
      }
      inventoryRef.current = { ...inventoryRef.current, wood: inventoryRef.current.wood - WALL_COST }
      setInventory(inventoryRef.current)
      wallsRef.current.push({ id: nextWallId.current++, x, y, hp: WALL_TIER_HP[1] })
      setWalls([...wallsRef.current])
      sfx.place()
    } else if (buildModeRef.current === 'trap') {
      if (trapRef.current) {
        flashToast('Already built a Spike Trap')
        return
      }
      if (inventoryRef.current.stone < TRAP_COST) {
        flashToast(`Need ${TRAP_COST} Stone`)
        return
      }
      inventoryRef.current = { ...inventoryRef.current, stone: inventoryRef.current.stone - TRAP_COST }
      setInventory(inventoryRef.current)
      trapRef.current = true
      setTrapBuilt(true)
      sfx.place()
    }
  }

  const joystickBaseRef = useRef<HTMLDivElement>(null)
  const handleJoystickDown = (e: React.PointerEvent) => {
    joystickActiveRef.current = true
    handleJoystickMove(e)
  }
  const handleJoystickMove = (e: React.PointerEvent) => {
    if (!joystickActiveRef.current || !joystickBaseRef.current) return
    const rect = joystickBaseRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = (e.clientX - cx) / (rect.width / 2)
    let dy = (e.clientY - cy) / (rect.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > 1) {
      dx /= len
      dy /= len
    }
    joystickVecRef.current = { x: dx, y: dy }
  }
  const handleJoystickUp = () => {
    joystickActiveRef.current = false
    joystickVecRef.current = { x: 0, y: 0 }
  }

  const c = dims.width > 0 ? center() : { x: 0, y: 0 }
  const spawnRadius = Math.max(dims.width, dims.height)

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] overflow-hidden bg-gradient-to-b from-black via-emerald-950 to-black"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        Close ✕
      </button>
      <button
        onClick={toggleMuted}
        title={muted ? 'Unmute' : 'Mute'}
        className="absolute top-4 right-24 z-[120] rounded-full border border-accent/50 bg-black/80 px-3 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        {muted ? '🔇' : '🔊'}
      </button>

      <div className="pointer-events-none absolute top-4 left-1/2 z-[101] -translate-x-1/2 text-center">
        <h2 className="text-xl font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.6)] sm:text-2xl">
          🏕️ 999 Nights
        </h2>
        {status === 'playing' && (
          <p className="mt-1 font-mono text-sm text-white">
            {phase === 'day' ? '☀️ Day' : '🌙 Night'} {dayNumber} &nbsp;·&nbsp; {phaseSecondsLeft}s &nbsp;·&nbsp; Best: {bestNights}
          </p>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none absolute top-20 left-1/2 z-[115] -translate-x-1/2 rounded-full border border-red-400/50 bg-black/90 px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}

      {status === 'playing' && (
        <>
          <div className="pointer-events-none absolute top-16 left-1/2 z-[101] flex -translate-x-1/2 flex-col items-center gap-1">
            <div className="flex gap-4">
              <div className="w-28">
                <p className="mb-0.5 text-center text-[10px] text-white/60">YOU</p>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-green-400" style={{ width: `${(playerHp / PLAYER_MAX_HP) * 100}%` }} />
                </div>
              </div>
              <div className="w-28">
                <p className="mb-0.5 text-center text-[10px] text-white/60">CAMP</p>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-blue-400" style={{ width: `${(campHp / CAMP_MAX_HP) * 100}%` }} />
                </div>
              </div>
              <div className="w-28">
                <p className="mb-0.5 text-center text-[10px] text-white/60">HUNGER</p>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-orange-400" style={{ width: `${hunger}%` }} />
                </div>
              </div>
            </div>
            <p className="mt-1 font-mono text-xs text-white/80">
              🌳{inventory.wood} &nbsp;🪨{inventory.stone} &nbsp;🍓{inventory.food}
            </p>
          </div>

          <div
            className={`absolute inset-0 z-10 ${buildMode !== 'none' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
            onClick={(e) => {
              e.stopPropagation()
              handleArenaClick(e.clientX, e.clientY)
            }}
          >
            {dims.width > 0 && (
              <>
                {trapBuilt && (
                  <div
                    className="absolute rounded-full border border-orange-400/40 bg-orange-500/5"
                    style={{ left: c.x - TRAP_RADIUS, top: c.y - TRAP_RADIUS, width: TRAP_RADIUS * 2, height: TRAP_RADIUS * 2 }}
                  />
                )}

                <div className="absolute flex items-center justify-center text-3xl" style={{ left: c.x - 18, top: c.y - 18, width: 36, height: 36 }}>
                  🔥
                </div>

                {nodes.map((n) => (
                  <div
                    key={n.id}
                    className="absolute flex items-center justify-center text-2xl"
                    style={{ left: n.x - 16, top: n.y - 16, width: 32, height: 32 }}
                  >
                    {RESOURCE_DEFS[n.type].icon}
                  </div>
                ))}

                {walls.map((w) => (
                  <div
                    key={w.id}
                    className="absolute rounded-md border-2 border-amber-600 bg-amber-700/40"
                    style={{ left: w.x - 13, top: w.y - 13, width: 26, height: 26 }}
                  />
                ))}

                {shades.map((sh) => {
                  const dist2 = spawnRadius - sh.travelled
                  const fx = c.x + sh.dirX * dist2
                  const fy = c.y + sh.dirY * dist2
                  return (
                    <div key={sh.id} className="absolute" style={{ transform: `translate3d(${fx - 13}px, ${fy - 13}px, 0)` }}>
                      <ShadeSvg flashed={sh.flashUntil > 0} />
                      <div className="mt-0.5 h-1 w-full rounded-full bg-white/10">
                        <div className="h-1 rounded-full bg-purple-400" style={{ width: `${(sh.hp / sh.maxHp) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}

                {projectiles.map((p) => (
                  <div
                    key={p.id}
                    className="absolute h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_currentColor] text-accent"
                    style={{ transform: `translate3d(${p.x - 1}px, ${p.y - 1}px, 0)` }}
                  />
                ))}

                <div
                  className="absolute flex items-center justify-center text-2xl"
                  style={{ transform: `translate3d(${playerPos.x - PLAYER_SIZE / 2}px, ${playerPos.y - PLAYER_SIZE / 2}px, 0)`, width: PLAYER_SIZE, height: PLAYER_SIZE }}
                >
                  🧍
                </div>
              </>
            )}
          </div>

          <div
            ref={joystickBaseRef}
            onPointerDown={handleJoystickDown}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickUp}
            onPointerCancel={handleJoystickUp}
            className="absolute bottom-24 left-8 z-[105] h-24 w-24 touch-none rounded-full border border-white/20 bg-white/5"
          />

          <div
            className="pointer-events-auto absolute bottom-0 left-0 right-0 z-[110] border-t border-accent/30 bg-black/90 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setBuildMode(buildMode === 'wall' ? 'none' : 'wall')}
                className={`rounded-full border px-3 py-1.5 text-xs text-white ${buildMode === 'wall' ? 'border-accent bg-accent/20' : 'border-white/20 bg-black/60'}`}
              >
                🧱 Wall ({WALL_COST} Wood)
              </button>
              <button
                onClick={() => setBuildMode(buildMode === 'trap' ? 'none' : 'trap')}
                disabled={trapBuilt}
                className={`rounded-full border px-3 py-1.5 text-xs text-white disabled:opacity-40 ${buildMode === 'trap' ? 'border-accent bg-accent/20' : 'border-white/20 bg-black/60'}`}
              >
                {trapBuilt ? 'Trap Built ✓' : `🪤 Spike Trap (${TRAP_COST} Stone)`}
              </button>
              <button onClick={craftSpear} className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white">
                🔪 Sharpen Spear T{spearLevel} ({SPEAR_COST.wood}🌳+{SPEAR_COST.stone}🪨)
              </button>
              <button onClick={eatFood} className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white">
                🍓 Eat
              </button>
            </div>
            {buildMode !== 'none' && (
              <p className="mt-1 text-center text-[10px] text-white/50">Tap the map to place it</p>
            )}
          </div>
        </>
      )}

      {(status === 'ready' || status === 'over') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          {status === 'over' && (
            <p className="font-mono text-white/80">You survived {Math.max(0, dayNumber - 1)} nights &nbsp;·&nbsp; Best: {bestNights}</p>
          )}
          <p className="text-2xl font-bold text-white">{status === 'ready' ? 'Survive the Nights' : 'You Perished'}</p>
          <p className="max-w-sm text-sm text-white/60">
            Gather Wood, Stone and Food by day. Build walls and a trap, sharpen your spear, and defend your camp
            when the Shades come out at night.
          </p>
          <button onClick={startRun} className="btn-primary mt-2 px-8 py-3">
            {status === 'ready' ? 'Start' : 'Play Again'}
          </button>
        </div>
      )}
    </div>
  )
}
