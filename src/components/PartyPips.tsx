'use client'

/**
 * Party Pips — Lightweight, high-performance canvas particle burst
 * Creates a delightful celebration burst of colorful party pips / confetti.
 */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
  opacity: number
  shape: 'circle' | 'square' | 'pip'
}

const CELEBRATION_COLORS = [
  '#6366f1', // Indigo
  '#4f46e5', // Deep Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber / Gold
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ef4444', // Crimson Coral
]

export function triggerPartyPips(targetOrEvent?: HTMLElement | React.MouseEvent | { x: number; y: number } | null) {
  if (typeof window === 'undefined') return

  let originX = window.innerWidth / 2
  let originY = window.innerHeight / 2

  if (targetOrEvent) {
    if ('clientX' in targetOrEvent && typeof targetOrEvent.clientX === 'number') {
      originX = targetOrEvent.clientX
      originY = targetOrEvent.clientY
    } else if ('getBoundingClientRect' in targetOrEvent && typeof targetOrEvent.getBoundingClientRect === 'function') {
      const rect = targetOrEvent.getBoundingClientRect()
      originX = rect.left + rect.width / 2
      originY = rect.top + rect.height / 2
    } else if ('x' in targetOrEvent && typeof targetOrEvent.x === 'number') {
      originX = targetOrEvent.x
      originY = targetOrEvent.y
    }
  }

  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '99999'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }

  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr

  const particleCount = 45
  const particles: Particle[] = []

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.random() * Math.PI * 2)
    const speed = 4 + Math.random() * 8
    const shapes: ('circle' | 'square' | 'pip')[] = ['circle', 'square', 'pip']
    particles.push({
      x: originX * dpr,
      y: originY * dpr,
      vx: Math.cos(angle) * speed * (0.8 + Math.random() * 0.4),
      vy: Math.sin(angle) * speed * (0.8 + Math.random() * 0.4) - 3, // Initial upward pop
      size: (6 + Math.random() * 6) * dpr,
      color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.25,
      opacity: 1,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    })
  }

  let animationFrameId: number
  const startTime = Date.now()
  const duration = 1600 // 1.6 seconds

  function animate() {
    const elapsed = Date.now() - startTime
    const progress = elapsed / duration

    if (progress >= 1) {
      canvas.remove()
      return
    }

    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.22 * dpr // Gravity
      p.vx *= 0.98 // Air resistance
      p.rotation += p.rotationSpeed
      p.opacity = Math.max(0, 1 - progress)

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.globalAlpha = p.opacity
      ctx.fillStyle = p.color

      if (p.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.shape === 'square') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
      } else {
        // Pip / ribbon pill
        ctx.beginPath()
        ctx.roundRect(-p.size, -p.size / 2.5, p.size * 2, p.size / 1.3, p.size / 3)
        ctx.fill()
      }

      ctx.restore()
    }

    animationFrameId = requestAnimationFrame(animate)
  }

  animationFrameId = requestAnimationFrame(animate)
}
