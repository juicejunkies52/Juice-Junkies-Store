'use client'

import { useEffect, useRef, useState } from 'react'
import { sfx, setSfxMuted, isSfxMuted } from '../../lib/sfx'

// Original match-3 puzzle game with a renovation meta-layer -- own tile
// art, own levels, own "999 Clubhouse" renovation theme and item list. Not
// a reskin of any existing match-3/renovation title: the pairing of these
// two mechanics is a whole genre, not anyone's specific IP, and nothing
// here borrows a character, story, or specific level design from one.

const GRID_SIZE = 8

const TILE_DEFS = [
  { id: 0, color: '#39ff14' },
  { id: 1, color: '#a78bfa' },
  { id: 2, color: '#facc15' },
  { id: 3, color: '#60a5fa' },
  { id: 4, color: '#f472b6' },
  { id: 5, color: '#fb923c' }
]

function TileIcon({ type, special }: { type: number; special?: 'none' | 'striped-h' | 'striped-v' | 'blast' }) {
  const color = TILE_DEFS[type].color
  const common = { width: 22, height: 22, viewBox: '0 0 22 22' } as const
  const badge =
    special === 'striped-h' ? '↔' : special === 'striped-v' ? '↕' : special === 'blast' ? '✦' : null
  const icon = (() => {
    switch (type) {
    case 0:
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="9" fill={color} />
        </svg>
      )
    case 1:
      return (
        <svg {...common}>
          <rect x="4" y="4" width="14" height="14" rx="2" fill={color} transform="rotate(45 11 11)" />
        </svg>
      )
    case 2:
      return (
        <svg {...common}>
          <polygon points="11,2 20,19 2,19" fill={color} />
        </svg>
      )
    case 3:
      return (
        <svg {...common}>
          <polygon points="11,1 19,6 19,16 11,21 3,16 3,6" fill={color} />
        </svg>
      )
    case 4:
      return (
        <svg {...common}>
          <polygon points="11,1 14,8 21,8 15.5,12.5 17.5,20 11,15.5 4.5,20 6.5,12.5 1,8 8,8" fill={color} />
        </svg>
      )
      case 5:
        return (
          <svg {...common}>
            <rect x="2" y="2" width="18" height="18" rx="5" fill={color} />
          </svg>
        )
      default:
        return null
    }
  })()

  if (!badge) return icon

  return (
    <span className="relative inline-flex items-center justify-center">
      {icon}
      <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[8px] font-bold text-black">
        {badge}
      </span>
    </span>
  )
}

interface LevelGoal {
  type: 'color' | 'score' | 'jelly'
  color?: number
  amount: number
}

interface LevelDef {
  moves: number
  goal: LevelGoal
  reward: number
  // Scatters this many jelly-covered cells across the board at level
  // start -- only meaningful for goal.type === 'jelly' levels.
  jellyCount?: number
}

