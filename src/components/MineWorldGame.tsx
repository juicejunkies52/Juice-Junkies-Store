'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../../lib/sfx'

// ============================================================================
// Original mine/build sandbox -- our own engine, reimplemented from first
// principles after studying the architecture of an open-source Terraria-
// style clone for technique (typed-array tile storage, chunk-canvas
// caching, corner-sampled AABB physics, halo-bounded flood-fill lighting --
// see individual comments below for which idea came from where). No code,
// art, or content from Terraria or any clone was copied -- every tile is
// drawn procedurally (flat fills + a cheap pattern function) exactly like
// this project's other games, and every system here is its own
// implementation of the general technique, not a port.
//
// This is a genuine tile-grid engine (seeded worldgen, real physics,
// mining/building, flood-fill lighting, full save/continue) rather than a
// short arcade loop like 999 Last Stand -- scoped deliberately smaller than
// Terraria's actual item/crafting tree (a couple of tool tiers, a handful
// of craftable building materials) so the ENGINE itself can be real without
// the content list being infinite.
// ============================================================================

// ---- Tile ids --------------------------------------------------------------
// Small integers stored in a Uint8Array. 0 is always air. NEVER renumber an
// existing id once real saves exist -- MineWorld diffs persist raw ids.
const TILE = {
  AIR: 0,
  DIRT: 1,
  GRASS: 2,
  STONE: 3,
  SAND: 4,
  WOOD: 5,
  LEAVES: 6,
  COPPER_ORE: 7,
  IRON_ORE: 8,
  GOLD_ORE: 9,
  COAL_ORE: 10,
  TORCH: 11,
  PLANK: 12,
  BRICK: 13,
  GLASS: 14
} as const
type TileId = (typeof TILE)[keyof typeof TILE]

const WALL = {
  NONE: 0,
  DIRT: 1,
  STONE: 2,
  PLANK: 3
} as const
type WallId = (typeof WALL)[keyof typeof WALL]

interface TileDef {
  name: string
  solid: boolean
  opaque: boolean
  // Seconds to mine at 100 tool power -- "hardness" as a time, same unit
  // the reference engine uses, so damage-per-tick is just
  // (toolPower / 100) * dt / hardness.
  hardness: number
  minPower: number
  // Item id this drops; defaults to the tile's own id (mine dirt, get a
  // dirt item) when omitted.
  drop?: number
  light: number // 0-1 emission, for torches etc.
  pattern: 'flat' | 'speckle' | 'grain' | 'ore' | 'leafy' | 'grid' | 'glass'
  colors: string[]
  needsSupport?: boolean // torches: must have a solid/wall neighbor
  replaceable?: boolean // can be overwritten by a placement (air, leaves)
}

const TILE_DEFS: Record<number, TileDef> = {
  [TILE.AIR]: { name: 'Air', solid: false, opaque: false, hardness: 0, minPower: 0, light: 0, pattern: 'flat', colors: [], replaceable: true },
  [TILE.DIRT]: { name: 'Dirt', solid: true, opaque: true, hardness: 0.5, minPower: 0, light: 0, pattern: 'speckle', colors: ['#6b4a2f', '#5a3d27', '#7a5538'] },
  [TILE.GRASS]: { name: 'Grass', solid: true, opaque: true, hardness: 0.5, minPower: 0, drop: TILE.DIRT, light: 0, pattern: 'grain', colors: ['#3d8b3d', '#4caf50', '#2f6e2f'] },
  [TILE.STONE]: { name: 'Stone', solid: true, opaque: true, hardness: 1.4, minPower: 40, light: 0, pattern: 'speckle', colors: ['#7a7a82', '#6a6a72', '#8a8a92'] },
  [TILE.SAND]: { name: 'Sand', solid: true, opaque: true, hardness: 0.35, minPower: 0, light: 0, pattern: 'speckle', colors: ['#d9c38a', '#c9b37a', '#e3cf9c'] },
  [TILE.WOOD]: { name: 'Wood', solid: true, opaque: true, hardness: 0.8, minPower: 0, light: 0, pattern: 'grain', colors: ['#6b4423', '#5a3a1d', '#7a4f2a'] },
  [TILE.LEAVES]: { name: 'Leaves', solid: false, opaque: false, hardness: 0.2, minPower: 0, light: 0, pattern: 'leafy', colors: ['#2f6e2f', '#3d8b3d', '#255825'], replaceable: true },
  [TILE.COPPER_ORE]: { name: 'Copper Ore', solid: true, opaque: true, hardness: 1.6, minPower: 40, light: 0, pattern: 'ore', colors: ['#7a7a82', '#c97b3f', '#e0935a'] },
  [TILE.IRON_ORE]: { name: 'Iron Ore', solid: true, opaque: true, hardness: 2.0, minPower: 50, light: 0, pattern: 'ore', colors: ['#7a7a82', '#c9b3a0', '#e0d4c8'] },
  [TILE.GOLD_ORE]: { name: 'Gold Ore', solid: true, opaque: true, hardness: 2.4, minPower: 100, light: 0, pattern: 'ore', colors: ['#7a7a82', '#e8c23c', '#fcd94e'] },
  [TILE.COAL_ORE]: { name: 'Coal Ore', solid: true, opaque: true, hardness: 1.5, minPower: 40, light: 0, pattern: 'ore', colors: ['#7a7a82', '#201c1c', '#302a2a'] },
  [TILE.TORCH]: { name: 'Torch', solid: false, opaque: false, hardness: 0.15, minPower: 0, light: 0.95, pattern: 'flat', colors: ['#ffb84d'], needsSupport: true, replaceable: true },
  [TILE.PLANK]: { name: 'Plank', solid: true, opaque: true, hardness: 0.6, minPower: 0, light: 0, pattern: 'grid', colors: ['#9c6b3f', '#8a5c35', '#ad7a4a'] },
  [TILE.BRICK]: { name: 'Brick', solid: true, opaque: true, hardness: 1.8, minPower: 40, light: 0, pattern: 'grid', colors: ['#8a4a3f', '#7a3e34', '#9c5648'] },
  [TILE.GLASS]: { name: 'Glass', solid: true, opaque: false, hardness: 0.7, minPower: 0, light: 0, pattern: 'glass', colors: ['#bfe3f0', '#a8d4e6'] }
}

interface WallDef {
  name: string
  colors: string[]
}
const WALL_DEFS: Record<number, WallDef> = {
  [WALL.NONE]: { name: 'None', colors: [] },
  [WALL.DIRT]: { name: 'Dirt Wall', colors: ['#3a2818', '#2e1f12'] },
  [WALL.STONE]: { name: 'Stone Wall', colors: ['#45454c', '#383840'] },
  [WALL.PLANK]: { name: 'Plank Wall', colors: ['#5a3d22', '#4a3119'] }
}

