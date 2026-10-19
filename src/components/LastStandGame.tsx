'use client'

import { useEffect, useRef, useState } from 'react'
import { pickRandomCreature, getCreature, CREATURES } from '../../lib/creatures'
import { sfx, setSfxMuted, isSfxMuted } from '../../lib/sfx'
import { AblyRoom, randomRoomCode } from '../../lib/ablyRoom'
import CreatureSvg from './CreatureSvg'
import CharacterUnlockPaywall from './CharacterUnlockPaywall'

// Original top-down survival-defense mini-game -- own art, own name, own
// mechanics (auto-fire + a buildable base), not a reskin of any existing
// title. "Fiends" are simple original dark-blob enemies, not zombies drawn
// from any specific game's designs.

// Sizes roughly doubled across the board -- fiends read as too small at
// the old scale. Also doubles as each kind's hit radius (see
// `FIEND_VISUALS[f.kind].size / 2` at the hit-test below), so bumping
// this scales hitboxes proportionally too, not just the art.
const FIEND_VISUALS: Record<FiendKind, { body: string; stroke: string; eye: string; size: number }> = {
  shambler: { body: '#1f1333', stroke: '#7c3aed', eye: '#ef4444', size: 60 },
  runner: { body: '#1a2e1f', stroke: '#22c55e', eye: '#4ade80', size: 46 },
  brute: { body: '#2e1414', stroke: '#b91c1c', eye: '#f97316', size: 84 },
  spitter: { body: '#13232e', stroke: '#0ea5e9', eye: '#67e8f9', size: 56 },
  flyer: { body: '#2e0f14', stroke: '#ef4444', eye: '#f97316', size: 72 },
  // Boss is the "big mushroom" version -- same approach already used here
  // (just a much bigger instance of the same base enemy), pushed further
  // now that the baseline itself is bigger.
  boss: { body: '#1a0a1f', stroke: '#fbbf24', eye: '#facc15', size: 130 }
}


// Every Fiend kind uses this same Mushroom run cycle for now (Mushroom run
// cycle from MonoPixelArt's "Forest Monsters" pack, free tier, commercial
// use allowed -- see public/games/fiends/LICENSE-monopixelart-forest-
// monsters.txt), sized per `kind` via FIEND_VISUALS -- only art asset on
// hand right now, more kind-specific creatures to follow. The boss wave's
// "big mushroom" is just this same sprite at FIEND_VISUALS.boss's much
// larger size, same approach already used for every other kind. 8 frames,
// 80px each, same single-row-strip + CSS background-position technique as
// FlyerSprite above.
const MUSHROOM_FRAME_W = 80
const MUSHROOM_FRAME_H = 64
const MUSHROOM_FRAME_COUNT = 8

function MushroomSprite({ kind, facingLeft, flashed }: { kind: FiendKind; facingLeft: boolean; flashed: boolean }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % MUSHROOM_FRAME_COUNT), 110)
    return () => clearInterval(t)
  }, [])
  const size = FIEND_VISUALS[kind].size
  const scale = size / MUSHROOM_FRAME_H
  return (
    <div
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        filter: flashed ? 'brightness(2.4) saturate(0.4)' : 'drop-shadow(0 0 6px rgba(239,68,68,0.6))',
        transform: facingLeft ? 'scaleX(-1)' : 'none'
      }}
    >
      <div
        style={{
          width: MUSHROOM_FRAME_W * scale,
          height: MUSHROOM_FRAME_H * scale,
          backgroundImage: 'url(/games/fiends/mushroom-run.png)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${MUSHROOM_FRAME_W * MUSHROOM_FRAME_COUNT * scale}px ${MUSHROOM_FRAME_H * scale}px`,
          backgroundPosition: `-${frame * MUSHROOM_FRAME_W * scale}px 0`,
          imageRendering: 'pixelated'
        }}
      />
    </div>
  )
}