// Levels 1-6 are untouched from the original build -- anyone's saved
// jj-clubhouse-stars/jj-clubhouse-unlocked progress is keyed by array
// index, so new levels are appended after rather than inserted. Jelly
// (the new blocker mechanic) is introduced starting at level 10, after
// the player already knows the base game.
const LEVELS: LevelDef[] = [
  { moves: 20, goal: { type: 'color', color: 0, amount: 18 }, reward: 40 },
  { moves: 18, goal: { type: 'color', color: 2, amount: 20 }, reward: 45 },
  { moves: 16, goal: { type: 'score', amount: 1200 }, reward: 50 },
  { moves: 18, goal: { type: 'color', color: 4, amount: 24 }, reward: 55 },
  { moves: 15, goal: { type: 'score', amount: 1600 }, reward: 60 },
  { moves: 16, goal: { type: 'color', color: 1, amount: 26 }, reward: 70 },
  { moves: 17, goal: { type: 'color', color: 3, amount: 26 }, reward: 75 },
  { moves: 14, goal: { type: 'score', amount: 1800 }, reward: 80 },
  { moves: 16, goal: { type: 'color', color: 5, amount: 28 }, reward: 85 },
  { moves: 15, goal: { type: 'jelly', amount: 10 }, reward: 90, jellyCount: 10 },
  { moves: 15, goal: { type: 'color', color: 0, amount: 30 }, reward: 95 },
  { moves: 13, goal: { type: 'score', amount: 2200 }, reward: 100 },
  { moves: 16, goal: { type: 'jelly', amount: 14 }, reward: 110, jellyCount: 14 },
  { moves: 14, goal: { type: 'color', color: 2, amount: 32 }, reward: 115 },
  { moves: 13, goal: { type: 'score', amount: 2600 }, reward: 120 },
  { moves: 16, goal: { type: 'jelly', amount: 18 }, reward: 130, jellyCount: 18 },
  { moves: 13, goal: { type: 'color', color: 4, amount: 34 }, reward: 140 },
  { moves: 12, goal: { type: 'score', amount: 3000 }, reward: 150 },
  { moves: 16, goal: { type: 'jelly', amount: 22 }, reward: 160, jellyCount: 22 },
  { moves: 14, goal: { type: 'color', color: 1, amount: 36 }, reward: 200 }
]

interface ClubhouseItem {
  id: string
  icon: string
  name: string
  cost: number
}

const CLUBHOUSE_ITEMS: ClubhouseItem[] = [
  { id: 'sign', icon: '💡', name: 'Neon Sign', cost: 50 },
  { id: 'jukebox', icon: '🎵', name: 'Jukebox', cost: 70 },
  { id: 'arcade', icon: '🕹️', name: 'Arcade Cabinet', cost: 90 },
  { id: 'mural', icon: '🦋', name: 'Butterfly Mural', cost: 110 },
  { id: 'shelf', icon: '🏆', name: 'Trophy Shelf', cost: 130 },
  { id: 'couch', icon: '🛋️', name: 'Comfy Couch', cost: 150 },
  { id: 'disco', icon: '🪩', name: 'Disco Ball', cost: 170 },
  { id: 'snacks', icon: '🍿', name: 'Snack Bar', cost: 200 }
]

// Special tiles -- created by a 4+ straight run (a "striped" tile that
// clears its whole row or column when later matched) or an L/T-shaped
// intersection of a horizontal and vertical run (a "blast" tile that
// clears a 3x3 area). Standard across the match-3 genre broadly, not tied
// to any one game's specific implementation of it.
type SpecialKind = 'none' | 'striped-h' | 'striped-v' | 'blast'

interface Cell {
  color: number
  special: SpecialKind
  // The obstacle/blocker mechanic: a cell matched or cleared through
  // while jelly is true just loses the layer (cell stays put) instead of
  // being removed -- the standard "match ON it, not match IT away" rule
  // this genre uses for blockers, as opposed to a wall that can't be
  // matched at all.
  jelly: boolean
}

function cellKey(r: number, c: number) {
  return `${r},${c}`
}

function makeCell(color: number, special: SpecialKind = 'none', jelly = false): Cell {
  return { color, special, jelly }
}

function randomTile(): number {
  return Math.floor(Math.random() * TILE_DEFS.length)
}

function randomCell(): Cell {
  return makeCell(randomTile())
}

function findRuns(grid: Cell[][], size: number) {
  const hRuns: { cells: [number, number][]; color: number }[] = []
  const vRuns: { cells: [number, number][]; color: number }[] = []

  for (let r = 0; r < size; r++) {
    let runStart = 0
    for (let c = 1; c <= size; c++) {
      if (c < size && grid[r][c].color === grid[r][runStart].color) continue
      if (c - runStart >= 3) {
        const cells: [number, number][] = []
        for (let k = runStart; k < c; k++) cells.push([r, k])
        hRuns.push({ cells, color: grid[r][runStart].color })
      }
      runStart = c
    }
  }

  for (let c = 0; c < size; c++) {
    let runStart = 0
    for (let r = 1; r <= size; r++) {
      if (r < size && grid[r][c].color === grid[runStart][c].color) continue
      if (r - runStart >= 3) {
        const cells: [number, number][] = []
        for (let k = runStart; k < r; k++) cells.push([k, c])
        vRuns.push({ cells, color: grid[runStart][c].color })
      }
      runStart = r
    }
  }

  return { hRuns, vRuns }
}