// ---- Items -------------------------------------------------------------
// Deliberately small: a couple of tool tiers plus a handful of craftable
// building materials, not Terraria's full item tree -- see header comment.
type ItemKind = 'block' | 'tool' | 'material'
interface ItemDef {
  id: string
  name: string
  kind: ItemKind
  tile?: number // block items: what placing it writes
  power?: number // tool items: mining power
  color: string
  // craftable materials: what it's made from (consumed 1:1 per recipe,
  // instant -- no furnace subsystem in v1, see header)
  recipe?: { from: string; count: number; yield: number }
}
const ITEM_DEFS: Record<string, ItemDef> = {
  dirt: { id: 'dirt', name: 'Dirt', kind: 'block', tile: TILE.DIRT, color: '#6b4a2f' },
  stone: { id: 'stone', name: 'Stone', kind: 'block', tile: TILE.STONE, color: '#7a7a82' },
  sand: { id: 'sand', name: 'Sand', kind: 'block', tile: TILE.SAND, color: '#d9c38a' },
  wood: { id: 'wood', name: 'Wood', kind: 'material', color: '#6b4423' },
  plank: { id: 'plank', name: 'Plank', kind: 'block', tile: TILE.PLANK, color: '#9c6b3f', recipe: { from: 'wood', count: 1, yield: 4 } },
  brick: { id: 'brick', name: 'Brick', kind: 'block', tile: TILE.BRICK, color: '#8a4a3f', recipe: { from: 'stone', count: 2, yield: 2 } },
  glass: { id: 'glass', name: 'Glass', kind: 'block', tile: TILE.GLASS, color: '#bfe3f0', recipe: { from: 'sand', count: 2, yield: 1 } },
  torch: { id: 'torch', name: 'Torch', kind: 'block', tile: TILE.TORCH, color: '#ffb84d', recipe: { from: 'coal', count: 1, yield: 3 } },
  copper: { id: 'copper', name: 'Copper Ore', kind: 'material', color: '#c97b3f' },
  iron: { id: 'iron', name: 'Iron Ore', kind: 'material', color: '#c9b3a0' },
  gold: { id: 'gold', name: 'Gold Ore', kind: 'material', color: '#e8c23c' },
  coal: { id: 'coal', name: 'Coal', kind: 'material', color: '#201c1c' },
  pickaxeCopper: { id: 'pickaxeCopper', name: 'Copper Pickaxe', kind: 'tool', power: 55, color: '#c97b3f' },
  pickaxeIron: { id: 'pickaxeIron', name: 'Iron Pickaxe', kind: 'tool', power: 100, color: '#c9b3a0', recipe: { from: 'iron', count: 6, yield: 1 } }
}
// Mining a tile drops this item id.
const TILE_DROP_ITEM: Partial<Record<number, string>> = {
  [TILE.DIRT]: 'dirt',
  [TILE.GRASS]: 'dirt',
  [TILE.STONE]: 'stone',
  [TILE.SAND]: 'sand',
  [TILE.COPPER_ORE]: 'copper',
  [TILE.IRON_ORE]: 'iron',
  [TILE.GOLD_ORE]: 'gold',
  [TILE.COAL_ORE]: 'coal',
  [TILE.WOOD]: 'wood',
  [TILE.TORCH]: 'torch',
  [TILE.PLANK]: 'plank',
  [TILE.BRICK]: 'brick',
  [TILE.GLASS]: 'glass'
}

// ---- Core constants ------------------------------------------------------
const TILE_SIZE = 24
const CHUNK_TILES = 16
const WORLD_W = 180
const WORLD_H = 110
const GRAVITY = 1400 // px/s^2
const MOVE_SPEED = 220 // px/s
// Peak height = v^2/(2*gravity) = 560^2/2800 = 112px (~4.7 tiles) -- tree
// trunk height is capped at 4 tiles (96px) specifically so this always
// clears one with margin (confirmed via live testing: a 5-tile trunk at
// the old cap could wedge the player permanently against it, jump or not).
const JUMP_VELOCITY = -560
const REACH_PX = 5.5 * TILE_SIZE

// ---- Seeded RNG + value noise ---------------------------------------------
// mulberry32 -- tiny, deterministic, good enough statistical quality for
// terrain/cave generation (same spirit as the reference engine's injected
// seeded RNG, our own minimal implementation).
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 1D/2D value noise: hash lattice points with the seeded RNG, smoothstep-
// interpolate between them. Cheap, dependency-free, deterministic -- no
// need for real Perlin/Simplex at this scope.
function makeNoise2D(seed: number) {
  const rand = mulberry32(seed)
  const perm = new Float32Array(4096)
  for (let i = 0; i < perm.length; i++) perm[i] = rand()
  const hash = (x: number, y: number) => {
    const h = (x * 374761393 + y * 668265263) ^ seed
    return perm[((h ^ (h >>> 13)) >>> 0) % perm.length]
  }
  const smooth = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = smooth(x - x0)
    const fy = smooth(y - y0)
    const a = hash(x0, y0)
    const b = hash(x0 + 1, y0)
    const c = hash(x0, y0 + 1)
    const d = hash(x0 + 1, y0 + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
}

// ---- World data structure --------------------------------------------------
// Dense typed arrays for the hot layers (reference engine's own stated
// rule: "do not convert the world into per-tile JS objects"), a sparse Map
// for mining/wall damage since only actively-mined tiles ever have an
// entry. idx(x,y) = y*width + x, row-major.
interface MineWorldData {
  seed: number
  width: number
  height: number
  tiles: Uint8Array
  walls: Uint8Array
  surfaceY: Int16Array // first solid tile per column, cached
  damage: Map<number, number> // tileIndex -> 0..1 mining progress
}

const idx = (w: MineWorldData, x: number, y: number) => y * w.width + x
const inBounds = (w: MineWorldData, x: number, y: number) => x >= 0 && x < w.width && y >= 0 && y < w.height

function tileAt(w: MineWorldData, x: number, y: number): number {
  if (!inBounds(w, x, y)) return TILE.STONE // treat out-of-bounds as solid (world edge)
  return w.tiles[idx(w, x, y)]
}
function wallAt(w: MineWorldData, x: number, y: number): number {
  if (!inBounds(w, x, y)) return WALL.STONE
  return w.walls[idx(w, x, y)]
}
function isSolidAt(w: MineWorldData, x: number, y: number): boolean {
  const t = tileAt(w, x, y)
  return TILE_DEFS[t]?.solid ?? true
}
function isOpaqueAt(w: MineWorldData, x: number, y: number): boolean {
  const t = tileAt(w, x, y)
  return TILE_DEFS[t]?.opaque ?? true
}

function createEmptyWorld(seed: number, width = WORLD_W, height = WORLD_H): MineWorldData {
  return {
    seed,
    width,
    height,
    tiles: new Uint8Array(width * height),
    walls: new Uint8Array(width * height),
    surfaceY: new Int16Array(width).fill(height),
    damage: new Map()
  }
}

// ---- World generation --------------------------------------------------
// Deterministic named passes over one seeded RNG/noise field, same shape
// as the reference engine's terrain -> caves -> ore -> decoration ->
// validation pipeline (our own parameters/thresholds, not copied values).
const GEN = {
  surfaceBaseFrac: 0.26,
  surfaceAmplitude: 14,
  surfaceFreq: 0.045,
  dirtDepthBase: 7,
  dirtDepthAmp: 3,
  caveFreq: 0.08,
  caveThreshold: 0.82,
  caveMarginBelowSurface: 5,
  worms: 20,
  wormLenMin: 18,
  wormLenVar: 40,
  wormRadMin: 1.1,
  wormRadVar: 1.3,
  ores: [
    { tile: TILE.COAL_ORE, veins: 60, sizeMin: 3, sizeVar: 5, minDepth: 4, maxDepth: 999 },
    { tile: TILE.COPPER_ORE, veins: 48, sizeMin: 3, sizeVar: 4, minDepth: 4, maxDepth: 999 },
    { tile: TILE.IRON_ORE, veins: 34, sizeMin: 3, sizeVar: 4, minDepth: 14, maxDepth: 999 },
    { tile: TILE.GOLD_ORE, veins: 16, sizeMin: 2, sizeVar: 3, minDepth: 34, maxDepth: 999 }
  ],
  treeChance: 0.14,
  treeMinGap: 2
}

function genTerrainPass(w: MineWorldData, noise: (x: number, y: number) => number) {
  const dirtNoise = (x: number) => noise(x * 0.11 + 500, 0)
  for (let x = 0; x < w.width; x++) {
    const n = noise(x * GEN.surfaceFreq, 0) // 0..1
    const surfaceY = Math.round(w.height * GEN.surfaceBaseFrac + (n - 0.5) * 2 * GEN.surfaceAmplitude)
    w.surfaceY[x] = surfaceY
    const dirtDepth = Math.round(GEN.dirtDepthBase + (dirtNoise(x) - 0.5) * 2 * GEN.dirtDepthAmp)
    const stoneStartY = surfaceY + Math.max(2, dirtDepth)
    for (let y = 0; y < w.height; y++) {
      const i = idx(w, x, y)
      if (y < surfaceY) {
        w.tiles[i] = TILE.AIR
        w.walls[i] = WALL.NONE
      } else if (y === surfaceY) {
        w.tiles[i] = TILE.GRASS
        w.walls[i] = WALL.NONE
      } else if (y < stoneStartY) {
        w.tiles[i] = TILE.DIRT
        w.walls[i] = WALL.DIRT
      } else {
        w.tiles[i] = TILE.STONE
        w.walls[i] = WALL.STONE
      }
    }
  }
}

function genCavesPass(w: MineWorldData, noise: (x: number, y: number) => number, rand: () => number) {
  // Noise-threshold carving below a margin under the surface.
  for (let x = 0; x < w.width; x++) {
    const floor = w.surfaceY[x] + GEN.caveMarginBelowSurface
    for (let y = floor; y < w.height; y++) {
      const n = noise(x * GEN.caveFreq, y * GEN.caveFreq)
      if (n > GEN.caveThreshold) w.tiles[idx(w, x, y)] = TILE.AIR
    }
  }
  // Worm tunnels -- random-walk carved paths, length/radius jittered per
  // worm, independent of the threshold noise so caves read as an actual
  // connected network rather than pure static.
  const carveDisc = (cx: number, cy: number, r: number) => {
    const ri = Math.ceil(r)
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const x = Math.round(cx + dx)
        const y = Math.round(cy + dy)
        if (inBounds(w, x, y) && y > w.surfaceY[x] + 2) w.tiles[idx(w, x, y)] = TILE.AIR
      }
    }
  }
  for (let i = 0; i < GEN.worms; i++) {
    let x = Math.floor(rand() * w.width)
    let y = Math.floor(w.surfaceY[x] + GEN.caveMarginBelowSurface + rand() * (w.height - w.surfaceY[x] - GEN.caveMarginBelowSurface - 4))
    let heading = rand() * Math.PI * 2
    const len = GEN.wormLenMin + rand() * GEN.wormLenVar
    const rad = GEN.wormRadMin + rand() * GEN.wormRadVar
    for (let s = 0; s < len; s++) {
      heading += (rand() - 0.5) * 0.6
      x += Math.cos(heading) * 1.4
      y += Math.sin(heading) * 1.1
      if (!inBounds(w, Math.round(x), Math.round(y))) break
      carveDisc(x, y, rad * (0.7 + rand() * 0.6))
    }
  }
}

