export interface BackgroundDef {
  id: string
  name: string
  src: string
}

// The pool a destroy-mode session's hidden reveal image is drawn from.
// Fully destroying the page (the same 100%-destroyed finish line that
// already triggers the victory screen) unlocks whichever one was behind
// that session into the player's permanent collection -- see
// UnlockedBackground in prisma/schema.prisma and /api/backgrounds/*.
// Mix of original art (orig-*, hand-authored SVGs, brand palette) and
// verified CC0 photography/renders (cc0-*, see their LICENSE file in the
// same folder) -- drop your own into public/games/backgrounds/custom/ and
// add an entry here (see that folder's README.txt).
export const BACKGROUND_POOL: BackgroundDef[] = [
  { id: 'orig-neon-vortex', name: 'Neon Vortex', src: '/games/backgrounds/reveal/orig-neon-vortex.svg' },
  { id: 'orig-circuit-bloom', name: 'Circuit Bloom', src: '/games/backgrounds/reveal/orig-circuit-bloom.svg' },
  { id: 'orig-juice-drip', name: 'Juice Drip', src: '/games/backgrounds/reveal/orig-juice-drip.svg' },
  { id: 'orig-static-storm', name: 'Static Storm', src: '/games/backgrounds/reveal/orig-static-storm.svg' },
  { id: 'cc0-purple-nebula', name: 'Purple Nebula', src: '/games/backgrounds/reveal/cc0-purple-nebula.png' },
  { id: 'cc0-blue-nebula', name: 'Blue Nebula', src: '/games/backgrounds/reveal/cc0-blue-nebula.png' },
  { id: 'cc0-green-nebula', name: 'Green Nebula', src: '/games/backgrounds/reveal/cc0-green-nebula.png' }
]

export function pickRandomBackground(): BackgroundDef {
  return BACKGROUND_POOL[Math.floor(Math.random() * BACKGROUND_POOL.length)]
}

export function getBackground(id: string): BackgroundDef | undefined {
  return BACKGROUND_POOL.find((b) => b.id === id)
}