function hasAnyMatch(grid: Cell[][], size: number) {
  const { hRuns, vRuns } = findRuns(grid, size)
  return hRuns.length > 0 || vRuns.length > 0
}

// Union of every cell belonging to a run right now -- used only for the
// brief pre-resolve flash highlight, before the real (mutating) resolve.
function previewMatchedCells(grid: Cell[][], size: number): Set<string> {
  const { hRuns, vRuns } = findRuns(grid, size)
  const set = new Set<string>()
  for (const run of [...hRuns, ...vRuns]) for (const [r, c] of run.cells) set.add(cellKey(r, c))
  return set
}

function makeGrid(size: number, jellyCount = 0): Cell[][] {
  let grid: Cell[][]
  do {
    grid = Array.from({ length: size }, () => Array.from({ length: size }, () => randomCell()))
  } while (hasAnyMatch(grid, size))

  if (jellyCount > 0) {
    const positions: [number, number][] = []
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) positions.push([r, c])
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[positions[i], positions[j]] = [positions[j], positions[i]]
    }
    for (let i = 0; i < Math.min(jellyCount, positions.length); i++) {
      const [r, c] = positions[i]
      grid[r][c] = { ...grid[r][c], jelly: true }
    }
  }

  return grid
}

// Shared by a normal run-based clear and a combo-swap clear (see
// comboClearCells below): given a pre-decided clear-set and any cells
// that survive as new specials instead of being removed, chain-triggers
// any pre-existing specials caught up in the area (each one expands the
// clear, which can catch further specials), strips -- rather than
// removes -- jelly-covered cells on first touch, tallies what actually
// cleared, and drops/refills the board. Mutates `grid` in place.
function applyClear(grid: Cell[][], size: number, initialClearSet: Set<string>, survivors: Map<string, SpecialKind>) {
  const clearSet = new Set(initialClearSet)

  const queue = [...clearSet]
  const processed = new Set<string>()
  while (queue.length) {
    const key = queue.pop() as string
    if (processed.has(key)) continue
    processed.add(key)
    const [r, c] = key.split(',').map(Number)
    const cell = grid[r][c]
    if (cell.special === 'none' || survivors.has(key)) continue

    const addCell = (k2: string) => {
      if (!clearSet.has(k2) && !survivors.has(k2)) {
        clearSet.add(k2)
        queue.push(k2)
      }
    }

    if (cell.special === 'striped-h') {
      for (let cc = 0; cc < size; cc++) addCell(cellKey(r, cc))
    } else if (cell.special === 'striped-v') {
      for (let rr = 0; rr < size; rr++) addCell(cellKey(rr, c))
    } else if (cell.special === 'blast') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr
          const cc = c + dc
          if (rr >= 0 && rr < size && cc >= 0 && cc < size) addCell(cellKey(rr, cc))
        }
      }
    }
  }

  const clearedCounts: Record<number, number> = {}
  let totalCleared = 0
  let jellyStripped = 0
  const actuallyCleared = new Set<string>()

  for (const key of clearSet) {
    if (survivors.has(key)) continue
    const [r, c] = key.split(',').map(Number)
    const cell = grid[r][c]
    if (cell.jelly) {
      grid[r][c] = { ...cell, jelly: false }
      jellyStripped++
      continue
    }
    clearedCounts[cell.color] = (clearedCounts[cell.color] || 0) + 1
    totalCleared++
    actuallyCleared.add(key)
  }

  for (const [key, special] of survivors) {
    const [r, c] = key.split(',').map(Number)
    const prev = grid[r][c]
    if (prev.jelly) jellyStripped++
    grid[r][c] = makeCell(prev.color, special, false)
  }

  for (let col = 0; col < size; col++) {
    const survivingCells: Cell[] = []
    for (let row = 0; row < size; row++) {
      if (!actuallyCleared.has(cellKey(row, col))) survivingCells.push(grid[row][col])
    }
    const missing = size - survivingCells.length
    const refilled = Array.from({ length: missing }, () => randomCell())
    const newCol = [...refilled, ...survivingCells]
    for (let row = 0; row < size; row++) grid[row][col] = newCol[row]
  }

  return { changed: clearSet.size > 0, clearedCounts, totalCleared, jellyStripped }
}