function genOrePass(w: MineWorldData, rand: () => number) {
  for (const ore of GEN.ores) {
    for (let v = 0; v < ore.veins; v++) {
      const x0 = Math.floor(rand() * w.width)
      const minY = Math.min(w.height - 2, (w.surfaceY[x0] || 0) + ore.minDepth)
      const maxY = Math.min(w.height - 2, (w.surfaceY[x0] || 0) + ore.maxDepth)
      if (maxY <= minY) continue
      let x = x0
      let y = Math.floor(minY + rand() * (maxY - minY))
      const size = Math.round(ore.sizeMin + rand() * ore.sizeVar)
      for (let s = 0; s < size; s++) {
        if (inBounds(w, x, y) && w.tiles[idx(w, x, y)] === TILE.STONE) {
          w.tiles[idx(w, x, y)] = ore.tile
        }
        x += Math.round((rand() - 0.5) * 2)
        y += Math.round((rand() - 0.5) * 2)
      }
    }
  }
}

function genDecorationPass(w: MineWorldData, rand: () => number) {
  let lastTreeX = -999
  for (let x = 2; x < w.width - 2; x++) {
    const sy = w.surfaceY[x]
    if (w.tiles[idx(w, x, sy)] !== TILE.GRASS) continue
    if (x - lastTreeX < GEN.treeMinGap) continue
    if (rand() > GEN.treeChance) continue
    // Capped at 4 tiles (see JUMP_VELOCITY comment) -- taller trunks could
    // wedge the player against them with no way over or around.
    const trunkH = 3 + Math.floor(rand() * 2)
    for (let t = 1; t <= trunkH; t++) {
      const ty = sy - t
      if (!inBounds(w, x, ty)) break
      w.tiles[idx(w, x, ty)] = TILE.WOOD
    }
    const topY = sy - trunkH
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) === 2 && dy !== 0) continue
        const lx = x + dx
        const ly = topY + dy
        if (inBounds(w, lx, ly) && w.tiles[idx(w, lx, ly)] === TILE.AIR) w.tiles[idx(w, lx, ly)] = TILE.LEAVES
      }
    }
    lastTreeX = x
  }
}

function findSpawnPoint(w: MineWorldData): { x: number; y: number } {
  const cx = Math.floor(w.width / 2)
  for (let x = cx; x < w.width - 2; x++) {
    const sy = w.surfaceY[x]
    if (sy > 2 && sy < w.height - 2) {
      return { x: x * TILE_SIZE + TILE_SIZE / 2, y: (sy - 2) * TILE_SIZE }
    }
  }
  return { x: cx * TILE_SIZE, y: 0 }
}

function generateWorld(seed: number, width = WORLD_W, height = WORLD_H): MineWorldData {
  const w = createEmptyWorld(seed, width, height)
  const rand = mulberry32(seed)
  const noise = makeNoise2D(seed)
  genTerrainPass(w, noise)
  genCavesPass(w, noise, rand)
  genOrePass(w, rand)
  genDecorationPass(w, rand)
  // validation pass: guarantee the spawn column is actually open air down
  // to its surface so the player never spawns embedded in stone.
  const cx = Math.floor(w.width / 2)
  for (let y = Math.max(0, w.surfaceY[cx] - 6); y < w.surfaceY[cx]; y++) {
    w.tiles[idx(w, cx, y)] = TILE.AIR
  }
  return w
}

// ---- Save/continue diffing -------------------------------------------------
// Generation is deterministic from `seed`, so only the sparse difference
// against a freshly-regenerated baseline needs to persist -- a session
// that digs a modest tunnel network touches a tiny fraction of a 180x110
// world. Walls are immutable in this version (no wall mining/placing), so
// there's nothing to diff there.
function computeTileDiffs(world: MineWorldData, baseline: MineWorldData): Record<string, number> {
  const diffs: Record<string, number> = {}
  for (let i = 0; i < world.tiles.length; i++) {
    if (world.tiles[i] !== baseline.tiles[i]) diffs[i] = world.tiles[i]
  }
  return diffs
}
function applyTileDiffs(world: MineWorldData, diffs: Record<string, number>) {
  for (const key in diffs) {
    const i = Number(key)
    if (Number.isInteger(i) && i >= 0 && i < world.tiles.length) world.tiles[i] = diffs[key]
  }
}

