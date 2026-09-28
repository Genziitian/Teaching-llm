'use client'

import React, { useEffect, useRef } from 'react'

interface Leaf {
  x: number
  y: number
  size: number
  fallSpeed: number
  swaySpeed: number
  angle: number
  rotationSpeed: number
  rotation: number
  wind: number
  color: string
  opacity: number
  veinColor: string
}

// Spring-themed leaf palette: fresh lime, tender mint, emerald, soft golden leaf, spring bud green
const LEAF_COLORS = [
  { fill: '#4ade80', vein: '#22c55e' }, // Fresh Green
  { fill: '#86efac', vein: '#4ade80' }, // Tender Spring Green
  { fill: '#34d399', vein: '#10b981' }, // Mint Emerald
  { fill: '#a3e635', vein: '#84cc16' }, // Spring Bud Lime
  { fill: '#facc15', vein: '#eab308' }, // Golden Sunlight Leaf
  { fill: '#6ee7b7', vein: '#34d399' }, // Soft Aqua Leaf
]

export default function SpringLeavesBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    // Generate 32 falling spring leaves
    const LEAF_COUNT = Math.min(36, Math.floor(window.innerWidth / 40))
    const leaves: Leaf[] = Array.from({ length: LEAF_COUNT }, () => {
      const palette = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]
      return {
        x: Math.random() * width,
        y: Math.random() * height - height, // Start scattered above & across screen
        size: 10 + Math.random() * 14,
        fallSpeed: 0.8 + Math.random() * 1.4,
        swaySpeed: 0.015 + Math.random() * 0.025,
        angle: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.03,
        rotation: Math.random() * Math.PI * 2,
        wind: 0.3 + Math.random() * 0.6,
        color: palette.fill,
        veinColor: palette.vein,
        opacity: 0.35 + Math.random() * 0.45,
      }
    })

    const drawLeaf = (leaf: Leaf) => {
      ctx.save()
      ctx.translate(leaf.x, leaf.y)
      ctx.rotate(leaf.rotation)
      ctx.globalAlpha = leaf.opacity

      // Draw elegant leaf shape using bezier curves
      const s = leaf.size
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.bezierCurveTo(s * 0.65, -s * 0.4, s * 0.65, s * 0.4, 0, s)
      ctx.bezierCurveTo(-s * 0.65, s * 0.4, -s * 0.65, -s * 0.4, 0, -s)
      ctx.fillStyle = leaf.color
      ctx.shadowColor = leaf.color
      ctx.shadowBlur = 8
      ctx.fill()

      // Leaf central vein
      ctx.beginPath()
      ctx.moveTo(0, -s * 0.75)
      ctx.lineTo(0, s * 0.75)
      ctx.strokeStyle = leaf.veinColor
      ctx.lineWidth = 1.2
      ctx.stroke()

      ctx.restore()
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i]
        leaf.angle += leaf.swaySpeed
        leaf.x += Math.sin(leaf.angle) * 1.2 + leaf.wind
        leaf.y += leaf.fallSpeed
        leaf.rotation += leaf.rotationSpeed

        // Wrap around bottom
        if (leaf.y > height + 30) {
          leaf.y = -30
          leaf.x = Math.random() * width
        }
        // Wrap around right edge
        if (leaf.x > width + 30) {
          leaf.x = -30
        }

        drawLeaf(leaf)
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        width: '100vw',
        height: '100vh',
      }}
    />
  )
}