// Mutates `grid` in place: clears one pass of matches (creating/triggering
// special tiles along the way) and drops/refills columns. Returns whether
// anything changed, so the caller can loop for cascades.
function performOneResolveStep(grid: Cell[][], size: number) {
  const { hRuns, vRuns } = findRuns(grid, size)
  if (hRuns.length === 0 && vRuns.length === 0) {
    return { changed: false, clearedCounts: {} as Record<number, number>, totalCleared: 0, jellyStripped: 0 }
  }

  const hCellSet = new Set<string>()
  hRuns.forEach((run) => run.cells.forEach(([r, c]) => hCellSet.add(cellKey(r, c))))
  const vCellSet = new Set<string>()
  vRuns.forEach((run) => run.cells.forEach(([r, c]) => vCellSet.add(cellKey(r, c))))

  const intersections = new Set<string>()
  for (const key of hCellSet) if (vCellSet.has(key)) intersections.add(key)

  const matchedSet = new Set<string>([...hCellSet, ...vCellSet])

  // Decide which cell (if any) survives each run/intersection as a new
  // special tile instead of being cleared. Intersections win first.
  const survivors = new Map<string, SpecialKind>()
  for (const key of intersections) survivors.set(key, 'blast')
  for (const run of hRuns) {
    if (run.cells.length >= 4) {
      const candidate = run.cells.find(([r, c]) => !survivors.has(cellKey(r, c)))
      if (candidate) survivors.set(cellKey(candidate[0], candidate[1]), 'striped-h')
    }
  }
  for (const run of vRuns) {
    if (run.cells.length >= 4) {
      const candidate = run.cells.find(([r, c]) => !survivors.has(cellKey(r, c)))
      if (candidate) survivors.set(cellKey(candidate[0], candidate[1]), 'striped-v')
    }
  }

  return applyClear(grid, size, matchedSet, survivors)
}

// The genre's signature "combo" move: swapping two already-special tiles
// together always triggers (no need to also form a new run) and clears a
// bigger area than either tile's own effect alone. Centered on the swap's
// target cell (r, c) since both tiles land adjacent to it either way.
function comboClearCells(r: number, c: number, size: number, a: SpecialKind, b: SpecialKind): Set<string> {
  const set = new Set<string>()
  const addRow = (rr: number) => {
    for (let cc = 0; cc < size; cc++) set.add(cellKey(rr, cc))
  }
  const addCol = (cc: number) => {
    for (let rr = 0; rr < size; rr++) set.add(cellKey(rr, cc))
  }
  const isStriped = (k: SpecialKind) => k === 'striped-h' || k === 'striped-v'

  if (a === 'blast' && b === 'blast') {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr
        const cc = c + dc
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) set.add(cellKey(rr, cc))
      }
    }
  } else if (isStriped(a) && isStriped(b)) {
    addRow(r)
    addCol(c)
  } else if (isStriped(a) || isStriped(b)) {
    for (let dr = -1; dr <= 1; dr++) {
      const rr = r + dr
      if (rr >= 0 && rr < size) addRow(rr)
    }
    for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc
      if (cc >= 0 && cc < size) addCol(cc)
    }
  }

  return set
}