// ---- Procedural tile rendering --------------------------------------------
// No art assets -- a flat fill plus a cheap pattern function per tile, same
// "draw everything, nothing sourced" house style as this project's other
// games (Voronoi fragments, SVG crack lines, etc. in DestroyModeOverlay).
function cellHash(x: number, y: number, salt = 0): number {
  const h = (x * 374761393 + y * 668265263 + salt * 2654435761) ^ 0x9e3779b9
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

function drawWallCell(ctx: CanvasRenderingContext2D, wall: number, tx: number, ty: number, px: number, py: number, size: number) {
  const def = WALL_DEFS[wall]
  if (!def || def.colors.length === 0) return
  const h = cellHash(tx, ty, wall + 100)
  ctx.fillStyle = def.colors[Math.floor(h * def.colors.length) % def.colors.length]
  ctx.fillRect(px, py, size, size)
}

function drawTorch(ctx: CanvasRenderingContext2D, px: number, py: number, size: number) {
  const cx = px + size / 2
  ctx.fillStyle = '#6b4423'
  ctx.fillRect(cx - 1.5, py + size * 0.35, 3, size * 0.6)
  ctx.fillStyle = '#ffb84d'
  ctx.beginPath()
  ctx.ellipse(cx, py + size * 0.22, 4, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff3c4'
  ctx.beginPath()
  ctx.ellipse(cx, py + size * 0.2, 2, 3.5, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawTileCell(ctx: CanvasRenderingContext2D, tile: number, tx: number, ty: number, px: number, py: number, size: number) {
  const def = TILE_DEFS[tile]
  if (!def || def.colors.length === 0) return
  const h = cellHash(tx, ty, tile)
  ctx.fillStyle = def.colors[Math.floor(h * def.colors.length) % def.colors.length]
  ctx.fillRect(px, py, size, size)
  switch (def.pattern) {
    case 'speckle': {
      const dots = 3 + Math.floor(cellHash(tx, ty, 1) * 3)
      for (let i = 0; i < dots; i++) {
        const dh = cellHash(tx * 7 + i, ty * 13 + i, 2)
        const dx = cellHash(tx, ty, 10 + i) * size
        const dy = cellHash(tx, ty, 20 + i) * size
        ctx.fillStyle = def.colors[Math.floor(dh * def.colors.length) % def.colors.length]
        ctx.fillRect(px + dx, py + dy, 2, 2)
      }
      break
    }
    case 'grain': {
      ctx.globalAlpha = 0.45
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = def.colors[Math.floor(cellHash(tx, ty, 90 + i) * def.colors.length)]
        const gy = py + ((i + 0.5) / 3) * size + (cellHash(tx, ty, 30 + i) - 0.5) * 3
        ctx.beginPath()
        ctx.moveTo(px, gy)
        ctx.lineTo(px + size, gy)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      break
    }
    case 'ore': {
      const ocx = px + size / 2 + (cellHash(tx, ty, 40) - 0.5) * size * 0.4
      const ocy = py + size / 2 + (cellHash(tx, ty, 41) - 0.5) * size * 0.4
      ctx.fillStyle = def.colors[1] || def.colors[0]
      ctx.beginPath()
      ctx.arc(ocx, ocy, size * 0.22, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = def.colors[2] || def.colors[0]
      ctx.beginPath()
      ctx.arc(ocx - size * 0.15, ocy + size * 0.12, size * 0.12, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'leafy': {
      for (let i = 0; i < 4; i++) {
        const bx = px + cellHash(tx, ty, 50 + i) * size
        const by = py + cellHash(tx, ty, 60 + i) * size
        ctx.fillStyle = def.colors[Math.floor(cellHash(tx, ty, 70 + i) * def.colors.length)]
        ctx.beginPath()
        ctx.arc(bx, by, size * 0.24, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'grid': {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.lineWidth = 1
      ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1)
      break
    }
    case 'glass': {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.moveTo(px + size * 0.15, py + size * 0.85)
      ctx.lineTo(px + size * 0.4, py + size * 0.15)
      ctx.lineTo(px + size * 0.55, py + size * 0.15)
      ctx.lineTo(px + size * 0.3, py + size * 0.85)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1)
      break
    }
    default:
      break
  }
}

// Cumulative 4-stage crack overlay, same idea as the reference engine's
// hand-authored polyline segments revealed in stages as mining progress
// increases -- our own segment layout, drawn as a per-frame overlay (NOT
// baked into the cached chunk bitmap, since damage changes every tick
// while actively mined and re-rebuilding the whole chunk for that would
// defeat the point of caching it).
const CRACK_SEGMENTS: [number, number][][] = [
  [
    [0.5, 0.1],
    [0.4, 0.4],
    [0.5, 0.7]
  ],
  [
    [0.5, 0.7],
    [0.7, 0.5],
    [0.85, 0.3]
  ],
  [
    [0.4, 0.4],
    [0.15, 0.55],
    [0.1, 0.85]
  ],
  [
    [0.5, 0.1],
    [0.65, 0.3],
    [0.9, 0.15]
  ]
]
function drawCrackOverlay(ctx: CanvasRenderingContext2D, frac: number, px: number, py: number, size: number) {
  if (frac <= 0) return
  const stage = frac >= 1 ? 4 : frac >= 0.75 ? 3 : frac >= 0.5 ? 2 : frac >= 0.25 ? 1 : 0
  if (stage === 0) return
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'
  ctx.lineWidth = 1.3
  for (let i = 0; i < stage; i++) {
    const seg = CRACK_SEGMENTS[i]
    ctx.beginPath()
    ctx.moveTo(px + seg[0][0] * size, py + seg[0][1] * size)
    for (let j = 1; j < seg.length; j++) ctx.lineTo(px + seg[j][0] * size, py + seg[j][1] * size)
    ctx.stroke()
  }
}

// ---- Chunk canvas cache ------------------------------------------------
// One real <canvas> bitmap per CHUNK_TILES-square chunk, full-redrawn only
// when dirty, budgeted to a handful of rebuilds per frame nearest-camera-
// first -- never rebuild everything at once. Same technique the reference
// engine uses for its own chunk renderer, our own implementation.
interface Chunk {
  cx: number
  cy: number
  canvas: HTMLCanvasElement
  dirty: boolean
}
const CHUNK_REBUILDS_PER_FRAME = 3

function chunkKey(cx: number, cy: number) {
  return cx + ',' + cy
}

function getOrCreateChunk(chunks: Map<string, Chunk>, cx: number, cy: number): Chunk {
  const key = chunkKey(cx, cy)
  let c = chunks.get(key)
  if (!c) {
    const canvas = document.createElement('canvas')
    canvas.width = CHUNK_TILES * TILE_SIZE
    canvas.height = CHUNK_TILES * TILE_SIZE
    c = { cx, cy, canvas, dirty: true }
    chunks.set(key, c)
  }
  return c
}

function markChunkDirtyAt(chunks: Map<string, Chunk>, tx: number, ty: number) {
  const cx = Math.floor(tx / CHUNK_TILES)
  const cy = Math.floor(ty / CHUNK_TILES)
  const c = chunks.get(chunkKey(cx, cy))
  if (c) c.dirty = true
}

function rebuildChunk(world: MineWorldData, chunk: Chunk) {
  const ctx = chunk.canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, chunk.canvas.width, chunk.canvas.height)
  const x0 = chunk.cx * CHUNK_TILES
  const y0 = chunk.cy * CHUNK_TILES
  for (let ly = 0; ly < CHUNK_TILES; ly++) {
    const ty = y0 + ly
    if (ty >= world.height) break
    for (let lx = 0; lx < CHUNK_TILES; lx++) {
      const tx = x0 + lx
      if (tx >= world.width) break
      const px = lx * TILE_SIZE
      const py = ly * TILE_SIZE
      const tile = world.tiles[idx(world, tx, ty)]
      const def = TILE_DEFS[tile]
      if (!def || !def.solid) {
        const wall = world.walls[idx(world, tx, ty)]
        if (wall !== WALL.NONE) drawWallCell(ctx, wall, tx, ty, px, py, TILE_SIZE)
      }
      if (tile === TILE.TORCH) {
        drawTorch(ctx, px, py, TILE_SIZE)
      } else if (tile !== TILE.AIR) {
        drawTileCell(ctx, tile, tx, ty, px, py, TILE_SIZE)
      }
    }
  }
  chunk.dirty = false
}

interface Camera {
  x: number
  y: number
}

function clampCamera(camera: Camera, world: MineWorldData, viewportW: number, viewportH: number) {
  const worldPxW = world.width * TILE_SIZE
  const worldPxH = world.height * TILE_SIZE
  camera.x = Math.max(0, Math.min(worldPxW - viewportW, camera.x))
  camera.y = Math.max(0, Math.min(worldPxH - viewportH, camera.y))
}

function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: MineWorldData,
  chunks: Map<string, Chunk>,
  camera: Camera,
  viewportW: number,
  viewportH: number
) {
  const chunkPx = CHUNK_TILES * TILE_SIZE
  const camChunkX = Math.floor(camera.x / chunkPx)
  const camChunkY = Math.floor(camera.y / chunkPx)
  const chunksX = Math.ceil(viewportW / chunkPx) + 1
  const chunksY = Math.ceil(viewportH / chunkPx) + 1
  const maxChunkX = Math.ceil(world.width / CHUNK_TILES)
  const maxChunkY = Math.ceil(world.height / CHUNK_TILES)

  const visible: Chunk[] = []
  for (let cy = camChunkY - 1; cy <= camChunkY + chunksY; cy++) {
    if (cy < 0 || cy >= maxChunkY) continue
    for (let cx = camChunkX - 1; cx <= camChunkX + chunksX; cx++) {
      if (cx < 0 || cx >= maxChunkX) continue
      visible.push(getOrCreateChunk(chunks, cx, cy))
    }
  }

  const dirty = visible.filter((c) => c.dirty)
  dirty.sort((a, b) => (a.cx - camChunkX) ** 2 + (a.cy - camChunkY) ** 2 - ((b.cx - camChunkX) ** 2 + (b.cy - camChunkY) ** 2))
  for (let i = 0; i < Math.min(CHUNK_REBUILDS_PER_FRAME, dirty.length); i++) {
    rebuildChunk(world, dirty[i])
  }

  for (const c of visible) {
    const sx = c.cx * chunkPx - camera.x
    const sy = c.cy * chunkPx - camera.y
    ctx.drawImage(c.canvas, Math.round(sx), Math.round(sy))
  }
}

// ---- Player physics ------------------------------------------------------
// Separated-axis AABB-vs-tilemap resolve (move X, resolve X; move Y,
// resolve Y independently) -- the reference engine's own technique, with
// one deliberate simplification: it corner-samples a handful of points to
// avoid a full rect-vs-grid scan; our hitbox only ever spans ~1x2 tiles, so
// a direct small-range double loop (rectCollides below) is simpler, just
// as cheap, and has no sampling-gap edge cases to worry about.
const PLAYER_W = 18
const PLAYER_H = 38
const MAX_FALL_SPEED = 900

function rectCollides(world: MineWorldData, x: number, y: number, w: number, h: number): boolean {
  const left = Math.floor(x / TILE_SIZE)
  const right = Math.floor((x + w - 0.01) / TILE_SIZE)
  const top = Math.floor(y / TILE_SIZE)
  const bottom = Math.floor((y + h - 0.01) / TILE_SIZE)
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolidAt(world, tx, ty)) return true
    }
  }
  return false
}

interface PlayerPhysics {
  x: number // world px, top-left of hitbox
  y: number
  vx: number
  vy: number
  onGround: boolean
}

// Steps toward the target in small increments and stops at the last clear
// position -- bounded iteration count since per-frame movement is small
// relative to tile size (fall speed is capped), same reasoning the
// reference engine uses to justify cheap small-step collision resolve.
function moveAxis(world: MineWorldData, p: PlayerPhysics, axis: 'x' | 'y', delta: number) {
  if (delta === 0) return
  const dir = Math.sign(delta)
  const stepSize = 2 * dir
  let moved = 0
  while (Math.abs(moved) < Math.abs(delta)) {
    const remaining = delta - moved
    const step = Math.abs(stepSize) > Math.abs(remaining) ? remaining : stepSize
    const testX = axis === 'x' ? p.x + moved + step : p.x
    const testY = axis === 'y' ? p.y + moved + step : p.y
    if (rectCollides(world, testX, testY, PLAYER_W, PLAYER_H)) {
      if (axis === 'y') p.vy = 0
      else p.vx = 0
      break
    }
    moved += step
  }
  if (axis === 'x') p.x += moved
  else p.y += moved
}

// Auto-step a single tile when grounded and blocked -- without this,
// terrain's natural noise-driven bumps (everywhere, by construction) stop
// the player dead every step and force constant jumping, which reads as
// broken rather than deliberate. Needs clear headroom at the lifted
// height both at the current x (nothing overhead) and the destination x
// (the far side is actually open, not a wall taller than one tile).
function tryStepUp(world: MineWorldData, p: PlayerPhysics, dx: number): boolean {
  const liftedY = p.y - TILE_SIZE
  if (rectCollides(world, p.x, liftedY, PLAYER_W, PLAYER_H)) return false
  if (rectCollides(world, p.x + dx, liftedY, PLAYER_W, PLAYER_H)) return false
  p.y = liftedY
  p.x += dx
  return true
}

function stepPlayerPhysics(world: MineWorldData, p: PlayerPhysics, inputX: number, wantJump: boolean, dt: number) {
  p.vx = inputX * MOVE_SPEED
  p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL_SPEED)
  if (wantJump && p.onGround) {
    p.vy = JUMP_VELOCITY
    p.onGround = false
  }
  const dx = p.vx * dt
  if (dx !== 0) {
    if (!rectCollides(world, p.x + dx, p.y, PLAYER_W, PLAYER_H)) {
      p.x += dx
    } else if (!p.onGround || !tryStepUp(world, p, dx)) {
      moveAxis(world, p, 'x', dx)
    }
  }
  moveAxis(world, p, 'y', p.vy * dt)
  // Ground probe -- re-checked every frame regardless of whether this
  // frame's Y resolve actually collided, so walking off a ledge correctly
  // goes airborne next frame rather than only on the next downward hit.
  p.onGround = rectCollides(world, p.x, p.y + PLAYER_H + 1, PLAYER_W, 1)
  p.x = Math.max(0, Math.min(world.width * TILE_SIZE - PLAYER_W, p.x))
  if (p.y < 0) {
    p.y = 0
    p.vy = 0
  }
}

// ---- Lighting ------------------------------------------------------------
// Greyscale flood fill -- the reference engine tracks 3 separate RGB
// channels over a camera-window-sized grid with halo-bounded incremental
// recompute on edit; both simplified here since our world is small enough
// (180x110 = ~20k cells) to just hold one Float32Array for the whole world
// and recompute it fully on every mine/place, rather than windowing to the
// viewport or doing halo-bounded partial recomputes. Single channel (no
// colored light sources in v1) still reads as real lighting.
const LIGHT_DECAY_AIR = 0.09
const LIGHT_DECAY_OPAQUE = 0.32
const LIGHT_SKY = 1.0

function computeLighting(world: MineWorldData): Float32Array {
  const light = new Float32Array(world.width * world.height)
  const queue: number[] = []

  // Sky light: scan each column down from the top, lighting everything
  // above the first opaque tile. The BFS pass below spreads this sideways/
  // down into any connected caves through decaying air.
  for (let x = 0; x < world.width; x++) {
    for (let y = 0; y < world.height; y++) {
      if (isOpaqueAt(world, x, y)) break
      const i = idx(world, x, y)
      light[i] = LIGHT_SKY
      queue.push(i)
    }
  }
  // Emissive tiles (torches).
  for (let i = 0; i < world.tiles.length; i++) {
    const def = TILE_DEFS[world.tiles[i]]
    if (def?.light && def.light > light[i]) {
      light[i] = def.light
      queue.push(i)
    }
  }

  let qi = 0
  while (qi < queue.length) {
    const i = queue[qi++]
    const cur = light[i]
    if (cur <= 0.02) continue
    const x = i % world.width
    const y = (i / world.width) | 0
    const neighbors: [number, number][] = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1]
    ]
    for (const [nx, ny] of neighbors) {
      if (!inBounds(world, nx, ny)) continue
      const ni = idx(world, nx, ny)
      const decay = isOpaqueAt(world, nx, ny) ? LIGHT_DECAY_OPAQUE : LIGHT_DECAY_AIR
      const next = cur - decay
      if (next > light[ni]) {
        light[ni] = next
        queue.push(ni)
      }
    }
  }
  return light
}

