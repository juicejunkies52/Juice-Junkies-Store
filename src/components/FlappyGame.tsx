'use client'

import { useEffect, useRef, useState } from 'react'
import { CREATURES, pickRandomCreature, getCreature } from '../../lib/creatures'
import CreatureSvg from './CreatureSvg'

// Original default flyer for this mini-game -- same neon-wing butterfly
// style already used across the site, not a depiction of any real person
// or existing character. Caught creatures are selectable alternates.
function FlutterBird({ rotation }: { rotation: number }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      className="text-accent drop-shadow-[0_0_8px_currentColor]"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <line x1="20" y1="5" x2="20" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20,15 Q8,8 5,15 Q8,22 20,20" fill="currentColor" fillOpacity="0.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M20,15 Q32,8 35,15 Q32,22 20,20" fill="currentColor" fillOpacity="0.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M20,20 Q12,25 8,30 Q12,35 20,30" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M20,20 Q28,25 32,30 Q28,35 20,30" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function PlayerSprite({ type, rotation }: { type: string; rotation: number }) {
  if (type === 'flutter') return <FlutterBird rotation={rotation} />
  const creature = CREATURES.find((c) => c.type === type)
  return (
    <div style={{ color: creature?.hex, transform: `rotate(${rotation}deg)` }}>
      <CreatureSvg type={type} size={40} />
    </div>
  )
}

const BIRD_X = 90
const BIRD_SIZE = 40
// Real Flappy Bird's forgiving feel despite tight gaps comes partly from
// the hitbox being noticeably smaller than the visible sprite -- the bird
// "looks" like it clips a pipe a beat before it actually would.
const HITBOX_INSET = 7
const GRAVITY = 0.42
const FLAP_VELOCITY = -7.6
// Real Flappy Bird caps fall speed -- without this a long drop keeps
// accelerating forever, which both feels wrong and makes the bird cross
// the whole pipe gap too fast to react to once it's been falling a while.
const MAX_FALL_VELOCITY = 10.5
const PIPE_WIDTH = 64
const PIPE_GAP = 175
const PIPE_SPACING = 240
// requestAnimationFrame fires at whatever rate the display refreshes
// (60Hz, 120Hz, etc.), so applying GRAVITY once per callback made the bird
// fall measurably faster on a high-refresh-rate screen than a 60Hz one --
// same code, different physics depending on hardware. Scaling every
// per-frame change by elapsed real time against a 60fps baseline fixes
// that: the bird falls at the same real-world speed everywhere. Clamped so
// a tab left in the background doesn't resume with one huge physics jump.
const BASELINE_FRAME_MS = 1000 / 60
const MAX_DT_SCALE = 3
// Eases in instead of starting at full pace -- a flat speed from the first
// pipe was a big part of why it felt off from the genre's actual rhythm.
const BASE_PIPE_SPEED = 2.6
const MAX_PIPE_SPEED = 5.6
const SPEED_RAMP_PER_POINT = 0.12
// How far a new gap's center is allowed to drift from the previous pipe's
// gap, so two consecutive pipes can never demand an impossible vertical
// jump in the time it takes to travel between them.
const MAX_GAP_SHIFT = 130
const MILESTONE_SCORE = 15

interface Pipe {
  x: number
  gapY: number
  passed: boolean
}

export default function FlappyGame({
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
  const [status, setStatus] = useState<'ready' | 'playing' | 'over'>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [birdY, setBirdY] = useState(0)
  const [birdRotation, setBirdRotation] = useState(0)
  const [pipes, setPipes] = useState<Pipe[]>([])
  const [selectedType, setSelectedType] = useState('flutter')
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null)
  const [topMessage, setTopMessage] = useState<string | null>(null)
  const [isTopScorer, setIsTopScorer] = useState(false)
  const [loggedIn, setLoggedIn] = useState(true)
  const [messageDraft, setMessageDraft] = useState('')
  const [messageSaved, setMessageSaved] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [submittingMessage, setSubmittingMessage] = useState(false)

  const birdVelocityRef = useRef(0)
  const birdYRef = useRef(0)
  const pipesRef = useRef<Pipe[]>([])
  const scoreRef = useRef(0)
  const rafRef = useRef<number>(0)
  const statusRef = useRef<'ready' | 'playing' | 'over'>('ready')
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
      const saved = localStorage.getItem('jj-flutter-best')
      if (saved) setBest(parseInt(saved, 10) || 0)
    } catch {
      // Fine -- best score just won't persist for this visitor.
    }
  }, [])

  // The background message belongs to whoever currently holds the global
  // #1 score -- fetched once, then refreshed locally after this player
  // saves a new one so it doesn't need a re-fetch.
  useEffect(() => {
    fetch('/api/flutter/top')
      .then((r) => r.json())
      .then((d) => setTopMessage(d.message || null))
      .catch(() => {})
  }, [])

  const nextGapY = (prevGapY: number | null) => {
    const margin = 80
    const minY = margin
    const maxY = Math.max(dims.height - margin, minY + 10)
    if (prevGapY === null) {
      return minY + Math.random() * (maxY - minY)
    }
    const shift = (Math.random() * 2 - 1) * MAX_GAP_SHIFT
    return Math.max(minY, Math.min(maxY, prevGapY + shift))
  }

  const resetGame = () => {
    birdYRef.current = dims.height / 2
    birdVelocityRef.current = 0
    milestoneHitRef.current = false

    let gap = nextGapY(null)
    const initialPipes: Pipe[] = []
    for (let i = 0; i < 4; i++) {
      initialPipes.push({ x: dims.width + 100 + i * PIPE_SPACING, gapY: gap, passed: false })
      gap = nextGapY(gap)
    }
    pipesRef.current = initialPipes

    scoreRef.current = 0
    setScore(0)
    setBirdY(birdYRef.current)
    setPipes(pipesRef.current)
  }

  const startGame = () => {
    if (dims.width === 0) return
    resetGame()
    statusRef.current = 'playing'
    setStatus('playing')
    setIsTopScorer(false)
    setMessageSaved(false)
    setMessageError(null)
    setMessageDraft('')
    flap()
  }

  const flap = () => {
    if (statusRef.current !== 'playing') return
    birdVelocityRef.current = FLAP_VELOCITY
  }

  const awardMilestone = () => {
    if (!visitorId) return
    const def = pickRandomCreature()
    fetch('/api/creatures/catch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, creatureType: def.type })
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.isNew) {
          const caught = getCreature(def.type)
          setMilestoneToast(`🎉 Score ${MILESTONE_SCORE}! Caught: ${caught?.name || def.type}`)
          setTimeout(() => setMilestoneToast(null), 3500)
        }
      })
      .catch(() => {})
  }

  const endGame = () => {
    statusRef.current = 'over'
    setStatus('over')
    cancelAnimationFrame(rafRef.current)
    const finalScore = scoreRef.current
    if (finalScore > best) {
      setBest(finalScore)
      try {
        localStorage.setItem('jj-flutter-best', String(finalScore))
      } catch {
        // Fine -- just won't remember the new best.
      }
    }

    // Only logged-in accounts can hold the global #1 spot -- a guest score
    // just comes back 401 and nothing else happens.
    fetch('/api/flutter/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: finalScore })
    })
      .then((r) => {
        setLoggedIn(r.status !== 401)
        return r.ok ? r.json() : null
      })
      .then((d) => {
        if (d?.isTopScorer) setIsTopScorer(true)
      })
      .catch(() => {})
  }

  const submitMessage = () => {
    const trimmed = messageDraft.trim()
    if (!trimmed) return
    setSubmittingMessage(true)
    setMessageError(null)
    fetch('/api/flutter/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed })
    })
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => {
        if (ok) {
          setMessageSaved(true)
          setTopMessage(trimmed)
        } else {
          setMessageError(d.error || 'Could not save message')
        }
      })
      .catch(() => setMessageError('Could not save message'))
      .finally(() => setSubmittingMessage(false))
  }

  useEffect(() => {
    if (status !== 'playing') return

    let lastTimestamp: number | null = null

    const loop = (timestamp: number) => {
      if (lastTimestamp === null) lastTimestamp = timestamp
      const dtScale = Math.min(MAX_DT_SCALE, (timestamp - lastTimestamp) / BASELINE_FRAME_MS)
      lastTimestamp = timestamp

      const pipeSpeed = Math.min(BASE_PIPE_SPEED + scoreRef.current * SPEED_RAMP_PER_POINT, MAX_PIPE_SPEED) * dtScale

      birdVelocityRef.current = Math.min(MAX_FALL_VELOCITY, birdVelocityRef.current + GRAVITY * dtScale)
      birdYRef.current += birdVelocityRef.current * dtScale
      setBirdRotation(Math.max(-25, Math.min(75, birdVelocityRef.current * 4)))

      const birdTop = birdYRef.current + HITBOX_INSET
      const birdBottom = birdYRef.current + BIRD_SIZE - HITBOX_INSET
      const birdLeft = BIRD_X + HITBOX_INSET
      const birdRight = BIRD_X + BIRD_SIZE - HITBOX_INSET
      let hit = birdBottom >= dims.height || birdTop <= 0

      pipesRef.current = pipesRef.current.map((pipe) => {
        const x = pipe.x - pipeSpeed
        const inXRange = x < birdRight && x + PIPE_WIDTH > birdLeft
        if (inXRange) {
          const gapTop = pipe.gapY - PIPE_GAP / 2
          const gapBottom = pipe.gapY + PIPE_GAP / 2
          if (birdTop < gapTop || birdBottom > gapBottom) hit = true
        }
        let passed = pipe.passed
        if (!passed && x + PIPE_WIDTH < BIRD_X) {
          passed = true
          scoreRef.current += 1
          setScore(scoreRef.current)
          if (!milestoneHitRef.current && scoreRef.current >= MILESTONE_SCORE) {
            milestoneHitRef.current = true
            awardMilestone()
          }
        }
        return { ...pipe, x, passed }
      })

      if (pipesRef.current[0] && pipesRef.current[0].x < -PIPE_WIDTH) {
        const maxX = Math.max(...pipesRef.current.map((p) => p.x))
        const lastGap = pipesRef.current[pipesRef.current.length - 1].gapY
        pipesRef.current.shift()
        pipesRef.current.push({ x: maxX + PIPE_SPACING, gapY: nextGapY(lastGap), passed: false })
      }

      setPipes([...pipesRef.current])
      setBirdY(birdYRef.current)

      if (hit) {
        endGame()
        return
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dims.height])

  const handleInput = () => {
    if (status === 'ready' || status === 'over') startGame()
    else flap()
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-gradient-to-b from-black via-purple-950 to-black"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
      >
        Close ✕
      </button>

      <div className="pointer-events-none absolute top-4 left-1/2 z-[101] -translate-x-1/2 text-center">
        <h2 className="text-xl font-bold text-accent drop-shadow-[0_0_10px_rgba(57,255,20,0.6)] sm:text-2xl">
          🦋 999 Flutter
        </h2>
        <p className="mt-1 font-mono text-sm text-white">Score: {score} &nbsp;·&nbsp; Best: {best}</p>
      </div>

      {milestoneToast && (
        <div className="pointer-events-none absolute top-20 left-1/2 z-[101] -translate-x-1/2 rounded-full border border-accent/40 bg-black/90 px-4 py-2 text-sm text-white">
          {milestoneToast}
        </div>
      )}

      {status === 'playing' && topMessage && (
        <p className="pointer-events-none absolute top-1/2 left-1/2 z-0 w-[80%] max-w-sm -translate-x-1/2 -translate-y-1/2 text-center font-mono text-2xl font-bold text-accent/5 sm:text-3xl">
          {topMessage}
        </p>
      )}

      <div
        ref={containerRef}
        className="absolute inset-0 z-10 cursor-pointer"
        onPointerDown={handleInput}
      >
        {dims.width > 0 &&
          pipes.map((pipe, i) => (
            <div key={i}>
              <div
                className="absolute rounded-b-lg border-2 border-accent/60 bg-accent/10"
                style={{
                  left: pipe.x,
                  top: 0,
                  width: PIPE_WIDTH,
                  height: Math.max(pipe.gapY - PIPE_GAP / 2, 0),
                  boxShadow: '0 0 12px rgba(57,255,20,0.4)'
                }}
              />
              <div
                className="absolute rounded-t-lg border-2 border-accent/60 bg-accent/10"
                style={{
                  left: pipe.x,
                  top: pipe.gapY + PIPE_GAP / 2,
                  width: PIPE_WIDTH,
                  bottom: 0,
                  boxShadow: '0 0 12px rgba(57,255,20,0.4)'
                }}
              />
            </div>
          ))}

        {dims.width > 0 && (
          <div className="absolute" style={{ left: BIRD_X, top: birdY }}>
            <PlayerSprite type={selectedType} rotation={birdRotation} />
          </div>
        )}
      </div>

      {status !== 'playing' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 px-6 text-center">
          {status === 'ready' && caughtTypes.length > 0 && (
            <div
              className="pointer-events-auto mb-2 flex flex-wrap items-center justify-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedType('flutter')}
                className={`rounded-full border-2 p-1.5 text-accent transition-transform ${selectedType === 'flutter' ? 'scale-110 border-accent' : 'border-white/20'}`}
              >
                <FlutterBird rotation={0} />
              </button>
              {CREATURES.filter((c) => caughtTypes.includes(c.type)).map((c) => (
                <button
                  key={c.type}
                  onClick={() => setSelectedType(c.type)}
                  style={{ color: c.hex }}
                  className={`rounded-full border-2 p-1.5 transition-transform ${selectedType === c.type ? 'scale-110 border-current' : 'border-white/20'}`}
                  title={c.name}
                >
                  <CreatureSvg type={c.type} size={28} />
                </button>
              ))}
            </div>
          )}
          <p className="text-2xl font-bold text-white">
            {status === 'ready' ? 'Tap to Flutter' : 'Game Over'}
          </p>
          {status === 'over' && (
            <>
              <p className="font-mono text-white/80">Score: {score} &nbsp;·&nbsp; Best: {best}</p>
              {isTopScorer && !messageSaved && (
                <div
                  className="pointer-events-auto mt-1 flex w-full max-w-xs flex-col items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-semibold text-accent">
                    🏆 You&apos;re #1! Leave a message everyone will see:
                  </p>
                  <input
                    type="text"
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    maxLength={100}
                    placeholder="Something positive..."
                    className="w-full rounded-full border border-accent/40 bg-black/70 px-4 py-2 text-center text-sm text-white outline-none focus:border-accent"
                  />
                  {messageError && <p className="text-xs text-red-400">{messageError}</p>}
                  <button
                    onClick={submitMessage}
                    disabled={submittingMessage || !messageDraft.trim()}
                    className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                  >
                    {submittingMessage ? 'Saving...' : 'Save Message'}
                  </button>
                </div>
              )}
              {isTopScorer && messageSaved && (
                <p className="text-xs text-accent/80">Message saved -- everyone will see it now.</p>
              )}
              {!isTopScorer && !loggedIn && score > 0 && (
                <p className="text-xs text-white/50">Sign in to claim #1 and leave your own message.</p>
              )}
            </>
          )}
          <p className="mt-2 text-sm text-white/60">Tap anywhere to {status === 'ready' ? 'start' : 'try again'}</p>
        </div>
      )}
    </div>
  )
}
