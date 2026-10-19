'use client'

import { useEffect, useRef, useState } from 'react'

const NEON_COLORS = ['#39ff14', '#c084fc', '#60a5fa', '#f472b6', '#facc15', '#ffffff']

export default function NeonSketchCanvas({ onRequestClose }: { onRequestClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState(NEON_COLORS[0])
  const [brushSize, setBrushSize] = useState(4)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    fetch('/api/sketch')
      .then((r) => r.json())
      .then((d) => {
        if (d.imageData) {
          const img = new Image()
          img.onload = () => {
            const ctx = canvas.getContext('2d')
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
          }
          img.src = d.imageData
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const getPoint = (e: PointerEvent | React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const draw = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.shadowColor = color
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    drawingRef.current = true
    const point = getPoint(e)
    lastPointRef.current = point
    draw(point, { x: point.x + 0.1, y: point.y + 0.1 })
    try {
      canvasRef.current?.setPointerCapture(e.pointerId)
    } catch {
      // Harmless.
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || !lastPointRef.current) return
    e.preventDefault()
    const point = getPoint(e)
    draw(lastPointRef.current, point)
    lastPointRef.current = point
  }

  const endStroke = () => {
    drawingRef.current = false
    lastPointRef.current = null
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setSaving(true)
    try {
      await fetch('/api/sketch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: canvas.toDataURL('image/png') })
      })
    } catch {
      // Fine -- they can try saving again.
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[102] touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
      />

      <div className="pointer-events-auto fixed bottom-6 left-1/2 z-[103] -translate-x-1/2 flex items-center gap-3 rounded-full border border-accent/40 bg-black/85 px-4 py-3 backdrop-blur-md">
        {NEON_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white' : 'border-white/30'}`}
            style={{ background: c, boxShadow: `0 0 8px ${c}` }}
            title={c}
          />
        ))}
        <input
          type="range"
          min={2}
          max={16}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-20"
          title="Brush size"
        />
        <button
          onClick={handleClear}
          className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:border-white/40"
        >
          Clear
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <button
        onClick={async () => {
          await handleSave()
          onRequestClose()
        }}
        disabled={saving}
        className="fixed top-4 right-20 z-[120] rounded-full border border-accent/50 bg-black/80 px-4 py-2 text-sm text-white transition-colors hover:border-accent disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Done Drawing'}
      </button>
    </>
  )
}