function renderLighting(ctx: CanvasRenderingContext2D, world: MineWorldData, light: Float32Array, camera: Camera, viewportW: number, viewportH: number) {
  const tx0 = Math.max(0, Math.floor(camera.x / TILE_SIZE))
  const ty0 = Math.max(0, Math.floor(camera.y / TILE_SIZE))
  const tx1 = Math.min(world.width - 1, Math.ceil((camera.x + viewportW) / TILE_SIZE))
  const ty1 = Math.min(world.height - 1, Math.ceil((camera.y + viewportH) / TILE_SIZE))
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const dark = Math.max(0, Math.min(1, 1 - light[idx(world, tx, ty)]))
      if (dark <= 0.02) continue
      const sx = Math.floor(tx * TILE_SIZE - camera.x) - 1
      const sy = Math.floor(ty * TILE_SIZE - camera.y) - 1
      ctx.fillStyle = `rgba(2,4,14,${dark.toFixed(2)})`
      ctx.fillRect(sx, sy, TILE_SIZE + 2, TILE_SIZE + 2)
    }
  }
}

// ---- Mining + building ---------------------------------------------------
// Inventory is just itemId -> count. One mutation path for writing a tile
// (setTileMined/setTilePlaced below call this) so chunk-dirty always fans
// out consistently, same principle as the reference engine's single
// World.set()-style seam -- here it's small enough to just be "always mark
// the chunk dirty after touching world.tiles," no separate lighting-dirty
// yet (that lands with the lighting pass).
type Inventory = Record<string, number>

