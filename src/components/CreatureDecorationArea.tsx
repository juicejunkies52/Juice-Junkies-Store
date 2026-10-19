'use client'

import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import { CREATURES } from '../../lib/creatures'
import CreatureSvg from './CreatureSvg'
import NeonSketchPaywall from './NeonSketchPaywall'
import NeonSketchCanvas from './NeonSketchCanvas'

interface TrackedCreature {
  id: string
  type: string
  body: Matter.Body
  radius: number
  dragging: boolean
}

interface Props {
  caughtTypes: string[]
  visitorId: string
  onClose: () => void
}

export default function CreatureDecorationArea({ caughtTypes, visitorId, onClose }: Props) {
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }> | null>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Neon Sketch: a paid extra layered behind the creatures. "drawing"
  // toggles whether the canvas or the creatures get pointer input, since
  // trying to drag a creature and draw a line at the same time doesn't work.
  const [sketchUnlocked, setSketchUnlocked] = useState(false)
  const [sketchImage, setSketchImage] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    fetch(`/api/creatures/decorations${visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : ''}`)
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, { x: number; y: number }> = {}
        for (const dec of d.decorations || []) {
          map[dec.creatureType] = { x: dec.x, y: dec.y }
        }
        setSavedPositions(map)
      })
      .catch(() => setSavedPositions({}))

    fetch('/api/digital/status?feature=neon-sketch')
      .then((r) => r.json())
      .then((d) => setSketchUnlocked(!!d.unlocked))
      .catch(() => {})
  }, [visitorId])

  useEffect(() => {
    if (!sketchUnlocked) return
    fetch('/api/sketch')
      .then((r) => r.json())
      .then((d) => setSketchImage(d.imageData || null))
      .catch(() => {})
  }, [sketchUnlocked])

  const owned = CREATURES.filter((c) => caughtTypes.includes(c.type))

  useEffect(() => {
    if (!savedPositions || owned.length === 0) return

    const width = window.innerWidth
    const height = window.innerHeight
    const wallThickness = 80

    const engine = Matter.Engine.create()
    engine.gravity.x = 0
    engine.gravity.y = 1

    const walls = [
      Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width * 2, wallThickness, { isStatic: true }),
      Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width * 2, wallThickness, { isStatic: true }),
      Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true }),
      Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true })
    ]
    Matter.World.add(engine.world, walls)

    const tracked: TrackedCreature[] = []
    const cleanupFns: (() => void)[] = []

    itemRefs.current.forEach((el, type) => {
      const rect = el.getBoundingClientRect()
      const radius = Math.max(rect.width, rect.height) / 2 || 20
      const body = Matter.Bodies.circle(rect.left + radius, rect.top + radius, radius, {
        label: type,
        restitution: 0.5,
        friction: 0.3,
        frictionAir: 0.015,
        density: 0.0012
      })
      Matter.World.add(engine.world, body)

      const entry: TrackedCreature = { id: type, type, body, radius, dragging: false }
      tracked.push(entry)

      let activePointerId: number | null = null
      let constraint: Matter.Constraint | null = null

      const saveSoon = () => {
        fetch('/api/creatures/decorations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId, creatureType: type, x: body.position.x, y: body.position.y })
        }).catch(() => {})
      }

      const endDrag = () => {
        if (!entry.dragging) return
        entry.dragging = false
        activePointerId = null
        el.style.zIndex = ''
        if (constraint) {
          Matter.World.remove(engine.world, constraint)
          constraint = null
        }
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)
        saveSoon()
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
        activePointerId = e.pointerId
        el.style.zIndex = '10'
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

    let rafId: number
    let lastTime = performance.now()
    const loop = (time: number) => {
      const delta = Math.min(time - lastTime, 33)
      lastTime = time
      Matter.Engine.update(engine, delta)

      tracked.forEach(({ id, body, radius }) => {
        const el = itemRefs.current.get(id)
        if (el) {
          el.style.transform = `translate(${body.position.x - radius}px, ${body.position.y - radius}px) rotate(${body.angle}rad)`
        }
      })

      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      cleanupFns.forEach((fn) => fn())
      Matter.World.clear(engine.world, false)
      Matter.Engine.clear(engine)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPositions, owned.length])

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black/95 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
      {sketchImage && (
        <img src={sketchImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      )}

      {!drawing && (
        <>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
          >
            Close ✕
          </button>

          <button
            onClick={() => setDrawing(true)}
            className="absolute top-4 right-32 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent"
          >
            🖊️ Neon Sketch
          </button>

          <div className="pointer-events-none absolute top-4 left-1/2 z-[101] -translate-x-1/2 px-4 text-center">
            <h2 className="text-xl font-bold text-accent drop-shadow-[0_0_10px_rgba(57,255,20,0.6)] sm:text-2xl">
              🎨 Your Creatures
            </h2>
            <p className="mt-1 text-xs text-white/70 sm:text-sm">Drag them around -- it remembers where you leave them.</p>
          </div>
        </>
      )}

      {owned.length === 0 && !drawing ? (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-white/60">Catch a creature first, then come decorate with it.</p>
        </div>
      ) : (
        owned.map((creature, i) => {
          const saved = savedPositions?.[creature.type]
          const fallbackX = 15 + ((i * 17) % 70)
          const fallbackY = 30 + ((i * 13) % 40)
          return (
            <div
              key={creature.type}
              ref={(el) => {
                if (el) itemRefs.current.set(creature.type, el)
                else itemRefs.current.delete(creature.type)
              }}
              className={`absolute top-0 left-0 text-accent select-none [-webkit-tap-highlight-color:transparent] ${
                drawing ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'
              }`}
              style={{
                color: creature.hex,
                transform: saved
                  ? `translate(${saved.x}px, ${saved.y}px)`
                  : `translate(${fallbackX}vw, ${fallbackY}vh)`
              }}
            >
              <div className="absolute -inset-3" />
              <CreatureSvg type={creature.type} size={44} />
            </div>
          )
        })
      )}

      {drawing && (
        sketchUnlocked ? (
          <NeonSketchCanvas
            onRequestClose={() => {
              setDrawing(false)
              fetch('/api/sketch')
                .then((r) => r.json())
                .then((d) => setSketchImage(d.imageData || null))
                .catch(() => {})
            }}
          />
        ) : (
          <div className="absolute inset-0 z-[102] flex flex-col items-center justify-center gap-4 px-4">
            <NeonSketchPaywall onUnlocked={() => setSketchUnlocked(true)} />
            <button onClick={() => setDrawing(false)} className="text-sm text-white/60 hover:text-white">
              Never mind
            </button>
          </div>
        )
      )}
    </div>
  )
}
