/**
 * Tiny particle engine for the festival screens: real fireworks (rocket, trail,
 * burst, gravity, glitter), sparkle bursts and gentle snow. One canvas, runs on
 * the visitor's device, stops itself when the screen closes.
 */

type Kind = 'peony' | 'willow' | 'ring' | 'crackle' | 'heart'

interface P {
  x: number; y: number; px: number; py: number
  vx: number; vy: number
  life: number; max: number
  color: string; size: number
  drag: number; grav: number
  glitter: boolean; trail: boolean
  crackle: boolean
}

interface Rocket { x: number; y: number; vx: number; vy: number; color: string; kind: Kind; alt: string }

interface Flake { x: number; y: number; r: number; s: number; ph: number; a: number }

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

export const FW_COLORS = ['#ffd166', '#ff6b6b', '#ff8fd8', '#7ee8fa', '#a78bfa', '#80ed99', '#ffb347', '#ffffff']

export class FestiveFx {
  private c: HTMLCanvasElement
  private out: CanvasRenderingContext2D
  private trail: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D // draws into the trail layer
  private dpr = 1
  private W = 0
  private H = 0
  private raf = 0
  private last = 0
  private ps: P[] = []
  private rockets: Rocket[] = []
  private flakes: Flake[] = []
  private flashes: { x: number; y: number; r: number; color: string; life: number }[] = []
  private autoTimer = 0
  private autoOn = false
  private dead = false
  private max: number
  /** set by the screen to play sounds: name + horizontal position 0..1 */
  onSound: ((name: 'launch' | 'boom' | 'crackle', x: number) => void) | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.c = canvas
    this.out = canvas.getContext('2d')!
    this.trail = document.createElement('canvas')
    this.ctx = this.trail.getContext('2d')!
    const mobile = window.innerWidth < 768
    this.max = mobile ? 900 : 1800
    this.resize()
    window.addEventListener('resize', this.resize)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    this.dead = true
    cancelAnimationFrame(this.raf)
    window.clearTimeout(this.autoTimer)
    window.removeEventListener('resize', this.resize)
  }

  private resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    const r = this.c.getBoundingClientRect()
    this.W = r.width
    this.H = r.height
    this.c.width = this.trail.width = Math.round(this.W * this.dpr)
    this.c.height = this.trail.height = Math.round(this.H * this.dpr)
  }

  /* ── fireworks ── */

  launch(tx?: number, ty?: number, kind?: Kind, color?: string) {
    const W = this.W
    const H = this.H
    const x0 = tx !== undefined ? tx + rand(-60, 60) : rand(W * 0.15, W * 0.85)
    const tX = tx ?? x0 + rand(-80, 80)
    const tY = ty ?? rand(H * 0.12, H * 0.42)
    const g = 420
    const vy = -Math.sqrt(2 * g * Math.max(60, H - tY))
    const t = -vy / g
    this.rockets.push({
      x: x0, y: H + 6, vx: (tX - x0) / t, vy,
      color: color ?? pick(FW_COLORS),
      kind: kind ?? pick<Kind>(['peony', 'peony', 'willow', 'ring', 'crackle', 'peony']),
      alt: pick(FW_COLORS),
    })
    this.onSound?.('launch', x0 / Math.max(1, W))
  }

  /** Burst right where you are (used for taps). */
  burst(x: number, y: number, kind: Kind = 'peony', color = pick(FW_COLORS), alt = pick(FW_COLORS), withSound = false) {
    if (withSound) {
      this.onSound?.('boom', x / Math.max(1, this.W))
      if (kind === 'crackle' || kind === 'willow' || Math.random() < 0.3) this.onSound?.('crackle', x / Math.max(1, this.W))
    }
    const scale = Math.min(1, Math.max(0.6, this.W / 1200))
    this.flashes.push({ x, y, r: 160 * scale, color, life: 0 })
    const n = kind === 'willow' ? 70 : kind === 'ring' ? 56 : kind === 'heart' ? 64 : 96
    const speed = (kind === 'willow' ? 190 : 260) * scale
    for (let i = 0; i < n && this.ps.length < this.max; i++) {
      let vx: number
      let vy: number
      if (kind === 'ring') {
        const a = (i / n) * Math.PI * 2
        vx = Math.cos(a) * speed
        vy = Math.sin(a) * speed * 0.62
      } else if (kind === 'heart') {
        const t = (i / n) * Math.PI * 2
        vx = (16 * Math.pow(Math.sin(t), 3)) * speed / 17
        vy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * speed / 17
      } else {
        const a = Math.random() * Math.PI * 2
        const s = speed * Math.pow(Math.random(), 0.45)
        vx = Math.cos(a) * s
        vy = Math.sin(a) * s
      }
      const willow = kind === 'willow'
      this.ps.push({
        x, y, px: x, py: y, vx, vy, life: 0,
        max: willow ? rand(2.2, 3.2) : rand(1.1, 1.9),
        color: willow ? (Math.random() < 0.8 ? '#ffcf70' : '#fff3c4') : i % 3 === 0 ? alt : color,
        size: willow ? 1.4 : rand(1.4, 2.4),
        drag: willow ? 2.4 : 1.25,
        grav: willow ? 60 : 110,
        glitter: kind === 'crackle' || Math.random() < 0.18,
        trail: true,
        crackle: kind === 'crackle',
      })
    }
  }

  /** Soft golden sparkles (star tap, diya ignition). */
  sparkle(x: number, y: number, count = 40, colors = ['#fff7d1', '#ffd166', '#ffb347']) {
    for (let i = 0; i < count && this.ps.length < this.max; i++) {
      const a = Math.random() * Math.PI * 2
      const s = rand(30, 220)
      this.ps.push({
        x, y, px: x, py: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
        life: 0, max: rand(0.6, 1.4), color: pick(colors), size: rand(1, 2.6),
        drag: 2.2, grav: 70, glitter: true, trail: false, crackle: false,
      })
    }
  }

  autoFireworks(on: boolean) {
    this.autoOn = on
    window.clearTimeout(this.autoTimer)
    if (!on) return
    const tick = () => {
      if (this.dead || !this.autoOn) return
      if (!document.hidden) {
        this.launch()
        if (Math.random() < 0.3) window.setTimeout(() => this.launch(), 180)
      }
      this.autoTimer = window.setTimeout(tick, rand(650, 1500))
    }
    tick()
  }

  /* ── snow ── */

  snow(count: number) {
    this.flakes = Array.from({ length: count }, () => ({
      x: Math.random() * this.W, y: Math.random() * this.H, r: rand(0.8, 3.4), s: rand(20, 70), ph: rand(0, 6.28), a: rand(0.45, 0.95),
    }))
  }

  /* ── loop ── */

  private frame = (now: number) => {
    if (this.dead) return
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    // fade the previous frame instead of clearing: gives light trails, keeps transparency
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,0.24)'
    ctx.fillRect(0, 0, this.W, this.H)
    ctx.globalCompositeOperation = 'lighter'

    // flashes light up the sky around a burst
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]
      f.life += dt
      const k = f.life / 0.45
      if (k >= 1) { this.flashes.splice(i, 1); continue }
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (0.6 + k))
      g.addColorStop(0, hexA(f.color, 0.22 * (1 - k)))
      g.addColorStop(1, hexA(f.color, 0))
      ctx.fillStyle = g
      ctx.fillRect(f.x - f.r * 2, f.y - f.r * 2, f.r * 4, f.r * 4)
    }

    // rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]
      const ox = r.x
      const oy = r.y
      r.vy += 420 * dt
      r.x += r.vx * dt
      r.y += r.vy * dt
      ctx.strokeStyle = 'rgba(255,220,160,0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(ox, oy)
      ctx.lineTo(r.x, r.y)
      ctx.stroke()
      if (Math.random() < 0.9 && this.ps.length < this.max) {
        this.ps.push({ x: r.x, y: r.y, px: r.x, py: r.y, vx: rand(-20, 20), vy: rand(10, 60), life: 0, max: rand(0.3, 0.6), color: '#ffcf8a', size: 1.2, drag: 3, grav: 60, glitter: true, trail: false, crackle: false })
      }
      if (r.vy >= -20) {
        this.rockets.splice(i, 1)
        this.burst(r.x, r.y, r.kind, r.color, r.alt, true)
      }
    }

    // particles
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i]
      p.life += dt
      if (p.life >= p.max) {
        if (p.crackle && this.ps.length < this.max) {
          for (let k = 0; k < 4; k++) {
            this.ps.push({ x: p.x, y: p.y, px: p.x, py: p.y, vx: rand(-70, 70), vy: rand(-70, 70), life: 0, max: rand(0.12, 0.3), color: '#ffffff', size: 1.1, drag: 4, grav: 0, glitter: false, trail: false, crackle: false })
          }
        }
        this.ps.splice(i, 1)
        continue
      }
      p.px = p.x
      p.py = p.y
      const d = Math.exp(-p.drag * dt)
      p.vx *= d
      p.vy = p.vy * d + p.grav * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      const k = p.life / p.max
      let a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
      if (p.glitter && k > 0.45) a *= Math.random() < 0.5 ? 1 : 0.15
      if (p.trail) {
        ctx.strokeStyle = hexA(p.color, a)
        ctx.lineWidth = p.size
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(p.px, p.py)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      } else {
        ctx.fillStyle = hexA(p.color, a)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.globalCompositeOperation = 'source-over'

    // compose: fireworks layer (with trails), then crisp snow on top
    const out = this.out
    out.setTransform(1, 0, 0, 1, 0, 0)
    out.clearRect(0, 0, this.c.width, this.c.height)
    out.drawImage(this.trail, 0, 0)
    if (this.flakes.length) {
      out.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      const t = now / 1000
      for (const f of this.flakes) {
        f.y += f.s * dt
        f.x += Math.sin(t * 0.8 + f.ph) * 14 * dt + 6 * dt
        if (f.y > this.H + 5) { f.y = -5; f.x = Math.random() * this.W }
        if (f.x > this.W + 5) f.x = -5
        const g = out.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 1.6)
        g.addColorStop(0, `rgba(255,255,255,${f.a})`)
        g.addColorStop(0.5, `rgba(255,255,255,${f.a * 0.8})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        out.fillStyle = g
        out.beginPath()
        out.arc(f.x, f.y, f.r * 1.6, 0, Math.PI * 2)
        out.fill()
      }
    }
  }
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`
}