function HeartSvg() {
  return (
    <svg width="34" height="30" viewBox="0 0 34 30" className="drop-shadow-[0_0_10px_rgba(57,255,20,0.7)]">
      <path
        d="M17,28 C17,28 2,18.5 2,9.5 C2,4.5 6,1 10,1 C13,1 16,3 17,6 C18,3 21,1 24,1 C28,1 32,4.5 32,9.5 C32,18.5 17,28 17,28 Z"
        fill="#39ff14"
        fillOpacity="0.85"
        stroke="#39ff14"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function TurretSvg({ tier, type }: { tier: number; type: 'gatling' | 'cannon' }) {
  const color = tier >= 3 ? '#fbbf24' : tier === 2 ? '#60a5fa' : '#9ca3af'
  const isCannon = type === 'cannon'
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" className="drop-shadow-[0_0_6px_currentColor]" style={{ color }}>
      <circle cx="13" cy="13" r="9" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" />
      {isCannon ? (
        <rect x="9.5" y="1" width="7" height="13" rx="2" fill="currentColor" />
      ) : (
        <>
          <rect x="10" y="2" width="2.2" height="12" rx="1" fill="currentColor" />
          <rect x="13.4" y="2" width="2.2" height="12" rx="1" fill="currentColor" />
        </>
      )}
    </svg>
  )
}

const BASE_MOVE_SPEED = 2.9
const PLAYER_SIZE = 30
const PLAYER_MAX_HP = 100
const BASE_MAX_HP = 150
const PLAYER_RANGE = 230
const PROJECTILE_SPEED = 8
const CONTACT_RADIUS = 24
const BUILD_SECONDS = 18
const MILESTONE_WAVE = 5

const WALL_TIER_HP = [0, 40, 85, 150]
const WALL_TIER_COST = [0, 15, 25, 45]
// Free placement, not fixed slots -- clicking within this radius of an
// existing wall upgrades it instead of placing a new one; otherwise a new
// wall goes down wherever you clicked, up to MAX_WALLS.
const WALL_UPGRADE_RADIUS = 30
const WALL_HIT_RADIUS = 20
const MAX_WALLS = 10

const TURRET_TIER_COST = [0, 30, 40, 65]
const TURRET_UPGRADE_RADIUS = 30
const TURRET_RANGE = 190
const MAX_TURRETS = 4
// Gatling: fast, single-target. Cannon: slow, splash damage on impact.
const TURRET_STATS: Record<'gatling' | 'cannon', { damage: number[]; cooldown: number[]; splash: number }> = {
  gatling: { damage: [0, 8, 14, 22], cooldown: [0, 420, 320, 230], splash: 0 },
  cannon: { damage: [0, 16, 28, 44], cooldown: [0, 1100, 850, 650], splash: 46 }
}

const TRAP_TIER_COST = [0, 25, 45]
const TRAP_TIER_DAMAGE = [0, 4, 9]
const TRAP_RADIUS = 70
const BOSS_WAVE_INTERVAL = 5

// The buildable "ring" around the heart -- walls and turrets can only be
// placed within this radius. Expandable through the build-phase shop as
// you survive more waves.
const RING_RADII = [160, 200, 240, 280]
const RING_UPGRADE_COST = [0, 40, 70, 110]

type FiendKind = 'shambler' | 'runner' | 'brute' | 'spitter' | 'flyer' | 'boss'

interface Fiend {
  id: number
  dirX: number
  dirY: number
  kind: FiendKind
  travelled: number
  hp: number
  maxHp: number
  speed: number
  damage: number
  flashUntil: number
  spitCooldown: number
}

interface Wall {
  id: number
  x: number
  y: number
  tier: number
  hp: number
}

interface Turret {
  id: number
  x: number
  y: number
  type: 'gatling' | 'cannon'
  tier: number
  fireCooldown: number
}

interface Projectile {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  owner: 'player' | 'turret' | 'enemy'
  splash: number
}

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

// Weighted so early waves are mostly the baseline Shambler, with Runners
// mixed in; Brutes show up from wave 3, ranged Spitters from wave 4. Boss
// is never picked here -- it's spawned deliberately on boss waves. The
// tougher kinds' weight keeps climbing (capped) as waves go on, so late
// waves actually feel different, not just bigger numbers of the same mix.
function pickFiendKind(wave: number): FiendKind {
  const options: Array<{ kind: FiendKind; weight: number }> = [
    { kind: 'shambler', weight: 50 },
    { kind: 'runner', weight: 30 },
    { kind: 'brute', weight: wave >= 3 ? 15 + Math.min(wave, 40) : 0 },
    { kind: 'spitter', weight: wave >= 4 ? 12 + Math.min(wave * 0.8, 30) : 0 },
    { kind: 'flyer', weight: wave >= 2 ? 14 + Math.min(wave, 35) : 0 }
  ]
  const total = options.reduce((sum, o) => sum + o.weight, 0)
  let roll = Math.random() * total
  for (const o of options) {
    if (roll < o.weight) return o.kind
    roll -= o.weight
  }
  return 'shambler'
}

const FIEND_KIND_MULT: Record<FiendKind, { hp: number; speed: number; damage: number }> = {
  shambler: { hp: 1, speed: 1, damage: 1 },
  runner: { hp: 0.55, speed: 1.6, damage: 0.7 },
  brute: { hp: 2.3, speed: 0.55, damage: 1.6 },
  spitter: { hp: 0.8, speed: 0.65, damage: 1 },
  flyer: { hp: 0.7, speed: 1.25, damage: 0.9 },
  boss: { hp: 9, speed: 0.5, damage: 2.4 }
}

const SPITTER_STOP_DISTANCE = 110
const SPITTER_COOLDOWN = 1400

interface ItemDef {
  id: 'wall' | 'turret' | 'damage' | 'firerate' | 'speed' | 'juice' | 'repair'
  icon: string
  name: string
  desc: string
}

// A free pick after every wave, on top of the Juice shop -- three random
// options, pick one. Keeps a wave-clear feeling like a reward instead of
// just a shopping stop.
const ITEM_POOL: ItemDef[] = [
  { id: 'wall', icon: '🛡️', name: 'Wall Plating', desc: 'Reinforces your weakest wall by one tier.' },
  { id: 'turret', icon: '🔧', name: 'Turret Parts', desc: 'Upgrades your weakest turret, or builds a new one.' },
  { id: 'damage', icon: '💥', name: 'Sharpened Rounds', desc: '+6 damage to your auto-fire.' },
  { id: 'firerate', icon: '🔁', name: 'Quick Trigger', desc: 'Faster auto-fire cooldown.' },
  { id: 'speed', icon: '⚡', name: 'Energy Drink', desc: 'Move faster.' },
  { id: 'juice', icon: '🧪', name: 'Juice Stash', desc: '+30 bonus Juice.' },
  { id: 'repair', icon: '❤️', name: 'Repair Kit', desc: 'Fully heals your base and yourself.' }
]

export default function LastStandGame({
  caughtTypes,
  visitorId,
  onClose
}: {
  caughtTypes: string[]
  visitorId: string
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [status, setStatus] = useState<'ready' | 'playing' | 'build' | 'over'>('ready')

  // Co-op: one browser is "host" (runs the real simulation, broadcasts
  // state over Ably); the other is "guest" (sends movement input, renders
  // whatever the host sends -- no local simulation). Solo is unchanged.
  const [mpRole, setMpRole] = useState<'solo' | 'host' | 'guest'>('solo')
  const [mpRoomCode, setMpRoomCode] = useState('')
  const [mpJoinInput, setMpJoinInput] = useState('')
  const [mpConnStatus, setMpConnStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [peerPresent, setPeerPresent] = useState(false)
  const [peerPos, setPeerPos] = useState({ x: 0, y: 0 })
  const [peerHp, setPeerHp] = useState(PLAYER_MAX_HP)

  const mpRoleRef = useRef<'solo' | 'host' | 'guest'>('solo')
  const ablyRoomRef = useRef<AblyRoom | null>(null)
  const guestInputRef = useRef({ x: 0, y: 0 })
  const guestPosRef = useRef({ x: 0, y: 0 })
  const guestHpRef = useRef(PLAYER_MAX_HP)
  const guestFireRef = useRef(0)
  const broadcastCounterRef = useRef(0)
  const peerPresentRef = useRef(false)
  const [wave, setWave] = useState(0)
  const [bestWave, setBestWave] = useState(0)
  const [leaderboard, setLeaderboard] = useState<Array<{ name: string; wave: number }>>([])
  const [juice, setJuice] = useState(0)
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP)
  const [baseHp, setBaseHp] = useState(BASE_MAX_HP)
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 })
  const [fiends, setFiends] = useState<Fiend[]>([])
  const [projectiles, setProjectiles] = useState<Projectile[]>([])
  const [enemyProjectiles, setEnemyProjectiles] = useState<Projectile[]>([])
  const [walls, setWalls] = useState<Wall[]>([])
  const [turrets, setTurrets] = useState<Turret[]>([])
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const [placementMode, setPlacementMode] = useState<'wall' | 'gatling' | 'cannon'>('wall')
  const [ringTier, setRingTier] = useState(0)
  const [trapTier, setTrapTier] = useState(0)
  const [buildSecondsLeft, setBuildSecondsLeft] = useState(BUILD_SECONDS)
  const [itemChoices, setItemChoices] = useState<ItemDef[]>([])
  const [itemClaimed, setItemClaimed] = useState(false)
  const [claimedItemName, setClaimedItemName] = useState<string | null>(null)
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null)
  const [buildToast, setBuildToast] = useState<string | null>(null)
  const buildToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [playerStats, setPlayerStats] = useState({ damage: 12, fireCooldown: 460, speedMult: 1 })
  const [upgradeLevels, setUpgradeLevels] = useState({ damage: 0, firerate: 0, speed: 0 })
  const [selectedAvatar, setSelectedAvatar] = useState('juicebox')
  const [zombieUnlocked, setZombieUnlocked] = useState(false)
  const [showZombiePaywall, setShowZombiePaywall] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 })
  const [bossActive, setBossActive] = useState(false)
  const [muted, setMuted] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [peerDisconnected, setPeerDisconnected] = useState<'host' | 'guest' | null>(null)

  const statusRef = useRef<'ready' | 'playing' | 'build' | 'over'>('ready')
  const waveRef = useRef(0)
  const playerPosRef = useRef({ x: 0, y: 0 })
  const playerHpRef = useRef(PLAYER_MAX_HP)
  const baseHpRef = useRef(BASE_MAX_HP)
  const juiceRef = useRef(0)
  const fiendsRef = useRef<Fiend[]>([])
  const projectilesRef = useRef<Projectile[]>([])
  const enemyProjectilesRef = useRef<Projectile[]>([])
  const particlesRef = useRef<Particle[]>([])
  const nextParticleId = useRef(0)
  const wallsRef = useRef<Wall[]>([])
  const nextWallId = useRef(0)
  const turretsRef = useRef<Turret[]>([])
  const nextTurretId = useRef(0)
  const ringTierRef = useRef(0)
  const trapTierRef = useRef(0)
  const trapTimerRef = useRef(0)
  const playerStatsRef = useRef(playerStats)
  const upgradeLevelsRef = useRef(upgradeLevels)
  const keysRef = useRef<Set<string>>(new Set())
  const joystickVecRef = useRef({ x: 0, y: 0 })
  const joystickActiveRef = useRef(false)
  const playerFireRef = useRef(0)
  const nextFiendId = useRef(0)
  const nextProjectileId = useRef(0)
  const toSpawnRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const shakeFramesRef = useRef(0)
  const bossSpawnedRef = useRef(false)
  const lastBaseHpRef = useRef(BASE_MAX_HP)
  const lastPlayerHpRef = useRef(PLAYER_MAX_HP)
  const rafRef = useRef<number>(0)
  const milestoneHitRef = useRef(false)

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
      const saved = localStorage.getItem('jj-laststand-best-wave')
      if (saved) setBestWave(parseInt(saved, 10) || 0)
      const mutedSaved = localStorage.getItem('jj-laststand-muted') === 'true'
      setMuted(mutedSaved)
      setSfxMuted(mutedSaved)
    } catch {
      // Fine -- best wave/mute preference just won't persist for this visitor.
    }
    fetchLeaderboard()
    fetch('/api/digital/status?feature=hooded-character')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.unlocked) setZombieUnlocked(true)
      })
      .catch(() => {})
  }, [])

  const fetchLeaderboard = () => {
    fetch('/api/laststand/leaderboard')
      .then((r) => r.json())
      .then((d) => setLeaderboard(Array.isArray(d) ? d : []))
      .catch(() => {})
  }

  const toggleMuted = () => {
    const next = !isSfxMuted()
    setSfxMuted(next)
    setMuted(next)
    try {
      localStorage.setItem('jj-laststand-muted', String(next))
    } catch {
      // Fine -- preference just won't persist.
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

  // Co-op lobby: create or join a room, wire up presence + the message
  // handlers each role actually needs. Connection itself is role-agnostic;
  // what differs is which events each side subscribes to below.
  const connectRoom = async (code: string, role: 'host' | 'guest') => {
    setMpConnStatus('connecting')
    try {
      const clientId = `${role}-${Math.random().toString(36).slice(2, 10)}`
      const room = await AblyRoom.connect(code, clientId)
      ablyRoomRef.current = room
      mpRoleRef.current = role
      setMpRole(role)
      setMpRoomCode(code)
      setMpConnStatus('connected')

      room.onPresence((members) => {
        const otherRole = role === 'host' ? 'guest' : 'host'
        const present = members.some((m) => (m.data as any)?.role === otherRole)
        const wasPresent = peerPresentRef.current
        peerPresentRef.current = present
        setPeerPresent(present)

        // Tell whoever's still here when the other side drops mid-run --
        // the game doesn't freeze or silently stall, it just says so. This
        // is sticky (not an auto-fading toast) since it matters more than
        // a purchase rejection and the player might not be looking right
        // when it happens.
        if (wasPresent && !present && statusRef.current !== 'ready') {
          setPeerDisconnected(otherRole)
        } else if (present) {
          setPeerDisconnected(null)
        }
      })
      room.enterPresence({ role })

      if (role === 'host') {
        room.subscribe('input', (data) => {
          guestInputRef.current = { x: data.x, y: data.y }
        })
      } else {
        room.subscribe('state', (data) => applyGuestSnapshot(data))
      }
    } catch (err) {
      console.error('Ably connect error:', err)
      setMpConnStatus('error')
    }
  }

  const applyGuestSnapshot = (s: any) => {
    setStatus(s.status)
    statusRef.current = s.status
    setWave(s.wave)
    setJuice(s.juice)
    setBaseHp(s.baseHp)
    setBossActive(s.bossActive)
    setBuildSecondsLeft(s.buildSecondsLeft)
    setPlayerPos(s.guestPos)
    setPlayerHp(s.guestHp)
    setPeerPos(s.hostPos)
    setPeerHp(s.hostHp)
    setFiends(s.fiends)
    setProjectiles(s.projectiles)
    setEnemyProjectiles(s.enemyProjectiles)
    setWalls(s.walls)
    setTurrets(s.turrets)
    setTrapTier(s.trapTier)
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

  const startRun = () => {
    if (dims.width === 0) return
    if (mpRoleRef.current === 'guest') return // guest waits for the host's broadcast instead
    setPeerDisconnected(null)
    const c = center()
    playerPosRef.current = { ...c, x: c.x - 30 }
    setPlayerPos(playerPosRef.current)
    playerHpRef.current = PLAYER_MAX_HP
    setPlayerHp(PLAYER_MAX_HP)
    guestPosRef.current = { ...c, x: c.x + 30 }
    guestHpRef.current = PLAYER_MAX_HP
    setPeerPos(guestPosRef.current)
    setPeerHp(PLAYER_MAX_HP)
    baseHpRef.current = BASE_MAX_HP
    setBaseHp(BASE_MAX_HP)
    juiceRef.current = 0
    setJuice(0)
    wallsRef.current = []
    setWalls([])
    turretsRef.current = []
    setTurrets([])
    ringTierRef.current = 0
    setRingTier(0)
    setPlacementMode('wall')
    trapTierRef.current = 0
    setTrapTier(0)
    playerStatsRef.current = { damage: 12, fireCooldown: 460, speedMult: 1 }
    setPlayerStats(playerStatsRef.current)
    upgradeLevelsRef.current = { damage: 0, firerate: 0, speed: 0 }
    setUpgradeLevels(upgradeLevelsRef.current)
    fiendsRef.current = []
    setFiends([])
    projectilesRef.current = []
    setProjectiles([])
    enemyProjectilesRef.current = []
    setEnemyProjectiles([])
    particlesRef.current = []
    setParticles([])
    lastBaseHpRef.current = BASE_MAX_HP
    lastPlayerHpRef.current = PLAYER_MAX_HP
    milestoneHitRef.current = false
    setBuildToast(null)
    waveRef.current = 0
    setWave(0)
    startWave(1)
  }

  const startWave = (n: number) => {
    sfx.waveStart()
    waveRef.current = n
    setWave(n)
    const isBossWave = n % BOSS_WAVE_INTERVAL === 0
    setBossActive(isBossWave)
    bossSpawnedRef.current = false
    toSpawnRef.current = isBossWave ? 4 : 5 + n * 2
    spawnTimerRef.current = 0
    statusRef.current = 'playing'
    setStatus('playing')
  }

  const beginBuildPhase = () => {
    sfx.waveClear()
    statusRef.current = 'build'
    setStatus('build')
    setBuildSecondsLeft(BUILD_SECONDS)
    setItemChoices([...ITEM_POOL].sort(() => Math.random() - 0.5).slice(0, 3))
    setItemClaimed(false)
    setClaimedItemName(null)

    if (!milestoneHitRef.current && waveRef.current >= MILESTONE_WAVE) {
      milestoneHitRef.current = true
      if (visitorId) {
        const def = pickRandomCreature()
        fetch('/api/creatures/catch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId, creatureType: def.type })
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.isNew) {
              sfx.milestone()
              const caught = getCreature(def.type)
              setMilestoneToast(`🎉 Wave ${MILESTONE_WAVE}! Caught: ${caught?.name || def.type}`)
              setTimeout(() => setMilestoneToast(null), 3500)
            }
          })
          .catch(() => {})
      }
    }
  }

  const endRun = () => {
    sfx.gameOver()
    statusRef.current = 'over'
    setStatus('over')
    cancelAnimationFrame(rafRef.current)
    if (waveRef.current > bestWave) {
      setBestWave(waveRef.current)
      try {
        localStorage.setItem('jj-laststand-best-wave', String(waveRef.current))
      } catch {
        // Fine -- just won't remember the new best.
      }
    }

    // Only logged-in accounts get a leaderboard entry -- guests just keep
    // their local best above. A guest submission comes back 401 and
    // nothing else happens.
    if (mpRoleRef.current !== 'guest') {
      fetch('/api/laststand/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wave: waveRef.current })
      })
        .then(() => fetchLeaderboard())
        .catch(() => {})
    }
  }

  // Build-phase countdown
  useEffect(() => {
    if (status !== 'build') return
    if (buildSecondsLeft <= 0) {
      startWave(waveRef.current + 1)
      return
    }
    const t = setTimeout(() => setBuildSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [status, buildSecondsLeft])

  // Main simulation loop -- the guest never runs this; it only renders
  // whatever the host broadcasts (see the guest-side effect further down).
  useEffect(() => {
    if (status !== 'playing' || mpRoleRef.current === 'guest') return

    const fiendPos = (f: Fiend, spawnRadius: number, c: { x: number; y: number }) => {
      const dist = f.kind === 'spitter' ? Math.max(spawnRadius - f.travelled, SPITTER_STOP_DISTANCE) : spawnRadius - f.travelled
      return { x: c.x + f.dirX * dist, y: c.y + f.dirY * dist, dist }
    }

    const spawnParticles = (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2
        const spd = 1 + Math.random() * 2.5
        particlesRef.current.push({
          id: nextParticleId.current++,
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 18 + Math.random() * 10,
          color
        })
      }
    }

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
      const speed = BASE_MOVE_SPEED * playerStatsRef.current.speedMult
      let px = playerPosRef.current.x + mx * speed
      let py = playerPosRef.current.y + my * speed
      px = Math.max(PLAYER_SIZE / 2, Math.min(dims.width - PLAYER_SIZE / 2, px))
      py = Math.max(PLAYER_SIZE / 2, Math.min(dims.height - PLAYER_SIZE / 2, py))
      playerPosRef.current = { x: px, y: py }

      // Co-op: move the guest's entity from their last reported input --
      // the host is authoritative for the guest too, same as every Fiend.
      if (mpRoleRef.current === 'host' && peerPresentRef.current) {
        let gx = guestPosRef.current.x + guestInputRef.current.x * BASE_MOVE_SPEED
        let gy = guestPosRef.current.y + guestInputRef.current.y * BASE_MOVE_SPEED
        gx = Math.max(PLAYER_SIZE / 2, Math.min(dims.width - PLAYER_SIZE / 2, gx))
        gy = Math.max(PLAYER_SIZE / 2, Math.min(dims.height - PLAYER_SIZE / 2, gy))
        guestPosRef.current = { x: gx, y: gy }
      }

      // Spawn fiends gradually -- from a random angle around the base, not
      // just the 4 cardinals, so freely-placed walls anywhere can matter.
      spawnTimerRef.current -= 1
      if (toSpawnRef.current > 0 && spawnTimerRef.current <= 0) {
        const angle = Math.random() * Math.PI * 2
        const waveN = waveRef.current
        const isBossWave = waveN % BOSS_WAVE_INTERVAL === 0
        const kind: FiendKind = isBossWave && !bossSpawnedRef.current ? 'boss' : isBossWave ? 'shambler' : pickFiendKind(waveN)
        if (kind === 'boss') bossSpawnedRef.current = true
        const mult = FIEND_KIND_MULT[kind]
        // Smooth, uncapped scaling -- speed/damage used to flatten out
        // completely by wave ~10-16; sqrt growth keeps them climbing
        // forever, just at a slowing rate instead of a hard wall.
        const baseHpVal = 18 + waveN * 4 + Math.floor(waveN * waveN * 0.1)
        const baseSpeedVal = 0.7 + Math.sqrt(waveN) * 0.18
        const baseDamageVal = 6 + Math.sqrt(waveN) * 2.2
        // Bosses get progressively scarier relative to each other too --
        // boss #2 (wave 10) isn't just "wave 10 numbers", it's meaningfully
        // tougher than a flat multiplier of boss #1 would be.
        const bossesSoFar = Math.floor(waveN / BOSS_WAVE_INTERVAL)
        const bossScale = kind === 'boss' ? 1 + bossesSoFar * 0.22 : 1
        fiendsRef.current.push({
          id: nextFiendId.current++,
          dirX: Math.cos(angle),
          dirY: Math.sin(angle),
          kind,
          travelled: 0,
          hp: baseHpVal * mult.hp * bossScale,
          maxHp: baseHpVal * mult.hp * bossScale,
          speed: baseSpeedVal * mult.speed,
          damage: baseDamageVal * mult.damage * bossScale,
          flashUntil: 0,
          spitCooldown: SPITTER_COOLDOWN
        })
        toSpawnRef.current -= 1
        spawnTimerRef.current = isBossWave ? 50 : 28
      }

      // Fiend movement + damage
      const spawnRadius = Math.max(dims.width, dims.height)
      const nextFiends: Fiend[] = []
      for (const f of fiendsRef.current) {
        if (f.flashUntil > 0) f.flashUntil -= 1

        const distFromCenter = spawnRadius - f.travelled
        const spitterHolding = f.kind === 'spitter' && distFromCenter <= SPITTER_STOP_DISTANCE

        // Free-placed walls -- find the nearest one actually in this
        // fiend's way right now (anywhere, not a fixed slot).
        const preDist = spitterHolding ? SPITTER_STOP_DISTANCE : distFromCenter
        const preX = c.x + f.dirX * preDist
        const preY = c.y + f.dirY * preDist
        // Flyers are airborne -- walls don't stop them, which is their one
        // real mechanical hook (everything else about them is a visual
        // swap). Everyone else still checks for a blocking wall as before.
        let blockingWall: Wall | null = null
        let blockingDist = WALL_HIT_RADIUS
        if (f.kind !== 'flyer') {
          for (const w of wallsRef.current) {
            if (w.hp <= 0) continue
            const d = Math.hypot(preX - w.x, preY - w.y)
            if (d < blockingDist) {
              blockingDist = d
              blockingWall = w
            }
          }
        }

        if (blockingWall) {
          blockingWall.hp -= f.damage * 0.12
          if (blockingWall.hp < 0) blockingWall.hp = 0
        } else if (!spitterHolding) {
          f.travelled += f.speed
        }

        const { x: fx, y: fy, dist } = fiendPos(f, spawnRadius, c)

        // Spitter: once holding position, periodically lob a projectile at the player
        if (spitterHolding) {
          f.spitCooldown -= 16
          if (f.spitCooldown <= 0) {
            const ang = Math.atan2(playerPosRef.current.y - fy, playerPosRef.current.x - fx)
            enemyProjectilesRef.current.push({
              id: nextProjectileId.current++,
              x: fx,
              y: fy,
              vx: Math.cos(ang) * (PROJECTILE_SPEED * 0.55),
              vy: Math.sin(ang) * (PROJECTILE_SPEED * 0.55),
              damage: f.damage * 0.6,
              owner: 'enemy',
              splash: 0
            })
            sfx.enemyShoot()
            f.spitCooldown = SPITTER_COOLDOWN
          }
        }

        // Reached the base core
        if (!spitterHolding && dist <= 14) {
          baseHpRef.current -= f.damage * 0.12
          if (baseHpRef.current <= 0) baseHpRef.current = 0
        }

        // Trap: periodic AoE damage to anything near the base
        // (handled once per frame below, outside this per-fiend loop)

        // Contact with player
        if (Math.hypot(fx - playerPosRef.current.x, fy - playerPosRef.current.y) < CONTACT_RADIUS) {
          playerHpRef.current -= f.damage * 0.1
          if (playerHpRef.current <= 0) playerHpRef.current = 0
        }

        // Contact with the guest (co-op) -- same rule, separate HP pool.
        if (mpRoleRef.current === 'host' && peerPresentRef.current && guestHpRef.current > 0) {
          if (Math.hypot(fx - guestPosRef.current.x, fy - guestPosRef.current.y) < CONTACT_RADIUS) {
            guestHpRef.current = Math.max(0, guestHpRef.current - f.damage * 0.1)
          }
        }

        if (f.hp > 0) nextFiends.push(f)
      }
      fiendsRef.current = nextFiends
      wallsRef.current = wallsRef.current.filter((w) => w.hp > 0)

      // Trap pulse damage
      if (trapTierRef.current > 0) {
        trapTimerRef.current -= 16
        if (trapTimerRef.current <= 0) {
          for (const f of fiendsRef.current) {
            const { dist } = fiendPos(f, spawnRadius, c)
            if (dist <= TRAP_RADIUS) {
              f.hp -= TRAP_TIER_DAMAGE[trapTierRef.current]
            }
          }
          trapTimerRef.current = 900
        }
      }

      // Player auto-fire
      playerFireRef.current -= 16
      if (playerFireRef.current <= 0) {
        let nearest: Fiend | null = null
        let nearestDist = PLAYER_RANGE
        let nearestPos = { x: 0, y: 0 }
        for (const f of fiendsRef.current) {
          const { x: fx, y: fy } = fiendPos(f, spawnRadius, c)
          const d = Math.hypot(fx - playerPosRef.current.x, fy - playerPosRef.current.y)
          if (d < nearestDist) {
            nearestDist = d
            nearest = f
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
            damage: playerStatsRef.current.damage,
            owner: 'player',
            splash: 0
          })
          sfx.playerShoot()
          playerFireRef.current = playerStatsRef.current.fireCooldown
        }
      }

      // Guest auto-fire (co-op) -- same rule, same weapon, driven by the
      // host since the host owns the whole simulation.
      if (mpRoleRef.current === 'host' && peerPresentRef.current && guestHpRef.current > 0) {
        guestFireRef.current -= 16
        if (guestFireRef.current <= 0) {
          let nearest: Fiend | null = null
          let nearestDist = PLAYER_RANGE
          let nearestPos = { x: 0, y: 0 }
          for (const f of fiendsRef.current) {
            const { x: fx, y: fy } = fiendPos(f, spawnRadius, c)
            const d = Math.hypot(fx - guestPosRef.current.x, fy - guestPosRef.current.y)
            if (d < nearestDist) {
              nearestDist = d
              nearest = f
              nearestPos = { x: fx, y: fy }
            }
          }
          if (nearest) {
            const ang = Math.atan2(nearestPos.y - guestPosRef.current.y, nearestPos.x - guestPosRef.current.x)
            projectilesRef.current.push({
              id: nextProjectileId.current++,
              x: guestPosRef.current.x,
              y: guestPosRef.current.y,
              vx: Math.cos(ang) * PROJECTILE_SPEED,
              vy: Math.sin(ang) * PROJECTILE_SPEED,
              damage: playerStatsRef.current.damage,
              owner: 'player',
              splash: 0
            })
            guestFireRef.current = playerStatsRef.current.fireCooldown
          }
        }
      }

      // Turret auto-fire -- each placed turret fires independently from
      // its own position at the nearest Fiend within its own range.
      for (const t of turretsRef.current) {
        const stats = TURRET_STATS[t.type]
        t.fireCooldown -= 16
        if (t.fireCooldown > 0) continue

        let nearest: Fiend | null = null
        let nearestDist = TURRET_RANGE
        let nearestPos = { x: 0, y: 0 }
        for (const f of fiendsRef.current) {
          const { x: fx, y: fy } = fiendPos(f, spawnRadius, c)
          const d = Math.hypot(fx - t.x, fy - t.y)
          if (d < nearestDist) {
            nearestDist = d
            nearest = f
            nearestPos = { x: fx, y: fy }
          }
        }
        if (nearest) {
          const ang = Math.atan2(nearestPos.y - t.y, nearestPos.x - t.x)
          projectilesRef.current.push({
            id: nextProjectileId.current++,
            x: t.x,
            y: t.y,
            vx: Math.cos(ang) * PROJECTILE_SPEED,
            vy: Math.sin(ang) * PROJECTILE_SPEED,
            damage: stats.damage[t.tier],
            owner: 'turret',
            splash: stats.splash
          })
          if (t.type === 'cannon') sfx.cannonShoot()
          else sfx.turretShoot()
          t.fireCooldown = stats.cooldown[t.tier]
        }
      }

      // Move player projectiles/turret projectiles + collide with fiends
      const nextProjectiles: Projectile[] = []
      for (const p of projectilesRef.current) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -20 || p.x > dims.width + 20 || p.y < -20 || p.y > dims.height + 20) continue

        // Splash only applies to a Cannon turret's own shots, never the
        // player's auto-fire or a Gatling turret's.
        const splashRadius = p.splash

        let hit = false
        for (const f of fiendsRef.current) {
          const { x: fx, y: fy } = fiendPos(f, spawnRadius, c)
          const hitRadius = FIEND_VISUALS[f.kind].size / 2
          if (Math.hypot(p.x - fx, p.y - fy) < hitRadius) {
            f.hp -= p.damage
            f.flashUntil = 6
            f.travelled = Math.max(0, f.travelled - 3)
            hit = true
            sfx.hit()
            spawnParticles(fx, fy, '#ef4444', 4)

            if (splashRadius > 0) {
              for (const other of fiendsRef.current) {
                if (other.id === f.id) continue
                const { x: ox, y: oy } = fiendPos(other, spawnRadius, c)
                if (Math.hypot(fx - ox, fy - oy) < splashRadius) {
                  other.hp -= p.damage * 0.6
                  other.flashUntil = 6
                }
              }
              spawnParticles(fx, fy, '#fbbf24', 8)
            }

            if (f.hp <= 0) {
              const bonus = f.kind === 'boss' ? 60 : 2 + Math.floor(Math.random() * 3)
              juiceRef.current += bonus
              if (f.kind === 'boss') sfx.bossDeath()
              else sfx.fiendDeath()
              spawnParticles(fx, fy, FIEND_VISUALS[f.kind].stroke, 10)
            }
            break
          }
        }
        if (!hit) nextProjectiles.push(p)
      }
      projectilesRef.current = nextProjectiles
      fiendsRef.current = fiendsRef.current.filter((f) => f.hp > 0)

      // Move enemy (spitter) projectiles + collide with player only
      const nextEnemyProjectiles: Projectile[] = []
      for (const p of enemyProjectilesRef.current) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -20 || p.x > dims.width + 20 || p.y < -20 || p.y > dims.height + 20) continue
        if (Math.hypot(p.x - playerPosRef.current.x, p.y - playerPosRef.current.y) < CONTACT_RADIUS) {
          playerHpRef.current -= p.damage
          if (playerHpRef.current <= 0) playerHpRef.current = 0
          spawnParticles(p.x, p.y, '#67e8f9', 5)
          continue
        }
        nextEnemyProjectiles.push(p)
      }
      enemyProjectilesRef.current = nextEnemyProjectiles

      // Particles
      const nextParticles: Particle[] = []
      for (const particle of particlesRef.current) {
        particle.x += particle.vx
        particle.y += particle.vy
        particle.vx *= 0.92
        particle.vy *= 0.92
        particle.life -= 1
        if (particle.life > 0) nextParticles.push(particle)
      }
      particlesRef.current = nextParticles

      // Screen shake -- trigger a pulse when base/player HP drops, with a
      // cooldown so sustained contact damage doesn't shake every frame.
      if (shakeFramesRef.current > 0) {
        shakeFramesRef.current -= 1
        const mag = 4
        setShakeOffset({ x: (Math.random() - 0.5) * mag, y: (Math.random() - 0.5) * mag })
      } else if (baseHpRef.current < lastBaseHpRef.current - 0.5 || playerHpRef.current < lastPlayerHpRef.current - 0.5) {
        shakeFramesRef.current = 8
        if (baseHpRef.current < lastBaseHpRef.current - 0.5) sfx.baseHurt()
        else sfx.playerHurt()
      } else {
        setShakeOffset({ x: 0, y: 0 })
      }
      lastBaseHpRef.current = baseHpRef.current
      lastPlayerHpRef.current = playerHpRef.current

      // Push state for render
      setPlayerPos({ ...playerPosRef.current })
      setFiends([...fiendsRef.current])
      setProjectiles([...projectilesRef.current])
      setEnemyProjectiles([...enemyProjectilesRef.current])
      setParticles([...particlesRef.current])
      setWalls([...wallsRef.current])
      setJuice(juiceRef.current)
      setPlayerHp(playerHpRef.current)
      setBaseHp(baseHpRef.current)

      if (mpRoleRef.current === 'host' && peerPresentRef.current) {
        setPeerPos({ ...guestPosRef.current })
        setPeerHp(guestHpRef.current)
        broadcastCounterRef.current += 1
        if (broadcastCounterRef.current >= 3) {
          broadcastCounterRef.current = 0
          ablyRoomRef.current?.publish('state', {
            status: statusRef.current,
            wave: waveRef.current,
            juice: juiceRef.current,
            baseHp: baseHpRef.current,
            bossActive,
            buildSecondsLeft,
            hostPos: playerPosRef.current,
            hostHp: playerHpRef.current,
            guestPos: guestPosRef.current,
            guestHp: guestHpRef.current,
            fiends: fiendsRef.current,
            projectiles: projectilesRef.current,
            enemyProjectiles: enemyProjectilesRef.current,
            walls: wallsRef.current,
            turrets: turretsRef.current,
            trapTier: trapTierRef.current
          })
        }
      }

      if (playerHpRef.current <= 0 || baseHpRef.current <= 0) {
        endRun()
        return
      }

      if (toSpawnRef.current <= 0 && fiendsRef.current.length === 0) {
        beginBuildPhase()
        return
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dims.width, dims.height])

  // Click anywhere during the build phase to place a wall there, or click
  // an existing one to upgrade it -- no fixed slots.
  // Both walls and turrets are placed the same way: click inside the ring
  // around the heart. Clicking near an existing structure upgrades it;
  // clicking empty space places a new one of whatever's selected.
  // Placement never fails silently -- every rejected click says why, so it
  // never looks like a purchase just vanished.
  const flashBuildToast = (msg: string) => {
    sfx.reject()
    setBuildToast(msg)
    if (buildToastTimeoutRef.current) clearTimeout(buildToastTimeoutRef.current)
    buildToastTimeoutRef.current = setTimeout(() => setBuildToast(null), 1800)
  }

  const handleArenaClick = (x: number, y: number) => {
    if (statusRef.current !== 'build') {
      flashBuildToast('Wave already started -- wait for the next build phase')
      return
    }
    const c = center()
    if (Math.hypot(x - c.x, y - c.y) > RING_RADII[ringTierRef.current]) {
      flashBuildToast('Too far -- build inside the ring around your heart')
      return
    }

    if (placementMode === 'wall') {
      let nearest: Wall | null = null
      let nearestDist = WALL_UPGRADE_RADIUS
      for (const w of wallsRef.current) {
        const d = Math.hypot(x - w.x, y - w.y)
        if (d < nearestDist) {
          nearestDist = d
          nearest = w
        }
      }

      if (nearest) {
        const nextTier = nearest.tier + 1
        if (nextTier > 3) {
          flashBuildToast('That wall is already maxed out')
          return
        }
        const cost = WALL_TIER_COST[nextTier]
        if (juiceRef.current < cost) {
          flashBuildToast(`Need ${cost} Juice to upgrade that wall`)
          return
        }
        juiceRef.current -= cost
        nearest.tier = nextTier
        nearest.hp = WALL_TIER_HP[nextTier]
        sfx.upgrade()
      } else {
        if (wallsRef.current.length >= MAX_WALLS) {
          flashBuildToast(`Max ${MAX_WALLS} walls placed`)
          return
        }
        const cost = WALL_TIER_COST[1]
        if (juiceRef.current < cost) {
          flashBuildToast(`Need ${cost} Juice for a wall`)
          return
        }
        juiceRef.current -= cost
        wallsRef.current.push({ id: nextWallId.current++, x, y, tier: 1, hp: WALL_TIER_HP[1] })
        sfx.place()
      }
      setWalls([...wallsRef.current])
    } else {
      let nearest: Turret | null = null
      let nearestDist = TURRET_UPGRADE_RADIUS
      for (const t of turretsRef.current) {
        const d = Math.hypot(x - t.x, y - t.y)
        if (d < nearestDist) {
          nearestDist = d
          nearest = t
        }
      }

      if (nearest) {
        const nextTier = nearest.tier + 1
        if (nextTier > 3) {
          flashBuildToast('That turret is already maxed out')
          return
        }
        const cost = TURRET_TIER_COST[nextTier]
        if (juiceRef.current < cost) {
          flashBuildToast(`Need ${cost} Juice to upgrade that turret`)
          return
        }
        juiceRef.current -= cost
        nearest.tier = nextTier
        sfx.upgrade()
      } else {
        if (turretsRef.current.length >= MAX_TURRETS) {
          flashBuildToast(`Max ${MAX_TURRETS} turrets placed`)
          return
        }
        const cost = TURRET_TIER_COST[1]
        if (juiceRef.current < cost) {
          flashBuildToast(`Need ${cost} Juice for a turret`)
          return
        }
        juiceRef.current -= cost
        turretsRef.current.push({ id: nextTurretId.current++, x, y, type: placementMode, tier: 1, fireCooldown: 0 })
        sfx.place()
      }
      setTurrets([...turretsRef.current])
    }

    setJuice(juiceRef.current)
  }

  const buyRingExpand = () => {
    const nextTier = ringTierRef.current + 1
    if (nextTier > RING_RADII.length - 1) return
    const cost = RING_UPGRADE_COST[nextTier]
    if (juiceRef.current < cost) return
    juiceRef.current -= cost
    ringTierRef.current = nextTier
    setRingTier(nextTier)
    sfx.upgrade()
    setJuice(juiceRef.current)
  }

  const buyTrap = () => {
    const nextTier = trapTierRef.current + 1
    if (nextTier > 2) return
    const cost = TRAP_TIER_COST[nextTier]
    if (juiceRef.current < cost) return
    juiceRef.current -= cost
    trapTierRef.current = nextTier
    setTrapTier(nextTier)
    sfx.upgrade()
    setJuice(juiceRef.current)
  }

  // Cost scales up with level so this is a real tree, not an infinite cheap
  // grind -- 20, 35, 50, 65...
  const upgradeCost = (level: number) => 20 + level * 15

  const buyPlayerUpgrade = (kind: 'damage' | 'firerate' | 'speed') => {
    const level = upgradeLevelsRef.current[kind]
    const cost = upgradeCost(level)
    if (juiceRef.current < cost) return
    juiceRef.current -= cost
    const s = { ...playerStatsRef.current }
    if (kind === 'damage') s.damage += 4
    if (kind === 'firerate') s.fireCooldown = Math.max(180, s.fireCooldown - 50)
    if (kind === 'speed') s.speedMult = Math.min(1.8, s.speedMult + 0.12)
    playerStatsRef.current = s
    setPlayerStats(s)
    upgradeLevelsRef.current = { ...upgradeLevelsRef.current, [kind]: level + 1 }
    setUpgradeLevels(upgradeLevelsRef.current)
    sfx.upgrade()
    setJuice(juiceRef.current)
  }

  const claimItem = (item: ItemDef) => {
    if (itemClaimed) return

    switch (item.id) {
      case 'wall': {
        if (wallsRef.current.length === 0) {
          const c = center()
          wallsRef.current.push({ id: nextWallId.current++, x: c.x, y: c.y - 100, tier: 1, hp: WALL_TIER_HP[1] })
        } else {
          let weakest = wallsRef.current[0]
          for (const w of wallsRef.current) {
            if (w.tier < weakest.tier) weakest = w
          }
          if (weakest.tier >= 3) {
            if (wallsRef.current.length < MAX_WALLS) {
              const c = center()
              const angle = Math.random() * Math.PI * 2
              wallsRef.current.push({
                id: nextWallId.current++,
                x: c.x + Math.cos(angle) * 100,
                y: c.y + Math.sin(angle) * 100,
                tier: 1,
                hp: WALL_TIER_HP[1]
              })
            } else {
              juiceRef.current += 30
            }
          } else {
            weakest.tier += 1
            weakest.hp = WALL_TIER_HP[weakest.tier]
          }
        }
        setWalls([...wallsRef.current])
        break
      }
      case 'turret': {
        if (turretsRef.current.length === 0) {
          const c = center()
          turretsRef.current.push({
            id: nextTurretId.current++,
            x: c.x,
            y: c.y - 60,
            type: 'gatling',
            tier: 1,
            fireCooldown: 0
          })
        } else {
          let weakest = turretsRef.current[0]
          for (const t of turretsRef.current) {
            if (t.tier < weakest.tier) weakest = t
          }
          if (weakest.tier >= 3) {
            if (turretsRef.current.length < MAX_TURRETS) {
              const c = center()
              const angle = Math.random() * Math.PI * 2
              turretsRef.current.push({
                id: nextTurretId.current++,
                x: c.x + Math.cos(angle) * 70,
                y: c.y + Math.sin(angle) * 70,
                type: 'gatling',
                tier: 1,
                fireCooldown: 0
              })
            } else {
              juiceRef.current += 30
            }
          } else {
            weakest.tier += 1
          }
        }
        setTurrets([...turretsRef.current])
        break
      }
      case 'damage': {
        playerStatsRef.current = { ...playerStatsRef.current, damage: playerStatsRef.current.damage + 6 }
        setPlayerStats(playerStatsRef.current)
        break
      }
      case 'firerate': {
        playerStatsRef.current = {
          ...playerStatsRef.current,
          fireCooldown: Math.max(180, playerStatsRef.current.fireCooldown - 60)
        }
        setPlayerStats(playerStatsRef.current)
        break
      }
      case 'speed': {
        playerStatsRef.current = {
          ...playerStatsRef.current,
          speedMult: Math.min(1.8, playerStatsRef.current.speedMult + 0.15)
        }
        setPlayerStats(playerStatsRef.current)
        break
      }
      case 'juice': {
        juiceRef.current += 30
        break
      }
      case 'repair': {
        baseHpRef.current = BASE_MAX_HP
        playerHpRef.current = PLAYER_MAX_HP
        setBaseHp(BASE_MAX_HP)
        setPlayerHp(PLAYER_MAX_HP)
        break
      }
    }

    setJuice(juiceRef.current)
    setItemClaimed(true)
    setClaimedItemName(item.name)
    sfx.upgrade()
  }

  // Guest (co-op): send local movement input to the host ~20x/sec -- the
  // guest never simulates anything itself, just reports what it wants to
  // do and renders whatever the host says happened.
  useEffect(() => {
    if (mpRole !== 'guest') return
    const interval = setInterval(() => {
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
      ablyRoomRef.current?.publish('input', { x: mx, y: my })
    }, 50)
    return () => clearInterval(interval)
  }, [mpRole])

  // Mobile joystick
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
      className="fixed inset-0 z-[100] overflow-hidden bg-gradient-to-b from-black via-red-950 to-black"
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
        <h2 className="text-xl font-bold text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.6)] sm:text-2xl">
          🧃 999 Last Stand
        </h2>
        {status !== 'ready' && (
          <p className="mt-1 font-mono text-sm text-white">
            Wave: {wave} &nbsp;·&nbsp; Juice: {juice} &nbsp;·&nbsp; Best Wave: {bestWave}
          </p>
        )}
      </div>

      {milestoneToast && (
        <div className="pointer-events-none absolute top-20 left-1/2 z-[101] -translate-x-1/2 rounded-full border border-accent/40 bg-black/90 px-4 py-2 text-sm text-white">
          {milestoneToast}
        </div>
      )}

      {buildToast && (
        <div className="pointer-events-none absolute top-32 left-1/2 z-[115] -translate-x-1/2 rounded-full border border-red-400/50 bg-black/90 px-4 py-2 text-sm text-white">
          {buildToast}
        </div>
      )}

      {peerDisconnected && (status === 'playing' || status === 'build') && (
        <div className="pointer-events-auto absolute top-32 left-1/2 z-[116] -translate-x-1/2 flex items-center gap-3 rounded-full border border-red-400/60 bg-black/95 px-4 py-2 text-sm text-white">
          <span>⚠️ {peerDisconnected === 'host' ? 'Host' : 'Guest'} disconnected</span>
          {mpRole === 'guest' && peerDisconnected === 'host' && (
            <button onClick={disconnectRoom} className="text-xs text-accent underline">
              Leave
            </button>
          )}
        </div>
      )}

      {(status === 'playing' || status === 'build') && (
        <>
          {/* HP bars */}
          <div className="pointer-events-none absolute top-16 left-1/2 z-[101] flex -translate-x-1/2 gap-4">
            <div className="w-32">
              <p className="mb-0.5 text-center text-[10px] text-white/60">PLAYER</p>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-green-400"
                  style={{ width: `${Math.max(0, (playerHp / PLAYER_MAX_HP) * 100)}%` }}
                />
              </div>
            </div>
            <div className="w-32">
              <p className="mb-0.5 text-center text-[10px] text-white/60">BASE</p>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-blue-400"
                  style={{ width: `${Math.max(0, (baseHp / BASE_MAX_HP) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {bossActive && status === 'playing' && (
            <p className="pointer-events-none absolute top-[7.5rem] left-1/2 z-[101] -translate-x-1/2 text-xs font-bold text-amber-400">
              ⚠️ BOSS WAVE
            </p>
          )}

          <div
            className={`absolute inset-0 z-10 ${status === 'build' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
            style={{ transform: `translate3d(${shakeOffset.x}px, ${shakeOffset.y}px, 0)` }}
            onClick={(e) => {
              e.stopPropagation()
              handleArenaClick(e.clientX, e.clientY)
            }}
            onMouseMove={(e) => {
              if (status === 'build') setHoverPos({ x: e.clientX, y: e.clientY })
            }}
            onMouseLeave={() => setHoverPos(null)}
          >
            {dims.width > 0 && (
              <>
                {/* Wall placement cursor preview (build phase, desktop hover) */}
                {status === 'build' && hoverPos && (
                  <div
                    className="pointer-events-none absolute rounded-md border-2 border-dashed border-accent/70"
                    style={{ left: hoverPos.x - 14, top: hoverPos.y - 14, width: 28, height: 28 }}
                  />
                )}

                {/* Buildable ring (build phase only) */}
                {status === 'build' && (
                  <div
                    className="absolute rounded-full border-2 border-dashed border-accent/30"
                    style={{
                      left: c.x - RING_RADII[ringTier],
                      top: c.y - RING_RADII[ringTier],
                      width: RING_RADII[ringTier] * 2,
                      height: RING_RADII[ringTier] * 2
                    }}
                  />
                )}

                {/* Trap radius */}
                {trapTier > 0 && (
                  <div
                    className="absolute rounded-full border border-orange-400/40 bg-orange-500/5"
                    style={{
                      left: c.x - TRAP_RADIUS,
                      top: c.y - TRAP_RADIUS,
                      width: TRAP_RADIUS * 2,
                      height: TRAP_RADIUS * 2
                    }}
                  />
                )}

                {/* Base core -- a heart, since that's what you're defending */}
                <div className="absolute" style={{ left: c.x - 17, top: c.y - 15 }}>
                  <HeartSvg />
                </div>

                {/* Turrets */}
                {turrets.map((t) => (
                  <div key={t.id} className="absolute" style={{ left: t.x - 13, top: t.y - 13 }}>
                    <TurretSvg tier={t.tier} type={t.type} />
                  </div>
                ))}

                {/* Walls */}
                {walls.map((w) => {
                  const maxHp = WALL_TIER_HP[w.tier]
                  const color = w.tier >= 3 ? '#fbbf24' : w.tier === 2 ? '#60a5fa' : '#9ca3af'
                  return (
                    <div key={w.id} className="absolute" style={{ left: w.x - 14, top: w.y - 14, width: 28, height: 28 }}>
                      <div
                        className="h-full w-full rounded-md border-2"
                        style={{ borderColor: color, background: `${color}33` }}
                      />
                      <div className="mt-0.5 h-1 w-full rounded-full bg-white/10">
                        <div className="h-1 rounded-full" style={{ width: `${(w.hp / maxHp) * 100}%`, background: color }} />
                      </div>
                    </div>
                  )
                })}

                {/* Fiends */}
                {fiends.map((f) => {
                  const dist =
                    f.kind === 'spitter' ? Math.max(spawnRadius - f.travelled, SPITTER_STOP_DISTANCE) : spawnRadius - f.travelled
                  const fx = c.x + f.dirX * dist
                  const fy = c.y + f.dirY * dist
                  const half = FIEND_VISUALS[f.kind].size / 2
                  return (
                    <div
                      key={f.id}
                      className="absolute"
                      style={{ transform: `translate3d(${fx - half}px, ${fy - half}px, 0)` }}
                    >
                      <MushroomSprite kind={f.kind} facingLeft={f.dirX > 0} flashed={f.flashUntil > 0} />
                      <div className="mt-0.5 h-1 w-full rounded-full bg-white/10">
                        <div className="h-1 rounded-full bg-red-500" style={{ width: `${(f.hp / f.maxHp) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}

                {/* Player projectiles */}
                {projectiles.map((p) => (
                  <div
                    key={p.id}
                    className="absolute h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_currentColor] text-accent"
                    style={{ transform: `translate3d(${p.x - 1}px, ${p.y - 1}px, 0)` }}
                  />
                ))}

                {/* Enemy (Spitter) projectiles */}
                {enemyProjectiles.map((p) => (
                  <div
                    key={p.id}
                    className="absolute h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
                    style={{ transform: `translate3d(${p.x - 1}px, ${p.y - 1}px, 0)` }}
                  />
                ))}

                {/* Particles */}
                {particles.map((pt) => (
                  <div
                    key={pt.id}
                    className="absolute h-1 w-1 rounded-full"
                    style={{
                      background: pt.color,
                      opacity: Math.max(0, pt.life / 24),
                      transform: `translate3d(${pt.x - 0.5}px, ${pt.y - 0.5}px, 0)`
                    }}
                  />
                ))}

                {/* Player */}
                <div
                  className="absolute flex items-center justify-center text-2xl"
                  style={{
                    transform: `translate3d(${playerPos.x - PLAYER_SIZE / 2}px, ${playerPos.y - PLAYER_SIZE / 2}px, 0)`,
                    width: PLAYER_SIZE,
                    height: PLAYER_SIZE
                  }}
                >
                  {selectedAvatar === 'juicebox' ? (
                    '🧃'
                  ) : selectedAvatar === '999zombie' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="/games/destroy-character.png"
                      alt=""
                      width={PLAYER_SIZE}
                      height={PLAYER_SIZE}
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div style={{ color: getCreature(selectedAvatar)?.hex }}>
                      <CreatureSvg type={selectedAvatar} size={PLAYER_SIZE} />
                    </div>
                  )}
                </div>

                {/* Co-op peer -- the other player, host or guest */}
                {mpRole !== 'solo' && peerPresent && (
                  <div
                    className="absolute flex flex-col items-center"
                    style={{
                      transform: `translate3d(${peerPos.x - PLAYER_SIZE / 2}px, ${peerPos.y - PLAYER_SIZE / 2 - 14}px, 0)`,
                      width: PLAYER_SIZE
                    }}
                  >
                    <span className="mb-0.5 rounded bg-black/70 px-1 text-[9px] text-white/70">
                      {mpRole === 'host' ? 'Guest' : 'Host'}
                    </span>
                    <span
                      className="flex items-center justify-center text-2xl"
                      style={{ width: PLAYER_SIZE, height: PLAYER_SIZE, opacity: peerHp > 0 ? 1 : 0.35 }}
                    >
                      🧃
                    </span>
                    <div className="mt-0.5 h-1 w-6 rounded-full bg-white/10">
                      <div className="h-1 rounded-full bg-green-400" style={{ width: `${Math.max(0, (peerHp / PLAYER_MAX_HP) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mobile joystick */}
          <div
            ref={joystickBaseRef}
            onPointerDown={handleJoystickDown}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickUp}
            onPointerCancel={handleJoystickUp}
            className="absolute bottom-8 left-8 z-[105] h-24 w-24 touch-none rounded-full border border-white/20 bg-white/5"
          />
          <p className="pointer-events-none absolute bottom-4 left-1/2 z-[101] -translate-x-1/2 text-xs text-white/40">
            WASD / arrows to move &nbsp;·&nbsp; auto-fire is automatic
          </p>
        </>
      )}

      {status === 'build' && (
        <div
          className="pointer-events-auto absolute bottom-0 left-0 right-0 z-[110] border-t border-accent/30 bg-black/90 px-4 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-center text-sm font-semibold text-accent">
            Wave {wave} cleared! Build phase -- {buildSecondsLeft}s &nbsp;·&nbsp; Juice: {juice}
          </p>

          {mpRole === 'guest' ? (
            <p className="text-center text-xs text-white/60">
              The host is building -- just get ready for the next wave.
            </p>
          ) : (
          <>
          <div className="mx-auto mb-3 max-w-2xl">
            {itemClaimed ? (
              <p className="text-center text-xs text-accent/80">✓ Claimed: {claimedItemName}</p>
            ) : (
              <>
                <p className="mb-1.5 text-center text-xs text-white/60">Pick a free upgrade:</p>
                <div className="flex flex-wrap items-stretch justify-center gap-2">
                  {itemChoices.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => claimItem(item)}
                      className="flex w-28 flex-col items-center gap-1 rounded-lg border border-accent/40 bg-black/60 px-2 py-2 text-center transition-colors hover:border-accent"
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span className="text-xs font-semibold text-white">{item.name}</span>
                      <span className="text-[10px] text-white/50">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <p className="mb-1.5 text-center text-xs text-white/50">
            Pick what to build, then click inside the ring around your heart -- click an existing one to
            upgrade it instead. Walls {walls.length}/{MAX_WALLS} &nbsp;·&nbsp; Turrets {turrets.length}/{MAX_TURRETS}
          </p>

          <div className="mx-auto mb-3 flex max-w-2xl flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setPlacementMode('wall')}
              className={`rounded-full border px-3 py-1.5 text-xs text-white ${placementMode === 'wall' ? 'border-accent bg-accent/20' : 'border-white/20 bg-black/60'}`}
            >
              🧱 Wall ({WALL_TIER_COST[1]})
            </button>
            <button
              onClick={() => setPlacementMode('gatling')}
              className={`rounded-full border px-3 py-1.5 text-xs text-white ${placementMode === 'gatling' ? 'border-accent bg-accent/20' : 'border-white/20 bg-black/60'}`}
            >
              Gatling Turret ({TURRET_TIER_COST[1]})
            </button>
            <button
              onClick={() => setPlacementMode('cannon')}
              className={`rounded-full border px-3 py-1.5 text-xs text-white ${placementMode === 'cannon' ? 'border-accent bg-accent/20' : 'border-white/20 bg-black/60'}`}
            >
              Cannon Turret ({TURRET_TIER_COST[1]})
            </button>
            <button
              onClick={buyRingExpand}
              disabled={ringTier >= RING_RADII.length - 1 || juice < RING_UPGRADE_COST[ringTier + 1]}
              className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              Expand Ring {ringTier < RING_RADII.length - 1 ? `→ ${RING_UPGRADE_COST[ringTier + 1]}` : '(max)'}
            </button>
          </div>

          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2">
            <button
              onClick={buyTrap}
              disabled={trapTier >= 2 || juice < TRAP_TIER_COST[trapTier + 1]}
              className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              Spike Trap T{trapTier} {trapTier < 2 ? `→ ${TRAP_TIER_COST[trapTier + 1]}` : '(max)'}
            </button>
            <button
              onClick={() => buyPlayerUpgrade('damage')}
              disabled={juice < upgradeCost(upgradeLevels.damage)}
              className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              +Damage ({upgradeCost(upgradeLevels.damage)})
            </button>
            <button
              onClick={() => buyPlayerUpgrade('firerate')}
              disabled={juice < upgradeCost(upgradeLevels.firerate)}
              className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              +Fire Rate ({upgradeCost(upgradeLevels.firerate)})
            </button>
            <button
              onClick={() => buyPlayerUpgrade('speed')}
              disabled={juice < upgradeCost(upgradeLevels.speed)}
              className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              +Speed ({upgradeCost(upgradeLevels.speed)})
            </button>
            <button
              onClick={() => {
                setBuildSecondsLeft(0)
              }}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-black"
            >
              Start Next Wave
            </button>
          </div>
          </>
          )}
        </div>
      )}

      {(status === 'ready' || status === 'over') && (
        <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          {status === 'over' && (
            <p className="font-mono text-white/80">You reached Wave {wave} &nbsp;·&nbsp; Best: {bestWave}</p>
          )}
          <p className="text-2xl font-bold text-white">
            {status === 'ready' ? 'Defend the Base' : 'Base Overrun'}
          </p>
          <p className="max-w-sm text-sm text-white/60">
            Move with WASD or the joystick. You auto-fire at nearby fiends. Between waves, spend Juice to
            wall off your base and build up a turret.
          </p>

          <button
            onClick={() => setShowLeaderboard((v) => !v)}
            className="pointer-events-auto text-xs text-accent underline"
          >
            {showLeaderboard ? 'Hide' : 'Show'} 🏆 Leaderboard
          </button>
          {showLeaderboard && (
            <div className="pointer-events-auto w-full max-w-xs rounded-lg border border-accent/30 bg-black/60 p-3">
              {leaderboard.length === 0 ? (
                <p className="text-xs text-white/50">No scores yet -- sign in and be the first.</p>
              ) : (
                <ol className="space-y-1 text-left text-xs text-white/80">
                  {leaderboard.map((s, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{i + 1}. {s.name}</span>
                      <span className="text-accent">Wave {s.wave}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setSelectedAvatar('juicebox')}
              className={`rounded-full border-2 p-1.5 text-xl transition-transform ${selectedAvatar === 'juicebox' ? 'scale-110 border-accent' : 'border-white/20'}`}
            >
              🧃
            </button>
            <button
              onClick={() => (zombieUnlocked ? setSelectedAvatar('999zombie') : setShowZombiePaywall(true))}
              className={`flex items-center justify-center rounded-full border-2 p-1 transition-transform ${selectedAvatar === '999zombie' ? 'scale-110 border-accent' : 'border-white/20'}`}
              title={zombieUnlocked ? '999 Zombie' : '999 Zombie -- $9.99 unlock'}
            >
              {zombieUnlocked ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/games/destroy-character.png" alt="" width={24} height={24} style={{ imageRendering: 'pixelated' }} />
              ) : (
                <span className="text-sm">🔒</span>
              )}
            </button>
            {caughtTypes.length > 0 &&
              CREATURES.filter((cr) => caughtTypes.includes(cr.type)).map((cr) => (
                <button
                  key={cr.type}
                  onClick={() => setSelectedAvatar(cr.type)}
                  style={{ color: cr.hex }}
                  className={`rounded-full border-2 p-1.5 transition-transform ${selectedAvatar === cr.type ? 'scale-110 border-current' : 'border-white/20'}`}
                  title={cr.name}
                >
                  <CreatureSvg type={cr.type} size={24} />
                </button>
              ))}
          </div>

          {showZombiePaywall && (
            <div className="pointer-events-auto fixed inset-0 z-[260] flex items-center justify-center bg-black/80 p-4">
              <CharacterUnlockPaywall
                onClose={() => setShowZombiePaywall(false)}
                onUnlocked={() => {
                  setZombieUnlocked(true)
                  setSelectedAvatar('999zombie')
                  setShowZombiePaywall(false)
                }}
              />
            </div>
          )}

          {status === 'ready' && mpRole === 'solo' && (
            <div className="pointer-events-auto mt-2 flex w-full max-w-xs flex-col items-center gap-2">
              <button
                onClick={() => connectRoom(randomRoomCode(), 'host')}
                className="w-full rounded-full border border-accent/40 bg-black/60 px-3 py-2 text-xs text-white hover:border-accent"
              >
                🧑‍🤝‍🧑 Host Co-op Room
              </button>
              <div className="flex w-full items-center gap-2">
                <input
                  value={mpJoinInput}
                  onChange={(e) => setMpJoinInput(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  maxLength={6}
                  className="min-w-0 flex-1 rounded-full border border-white/20 bg-black/60 px-3 py-2 text-center text-xs text-white outline-none focus:border-accent"
                />
                <button
                  onClick={() => mpJoinInput && connectRoom(mpJoinInput, 'guest')}
                  disabled={!mpJoinInput}
                  className="shrink-0 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs text-white disabled:opacity-40"
                >
                  Join
                </button>
              </div>
            </div>
          )}

          {status === 'ready' && mpRole !== 'solo' && (
            <div className="pointer-events-auto mt-2 flex flex-col items-center gap-1">
              {mpConnStatus === 'connecting' && <p className="text-xs text-white/60">Connecting...</p>}
              {mpConnStatus === 'error' && <p className="text-xs text-red-400">Connection failed -- try again</p>}
              {mpConnStatus === 'connected' && (
                <>
                  <p className="font-mono text-sm text-accent">
                    Room: {mpRoomCode} {mpRole === 'host' ? '(you are hosting)' : '(joined as guest)'}
                  </p>
                  <p className="text-xs text-white/60">
                    {peerPresent ? '🟢 Other player connected!' : '⏳ Waiting for the other player to join...'}
                  </p>
                </>
              )}
              <button onClick={disconnectRoom} className="mt-1 text-xs text-white/40 underline">
                Leave room
              </button>
            </div>
          )}

          {(mpRole !== 'guest') && (
            <button onClick={startRun} className="btn-primary mt-2 px-8 py-3">
              {status === 'ready' ? 'Start' : 'Play Again'}
            </button>
          )}
          {mpRole === 'guest' && status === 'ready' && (
            <p className="text-sm text-white/60">Waiting for the host to start the run...</p>
          )}
        </div>
        </div>
      )}
    </div>
  )
}
