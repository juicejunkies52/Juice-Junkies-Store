'use client'

import { useEffect, useRef } from 'react'

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Floating 999 Numbers
    class Float999 {
      x: number
      y: number
      vx: number
      vy: number
      size: number
      color: string
      opacity: number
      rotation: number
      rotationSpeed: number
      life: number
      maxLife: number

      constructor() {
        this.x = Math.random() * canvas.width
        this.y = canvas.height + 50 // Start below screen
        this.vx = (Math.random() - 0.5) * 0.8
        this.vy = -0.3 - Math.random() * 0.5 // Float upward
        this.size = 20 + Math.random() * 30
        this.color = Math.random() > 0.5 ? '#6a0dad' : '#39ff14'
        this.opacity = 0.1 + Math.random() * 0.3
        this.rotation = Math.random() * Math.PI * 2
        this.rotationSpeed = (Math.random() - 0.5) * 0.02
        this.life = 0
        this.maxLife = Math.random() * 1000 + 800
      }

      update() {
        this.x += this.vx
        this.y += this.vy
        this.rotation += this.rotationSpeed
        this.life++

        // Slight drift and floating motion
        this.vx += (Math.random() - 0.5) * 0.01
        this.vy += (Math.random() - 0.5) * 0.005

        // Boundaries - wrap horizontally, reset vertically
        if (this.x < -50) this.x = canvas.width + 50
        if (this.x > canvas.width + 50) this.x = -50

        // Reset when it goes off top or life expires
        if (this.y < -100 || this.life > this.maxLife) {
          this.y = canvas.height + 50
          this.x = Math.random() * canvas.width
          this.life = 0
        }
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.globalAlpha = this.opacity
        ctx.translate(this.x, this.y)
        ctx.rotate(this.rotation)

        // Draw glowing 999
        ctx.font = `bold ${this.size}px 'Orbitron', monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Glow effect
        ctx.shadowColor = this.color
        ctx.shadowBlur = 15
        ctx.fillStyle = this.color
        ctx.fillText('999', 0, 0)

        // Extra glow layers
        ctx.shadowBlur = 5
        ctx.fillText('999', 0, 0)

        ctx.restore()
      }
    }

    // Create floating 999s
    const float999s: Float999[] = []
    for (let i = 0; i < 15; i++) {
      float999s.push(new Float999())
    }

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw subtle gradient background
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
      )
      gradient.addColorStop(0, 'rgba(106, 13, 173, 0.05)')
      gradient.addColorStop(0.5, 'rgba(10, 10, 10, 0.8)')
      gradient.addColorStop(1, 'rgba(57, 255, 20, 0.02)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Update and draw floating 999s
      float999s.forEach(float999 => {
        float999.update()
        float999.draw(ctx)
      })

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
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