function addItem(inv: Inventory, itemId: string, n: number) {
  inv[itemId] = (inv[itemId] || 0) + n
}
function removeItem(inv: Inventory, itemId: string, n: number): boolean {
  if ((inv[itemId] || 0) < n) return false
  inv[itemId] -= n
  if (inv[itemId] <= 0) delete inv[itemId]
  return true
}

function writeTile(world: MineWorldData, chunks: Map<string, Chunk>, tx: number, ty: number, tile: number) {
  const i = idx(world, tx, ty)
  world.tiles[i] = tile
  world.damage.delete(i)
  markChunkDirtyAt(chunks, tx, ty)
}

function inReach(player: PlayerPhysics, tx: number, ty: number): boolean {
  const px = player.x + PLAYER_W / 2
  const py = player.y + PLAYER_H / 2
  const tcx = tx * TILE_SIZE + TILE_SIZE / 2
  const tcy = ty * TILE_SIZE + TILE_SIZE / 2
  return Math.hypot(tcx - px, tcy - py) <= REACH_PX
}

// Called every tick the mouse is held on a valid target. Returns 'broke'
// the instant it crosses 1.0 damage (caller handles the drop + inventory
// add), 'progress' while still chipping away, or 'invalid' for an out-of-
// reach/too-hard/already-air target -- caller uses this to decide whether
// to keep accumulating or bail (e.g. stop the mining sound).
function tickMining(world: MineWorldData, player: PlayerPhysics, toolPower: number, tx: number, ty: number, dt: number): 'broke' | 'progress' | 'invalid' {
  if (!inBounds(world, tx, ty)) return 'invalid'
  const tileId = world.tiles[idx(world, tx, ty)]
  if (tileId === TILE.AIR) return 'invalid'
  const def = TILE_DEFS[tileId]
  if (!def || def.minPower > toolPower) return 'invalid'
  if (!inReach(player, tx, ty)) return 'invalid'
  const i = idx(world, tx, ty)
  const prev = world.damage.get(i) || 0
  const next = prev + (toolPower / 100) * (dt / Math.max(0.05, def.hardness))
  if (next >= 1) {
    world.damage.delete(i)
    return 'broke'
  }
  world.damage.set(i, next)
  return 'progress'
}

function playerOverlapsTile(player: PlayerPhysics, tx: number, ty: number): boolean {
  const left = tx * TILE_SIZE
  const top = ty * TILE_SIZE
  return player.x < left + TILE_SIZE && player.x + PLAYER_W > left && player.y < top + TILE_SIZE && player.y + PLAYER_H > top
}

function tryPlace(world: MineWorldData, chunks: Map<string, Chunk>, inventory: Inventory, player: PlayerPhysics, itemId: string, tx: number, ty: number): boolean {
  const item = ITEM_DEFS[itemId]
  if (!item || item.kind !== 'block' || item.tile === undefined) return false
  if ((inventory[itemId] || 0) < 1) return false
  if (!inBounds(world, tx, ty)) return false
  if (!inReach(player, tx, ty)) return false
  const existing = world.tiles[idx(world, tx, ty)]
  const existingDef = TILE_DEFS[existing]
  if (existing !== TILE.AIR && !existingDef?.replaceable) return false
  const targetDef = TILE_DEFS[item.tile]
  if (targetDef?.solid && playerOverlapsTile(player, tx, ty)) return false
  if (targetDef?.needsSupport) {
    const supported = isSolidAt(world, tx - 1, ty) || isSolidAt(world, tx + 1, ty) || isSolidAt(world, tx, ty - 1) || isSolidAt(world, tx, ty + 1)
    if (!supported) return false
  }
  removeItem(inventory, itemId, 1)
  writeTile(world, chunks, tx, ty, item.tile)
  return true
}