function resolveBoard(grid: Cell[][], size: number) {
  const current = grid.map((row) => row.map((cell) => ({ ...cell })))
  const clearedCounts: Record<number, number> = {}
  let totalCleared = 0
  let comboLevels = 0
  let jellyStripped = 0

  while (true) {
    const step = performOneResolveStep(current, size)
    if (!step.changed) break
    comboLevels++
    totalCleared += step.totalCleared
    jellyStripped += step.jellyStripped
    for (const [color, count] of Object.entries(step.clearedCounts)) {
      clearedCounts[Number(color)] = (clearedCounts[Number(color)] || 0) + count
    }
  }

  return { finalGrid: current, clearedCounts, totalCleared, comboLevels, jellyStripped }
}

type Status = 'intro' | 'playing' | 'levelWin' | 'levelLose' | 'clubhouse'

export default function ClubhouseGame({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>('intro')
  const [levelIndex, setLevelIndex] = useState(0)
  const [unlockedLevel, setUnlockedLevel] = useState(0)
  const [levelStars, setLevelStars] = useState<Record<number, number>>({})
  const [juice, setJuice] = useState(0)
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set())

  const [grid, setGrid] = useState<Cell[][]>([])
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null)
  const [movesLeft, setMovesLeft] = useState(0)
  const [score, setScore] = useState(0)
  const [goalProgress, setGoalProgress] = useState(0)
  const [flashingCells, setFlashingCells] = useState<Set<string>>(new Set())
  const [shakeCell, setShakeCell] = useState<string | null>(null)
  const [lastReward, setLastReward] = useState(0)
  const [starsEarned, setStarsEarned] = useState(0)
  const [muted, setMuted] = useState(false)
  const [buyToast, setBuyToast] = useState<string | null>(null)

  const busyRef = useRef(false)
  const buyToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const j = parseInt(localStorage.getItem('jj-clubhouse-juice') || '0', 10)
      setJuice(Number.isFinite(j) ? j : 0)
      const u = parseInt(localStorage.getItem('jj-clubhouse-unlocked') || '0', 10)
      setUnlockedLevel(Number.isFinite(u) ? u : 0)
      const starsRaw = localStorage.getItem('jj-clubhouse-stars')
      if (starsRaw) setLevelStars(JSON.parse(starsRaw))
      const itemsRaw = localStorage.getItem('jj-clubhouse-items')
      if (itemsRaw) setOwnedItems(new Set(JSON.parse(itemsRaw)))
      const mutedSaved = localStorage.getItem('jj-clubhouse-muted') === 'true'
      setMuted(mutedSaved)
      setSfxMuted(mutedSaved)
    } catch {
      // Fine -- progress just won't persist for this visitor.
    }
  }, [])

  const persistJuice = (next: number) => {
    setJuice(next)
    try {
      localStorage.setItem('jj-clubhouse-juice', String(next))
    } catch {
      // Fine.
    }
  }

  const toggleMuted = () => {
    const next = !isSfxMuted()
    setSfxMuted(next)
    setMuted(next)
    try {
      localStorage.setItem('jj-clubhouse-muted', String(next))
    } catch {
      // Fine.
    }
  }

  const startLevel = (idx: number) => {
    const level = LEVELS[idx]
    setLevelIndex(idx)
    setGrid(makeGrid(GRID_SIZE, level.jellyCount || 0))
    setSelected(null)
    setMovesLeft(level.moves)
    setScore(0)
    setGoalProgress(0)
    setFlashingCells(new Set())
    busyRef.current = false
    setStatus('playing')
  }

  const handleTileTap = (row: number, col: number) => {
    if (status !== 'playing' || busyRef.current) return

    if (!selected) {
      setSelected({ row, col })
      return
    }
    if (selected.row === row && selected.col === col) {
      setSelected(null)
      return
    }
    const adjacent = Math.abs(selected.row - row) + Math.abs(selected.col - col) === 1
    if (!adjacent) {
      setSelected({ row, col })
      return
    }

    const fromCell = grid[selected.row][selected.col]
    const toCell = grid[row][col]
    // Swapping two already-special tiles together is always valid and
    // triggers the bonus combo clear below, regardless of whether it also
    // happens to form a new run -- that's the point of the move.
    const isComboSwap = fromCell.special !== 'none' && toCell.special !== 'none'

    const trial = grid.map((r) => r.map((cell) => ({ ...cell })))
    const tmp = trial[selected.row][selected.col]
    trial[selected.row][selected.col] = trial[row][col]
    trial[row][col] = tmp

    const firstMatches = isComboSwap ? comboClearCells(row, col, GRID_SIZE, fromCell.special, toCell.special) : previewMatchedCells(trial, GRID_SIZE)
    setSelected(null)

    if (!isComboSwap && firstMatches.size === 0) {
      sfx.reject()
      setShakeCell(`${row},${col}`)
      setTimeout(() => setShakeCell(null), 250)
      return
    }

    busyRef.current = true
    sfx.match()
    setGrid(trial)
    setFlashingCells(firstMatches)
    const movesNow = movesLeft - 1
    setMovesLeft(movesNow)

    setTimeout(() => {
      let finalGrid: Cell[][]
      let clearedCounts: Record<number, number>
      let totalCleared: number
      let comboLevels: number
      let jellyStripped: number

      if (isComboSwap) {
        const comboStats = applyClear(trial, GRID_SIZE, firstMatches, new Map())
        const rest = resolveBoard(trial, GRID_SIZE)
        finalGrid = rest.finalGrid
        totalCleared = comboStats.totalCleared + rest.totalCleared
        jellyStripped = comboStats.jellyStripped + rest.jellyStripped
        comboLevels = 1 + rest.comboLevels
        clearedCounts = { ...comboStats.clearedCounts }
        for (const [color, count] of Object.entries(rest.clearedCounts)) {
          clearedCounts[Number(color)] = (clearedCounts[Number(color)] || 0) + count
        }
      } else {
        const result = resolveBoard(trial, GRID_SIZE)
        finalGrid = result.finalGrid
        clearedCounts = result.clearedCounts
        totalCleared = result.totalCleared
        comboLevels = result.comboLevels
        jellyStripped = result.jellyStripped
      }

      setGrid(finalGrid)
      setFlashingCells(new Set())
      if (isComboSwap || comboLevels > 1) sfx.combo()

      const level = LEVELS[levelIndex]
      const points = totalCleared * 10 + Math.max(0, comboLevels - 1) * 25 + jellyStripped * 15
      const newScore = score + points
      setScore(newScore)

      let newProgress = goalProgress
      if (level.goal.type === 'color') {
        newProgress = goalProgress + (clearedCounts[level.goal.color as number] || 0)
      } else if (level.goal.type === 'jelly') {
        newProgress = goalProgress + jellyStripped
      } else {
        newProgress = newScore
      }
      setGoalProgress(newProgress)

      const won = newProgress >= level.goal.amount
      if (won) {
        const fraction = movesNow / level.moves
        const stars = fraction >= 0.5 ? 3 : fraction >= 0.2 ? 2 : 1
        const reward = level.reward + stars * 10
        sfx.waveClear()
        setStarsEarned(stars)
        setLastReward(reward)
        persistJuice(juice + reward)

        setLevelStars((prev) => {
          const next = { ...prev, [levelIndex]: Math.max(prev[levelIndex] || 0, stars) }
          try {
            localStorage.setItem('jj-clubhouse-stars', JSON.stringify(next))
          } catch {
            // Fine.
          }
          return next
        })

        if (levelIndex + 1 > unlockedLevel) {
          const nextUnlocked = Math.min(levelIndex + 1, LEVELS.length - 1)
          setUnlockedLevel(nextUnlocked)
          try {
            localStorage.setItem('jj-clubhouse-unlocked', String(nextUnlocked))
          } catch {
            // Fine.
          }
        }
        setStatus('levelWin')
      } else if (movesNow <= 0) {
        sfx.gameOver()
        setStatus('levelLose')
      }

      busyRef.current = false
    }, 220)
  }

  const flashBuyToast = (msg: string) => {
    sfx.reject()
    setBuyToast(msg)
    if (buyToastTimeoutRef.current) clearTimeout(buyToastTimeoutRef.current)
    buyToastTimeoutRef.current = setTimeout(() => setBuyToast(null), 1800)
  }

  const buyItem = (item: ClubhouseItem) => {
    if (ownedItems.has(item.id)) return
    if (juice < item.cost) {
      flashBuyToast(`Need ${item.cost - juice} more Juice`)
      return
    }
    persistJuice(juice - item.cost)
    const next = new Set(ownedItems)
    next.add(item.id)
    setOwnedItems(next)
    try {
      localStorage.setItem('jj-clubhouse-items', JSON.stringify([...next]))
    } catch {
      // Fine.
    }
    sfx.upgrade()
  }

  const level = LEVELS[levelIndex]

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-b from-black via-purple-950 to-black"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        Close ✕
      </button>
      <button
        onClick={toggleMuted}
        title={muted ? 'Unmute' : 'Mute'}
        className="fixed top-4 right-24 z-[120] rounded-full border border-accent/50 bg-black/80 px-3 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {buyToast && (
        <div className="pointer-events-none fixed top-20 left-1/2 z-[115] -translate-x-1/2 rounded-full border border-red-400/50 bg-black/90 px-4 py-2 text-sm text-white">
          {buyToast}
        </div>
      )}

      {status === 'intro' && (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h2 className="text-2xl font-bold text-accent drop-shadow-[0_0_10px_rgba(57,255,20,0.6)] sm:text-3xl">
            🏠 999 Clubhouse
          </h2>
          <p className="mt-2 text-sm text-white/70">
            Match tiles to earn Juice, then spend it fixing up the clubhouse for the whole 999 family.
          </p>
          <p className="mt-3 font-mono text-sm text-accent">🧪 Juice: {juice}</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {LEVELS.map((_, idx) => {
              const locked = idx > unlockedLevel
              const stars = levelStars[idx] || 0
              return (
                <button
                  key={idx}
                  disabled={locked}
                  onClick={() => startLevel(idx)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-4 ${
                    locked ? 'border-white/10 bg-black/30 opacity-40' : 'border-accent/40 bg-black/60 hover:border-accent'
                  }`}
                >
                  <span className="text-lg font-bold text-white">{locked ? '🔒' : idx + 1}</span>
                  <span className="text-xs text-accent">{'⭐'.repeat(stars) || (locked ? '' : '—')}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setStatus('clubhouse')}
            className="btn-primary mt-8 px-8 py-3"
          >
            🏠 Visit the Clubhouse
          </button>
        </div>
      )}

      {status === 'clubhouse' && (
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h2 className="text-2xl font-bold text-accent drop-shadow-[0_0_10px_rgba(57,255,20,0.6)] sm:text-3xl">
            🏠 The Clubhouse
          </h2>
          <p className="mt-2 text-sm text-white/70">Spend Juice from matching to fix the place up.</p>
          <p className="mt-2 font-mono text-sm text-accent">🧪 Juice: {juice}</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/40 p-4 min-h-[80px]">
            {ownedItems.size === 0 && <p className="text-xs text-white/40">Nothing built yet -- get matching!</p>}
            {CLUBHOUSE_ITEMS.filter((i) => ownedItems.has(i.id)).map((i) => (
              <span key={i.id} title={i.name} className="text-3xl">
                {i.icon}
              </span>
            ))}
          </div>

          {ownedItems.size === CLUBHOUSE_ITEMS.length && (
            <p className="mt-3 font-semibold text-accent">🎉 Clubhouse complete! Legends never die.</p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CLUBHOUSE_ITEMS.map((item) => {
              const owned = ownedItems.has(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => buyItem(item)}
                  disabled={owned}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 ${
                    owned ? 'border-accent/50 bg-accent/10' : 'border-white/20 bg-black/60 hover:border-accent'
                  }`}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs font-semibold text-white">{item.name}</span>
                  <span className="text-[10px] text-white/50">{owned ? 'Built ✓' : `${item.cost} Juice`}</span>
                </button>
              )
            })}
          </div>

          <button onClick={() => setStatus('intro')} className="btn-secondary mt-8 px-8 py-3">
            ← Back to Levels
          </button>
        </div>
      )}

      {status === 'playing' && (
        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
          <h2 className="text-lg font-bold text-accent">Level {levelIndex + 1}</h2>
          <p className="mt-1 font-mono text-sm text-white">
            Moves: {movesLeft} &nbsp;·&nbsp; Score: {score}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {level.goal.type === 'color' ? (
              <>
                Clear {level.goal.amount} tiles of this color:{' '}
                <span className="inline-block h-3 w-3 rounded-full align-middle" style={{ background: TILE_DEFS[level.goal.color as number].color }} />{' '}
                ({goalProgress}/{level.goal.amount})
              </>
            ) : level.goal.type === 'jelly' ? (
              <>🧊 Clear all the jelly ({goalProgress}/{level.goal.amount})</>
            ) : (
              <>Reach {level.goal.amount} points ({goalProgress}/{level.goal.amount})</>
            )}
          </p>

          <div
            className="mt-6 grid gap-1 rounded-xl border border-white/10 bg-black/40 p-2"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
          >
            {grid.map((rowArr, row) =>
              rowArr.map((cell, col) => {
                const key = `${row},${col}`
                const isSelected = selected?.row === row && selected?.col === col
                const isFlashing = flashingCells.has(key)
                const isShaking = shakeCell === key
                return (
                  <button
                    key={key}
                    onClick={() => handleTileTap(row, col)}
                    className={`relative flex h-9 w-9 items-center justify-center rounded-md border transition-transform sm:h-10 sm:w-10 ${
                      isSelected ? 'scale-110 border-white bg-white/10' : 'border-white/10 bg-black/30'
                    } ${isFlashing ? 'brightness-150' : ''} ${isShaking ? 'animate-pulse' : ''} ${
                      cell.special !== 'none' ? 'shadow-[0_0_8px_rgba(255,255,255,0.6)]' : ''
                    }`}
                  >
                    {cell.jelly && <span className="pointer-events-none absolute inset-0 rounded-md border-2 border-cyan-300/70 bg-cyan-400/20" />}
                    <TileIcon type={cell.color} special={cell.special} />
                  </button>
                )
              })
            )}
          </div>

          <button onClick={() => setStatus('intro')} className="btn-secondary mt-6 px-6 py-2 text-sm">
            ← Levels
          </button>
        </div>
      )}

      {(status === 'levelWin' || status === 'levelLose') && (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-2xl font-bold text-white">{status === 'levelWin' ? 'Level Complete!' : 'Out of Moves'}</p>
          {status === 'levelWin' ? (
            <>
              <p className="text-2xl">{'⭐'.repeat(starsEarned)}</p>
              <p className="font-mono text-sm text-accent">+{lastReward} Juice</p>
            </>
          ) : (
            <p className="text-sm text-white/60">Goal: {goalProgress}/{level.goal.amount}</p>
          )}
          <div className="mt-2 flex gap-3">
            {status === 'levelLose' && (
              <button onClick={() => startLevel(levelIndex)} className="btn-primary px-6 py-2">
                Retry
              </button>
            )}
            {status === 'levelWin' && levelIndex + 1 < LEVELS.length && (
              <button onClick={() => startLevel(levelIndex + 1)} className="btn-primary px-6 py-2">
                Next Level
              </button>
            )}
            <button onClick={() => setStatus('intro')} className="btn-secondary px-6 py-2">
              Levels
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
