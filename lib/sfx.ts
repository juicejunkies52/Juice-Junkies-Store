// Tiny synthesized sound-effect engine using the Web Audio API -- no audio
// files to source or host, just oscillators with short gain envelopes.
// Lazily creates its AudioContext on first play (browsers require a user
// gesture first, which games already have via their own Start button).

let ctx: AudioContext | null = null
let muted = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

export function setSfxMuted(value: boolean) {
  muted = value
}

export function isSfxMuted() {
  return muted
}

function tone(
  freq: number,
  duration: number,
  { type = 'square', volume = 0.12, delay = 0, slideTo }: { type?: OscillatorType; volume?: number; delay?: number; slideTo?: number } = {}
) {
  if (muted) return
  const audio = getCtx()
  if (!audio) return

  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, audio.currentTime + delay)
  if (slideTo !== undefined) {
    osc.frequency.linearRampToValueAtTime(slideTo, audio.currentTime + delay + duration)
  }
  gain.gain.setValueAtTime(volume, audio.currentTime + delay)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + delay + duration)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(audio.currentTime + delay)
  osc.stop(audio.currentTime + delay + duration)
}

export const sfx = {
  playerShoot: () => tone(680, 0.05, { type: 'square', volume: 0.05, slideTo: 420 }),
  turretShoot: () => tone(520, 0.05, { type: 'square', volume: 0.05, slideTo: 320 }),
  cannonShoot: () => tone(180, 0.12, { type: 'sawtooth', volume: 0.08, slideTo: 90 }),
  enemyShoot: () => tone(300, 0.08, { type: 'sine', volume: 0.06, slideTo: 200 }),
  hit: () => tone(180, 0.045, { type: 'square', volume: 0.05 }),
  fiendDeath: () => tone(260, 0.12, { type: 'sawtooth', volume: 0.09, slideTo: 60 }),
  bossDeath: () => {
    tone(220, 0.3, { type: 'sawtooth', volume: 0.12, slideTo: 40 })
    tone(140, 0.35, { type: 'sawtooth', volume: 0.1, delay: 0.05, slideTo: 30 })
  },
  place: () => tone(440, 0.07, { type: 'triangle', volume: 0.08, slideTo: 620 }),
  upgrade: () => {
    tone(523, 0.07, { type: 'triangle', volume: 0.08 })
    tone(784, 0.1, { type: 'triangle', volume: 0.08, delay: 0.06 })
  },
  reject: () => tone(140, 0.15, { type: 'square', volume: 0.07, slideTo: 100 }),
  match: () => tone(600, 0.06, { type: 'sine', volume: 0.07, slideTo: 900 }),
  combo: () => {
    tone(700, 0.05, { type: 'sine', volume: 0.07 })
    tone(900, 0.06, { type: 'sine', volume: 0.07, delay: 0.05 })
  },
  playerHurt: () => tone(150, 0.12, { type: 'sawtooth', volume: 0.08, slideTo: 80 }),
  baseHurt: () => tone(90, 0.16, { type: 'sawtooth', volume: 0.1, slideTo: 50 }),
  waveClear: () => {
    tone(392, 0.1, { type: 'triangle', volume: 0.09 })
    tone(523, 0.1, { type: 'triangle', volume: 0.09, delay: 0.1 })
    tone(659, 0.16, { type: 'triangle', volume: 0.09, delay: 0.2 })
  },
  waveStart: () => tone(200, 0.1, { type: 'square', volume: 0.08, slideTo: 340 }),
  gameOver: () => {
    tone(300, 0.2, { type: 'sawtooth', volume: 0.1, slideTo: 200 })
    tone(200, 0.25, { type: 'sawtooth', volume: 0.1, delay: 0.18, slideTo: 80 })
  },
  milestone: () => {
    tone(523, 0.08, { type: 'triangle', volume: 0.09 })
    tone(659, 0.08, { type: 'triangle', volume: 0.09, delay: 0.08 })
    tone(784, 0.14, { type: 'triangle', volume: 0.09, delay: 0.16 })
  }
}
