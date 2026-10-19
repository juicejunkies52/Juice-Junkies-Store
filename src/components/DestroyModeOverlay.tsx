'use client'

import { useEffect, useRef, useState } from 'react'
import { sfx } from '../../lib/sfx'
import CharacterUnlockPaywall from './CharacterUnlockPaywall'
import { AblyRoom, randomRoomCode } from '../../lib/ablyRoom'
import { getVisitorId } from '../../lib/visitorId'
import { pickRandomBackground, type BackgroundDef } from '../../lib/backgrounds'

// Original "smash the site" mini-game -- a character you walk around the
// real page, firing projectiles that travel to wherever you aim and shatter
// whatever real element they land on. Not a screenshot of a URL and not a
// copy of any third party's code or character art -- own mechanics, own
// visuals, and it only works here because it really is manipulating our
// own page's real DOM.

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

interface Projectile {
  id: number
  x: number
  y: number
  angle: number
  kind: 'pistol' | 'pellet'
}

interface Grenade {
  id: number
  x: number
  y: number
  kind: 'grenade' | 'rocket'
}

interface ProjectileTarget {
  startX: number
  startY: number
  targetX: number
  targetY: number
  startTime: number
  duration: number
  element: HTMLElement | null
  radius: number
}

interface GrenadeTarget {
  startX: number
  startY: number
  targetX: number
  targetY: number
  startTime: number
  duration: number
  kind: 'grenade' | 'rocket'
}

// A single rigid-body debris chunk from a shattered element -- not a CSS
// transform animation, an actual simulated 2D body (mass, angular
// velocity, real gravity/bounce/friction integration each frame in the
// main loop). w/h/clipPath describe an irregular Voronoi-cut polygon in
// the fragment's own local box; x/y is that box's centroid in viewport
// space. bg is either a solid fill (text/button/etc, sampled from the
// element's own computed color) or an image URL -- for images, bgSize
// pins the FULL original image at its real rendered size and bgPos
// offsets it so each fragment shows exactly the slice of the source image
// it should, the same crop trick CSS sprite sheets use, without ever
// rasterizing anything to a canvas.
interface Fragment {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  av: number
  w: number
  h: number
  clipPath: string
  bg: string
  bgSize?: string
  bgPos?: string
  mass: number
  settled: boolean
  born: number
}

type Pt = [number, number]

// Sutherland-Hodgman polygon clip against one half-plane (a*x + b*y <= c).
// Standard textbook algorithm -- the building block Voronoi cells below
// are made of, clipping a cell down by one perpendicular bisector at a
// time against every other seed point.
function clipHalfPlane(poly: Pt[], a: number, b: number, c: number): Pt[] {
  if (poly.length === 0) return poly
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]
    const prev = poly[(i + poly.length - 1) % poly.length]
    const curIn = a * cur[0] + b * cur[1] <= c
    const prevIn = a * prev[0] + b * prev[1] <= c
    if (curIn !== prevIn) {
      const d1 = a * prev[0] + b * prev[1] - c
      const d2 = a * cur[0] + b * cur[1] - c
      const t = d1 / (d1 - d2)
      out.push([prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t])
    }
    if (curIn) out.push(cur)
  }
  return out
}

// Scatters `count` random seed points in a w x h box and returns each
// seed's Voronoi cell (clipped to the box), by intersecting the box
// against the perpendicular bisector toward every other seed in turn --
// real computational geometry, not a hand-tuned jagged shape. This is
// what actually produces the irregular "shattered glass" piece outlines.
function voronoiCells(w: number, h: number, count: number): Pt[][] {
  const seeds: Pt[] = Array.from({ length: count }, () => [Math.random() * w, Math.random() * h])
  const cells: Pt[][] = []
  for (let i = 0; i < count; i++) {
    let poly: Pt[] = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h]
    ]
    const [sx, sy] = seeds[i]
    for (let j = 0; j < count && poly.length >= 3; j++) {
      if (j === i) continue
      const [ox, oy] = seeds[j]
      const mx = (sx + ox) / 2
      const my = (sy + oy) / 2
      const dx = ox - sx
      const dy = oy - sy
      poly = clipHalfPlane(poly, dx, dy, dx * mx + dy * my)
    }
    if (poly.length >= 3) cells.push(poly)
  }
  return cells
}

// Shoelace formula -- true polygon area and centroid, used both as each
// fragment's physics mass and as the pivot its clip-path rotates around.
function polyAreaCentroid(poly: Pt[]): { area: number; cx: number; cy: number } {
  let area = 0,
    cx = 0,
    cy = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    const cross = x0 * y1 - x1 * y0
    area += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  area *= 0.5
  if (Math.abs(area) < 0.01) return { area: 0, cx: poly[0]?.[0] ?? 0, cy: poly[0]?.[1] ?? 0 }
  return { area: Math.abs(area), cx: cx / (6 * area), cy: cy / (6 * area) }
}

const FRAG_GRAVITY = 0.9
const FRAG_RESTITUTION = 0.38
const FRAG_FRICTION = 0.82
const FRAG_ANGULAR_FRICTION = 0.96
const FRAG_SETTLE_SPEED = 0.6
const FRAG_LIFETIME_MS = 5000
const FRAG_MAX_LIVE = 140

const PARTICLE_COLORS = ['#39ff14', '#a78bfa', '#facc15', '#60a5fa', '#f472b6']
const DUST_COLORS = ['#cbd5e1', '#94a3b8', '#e2e8f0']
const DESTROYABLE_SELECTOR = 'img, svg, button, a, p, h1, h2, h3, h4, h5, h6, span, li'
const PLAYER_SPEED = 6
const FLY_SPEED = 7
// Flight stamina -- 6 real seconds airborne before you're forced back down,
// refilling at half that drain rate while not flying, so hopping fly on
// and off doesn't dodge the cap. Stops flight from being a free way to
// duck out of combat indefinitely. Tracked in frames at an assumed 60fps,
// same convention every other per-frame constant in this file already
// uses (GRAVITY, walkPhase, etc.) -- no real deltaTime tracked anywhere.
const FLY_MAX_FRAMES = 6000 / (1000 / 60)
const FLY_DRAIN_PER_FRAME = 1 / FLY_MAX_FRAMES
const FLY_REGEN_PER_FRAME = FLY_DRAIN_PER_FRAME * 0.5
// Needs at least this much fuel banked before flight can be toggled back
// on -- stops a 0%-fuel player from flicking it on for one frame.
const FLY_MIN_TO_ENGAGE = 0.08
const GROUND_MARGIN = 110
const GRAVITY = 0.8
const JUMP_VELOCITY = -13
const FAST_FALL_MULT = 2.4
const GRAPPLE_MIN_DURATION = 140
const GRAPPLE_MAX_DURATION = 420
// Ground-only dash in whatever direction you're currently facing -- a
// burst of speed well above normal walk speed, briefly invulnerable to
// nothing in particular (no mechanical effect beyond movement), mostly
// just a fast, fun way to close distance or dodge sideways.
const SLIDE_DURATION = 320
const SLIDE_SPEED = 15
const SLIDE_COOLDOWN = 550
const SCROLL_MARGIN = 150
const SCROLL_SPEED = 14
const LASER_SAMPLES = 26
const ROCKET_RADIUS = 220
const ROCKET_DURATION = 320
// Drone is a remote-control unit you actually pilot, not an autonomous
// turret -- deploy it, fly it around with WASD/the joystick ignoring
// gravity, and fire its own zap shot while your stickman freezes in place
// (still a real target in PvP, just not responding to input) until you
// swap back. Confirmed as a real distinct mechanic on the reference site,
// not just another gun skin, via direct testing.
const DRONE_SPEED = 7.5
const DRONE_TRAVEL_MS = 450
const DRONE_ZAP_DAMAGE = 14
// Railgun pierces: unlike laser (point-sampled along the line, so it can
// skip small/thin elements between samples), this checks every original
// destroyable element's actual bounding box against the shot line, so it
// reliably cuts through every stacked section in its path, not just
// whatever the samples happened to land on. Confirmed as their signature
// weapon via direct testing -- "a beam cuts a straight slit through
// multiple stacked sections at once."
const RAILGUN_COOLDOWN = 650
const RAILGUN_DAMAGE = 34
// A shot down a content-dense line could in principle intersect dozens of
// elements at once; each destroy call does real work (particles, a sprite
// animation, a DOM-mutated tumble, a rubble mark). Capping how many land
// per shot bounds the worst-case synchronous cost of one click so a
// packed page can't turn a single shot into a visible stutter.
const RAILGUN_MAX_HITS = 18
// A one-shot wide cone blast rather than true press-and-hold sustained
// fire -- every other weapon in this game is a single click/tap, and
// adding separate mousedown/mouseup (plus mobile hold-button) state just
// for this one weapon would be new input-handling surface area right
// after a long session spent debugging timing issues elsewhere. Several
// real flame sprites animate along the cone in one shot instead, so it
// still reads as "a stream of fire," just resolved instantly like
// everything else.
const FLAMETHROWER_RANGE = 230
const FLAMETHROWER_HALF_ANGLE = 0.38 // radians, ~22 degrees each side
const FLAMETHROWER_COOLDOWN = 550
type Weapon = 'pistol' | 'shotgun' | 'laser' | 'rocket' | 'drone' | 'railgun' | 'flamethrower'
type Character = 'stickman' | 'hooded' | 'ranger'
type BgStyle = 'image' | 'random' | 'void' | 'brand' | 'grid' | 'static'
type RoomMode = 'coop' | 'pvp' | 'hideseek'

// Prop Hunt mashed up with the destroy-the-page mechanic: one Seeker plays
// a normal armed round, everyone else is a Hider who "becomes" a real page
// element (snaps to it, invisible to the Seeker) instead of carrying a
// weapon. Re-disguising is allowed but costs a brief exposed travel window
// plus a cooldown, rather than a one-time-only pick -- more dynamic, per
// the user's explicit choice over the simpler "lock in forever" version.
const HS_HIDING_MS = 10000
const HS_HUNTING_MS = 120000
const HS_REDISGUISE_COOLDOWN_MS = 10000
const HS_REDISGUISE_TRAVEL_MS = 500
type HideSeekPhase = 'lobby' | 'hiding' | 'hunting' | 'ended'
type HideSeekRole = 'seeker' | 'hider' | null

// What shows through once a spot is actually punched out. "Random" (the
// default) picks a different one of the others for every single hole, so
// no two burns look the same; the rest pin every hole to one look.
const BG_STYLES: Record<Exclude<BgStyle, 'random' | 'image'>, { label: string; css: string }> = {
  void: { label: 'Void', css: 'radial-gradient(circle, #1e293b 0%, #05060a 100%)' },
  brand: { label: 'Brand', css: 'repeating-linear-gradient(45deg, #39ff1430 0 10px, #0f172a 10px 20px)' },
  grid: {
    label: 'Grid',
    css: 'repeating-linear-gradient(0deg, #ffffff22 0 1px, transparent 1px 12px), repeating-linear-gradient(90deg, #ffffff22 0 1px, transparent 1px 12px), #05060a'
  },
  static: { label: 'Static', css: 'repeating-conic-gradient(#ffffff1a 0% 25%, #00000033 0% 50%)' }
}
const BG_STYLE_KEYS = Object.keys(BG_STYLES) as Exclude<BgStyle, 'random' | 'image'>[]

// Real scorch decals (Kenney Particle Pack, CC0) instead of a flat clipped
// gradient -- a weapon-specific one is picked per hit for the actual burn
// mark, layered over whichever background pattern got revealed.
const SCORCH_IMAGES = ['/games/fx/scorch_01.png', '/games/fx/scorch_02.png', '/games/fx/scorch_03.png']

// Cosmetic-only loadout -- none of this changes mechanics, it's purely
// "make the character and the destruction look like yours."
const CHAR_COLORS = {
  white: { label: 'White', stroke: '#f8fafc', wingFill: 'rgba(226,232,240,0.6)' },
  green: { label: 'Green', stroke: '#39ff14', wingFill: 'rgba(57,255,20,0.45)' },
  purple: { label: 'Purple', stroke: '#a78bfa', wingFill: 'rgba(167,139,250,0.45)' },
  pink: { label: 'Pink', stroke: '#f472b6', wingFill: 'rgba(244,114,182,0.45)' }
} as const
type CharColorKey = keyof typeof CHAR_COLORS

const PARTICLE_THEMES = {
  rainbow: { label: 'Rainbow', colors: PARTICLE_COLORS },
  brand: { label: 'Brand', colors: ['#39ff14', '#0f172a', '#ffffff'] },
  fire: { label: 'Fire', colors: ['#f97316', '#ef4444', '#facc15'] },
  mono: { label: 'Mono', colors: ['#f8fafc', '#cbd5e1', '#94a3b8'] }
} as const
type ParticleThemeKey = keyof typeof PARTICLE_THEMES

const TEXT_COLORS = {
  original: { label: 'Original', css: '' },
  white: { label: 'White', css: '#f8fafc' },
  red: { label: 'Red', css: '#ef4444' },
  brand: { label: 'Brand', css: '#39ff14' }
} as const
type TextColorKey = keyof typeof TEXT_COLORS

// Lifetime rank ladder -- backed by DestroyScore.totalDestroyed, which only
// ever goes up across sessions (unlike the per-session destroyed% meter).
const RANKS = [
  { name: 'Recruit', min: 0, badge: '/games/ranks/rank-1-recruit.png' },
  { name: 'Wrecker', min: 50, badge: '/games/ranks/rank-2-wrecker.png' },
  { name: 'Demolisher', min: 150, badge: '/games/ranks/rank-3-demolisher.png' },
  { name: 'Juice Junkie', min: 400, badge: '/games/ranks/rank-4-juicejunkie.png' },
  { name: 'Page Slayer', min: 1000, badge: '/games/ranks/rank-5-pageslayer.png' },
  { name: 'Legend', min: 2500, badge: '/games/ranks/rank-6-legend.png' }
] as const

function getRank(total: number) {
  let current: (typeof RANKS)[number] = RANKS[0]
  let next: (typeof RANKS)[number] | null = null
  for (const r of RANKS) {
    if (total >= r.min) current = r
    else {
      next = r
      break
    }
  }
  return { current, next }
}

// "Ranger" character -- real animated sprite sheets (idle/walk/run/jump/
// fall/slide) from MonoPixelArt's "2D Free Animated Character Pack",
// free tier, commercial use allowed (see
// public/games/characters/ranger/LICENSE-monopixelart-character-pack.txt).
// 96x64 frames, single-row strips, same CSS background-position technique
// used for the Mushroom/Flyer Fiend sprites in 999 Last Stand.
const RANGER_FRAME_W = 96
const RANGER_FRAME_H = 64
const RANGER_SHEETS: Record<'idle' | 'walk' | 'air' | 'slide', { src: string; frames: number; fps: number }> = {
  idle: { src: '/games/characters/ranger/idle.png', frames: 8, fps: 110 },
  walk: { src: '/games/characters/ranger/walk.png', frames: 10, fps: 90 },
  air: { src: '/games/characters/ranger/jump.png', frames: 6, fps: 90 },
  slide: { src: '/games/characters/ranger/slide.png', frames: 4, fps: 70 }
}

function RangerSprite({
  pose,
  facingLeft,
  displaySize
}: {
  pose: 'idle' | 'walk' | 'air' | 'slide'
  facingLeft: boolean
  displaySize: number
}) {
  const sheet = RANGER_SHEETS[pose]
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    setFrame(0)
    const t = setInterval(() => setFrame((f) => (f + 1) % sheet.frames), sheet.fps)
    return () => clearInterval(t)
  }, [pose, sheet.frames, sheet.fps])
  const scale = displaySize / RANGER_FRAME_H
  return (
    <div
      style={{
        width: RANGER_FRAME_W * scale,
        height: RANGER_FRAME_H * scale,
        overflow: 'hidden',
        transform: facingLeft ? 'scaleX(-1)' : 'none'
      }}
    >
      <div
        style={{
          width: RANGER_FRAME_W * scale,
          height: RANGER_FRAME_H * scale,
          backgroundImage: `url(${sheet.src})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${RANGER_FRAME_W * sheet.frames * scale}px ${RANGER_FRAME_H * scale}px`,
          backgroundPosition: `-${frame * RANGER_FRAME_W * scale}px 0`,
          imageRendering: 'pixelated'
        }}
      />
    </div>
  )
}