// ---- Component -------------------------------------------------------
export default function MineWorldGame({ visitorId, onClose }: { visitorId: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<MineWorldData | null>(null)
  const chunksRef = useRef<Map<string, Chunk>>(new Map())
  const lightRef = useRef<Float32Array | null>(null)
  const cameraRef = useRef<Camera>({ x: 0, y: 0 })
  const playerRef = useRef<PlayerPhysics>({ x: 0, y: 0, vx: 0, vy: 0, onGround: false })
  const depthReachedRef = useRef(0)
  const keysRef = useRef<Set<string>>(new Set())
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const [ready, setReady] = useState(false)

  // Mining/building state. Inventory starts with just a basic pickaxe --
  // everything else is earned by digging. selectedItemRef is which hotbar
  // entry is "equipped"; a tool id mines, a block id places. Full visual
  // hotbar lands in the next pass -- number keys already drive selection
  // so that lands on top of working state, not instead of it.
  const mouseRef = useRef({ x: 0, y: 0 })
  const miningRef = useRef(false)
  const placingRef = useRef(false)
  const inventoryRef = useRef<Inventory>({ pickaxeCopper: 1 })
  const selectedItemRef = useRef<string>('pickaxeCopper')
  const lastPlaceRef = useRef(0)
  const [, forceRender] = useState(0)
  const [craftOpen, setCraftOpen] = useState(false)

  // Touch support -- the control scheme above (mousemove targets a tile,
  // held mousedown mines it) has no touch equivalent by default, so touch
  // devices get an on-screen d-pad/jump for movement plus a dedicated
  // world-touch tracked by identifier (so a thumb holding Jump and a thumb
  // mining a tile don't steal each other's touch). placeModeRef swaps what
  // that world touch does, standing in for the right-click placing has on
  // desktop.
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const touchLeftRef = useRef(false)
  const touchRightRef = useRef(false)
  const touchJumpRef = useRef(false)
  const placeModeRef = useRef(false)
  const [placeModeOn, setPlaceModeOn] = useState(false)
  const worldTouchIdRef = useRef<number | null>(null)

  // Depth HUD -- measured in tiles below this column's surface, not raw
  // world-y, so it reads the same near a hill or a valley. Only pushed to
  // state when the rounded value actually changes so the HUD doesn't force
  // a React re-render every animation frame.
  const [depthText, setDepthText] = useState('Surface')
  const depthDisplayRef = useRef('Surface')

  // Regenerates the deterministic baseline from the world's own seed and
  // diffs the live tiles against it -- see computeTileDiffs. Fire-and-
  // forget; a dropped autosave tick isn't worth blocking gameplay over,
  // and the next tick (or the unmount save below) covers it.
  const saveWorld = useCallback(() => {
    const world = worldRef.current
    if (!world) return
    const baseline = generateWorld(world.seed, world.width, world.height)
    const tileDiffs = computeTileDiffs(world, baseline)
    const p = playerRef.current
    fetch('/api/mineworld/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId,
        seed: world.seed,
        width: world.width,
        height: world.height,
        tileDiffs,
        playerX: p.x,
        playerY: p.y,
        inventory: inventoryRef.current,
        depthReached: depthReachedRef.current
      })
    }).catch(() => {})
  }, [visitorId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let world: MineWorldData
      let spawnPlayer = true

      try {
        const res = await fetch(`/api/mineworld/load?visitorId=${encodeURIComponent(visitorId)}`)
        const data = res.ok ? await res.json() : null
        if (data?.world) {
          const saved = data.world
          world = generateWorld(saved.seed, saved.width, saved.height)
          applyTileDiffs(world, saved.tileDiffs || {})
          if (Number.isFinite(saved.playerX) && Number.isFinite(saved.playerY)) {
            playerRef.current = { x: saved.playerX, y: saved.playerY, vx: 0, vy: 0, onGround: false }
            spawnPlayer = false
          }
          if (saved.inventory && typeof saved.inventory === 'object') {
            inventoryRef.current = { pickaxeCopper: 1, ...saved.inventory }
          }
          depthReachedRef.current = Number(saved.depthReached) || 0
        } else {
          world = generateWorld(Math.floor(Math.random() * 1e9))
        }
      } catch {
        world = generateWorld(Math.floor(Math.random() * 1e9))
      }

      if (cancelled) return
      worldRef.current = world
      lightRef.current = computeLighting(world)
      if (spawnPlayer) {
        const spawn = findSpawnPoint(world)
        playerRef.current = { x: spawn.x - PLAYER_W / 2, y: spawn.y, vx: 0, vy: 0, onGround: false }
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [visitorId])

  // Periodic autosave, plus one final save on unmount -- covers both the
  // explicit Close button and the games hub swapping this overlay out for
  // another game, since both just unmount this component.
  useEffect(() => {
    if (!ready) return
    const id = setInterval(saveWorld, 15000)
    return () => {
      clearInterval(id)
      saveWorld()
    }
  }, [ready, saveWorld])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase())
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= 9) {
        // Same order the hotbar renders in -- owned items plus the
        // starting pickaxe, so "press 1" always matches "slot 1 onscreen."
        const inv = inventoryRef.current
        const owned = Object.keys(ITEM_DEFS).filter((id) => id === 'pickaxeCopper' || (inv[id] || 0) > 0)
        if (n <= owned.length) {
          selectedItemRef.current = owned[n - 1]
          forceRender((v) => v + 1)
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onDown = (e: MouseEvent) => {
      if (e.button === 0) miningRef.current = true
      if (e.button === 2) placingRef.current = true
    }
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) miningRef.current = false
      if (e.button === 2) placingRef.current = false
    }
    const onContextMenu = (e: MouseEvent) => e.preventDefault()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('contextmenu', onContextMenu)
    }
  }, [ready])

  useEffect(() => {
    setIsTouchDevice(typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0))
  }, [])

  // World-interaction touch -- a tap-and-hold directly on the canvas mines
  // (or places, in place-mode) the tile under the finger, dragging re-
  // targets same as a held mouse would. On-screen buttons call
  // stopPropagation in their own React touch handlers so their presses
  // never reach these window listeners -- that's what lets one thumb hold
  // Jump while another thumb is mid-dig. preventDefault here (not passive)
  // stops the page from scrolling/zooming and keeps the browser from
  // synthesizing a trailing ghost mousedown/mouseup for this same touch.
  useEffect(() => {
    if (!ready) return
    const canvas = canvasRef.current
    if (!canvas) return
    const updateTargetFromTouch = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    const onTouchStart = (e: TouchEvent) => {
      if (worldTouchIdRef.current !== null) return
      const touch = e.changedTouches[0]
      if (!touch) return
      e.preventDefault()
      worldTouchIdRef.current = touch.identifier
      updateTargetFromTouch(touch)
      if (placeModeRef.current) placingRef.current = true
      else miningRef.current = true
    }
    const onTouchMove = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === worldTouchIdRef.current) {
          e.preventDefault()
          updateTargetFromTouch(touch)
        }
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === worldTouchIdRef.current) {
          worldTouchIdRef.current = null
          miningRef.current = false
          placingRef.current = false
        }
      }
    }
    window.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: false })
    window.addEventListener('touchcancel', onTouchEnd, { passive: false })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loop = (t: number) => {
      const world = worldRef.current
      if (!world) return
      const dt = Math.min(0.05, (t - (lastTimeRef.current || t)) / 1000)
      lastTimeRef.current = t

      const keys = keysRef.current
      let inputX = 0
      if (keys.has('a') || keys.has('arrowleft') || touchLeftRef.current) inputX -= 1
      if (keys.has('d') || keys.has('arrowright') || touchRightRef.current) inputX += 1
      const wantJump = keys.has(' ') || keys.has('w') || keys.has('arrowup') || touchJumpRef.current

      stepPlayerPhysics(world, playerRef.current, inputX, wantJump, dt)
      depthReachedRef.current = Math.max(depthReachedRef.current, Math.floor(playerRef.current.y / TILE_SIZE))

      const playerCol = Math.floor((playerRef.current.x + PLAYER_W / 2) / TILE_SIZE)
      const surfaceAtCol = world.surfaceY[Math.max(0, Math.min(world.width - 1, playerCol))] || 0
      const tilesDeep = Math.floor(playerRef.current.y / TILE_SIZE) - surfaceAtCol
      const nextDepthText = tilesDeep <= 0 ? 'Surface' : `${tilesDeep * 3} ft deep`
      if (nextDepthText !== depthDisplayRef.current) {
        depthDisplayRef.current = nextDepthText
        setDepthText(nextDepthText)
      }

      const camera = cameraRef.current
      const p = playerRef.current
      camera.x = p.x + PLAYER_W / 2 - canvas.width / 2
      camera.y = p.y + PLAYER_H / 2 - canvas.height / 2
      clampCamera(camera, world, canvas.width, canvas.height)

      const mouse = mouseRef.current
      const targetTx = Math.floor((camera.x + mouse.x) / TILE_SIZE)
      const targetTy = Math.floor((camera.y + mouse.y) / TILE_SIZE)
      const inv = inventoryRef.current
      const selectedId = selectedItemRef.current
      const selectedItem = ITEM_DEFS[selectedId]

      if (miningRef.current && selectedItem?.kind === 'tool') {
        const result = tickMining(world, p, selectedItem.power ?? 0, targetTx, targetTy, dt)
        if (result === 'broke') {
          const tileId = world.tiles[idx(world, targetTx, targetTy)]
          const dropId = TILE_DROP_ITEM[tileId]
          if (dropId) addItem(inv, dropId, 1)
          writeTile(world, chunksRef.current, targetTx, targetTy, TILE.AIR)
          lightRef.current = computeLighting(world)
          forceRender((v) => v + 1)
        }
      }
      if (placingRef.current && selectedItem?.kind === 'block' && t - lastPlaceRef.current > 150) {
        if (tryPlace(world, chunksRef.current, inv, p, selectedId, targetTx, targetTy)) {
          lastPlaceRef.current = t
          lightRef.current = computeLighting(world)
          forceRender((v) => v + 1)
        }
      }

      ctx.fillStyle = '#16213a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      renderWorld(ctx, world, chunksRef.current, camera, canvas.width, canvas.height)
      if (lightRef.current) renderLighting(ctx, world, lightRef.current, camera, canvas.width, canvas.height)

      const screenX = Math.round(p.x - camera.x)
      const screenY = Math.round(p.y - camera.y)
      ctx.fillStyle = '#39ff14'
      ctx.fillRect(screenX, screenY, PLAYER_W, PLAYER_H)
      ctx.fillStyle = '#0a1a0a'
      ctx.fillRect(screenX + 3, screenY + 6, 4, 4)
      ctx.fillRect(screenX + PLAYER_W - 7, screenY + 6, 4, 4)

      // Target-tile highlight + crack overlay -- drawn fresh every frame
      // (not baked into the chunk cache, same reasoning as the crack
      // overlay itself: this changes constantly and shouldn't force a
      // chunk rebuild just to show it).
      if (inReach(p, targetTx, targetTy) && inBounds(world, targetTx, targetTy)) {
        const hx = targetTx * TILE_SIZE - camera.x
        const hy = targetTy * TILE_SIZE - camera.y
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 2
        ctx.strokeRect(hx + 1, hy + 1, TILE_SIZE - 2, TILE_SIZE - 2)
        const dmg = world.damage.get(idx(world, targetTx, targetTy)) || 0
        if (dmg > 0) drawCrackOverlay(ctx, dmg, hx, hy, TILE_SIZE)
      }


      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [ready])

  const inv = inventoryRef.current
  const ownedIds = Object.keys(ITEM_DEFS).filter((id) => id === 'pickaxeCopper' || (inv[id] || 0) > 0)
  const craftables = Object.values(ITEM_DEFS).filter((it) => it.recipe)

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black [touch-action:none]" onClick={(e) => e.stopPropagation()}>
      <canvas ref={canvasRef} className="block [touch-action:none]" />
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        Close ✕
      </button>
      <button
        onClick={() => setCraftOpen((v) => !v)}
        className="fixed top-4 left-4 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        🛠️ Craft
      </button>

      {/* Depth HUD -- "ft" is 3x tiles, a cosmetic unit conversion only
          (TILE_SIZE itself is unrelated to it), just so the number reads
          like the genre-standard depth readout instead of a raw tile count. */}
      <div className="pointer-events-none fixed top-4 left-1/2 z-[110] -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
        {depthText === 'Surface' ? '☀️ Surface' : `⛏️ ${depthText}`}
      </div>

      {/* Touch controls -- only rendered on touch devices so desktop stays
          exactly as before. Movement/jump are hold buttons (press state
          lives in refs, read every frame in the loop); Place is a tap
          toggle that changes what a world touch does. All three stop
          propagation so their presses never reach the window-level touch
          listeners that drive mining/placing on the canvas itself. */}
      {isTouchDevice && (
        <>
          <div className="pointer-events-auto fixed bottom-24 left-4 z-[110] flex items-end gap-3">
            <button
              onTouchStart={(e) => {
                e.stopPropagation()
                touchLeftRef.current = true
              }}
              onTouchEnd={(e) => {
                e.stopPropagation()
                touchLeftRef.current = false
              }}
              onTouchCancel={(e) => {
                e.stopPropagation()
                touchLeftRef.current = false
              }}
              className="flex h-16 w-16 select-none items-center justify-center rounded-full border border-white/20 bg-black/60 text-2xl text-white active:bg-white/20 [touch-action:none]"
            >
              ◀
            </button>
            <button
              onTouchStart={(e) => {
                e.stopPropagation()
                touchRightRef.current = true
              }}
              onTouchEnd={(e) => {
                e.stopPropagation()
                touchRightRef.current = false
              }}
              onTouchCancel={(e) => {
                e.stopPropagation()
                touchRightRef.current = false
              }}
              className="flex h-16 w-16 select-none items-center justify-center rounded-full border border-white/20 bg-black/60 text-2xl text-white active:bg-white/20 [touch-action:none]"
            >
              ▶
            </button>
          </div>

          <button
            onTouchStart={(e) => {
              e.stopPropagation()
              touchJumpRef.current = true
            }}
            onTouchEnd={(e) => {
              e.stopPropagation()
              touchJumpRef.current = false
            }}
            onTouchCancel={(e) => {
              e.stopPropagation()
              touchJumpRef.current = false
            }}
            className="pointer-events-auto fixed right-4 bottom-40 z-[110] flex h-16 w-16 select-none items-center justify-center rounded-full border border-white/20 bg-black/60 text-xs font-semibold text-white active:bg-white/20 [touch-action:none]"
          >
            JUMP
          </button>

          <button
            onClick={() => {
              placeModeRef.current = !placeModeRef.current
              setPlaceModeOn(placeModeRef.current)
            }}
            className={`pointer-events-auto fixed right-4 bottom-24 z-[110] flex h-16 w-16 select-none flex-col items-center justify-center rounded-full border text-[11px] font-semibold text-white [touch-action:none] ${
              placeModeOn ? 'border-accent bg-accent/30' : 'border-white/20 bg-black/60'
            }`}
          >
            <span>{placeModeOn ? '🧱' : '⛏️'}</span>
            <span>{placeModeOn ? 'Place' : 'Mine'}</span>
          </button>
        </>
      )}

      {/* Hotbar -- shows owned items (+ the starting pickaxe always), number
          keys 1-9 or a click select, same visual language as the destroy-
          mode hotbar elsewhere in this game: a row of bordered slots,
          white border on the selected one. */}
      <div className="pointer-events-auto fixed bottom-4 left-1/2 z-[110] flex -translate-x-1/2 gap-1.5 rounded-xl border border-white/10 bg-black/70 p-1.5 backdrop-blur-sm">
        {ownedIds.map((id, i) => {
          const item = ITEM_DEFS[id]
          const selected = selectedItemRef.current === id
          return (
            <button
              key={id}
              onClick={() => {
                selectedItemRef.current = id
                forceRender((v) => v + 1)
              }}
              title={item.name}
              className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg border text-[10px] text-white/80 ${
                selected ? 'border-white bg-white/10' : 'border-white/15 bg-black/40'
              }`}
            >
              <span className="text-[9px] text-white/40">{i + 1}</span>
              <span className="h-5 w-5 rounded-sm" style={{ background: item.color }} />
              <span>{inv[id] || (item.kind === 'tool' ? '' : 0)}</span>
            </button>
          )
        })}
      </div>

      {/* Crafting panel -- simple list, one recipe per row, instant
          conversion (no furnace subsystem -- see header comment on scope). */}
      {craftOpen && (
        <div
          className="pointer-events-auto fixed top-16 left-4 z-[120] w-64 rounded-xl border border-white/15 bg-black/85 p-3 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 text-sm font-semibold text-white">Craft</div>
          <div className="flex flex-col gap-2">
            {craftables.map((item) => {
              const recipe = item.recipe!
              const have = inv[recipe.from] || 0
              const canCraft = have >= recipe.count
              return (
                <button
                  key={item.id}
                  disabled={!canCraft}
                  onClick={() => {
                    if (removeItem(inv, recipe.from, recipe.count)) {
                      addItem(inv, item.id, recipe.yield)
                      forceRender((v) => v + 1)
                    }
                  }}
                  className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-left text-xs ${
                    canCraft ? 'border-white/20 bg-white/5 text-white hover:border-accent' : 'border-white/5 text-white/30'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-sm" style={{ background: item.color }} />
                    {item.name} x{recipe.yield}
                  </span>
                  <span>
                    {have}/{recipe.count} {ITEM_DEFS[recipe.from]?.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!ready && <div className="absolute inset-0 flex items-center justify-center text-white/70">Generating world...</div>}
    </div>
  )
}
