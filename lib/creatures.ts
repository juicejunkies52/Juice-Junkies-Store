export type Rarity = 'common' | 'rare' | 'legendary' | 'exclusive'

export interface CreatureDef {
  type: string
  name: string
  rarity: Rarity
  hex: string
  // Exclusive creatures never spawn randomly -- they're only ever awarded
  // (see /api/creatures/award-purchase), so they're left out of the
  // weighted wild-spawn pool entirely.
  exclusive?: boolean
}

// Original critter designs, no relation to any existing franchise --
// weighted so commons show up far more than the legendary.
export const CREATURES: CreatureDef[] = [
  { type: 'firefly', name: 'Neon Firefly', rarity: 'common', hex: '#facc15' },
  { type: 'ladybug', name: 'Crystal Ladybug', rarity: 'common', hex: '#f87171' },
  { type: 'moth', name: 'Shadow Moth', rarity: 'rare', hex: '#a78bfa' },
  { type: 'dragonfly', name: 'Electric Dragonfly', rarity: 'rare', hex: '#60a5fa' },
  { type: 'phoenix', name: '999 Phoenix', rarity: 'legendary', hex: '#fb923c' },
  { type: 'goldencarton', name: 'Chromatic 999', rarity: 'exclusive', hex: '#ffd700', exclusive: true }
]

const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 10,
  rare: 4,
  legendary: 1,
  exclusive: 0
}

export function pickRandomCreature(): CreatureDef {
  const weighted = CREATURES.filter((c) => !c.exclusive).flatMap((c) => Array(RARITY_WEIGHT[c.rarity]).fill(c))
  return weighted[Math.floor(Math.random() * weighted.length)]
}

export function getCreature(type: string): CreatureDef | undefined {
  return CREATURES.find((c) => c.type === type)
}