export default function DestroyModeOverlay({
  onExit,
  mode = 'destroy',
  onBackgroundUnlocked
}: {
  onExit: () => void
  // 'hideseek' launches straight into its own dedicated mode -- a separate
  // Games-hub entry, not a sub-option buried inside Smash Juice Junkies's
  // co-op panel. Same underlying engine (movement, weapons, the real-DOM
  // destruction), just a different front door and a fixed room type so the
  // Co-op/PvP tiles never show up here at all.
  mode?: 'destroy' | 'hideseek'
  // Lets the parent (which owns the collection-viewer gallery button) keep
  // its unlocked-backgrounds list in sync without re-fetching -- this
  // component already knows the instant an unlock lands.
  onBackgroundUnlocked?: (backgroundId: string) => void
}) {
  const [crosshair, setCrosshair] = useState({ x: -100, y: -100 })
  const [player, setPlayer] = useState({ x: 120, y: 400 })
  const [pose, setPose] = useState<'idle' | 'walk' | 'air' | 'slide'>('idle')
  const [walkPhase, setWalkPhase] = useState(0)
  const [flying, setFlying] = useState(false)
  const [flyFuel, setFlyFuel] = useState(1)
  const [wingPhase, setWingPhase] = useState(0)
  const [grappleLine, setGrappleLine] = useState<{ x: number; y: number } | null>(null)
  // Defaults to 'image' (not 'random') so the reveal-and-collect mechanic
  // is what most players actually experience -- the old flat patterns
  // below are still there as an opt-out for anyone who just wants the
  // classic look back.
  const [bgStyle, setBgStyle] = useState<BgStyle>('image')
  // The hidden image this session's holes cut into -- one picked per
  // destroy-mode session (not per hole, unlike the old flat patterns) so
  // enough destruction eventually reveals one coherent picture. Page
  // width/height are locked in the first time a hole needs them rather
  // than re-measured every hole, since destroyed elements collapsing
  // their layout space would otherwise shift the crop mid-session and
  // misalign holes cut earlier against ones cut later.
  const [revealBg] = useState<BackgroundDef>(() => pickRandomBackground())
  const pageRevealSizeRef = useRef<{ w: number; h: number } | null>(null)
  const bgUnlockedRef = useRef(false)
  const [bgUnlocked, setBgUnlocked] = useState(false)
  const visitorIdRef = useRef('')
  const [beam, setBeam] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [charColor, setCharColor] = useState<CharColorKey>('white')
  const [particleTheme, setParticleTheme] = useState<ParticleThemeKey>('rainbow')
  const [textColor, setTextColor] = useState<TextColorKey>('original')
  const [lifetimeTotal, setLifetimeTotal] = useState<number | null>(null)
  // Stickman is the default for everyone; the hooded sprite is a $9.99
  // account-wide unlock via the same digital-unlock flow as Neon Sketch.
  const [character, setCharacter] = useState<Character>('stickman')
  const [hoodedUnlocked, setHoodedUnlocked] = useState(false)
  const [showCharacterPaywall, setShowCharacterPaywall] = useState(false)
  // One side panel at a time instead of three independently-toggleable
  // floating boxes that used to render on top of each other.
  const [activePanel, setActivePanel] = useState<'appearance' | 'character' | 'coop' | null>(mode === 'hideseek' ? 'coop' : null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [destroyedCount, setDestroyedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(1)
  const [victoryShown, setVictoryShown] = useState(false)
  const [drone, setDrone] = useState<{ x: number; y: number; bob: number; facingLeft: boolean } | null>(null)
  const [droneZap, setDroneZap] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [pilotingDrone, setPilotingDrone] = useState(false)
  const [railBeam, setRailBeam] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [fragments, setFragments] = useState<Fragment[]>([])
  const [projectiles, setProjectiles] = useState<Projectile[]>([])
  const [grenades, setGrenades] = useState<Grenade[]>([])
  const [weapon, setWeapon] = useState<Weapon>('pistol')
  const [flash, setFlash] = useState(0)
  const [mpStatus, setMpStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [mpRoom, setMpRoom] = useState<string | null>(null)
  const [mpJoinInput, setMpJoinInput] = useState('')
  const [mpMode, setMpMode] = useState<RoomMode>('coop')
  const [hp, setHp] = useState(100)
  const [isTouch, setIsTouch] = useState(false)
  const [dead, setDead] = useState(false)
  const [remotePlayers, setRemotePlayers] = useState<
    Record<
      string,
      {
        x: number
        y: number
        character: Character
        facingLeft: boolean
        hp: number
        dead: boolean
        role?: HideSeekRole
        hidden?: boolean
        found?: boolean
      }
    >
  >({})
  const [hsPhase, setHsPhase] = useState<HideSeekPhase>('lobby')
  const [hsRole, setHsRole] = useState<HideSeekRole>(null)
  const [hsTimeLeft, setHsTimeLeft] = useState(0)
  const [hsWinner, setHsWinner] = useState<'seekers' | 'hiders' | null>(null)
  const [hsHidersTotal, setHsHidersTotal] = useState(0)
  const [hsHidersRemaining, setHsHidersRemaining] = useState(0)
  const [hsFound, setHsFound] = useState(false)
  const [hsHidden, setHsHidden] = useState(false)
  const [hsCooldownLeft, setHsCooldownLeft] = useState(0)

  const particlesRef = useRef<Particle[]>([])
  const nextParticleId = useRef(0)
  const fragmentsRef = useRef<Fragment[]>([])
  const nextFragmentId = useRef(0)
  const hadFragmentsRef = useRef(false)
  const nextProjectileId = useRef(0)
  const nextGrenadeId = useRef(0)
  const rafRef = useRef<number>(0)
  const weaponRef = useRef<Weapon>('pistol')
  const destroyedSetRef = useRef<Set<HTMLElement>>(new Set())
  // Every "hole" left behind by a destroyed element, in document space
  // (scroll-independent -- same coordinate convention revealHole already
  // uses). The movement loop treats each one as a one-way platform: fall
  // onto its top edge from above and you land on it, jump up through it
  // from below and nothing stops you, hold S/down while landing to drop
  // straight through -- same "debris you can climb" feel as blasting a
  // hole in a wall and standing on the broken chunk.
  const holesRef = useRef<{ left: number; top: number; width: number; height: number }[]>([])
  const victoryTriggeredRef = useRef(false)
  // destroyOne gets called from inside click/contextmenu/keydown handlers
  // that are wired up via useEffect(..., []) -- those only run once at
  // mount, so their closures permanently froze on whatever `totalCount`
  // was AT MOUNT (its useState default of 1), never seeing the real count
  // the mount effect below computes a moment later. That made the victory
  // check true after destroying exactly one thing, with ANY weapon --
  // confirmed live: a single drone kill on a fresh page instantly said
  // "Website Destroyed." A ref is read fresh on every call, no closure
  // staleness, so this is the actual source of truth now.
  const totalCountRef = useRef(1)
  // Position once it's actually out and flyable; null before the first
  // deploy. Separate from droneDeployRef below, which only exists during
  // the brief launch travel animation.
  const droneRef = useRef<{ x: number; y: number } | null>(null)
  const droneDeployRef = useRef<{ startX: number; startY: number; targetX: number; targetY: number; startTime: number } | null>(
    null
  )
  const pilotingDroneRef = useRef(false)
  const playerRef = useRef({ x: 120, y: 400, vy: 0, onGround: true })
  const walkPhaseRef = useRef(0)
  const flyingRef = useRef(false)
  const flyFuelRef = useRef(1)
  const flyFuelDisplayedRef = useRef(1)
  const wingPhaseRef = useRef(0)
  const grappleRef = useRef<{ startX: number; startY: number; targetX: number; targetY: number; startTime: number; duration: number } | null>(
    null
  )
  const grappleCooldownRef = useRef(0)
  const slideRef = useRef<{ startTime: number; dirX: 1 | -1 } | null>(null)
  const slideCooldownRef = useRef(0)
  const railgunCooldownRef = useRef(0)
  const flamethrowerCooldownRef = useRef(0)
  const bgStyleRef = useRef<BgStyle>('image')
  const particleThemeRef = useRef<ParticleThemeKey>('rainbow')
  const textColorRef = useRef<TextColorKey>('original')
  const crosshairRef = useRef({ x: -100, y: -100 })
  const keysRef = useRef<Set<string>>(new Set())
  const flashRef = useRef(0)
  const projectileTargets = useRef<Map<number, ProjectileTarget>>(new Map())
  const grenadeTargets = useRef<Map<number, GrenadeTarget>>(new Map())
  const lastSyncedRef = useRef(0)
  const elementIndexRef = useRef<Map<HTMLElement, number>>(new Map())
  const indexElementRef = useRef<Map<number, HTMLElement>>(new Map())
  const roomRef = useRef<AblyRoom | null>(null)
  const clientIdRef = useRef(`p-${Math.random().toString(36).slice(2, 10)}`)
  const characterRef = useRef<Character>('stickman')
  const mpFrameRef = useRef(0)
  const joystickVecRef = useRef({ x: 0, y: 0 })
  const joystickActiveRef = useRef(false)
  const roomModeRef = useRef<RoomMode>('coop')
  const hpRef = useRef(100)
  const deadRef = useRef(false)
  const deathAtRef = useRef(0)
  const respawnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remotePlayersRef = useRef<
    Record<
      string,
      {
        x: number
        y: number
        character: Character
        facingLeft: boolean
        hp: number
        dead: boolean
        role?: HideSeekRole
        hidden?: boolean
        found?: boolean
      }
    >
  >({})
  // Hide & Seek state. Phase deadlines are wall-clock (Date.now()) because
  // they're shared across clients via a single 'roundStart' broadcast --
  // performance.now() is monotonic-since-page-load and not comparable
  // across different browser tabs/devices, unlike every other timing ref
  // in this file (drone travel, cooldowns) which stays on performance.now()
  // on purpose since those are purely local animations.
  const hsPhaseRef = useRef<HideSeekPhase>('lobby')
  const hsRoleRef = useRef<HideSeekRole>(null)
  const hsHidingUntilRef = useRef(0)
  const hsHuntingUntilRef = useRef(0)
  const hsHiderIdsRef = useRef<Set<string>>(new Set())
  const hsFoundRef = useRef<Set<string>>(new Set())
  const hsHiddenRef = useRef(false)
  const hsFoundSelfRef = useRef(false)
  const hsRedisguiseCooldownUntilRef = useRef(0)
  const hsRedisguiseTravelRef = useRef<{ startX: number; startY: number; targetX: number; targetY: number; startTime: number } | null>(
    null
  )
  const hsRoundEndedRef = useRef(false)
  const hsTimeLeftDisplayedRef = useRef(-1)
  const hsCooldownDisplayedRef = useRef(-1)

  // Count how much of the page is actually destroyable, once, so the HUD
  // can show real progress instead of just a raw shot tally -- and assign
  // each one a stable index in query order, which is what co-op uses to
  // tell another client "destroy THIS element" over the network (both
  // clients loaded the same page, so the same query returns elements in
  // the same order; this breaks if the two viewers see meaningfully
  // different page content, which is an accepted limitation).
  useEffect(() => {
    const els = document.querySelectorAll(DESTROYABLE_SELECTOR)
    let count = 0
    els.forEach((el) => {
      const h = el as HTMLElement
      if (!h.closest('[data-destroy-ui]')) {
        elementIndexRef.current.set(h, count)
        indexElementRef.current.set(count, h)
        count++
      }
    })
    totalCountRef.current = Math.max(count, 1)
    setTotalCount(totalCountRef.current)
    visitorIdRef.current = getVisitorId()
    pageRevealSizeRef.current = { w: window.innerWidth, h: document.documentElement.scrollHeight }
    const groundY = window.innerHeight - GROUND_MARGIN
    playerRef.current = { x: window.innerWidth / 2, y: groundY, vy: 0, onGround: true }
    setPlayer({ x: playerRef.current.x, y: playerRef.current.y })
    const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    setIsTouch(touchCapable)
    if (touchCapable) {
      // No mouse to set an initial aim point, and firing/throwing before
      // ever dragging to aim would otherwise target the crosshair's
      // off-screen default (-100,-100) -- start aimed straight ahead
      // instead so FIRE/Grenade do something sensible immediately.
      const start = { x: window.innerWidth / 2, y: window.innerHeight * 0.35 }
      crosshairRef.current = start
      setCrosshair(start)
    }
  }, [])

  // Pulls the player's lifetime total so the HUD shows real rank progress
  // from the moment they open the mode, not just this session's count.
  // Guests get a 401 and just don't see a rank -- same gating as every
  // other persistent feature.
  useEffect(() => {
    fetch('/api/destroy/score')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setLifetimeTotal(data.totalDestroyed)
      })
      .catch(() => {})
  }, [])

  // Guests just never see as unlocked -- the status endpoint returns
  // unlocked:false for anyone not signed in, same as every other feature.
  useEffect(() => {
    fetch('/api/digital/status?feature=hooded-character')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.unlocked) setHoodedUnlocked(true)
      })
      .catch(() => {})
  }, [])

  // Reads destroyedSetRef directly (always current) rather than the
  // destroyedCount state (which would be stale inside the long-lived
  // effect closures this gets called from) so the delta is always right.
  const syncScore = () => {
    const total = destroyedSetRef.current.size
    const delta = total - lastSyncedRef.current
    if (delta <= 0) return
    lastSyncedRef.current = total
    fetch('/api/destroy/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destroyed: delta }),
      keepalive: true
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setLifetimeTotal(data.totalDestroyed)
      })
      .catch(() => {})
  }

  // Safety net for progress between syncs -- periodic while playing, and a
  // best-effort beacon-style sync if the tab closes before Exit is clicked.
  useEffect(() => {
    const interval = setInterval(syncScore, 20000)
    const onUnload = () => syncScore()
    window.addEventListener('beforeunload', onUnload)
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [])

  // Respawn after a PvP death -- full heal, fresh random spot, and an
  // immediate move broadcast so everyone else sees the reset right away
  // instead of waiting for the next throttled tick.
  const respawn = () => {
    if (respawnTimeoutRef.current) {
      clearTimeout(respawnTimeoutRef.current)
      respawnTimeoutRef.current = null
    }
    const groundY = window.innerHeight - GROUND_MARGIN
    const nx = 60 + Math.random() * (window.innerWidth - 120)
    playerRef.current = { x: nx, y: groundY, vy: 0, onGround: true }
    setPlayer({ x: nx, y: groundY })
    hpRef.current = 100
    setHp(100)
    deadRef.current = false
    setDead(false)
    // Dying while piloting the drone used to leave pilotingDroneRef stuck
    // true through the respawn -- the stickman came back dimmed to 35%
    // opacity (the piloting visual treatment) and permanently frozen,
    // since pilotingDroneRef short-circuits the whole movement branch
    // ahead of everything else. Control always returns to the stickman on
    // death; the drone itself (if any) just stays deployed and idle.
    if (pilotingDroneRef.current) {
      pilotingDroneRef.current = false
      setPilotingDrone(false)
    }
    droneDeployRef.current = null
    if (roomRef.current) {
      roomRef.current.publish('move', {
        clientId: clientIdRef.current,
        x: nx,
        y: groundY,
        character: characterRef.current,
        facingLeft: false,
        hp: 100,
        dead: false,
        mode: roomModeRef.current
      })
    }
  }

  const takeDamage = (damage: number) => {
    if (roomModeRef.current !== 'pvp' || deadRef.current) return
    hpRef.current = Math.max(0, hpRef.current - damage)
    setHp(hpRef.current)
    if (hpRef.current <= 0) {
      deadRef.current = true
      deathAtRef.current = performance.now()
      setDead(true)
      spawnParticles(playerRef.current.x, playerRef.current.y - 28, 20)
      // Tracked via a ref (instead of a bare setTimeout) so a stray second
      // death can't stack a duplicate pending respawn, and so the main
      // loop's failsafe below can tell a respawn is already scheduled.
      if (respawnTimeoutRef.current) clearTimeout(respawnTimeoutRef.current)
      respawnTimeoutRef.current = setTimeout(respawn, 2000)
    }
  }

  // Independent of the main requestAnimationFrame loop on purpose -- an
  // earlier version of this failsafe lived inside that loop, which means
  // if an uncaught error anywhere in that loop (not necessarily PvP
  // related) ever stops it from scheduling its next frame, EVERYTHING
  // tied to that loop silently stops forever, including a failsafe that
  // lived inside it. A plain setInterval is driven by the browser's own
  // timer queue, completely independent of that loop's health, so this
  // keeps checking and will force a respawn even if the whole game loop
  // has quietly died.
  useEffect(() => {
    const interval = setInterval(() => {
      if (deadRef.current && performance.now() - deathAtRef.current > 4000) {
        respawn()
      }
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Co-op: anyone on this page can join the same room code and wreck the
  // same page content together. No host/guest split like Last Stand --
  // destruction is naturally idempotent (destroyedSetRef already blocks
  // double-destroying the same element), so every client can just destroy
  // locally on receipt and broadcast locally on fire, peer-to-peer style.
  // PvP mode layers combat on top of the same room: whoever creates the
  // room picks the mode and it's piggybacked on every move broadcast, so
  // anyone joining later picks it up within one broadcast tick.
  const connectRoom = async (code: string, mode: RoomMode = 'coop') => {
    setMpStatus('connecting')
    roomModeRef.current = mode
    setMpMode(mode)
    try {
      const room = await AblyRoom.connect(code, clientIdRef.current, 'destroy')
      roomRef.current = room
      room.subscribe('destroy', (data: { index: number; x: number; y: number; big: boolean }) => {
        const el = indexElementRef.current.get(data.index)
        if (el) destroyOne(el, data.x, data.y, data.big, true)
      })
      room.subscribe(
        'move',
        (data: {
          clientId: string
          x: number
          y: number
          character: Character
          facingLeft: boolean
          hp: number
          dead: boolean
          mode: RoomMode
          role?: HideSeekRole
          hidden?: boolean
        }) => {
          if (data.clientId === clientIdRef.current) return
          if (data.mode && data.mode !== roomModeRef.current) {
            roomModeRef.current = data.mode
            setMpMode(data.mode)
          }
          const prevFound = remotePlayersRef.current[data.clientId]?.found
          const entry = {
            x: data.x,
            y: data.y,
            character: data.character,
            facingLeft: data.facingLeft,
            hp: data.hp ?? 100,
            dead: !!data.dead,
            role: data.role,
            hidden: !!data.hidden,
            found: prevFound
          }
          remotePlayersRef.current = { ...remotePlayersRef.current, [data.clientId]: entry }
          setRemotePlayers(remotePlayersRef.current)
        }
      )
      room.subscribe('hit', (data: { targetClientId: string; damage: number }) => {
        if (data.targetClientId === clientIdRef.current) takeDamage(data.damage)
      })
      room.subscribe('leave', (data: { clientId: string }) => {
        const next = { ...remotePlayersRef.current }
        delete next[data.clientId]
        remotePlayersRef.current = next
        setRemotePlayers(next)
      })
      // Whoever starts a round becomes Seeker and everyone currently in
      // remotePlayersRef at that moment becomes a Hider -- broadcast once,
      // every client (including the starter, who gets their own message
      // echoed back same as every other event here) derives its own role
      // and phase deadlines from this single shared payload.
      room.subscribe(
        'roundStart',
        (data: { startedAt: number; hidingMs: number; huntingMs: number; seekerId: string; hiderIds: string[] }) => {
          hsPhaseRef.current = 'hiding'
          setHsPhase('hiding')
          hsRoleRef.current = data.seekerId === clientIdRef.current ? 'seeker' : 'hider'
          setHsRole(hsRoleRef.current)
          hsHidingUntilRef.current = data.startedAt + data.hidingMs
          hsHuntingUntilRef.current = data.startedAt + data.hidingMs + data.huntingMs
          hsHiderIdsRef.current = new Set(data.hiderIds)
          hsFoundRef.current = new Set()
          hsHiddenRef.current = false
          setHsHidden(false)
          hsFoundSelfRef.current = false
          setHsFound(false)
          hsRoundEndedRef.current = false
          setHsWinner(null)
          setHsHidersTotal(data.hiderIds.length)
          setHsHidersRemaining(data.hiderIds.length)
          hsRedisguiseCooldownUntilRef.current = 0
          hsRedisguiseTravelRef.current = null
          hsTimeLeftDisplayedRef.current = -1
          hsCooldownDisplayedRef.current = -1
          // Clear any stale found/hidden flags left over from a previous
          // round so the remote-player render rule starts clean.
          const cleared: typeof remotePlayersRef.current = {}
          for (const [id, rp] of Object.entries(remotePlayersRef.current)) {
            cleared[id] = { ...rp, found: false, hidden: false, role: data.hiderIds.includes(id) ? 'hider' : 'seeker' }
          }
          remotePlayersRef.current = cleared
          setRemotePlayers(cleared)
        }
      )
      room.subscribe('found', (data: { clientId: string }) => {
        if (hsFoundRef.current.has(data.clientId)) return
        hsFoundRef.current.add(data.clientId)
        if (data.clientId === clientIdRef.current) {
          hsFoundSelfRef.current = true
          setHsFound(true)
          hsHiddenRef.current = false
          setHsHidden(false)
        }
        const rp = remotePlayersRef.current[data.clientId]
        if (rp) {
          remotePlayersRef.current = { ...remotePlayersRef.current, [data.clientId]: { ...rp, found: true, hidden: false } }
          setRemotePlayers(remotePlayersRef.current)
          spawnExplosionFx(rp.x, rp.y - 28, true)
          spawnScreenTear(rp.x, rp.y - 28)
        }
        setHsHidersRemaining(Math.max(0, hsHiderIdsRef.current.size - hsFoundRef.current.size))
      })
      room.subscribe('roundEnd', (data: { winner: 'seekers' | 'hiders' }) => {
        if (hsPhaseRef.current === 'ended') return
        hsRoundEndedRef.current = true
        hsPhaseRef.current = 'ended'
        setHsPhase('ended')
        setHsWinner(data.winner)
      })
      setMpRoom(code)
      setMpStatus('connected')
    } catch {
      setMpStatus('error')
    }
  }

  const leaveRoom = () => {
    if (roomRef.current) {
      roomRef.current.publish('leave', { clientId: clientIdRef.current })
      roomRef.current.close()
      roomRef.current = null
    }
    setMpRoom(null)
    setMpStatus('idle')
    remotePlayersRef.current = {}
    setRemotePlayers({})
    hpRef.current = 100
    setHp(100)
    deadRef.current = false
    setDead(false)
    hsPhaseRef.current = 'lobby'
    setHsPhase('lobby')
    hsRoleRef.current = null
    setHsRole(null)
    hsFoundRef.current = new Set()
    hsHiderIdsRef.current = new Set()
    hsHiddenRef.current = false
    setHsHidden(false)
    hsFoundSelfRef.current = false
    setHsFound(false)
    hsRedisguiseTravelRef.current = null
    hsRoundEndedRef.current = false
    setHsWinner(null)
  }

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.publish('leave', { clientId: clientIdRef.current })
        roomRef.current.close()
      }
    }
  }, [])

  const CONTROL_KEYS = new Set([' ', 'spacebar', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'])

  // Hiders have no weapons at all (combat guards below) but do move
  // freely. Seekers are fully frozen during the 'hiding' head-start phase
  // so they can't start hunting before hiders get a chance to disguise.
  const isHideSeekHider = () => roomModeRef.current === 'hideseek' && hsRoleRef.current === 'hider'
  const isHideSeekSeekerWaiting = () =>
    roomModeRef.current === 'hideseek' && hsRoleRef.current === 'seeker' && hsPhaseRef.current === 'hiding'

  // Shared by the keyboard handler below and the mobile action buttons --
  // mobile has no spacebar/F/Q to hook into, so these need to be callable
  // directly from a button's onClick too.
  const doJump = () => {
    if (pilotingDroneRef.current || isHideSeekSeekerWaiting() || slideRef.current) return
    if (playerRef.current.onGround && !flyingRef.current) {
      playerRef.current.vy = JUMP_VELOCITY
      playerRef.current.onGround = false
    }
  }
  const doToggleFly = () => {
    if (pilotingDroneRef.current || isHideSeekSeekerWaiting()) return
    if (!flyingRef.current && flyFuelRef.current < FLY_MIN_TO_ENGAGE) return
    flyingRef.current = !flyingRef.current
    setFlying(flyingRef.current)
    if (flyingRef.current) playerRef.current.vy = 0
  }
  const doGrapple = () => {
    if (pilotingDroneRef.current || isHideSeekSeekerWaiting() || slideRef.current) return
    if (grappleRef.current || performance.now() <= grappleCooldownRef.current) return
    const { x: px, y: py } = playerRef.current
    const tx = crosshairRef.current.x
    const ty = crosshairRef.current.y
    const dist = Math.hypot(tx - px, ty - (py - 28))
    grappleRef.current = {
      startX: px,
      startY: py - 28,
      targetX: tx,
      targetY: ty,
      startTime: performance.now(),
      duration: Math.min(GRAPPLE_MAX_DURATION, Math.max(GRAPPLE_MIN_DURATION, dist * 1.1))
    }
  }

  // Ground-only burst dash, direction = whichever way the character is
  // currently facing (same crosshair-relative facing used everywhere
  // else). No-op mid-air, mid-grapple, or on cooldown.
  const doSlide = () => {
    if (pilotingDroneRef.current || isHideSeekSeekerWaiting()) return
    if (slideRef.current || grappleRef.current) return
    if (performance.now() <= slideCooldownRef.current) return
    if (!playerRef.current.onGround) return
    const dirX = crosshairRef.current.x < playerRef.current.x ? -1 : 1
    slideRef.current = { startTime: performance.now(), dirX }
    slideCooldownRef.current = performance.now() + SLIDE_DURATION + SLIDE_COOLDOWN
  }

  // '5' is a 3-way toggle: nothing deployed yet -> launch one toward the
  // crosshair (it flies out, then control hands over automatically once
  // it arrives); already out and idle -> hop back into it; already
  // piloting -> hand control back to the stickman, drone just hovers
  // wherever it was left.
  const toggleDronePilot = () => {
    // The "already piloting -> hand control back" path is deliberately
    // NEVER blocked, even for a Hider/waiting Seeker -- it's the only way
    // out if a drone were ever somehow left piloted (e.g. carried over
    // from solo play into a round), and pilotingDroneRef short-circuits
    // the entire movement branch ahead of every Hide & Seek check, so
    // getting stuck here would otherwise be unrecoverable.
    if (pilotingDroneRef.current) {
      pilotingDroneRef.current = false
      setPilotingDrone(false)
      return
    }
    if (isHideSeekHider() || isHideSeekSeekerWaiting()) return
    if (droneRef.current) {
      pilotingDroneRef.current = true
      setPilotingDrone(true)
      return
    }
    if (droneDeployRef.current) return // already mid-launch
    droneDeployRef.current = {
      startX: playerRef.current.x,
      startY: playerRef.current.y - 28,
      targetX: crosshairRef.current.x,
      targetY: crosshairRef.current.y,
      startTime: performance.now()
    }
  }

  useEffect(() => {
    // Game controls reuse letters that are also valid room-code characters
    // (room codes are drawn from an alphabet that includes A/W/S/D) -- with
    // no guard here, typing a room code into the join input would silently
    // swallow those keystrokes (preventDefault on a "movement" key) AND
    // move the character in the background. Any focused form field opts
    // out of every game hotkey entirely.
    const isTypingIntoField = () => {
      const el = document.activeElement
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingIntoField()) return
      const k = e.key.toLowerCase()
      if (CONTROL_KEYS.has(k)) e.preventDefault()
      // While piloting the drone, the stickman's own weapon slots don't
      // apply -- you're not holding a gun as the stickman right now. '5'
      // still works, to hand control back.
      if (pilotingDroneRef.current && ['1', '2', '3', '4', '6', '7'].includes(k)) return
      // Hiders have no weapons at all -- no hotbar slots apply to them.
      // '5' is still let through so a drone somehow left piloted can be
      // handed back (see toggleDronePilot's own comment on this).
      if (isHideSeekHider() && ['1', '2', '3', '4', '6', '7'].includes(k)) return
      if (isHideSeekHider() && k === '5' && !pilotingDroneRef.current) return
      if (k === '1') {
        weaponRef.current = 'pistol'
        setWeapon('pistol')
        return
      }
      if (k === '2') {
        weaponRef.current = 'shotgun'
        setWeapon('shotgun')
        return
      }
      if (k === '3') {
        weaponRef.current = 'laser'
        setWeapon('laser')
        return
      }
      if (k === '4') {
        weaponRef.current = 'rocket'
        setWeapon('rocket')
        return
      }
      if (k === '5') {
        toggleDronePilot()
        return
      }
      if (k === '6') {
        weaponRef.current = 'railgun'
        setWeapon('railgun')
        return
      }
      if (k === '7') {
        weaponRef.current = 'flamethrower'
        setWeapon('flamethrower')
        return
      }
      if (k === ' ' || k === 'spacebar') {
        if (!e.repeat) doJump()
        return
      }
      if (k === 'f') {
        if (!e.repeat) doToggleFly()
        return
      }
      if (k === 'q') {
        if (!e.repeat) doGrapple()
        return
      }
      if (k === 'shift') {
        if (!e.repeat) doSlide()
        return
      }
      keysRef.current.add(k)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (isTypingIntoField()) return
      const k = e.key.toLowerCase()
      if (CONTROL_KEYS.has(k)) e.preventDefault()
      keysRef.current.delete(k)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Aiming: mouse just follows the cursor. Touch needs to track a specific
  // finger by identifier -- e.touches[0] isn't stable once the joystick or
  // a button is also being held, and any touch that starts on our own UI
  // (data-destroy-ui) is excluded so dragging the joystick doesn't also
  // drag the aim point.
  const aimTouchIdRef = useRef<number | null>(null)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      crosshairRef.current = { x: e.clientX, y: e.clientY }
      setCrosshair(crosshairRef.current)
    }
    const onTouchStart = (e: TouchEvent) => {
      if (aimTouchIdRef.current !== null) return
      for (const t of Array.from(e.changedTouches)) {
        const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null
        if (el?.closest('[data-destroy-ui]')) continue
        aimTouchIdRef.current = t.identifier
        crosshairRef.current = { x: t.clientX, y: t.clientY }
        setCrosshair(crosshairRef.current)
        break
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (aimTouchIdRef.current === null) return
      const t = Array.from(e.touches).find((t) => t.identifier === aimTouchIdRef.current)
      if (t) {
        crosshairRef.current = { x: t.clientX, y: t.clientY }
        setCrosshair(crosshairRef.current)
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (Array.from(e.changedTouches).some((t) => t.identifier === aimTouchIdRef.current)) {
        aimTouchIdRef.current = null
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  const spawnParticles = (x: number, y: number, count = 14) => {
    const palette = PARTICLE_THEMES[particleThemeRef.current].colors
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2
      const spd = 2 + Math.random() * 4
      particlesRef.current.push({
        id: nextParticleId.current++,
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1,
        life: 30 + Math.random() * 20,
        color: palette[Math.floor(Math.random() * palette.length)]
      })
    }
  }

  // Flat, low-spread puff for the character's own feet -- distinct from the
  // bright destruction particles so a landing reads as "weight hit ground"
  // rather than another explosion.
  const spawnDust = (x: number, y: number) => {
    for (let i = 0; i < 8; i++) {
      const ang = Math.PI + Math.random() * Math.PI
      const spd = 1 + Math.random() * 2
      particlesRef.current.push({
        id: nextParticleId.current++,
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.4 - 0.5,
        life: 18 + Math.random() * 10,
        color: DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)]
      })
    }
  }

  // Irregular torn-edge silhouette instead of the element's clean rectangle,
  // so a destroyed chunk reads as ripped rather than just faded out.
  const jaggedClipPath = () => {
    const points: string[] = []
    const n = 10
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2
      const r = 42 + Math.random() * 12
      points.push(`${(50 + Math.cos(angle) * r).toFixed(1)}% ${(50 + Math.sin(angle) * r).toFixed(1)}%`)
    }
    return `polygon(${points.join(',')})`
  }

  // Big hits (explosions, Railgun, Flamethrower) get a torn-paper vignette
  // radiating from the impact point -- same jagged-edge language as every
  // individual destroyed element, just scaled up to read as "the screen
  // itself just got ripped," for extra weight on the weapons meant to feel
  // like the biggest ones in the roster.
  const spawnScreenTear = (x: number, y: number) => {
    const size = Math.max(window.innerWidth, window.innerHeight) * 1.4
    const tear = document.createElement('div')
    tear.style.position = 'fixed'
    tear.style.left = `${x - size / 2}px`
    tear.style.top = `${y - size / 2}px`
    tear.style.width = `${size}px`
    tear.style.height = `${size}px`
    tear.style.zIndex = '196'
    tear.style.pointerEvents = 'none'
    tear.style.background = 'radial-gradient(circle, transparent 0%, transparent 28%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0) 78%)'
    tear.style.clipPath = jaggedClipPath()
    tear.style.opacity = '0'
    tear.style.transform = 'scale(0.6)'
    tear.style.transition = 'opacity 180ms ease-out, transform 450ms ease-out'
    document.body.appendChild(tear)
    requestAnimationFrame(() => {
      tear.style.opacity = '1'
      tear.style.transform = 'scale(1)'
    })
    setTimeout(() => {
      tear.style.transition = 'opacity 300ms ease-out'
      tear.style.opacity = '0'
    }, 200)
    setTimeout(() => tear.remove(), 550)
  }

  // A lingering ash-grey mark left where something got destroyed -- gives
  // the page a "fought over" look instead of the spot looking untouched.
  const leaveRubble = (x: number, y: number, big: boolean) => {
    const rubble = document.createElement('div')
    rubble.setAttribute('data-destroy-ui', '')
    const size = big ? 56 : 30
    rubble.style.position = 'fixed'
    rubble.style.left = `${x - size / 2}px`
    rubble.style.top = `${y - size / 4}px`
    rubble.style.width = `${size}px`
    rubble.style.height = `${size / 2}px`
    rubble.style.zIndex = '150'
    rubble.style.pointerEvents = 'none'
    rubble.style.borderRadius = '45%'
    rubble.style.background = 'repeating-conic-gradient(rgba(100,100,100,0.35) 0% 25%, rgba(200,200,200,0.18) 0% 50%)'
    rubble.style.transition = 'opacity 2.5s ease-out'
    document.body.appendChild(rubble)
    requestAnimationFrame(() => {
      rubble.style.opacity = '0'
    })
    setTimeout(() => rubble.remove(), 3000)
  }

  // The Kenney particle pack ships pale white/grey alpha shapes meant to be
  // tinted by whatever renders them -- used directly as <img> they're
  // nearly invisible against the real (mostly light-colored) page content
  // behind them, which is why none of the burn/smoke/flame effects below
  // were actually visible. This renders the shape as a CSS mask on a
  // colored div instead: the PNG supplies the silhouette, a real gradient
  // supplies the color, so every effect reads clearly regardless of what's
  // behind it.
  const spawnMaskedFx = (
    parent: HTMLElement,
    x: number,
    y: number,
    size: number,
    src: string,
    background: string,
    durationMs: number,
    opts: {
      zIndex?: number
      rotate?: boolean
      rise?: number
      growTo?: number
      opacity?: number
      blur?: number
      persist?: boolean
    } = {}
  ) => {
    const el = document.createElement('div')
    const positioned = parent === document.body ? 'fixed' : 'absolute'
    el.style.position = positioned
    el.style.left = `${x - size / 2}px`
    el.style.top = `${y - size / 2}px`
    el.style.width = `${size}px`
    el.style.height = `${size}px`
    el.style.zIndex = String(opts.zIndex ?? 199)
    el.style.pointerEvents = 'none'
    el.style.background = background
    el.style.setProperty('mask-image', `url(${src})`)
    el.style.setProperty('-webkit-mask-image', `url(${src})`)
    el.style.setProperty('mask-size', 'contain')
    el.style.setProperty('-webkit-mask-size', 'contain')
    el.style.setProperty('mask-repeat', 'no-repeat')
    el.style.setProperty('-webkit-mask-repeat', 'no-repeat')
    el.style.setProperty('mask-position', 'center')
    el.style.setProperty('-webkit-mask-position', 'center')
    el.style.opacity = String(opts.opacity ?? 0.95)
    if (opts.blur) el.style.filter = `blur(${opts.blur}px)`
    const baseTransform = opts.rotate ? `rotate(${Math.floor(Math.random() * 360)}deg)` : ''
    el.style.transform = baseTransform
    parent.appendChild(el)

    // persist=true (the hole decal) stays put permanently -- everything
    // else fades out and removes itself after durationMs.
    if (opts.persist) return el

    el.style.transition = `opacity ${durationMs}ms ease-out, transform ${durationMs}ms ease-out`
    requestAnimationFrame(() => {
      el.style.opacity = '0'
      const rise = opts.rise ? `translateY(-${opts.rise}px) ` : ''
      const grow = opts.growTo ? `scale(${opts.growTo})` : ''
      el.style.transform = `${baseTransform} ${rise}${grow}`.trim()
    })
    setTimeout(() => el.remove(), durationMs + 80)
    return el
  }

  // Real animated sprite sheets (CC0, Luis Zuno / ansimuz -- public domain,
  // commercial use explicitly fine, see public/games/fx/anim/LICENSE-*)
  // instead of CSS-gradient-masked single frames. Plays frameCount frames
  // of frameW x frameH each, scaled to displaySize, once through, then
  // removes itself -- same step-through-background-position technique as
  // FlyerSprite in LastStandGame, just imperative instead of a React
  // component since these are fired from inside event handlers, not JSX.
  const spawnSpriteAnim = (
    x: number,
    y: number,
    src: string,
    frameW: number,
    frameH: number,
    frameCount: number,
    displaySize: number,
    fps: number,
    zIndex = 199
  ) => {
    const el = document.createElement('div')
    el.style.position = 'fixed'
    el.style.left = `${x - displaySize / 2}px`
    el.style.top = `${y - displaySize / 2}px`
    el.style.width = `${displaySize}px`
    el.style.height = `${displaySize}px`
    el.style.zIndex = String(zIndex)
    el.style.pointerEvents = 'none'
    el.style.backgroundImage = `url(${src})`
    el.style.backgroundRepeat = 'no-repeat'
    const scale = displaySize / frameH
    el.style.backgroundSize = `${frameW * frameCount * scale}px ${frameH * scale}px`
    el.style.setProperty('image-rendering', 'pixelated')
    document.body.appendChild(el)

    let frame = 0
    const interval = setInterval(() => {
      frame++
      if (frame >= frameCount) {
        clearInterval(interval)
        el.remove()
        return
      }
      el.style.backgroundPosition = `-${(frame * frameW * scale).toFixed(1)}px 0`
    }, 1000 / fps)
  }

  // Every BG_STYLES reveal background is dark (near-black void/grid, dark
  // navy brand stripes, mid-grey static) -- a near-black "charred" scorch
  // mark was invisible against all of them by definition (confirmed via
  // direct DOM inspection: the mark WAS rendering, correctly sized and
  // positioned, just the same near-black color as what's behind it). A
  // warm ember glow reads as "burnt" just as well and actually contrasts
  // against every reveal style.
  const SCORCH_COLOR = 'radial-gradient(circle, rgba(255,214,140,0.95) 0%, rgba(249,115,22,0.85) 35%, rgba(154,52,18,0.55) 60%, rgba(154,52,18,0) 80%)'
  // Lightened from a dark grey -- the site's own theme is mostly dark/black
  // (confirmed: the hero section alone is a near-black gradient), so dark
  // smoke had the exact same invisible-on-dark problem as the scorch mark.
  // This lighter slate tone has enough luminosity to read on both the
  // dark sections and the lighter product-card sections.

  // Per-weapon burn-through tuning: how big the flicker plays relative to
  // the hole, how long it lingers, and how far the char halo (a dim,
  // slow-fading ember ring left after the flicker itself is gone --
  // distinct from the permanent SCORCH_COLOR decal) spreads beyond the
  // hole's own edge. Modeled on the reference site's cellular burn system
  // (their fire spreads through neighboring grid cells, with "energy"
  // that varies by material/weapon) -- reimplemented here as a size/
  // duration/spread profile per weapon since we don't have their grid,
  // just DOM elements.
  const BURN_PROFILE: Record<Weapon, { flicker: number; durationMs: number; haloSpread: number; haloMs: number }> = {
    pistol: { flicker: 1, durationMs: 260, haloSpread: 0.25, haloMs: 650 },
    drone: { flicker: 0.9, durationMs: 220, haloSpread: 0.2, haloMs: 550 },
    shotgun: { flicker: 0.85, durationMs: 230, haloSpread: 0.25, haloMs: 600 },
    laser: { flicker: 1, durationMs: 300, haloSpread: 0.3, haloMs: 750 },
    railgun: { flicker: 1.3, durationMs: 430, haloSpread: 0.45, haloMs: 1100 },
    flamethrower: { flicker: 1.5, durationMs: 500, haloSpread: 0.6, haloMs: 1400 },
    rocket: { flicker: 1.8, durationMs: 520, haloSpread: 0.7, haloMs: 1500 }
  }

  // The flicker itself -- a short-lived flame-colored flash that plays
  // right as a hole appears, cycling white-hot -> yellow -> orange -> red
  // via the burnThrough keyframe (globals.css) instead of just popping
  // the hole into existence. Reuses the same jagged scorch mask images as
  // the permanent decal so the flame shape matches the burn mark it
  // leaves behind. A second, larger, much dimmer "halo" layer (no mask --
  // a soft radial gradient) lingers after the flicker fades, like heat
  // still radiating from the hole's edge.
  const spawnBurnThrough = (parent: HTMLElement, x: number, y: number, holeSize: number, big: boolean) => {
    const profile = BURN_PROFILE[weaponRef.current]
    const flickerSize = holeSize * (0.9 + profile.flicker * 0.35) * (big ? 1.15 : 1)
    const flicker = document.createElement('div')
    flicker.style.position = parent === document.body ? 'fixed' : 'absolute'
    flicker.style.left = `${x - flickerSize / 2}px`
    flicker.style.top = `${y - flickerSize / 2}px`
    flicker.style.width = `${flickerSize}px`
    flicker.style.height = `${flickerSize}px`
    flicker.style.zIndex = '201'
    flicker.style.pointerEvents = 'none'
    flicker.style.background =
      'radial-gradient(circle, #fff7d6 0%, #ffe27a 18%, #ffb020 38%, #ff5a1f 58%, #b3220a 78%, rgba(120,20,10,0) 92%)'
    flicker.style.setProperty('mask-image', `url(${SCORCH_IMAGES[Math.floor(Math.random() * SCORCH_IMAGES.length)]})`)
    flicker.style.setProperty('-webkit-mask-image', flicker.style.getPropertyValue('mask-image'))
    flicker.style.setProperty('mask-size', 'contain')
    flicker.style.setProperty('-webkit-mask-size', 'contain')
    flicker.style.setProperty('mask-repeat', 'no-repeat')
    flicker.style.setProperty('-webkit-mask-repeat', 'no-repeat')
    flicker.style.setProperty('mask-position', 'center')
    flicker.style.setProperty('-webkit-mask-position', 'center')
    flicker.style.animation = `burnThrough ${profile.durationMs}ms ease-out forwards`
    parent.appendChild(flicker)
    setTimeout(() => flicker.remove(), profile.durationMs + 60)

    // Dim lingering heat halo -- no mask (soft circle reads better at low
    // opacity than a sharp jagged edge would), grows slightly past the
    // hole and fades out slowly after the flicker itself is already gone.
    const haloSize = holeSize * (1 + profile.haloSpread)
    const halo = document.createElement('div')
    halo.style.position = flicker.style.position
    halo.style.left = `${x - haloSize / 2}px`
    halo.style.top = `${y - haloSize / 2}px`
    halo.style.width = `${haloSize}px`
    halo.style.height = `${haloSize}px`
    halo.style.zIndex = '149'
    halo.style.pointerEvents = 'none'
    halo.style.borderRadius = '9999px'
    halo.style.background = 'radial-gradient(circle, rgba(255,120,40,0.35) 0%, rgba(180,40,10,0.18) 55%, rgba(180,40,10,0) 80%)'
    halo.style.opacity = '1'
    halo.style.transition = `opacity ${profile.haloMs}ms ease-out`
    parent.appendChild(halo)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        halo.style.opacity = '0'
      })
    })
    setTimeout(() => halo.remove(), profile.haloMs + 80)
  }

  // Leaves an actual "shot through" hole where the element used to be --
  // a real scorch decal burned into whichever background pattern got
  // revealed, not just a flat clipped gradient. "Random" mode (the
  // default) rolls a different pattern for every single hole so the page
  // doesn't end up uniform. Positioned relative to the document (not the
  // viewport) so it stays put under the element it replaced even after
  // the page scrolls.
  const revealHole = (rect: DOMRect, big: boolean) => {
    const w = Math.max(rect.width, 6)
    const h = Math.max(rect.height, 6)
    const left = rect.left + window.scrollX
    const top = rect.top + window.scrollY

    const hole = document.createElement('div')
    hole.setAttribute('data-destroy-ui', '')
    hole.style.position = 'absolute'
    hole.style.left = `${left}px`
    hole.style.top = `${top}px`
    hole.style.width = `${w}px`
    hole.style.height = `${h}px`
    if (bgStyleRef.current === 'image') {
      // Every hole this session is a window into the SAME hidden image,
      // mapped 1:1 across the page's locked-in dimensions -- each one
      // just offsets background-position to its own page coordinates, so
      // enough holes line up into one coherent picture rather than each
      // showing an independent random crop.
      const size = pageRevealSizeRef.current ?? { w: window.innerWidth, h: document.documentElement.scrollHeight }
      hole.style.backgroundImage = `url(${revealBg.src})`
      hole.style.backgroundSize = `${size.w}px ${size.h}px`
      hole.style.backgroundPosition = `-${left}px -${top}px`
      hole.style.backgroundRepeat = 'no-repeat'
    } else {
      const styleKey =
        bgStyleRef.current === 'random' ? BG_STYLE_KEYS[Math.floor(Math.random() * BG_STYLE_KEYS.length)] : bgStyleRef.current
      hole.style.background = BG_STYLES[styleKey].css
    }
    hole.style.clipPath = jaggedClipPath()
    hole.style.pointerEvents = 'none'
    hole.style.overflow = 'hidden'
    document.body.appendChild(hole)

    spawnBurnThrough(document.body, rect.left + w / 2, rect.top + h / 2, Math.max(w, h), big)

    holesRef.current.push({ left, top, width: w, height: h })

    const scorchSize = Math.max(w, h) * (big ? 1.6 : 1.2)
    spawnMaskedFx(hole, w / 2, h / 2, scorchSize, SCORCH_IMAGES[Math.floor(Math.random() * SCORCH_IMAGES.length)], SCORCH_COLOR, 0, {
      rotate: true,
      opacity: big ? 0.95 : 0.85,
      persist: true
    })
  }

  // Brief flash at the gun when a weapon fires -- real 8-frame animated
  // burst (CC0, public domain) instead of a single masked/scaled frame, so
  // it actually plays like a flash igniting and fading rather than one
  // shape growing and fading.
  const spawnMuzzleFlash = (x: number, y: number, w: Weapon) => {
    const size = w === 'rocket' || w === 'flamethrower' ? 62 : w === 'shotgun' || w === 'railgun' ? 52 : 40
    spawnSpriteAnim(x, y, '/games/fx/anim/muzzle-burst.png', 32, 32, 8, size, 55)
  }

  // Real animated fire-into-smoke sequence (CC0, public domain) for
  // explosive impacts (grenade/rocket) -- one cohesive 8-frame animation
  // that actually plays bright flame burning down into billowing smoke,
  // replacing the old two-separate-masked-blobs approach.
  const spawnExplosionFx = (x: number, y: number, big: boolean) => {
    const size = big ? 210 : 130
    spawnSpriteAnim(x, y, '/games/fx/anim/explosion-fire-smoke.png', 64, 64, 8, size, 16)
  }

  // Real animated debris-burst (CC0, public domain) at the impact point --
  // a proper multi-frame "flash into scattering char fragments" sequence
  // instead of procedurally-animated colored squares. Plays fast (snappy,
  // reads instantly on impact) alongside the existing colored particle
  // dots from spawnParticles for a layered look.
  const spawnHitFx = (x: number, y: number, big: boolean) => {
    const size = big ? 80 : 50
    spawnSpriteAnim(x, y, '/games/fx/anim/hit-debris-burst.png', 48, 48, 8, size, 50)
  }

  // `remote` is true when this call came from another player's "destroy"
  // Cuts a destroyed element into real rigid-body debris -- a genuine
  // Voronoi fracture (voronoiCells) rather than one tumbling clipped
  // blob, each piece its own simulated body (mass from its true polygon
  // area, an outward+upward impulse scaled by distance from the impact
  // point, real gravity/bounce/friction integrated in the main loop
  // below). Images get a real per-fragment crop of the source image via
  // a background-position offset (same trick CSS sprite sheets use);
  // anything else gets a flat fill sampled from its own computed color.
  const shatterElement = (target: HTMLElement, rect: DOMRect, impactX: number, impactY: number, big: boolean) => {
    const w = rect.width
    const h = rect.height
    if (w < 4 || h < 4) return
    const count = Math.max(3, Math.min(10, Math.round((w * h) / 1800)))
    const cells = voronoiCells(w, h, count)
    const cs = getComputedStyle(target)
    const isImg = target.tagName === 'IMG'
    const imgSrc = isImg ? (target as HTMLImageElement).src : null
    const fillColor =
      cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)'
        ? cs.backgroundColor
        : cs.color && cs.color !== 'rgba(0, 0, 0, 0)'
          ? cs.color
          : '#8a8a8a'
    const now = performance.now()
    for (const poly of cells) {
      const { area, cx, cy } = polyAreaCentroid(poly)
      if (area < 20) continue
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (const [px, py] of poly) {
        minX = Math.min(minX, px)
        minY = Math.min(minY, py)
        maxX = Math.max(maxX, px)
        maxY = Math.max(maxY, py)
      }
      const fw = Math.max(2, maxX - minX)
      const fh = Math.max(2, maxY - minY)
      const clipPath = `polygon(${poly.map(([px, py]) => `${(((px - minX) / fw) * 100).toFixed(1)}% ${(((py - minY) / fh) * 100).toFixed(1)}%`).join(',')})`
      const worldX = rect.left + minX + fw / 2
      const worldY = rect.top + minY + fh / 2
      const dist = Math.hypot(worldX - impactX, worldY - impactY) + 1
      const impulse = ((big ? 11 : 6) / Math.sqrt(dist)) * (0.6 + Math.random() * 0.8)
      const burstAngle = Math.atan2(worldY - impactY, worldX - impactX) + (Math.random() - 0.5) * 0.6
      fragmentsRef.current.push({
        id: nextFragmentId.current++,
        x: worldX,
        y: worldY,
        vx: Math.cos(burstAngle) * impulse * 16 + (Math.random() - 0.5) * 2.5,
        vy: Math.sin(burstAngle) * impulse * 16 - (big ? 7 : 3.5) - Math.random() * 4,
        angle: 0,
        av: (Math.random() - 0.5) * 0.3,
        w: fw,
        h: fh,
        clipPath,
        bg: isImg && imgSrc ? `url(${imgSrc})` : fillColor,
        bgSize: isImg ? `${w}px ${h}px` : undefined,
        bgPos: isImg ? `-${minX}px -${minY}px` : undefined,
        mass: area,
        settled: false,
        born: now
      })
    }
    if (fragmentsRef.current.length > FRAG_MAX_LIVE) {
      fragmentsRef.current.splice(0, fragmentsRef.current.length - FRAG_MAX_LIVE)
    }
  }

  // broadcast rather than this client's own shot -- keeps it from
  // re-broadcasting what it just received back out to the room.
  // Returns whether this call actually destroyed something new -- false
  // means target was already gone (someone else got there first), which
  // callers use to tell a real miss (nothing there to hit) apart from a
  // no-op re-hit (something was there, just already destroyed).
  const destroyOne = (target: HTMLElement, x: number, y: number, big: boolean, remote = false): boolean => {
    if (destroyedSetRef.current.has(target)) return false
    destroyedSetRef.current.add(target)
    const rect = target.getBoundingClientRect()
    spawnParticles(x, y, big ? 44 : 26)
    spawnHitFx(x, y, big)
    setDestroyedCount(destroyedSetRef.current.size)
    if (!victoryTriggeredRef.current && destroyedSetRef.current.size >= totalCountRef.current) {
      victoryTriggeredRef.current = true
      setVictoryShown(true)
      // Fully destroying the page while in image-reveal mode means its
      // hidden background is now completely uncovered -- unlock it into
      // this visitor's permanent collection. Flat-pattern modes (void/
      // grid/etc) don't have a hidden image, so nothing to unlock there.
      if (bgStyleRef.current === 'image' && !bgUnlockedRef.current && visitorIdRef.current) {
        bgUnlockedRef.current = true
        fetch('/api/backgrounds/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId: visitorIdRef.current, backgroundId: revealBg.id })
        })
          .then(() => {
            setBgUnlocked(true)
            onBackgroundUnlocked?.(revealBg.id)
          })
          .catch(() => {})
      }
    }
    leaveRubble(x, y, big)

    if (!remote && roomRef.current) {
      const index = elementIndexRef.current.get(target)
      if (index !== undefined) {
        roomRef.current.publish('destroy', { index, x, y, big })
      }
    }

    const isTextNode =
      ['P', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'A', 'BUTTON'].includes(target.tagName) &&
      target.children.length === 0 &&
      (target.textContent || '').trim().length > 0

    if (isTextNode) {
      // Builds the letter-scatter as our OWN overlay elements appended to
      // document.body -- never touching target's real children. Earlier
      // this did target.textContent = '' and injected <span>s directly
      // into the React-owned node; the instant React re-rendered that
      // component for any unrelated reason (cart update, a scroll
      // animation, anything), it found children it didn't put there,
      // threw a DOM mismatch error, and with nothing catching it, React
      // unmounted the whole app -- a white screen. The real element now
      // only ever gets style mutations, same as every other destroyed
      // element, which React tolerates fine.
      const text = target.textContent || ''
      const cs = getComputedStyle(target)
      const overlay = document.createElement('div')
      overlay.setAttribute('data-destroy-ui', '')
      overlay.style.position = 'absolute'
      overlay.style.left = `${rect.left + window.scrollX}px`
      overlay.style.top = `${rect.top + window.scrollY}px`
      overlay.style.font = cs.font
      overlay.style.color = TEXT_COLORS[textColorRef.current].css || cs.color
      overlay.style.pointerEvents = 'none'
      overlay.style.zIndex = '150'
      overlay.style.whiteSpace = 'pre'
      document.body.appendChild(overlay)

      const spans: HTMLSpanElement[] = []
      for (const ch of text) {
        const span = document.createElement('span')
        span.textContent = ch
        span.style.display = 'inline-block'
        const dur = 900 + Math.random() * 700
        span.style.transition = `transform ${dur}ms ease-out, opacity ${dur + 300}ms ease-out`
        overlay.appendChild(span)
        spans.push(span)
      }
      requestAnimationFrame(() => {
        spans.forEach((span) => {
          const dx = (Math.random() - 0.5) * 70
          const dy = 25 + Math.random() * 55
          const rot = (Math.random() - 0.5) * 200
          span.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`
          span.style.opacity = '0'
        })
      })

      target.style.transition = 'opacity 150ms ease-out'
      target.style.opacity = '0'
      setTimeout(() => {
        target.style.display = 'none'
        revealHole(rect, big)
      }, 200)
      setTimeout(() => overlay.remove(), 1900)
      return true
    }

    shatterElement(target, rect, x, y, big)
    target.style.opacity = '0'
    target.style.display = 'none'
    revealHole(rect, big)
    return true
  }

  // Blast radius for grenades and a single pellet's landing spot -- sample
  // random points within the radius and collect whatever real elements are
  // actually there, rather than needing real geometric hit-testing against
  // every element's bounding box.
  //
  // elementFromPoint returns whatever DOM node is literally under that
  // pixel -- which, over empty space inside a layout wrapper, is often a
  // big structural <div> (nav wrapper, section container, even the page's
  // React root) rather than real content. Hiding one of THOSE blanks out
  // a huge chunk of the page or the entire app -- the actual cause of the
  // reported white screen. .closest(DESTROYABLE_SELECTOR) walks back up
  // to the nearest real content element (or finds nothing, i.e. a clean
  // miss) instead of ever destroying a container.
  const destroyRadius = (cx: number, cy: number, radius: number, big: boolean): boolean => {
    const found = new Set<HTMLElement>()
    const samples = big ? 16 : 6
    for (let i = 0; i < samples; i++) {
      const ang = Math.random() * Math.PI * 2
      const dist = Math.random() * radius
      const raw = document.elementFromPoint(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist) as HTMLElement | null
      const el = raw?.closest(DESTROYABLE_SELECTOR) as HTMLElement | null
      if (el && !el.closest('[data-destroy-ui]')) found.add(el)
    }
    let anyNew = false
    found.forEach((el) => {
      if (destroyOne(el, cx + (Math.random() - 0.5) * radius, cy + (Math.random() - 0.5) * radius, big)) anyNew = true
    })
    return anyNew
  }

  // Every shot should register SOMETHING at its impact point, not just
  // whiffs that fire nothing happened -- unless there genuinely was
  // nothing there (empty background, no destroyable element in range).
  // Cheap on purpose (a few small square pixels, no sprite animation) so
  // spamming shots at empty space never gets expensive.
  const spawnMissSpark = (x: number, y: number) => {
    for (let i = 0; i < 6; i++) {
      const px = document.createElement('div')
      const size = 3 + Math.floor(Math.random() * 2)
      px.style.position = 'fixed'
      px.style.left = `${x - size / 2}px`
      px.style.top = `${y - size / 2}px`
      px.style.width = `${size}px`
      px.style.height = `${size}px`
      px.style.zIndex = '199'
      px.style.pointerEvents = 'none'
      px.style.background = '#e2e8f0'
      px.style.opacity = '0.8'
      document.body.appendChild(px)
      const ang = Math.random() * Math.PI * 2
      const dist = 6 + Math.random() * 8
      const dur = 100 + Math.random() * 60
      px.style.transition = `transform ${dur}ms ease-out, opacity ${dur}ms ease-out`
      requestAnimationFrame(() => {
        px.style.transform = `translate(${(Math.cos(ang) * dist).toFixed(0)}px, ${(Math.sin(ang) * dist).toFixed(0)}px)`
        px.style.opacity = '0'
      })
      setTimeout(() => px.remove(), dur + 60)
    }
  }

  // Liang-Barsky line-clipping test -- true if the segment (x1,y1)-(x2,y2)
  // crosses the axis-aligned box at all (not just its corners), which is
  // what lets the Railgun reliably pierce every real element stacked along
  // its path instead of depending on where sample points happened to land.
  const segmentIntersectsRect = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    left: number,
    top: number,
    right: number,
    bottom: number
  ) => {
    let t0 = 0
    let t1 = 1
    const dx = x2 - x1
    const dy = y2 - y1
    const checks: [number, number][] = [
      [-dx, x1 - left],
      [dx, right - x1],
      [-dy, y1 - top],
      [dy, bottom - y1]
    ]
    for (const [p, q] of checks) {
      if (p === 0) {
        if (q < 0) return false
      } else {
        const r = q / p
        if (p < 0) {
          if (r > t1) return false
          if (r > t0) t0 = r
        } else {
          if (r < t0) return false
          if (r < t1) t1 = r
        }
      }
    }
    return true
  }

  // Shortest distance from a point to a line segment -- used to check
  // whether a remote player's position falls along the Railgun's beam
  // path, not just near one endpoint of it.
  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const lenSq = dx * dx + dy * dy
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
    const cx = x1 + t * dx
    const cy = y1 + t * dy
    return Math.hypot(px - cx, py - cy)
  }

  // PvP-only: whoever's chest point (their position, roughly shoulder
  // height) falls within radius of an impact takes damage. Hide & Seek
  // reuses the exact same radius-based check, just resolving to "found"
  // instead of damage -- same geometry, different consequence. No-op in
  // co-op, so that mode is completely unaffected either way.
  const checkPvpHit = (x: number, y: number, radius: number, damage: number) => {
    if (!roomRef.current) return
    if (roomModeRef.current === 'pvp') {
      for (const [id, rp] of Object.entries(remotePlayersRef.current)) {
        if (rp.dead) continue
        if (Math.hypot(rp.x - x, rp.y - 28 - y) <= radius) {
          roomRef.current.publish('hit', { targetClientId: id, damage })
        }
      }
    } else if (roomModeRef.current === 'hideseek') {
      for (const [id, rp] of Object.entries(remotePlayersRef.current)) {
        if (rp.role !== 'hider' || !rp.hidden) continue
        if (Math.hypot(rp.x - x, rp.y - 28 - y) <= radius) {
          reportHideSeekFound(id)
        }
      }
    }
  }

  // Seeker-only: the client that actually lands the shot is the one that
  // decides a hider is found and broadcasts it (and, once every hider is
  // found, that the round itself is over) -- single source of truth, no
  // other client ever writes to hsFoundRef for someone else's find.
  const reportHideSeekFound = (id: string) => {
    if (hsRoleRef.current !== 'seeker' || hsPhaseRef.current !== 'hunting') return
    if (hsFoundRef.current.has(id)) return
    hsFoundRef.current.add(id)
    roomRef.current?.publish('found', { clientId: id })
    setHsHidersRemaining(Math.max(0, hsHiderIdsRef.current.size - hsFoundRef.current.size))
    sfx.bossDeath()
    if (hsHiderIdsRef.current.size > 0 && hsFoundRef.current.size >= hsHiderIdsRef.current.size && !hsRoundEndedRef.current) {
      hsRoundEndedRef.current = true
      roomRef.current?.publish('roundEnd', { winner: 'seekers' })
      hsPhaseRef.current = 'ended'
      setHsPhase('ended')
      setHsWinner('seekers')
    }
  }

  // Anyone can start a round once there's at least one other player in the
  // room -- whoever clicks becomes Seeker for that round, everyone else
  // present right now becomes a Hider. Clicking "Play Again" later reuses
  // this same function, so a different person clicking next time rotates
  // who's It without needing any explicit rotation bookkeeping.
  const startHideSeekRound = () => {
    if (!roomRef.current) return
    const hiderIds = Object.keys(remotePlayersRef.current)
    if (hiderIds.length === 0) return
    roomRef.current.publish('roundStart', {
      startedAt: Date.now(),
      hidingMs: HS_HIDING_MS,
      huntingMs: HS_HUNTING_MS,
      seekerId: clientIdRef.current,
      hiderIds
    })
  }

  // Hider-only: click any real, not-yet-destroyed page element to start
  // "becoming" it. Not instant -- there's a brief travel window (visible,
  // per the user's choice of the more dynamic re-disguise design) before
  // you're actually hidden again, and a cooldown before you can do it a
  // second time.
  const disguiseAt = (cx: number, cy: number, rawTarget: HTMLElement | null) => {
    if (deadRef.current || hsFoundSelfRef.current) return
    if (hsRedisguiseTravelRef.current) return
    if (performance.now() < hsRedisguiseCooldownUntilRef.current) return
    const target = (rawTarget?.closest(DESTROYABLE_SELECTOR) ??
      (document.elementFromPoint(cx, cy) as HTMLElement | null)?.closest(DESTROYABLE_SELECTOR)) as HTMLElement | null
    if (!target || target.closest('[data-destroy-ui]') || destroyedSetRef.current.has(target)) {
      spawnMissSpark(cx, cy)
      return
    }
    const r = target.getBoundingClientRect()
    hsHiddenRef.current = false
    setHsHidden(false)
    hsRedisguiseTravelRef.current = {
      startX: playerRef.current.x,
      startY: playerRef.current.y,
      targetX: r.left + r.width / 2,
      targetY: r.top + r.height / 2 + 28,
      startTime: performance.now()
    }
  }

  // Main simulation loop -- player movement, particle physics, and
  // projectile/grenade travel all live here so they animate on the same
  // clock and projectiles can trigger real destruction the instant they land.
  useEffect(() => {
    const loop = () => {
      // Everything below runs inside a try/catch for one reason: this
      // function re-schedules ITSELF via requestAnimationFrame. An
      // uncaught exception ANYWHERE in this loop -- not necessarily in
      // anything PvP/Railgun related, could be any future bug -- used to
      // mean the loop just silently stopped rescheduling, freezing
      // literally everything driven by it (movement, drone, damage,
      // even the old in-loop respawn failsafe that was supposed to catch
      // exactly this) forever, with no error visible unless devtools
      // happened to be open. Now a thrown error gets logged and the loop
      // keeps running on the next frame instead of dying.
      try {
        tick()
      } catch (err) {
        console.error('[DestroyModeOverlay] main loop error (frame skipped, loop continues):', err)
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    const tick = () => {
      const keys = keysRef.current
      const groundY = window.innerHeight - GROUND_MARGIN
      const p = playerRef.current
      const now = performance.now()
      const grapple = grappleRef.current

      let nx = p.x
      let ny = p.y
      let vy = p.vy
      let onGround = p.onGround
      const wasOnGround = onGround

      if (pilotingDroneRef.current) {
        // The stickman is frozen -- skip all of its movement/grapple/fly
        // physics entirely and drive the drone instead, further down.
      } else if (isHideSeekSeekerWaiting()) {
        // Seeker is fully frozen during the Hiding head-start phase.
      } else if (hsRedisguiseTravelRef.current) {
        // Hider mid-shuffle to a new disguise -- a brief forced traversal,
        // visibly exposed, same eased-interpolation pattern as the grapple
        // pull just below. WASD input is ignored until it lands.
        const rt = hsRedisguiseTravelRef.current
        const t = Math.min(1, (now - rt.startTime) / HS_REDISGUISE_TRAVEL_MS)
        const eased = 1 - Math.pow(1 - t, 2)
        nx = rt.startX + (rt.targetX - rt.startX) * eased
        ny = rt.startY + (rt.targetY - rt.startY) * eased
        vy = 0
        onGround = true
        if (t >= 1) {
          hsRedisguiseTravelRef.current = null
          hsHiddenRef.current = true
          setHsHidden(true)
          hsRedisguiseCooldownUntilRef.current = now + HS_REDISGUISE_COOLDOWN_MS
        }
      } else if (roomModeRef.current === 'hideseek' && hsRoleRef.current === 'hider' && hsHiddenRef.current) {
        // Locked into the disguise -- without this, falling through to the
        // normal movement/gravity branch below would immediately start
        // pulling a hider standing mid-air (e.g. disguised as a logo near
        // the top of the page) straight down toward the ground, silently
        // dragging their broadcast position away from the element they
        // claim to be while the UI still says "Hidden."
      } else if (slideRef.current) {
        // Ground-only speed burst in whatever direction was facing when it
        // triggered -- locked to the ground (ignores gravity/jump input)
        // for the slide's short duration, same eased-interpolation style
        // as grapple/redisguise above but over flat ground, not a pulled
        // point.
        const s = slideRef.current
        const t = Math.min(1, (now - s.startTime) / SLIDE_DURATION)
        const eased = 1 - Math.pow(1 - t, 3)
        nx = Math.min(Math.max(p.x + s.dirX * SLIDE_SPEED * (1 - eased * 0.3), 24), window.innerWidth - 24)
        ny = p.y
        vy = 0
        onGround = true
        setPose('slide')
        if (t >= 1) {
          slideRef.current = null
        }
      } else if (grapple) {
        // Pulls the character straight toward wherever they aimed when they
        // fired -- a quick traversal yank rather than true rope physics.
        const t = Math.min(1, (now - grapple.startTime) / grapple.duration)
        const eased = 1 - Math.pow(1 - t, 2)
        nx = grapple.startX + (grapple.targetX - grapple.startX) * eased
        ny = grapple.startY + (grapple.targetY - grapple.startY) * eased + 28
        vy = 0
        onGround = false
        setGrappleLine({ x: grapple.targetX, y: grapple.targetY })
        if (t >= 1) {
          grappleRef.current = null
          grappleCooldownRef.current = now + 250
          setGrappleLine(null)
          spawnParticles(grapple.targetX, grapple.targetY, 8)
        }
      } else {
        setGrappleLine(null)
        const jv = joystickVecRef.current
        let dx = jv.x
        if (keys.has('a') || keys.has('arrowleft')) dx -= 1
        if (keys.has('d') || keys.has('arrowright')) dx += 1
        dx = Math.max(-1, Math.min(1, dx))

        if (flyingRef.current) {
          let dy = jv.y
          if (keys.has('w') || keys.has('arrowup')) dy -= 1
          if (keys.has('s') || keys.has('arrowdown')) dy += 1
          dy = Math.max(-1, Math.min(1, dy))
          nx = Math.min(Math.max(p.x + dx * FLY_SPEED, 24), window.innerWidth - 24)
          ny = Math.min(Math.max(p.y + dy * FLY_SPEED, 40), window.innerHeight - 24)
          vy = 0
          onGround = false
          wingPhaseRef.current += 0.4
          setWingPhase(wingPhaseRef.current)
        } else {
          nx = Math.min(Math.max(p.x + dx * PLAYER_SPEED, 24), window.innerWidth - 24)
          const fastFalling = !p.onGround && (keys.has('s') || keys.has('arrowdown') || jv.y > 0.6)
          const gravity = GRAVITY * (fastFalling ? FAST_FALL_MULT : 1)
          vy = p.vy + gravity
          ny = p.y + vy
          onGround = false

          // Debris platforms -- one-way (land on top falling down, pass
          // straight through jumping up from below), skipped entirely
          // while holding S/down so that key can drop you through one on
          // purpose. Picks the HIGHEST qualifying surface crossed this
          // frame, not just the first found, so landing is never wrong
          // when holes overlap at different heights.
          let landedOnPlatform = false
          if (vy >= 0 && !(keys.has('s') || keys.has('arrowdown'))) {
            const prevFeetY = p.y
            let bestTop = Infinity
            for (const h of holesRef.current) {
              const hLeft = h.left - window.scrollX
              const hTop = h.top - window.scrollY
              const hRight = hLeft + h.width
              if (nx < hLeft || nx > hRight) continue
              if (prevFeetY <= hTop + 2 && ny >= hTop && hTop < bestTop) {
                bestTop = hTop
              }
            }
            if (bestTop < groundY) {
              ny = bestTop
              vy = 0
              onGround = true
              landedOnPlatform = true
            }
          }

          if (!landedOnPlatform && ny >= groundY) {
            ny = groundY
            vy = 0
            onGround = true
          }
        }

        if (onGround && !wasOnGround) {
          spawnDust(nx, groundY + 14)
        }

        if (flyingRef.current) {
          setPose('air')
        } else if (!onGround) {
          setPose('air')
        } else if (dx !== 0) {
          walkPhaseRef.current += 0.35
          setPose('walk')
          setWalkPhase(walkPhaseRef.current)
        } else {
          setPose('idle')
        }
      }

      // Flight stamina -- drains in real time while airborne, regenerates
      // at half that rate the rest of the time, forces a landing the
      // instant it hits empty (same as pressing the fly toggle off).
      if (flyingRef.current) {
        flyFuelRef.current = Math.max(0, flyFuelRef.current - FLY_DRAIN_PER_FRAME)
        if (flyFuelRef.current <= 0) {
          flyingRef.current = false
          setFlying(false)
        }
      } else if (flyFuelRef.current < 1) {
        flyFuelRef.current = Math.min(1, flyFuelRef.current + FLY_REGEN_PER_FRAME)
      }
      if (Math.abs(flyFuelRef.current - flyFuelDisplayedRef.current) > 0.01) {
        flyFuelDisplayedRef.current = flyFuelRef.current
        setFlyFuel(flyFuelRef.current)
      }

      // Flight and grapples can carry the character to any part of the real
      // page, not just whatever's in the current viewport -- pan the real
      // page underneath them the way the reference site lets you roam a
      // page taller than one screen.
      if (!pilotingDroneRef.current && (flyingRef.current || grapple)) {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        if (ny < SCROLL_MARGIN && window.scrollY > 0) {
          const shift = Math.min(SCROLL_MARGIN - ny, window.scrollY, SCROLL_SPEED)
          window.scrollBy(0, -shift)
          ny += shift
        } else if (ny > window.innerHeight - SCROLL_MARGIN && window.scrollY < maxScroll) {
          const shift = Math.min(ny - (window.innerHeight - SCROLL_MARGIN), maxScroll - window.scrollY, SCROLL_SPEED)
          window.scrollBy(0, shift)
          ny -= shift
        }
      }

      if (!pilotingDroneRef.current) {
        playerRef.current = { x: nx, y: ny, vy, onGround }
        setPlayer({ x: nx, y: ny })
      }

      // Drone deploy travel -- flies from wherever it was launched to the
      // aimed point over DRONE_TRAVEL_MS, then control hands over
      // automatically the instant it arrives.
      if (droneDeployRef.current) {
        const dd = droneDeployRef.current
        const t = Math.min(1, (now - dd.startTime) / DRONE_TRAVEL_MS)
        const eased = 1 - Math.pow(1 - t, 2)
        const dx2 = dd.startX + (dd.targetX - dd.startX) * eased
        const dy2 = dd.startY + (dd.targetY - dd.startY) * eased
        setDrone({ x: dx2, y: dy2, bob: 0, facingLeft: crosshairRef.current.x < dx2 })
        if (t >= 1) {
          droneRef.current = { x: dd.targetX, y: dd.targetY }
          droneDeployRef.current = null
          pilotingDroneRef.current = true
          setPilotingDrone(true)
        }
      } else if (pilotingDroneRef.current && droneRef.current) {
        // Piloted free-flight -- same WASD/joystick input the stickman's
        // own flight mode uses, just driving the drone's position instead
        // and with no gravity to fight at all.
        const jv = joystickVecRef.current
        let ddx = jv.x
        let ddy = jv.y
        if (keys.has('a') || keys.has('arrowleft')) ddx -= 1
        if (keys.has('d') || keys.has('arrowright')) ddx += 1
        if (keys.has('w') || keys.has('arrowup')) ddy -= 1
        if (keys.has('s') || keys.has('arrowdown')) ddy += 1
        ddx = Math.max(-1, Math.min(1, ddx))
        ddy = Math.max(-1, Math.min(1, ddy))
        const d = droneRef.current
        let dnx = Math.min(Math.max(d.x + ddx * DRONE_SPEED, 16), window.innerWidth - 16)
        let dny = Math.min(Math.max(d.y + ddy * DRONE_SPEED, 16), window.innerHeight - 16)

        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        if (dny < SCROLL_MARGIN && window.scrollY > 0) {
          const shift = Math.min(SCROLL_MARGIN - dny, window.scrollY, SCROLL_SPEED)
          window.scrollBy(0, -shift)
          dny += shift
        } else if (dny > window.innerHeight - SCROLL_MARGIN && window.scrollY < maxScroll) {
          const shift = Math.min(dny - (window.innerHeight - SCROLL_MARGIN), maxScroll - window.scrollY, SCROLL_SPEED)
          window.scrollBy(0, shift)
          dny -= shift
        }

        droneRef.current = { x: dnx, y: dny }
        setDrone({
          x: dnx,
          y: dny,
          bob: Math.sin(now / 220) * 3,
          facingLeft: crosshairRef.current.x < dnx
        })
      } else if (droneRef.current) {
        // Deployed but not currently piloted -- just idles in place with a
        // gentle hover bob.
        const d = droneRef.current
        setDrone((prev) =>
          prev ? { ...prev, bob: Math.sin(now / 400) * 4, facingLeft: crosshairRef.current.x < d.x } : prev
        )
      }

      particlesRef.current = particlesRef.current
        .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.3, life: p.life - 1 }))
        .filter((p) => p.life > 0)
      setParticles([...particlesRef.current])

      // Real rigid-body step for debris fragments -- gravity, then a
      // one-way landing check against both the flat ground and every
      // debris platform (same holesRef data the player climbs on), with
      // restitution/friction on landing and a settle threshold so pieces
      // actually come to rest instead of bouncing forever.
      if (fragmentsRef.current.length > 0) {
        const fGroundY = window.innerHeight - GROUND_MARGIN
        for (const f of fragmentsRef.current) {
          if (f.settled) continue
          const prevFeetY = f.y + f.h / 2
          f.vy += FRAG_GRAVITY
          f.x += f.vx
          f.y += f.vy
          f.angle += f.av
          const feetY = f.y + f.h / 2
          let floor = fGroundY
          for (const h of holesRef.current) {
            const hLeft = h.left - window.scrollX
            const hTop = h.top - window.scrollY
            const hRight = hLeft + h.width
            if (f.x < hLeft || f.x > hRight || hTop >= floor) continue
            if (prevFeetY <= hTop + 2 && feetY >= hTop) floor = hTop
          }
          if (feetY >= floor) {
            f.y = floor - f.h / 2
            f.vy = -f.vy * FRAG_RESTITUTION
            f.vx *= FRAG_FRICTION
            f.av *= FRAG_ANGULAR_FRICTION
            if (Math.abs(f.vy) < FRAG_SETTLE_SPEED && Math.abs(f.vx) < FRAG_SETTLE_SPEED) {
              f.settled = true
              f.vx = 0
              f.vy = 0
            }
          }
        }
        fragmentsRef.current = fragmentsRef.current.filter((f) => now - f.born < FRAG_LIFETIME_MS)
        setFragments([...fragmentsRef.current])
        hadFragmentsRef.current = fragmentsRef.current.length > 0
      } else if (hadFragmentsRef.current) {
        hadFragmentsRef.current = false
        setFragments([])
      }

      const liveProjectiles: Projectile[] = []
      projectileTargets.current.forEach((pt, id) => {
        const t = Math.min(1, (now - pt.startTime) / pt.duration)
        const x = pt.startX + (pt.targetX - pt.startX) * t
        const y = pt.startY + (pt.targetY - pt.startY) * t
        if (t >= 1) {
          projectileTargets.current.delete(id)
          sfx.hit()
          if (pt.element) {
            // destroyOne no-ops silently if the target's already gone
            // (someone beat us to it) -- that's the one case that should
            // stay quiet, per the "unless already destroyed" rule.
            destroyOne(pt.element, pt.targetX, pt.targetY, false)
            checkPvpHit(pt.targetX, pt.targetY, 24, 18)
          } else {
            // Nothing destroyable was even under the cursor -- a genuine
            // miss on empty background. Still needs a visible spark so the
            // shot reads as having actually landed somewhere.
            if (!destroyRadius(pt.targetX, pt.targetY, pt.radius, false)) spawnMissSpark(pt.targetX, pt.targetY)
            checkPvpHit(pt.targetX, pt.targetY, pt.radius, 9)
          }
          flashRef.current = Math.max(flashRef.current, 0.3)
        } else {
          liveProjectiles.push({
            id,
            x,
            y,
            angle: (Math.atan2(pt.targetY - pt.startY, pt.targetX - pt.startX) * 180) / Math.PI,
            kind: pt.radius > 0 ? 'pellet' : 'pistol'
          })
        }
      })
      setProjectiles(liveProjectiles)

      const liveGrenades: Grenade[] = []
      grenadeTargets.current.forEach((gt, id) => {
        const t = Math.min(1, (now - gt.startTime) / gt.duration)
        const x = gt.startX + (gt.targetX - gt.startX) * t
        // Grenades lob in a high arc; rockets fly flat and fast.
        const arc = gt.kind === 'grenade' ? Math.sin(t * Math.PI) * 140 : 0
        const y = gt.startY + (gt.targetY - gt.startY) * t - arc
        if (t >= 1) {
          grenadeTargets.current.delete(id)
          sfx.bossDeath()
          flashRef.current = gt.kind === 'rocket' ? 0.9 : 0.75
          spawnExplosionFx(gt.targetX, gt.targetY, true)
          spawnScreenTear(gt.targetX, gt.targetY)
          destroyRadius(gt.targetX, gt.targetY, gt.kind === 'rocket' ? ROCKET_RADIUS : 170, true)
          checkPvpHit(gt.targetX, gt.targetY, gt.kind === 'rocket' ? ROCKET_RADIUS : 170, gt.kind === 'rocket' ? 55 : 45)
        } else {
          liveGrenades.push({ id, x, y, kind: gt.kind })
        }
      })
      setGrenades(liveGrenades)

      if (flashRef.current > 0.01) {
        flashRef.current *= 0.85
        setFlash(flashRef.current)
      } else if (flashRef.current !== 0) {
        flashRef.current = 0
        setFlash(0)
      }

      // Throttled co-op position broadcast -- every 6th frame is plenty
      // for seeing roughly where the other player is, no need for every
      // frame over the network. Hide & Seek's role/hidden flags piggyback
      // on this exact same broadcast -- no separate network channel needed
      // for "am I currently disguised," it's just two more fields on the
      // position update every other mode already sends.
      mpFrameRef.current++
      if (roomRef.current && mpFrameRef.current % 6 === 0) {
        roomRef.current.publish('move', {
          clientId: clientIdRef.current,
          x: playerRef.current.x,
          y: playerRef.current.y,
          character: characterRef.current,
          facingLeft: crosshairRef.current.x < playerRef.current.x,
          hp: hpRef.current,
          dead: deadRef.current,
          mode: roomModeRef.current,
          role: hsRoleRef.current,
          hidden: hsHiddenRef.current
        })
      }

      // Hide & Seek phase clock -- wall-clock based (see the refs'
      // comment) so every client's countdown agrees regardless of when
      // their own tab happened to load. Only the Seeker's client is
      // authoritative for ending the round (timeout or last hider found),
      // matching reportHideSeekFound being seeker-only above.
      if (roomModeRef.current === 'hideseek' && hsPhaseRef.current !== 'lobby' && hsPhaseRef.current !== 'ended') {
        const wallNow = Date.now()
        if (hsPhaseRef.current === 'hiding' && wallNow >= hsHidingUntilRef.current) {
          hsPhaseRef.current = 'hunting'
          setHsPhase('hunting')
        }
        if (hsPhaseRef.current === 'hunting' && hsRoleRef.current === 'seeker' && !hsRoundEndedRef.current && wallNow >= hsHuntingUntilRef.current) {
          hsRoundEndedRef.current = true
          roomRef.current?.publish('roundEnd', { winner: 'hiders' })
          hsPhaseRef.current = 'ended'
          setHsPhase('ended')
          setHsWinner('hiders')
        }
        const deadline = hsPhaseRef.current === 'hiding' ? hsHidingUntilRef.current : hsHuntingUntilRef.current
        const secsLeft = Math.max(0, Math.ceil((deadline - wallNow) / 1000))
        if (secsLeft !== hsTimeLeftDisplayedRef.current) {
          hsTimeLeftDisplayedRef.current = secsLeft
          setHsTimeLeft(secsLeft)
        }
        const cooldownSecs =
          hsRoleRef.current === 'hider' && !hsRedisguiseTravelRef.current
            ? Math.max(0, Math.ceil((hsRedisguiseCooldownUntilRef.current - now) / 1000))
            : 0
        if (cooldownSecs !== hsCooldownDisplayedRef.current) {
          hsCooldownDisplayedRef.current = cooldownSecs
          setHsCooldownLeft(cooldownSecs)
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Core fire logic, shared by the real click handler and the mobile FIRE
  // button -- a touch tap has no natural "target element" the way a mouse
  // click's e.target does, so this always resolves its own target/hits
  // from (cx, cy) rather than depending on an event object.
  const fireAt = (cx: number, cy: number, rawTarget: HTMLElement | null) => {
    if (deadRef.current || isHideSeekHider() || isHideSeekSeekerWaiting()) return

    // Piloting the drone overrides whatever weapon the stickman had
    // selected -- a quick zap from the drone's own position, resolved the
    // same way the pistol resolves its target (direct element under the
    // aim point, falling back to a tiny-radius check for a near miss).
    if (pilotingDroneRef.current && droneRef.current) {
      const d = droneRef.current
      const zTarget = (rawTarget?.closest(DESTROYABLE_SELECTOR) ??
        (document.elementFromPoint(cx, cy) as HTMLElement | null)?.closest(DESTROYABLE_SELECTOR)) as HTMLElement | null
      setDroneZap({ x1: d.x, y1: d.y, x2: cx, y2: cy })
      setTimeout(() => setDroneZap(null), 140)
      let hit = false
      if (zTarget && !zTarget.closest('[data-destroy-ui]')) {
        hit = destroyOne(zTarget, cx, cy, false)
      } else {
        hit = destroyRadius(cx, cy, 20, false)
      }
      if (!hit) spawnMissSpark(cx, cy)
      checkPvpHit(cx, cy, 24, DRONE_ZAP_DAMAGE)
      sfx.hit()
      flashRef.current = Math.max(flashRef.current, 0.12)
      return
    }

    // Drone isn't a direct-fire weapon -- selecting it and clicking in the
    // world launches/recalls/re-pilots it, same as pressing 5.
    if (weaponRef.current === 'drone') {
      toggleDronePilot()
      return
    }

    // Checked before the muzzle flash fires -- a shot still on cooldown
    // should do nothing at all, not flash with no actual attack behind it.
    if (weaponRef.current === 'railgun' && performance.now() < railgunCooldownRef.current) return
    if (weaponRef.current === 'flamethrower' && performance.now() < flamethrowerCooldownRef.current) return

    const target = (rawTarget?.closest(DESTROYABLE_SELECTOR) ??
      (document.elementFromPoint(cx, cy) as HTMLElement | null)?.closest(DESTROYABLE_SELECTOR)) as HTMLElement | null
    const px = playerRef.current.x
    const py = playerRef.current.y - 28
    const now = performance.now()
    spawnMuzzleFlash(px, py, weaponRef.current)

    if (weaponRef.current === 'shotgun') {
      for (let i = 0; i < 5; i++) {
        const spread = (Math.random() - 0.5) * 70
        const id = nextProjectileId.current++
        projectileTargets.current.set(id, {
          startX: px,
          startY: py,
          targetX: cx + spread,
          targetY: cy + (Math.random() - 0.5) * 70,
          startTime: now,
          duration: 70 + Math.random() * 60,
          element: null,
          radius: 26
        })
      }
    } else if (weaponRef.current === 'laser') {
      // Hitscan -- resolves instantly along the line instead of traveling,
      // so it reads as a beam rather than a bullet.
      setBeam({ x1: px, y1: py, x2: cx, y2: cy })
      setTimeout(() => setBeam(null), 130)
      const found = new Set<HTMLElement>()
      const pvpHitIds = new Set<string>()
      const hsFoundIds = new Set<string>()
      for (let i = 1; i <= LASER_SAMPLES; i++) {
        const t = i / LASER_SAMPLES
        const sx = px + (cx - px) * t
        const sy = py + (cy - py) * t
        const raw = document.elementFromPoint(sx, sy) as HTMLElement | null
        const el = raw?.closest(DESTROYABLE_SELECTOR) as HTMLElement | null
        if (el && !el.closest('[data-destroy-ui]')) found.add(el)
        if (roomModeRef.current === 'pvp') {
          for (const [id, rp] of Object.entries(remotePlayersRef.current)) {
            if (!rp.dead && Math.hypot(rp.x - sx, rp.y - 28 - sy) <= 20) pvpHitIds.add(id)
          }
        } else if (roomModeRef.current === 'hideseek') {
          for (const [id, rp] of Object.entries(remotePlayersRef.current)) {
            if (rp.role === 'hider' && rp.hidden && Math.hypot(rp.x - sx, rp.y - 28 - sy) <= 20) hsFoundIds.add(id)
          }
        }
      }
      found.forEach((el) => destroyOne(el, el.getBoundingClientRect().left, el.getBoundingClientRect().top, false))
      pvpHitIds.forEach((id) => roomRef.current?.publish('hit', { targetClientId: id, damage: 28 }))
      hsFoundIds.forEach((id) => reportHideSeekFound(id))
      if (found.size === 0) spawnMissSpark(cx, cy)
      sfx.hit()
      flashRef.current = Math.max(flashRef.current, 0.4)
    } else if (weaponRef.current === 'railgun') {
      // Pierces everything along the exact shot line, checked against each
      // tracked element's real bounding box (not probabilistic point
      // sampling like laser), so a packed stack of sections all get cut in
      // one shot -- their signature weapon's actual behavior, confirmed
      // via direct testing.
      railgunCooldownRef.current = now + RAILGUN_COOLDOWN
      setRailBeam({ x1: px, y1: py, x2: cx, y2: cy })
      setTimeout(() => setRailBeam(null), 220)
      const candidates: { el: HTMLElement; x: number; y: number; dist: number }[] = []
      indexElementRef.current.forEach((el) => {
        if (destroyedSetRef.current.has(el) || el.closest('[data-destroy-ui]')) return
        const r = el.getBoundingClientRect()
        if (segmentIntersectsRect(px, py, cx, cy, r.left, r.top, r.right, r.bottom)) {
          const ex = r.left + r.width / 2
          const ey = r.top + r.height / 2
          candidates.push({ el, x: ex, y: ey, dist: Math.hypot(ex - px, ey - py) })
        }
      })
      candidates.sort((a, b) => a.dist - b.dist)
      let hitCount = 0
      for (const c of candidates.slice(0, RAILGUN_MAX_HITS)) {
        destroyOne(c.el, c.x, c.y, true)
        hitCount++
      }
      if (roomModeRef.current === 'pvp') {
        for (const [id, rp] of Object.entries(remotePlayersRef.current)) {
          if (!rp.dead && distToSegment(rp.x, rp.y - 28, px, py, cx, cy) <= 22) {
            roomRef.current?.publish('hit', { targetClientId: id, damage: RAILGUN_DAMAGE })
          }
        }
      } else if (roomModeRef.current === 'hideseek') {
        for (const [id, rp] of Object.entries(remotePlayersRef.current)) {
          if (rp.role === 'hider' && rp.hidden && distToSegment(rp.x, rp.y - 28, px, py, cx, cy) <= 22) {
            reportHideSeekFound(id)
          }
        }
      }
      if (hitCount === 0) spawnMissSpark(cx, cy)
      else spawnScreenTear(cx, cy)
      sfx.hit()
      flashRef.current = Math.max(flashRef.current, 0.55)
    } else if (weaponRef.current === 'flamethrower') {
      // Wide cone blast toward the cursor -- every tracked element whose
      // center falls within FLAMETHROWER_RANGE and the cone's half-angle
      // gets burned in one shot, with several real flame sprites animated
      // at staggered points along the cone so it still reads as a stream
      // of fire rather than one static burst.
      flamethrowerCooldownRef.current = now + FLAMETHROWER_COOLDOWN
      const aimAngle = Math.atan2(cy - py, cx - px)
      let hitCount = 0
      indexElementRef.current.forEach((el) => {
        if (destroyedSetRef.current.has(el) || el.closest('[data-destroy-ui]')) return
        const r = el.getBoundingClientRect()
        const ex = r.left + r.width / 2
        const ey = r.top + r.height / 2
        const dist = Math.hypot(ex - px, ey - py)
        if (dist > FLAMETHROWER_RANGE) return
        let angleDiff = Math.atan2(ey - py, ex - px) - aimAngle
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff))
        if (Math.abs(angleDiff) <= FLAMETHROWER_HALF_ANGLE) {
          destroyOne(el, ex, ey, false)
          hitCount++
        }
      })
      if (roomModeRef.current === 'pvp') {
        for (const [id, rp] of Object.entries(remotePlayersRef.current)) {
          if (rp.dead) continue
          const dist = Math.hypot(rp.x - px, rp.y - 28 - py)
          if (dist > FLAMETHROWER_RANGE) continue
          let angleDiff = Math.atan2(rp.y - 28 - py, rp.x - px) - aimAngle
          angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff))
          if (Math.abs(angleDiff) <= FLAMETHROWER_HALF_ANGLE) {
            roomRef.current?.publish('hit', { targetClientId: id, damage: 5 })
          }
        }
      } else if (roomModeRef.current === 'hideseek') {
        for (const [id, rp] of Object.entries(remotePlayersRef.current)) {
          if (rp.role !== 'hider' || !rp.hidden) continue
          const dist = Math.hypot(rp.x - px, rp.y - 28 - py)
          if (dist > FLAMETHROWER_RANGE) continue
          let angleDiff = Math.atan2(rp.y - 28 - py, rp.x - px) - aimAngle
          angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff))
          if (Math.abs(angleDiff) <= FLAMETHROWER_HALF_ANGLE) {
            reportHideSeekFound(id)
          }
        }
      }
      // Several flame sprites staggered along the cone's centerline sell
      // the "stream" look in one instant shot.
      for (let i = 1; i <= 5; i++) {
        const t = i / 5
        const fx = px + Math.cos(aimAngle) * FLAMETHROWER_RANGE * t
        const fy = py + Math.sin(aimAngle) * FLAMETHROWER_RANGE * t
        spawnSpriteAnim(fx, fy, '/games/fx/anim/flamethrower-fire.png', 64, 64, 10, 52 + t * 32, 40)
      }
      if (hitCount === 0) {
        spawnMissSpark(px + Math.cos(aimAngle) * 80, py + Math.sin(aimAngle) * 80)
      } else {
        spawnScreenTear(px + Math.cos(aimAngle) * FLAMETHROWER_RANGE * 0.6, py + Math.sin(aimAngle) * FLAMETHROWER_RANGE * 0.6)
      }
      sfx.hit()
      flashRef.current = Math.max(flashRef.current, 0.45)
    } else if (weaponRef.current === 'rocket') {
      const id = nextGrenadeId.current++
      grenadeTargets.current.set(id, {
        startX: px,
        startY: py,
        targetX: cx,
        targetY: cy,
        startTime: now,
        duration: ROCKET_DURATION,
        kind: 'rocket'
      })
    } else {
      const id = nextProjectileId.current++
      projectileTargets.current.set(id, {
        startX: px,
        startY: py,
        targetX: cx,
        targetY: cy,
        startTime: now,
        duration: 110,
        element: target,
        radius: 0
      })
    }
  }

  const throwGrenadeAt = (cx: number, cy: number) => {
    if (deadRef.current || pilotingDroneRef.current || isHideSeekHider() || isHideSeekSeekerWaiting()) return
    const px = playerRef.current.x
    const py = playerRef.current.y - 28
    const id = nextGrenadeId.current++
    grenadeTargets.current.set(id, {
      startX: px,
      startY: py,
      targetX: cx,
      targetY: cy,
      startTime: performance.now(),
      duration: 650,
      kind: 'grenade'
    })
  }

  // Captures clicks before the real page's own handlers get them, so
  // smashing a button doesn't also trigger whatever it actually does
  // (add to cart, navigate, etc). Our own controls opt back out via
  // data-destroy-ui so Reset/Exit still work normally.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const rawTarget = e.target as HTMLElement
      if (rawTarget.closest('[data-destroy-ui]')) return
      e.preventDefault()
      e.stopPropagation()
      if (isHideSeekHider()) {
        disguiseAt(e.clientX, e.clientY, rawTarget)
        return
      }
      fireAt(e.clientX, e.clientY, rawTarget)
    }

    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-destroy-ui]')) return
      e.preventDefault()
      if (pilotingDroneRef.current) return
      throwGrenadeAt(e.clientX, e.clientY)
    }

    window.addEventListener('click', onClick, { capture: true })
    window.addEventListener('contextmenu', onContextMenu, { capture: true })
    return () => {
      window.removeEventListener('click', onClick, { capture: true })
      window.removeEventListener('contextmenu', onContextMenu, { capture: true })
    }
  }, [])

  // Facing + a little life -- horizontal flip toward the cursor, a slight
  // tilt toward vertical aim, and a small walk bob. No full 360 rotation
  // here since that distorts pixel art badly; the crosshair itself already
  // shows exact aim.
  const facingLeft = crosshair.x < player.x
  const tiltDeg = Math.max(-16, Math.min(16, (crosshair.y - player.y) / 7))
  const bobOffset = pose === 'walk' ? Math.sin(walkPhase) * 3 : 0

  // Stickman-only: the gun can fully rotate to the cursor since it's clean
  // vector art, and legs get a real swing/crouch/tuck pose per animation
  // state -- neither works well on the pixel sprite, which uses flip/tilt
  // above instead.
  const gunAngleDeg = (Math.atan2(crosshair.y - (player.y - 28), crosshair.x - player.x) * 180) / Math.PI
  const stickSwing = pose === 'walk' ? Math.sin(walkPhase) * 9 : 0
  const stickLegs =
    pose === 'air'
      ? { front: '20,34 24,41 22,47', back: '20,34 16,41 18,47' }
      : pose === 'walk'
      ? {
          front: `20,34 ${(20 + stickSwing * 0.5).toFixed(1)},44 ${(20 + stickSwing).toFixed(1)},55`,
          back: `20,34 ${(20 - stickSwing * 0.5).toFixed(1)},44 ${(20 - stickSwing).toFixed(1)},55`
        }
      : { front: '20,34 26,44 24,55', back: '20,34 16,46 18,56' }

  // Each wing is a swept feathered shape pivoting from the shoulder --
  // folded close to the body on the ground, fanning open and beating when
  // flying, instead of a single thin curved line.
  const wingBeat = flying ? Math.sin(wingPhase) * 32 : 0
  const wingAngleLeft = flying ? -(34 + wingBeat) : -10
  const wingAngleRight = flying ? 34 + wingBeat : 10
  const wingPath = (dir: 1 | -1) =>
    `M20,16 C${20 + 9 * dir},2 ${20 + 26 * dir},0 ${20 + 34 * dir},12 C${20 + 30 * dir},18 ${20 + 16 * dir},20 20,20 Z`
  const charStroke = CHAR_COLORS[charColor].stroke
  const charWingFill = CHAR_COLORS[charColor].wingFill

  // Mobile virtual joystick -- same proven pattern as 999 Last Stand's,
  // using Pointer Events so it works for touch without a separate mouse
  // code path. Feeds joystickVecRef, which the main loop blends in
  // alongside WASD.
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

  return (
    <>
      {flash > 0.01 && (
        <div
          className="pointer-events-none fixed inset-0 z-[195]"
          style={{ background: `radial-gradient(circle, rgba(255,120,40,${flash}) 0%, transparent 70%)` }}
        />
      )}

      {grappleLine && (
        <svg className="pointer-events-none fixed inset-0 z-[198] h-full w-full">
          <line
            x1={player.x}
            y1={player.y - 28}
            x2={grappleLine.x}
            y2={grappleLine.y}
            stroke="#e2e8f0"
            strokeWidth={2}
            strokeDasharray="4 3"
            opacity={0.85}
          />
        </svg>
      )}

      <div
        data-destroy-ui
        className="pointer-events-none fixed z-[199]"
        style={{
          left: player.x - 28,
          top: player.y - 58,
          width: 56,
          height: 56,
          opacity: pilotingDrone ? 0.35 : hsHidden ? 0.5 : 1,
          filter: pilotingDrone ? 'grayscale(1) saturate(0)' : hsHidden ? 'hue-rotate(180deg) saturate(0.3)' : 'none',
          transition: 'opacity 0.2s, filter 0.2s'
        }}
      >
        <svg
          viewBox="0 0 40 60"
          width="56"
          height="56"
          overflow="visible"
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          {character === 'stickman' && (
            <>
              <g stroke={charStroke} strokeWidth="3" strokeLinecap="round" fill="none">
                <polyline points={stickLegs.back} />
                <polyline points={stickLegs.front} />
                <line x1="20" y1="16" x2="20" y2="34" />
                <circle cx="20" cy="9" r="7" fill={charStroke} stroke="none" />
              </g>
              <g stroke={charStroke} strokeWidth="3" strokeLinecap="round" fill="none" transform={`rotate(${gunAngleDeg} 20 20)`}>
                <line x1="20" y1="20" x2="36" y2="20" />
                <line x1="30" y1="20" x2="30" y2="16" strokeWidth="4" stroke="#facc15" />
              </g>
            </>
          )}
        </svg>
        {character === 'hooded' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/games/destroy-character.png"
            alt=""
            width={56}
            height={56}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              imageRendering: 'pixelated',
              transform: `scaleX(${facingLeft ? -1 : 1}) rotate(${tiltDeg.toFixed(1)}deg) translateY(${bobOffset.toFixed(1)}px)`,
              filter: `drop-shadow(0 0 3px ${charStroke}) drop-shadow(0 0 6px ${charStroke})`
            }}
          />
        )}
        {character === 'ranger' && (
          <div
            style={{
              position: 'absolute',
              left: -20,
              top: 0,
              filter: `drop-shadow(0 0 3px ${charStroke}) drop-shadow(0 0 6px ${charStroke})`
            }}
          >
            <RangerSprite pose={pose} facingLeft={facingLeft} displaySize={64} />
          </div>
        )}
        {/* Wings paint last, as their own overlay, so they're never hidden
            behind an opaque character sprite (Ranger's art fully covers
            the same region the wing pivot sits in -- painted earlier,
            inside the character-specific svg/img above, they were
            invisible underneath it). Scale/opacity-transition "sprout"
            from the back on toggle, same pivot point for every character. */}
        <svg
          viewBox="0 0 40 60"
          width="56"
          height="56"
          overflow="visible"
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
        >
          <g
            style={{
              transformOrigin: '20px 16px',
              transformBox: 'fill-box',
              transition: 'transform 220ms ease, opacity 220ms ease',
              transform: flying ? 'scale(1)' : 'scale(0)',
              opacity: flying ? 1 : 0
            }}
          >
            <g transform={`rotate(${wingAngleLeft} 20 16)`}>
              <path d={wingPath(-1)} fill={charWingFill} stroke={charStroke} strokeWidth="1.5" />
            </g>
            <g transform={`rotate(${wingAngleRight} 20 16)`}>
              <path d={wingPath(1)} fill={charWingFill} stroke={charStroke} strokeWidth="1.5" />
            </g>
          </g>
        </svg>
      </div>

      <div
        data-destroy-ui
        className="pointer-events-none fixed z-[200]"
        style={{ left: crosshair.x - 16, top: crosshair.y - 16, width: 32, height: 32 }}
      >
        <svg viewBox="0 0 32 32" width="32" height="32">
          <circle cx="16" cy="16" r="12" fill="none" stroke="#ef4444" strokeWidth="2" />
          <line x1="16" y1="0" x2="16" y2="8" stroke="#ef4444" strokeWidth="2" />
          <line x1="16" y1="24" x2="16" y2="32" stroke="#ef4444" strokeWidth="2" />
          <line x1="0" y1="16" x2="8" y2="16" stroke="#ef4444" strokeWidth="2" />
          <line x1="24" y1="16" x2="32" y2="16" stroke="#ef4444" strokeWidth="2" />
        </svg>
      </div>

      {particles.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed z-[200] h-2.5 w-2.5 rounded-full"
          style={{
            left: p.x,
            top: p.y,
            background: p.color,
            opacity: Math.max(0, p.life / 40),
            boxShadow: `0 0 6px ${p.color}`
          }}
        />
      ))}

      {fragments.map((f) => (
        <div
          key={f.id}
          className="pointer-events-none fixed z-[150]"
          style={{
            left: f.x - f.w / 2,
            top: f.y - f.h / 2,
            width: f.w,
            height: f.h,
            clipPath: f.clipPath,
            transform: `rotate(${((f.angle * 180) / Math.PI).toFixed(1)}deg)`,
            background: f.bg,
            backgroundSize: f.bgSize,
            backgroundPosition: f.bgPos,
            backgroundRepeat: 'no-repeat',
            opacity: Math.max(0, Math.min(1, (FRAG_LIFETIME_MS - (performance.now() - f.born)) / 600))
          }}
        />
      ))}

      {projectiles.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed z-[200] rounded-full"
          style={{
            left: p.x - (p.kind === 'pellet' ? 3 : 6),
            top: p.y - 2,
            width: p.kind === 'pellet' ? 6 : 12,
            height: 4,
            background: p.kind === 'pellet' ? '#fb923c' : '#facc15',
            boxShadow: `0 0 6px ${p.kind === 'pellet' ? '#fb923c' : '#facc15'}`,
            transform: `rotate(${p.angle}deg)`
          }}
        />
      ))}

      {beam && (
        <svg className="pointer-events-none fixed inset-0 z-[200] h-full w-full">
          <line x1={beam.x1} y1={beam.y1} x2={beam.x2} y2={beam.y2} stroke="#60a5fa" strokeWidth={3} opacity={0.9} />
          <line x1={beam.x1} y1={beam.y1} x2={beam.x2} y2={beam.y2} stroke="#e0f2fe" strokeWidth={1} opacity={0.9} />
        </svg>
      )}

      {railBeam &&
        (() => {
          const dx = railBeam.x2 - railBeam.x1
          const dy = railBeam.y2 - railBeam.y1
          const len = Math.max(20, Math.hypot(dx, dy))
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI
          return (
            <div
              className="pointer-events-none fixed z-[200]"
              style={{
                left: railBeam.x1 - 22,
                top: railBeam.y1,
                width: 44,
                height: len,
                transform: `rotate(${angle - 90}deg)`,
                transformOrigin: 'top center',
                backgroundImage: 'url(/games/fx/anim/railgun-beam.png)',
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                opacity: 0.95,
                filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.9)) drop-shadow(0 0 20px rgba(34,211,238,0.5))'
              }}
            />
          )
        })()}

      {grenades.map((g) => (
        <div
          key={g.id}
          className="pointer-events-none fixed z-[200] flex h-5 w-5 items-center justify-center rounded-full text-[11px]"
          style={{ left: g.x - 10, top: g.y - 10, background: g.kind === 'rocket' ? '#ef4444' : '#f97316' }}
        >
          {g.kind === 'rocket' ? '🚀' : '💣'}
        </div>
      ))}

      {droneZap && (
        <svg className="pointer-events-none fixed inset-0 z-[199] h-full w-full">
          <line
            x1={droneZap.x1}
            y1={droneZap.y1}
            x2={droneZap.x2}
            y2={droneZap.y2}
            stroke="#60a5fa"
            strokeWidth={3}
            opacity={0.9}
          />
          <line
            x1={droneZap.x1}
            y1={droneZap.y1}
            x2={droneZap.x2}
            y2={droneZap.y2}
            stroke="#dbeafe"
            strokeWidth={1}
            opacity={0.9}
          />
        </svg>
      )}

      {drone && (
        <div
          className="pointer-events-none fixed z-[199]"
          style={{
            left: drone.x - 21,
            top: drone.y - 21 + drone.bob,
            filter: pilotingDrone
              ? 'drop-shadow(0 0 10px rgba(96,165,250,1)) drop-shadow(0 0 18px rgba(96,165,250,0.6))'
              : 'drop-shadow(0 0 6px rgba(96,165,250,0.8))'
          }}
        >
          {pilotingDrone && (
            <div
              className="absolute animate-pulse rounded-full border-2 border-blue-400/70"
              style={{ left: -6, top: -6, width: 54, height: 54 }}
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/games/weapons/drone.png"
            alt=""
            width={42}
            height={42}
            style={{ imageRendering: 'pixelated', transform: `scaleX(${drone.facingLeft ? -1 : 1})` }}
          />
        </div>
      )}

      {/* Other players in the room render with our actual character art
          (the same stickman SVG / 999 Zombie sprite the local player uses)
          instead of an emoji stand-in -- a static idle pose is enough here,
          no need to replicate the local player's full walk/air animation
          state for someone else's avatar. */}
      {Object.entries(remotePlayers)
        .filter(([, rp]) => !(mpMode === 'hideseek' && rp.role === 'hider' && rp.hidden && !rp.found))
        .map(([id, rp]) => (
        <div
          key={id}
          className="pointer-events-none fixed z-[198] flex flex-col items-center"
          style={{ left: rp.x - 20, top: rp.y - 58, width: 40, opacity: rp.dead || rp.found ? 0.3 : 1 }}
        >
          <span className="rounded bg-black/70 px-1 text-[9px] text-white/80">
            {mpMode === 'hideseek'
              ? rp.found
                ? 'Found!'
                : rp.role === 'seeker'
                  ? 'Seeker'
                  : 'Shuffling...'
              : rp.dead
                ? 'Down'
                : 'Player'}
          </span>
          {mpMode === 'pvp' && (
            <div className="mt-0.5 h-1 w-8 rounded-full bg-white/15">
              <div className="h-1 rounded-full bg-green-400" style={{ width: `${Math.max(0, rp.hp)}%` }} />
            </div>
          )}
          {rp.character === 'hooded' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/games/destroy-character.png"
              alt=""
              width={32}
              height={32}
              style={{ imageRendering: 'pixelated', transform: `scaleX(${rp.facingLeft ? -1 : 1})` }}
            />
          ) : rp.character === 'ranger' ? (
            <RangerSprite pose="idle" facingLeft={rp.facingLeft} displaySize={48} />
          ) : (
            <svg
              viewBox="0 0 40 60"
              width="32"
              height="48"
              style={{ transform: `scaleX(${rp.facingLeft ? -1 : 1})` }}
            >
              <g stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" fill="none">
                <polyline points="20,34 26,44 24,55" />
                <polyline points="20,34 16,46 18,56" />
                <line x1="20" y1="16" x2="20" y2="34" />
                <circle cx="20" cy="9" r="7" fill="#f8fafc" stroke="none" />
              </g>
            </svg>
          )}
        </div>
      ))}

      {mpMode === 'pvp' && mpRoom && (
        <div
          data-destroy-ui
          className="pointer-events-none fixed left-3 top-20 z-[210] flex flex-col gap-1 rounded-lg border border-accent/40 bg-black/80 px-3 py-2 text-xs text-white"
        >
          <span className="text-white/60">HP</span>
          <div className="h-2 w-28 rounded-full bg-white/15">
            <div
              className={`h-2 rounded-full ${hp > 40 ? 'bg-green-400' : 'bg-red-500'}`}
              style={{ width: `${Math.max(0, hp)}%` }}
            />
          </div>
          {dead && <span className="text-red-400">Respawning...</span>}
        </div>
      )}

      {/* "Website Destroyed" end-state -- the reference site has one of
          these at high destroyed%; ours previously had no finish line,
          destroyed% just climbed forever. Fires once per session (not
          re-triggered by remote co-op destroy events once dismissed). */}
      {victoryShown && (
        <div
          data-destroy-ui
          className="pointer-events-auto fixed inset-0 z-[270] flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-[min(92vw,420px)] rounded-2xl border border-accent/60 bg-black/95 px-6 py-8 text-center">
            <div className="text-4xl">💀</div>
            <h3 className="mt-2 text-2xl font-bold text-accent drop-shadow-[0_0_10px_rgba(57,255,20,0.6)]">
              Website Destroyed
            </h3>
            <p className="mt-2 text-sm text-white/70">100% of this page is gone.</p>
            {bgStyleRef.current === 'image' && (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-accent/40 bg-black/60 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={revealBg.src}
                  alt=""
                  className="h-24 w-24 rounded-lg border border-accent/30 object-cover"
                />
                <p className="text-xs font-semibold text-accent">
                  {bgUnlocked ? `Unlocked: ${revealBg.name}` : 'Unlocking...'}
                </p>
                <p className="text-[11px] text-white/50">Added to your background collection.</p>
              </div>
            )}
            {lifetimeTotal !== null && (
              <div className="mt-3 flex items-center justify-center gap-2 text-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getRank(lifetimeTotal).current.badge}
                  alt=""
                  width={28}
                  height={28}
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="font-semibold">{getRank(lifetimeTotal).current.name}</span>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => setVictoryShown(false)}
                className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-black"
              >
                Keep Destroying
              </button>
              <button
                onClick={() => {
                  syncScore()
                  window.location.reload()
                }}
                className="rounded-full border border-accent/50 px-4 py-2.5 text-sm text-accent"
              >
                Reset Page
              </button>
              <button
                onClick={() => {
                  syncScore()
                  onExit()
                }}
                className="rounded-full border border-white/20 px-4 py-2.5 text-sm text-white/70"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {showCharacterPaywall && (
        <div data-destroy-ui className="pointer-events-auto fixed inset-0 z-[260] flex items-center justify-center bg-black/80 p-4">
          <CharacterUnlockPaywall
            onClose={() => setShowCharacterPaywall(false)}
            onUnlocked={() => {
              setHoodedUnlocked(true)
              characterRef.current = 'hooded'
              setCharacter('hooded')
              setShowCharacterPaywall(false)
            }}
          />
        </div>
      )}

      {/* Status -- top-left, read-only */}
      <div
        data-destroy-ui
        className="pointer-events-none fixed left-3 top-3 z-[210] flex flex-col gap-1 rounded-lg border border-accent/40 bg-black/80 px-3 py-2 text-xs text-white"
      >
        <span className="font-mono">💥 {Math.min(100, Math.round((destroyedCount / totalCount) * 100))}% destroyed</span>
        {lifetimeTotal !== null && (
          <span className="flex items-center gap-1 text-accent" title={`${lifetimeTotal} lifetime destroyed`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getRank(lifetimeTotal).current.badge}
              alt=""
              width={16}
              height={16}
              style={{ imageRendering: 'pixelated' }}
            />
            {getRank(lifetimeTotal).current.name}
          </span>
        )}
      </div>

      {(flying || flyFuel < 1) && (
        <div
          data-destroy-ui
          className="pointer-events-none fixed left-3 top-40 z-[210] flex flex-col gap-1 rounded-lg border border-accent/40 bg-black/80 px-3 py-2 text-xs text-white"
        >
          <span className="text-white/60">🪽 Flight</span>
          <div className="h-2 w-28 rounded-full bg-white/15">
            <div
              className={`h-2 rounded-full transition-[width] ${flyFuel > 0.25 ? 'bg-accent' : 'bg-red-500'}`}
              style={{ width: `${flyFuel * 100}%` }}
            />
          </div>
        </div>
      )}

      {pilotingDrone && (
        <div
          data-destroy-ui
          className="pointer-events-none fixed left-1/2 top-3 z-[210] -translate-x-1/2 animate-pulse rounded-lg border border-blue-400/60 bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-200"
        >
          🛰️ Piloting Drone -- press 5 to return control
        </div>
      )}

      {/* Exit / reset -- top-right */}
      <div data-destroy-ui className="pointer-events-auto fixed right-3 top-3 z-[210] flex gap-2">
        <button
          onClick={() => {
            syncScore()
            window.location.reload()
          }}
          title="Reset Page"
          className="rounded-full border border-accent/40 bg-black/80 px-3 py-2 text-sm text-accent"
        >
          ↻
        </button>
        <button
          onClick={() => {
            syncScore()
            onExit()
          }}
          title="Exit"
          className="rounded-full border border-white/20 bg-black/80 px-3 py-2 text-sm text-white/70"
        >
          ✕
        </button>
      </div>

      {/* Side dock -- Appearance / Character / Co-op, one shared panel.
          Moved to mid-right on touch devices so the bottom-right corner is
          free for the FIRE/action button cluster. */}
      <div
        data-destroy-ui
        className={`pointer-events-auto fixed z-[210] flex flex-col gap-2 ${
          isTouch ? 'right-3 top-1/2 -translate-y-1/2' : 'bottom-24 right-3'
        }`}
      >
        <button
          onClick={() => setActivePanel((p) => (p === 'appearance' ? null : 'appearance'))}
          title="Appearance"
          className={`flex h-10 w-10 items-center justify-center rounded-full border text-base ${
            activePanel === 'appearance' ? 'border-accent bg-accent text-black' : 'border-white/25 bg-black/80 text-white/80'
          }`}
        >
          🎨
        </button>
        <button
          onClick={() => setActivePanel((p) => (p === 'character' ? null : 'character'))}
          title="Character"
          className={`flex h-10 w-10 items-center justify-center rounded-full border text-base ${
            activePanel === 'character' ? 'border-accent bg-accent text-black' : 'border-white/25 bg-black/80 text-white/80'
          }`}
        >
          🧍
        </button>
        <button
          onClick={() => setActivePanel((p) => (p === 'coop' ? null : 'coop'))}
          title={mode === 'hideseek' ? 'Hide & Seek' : 'Co-op'}
          className={`relative flex h-10 w-10 items-center justify-center rounded-full border text-base ${
            activePanel === 'coop' ? 'border-accent bg-accent text-black' : 'border-white/25 bg-black/80 text-white/80'
          }`}
        >
          {mode === 'hideseek' ? '🫥' : '🌐'}
          {mpRoom && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border border-black bg-green-400" />}
        </button>
      </div>

      {activePanel && (
        <div
          data-destroy-ui
          className={`pointer-events-auto fixed z-[210] flex w-[min(85vw,300px)] flex-col gap-3 rounded-xl border border-accent/50 bg-black/92 px-4 py-3 text-xs text-white ${
            isTouch ? 'right-16 top-1/2 -translate-y-1/2' : 'bottom-24 right-16'
          }`}
        >
          {activePanel === 'appearance' && (
            <>
              <h4 className="text-sm font-semibold text-accent">Appearance</h4>
              <div className="flex items-center gap-2">
                <span className="w-16 text-white/50">Character</span>
                <div className="flex gap-1.5">
                  {(Object.keys(CHAR_COLORS) as CharColorKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setCharColor(key)}
                      title={CHAR_COLORS[key].label}
                      style={{ background: CHAR_COLORS[key].stroke }}
                      className={`h-5 w-5 rounded-full border-2 ${charColor === key ? 'border-accent' : 'border-white/30'}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-white/50">Particles</span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(PARTICLE_THEMES) as ParticleThemeKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        particleThemeRef.current = key
                        setParticleTheme(key)
                      }}
                      className={`rounded-full border px-2 py-1 ${
                        particleTheme === key ? 'border-accent text-accent' : 'border-white/30 text-white/60'
                      }`}
                    >
                      {PARTICLE_THEMES[key].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-white/50">Destroyed text</span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TEXT_COLORS) as TextColorKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        textColorRef.current = key
                        setTextColor(key)
                      }}
                      className={`rounded-full border px-2 py-1 ${
                        textColor === key ? 'border-accent text-accent' : 'border-white/30 text-white/60'
                      }`}
                    >
                      {TEXT_COLORS[key].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-white/50">Reveal behind holes</span>
                <p className="text-[10px] text-white/40">
                  &quot;{revealBg.name}&quot; is hidden behind this page -- fully destroy it to unlock the image.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => {
                      bgStyleRef.current = 'image'
                      setBgStyle('image')
                    }}
                    title={`Image -- unlock "${revealBg.name}" by fully destroying the page`}
                    style={{ backgroundImage: `url(${revealBg.src})`, backgroundSize: 'cover' }}
                    className={`h-5 w-5 rounded-full border-2 ${bgStyle === 'image' ? 'border-accent' : 'border-white/30'}`}
                  />
                  <button
                    onClick={() => {
                      bgStyleRef.current = 'random'
                      setBgStyle('random')
                    }}
                    title="Random -- different every hit"
                    style={{ background: 'conic-gradient(#39ff14, #a78bfa, #facc15, #60a5fa, #f472b6, #39ff14)' }}
                    className={`h-5 w-5 rounded-full border-2 ${bgStyle === 'random' ? 'border-accent' : 'border-white/30'}`}
                  />
                  {BG_STYLE_KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        bgStyleRef.current = key
                        setBgStyle(key)
                      }}
                      title={BG_STYLES[key].label}
                      style={{ background: BG_STYLES[key].css }}
                      className={`h-5 w-5 rounded-full border-2 ${bgStyle === key ? 'border-accent' : 'border-white/30'}`}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {activePanel === 'character' && (
            <>
              <h4 className="text-sm font-semibold text-accent">Character</h4>
              <button
                onClick={() => {
                  characterRef.current = 'stickman'
                  setCharacter('stickman')
                }}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  character === 'stickman' ? 'border-accent text-accent' : 'border-white/20 text-white/70'
                }`}
              >
                <span>🧍 Stickman (default)</span>
                {character === 'stickman' && <span>✓</span>}
              </button>
              <button
                onClick={() => {
                  if (hoodedUnlocked) {
                    characterRef.current = 'hooded'
                    setCharacter('hooded')
                  } else {
                    setShowCharacterPaywall(true)
                  }
                }}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  character === 'hooded' ? 'border-accent text-accent' : 'border-white/20 text-white/70'
                }`}
              >
                <span>🧟 999 Zombie</span>
                {character === 'hooded' ? <span>✓</span> : hoodedUnlocked ? <span>Select</span> : <span>🔒 $9.99</span>}
              </button>
              <button
                onClick={() => {
                  characterRef.current = 'ranger'
                  setCharacter('ranger')
                }}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  character === 'ranger' ? 'border-accent text-accent' : 'border-white/20 text-white/70'
                }`}
              >
                <span>🏃 Ranger</span>
                {character === 'ranger' && <span>✓</span>}
              </button>
            </>
          )}

          {activePanel === 'coop' && (
            <>
              <h4 className="text-sm font-semibold text-accent">{mode === 'hideseek' ? 'Hide & Seek' : 'Co-op'}</h4>
              {mpRoom ? (
                <>
                  <p className="text-white/70">
                    Room code: <span className="font-mono text-accent">{mpRoom}</span> --{' '}
                    {mpMode === 'pvp'
                      ? 'PvP duel, shoot each other'
                      : mpMode === 'hideseek'
                        ? 'Hide & Seek'
                        : 'wreck this page together'}
                    . Share it so others can join.
                  </p>
                  <p className="text-white/50">{Object.keys(remotePlayers).length} other player(s) here</p>
                  {mpMode === 'hideseek' && (
                    <>
                      {hsPhase === 'lobby' ? (
                        <button
                          onClick={startHideSeekRound}
                          disabled={Object.keys(remotePlayers).length === 0}
                          className="rounded-lg border border-accent/50 px-3 py-2 text-accent disabled:opacity-40"
                        >
                          {Object.keys(remotePlayers).length === 0
                            ? 'Waiting for others to join...'
                            : 'Start Round (you are the Seeker)'}
                        </button>
                      ) : (
                        <p className="text-white/50">
                          You're {hsRole === 'seeker' ? 'the Seeker 🔍' : hsFound ? 'found and spectating 👻' : 'a Hider 🫥'}
                        </p>
                      )}
                    </>
                  )}
                  <button onClick={leaveRoom} className="rounded-lg border border-white/20 px-3 py-2 text-white/70">
                    Leave Room
                  </button>
                </>
              ) : (
                <>
                  {mode === 'hideseek' ? (
                    <>
                      <button
                        onClick={() => connectRoom(randomRoomCode(), 'hideseek')}
                        disabled={mpStatus === 'connecting'}
                        className="rounded-lg border border-blue-400/50 px-3 py-2 text-blue-300 disabled:opacity-50"
                      >
                        {mpStatus === 'connecting' ? '...' : '🫥 Create Room'}
                      </button>
                      <p className="text-[10px] text-white/40">
                        One Seeker hunts, everyone else disguises as real page elements. Share the room code so
                        others can join.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => connectRoom(randomRoomCode(), 'coop')}
                          disabled={mpStatus === 'connecting'}
                          className="rounded-lg border border-accent/50 px-2 py-2 text-accent disabled:opacity-50"
                        >
                          {mpStatus === 'connecting' ? '...' : '🤝 Co-op Room'}
                        </button>
                        <button
                          onClick={() => connectRoom(randomRoomCode(), 'pvp')}
                          disabled={mpStatus === 'connecting'}
                          className="rounded-lg border border-red-400/50 px-2 py-2 text-red-400 disabled:opacity-50"
                        >
                          {mpStatus === 'connecting' ? '...' : '⚔️ PvP Room'}
                        </button>
                      </div>
                      <p className="text-[10px] text-white/40">
                        Co-op: destroy the page together. PvP: shoot each other, respawn on death.
                      </p>
                    </>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={mpJoinInput}
                      onChange={(e) => setMpJoinInput(e.target.value.toUpperCase())}
                      placeholder="ROOM CODE"
                      className="flex-1 rounded-lg border border-white/20 bg-black/60 px-2 py-2 font-mono text-white"
                      maxLength={6}
                    />
                    <button
                      onClick={() => mpJoinInput && connectRoom(mpJoinInput, mode === 'hideseek' ? 'hideseek' : 'coop')}
                      disabled={!mpJoinInput || mpStatus === 'connecting'}
                      className="rounded-lg border border-accent/50 px-3 py-2 text-accent disabled:opacity-50"
                    >
                      Join
                    </button>
                  </div>
                  {mpStatus === 'error' && <p className="text-red-400">Could not connect -- try again.</p>}
                </>
              )}
            </>
          )}
        </div>
      )}

      {helpOpen && (
        <div
          data-destroy-ui
          className="pointer-events-auto fixed bottom-24 left-1/2 z-[210] w-[min(92vw,340px)] -translate-x-1/2 rounded-xl border border-accent/50 bg-black/92 px-4 py-3 text-xs text-white/80"
        >
          {isHideSeekHider()
            ? isTouch
              ? 'Hide & Seek (Hider) -- joystick to move · tap anything to disguise as it · a shuffle to a new spot is briefly visible, then a cooldown before you can move again'
              : 'Hide & Seek (Hider) -- A/D move, Space jump, F fly, Q grapple · click any real element to disguise as it · re-disguising is briefly visible, then a cooldown'
            : pilotingDrone
            ? isTouch
              ? 'Piloting Drone -- joystick to fly it · drag to aim · 🔥 fires its zap · 5 returns control to you'
              : 'Piloting Drone -- WASD/arrows to fly it · click to fire its zap · press 5 to return control to your character'
            : isTouch
              ? `Joystick to move · drag anywhere to aim · 🔥 fires · ⬆️ jump · 🪽 fly ${
                  flying ? '(on)' : ''
                } · 🪝 grapple · 💨 slide · 💣 grenade · 5 deploys/pilots the Drone`
              : `A/D move · Space jump · F fly ${
                  flying ? '(on)' : ''
                } · Q grapple · Shift slide · Right-click grenade · 5 deploys/pilots the Drone, 5 again returns control`}
        </div>
      )}

      {isTouch && (
        <>
          {/* Movement joystick -- bottom-left */}
          <div
            ref={joystickBaseRef}
            data-destroy-ui
            onPointerDown={handleJoystickDown}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickUp}
            onPointerCancel={handleJoystickUp}
            className="pointer-events-auto fixed bottom-24 left-4 z-[210] h-24 w-24 touch-none rounded-full border border-accent/40 bg-black/60"
          >
            <div
              className="pointer-events-none absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/70"
              style={{
                left: `${50 + joystickVecRef.current.x * 35}%`,
                top: `${50 + joystickVecRef.current.y * 35}%`
              }}
            />
          </div>

          {/* Jump / Fly / Grapple / Grenade -- small cluster, left of FIRE */}
          <div data-destroy-ui className="pointer-events-auto fixed bottom-24 right-20 z-[210] grid grid-cols-2 gap-2">
            <button
              onPointerDown={doJump}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/70 text-lg text-white"
            >
              ⬆️
            </button>
            <button
              onPointerDown={doToggleFly}
              className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg ${
                flying ? 'border-accent bg-accent/30 text-accent' : 'border-white/25 bg-black/70 text-white'
              }`}
            >
              🪽
            </button>
            <button
              onPointerDown={doGrapple}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/70 text-lg text-white"
            >
              🪝
            </button>
            <button
              onPointerDown={() => throwGrenadeAt(crosshairRef.current.x, crosshairRef.current.y)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-orange-400/50 bg-black/70 text-lg text-orange-400"
            >
              💣
            </button>
            <button
              onPointerDown={doSlide}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/70 text-lg text-white"
            >
              💨
            </button>
          </div>

          {/* FIRE -- bottom-right, shoots wherever the aim-drag last put the
              crosshair. In Hide & Seek, a Hider has no weapon at all -- this
              same button disguises at the crosshair's position instead. */}
          <button
            data-destroy-ui
            onPointerDown={() =>
              isHideSeekHider()
                ? disguiseAt(crosshairRef.current.x, crosshairRef.current.y, null)
                : fireAt(crosshairRef.current.x, crosshairRef.current.y, null)
            }
            className={`pointer-events-auto fixed bottom-24 right-3 z-[210] flex h-16 w-16 items-center justify-center rounded-full border-2 text-xl font-bold text-white ${
              isHideSeekHider()
                ? 'border-blue-400/70 bg-blue-500/30 active:bg-blue-500/50'
                : 'border-red-400/70 bg-red-500/30 active:bg-red-500/50'
            }`}
          >
            {isHideSeekHider() ? '🫥' : '🔥'}
          </button>
        </>
      )}

      {/* Weapon hotbar -- bottom-center. Hidden entirely for a Hide & Seek
          Hider, who has no weapons; the disguise status panel below takes
          its place. */}
      {!isHideSeekHider() && (
      <div
        data-destroy-ui
        className="pointer-events-auto fixed bottom-6 left-1/2 z-[210] flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-accent/50 bg-black/90 p-1.5"
      >
        {(
          [
            ['pistol', '1', '🔫', null],
            ['shotgun', '2', '💥', null],
            ['laser', '3', '⚡', null],
            ['rocket', '4', '🚀', null],
            ['drone', '5', null, '/games/weapons/drone.png'],
            ['railgun', '6', null, '/games/fx/anim/railgun-beam.png'],
            ['flamethrower', '7', null, '/games/weapons/flamethrower-icon.png']
          ] as [Weapon, string, string | null, string | null][]
        ).map(([w, num, icon, img]) => {
          const isDroneSlot = w === 'drone'
          const droneActive = isDroneSlot && (pilotingDrone || !!drone)
          return (
            <button
              key={w}
              onClick={() => {
                if (isDroneSlot) {
                  toggleDronePilot()
                  return
                }
                weaponRef.current = w
                setWeapon(w)
              }}
              title={isDroneSlot ? (pilotingDrone ? 'Piloting Drone -- click to return control' : drone ? 'Drone deployed -- click to pilot it' : 'Deploy Drone') : w}
              className={`flex h-10 w-10 flex-col items-center justify-center rounded-lg border text-sm leading-none ${
                pilotingDrone && isDroneSlot
                  ? 'animate-pulse border-blue-400 bg-blue-400/25 text-blue-300'
                  : droneActive
                    ? 'border-blue-400/70 bg-blue-400/10 text-blue-300'
                    : weapon === w
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-white/15 text-white/70'
              }`}
            >
              {icon ? (
                <span>{icon}</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img ?? ''} alt="" width={16} height={16} style={{ imageRendering: 'pixelated' }} />
              )}
              <span className="text-[9px]">{num}</span>
            </button>
          )
        })}
        <div className="mx-1 h-7 w-px bg-white/15" />
        <button
          onClick={() => setHelpOpen((v) => !v)}
          title="Controls"
          className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm ${
            helpOpen ? 'border-accent bg-accent/20 text-accent' : 'border-white/15 text-white/70'
          }`}
        >
          ?
        </button>
      </div>
      )}

      {/* Hider's disguise status -- replaces the weapon hotbar in the same
          spot. Shows whether they're currently hidden, mid-shuffle, found,
          or on cooldown before they can re-disguise. */}
      {isHideSeekHider() && (
        <div
          data-destroy-ui
          className="pointer-events-none fixed bottom-6 left-1/2 z-[210] -translate-x-1/2 rounded-2xl border border-accent/50 bg-black/90 px-4 py-2.5 text-center text-xs text-white"
        >
          {hsFound ? (
            <span className="font-semibold text-red-400">You were found! Spectating the rest of the round.</span>
          ) : hsRedisguiseTravelRef.current ? (
            <span className="font-semibold text-yellow-300">Exposed -- shuffling to a new disguise...</span>
          ) : hsHidden ? (
            <span className="font-semibold text-blue-300">
              🫥 Hidden{' '}
              {hsCooldownLeft > 0 ? (
                <span className="text-white/50">-- re-disguise ready in {hsCooldownLeft}s</span>
              ) : (
                <span className="text-white/50">-- click anything to re-disguise</span>
              )}
            </span>
          ) : (
            <span className="font-semibold text-accent">Click any real element to disguise as it</span>
          )}
        </div>
      )}

      {/* Blindfolds the Seeker during the Hiding head-start -- otherwise
          they're frozen but can still watch hiders run to their spots on
          screen, which defeats the point of the head start. */}
      {isHideSeekSeekerWaiting() && (
        <div
          data-destroy-ui
          className="pointer-events-none fixed inset-0 z-[265] flex flex-col items-center justify-center gap-3 bg-black text-center"
        >
          <div className="text-5xl">🙈</div>
          <h3 className="text-xl font-bold text-accent">No peeking...</h3>
          <p className="text-sm text-white/60">Hiders are picking their spots -- {hsTimeLeft}s</p>
        </div>
      )}

      {/* Hide & Seek phase/timer HUD -- top-center, visible to everyone in
          the room once a round is active. */}
      {mpMode === 'hideseek' && mpRoom && (hsPhase === 'hiding' || hsPhase === 'hunting') && (
        <div
          data-destroy-ui
          className="pointer-events-none fixed left-1/2 top-3 z-[210] -translate-x-1/2 rounded-lg border border-accent/50 bg-black/85 px-4 py-2 text-center text-xs text-white"
        >
          <div className="font-semibold text-accent">
            {hsPhase === 'hiding'
              ? hsRole === 'seeker'
                ? `Hiders are getting ready... ${hsTimeLeft}s`
                : `Find a hiding spot! ${hsTimeLeft}s`
              : `${hsRole === 'seeker' ? 'Hunt them down!' : 'Stay hidden!'} ${hsTimeLeft}s left`}
          </div>
          {hsPhase === 'hunting' && (
            <div className="mt-0.5 text-white/60">
              {hsHidersRemaining}/{hsHidersTotal} hiders still hidden
            </div>
          )}
        </div>
      )}

      {/* Hide & Seek round-end screen -- winner banner + rematch, reusing
          the same modal styling as the "Website Destroyed" screen. */}
      {hsWinner && (
        <div
          data-destroy-ui
          className="pointer-events-auto fixed inset-0 z-[270] flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-[min(92vw,420px)] rounded-2xl border border-accent/60 bg-black/95 px-6 py-8 text-center">
            <div className="text-4xl">{hsWinner === 'seekers' ? '🔍' : '🫥'}</div>
            <h3 className="mt-2 text-2xl font-bold text-accent drop-shadow-[0_0_10px_rgba(57,255,20,0.6)]">
              {hsWinner === 'seekers' ? 'Seekers Win!' : 'Hiders Win!'}
            </h3>
            <p className="mt-2 text-sm text-white/70">
              {hsWinner === 'seekers'
                ? 'Every hider was found before time ran out.'
                : 'At least one hider stayed hidden the whole round.'}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => {
                  setHsWinner(null)
                  hsPhaseRef.current = 'lobby'
                  setHsPhase('lobby')
                  startHideSeekRound()
                }}
                className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-black"
              >
                Play Again
              </button>
              <button
                onClick={() => {
                  setHsWinner(null)
                  hsPhaseRef.current = 'lobby'
                  setHsPhase('lobby')
                }}
                className="rounded-full border border-white/20 px-4 py-2.5 text-sm text-white/70"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
