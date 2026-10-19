'use client'

import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'

const GOALS_NEEDED = 25
const BUTTERFLY_COUNT = 5
const NEON = '#39ff14'

function MiniButterflySvg() {
  return (
    <svg width="32" height="32" viewBox="0 0 40 40" className="drop-shadow-[0_0_6px_currentColor]">
      <line x1="20" y1="5" x2="20" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20,15 Q8,8 5,15 Q8,22 20,20" fill="currentColor" fillOpacity="0.75" stroke="currentColor" strokeWidth="1.2" />
      <path d="M20,15 Q32,8 35,15 Q32,22 20,20" fill="currentColor" fillOpacity="0.75" stroke="currentColor" strokeWidth="1.2" />
      <path d="M20,20 Q12,25 8,30 Q12,35 20,30" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.2" />
      <path d="M20,20 Q28,25 32,30 Q28,35 20,30" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

interface TrackedFly {
  id: number
  body: Matter.Body
  radius: number
  dragging: boolean
  // Anti-cheese: a release only becomes a scorable "launch" if it happens
  // below the rim (so you can't just carry it up by hand and drop it in),
  // and it only becomes scorable for real once it's cleared the rim height
  // under its own momentum afterward.
  launchedBelowRim: boolean
  clearedRim: boolean
  // How many points this shot is worth, locked in at the moment of
  // release based on how far from the hoop it was thrown from.
  shotValue: number
}

interface Props {
  onComplete: () => void
  onDraggingChange?: (dragging: boolean) => void
}

export default function SecretBasketballGame({ onComplete, onDraggingChange }: Props) {
  const [goals, setGoals] = useState(0)
  const [flash, setFlash] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const hoopRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const goalsRef = useRef(0)

  // Keep the latest callbacks in refs so the physics effect below can call
  // them without needing them in its dependency array -- the inline
  // arrow functions passed in from the parent are a new reference every
  // render, and including them as deps was tearing down and rebuilding
  // the whole engine (and every drag listener) mid-drag.
  const onCompleteRef = useRef(onComplete)
  const onDraggingChangeRef = useRef(onDraggingChange)
  useEffect(() => {
    onCompleteRef.current = onComplete
    onDraggingChangeRef.current = onDraggingChange
  }, [onComplete, onDraggingChange])

  useEffect(() => {
    if (!hoopRef.current) return

    const width = window.innerWidth
    const height = window.innerHeight
    const wallThickness = 80

    const engine = Matter.Engine.create()
    engine.gravity.x = 0
    engine.gravity.y = 1

    // No ceiling -- a hard shot should be free to arc up off-screen and
    // fall back down like a real shot, not bonk off an invisible lid.
    const walls = [
      Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width * 2, wallThickness, { isStatic: true }),
      Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true }),
      Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true })
    ]
    Matter.World.add(engine.world, walls)

    const hoopRect = hoopRef.current.getBoundingClientRect()
    const rimY = hoopRect.top + hoopRect.height * 0.2
    const sensor = Matter.Bodies.rectangle(
      hoopRect.left + hoopRect.width / 2,
      hoopRect.top + hoopRect.height * 0.55,
      hoopRect.width * 0.55,
      8,
      { isStatic: true, isSensor: true, label: 'hoop-sensor' }
    )
    const rimLeft = Matter.Bodies.circle(hoopRect.left + hoopRect.width * 0.12, rimY, 4, { isStatic: true, restitution: 0.8 })
    const rimRight = Matter.Bodies.circle(hoopRect.left + hoopRect.width * 0.88, rimY, 4, { isStatic: true, restitution: 0.8 })
    Matter.World.add(engine.world, [sensor, rimLeft, rimRight])

    const tracked: TrackedFly[] = []
    const cleanupFns: (() => void)[] = []

    itemRefs.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect()
      const radius = Math.max(rect.width, rect.height) / 2
      const body = Matter.Bodies.circle(rect.left + radius, rect.top + radius, radius, {
        label: `fly-${id}`,
        restitution: 0.5,
        friction: 0.2,
        frictionAir: 0.01,
        density: 0.0015
      })
      Matter.World.add(engine.world, body)

      const entry: TrackedFly = { id, body, radius, dragging: false, launchedBelowRim: false, clearedRim: false, shotValue: 1 }
      tracked.push(entry)

      let activePointerId: number | null = null
      let constraint: Matter.Constraint | null = null

      // "Balancing" one -- everyone else fades out and stops accepting
      // input, so there's exactly one butterfly in play until you shoot.
      const setOthersHidden = (hidden: boolean) => {
        itemRefs.current.forEach((otherEl, otherId) => {
          if (otherId === id) return
          otherEl.style.opacity = hidden ? '0' : '1'
          otherEl.style.pointerEvents = hidden ? 'none' : 'auto'
        })
      }

      const endDrag = () => {
        if (!entry.dragging) return
        entry.dragging = false
        activePointerId = null
        el.style.zIndex = ''
        setOthersHidden(false)
        setIsDragging(false)
        onDraggingChangeRef.current?.(false)
        // A real shot has to start from below the rim -- carrying it up by
        // hand and dropping it in from directly above the net doesn't count.
        entry.launchedBelowRim = body.position.y > rimY
        entry.clearedRim = false
        // Harder shots (further from the hoop) are worth more -- bottom
        // third of the screen is a "3," middle is a "2," close in near the
        // rim is a "1."
        entry.shotValue = body.position.y > height * 0.66 ? 3 : body.position.y > height * 0.33 ? 2 : 1
        if (constraint) {
          Matter.World.remove(engine.world, constraint)
          constraint = null
        }
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)
      }

      const onPointerMove = (e: PointerEvent) => {
        if (!entry.dragging || e.pointerId !== activePointerId || !constraint) return
        e.preventDefault()
        constraint.pointA = { x: e.clientX, y: e.clientY }
      }
      const onPointerUp = (e: PointerEvent) => {
        if (e.pointerId !== activePointerId) return
        endDrag()
      }
      const onPointerCancel = (e: PointerEvent) => {
        if (e.pointerId !== activePointerId) return
        endDrag()
      }
      const onPointerDown = (e: PointerEvent) => {
        e.preventDefault()
        entry.dragging = true
        entry.launchedBelowRim = false
        entry.clearedRim = false
        activePointerId = e.pointerId
        el.style.zIndex = '10'
        setOthersHidden(true)
        setIsDragging(true)
        onDraggingChangeRef.current?.(true)
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          // Harmless -- drag still works via the window-level listeners.
        }
        constraint = Matter.Constraint.create({
          bodyB: body,
          pointA: { x: e.clientX, y: e.clientY },
          pointB: { x: 0, y: 0 },
          length: 0,
          stiffness: 0.85,
          damping: 0.25
        })
        Matter.World.add(engine.world, constraint)
        window.addEventListener('pointermove', onPointerMove, { passive: false })
        window.addEventListener('pointerup', onPointerUp, { passive: false })
        window.addEventListener('pointercancel', onPointerCancel, { passive: false })
      }

      el.style.touchAction = 'none'
      el.addEventListener('pointerdown', onPointerDown, { passive: false })
      cleanupFns.push(() => {
        el.removeEventListener('pointerdown', onPointerDown)
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)
        if (constraint) Matter.World.remove(engine.world, constraint)
      })
    })

    // A make only counts falling THROUGH the net (moving down) after a
    // real launch from below that actually cleared the rim -- not just
    // clipping the sensor on a dropped-in or grazing pass.
    const handleScore = (event: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA
        const b = pair.bodyB
        const sensorBody = a.label === 'hoop-sensor' ? a : b.label === 'hoop-sensor' ? b : null
        const flyBody = a.label.startsWith('fly-') ? a : b.label.startsWith('fly-') ? b : null
        if (!sensorBody || !flyBody) continue
        if (flyBody.velocity.y <= 0) continue

        const entry = tracked.find((t) => t.body === flyBody)
        if (!entry || !entry.launchedBelowRim || !entry.clearedRim) continue

        entry.launchedBelowRim = false
        entry.clearedRim = false

        goalsRef.current += entry.shotValue
        setGoals(goalsRef.current)
        setFlash(true)
        setTimeout(() => setFlash(false), 300)

        Matter.Body.setPosition(flyBody, { x: width / 2 + (Math.random() - 0.5) * 120, y: height * 0.65 })
        Matter.Body.setVelocity(flyBody, { x: 0, y: 0 })

        if (goalsRef.current >= GOALS_NEEDED) {
          onCompleteRef.current()
        }
        break
      }
    }
    Matter.Events.on(engine, 'collisionStart', handleScore)

    let rafId: number
    let lastTime = performance.now()
    const loop = (time: number) => {
      const delta = Math.min(time - lastTime, 33)
      lastTime = time
      Matter.Engine.update(engine, delta)

      tracked.forEach((t) => {
        const el = itemRefs.current.get(t.id)
        if (el) {
          el.style.transform = `translate(${t.body.position.x - t.radius}px, ${t.body.position.y - t.radius}px) rotate(${t.body.angle}rad)`
        }
        // Mark it as having genuinely cleared the rim once it's risen
        // above that height during a legitimate below-the-rim launch.
        if (!t.dragging && t.launchedBelowRim && !t.clearedRim && t.body.position.y < rimY) {
          t.clearedRim = true
        }
      })

      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      Matter.Events.off(engine, 'collisionStart', handleScore)
      cleanupFns.forEach((fn) => fn())
      Matter.World.clear(engine.world, false)
      Matter.Engine.clear(engine)
    }
  }, [])

  const butterflyIds = Array.from({ length: BUTTERFLY_COUNT }, (_, i) => i)

  return (
    <div className="absolute inset-0 z-[110]" onClick={(e) => e.stopPropagation()}>
      {!isDragging && (
        <div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 px-4 text-center">
          <p className="text-xs text-white/70 sm:text-sm">Balance a butterfly, then shoot it in the hoop</p>
          <p className="mt-1 font-mono text-lg text-accent">🏀 {goals}/{GOALS_NEEDED} pts</p>
        </div>
      )}

      {/* Point zones -- farther from the hoop is worth more. Purely a
          visual guide; the actual boundary logic lives in the release
          handler above (height * 0.33 / 0.66). */}
      {!isDragging && (
        <div className="pointer-events-none absolute inset-x-0" style={{ top: '33vh' }}>
          <div className="border-t border-dashed border-accent/25" />
          <span className="absolute right-3 top-1 font-mono text-xs text-accent/50">2 pts</span>
        </div>
      )}
      {!isDragging && (
        <div className="pointer-events-none absolute inset-x-0" style={{ top: '66vh' }}>
          <div className="border-t border-dashed border-accent/25" />
          <span className="absolute right-3 top-1 font-mono text-xs text-accent/50">3 pts</span>
        </div>
      )}

      <div ref={hoopRef} className="pointer-events-none absolute top-56 left-1/2 -translate-x-1/2" style={{ width: 120, height: 90 }}>
        <svg width="120" height="90" viewBox="0 0 120 90" className={flash ? 'animate-pulse' : ''}>
          <ellipse
            cx="60" cy="18" rx="45" ry="9"
            fill="none" stroke={NEON} strokeWidth="3"
            style={{ filter: `drop-shadow(0 0 8px ${NEON})` }}
          />
          {[15, 30, 45, 60, 75, 90, 105].map((x, i) => (
            <line
              key={i}
              x1={x} y1={20 + Math.abs(x - 60) * 0.05}
              x2={x - (x - 60) * 0.12} y2={58 + Math.abs(x - 60) * 0.1}
              stroke={NEON} strokeWidth="1.5" opacity="0.65"
            />
          ))}
        </svg>
      </div>

      {butterflyIds.map((id) => (
        <div
          key={id}
          ref={(el) => {
            if (el) itemRefs.current.set(id, el)
            else itemRefs.current.delete(id)
          }}
          className="absolute top-0 left-0 cursor-grab text-accent select-none [-webkit-tap-highlight-color:transparent] active:cursor-grabbing"
          style={{ transform: `translate(${15 + id * 16}vw, 60vh)` }}
        >
          <div className="absolute -inset-3" />
          <MiniButterflySvg />
        </div>
      ))}
    </div>
  )
}
