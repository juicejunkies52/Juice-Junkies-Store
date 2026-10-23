'use client'

import { useEffect, useRef } from 'react'

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Note: the floating "999" numbers used to be drawn here too, but canvas
    // pixels can't be individually grabbed/dragged -- they now live as real
    // draggable elements in EnhancedButterflies instead. This canvas is just
    // the ambient gradient wash behind everything.

    // The gradient itself never changes, so this used to run inside a
    // requestAnimationFrame loop for no reason -- a full-viewport gradient
    // fill every frame, forever, repainting identical pixels. Draw it once
    // and only redraw on resize.
    const draw = () => {
      const canvasWidth = window.innerWidth
      const canvasHeight = window.innerHeight
      canvas.width = canvasWidth
      canvas.height = canvasHeight

      const gradient = ctx.createRadialGradient(
        canvasWidth / 2, canvasHeight / 2, 0,
        canvasWidth / 2, canvasHeight / 2, canvasWidth / 2
      )
      gradient.addColorStop(0, 'rgba(106, 13, 173, 0.05)')
      gradient.addColorStop(0.5, 'rgba(10, 10, 10, 0.8)')
      gradient.addColorStop(1, 'rgba(57, 255, 20, 0.02)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    }

    draw()
    window.addEventListener('resize', draw)

    return () => {
      window.removeEventListener('resize', draw)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ background: 'transparent' }}
    />
  )
}