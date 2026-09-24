'use client'

import { useEffect, useRef, useState } from 'react'

const PLAY_PACKAGE = 'com.teaching.lms'
const PLAY_REFERRER = 'utm_source=capacitor&utm_medium=sunset_banner'
const PLAY_LISTING_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&referrer=${encodeURIComponent(PLAY_REFERRER)}`

type PlayInlineBridge = {
  openOfficialApp?: () => void
}

/**
 * Full-screen sunset notice for the Capacitor shell only.
 * `Capacitor.isNativePlatform()` is false in the browser and in the PWA.
 */
export default function CapacitorPlayStoreBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!cancelled && (Capacitor.isNativePlatform() || isPlayBannerPreview())) {
          setVisible(true)
        }
      } catch {
        if (!cancelled && isPlayBannerPreview()) setVisible(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="play-store-sunset-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px calc(32px + env(safe-area-inset-bottom))',
        paddingTop: 'calc(32px + env(safe-area-inset-top))',
        background: 'radial-gradient(circle at 50% 0%, #fff4d6 0%, #ffffff 46%, #eef8f3 100%)',
        color: '#1e1e3a',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      <CelebrationCanvas />
      <img
        src="/mobile-login-logo.png"
        alt="GenZ IITIAN"
        style={{ width: 148, height: 'auto', marginBottom: 28, position: 'relative', zIndex: 1 }}
      />

      <p
        style={{
          margin: '0 0 14px',
          position: 'relative',
          zIndex: 1,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#01875f',
        }}
      >
        Google Play Store
      </p>

      <h1
        id="play-store-sunset-title"
        style={{
          margin: 0,
          position: 'relative',
          zIndex: 1,
          maxWidth: 420,
          fontSize: 26,
          lineHeight: 1.25,
          fontWeight: 800,
          textShadow: '0 0 16px #ffffff, 0 0 6px #ffffff',
        }}
      >
        We are very proud to announce that our official app is now live on the Google Play Store.
      </h1>

      <p
        style={{
          margin: '18px 0 0',
          position: 'relative',
          zIndex: 1,
          maxWidth: 380,
          fontSize: 16,
          lineHeight: 1.5,
          color: '#4b5563',
          textShadow: '0 0 16px #ffffff, 0 0 6px #ffffff',
        }}
      >
        We are closing this app. Please click the button to download the app.
      </p>

      <button
        type="button"
        onClick={() => {
          void openOfficialPlayListing()
        }}
        style={{
          marginTop: 32,
          position: 'relative',
          zIndex: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          minWidth: 260,
          minHeight: 56,
          padding: '0 22px',
          border: 'none',
          borderRadius: 14,
          background: '#111111',
          color: '#ffffff',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <PlayGlyph />
        Download the app
      </button>
    </div>
  )
}

async function openOfficialPlayListing() {
  const nativeBridge = (window as unknown as { GenZPlayInline?: PlayInlineBridge }).GenZPlayInline
  if (typeof nativeBridge?.openOfficialApp === 'function') {
    nativeBridge.openOfficialApp()
    return
  }

  try {
    const { App } = await import('@capacitor/app')
    await App.openUrl({ url: PLAY_LISTING_URL })
    return
  } catch {
    // Older shells, or a device without a handler for the listing URL.
  }

  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url: PLAY_LISTING_URL })
    return
  } catch {
    window.location.href = PLAY_LISTING_URL
  }
}

function isPlayBannerPreview() {
  return (
    process.env.NODE_ENV === 'development' &&
    new URLSearchParams(window.location.search).has('preview-play-banner')
  )
}

const CRACKER_COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ff2d55', '#ff9500', '#bf5af2', '#ffd60a']

type CrackerBit = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rot: number
  spin: number
  color: string
  life: number
  max: number
  gravity: number
  drag: number
  shape: 'rect' | 'star' | 'streak' | 'ring'
}

function CelebrationCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let frame = 0
    let raf = 0
    let running = true
    const bits: CrackerBit[] = []

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const burst = (x: number, y: number, power = 1) => {
      const count = Math.floor(26 * power + Math.random() * 16)
      bits.push({
        x, y, vx: 0, vy: 0, size: 6, rot: 0, spin: 0,
        color: '#fff6c2', life: 0, max: 18, gravity: 0, drag: 1, shape: 'ring',
      })
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
        const speed = (2.4 + Math.random() * 6.5) * power
        bits.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 5,
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.35,
          color: CRACKER_COLORS[i % CRACKER_COLORS.length],
          life: 0,
          max: 46 + Math.random() * 36,
          gravity: 0.07 + Math.random() * 0.05,
          drag: 0.986,
          shape: Math.random() > 0.72 ? 'star' : Math.random() > 0.45 ? 'streak' : 'rect',
        })
      }
    }

    const sprinkle = () => {
      bits.push({
        x: Math.random() * window.innerWidth,
        y: -16,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 1.4 + Math.random() * 2.4,
        size: 5 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.18,
        color: CRACKER_COLORS[(Math.random() * CRACKER_COLORS.length) | 0],
        life: 0,
        max: 360,
        gravity: 0.015,
        drag: 0.999,
        shape: 'rect',
      })
    }

    const width = window.innerWidth
    const height = window.innerHeight
    burst(width * 0.18, height * 0.22, 1.35)
    burst(width * 0.82, height * 0.18, 1.35)
    burst(width * 0.5, height * 0.12, 1.55)
    burst(width * 0.12, height * 0.7, 1.15)
    burst(width * 0.88, height * 0.66, 1.15)
    burst(width * 0.35, height * 0.48, 1)
    burst(width * 0.68, height * 0.55, 1)
    for (let i = 0; i < 90; i++) sprinkle()

    const drawStar = (radius: number) => {
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
        const method = i === 0 ? 'moveTo' : 'lineTo'
        ctx[method](Math.cos(angle) * radius, Math.sin(angle) * radius)
      }
      ctx.closePath()
      ctx.fill()
    }

    const tick = () => {
      if (!running) return
      const viewWidth = window.innerWidth
      const viewHeight = window.innerHeight
      ctx.clearRect(0, 0, viewWidth, viewHeight)
      frame += 1
      if (bits.length < 420) {
        sprinkle()
        sprinkle()
        sprinkle()
      }
      if (frame % 28 === 0) {
        burst(
          viewWidth * (0.08 + Math.random() * 0.84),
          viewHeight * (0.06 + Math.random() * 0.78),
          0.8 + Math.random() * 0.7
        )
      }

      for (let i = bits.length - 1; i >= 0; i--) {
        const bit = bits[i]
        bit.life += 1
        bit.vx *= bit.drag
        bit.vy = bit.vy * bit.drag + bit.gravity
        bit.x += bit.vx
        bit.y += bit.vy
        bit.rot += bit.spin
        const alpha = Math.max(0, 1 - bit.life / bit.max)
        if (alpha <= 0 || bit.y > viewHeight + 30) {
          bits.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.translate(bit.x, bit.y)
        ctx.rotate(bit.rot)
        ctx.globalAlpha = alpha
        ctx.fillStyle = bit.color
        ctx.strokeStyle = bit.color
        if (bit.shape === 'star') {
          drawStar(bit.size)
        } else if (bit.shape === 'streak') {
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(-bit.vx * 1.6, -bit.vy * 1.6)
          ctx.stroke()
        } else if (bit.shape === 'ring') {
          ctx.globalAlpha = alpha * 0.85
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(0, 0, bit.life * 3.4, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          ctx.fillRect(-bit.size / 2, -bit.size / 5, bit.size, bit.size / 2.4)
        }
        ctx.restore()
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}

function PlayGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#34A853" d="M3.5 20.5 14.2 12 3.5 3.5v17z" />
      <path fill="#FBBC04" d="M3.5 20.5 14.2 12l3.2 2.6-13.9 5.9z" />
      <path fill="#EA4335" d="M3.5 3.5 17.4 9.4 14.2 12 3.5 3.5z" />
      <path fill="#4285F4" d="M17.4 9.4 20.5 11c.7.4.7 1.6 0 2l-3.1 1.6L14.2 12l3.2-2.6z" />
    </svg>
  )
}
