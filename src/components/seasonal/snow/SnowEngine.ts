/**
 * SnowEngine: realistic snowfall, snow that settles on cards and text, and a
 * feather duster to brush it off. One <canvas>, no dependencies, runs entirely
 * on the visitor's device.
 *
 * How it stays light:
 * - One canvas, one requestAnimationFrame loop, pre-rendered flake sprites.
 * - Only cards on screen (IntersectionObserver) are measured and drawn.
 * - Stops while the tab is hidden or a video is fullscreen.
 * - Watches its own frame time and sheds flakes or detail on slow devices.
 *
 * Which elements collect snow:
 * - boxes: anything matching `capSelector` (cards, stat cards...) or [data-snow]
 * - text:  [data-snow="text"] or `textCapSelector`. Snow follows the real
 *          outline of each letter, measured from the font itself.
 * - opt out: [data-no-snow] on an element or any ancestor.
 */

export interface SnowEngineOptions {
  /** 0..1, how heavy the snowfall is today (see seasons.ts). */
  amount: number
  capSelector: string
  /** looser match (e.g. any box with the site's card shadow); skipped when inside another snowy box */
  autoSelector?: string
  textCapSelector: string
  excludeSelector: string
  /** 'scattered' fills the screen at once (page load); 'fromTop' starts falling in. */
  startMode: 'scattered' | 'fromTop'
  onFirstDust?: () => void
}

type ThemeName = 'light' | 'dark' | 'black'

interface Flake {
  x: number
  y: number
  prevY: number
  layer: 0 | 1 | 2
  size: number
  speed: number
  swayAmp: number
  swayFreq: number
  phase: number
  alpha: number
  sprite: number
  depth: number
  alive: boolean
}

interface Cap {
  el: Element
  kind: 'box' | 'text'
  colW: number
  n: number
  h: Float32Array
  maxH: Float32Array
  base: Float32Array // surface offset below the element's top edge (NaN = nothing to sit on)
  grow: Float32Array // per-column growth jitter
  peak: number
  layoutW: number
  layoutH: number
  left: number
  top: number
  baseMin: number
  baseMax: number
  hClip: Element[]
  vClip: Element[]
  cl: number
  ct: number
  cr: number
  cb: number
  visible: boolean
  onScreen: boolean
  dirty: boolean
  sparkles: { i: number; phase: number; speed: number }[]
  gradKey: string
  grad: CanvasGradient | null
  /** each card gets its own amount, drift and lumps so no two look alike */
  pers: { seed: number; scale: number; tilt: number; grow: number; fill: number; mounds: { x: number; w: number; h: number }[] }
  /** 1 where something (sidebar, menu, popup) covers this part of the element */
  occ: Uint8Array
}

interface Puff {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  kind: 0 | 1
}

interface Palette {
  top: string
  mid: string
  bottom: string
  shadow: string
  edge: string
  edgeW: number
  sparkle: string
}

const PALETTES: Record<ThemeName, Palette> = {
  light: { top: '#ffffff', mid: '#f2f6fb', bottom: '#d3deeb', shadow: 'rgba(71,85,105,0.34)', edge: 'rgba(255,255,255,0)', edgeW: 0, sparkle: '#ffffff' },
  dark: { top: '#ffffff', mid: '#eef3fa', bottom: '#b4c3d8', shadow: 'rgba(0,0,0,0.40)', edge: 'rgba(255,255,255,0.95)', edgeW: 0.9, sparkle: '#ffffff' },
  black: { top: '#f8fbff', mid: '#e6edf6', bottom: '#a9b9cf', shadow: 'rgba(0,0,0,0.55)', edge: 'rgba(255,255,255,0.9)', edgeW: 0.9, sparkle: '#ffffff' },
}

const LAYERS = [
  { share: 0.56, size: [1.1, 2.4], speed: [16, 30], sway: [4, 9], alpha: [0.35, 0.65], depth: 0.45 },
  { share: 0.32, size: [2.4, 4.2], speed: [30, 52], sway: [8, 16], alpha: [0.65, 0.9], depth: 0.75 },
  { share: 0.12, size: [5, 9.5], speed: [56, 92], sway: [14, 28], alpha: [0.5, 0.78], depth: 1.0 },
] as const

const FEATHERS = ['#fbefe4', '#f2cdb6', '#e9ae94', '#fff7ef', '#de947c', '#f5dccb', '#eab8a2', '#fdf4ea', '#e3a088']

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Seeded 1D value noise, for the lumpy surface of settled snow. */
function makeNoise(seed: number) {
  const pts: number[] = []
  let s = seed
  for (let i = 0; i < 64; i++) {
    s = (s * 16807) % 2147483647
    pts.push(s / 2147483647)
  }
  return (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const a = pts[((i % 64) + 64) % 64]
    const b = pts[(((i + 1) % 64) + 64) % 64]
    const u = f * f * (3 - 2 * f)
    return a + (b - a) * u
  }
}

export class SnowEngine {
  private opts: SnowEngineOptions
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private mctx: CanvasRenderingContext2D // for measuring text
  private dpr = 1
  private W = 0
  private H = 0
  private raf = 0
  private last = 0
  private t = 0
  private running = false
  private stopping = false
  private stopAt = 0
  private destroyed = false

  private theme: ThemeName = 'light'
  private pal: Palette = PALETTES.light
  private sprites: HTMLCanvasElement[][] = [[], [], []]

  private flakes: Flake[] = []
  private targetCount = 0
  private quality = 2 // 2 high, 1 medium, 0 low
  private frameAvg = 16
  private slowFor = 0
  private fastFor = 0
  private isMobile = false

  private caps = new Map<Element, Cap>()
  private visibleCaps: Cap[] = []
  private io: IntersectionObserver | null = null
  private mo: MutationObserver | null = null
  private themeMo: MutationObserver | null = null
  private rescanTimer = 0
  private rectCache = new Map<Element, DOMRect>()
  private glyphCache = new Map<string, { left: number; prof: Float32Array; asc: number }>()

  private puffs: Puff[] = []
  /** invisible strip at the bottom of the screen (or on top of the mobile nav) where snow piles up */
  private ground: HTMLDivElement | null = null
  private frameNo = 0
  /** rects of things snow must not be drawn over (sidebar, open menus) */
  private blockers: { l: number; t: number; r: number; b: number }[] = []
  private modalOpen = false

  // wind
  private gustStart = -100
  private gustAmp = 0
  private nextGust = 6

  // pointer + duster
  private px = -1000
  private py = -1000
  private pvx = 0
  private pvy = 0
  private pLastT = 0
  private pType = 'mouse'
  private pActive = false
  private pDown = false
  private overSnow = false
  private overUntil = 0
  private dusterA = 0
  private tilt = -0.6
  private featherLag = -0.6
  private featherVel = 0
  private dusted = false
  private cursorHidden = false

  constructor(opts: SnowEngineOptions) {
    this.opts = opts
    this.canvas = document.createElement('canvas')
    this.canvas.setAttribute('aria-hidden', 'true')
    this.canvas.dataset.seasonal = 'snow'
    Object.assign(this.canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '950',
      opacity: '0',
      transition: 'opacity 1.4s ease',
    } as Partial<CSSStyleDeclaration>)
    this.ctx = this.canvas.getContext('2d')!
    this.mctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings)!
    this.isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || ((navigator as any).deviceMemory || 8) <= 4
    if (this.isMobile || lowEnd) this.quality = 1
  }

  /* ───────────────────────── lifecycle ───────────────────────── */

  start() {
    if (this.running || this.destroyed) return
    this.running = true
    document.body.appendChild(this.canvas)
    this.readTheme()
    this.resize()
    this.spawnInitial(this.opts.startMode)
    this.setupObservers()
    this.ground = document.createElement('div')
    this.ground.setAttribute('aria-hidden', 'true')
    this.ground.dataset.seasonal = 'snow-ground'
    Object.assign(this.ground.style, { position: 'fixed', left: '0', right: '0', height: '40px', top: '100vh', pointerEvents: 'none', visibility: 'hidden' } as Partial<CSSStyleDeclaration>)
    document.body.appendChild(this.ground)
    this.placeGround()
    this.rescan()
    window.addEventListener('resize', this.resize, { passive: true })
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true })
    window.addEventListener('pointerup', this.onPointerUp, { passive: true })
    window.addEventListener('pointercancel', this.onPointerUp, { passive: true })
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave)
    document.addEventListener('visibilitychange', this.onVisibility)
    document.addEventListener('fullscreenchange', this.onVisibility)
    const fonts = (document as any).fonts
    if (fonts?.ready) fonts.ready.then(() => this.markTextDirty()).catch(() => {})
    if (fonts?.addEventListener) fonts.addEventListener('loadingdone', this.markTextDirty)
    requestAnimationFrame(() => { this.canvas.style.opacity = '1' })
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  /** Graceful stop: flakes stop spawning, settled snow melts, then everything is removed. */
  stop() {
    if (!this.running || this.stopping) return
    this.stopping = true
    this.stopAt = this.t
    this.setCursorHidden(false)
    window.setTimeout(() => { this.canvas.style.opacity = '0' }, 900)
    window.setTimeout(() => this.destroy(), 2400)
  }

  setAmount(amount: number) {
    this.opts.amount = clamp(amount, 0, 1)
    this.computeTargetCount()
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.running = false
    cancelAnimationFrame(this.raf)
    window.clearTimeout(this.rescanTimer)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave)
    document.removeEventListener('visibilitychange', this.onVisibility)
    document.removeEventListener('fullscreenchange', this.onVisibility)
    const fonts = (document as any).fonts
    if (fonts?.removeEventListener) fonts.removeEventListener('loadingdone', this.markTextDirty)
    this.io?.disconnect()
    this.mo?.disconnect()
    this.themeMo?.disconnect()
    this.setCursorHidden(false)
    this.caps.clear()
    this.ground?.remove()
    this.canvas.remove()
  }

  /* ───────────────────────── setup ───────────────────────── */

  private resize = () => {
    this.placeGround()
    const maxDpr = this.quality === 2 ? 2 : 1.5
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
    this.W = window.innerWidth
    this.H = window.innerHeight
    this.canvas.width = Math.round(this.W * this.dpr)
    this.canvas.height = Math.round(this.H * this.dpr)
    this.buildSprites()
    this.computeTargetCount()
  }

  private computeTargetCount() {
    const area = this.W * this.H
    const max = this.isMobile ? 110 : 240
    const qMul = this.quality === 2 ? 1 : this.quality === 1 ? 0.7 : 0.45
    const full = Math.min(max, area / 6500) * qMul
    const a = this.opts.amount
    this.targetCount = Math.round(clamp(full * (0.08 + 0.92 * a), 10, max))
  }

  private readTheme() {
    const t = document.documentElement.getAttribute('data-theme')
    this.theme = t === 'dark' || t === 'black' ? t : 'light'
    this.pal = PALETTES[this.theme]
    this.caps.forEach(c => { c.gradKey = '' })
  }

  private buildSprites() {
    const light = this.theme === 'light'
    const mk = (px: number, soft: number, clump: boolean) => {
      const c = document.createElement('canvas')
      c.width = c.height = px
      const g = c.getContext('2d')!
      const blob = (cx: number, cy: number, r: number) => {
        if (light && soft < 0.7) {
          // big out-of-focus foreground flakes: one soft cool puff, no bright core (no ring look)
          const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r)
          gr.addColorStop(0, 'rgba(226,234,245,0.95)')
          gr.addColorStop(0.45, 'rgba(196,209,228,0.7)')
          gr.addColorStop(1, 'rgba(176,192,216,0)')
          g.fillStyle = gr
          g.beginPath()
          g.arc(cx, cy, r, 0, Math.PI * 2)
          g.fill()
          return
        }
        if (light) {
          // against a white page a flake reads as a soft, cool blue-grey puff with a bright centre
          const gr = g.createRadialGradient(cx - r * 0.18, cy - r * 0.2, 0, cx, cy, r)
          gr.addColorStop(0, 'rgba(255,255,255,1)')
          gr.addColorStop(0.22 * soft, 'rgba(246,249,253,1)')
          gr.addColorStop(0.5, 'rgba(184,199,222,0.85)')
          gr.addColorStop(0.78, 'rgba(150,169,198,0.35)')
          gr.addColorStop(1, 'rgba(150,169,198,0)')
          g.fillStyle = gr
          g.beginPath()
          g.arc(cx, cy, r, 0, Math.PI * 2)
          g.fill()
          return
        }
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r)
        gr.addColorStop(0, 'rgba(255,255,255,1)')
        gr.addColorStop(0.38 * soft, 'rgba(255,255,255,0.92)')
        gr.addColorStop(0.68, 'rgba(226,236,250,0.38)')
        gr.addColorStop(1, 'rgba(226,236,250,0)')
        g.fillStyle = gr
        g.beginPath()
        g.arc(cx, cy, r, 0, Math.PI * 2)
        g.fill()
      }
      const r = px / 2
      if (clump && !light) {
        const parts = 3 + Math.floor(Math.random() * 3)
        for (let i = 0; i < parts; i++) {
          const a = Math.random() * Math.PI * 2
          const d = Math.random() * r * 0.32
          blob(r + Math.cos(a) * d, r + Math.sin(a) * d, r * rand(0.48, 0.66))
        }
      } else {
        blob(r, r, r)
      }
      return c
    }
    const d = this.dpr
    this.sprites = [
      [mk(Math.ceil(5 * 2 * d), 1.2, false), mk(Math.ceil(5 * 2 * d), 1, false)],
      [mk(Math.ceil(9 * 2 * d), 1, false), mk(Math.ceil(9 * 2 * d), 0.8, true), mk(Math.ceil(9 * 2 * d), 0.9, true)],
      [mk(Math.ceil(19 * 2 * d), 0.55, true), mk(Math.ceil(19 * 2 * d), 0.5, true), mk(Math.ceil(19 * 2 * d), 0.6, true), mk(Math.ceil(19 * 2 * d), 0.45, false)],
    ]
  }

  private makeFlake(scattered: boolean): Flake {
    const amt = this.opts.amount
    // heavier days bring a few more big foreground flakes
    const nearShare = LAYERS[2].share * (0.6 + amt * 0.7)
    const r = Math.random()
    const layer: 0 | 1 | 2 = r < nearShare ? 2 : r < nearShare + LAYERS[1].share ? 1 : 0
    const L = LAYERS[layer]
    const size = rand(L.size[0], L.size[1])
    const f: Flake = {
      x: rand(-40, this.W + 40),
      y: scattered ? rand(-20, this.H) : rand(-this.H * 0.9, -10),
      prevY: 0,
      layer,
      size,
      speed: rand(L.speed[0], L.speed[1]) * (0.85 + amt * 0.3),
      swayAmp: rand(L.sway[0], L.sway[1]),
      swayFreq: rand(0.35, 1.1),
      phase: rand(0, Math.PI * 2),
      alpha: rand(L.alpha[0], L.alpha[1]),
      sprite: Math.floor(Math.random() * this.sprites[layer].length),
      depth: L.depth * rand(0.85, 1.15),
      alive: true,
    }
    f.prevY = f.y
    return f
  }

  private spawnInitial(mode: 'scattered' | 'fromTop') {
    this.flakes = []
    for (let i = 0; i < this.targetCount; i++) this.flakes.push(this.makeFlake(mode === 'scattered'))
  }

  private setupObservers() {
    this.io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const cap = this.caps.get(e.target)
        if (cap) cap.onScreen = e.isIntersecting
      }
      this.refreshVisible()
    }, { rootMargin: '60px' })

    this.mo = new MutationObserver(muts => {
      let structural = false
      for (const m of muts) {
        if (m.type === 'childList') structural = true
        this.caps.forEach(cap => {
          if (cap.kind === 'text' && cap.el.contains(m.target)) cap.dirty = true
        })
      }
      if (structural) this.scheduleRescan()
    })
    this.mo.observe(document.body, { childList: true, subtree: true, characterData: true })

    this.themeMo = new MutationObserver(() => {
      this.readTheme()
      this.buildSprites()
    })
    this.themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }

  private scheduleRescan() {
    if (this.rescanTimer) return
    this.rescanTimer = window.setTimeout(() => {
      this.rescanTimer = 0
      this.rescan()
    }, 350)
  }

  private markTextDirty = () => {
    this.glyphCache.clear()
    this.caps.forEach(c => { if (c.kind === 'text') c.dirty = true })
  }

  /** Find elements that should collect snow; keep existing snow on ones we already track. */
  private placeGround() {
    if (!this.ground) return
    let y = window.innerHeight
    const nav = document.querySelector('.mobile-bottom-nav')
    if (nav) {
      const r = nav.getBoundingClientRect()
      const cs = getComputedStyle(nav)
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 0 && r.top < window.innerHeight && !nav.classList.contains('hidden')) y = r.top
    }
    this.ground.style.top = `${Math.round(y)}px`
  }

  private rescan() {
    if (this.destroyed) return
    this.placeGround()
    const { capSelector, textCapSelector, excludeSelector } = this.opts
    const found = new Set<Element>()
    const consider = (el: Element, kind: 'box' | 'text') => {
      if (found.has(el)) return
      if (el.closest(excludeSelector)) return
      if (kind === 'box' && el.querySelector('.skeleton, video, iframe')) return
      found.add(el)
      if (!this.caps.has(el)) this.caps.set(el, this.createCap(el, kind))
      else if (this.caps.get(el)!.kind !== kind) this.caps.set(el, this.createCap(el, kind))
    }
    if (this.ground) { found.add(this.ground); if (!this.caps.has(this.ground)) this.caps.set(this.ground, this.createCap(this.ground, 'box')) }
    document.querySelectorAll(textCapSelector).forEach(el => consider(el, 'text'))
    document.querySelectorAll(capSelector).forEach(el => {
      if ((el as HTMLElement).dataset.snow === 'text') return
      consider(el, 'box')
    })
    if (this.opts.autoSelector) {
      const any = `${capSelector}, ${this.opts.autoSelector}`
      document.querySelectorAll(this.opts.autoSelector).forEach(el => {
        if (found.has(el) || el.parentElement?.closest(any)) return
        consider(el, 'box')
      })
    }
    Array.from(this.caps.keys()).forEach(el => {
      if (!found.has(el) || !el.isConnected) {
        this.io?.unobserve(el)
        this.caps.delete(el)
      }
    })
    found.forEach(el => this.io?.observe(el))
    this.refreshVisible()
  }

  private refreshVisible() {
    this.visibleCaps = []
    this.caps.forEach(c => { if (c.onScreen) this.visibleCaps.push(c) })
  }

  private createCap(el: Element, kind: 'box' | 'text'): Cap {
    const hClip: Element[] = []
    const vClip: Element[] = []
    let p = el.parentElement
    while (p && p !== document.body && p !== document.documentElement) {
      const cs = getComputedStyle(p)
      const oy = cs.overflowY
      const ox = cs.overflowX
      if (oy === 'auto' || oy === 'scroll') vClip.push(p)
      else if (ox === 'hidden' || ox === 'clip' || oy === 'hidden' || oy === 'clip') hClip.push(p)
      p = p.parentElement
    }
    return {
      el, kind,
      colW: kind === 'text' ? 1 : this.isMobile ? 4 : 3,
      n: 0,
      h: new Float32Array(0), maxH: new Float32Array(0), base: new Float32Array(0), grow: new Float32Array(0),
      peak: 0, layoutW: -1, layoutH: -1, left: 0, top: 0, baseMin: 0, baseMax: 0,
      hClip, vClip, cl: 0, ct: 0, cr: 0, cb: 0,
      visible: false, onScreen: false, dirty: true, sparkles: [], gradKey: '', grad: null, occ: new Uint8Array(0),
      pers: {
        seed: Math.floor(Math.random() * 100000),
        // a few cards get only a dusting, most a good layer, some a thick pile
        scale: kind === 'text' ? rand(0.65, 1.1) : Math.random() < 0.15 ? rand(0.45, 0.6) : rand(0.7, 1.2),
        // wind-blown: heavier towards one side
        tilt: kind === 'text' ? rand(-0.3, 0.3) : rand(-0.85, 0.85),
        grow: rand(0.55, 1.5),
        fill: rand(0.35, 0.95),
        mounds: Array.from({ length: kind === 'text' || el === this.ground ? 0 : 1 + Math.floor(Math.random() * 3) }, () => ({ x: rand(0.1, 0.9), w: rand(0.06, 0.2), h: rand(0.25, 0.7) })),
      },
    }
  }

  /* ───────────────────────── geometry ───────────────────────── */

  private rect(el: Element): DOMRect {
    let r = this.rectCache.get(el)
    if (!r) { r = el.getBoundingClientRect(); this.rectCache.set(el, r) }
    return r
  }

  private rebuild(cap: Cap, r: DOMRect) {
    const oldH = cap.h
    const oldN = cap.n
    const n = Math.max(2, Math.ceil(r.width / cap.colW) + 1)
    const base = new Float32Array(n).fill(NaN)
    const maxH = new Float32Array(n)
    const grow = new Float32Array(n)
    const noise = makeNoise(cap.pers.seed + 11)
    const isGround = cap.el === this.ground
    if (isGround && !cap.pers.mounds.length) {
      cap.pers.scale = 1
      cap.pers.tilt = 0.9
      cap.pers.grow = 0.7
      cap.pers.fill = 0.55
      cap.pers.mounds = Array.from({ length: 5 }, (_, k) => ({ x: 0.1 + k * 0.2 + rand(-0.06, 0.06), w: rand(0.04, 0.09), h: rand(0.2, 0.55) }))
    }
    const pers = cap.pers
    const amt = this.opts.amount
    let peak = 0

    if (cap.kind === 'box') {
      const cs = getComputedStyle(cap.el)
      const rad = (v: string) => (v.endsWith('%') ? (parseFloat(v) / 100) * r.width : parseFloat(v) || 0)
      const rl = Math.min(rad(cs.borderTopLeftRadius), r.width / 2, r.height / 2)
      const rr = Math.min(rad(cs.borderTopRightRadius), r.width / 2, r.height / 2)
      peak = isGround
        ? (this.isMobile ? 11 : 20) * (0.45 + 0.55 * amt)
        : clamp(r.width * 0.045, this.isMobile ? 8 : 11, this.isMobile ? 15 : 22) * (0.5 + 0.5 * amt)
      for (let i = 0; i < n; i++) {
        const x = Math.min(i * cap.colW, r.width)
        let drop = 0
        if (x < rl) drop = rl - Math.sqrt(Math.max(0, rl * rl - (rl - x) * (rl - x)))
        else if (x > r.width - rr) { const dx = x - (r.width - rr); drop = rr - Math.sqrt(Math.max(0, rr * rr - dx * dx)) }
        base[i] = drop
      }
    } else {
      peak = this.buildTextBase(cap, r, base)
    }

    // Snow only rests where the surface is fairly flat; it slides off steep curves.
    for (let i = 0; i < n; i++) {
      const b = base[i]
      if (Number.isNaN(b)) { maxH[i] = 0; continue }
      const l = Number.isNaN(base[i - 1] ?? NaN) ? b : base[i - 1]
      const rt = Number.isNaN(base[i + 1] ?? NaN) ? b : base[i + 1]
      const slope = Math.abs(rt - l) / (2 * cap.colW)
      const flat = 1 - smooth(0.55, 1.7, slope)
      // taper towards the ends of each surface run
      let edge = 1
      if (cap.kind === 'text') {
        let dl = 0
        let dr = 0
        while (dl < 6 && !Number.isNaN(base[i - dl - 1] ?? NaN)) dl++
        while (dr < 6 && !Number.isNaN(base[i + dr + 1] ?? NaN)) dr++
        edge = smooth(0, 3.5, Math.min(dl, dr) + 0.5)
      }
      const lump = cap.kind === 'box'
        ? 0.62 + 0.26 * noise(i * cap.colW * 0.028) + 0.12 * noise(i * cap.colW * 0.11 + 7)
        : 0.78 + 0.22 * noise(i * 0.3)
      // drift towards one side + a few soft mounds
      const u = clamp((i * cap.colW) / Math.max(1, r.width), 0, 1)
      let shape = Math.max(0.2, 1 + pers.tilt * (u - 0.5) * 1.4)
      for (const m of pers.mounds) { const d = (u - m.x) / m.w; shape += m.h * Math.exp(-d * d) }
      maxH[i] = peak * pers.scale * lump * flat * edge * shape
      grow[i] = (0.6 + 0.8 * noise(i * cap.colW * 0.11 + 30)) * pers.grow
    }
    if (cap.kind === 'box') {
      // rounded, pillow-like ends where the snow meets the corners
      let a = 0
      while (a < n && maxH[a] < 0.5) a++
      let b = n - 1
      while (b > a && maxH[b] < 0.5) b--
      const R = peak * Math.max(0.6, pers.scale) * 1.1
      for (let i = a; i <= b; i++) {
        const d = Math.min(i - a, b - i) * cap.colW
        if (d < R) { const u = 1 - d / R; maxH[i] *= Math.sqrt(Math.max(0, 1 - u * u)) }
      }
    }
    const h = new Float32Array(n)
    if (oldN > 1) {
      for (let i = 0; i < n; i++) {
        const src = (i / (n - 1)) * (oldN - 1)
        const a = Math.floor(src)
        const b = Math.min(oldN - 1, a + 1)
        const v = oldH[a] + (oldH[b] - oldH[a]) * (src - a)
        h[i] = Math.min(v, maxH[i])
      }
    } else {
      // it has been snowing for a while: start with a light layer already settled
      const startFill = this.opts.startMode === 'scattered' ? cap.pers.fill : 0.08
      for (let i = 0; i < n; i++) h[i] = maxH[i] * Math.min(1, startFill * (0.75 + 0.25 * grow[i]))
    }

    let bmin = Infinity
    let bmax = -Infinity
    for (let i = 0; i < n; i++) if (!Number.isNaN(base[i])) { bmin = Math.min(bmin, base[i]); bmax = Math.max(bmax, base[i]) }

    cap.n = n
    cap.h = h
    cap.maxH = maxH
    cap.base = base
    cap.grow = grow
    let realPeak = 0
    for (let i = 0; i < n; i++) if (maxH[i] > realPeak) realPeak = maxH[i]
    cap.peak = Math.max(2, realPeak)
    cap.baseMin = Number.isFinite(bmin) ? bmin : 0
    cap.baseMax = Number.isFinite(bmax) ? bmax : 0
    cap.layoutW = r.width
    cap.layoutH = r.height
    cap.dirty = false
    cap.occ = new Uint8Array(n)
    cap.gradKey = ''
    const sparkleCount = this.quality === 0 ? 0 : Math.max(1, Math.round((r.width / (cap.kind === 'text' ? 40 : 55)) * (this.quality === 2 ? 1 : 0.5)))
    cap.sparkles = Array.from({ length: sparkleCount }, () => ({ i: Math.floor(Math.random() * n), phase: rand(0, 20), speed: rand(0.6, 1.6) }))
  }

  /** Real letter outlines: render each glyph once, scan its top edge column by column. */
  private glyph(font: string, ch: string) {
    const key = font + '|' + ch
    let g = this.glyphCache.get(key)
    if (g) return g
    const m = this.mctx
    m.font = font
    const tm = m.measureText(ch)
    const left = Math.ceil(tm.actualBoundingBoxLeft || 0) + 2
    const w = Math.max(1, Math.ceil(left + (tm.actualBoundingBoxRight || tm.width)) + 2)
    const asc = Math.ceil(tm.actualBoundingBoxAscent || 0) + 2
    const hgt = Math.max(1, asc + Math.ceil(tm.actualBoundingBoxDescent || 0) + 2)
    m.canvas.width = w
    m.canvas.height = hgt
    m.font = font
    m.textBaseline = 'alphabetic'
    m.fillStyle = '#000'
    m.clearRect(0, 0, w, hgt)
    m.fillText(ch, left, asc)
    const data = m.getImageData(0, 0, w, hgt).data
    const prof = new Float32Array(w).fill(NaN)
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < hgt; y++) {
        if (data[(y * w + x) * 4 + 3] > 110) { prof[x] = y - asc; break }
      }
    }
    g = { left: -left, prof, asc }
    this.glyphCache.set(key, g)
    return g
  }

  private buildTextBase(cap: Cap, r: DOMRect, base: Float32Array): number {
    const walker = document.createTreeWalker(cap.el, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    let firstTop: number | null = null
    let fontPx = 16
    let node: Node | null
    while ((node = walker.nextNode())) {
      const text = node.textContent || ''
      const parent = node.parentElement
      if (!parent || !text.trim()) continue
      const cs = getComputedStyle(parent)
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      const size = parseFloat(cs.fontSize) || 16
      fontPx = Math.max(fontPx, size)
      this.mctx.font = font
      const fm = this.mctx.measureText('Hg')
      const fAsc = fm.fontBoundingBoxAscent || size * 0.92
      const fDesc = fm.fontBoundingBoxDescent || size * 0.26
      const tt = cs.textTransform
      for (let k = 0; k < text.length; k++) {
        let ch = text[k]
        if (/\s/.test(ch)) continue
        if (tt === 'uppercase') ch = ch.toUpperCase()
        else if (tt === 'lowercase') ch = ch.toLowerCase()
        range.setStart(node, k)
        range.setEnd(node, k + 1)
        const cr = range.getBoundingClientRect()
        if (!cr.width || !cr.height) continue
        if (firstTop === null) firstTop = cr.top
        else if (cr.top > firstTop + cr.height * 0.6) continue // first line only
        const baseline = cr.top + fAsc * (cr.height / (fAsc + fDesc))
        const g = this.glyph(font, ch)
        for (let px = 0; px < g.prof.length; px++) {
          const p = g.prof[px]
          if (Number.isNaN(p)) continue
          const x = cr.left + g.left + px + 0.5 - r.left
          const i = Math.round(x / cap.colW)
          if (i < 0 || i >= base.length) continue
          const y = baseline + p - r.top
          if (Number.isNaN(base[i]) || y < base[i]) base[i] = y
        }
      }
    }
    // ignore tiny specks (dots on i/j are fine, single pixels are not)
    for (let i = 1; i < base.length - 1; i++) {
      if (!Number.isNaN(base[i]) && Number.isNaN(base[i - 1]) && Number.isNaN(base[i + 1])) base[i] = NaN
    }
    return clamp(fontPx * 0.17, 3, 9.5) * (0.6 + 0.4 * this.opts.amount)
  }

  /* ───────────────────────── input ───────────────────────── */

  private onPointerMove = (e: PointerEvent) => {
    const now = performance.now()
    const dt = Math.max(1, now - this.pLastT) / 1000
    if (this.pLastT && now - this.pLastT < 120) {
      const vx = (e.clientX - this.px) / dt
      const vy = (e.clientY - this.py) / dt
      this.pvx = this.pvx * 0.6 + vx * 0.4
      this.pvy = this.pvy * 0.6 + vy * 0.4
    } else {
      this.pvx = 0
      this.pvy = 0
    }
    this.pLastT = now
    this.px = e.clientX
    this.py = e.clientY
    this.pType = e.pointerType || 'mouse'
    this.pActive = this.pType === 'mouse' || this.pDown
  }
  private onPointerDown = (e: PointerEvent) => {
    this.pDown = true
    this.pType = e.pointerType || 'mouse'
    this.px = e.clientX
    this.py = e.clientY
    this.pLastT = performance.now()
    this.pvx = this.pvy = 0
    this.pActive = true
  }
  private onPointerUp = () => {
    this.pDown = false
    if (this.pType !== 'mouse') this.pActive = false
  }
  private onPointerLeave = () => {
    if (this.pType === 'mouse') this.pActive = false
  }

  private onVisibility = () => {
    const hide = document.hidden || !!document.fullscreenElement
    this.canvas.style.display = document.fullscreenElement ? 'none' : ''
    if (hide) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    } else if (!this.raf && this.running) {
      this.last = performance.now()
      this.raf = requestAnimationFrame(this.frame)
    }
  }

  private setCursorHidden(v: boolean) {
    if (v === this.cursorHidden) return
    this.cursorHidden = v
    document.documentElement.classList.toggle('snow-dusting', v)
  }

  /* ───────────────────────── frame ───────────────────────── */

  private frame = (now: number) => {
    if (this.destroyed) return
    this.raf = requestAnimationFrame(this.frame)
    const raw = now - this.last
    this.last = now
    const dt = Math.min(raw, 50) / 1000
    if (dt <= 0) return
    this.t += dt
    this.monitor(raw)
    this.rectCache.clear()
    // the mobile nav slides away on scroll; keep the ground line on top of it
    if ((this.frameNo = (this.frameNo + 1) % 30) === 0) this.placeGround()

    const wind = this.wind(dt)
    this.updateCaps(dt)
    if (this.frameNo % 12 === 0) this.scanCover()
    this.updateFlakes(dt, wind)
    this.updateDuster(dt)
    this.updatePuffs(dt, wind)
    this.render()
  }

  private monitor(raw: number) {
    if (raw > 200) return // tab switch or hiccup; ignore
    this.frameAvg = this.frameAvg * 0.95 + raw * 0.05
    if (this.frameAvg > 24) { this.slowFor += raw; this.fastFor = 0 } else if (this.frameAvg < 17.5) { this.fastFor += raw; this.slowFor = 0 }
    if (this.slowFor > 2500 && this.quality > 0) {
      this.quality--
      this.slowFor = 0
      this.resize()
    } else if (this.fastFor > 20000 && this.quality < (this.isMobile ? 1 : 2)) {
      this.quality++
      this.fastFor = 0
      this.resize()
    }
  }

  private wind(dt: number): number {
    void dt
    const t = this.t
    const amt = this.opts.amount
    let w = 5 + 9 * Math.sin(t * 0.045) + 5 * Math.sin(t * 0.13 + 1.7)
    if (t > this.nextGust) {
      this.gustStart = t
      const dir = Math.sign(w || 1) * (Math.random() < 0.8 ? 1 : -1)
      this.gustAmp = dir * rand(30, 70) * (0.5 + amt * 0.7)
      this.nextGust = t + rand(9, 22)
    }
    const g = t - this.gustStart
    const env = smooth(0, 1.8, g) * (1 - smooth(3.5, 7.5, g))
    w += this.gustAmp * env
    return w
  }

  private updateFlakes(dt: number, wind: number) {
    const W = this.W
    const H = this.H
    // grow or shrink the population gently toward today's amount
    const alive = this.flakes.length
    if (!this.stopping && alive < this.targetCount && Math.random() < 0.5) this.flakes.push(this.makeFlake(false))
    const gustSlow = 1 - Math.min(0.3, Math.abs(wind) / 260)
    const caps = this.visibleCaps
    for (let k = this.flakes.length - 1; k >= 0; k--) {
      const f = this.flakes[k]
      f.phase += f.swayFreq * dt
      const sway = Math.cos(f.phase) * f.swayAmp * f.swayFreq
      f.x += (wind * f.depth + sway) * dt
      f.prevY = f.y
      f.y += f.speed * gustSlow * dt
      if (f.x > W + 40) f.x -= W + 80
      else if (f.x < -40) f.x += W + 80

      let landed = false
      if (!this.stopping) {
        for (let c = 0; c < caps.length; c++) {
          const cap = caps[c]
          if (!cap.visible) continue
          const ground = cap.el === this.ground
          if (f.layer === 0 && !ground) continue
          const lx = f.x - cap.left
          if (lx < 0 || lx >= cap.layoutW) continue
          const i = Math.round(lx / cap.colW)
          const b = cap.base[i]
          if (Number.isNaN(b) || cap.maxH[i] <= 0.2 || cap.occ[i]) continue
          const sy = cap.top + b - cap.h[i]
          if (f.prevY < sy && f.y >= sy - 0.5 && f.x >= cap.cl && f.x <= cap.cr && sy >= cap.ct && sy <= cap.cb) {
            this.deposit(cap, i, f.size * (ground ? 0.07 : cap.kind === 'text' ? 0.12 : 0.22))
            landed = true
            break
          }
        }
      }

      if (landed || f.y > H + 24) {
        if (this.stopping || this.flakes.length > this.targetCount + 4) {
          this.flakes.splice(k, 1)
        } else {
          const nf = this.makeFlake(false)
          nf.y = rand(-30, -8)
          nf.x = rand(-40, W + 40) - wind * 1.5
          nf.prevY = nf.y
          this.flakes[k] = nf
        }
      }
    }
  }

  private deposit(cap: Cap, i: number, amount: number) {
    const R = Math.max(1, Math.round(4 / cap.colW))
    for (let k = -R; k <= R; k++) {
      const j = i + k
      if (j < 0 || j >= cap.n) continue
      const w = Math.exp(-(k * k) / (2 * R * R * 0.45))
      cap.h[j] = Math.min(cap.maxH[j] * 1.08, cap.h[j] + amount * w)
    }
  }

  private updateCaps(dt: number) {
    const amt = this.opts.amount
    // full cover in about a minute on heavy days, a few minutes on light ones
    const tau = 50 - 28 * amt
    const meltK = this.stopping ? Math.exp(-dt * 2.8) : 1
    for (const cap of this.visibleCaps) {
      const el = cap.el
      if (!el.isConnected) { cap.visible = false; continue }
      const r = this.rect(el)
      if (r.width < (cap.kind === 'text' ? 20 : 80) || r.height < (cap.kind === 'text' ? 8 : 36)) { cap.visible = false; continue }
      if (cap.dirty || Math.abs(r.width - cap.layoutW) > 0.75 || (cap.kind === 'text' && Math.abs(r.height - cap.layoutH) > 0.75)) this.rebuild(cap, r)
      cap.left = r.left
      cap.top = r.top

      // clip: scroll containers clip both ways; overflow:hidden parents only sideways
      let cl = 0, ct = 0, cr = this.W, cb = this.H
      for (const p of cap.vClip) {
        const pr = this.rect(p)
        cl = Math.max(cl, pr.left); cr = Math.min(cr, pr.right); cb = Math.min(cb, pr.bottom)
        // snow may poke above the scroll area's top edge while the card itself is fully inside,
        // and slides under that edge smoothly as the card scrolls out
        const room = clamp(r.top + cap.baseMin - pr.top, 0, cap.peak + 6)
        ct = Math.max(ct, pr.top - room)
      }
      for (const p of cap.hClip) { const pr = this.rect(p); cl = Math.max(cl, pr.left); cr = Math.min(cr, pr.right) }
      cap.cl = cl; cap.ct = ct; cap.cr = cr; cap.cb = cb
      const topEdge = r.top + cap.baseMin - cap.peak - 4
      const botEdge = r.top + cap.baseMax + 2
      cap.visible = cr > cl && botEdge > ct && topEdge < cb && r.right > 0 && r.left < this.W

      const h = cap.h
      const mx = cap.maxH
      const n = cap.n
      if (this.stopping) {
        for (let i = 0; i < n; i++) h[i] *= meltK
        continue
      }
      for (let i = 0; i < n; i++) {
        if (mx[i] <= 0) { h[i] = 0; continue }
        if (h[i] < mx[i]) h[i] += ((mx[i] - h[i]) / tau) * cap.grow[i] * dt
      }
      // settle: let piles slump so the surface stays natural
      const slope = cap.kind === 'text' ? 0.9 : 0.75 * cap.colW
      for (let i = 0; i < n - 1; i++) {
        if (Number.isNaN(cap.base[i]) || Number.isNaN(cap.base[i + 1])) continue
        const d = h[i] - h[i + 1]
        if (d > slope) { const m = (d - slope) * 0.25; h[i] -= m; h[i + 1] = Math.min(mx[i + 1] * 1.08, h[i + 1] + m) }
        else if (d < -slope) { const m = (-d - slope) * 0.25; h[i + 1] -= m; h[i] = Math.min(mx[i] * 1.08, h[i] + m) }
      }
    }
  }

  /**
   * What is really on top of each snowy edge? Samples a few points just inside each
   * element's top edge with elementFromPoint (the canvas ignores the pointer, so the
   * page answers). Anything else there (sidebar, dropdown, popup) hides that stretch
   * of snow. Also notes those covering things so flakes are not drawn over them,
   * and hides all snow while a large modal is open.
   */
  private scanCover() {
    const W = this.W
    const H = this.H
    const blockers: { l: number; t: number; r: number; b: number }[] = []
    const seen = new Set<Element>()
    const addBlocker = (el: Element | null) => {
      if (!el || seen.has(el)) return
      seen.add(el)
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) blockers.push({ l: r.left, t: r.top, r: r.right, b: r.bottom })
    }
    // the floating thing that owns a covering element: nearest fixed/absolute ancestor
    // (a sticky header is not a floating thing: cards scrolling under it are already clipped)
    const owner = (el: Element): Element | null => {
      let cur: Element | null = el
      for (let k = 0; k < 10 && cur && cur !== document.body; k++) {
        const pos = getComputedStyle(cur).position
        if (pos === 'fixed' || pos === 'absolute') return cur
        if (pos === 'sticky') return null
        cur = cur.parentElement
      }
      return null
    }

    // sidebars (desktop rail + expanded panel + logo plate)
    document.querySelectorAll('.sidebar-nav, .sidebar-desktop-logo-fixed-container, aside').forEach(el => {
      const cs = getComputedStyle(el)
      if (cs.display !== 'none' && cs.visibility !== 'hidden') addBlocker(el)
    })

    // big modal / popup open?  (role=dialog cards in a corner don't count)
    let modal = false
    document.querySelectorAll('[aria-modal="true"], [role="dialog"], .modal-overlay, .modal').forEach(el => {
      if (modal || this.canvas.contains(el)) return
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && r.width * r.height > W * H * 0.35) modal = true
    })
    if (modal !== this.modalOpen) {
      this.modalOpen = modal
      this.canvas.style.opacity = modal ? '0' : '1'
      if (modal) this.setCursorHidden(false)
    }

    for (const cap of this.visibleCaps) {
      if (!cap.visible || cap.n === 0) continue
      const occ = cap.occ
      occ.fill(0)
      if (cap.el === this.ground) continue // handled below with the blocker rects
      const step = 18
      const w = cap.layoutW
      const y = cap.top + cap.baseMin + (cap.kind === 'text' ? 2 : 6)
      if (y < 0 || y > H) continue
      const samples = Math.max(2, Math.ceil(w / step) + 1)
      let prevHidden = false
      let prevCol = 0
      for (let k = 0; k < samples; k++) {
        const x = cap.left + Math.min(w - 2, Math.max(2, k * step))
        const col = Math.min(cap.n - 1, Math.round((x - cap.left) / cap.colW))
        let hidden = false
        if (x >= 0 && x <= W) {
          const hit = document.elementFromPoint(x, y)
          if (hit && hit !== cap.el && !cap.el.contains(hit) && !hit.contains(cap.el)) {
            hidden = true
            addBlocker(owner(hit))
          }
        }
        // fill the columns between this sample and the previous one
        const from = k === 0 ? 0 : prevCol
        for (let i = from; i <= col; i++) if (hidden || (prevHidden && i < (from + col) / 2)) occ[i] = 1
        prevHidden = hidden
        prevCol = col
      }
      if (prevHidden) for (let i = prevCol; i < cap.n; i++) occ[i] = 1
    }
    this.blockers = blockers

    // ground snow: hide where a sidebar / panel sits on the bottom edge
    const g = this.ground && this.caps.get(this.ground)
    if (g && g.n) {
      for (let i = 0; i < g.n; i++) {
        const x = g.left + i * g.colW
        const y = g.top - 2
        g.occ[i] = blockers.some(b => x >= b.l && x <= b.r && y >= b.t && y <= b.b) ? 1 : 0
      }
    }
  }

  private covered(x: number, y: number) {
    const bl = this.blockers
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i]
      if (x >= b.l && x <= b.r && y >= b.t && y <= b.b) return true
    }
    return false
  }

  private updateDuster(dt: number) {
    const now = performance.now()
    let over = false
    if (this.pActive && !this.stopping) {
      const touch = this.pType !== 'mouse'
      const R = touch ? 26 : 17
      const speed = Math.hypot(this.pvx, this.pvy)
      const strength = touch ? 1 : clamp(speed / 650, 0.12, 1)
      for (const cap of this.visibleCaps) {
        if (!cap.visible) continue
        const lx = this.px - cap.left
        if (lx < -R || lx > cap.layoutW + R) continue
        if (this.px < cap.cl || this.px > cap.cr || this.py < cap.ct - 20 || this.py > cap.cb) continue
        const i0 = Math.max(0, Math.floor((lx - R) / cap.colW))
        const i1 = Math.min(cap.n - 1, Math.ceil((lx + R) / cap.colW))
        let maxHere = 0
        let surf = Infinity
        let baseHere = -Infinity
        for (let i = i0; i <= i1; i++) {
          if (Number.isNaN(cap.base[i]) || cap.occ[i]) continue
          maxHere = Math.max(maxHere, cap.h[i])
          surf = Math.min(surf, cap.top + cap.base[i] - cap.h[i])
          baseHere = Math.max(baseHere, cap.top + cap.base[i])
        }
        if (maxHere < 0.8) continue
        if (this.py < surf - (touch ? 22 : 12) || this.py > baseHere + (touch ? 22 : 10)) continue
        over = true
        const moving = speed > 30 || touch
        if (!moving) continue
        let removed = 0
        let sx = 0
        for (let i = i0; i <= i1; i++) {
          if (Number.isNaN(cap.base[i]) || cap.h[i] <= 0 || cap.occ[i]) continue
          const dx = (i * cap.colW - lx) / R
          const fall = 1 - dx * dx
          if (fall <= 0) continue
          const take = cap.h[i] * fall * (0.25 + 0.75 * strength) * Math.min(1, dt * 16)
          cap.h[i] -= take
          removed += take
          sx += take * (cap.left + i * cap.colW)
        }
        if (removed > 0.05) {
          const cx = sx / removed
          const cy = surf + 2
          this.spawnPuffs(cx, cy, removed * (cap.colW / 3))
          if (!this.dusted) { this.dusted = true; this.opts.onFirstDust?.() }
        }
      }
    }
    if (over) this.overUntil = now + 380
    this.overSnow = over || now < this.overUntil
    this.setCursorHidden(this.overSnow && this.pType === 'mouse' && this.pActive)
    const target = this.overSnow && this.pActive ? 1 : 0
    this.dusterA += (target - this.dusterA) * Math.min(1, dt * (target ? 14 : 8))

    const tiltTarget = -0.6 + clamp(this.pvx / 1100, -0.55, 0.55)
    this.tilt += (tiltTarget - this.tilt) * Math.min(1, dt * 12)
    // feathers lag behind the handle, on a spring
    const acc = (this.tilt - this.featherLag) * 140 - this.featherVel * 11
    this.featherVel += acc * dt
    this.featherLag += this.featherVel * dt
  }

  private spawnPuffs(x: number, y: number, amount: number) {
    const max = this.quality === 2 ? 260 : 140
    const grains = Math.min(14, Math.ceil(amount * 2.2))
    for (let i = 0; i < grains && this.puffs.length < max; i++) {
      this.puffs.push({
        x: x + rand(-8, 8), y: y + rand(-2, 2),
        vx: this.pvx * 0.22 + rand(-45, 45), vy: -rand(50, 170) - Math.abs(this.pvx) * 0.05,
        life: 0, max: rand(0.55, 1.1), size: rand(1.4, 3.2), kind: 0,
      })
    }
    if (Math.random() < Math.min(0.9, amount * 0.25) && this.puffs.length < max) {
      this.puffs.push({
        x: x + rand(-6, 6), y: y - 2,
        vx: this.pvx * 0.12 + rand(-15, 15), vy: -rand(14, 40),
        life: 0, max: rand(0.8, 1.5), size: rand(9, 18), kind: 1,
      })
    }
  }

  private updatePuffs(dt: number, wind: number) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]
      p.life += dt
      if (p.life >= p.max) { this.puffs.splice(i, 1); continue }
      if (p.kind === 0) {
        p.vy += 420 * dt
        p.vx += (wind * 0.6 - p.vx) * dt * 1.5
      } else {
        p.vx *= 1 - dt * 2
        p.vy *= 1 - dt * 2.5
        p.vx += wind * 0.3 * dt
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
  }

  /* ───────────────────────── render ───────────────────────── */

  private render() {
    const ctx = this.ctx
    const d = this.dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(d, 0, 0, d, 0, 0)

    if (this.modalOpen) return
    for (const cap of this.visibleCaps) if (cap.visible) this.drawCap(cap)
    this.drawPuffs()
    this.drawFlakes()
    if (this.dusterA > 0.02) this.drawDuster()
  }

  private drawFlakes() {
    const ctx = this.ctx
    const fadeOut = this.stopping ? 1 - smooth(0, 1.6, this.t - this.stopAt) : 1
    for (const f of this.flakes) {
      const spr = this.sprites[f.layer][f.sprite]
      if (!spr || this.covered(f.x, f.y)) continue
      const s = f.size * 2
      ctx.globalAlpha = f.alpha * fadeOut
      ctx.drawImage(spr, f.x - s / 2, f.y - s / 2, s, s)
    }
    ctx.globalAlpha = 1
  }

  private drawPuffs() {
    const ctx = this.ctx
    const grain = this.sprites[1][0]
    const powder = this.sprites[2][3] || this.sprites[2][0]
    for (const p of this.puffs) {
      const k = p.life / p.max
      if (p.kind === 0) {
        ctx.globalAlpha = (1 - k * k) * 0.95
        const s = p.size * 2
        ctx.drawImage(grain, p.x - s / 2, p.y - s / 2, s, s)
      } else {
        ctx.globalAlpha = (1 - k) * 0.32
        const s = p.size * (1 + k * 1.2) * 2
        ctx.drawImage(powder, p.x - s / 2, p.y - s / 2, s, s)
      }
    }
    ctx.globalAlpha = 1
  }

  private drawCap(cap: Cap) {
    const ctx = this.ctx
    const pal = this.pal
    const h = cap.h
    const base = cap.base
    const n = cap.n
    const cw = cap.colW
    const L = cap.left
    const T = cap.top
    const minH = this.theme === 'light' ? (cap.kind === 'text' ? 0.9 : 1.8) : cap.kind === 'text' ? 0.35 : 0.5

    ctx.save()
    ctx.beginPath()
    ctx.rect(cap.cl, cap.ct, cap.cr - cap.cl, cap.cb - cap.ct)
    ctx.clip()

    const gTop = T + cap.baseMin - cap.peak
    const gBot = T + cap.baseMax + 1
    const key = `${Math.round(gTop)}|${Math.round(gBot)}|${this.theme}`
    if (cap.gradKey !== key) {
      const g = ctx.createLinearGradient(0, gTop, 0, gBot)
      g.addColorStop(0, pal.top)
      g.addColorStop(this.theme === 'light' ? 0.18 : 0.3, pal.top)
      g.addColorStop(this.theme === 'light' ? 0.6 : 0.68, pal.mid)
      g.addColorStop(1, pal.bottom)
      cap.grad = g
      cap.gradKey = key
    }

    let i = 0
    const shadowOn = this.quality > 0
    while (i < n) {
      const occ = cap.occ
      while (i < n && (Number.isNaN(base[i]) || h[i] < minH || occ[i])) i++
      const s = i
      while (i < n && !Number.isNaN(base[i]) && h[i] >= minH && !occ[i] && (i === s || Math.abs(base[i] - base[i - 1]) < 3)) i++
      const e = i
      if (e - s < 2) continue
      const path = (dy: number) => {
        ctx.beginPath()
        ctx.moveTo(L + s * cw, T + base[s] + dy)
        let prevX = L + s * cw
        let prevY = T + base[s] - h[s] + dy
        ctx.lineTo(prevX, prevY)
        for (let k = s + 1; k < e; k++) {
          const x = L + k * cw
          const y = T + base[k] - h[k] + dy
          ctx.quadraticCurveTo(prevX, prevY, (prevX + x) / 2, (prevY + y) / 2)
          prevX = x
          prevY = y
        }
        ctx.lineTo(prevX, prevY)
        for (let k = e - 1; k >= s; k--) ctx.lineTo(L + k * cw, T + base[k] + 0.7 + dy)
        ctx.closePath()
      }
      const light = this.theme === 'light'
      const blur = light && cap.kind === 'box' && this.quality === 2
      if (shadowOn && (!light || !blur)) {
        ctx.fillStyle = pal.shadow
        if (cap.kind === 'box') { path(3); ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1 }
        path(cap.kind === 'text' ? 0.9 : 1.4)
        ctx.fill()
      }
      path(0)
      if (blur) {
        // white on white needs a soft glow-like shadow, never a hard line
        ctx.shadowColor = pal.shadow
        ctx.shadowBlur = 4
        ctx.shadowOffsetY = 1.2
      }
      ctx.fillStyle = cap.grad!
      ctx.fill()
      if (blur) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0 }
      // crisp edge along the top of the snow
      ctx.beginPath()
      let px = L + s * cw
      let py = T + base[s] - h[s]
      ctx.moveTo(px, py)
      for (let k = s + 1; k < e; k++) {
        const x = L + k * cw
        const y = T + base[k] - h[k]
        ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2)
        px = x
        py = y
      }
      if (pal.edgeW > 0) {
        ctx.strokeStyle = pal.edge
        ctx.lineWidth = pal.edgeW
        ctx.stroke()
      }
    }

    // glints of light on the snow
    if (cap.sparkles.length) {
      ctx.fillStyle = pal.sparkle
      ctx.strokeStyle = pal.sparkle
      for (const sp of cap.sparkles) {
        const k = sp.i
        if (k >= n || Number.isNaN(base[k]) || cap.occ[k] || h[k] < cap.maxH[k] * 0.45 || h[k] < 1.5) continue
        const a = Math.pow(Math.max(0, Math.sin(this.t * sp.speed + sp.phase)), 14)
        if (a < 0.03) continue
        const x = L + k * cw
        const y = T + base[k] - h[k] + 1.2
        const r = (cap.kind === 'text' ? 1.6 : 2.6) * a
        ctx.globalAlpha = a
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.moveTo(x - r, y); ctx.lineTo(x + r, y)
        ctx.moveTo(x, y - r); ctx.lineTo(x, y + r)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, 0.7 * a + 0.3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  /** A little feather duster that follows the pointer and swings as it moves. */
  private drawDuster() {
    const ctx = this.ctx
    const touch = this.pType !== 'mouse'
    const x = this.px
    const y = this.py - (touch ? 34 : 0)
    const speed = Math.min(1, Math.hypot(this.pvx, this.pvy) / 900)
    ctx.save()
    ctx.globalAlpha = this.dusterA
    ctx.translate(x, y)
    const sc = (touch ? 1.15 : 1) * (0.92 + 0.08 * this.dusterA)
    ctx.scale(sc, sc)

    // soft shadow
    ctx.save()
    ctx.translate(4, 6)
    ctx.rotate(this.tilt)
    ctx.fillStyle = 'rgba(15,23,42,0.16)'
    ctx.beginPath()
    ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(-2.5, 10, 5, 28)
    ctx.restore()

    ctx.rotate(this.tilt)

    // handle
    const hg = ctx.createLinearGradient(-3, 0, 3, 0)
    hg.addColorStop(0, '#7a4a22')
    hg.addColorStop(0.45, '#c98b4f')
    hg.addColorStop(1, '#8a5428')
    ctx.fillStyle = hg
    ctx.beginPath()
    ctx.moveTo(-2.4, 10)
    ctx.lineTo(2.4, 10)
    ctx.lineTo(2.9, 37)
    ctx.quadraticCurveTo(0, 40.5, -2.9, 37)
    ctx.closePath()
    ctx.fill()
    // hanging loop
    ctx.strokeStyle = '#b4232f'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.ellipse(0, 42.5, 2.6, 3.4, 0, 0, Math.PI * 2)
    ctx.stroke()
    // brass collar
    const bg = ctx.createLinearGradient(-4, 0, 4, 0)
    bg.addColorStop(0, '#a97a1c')
    bg.addColorStop(0.5, '#f6d77a')
    bg.addColorStop(1, '#a3741a')
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.roundRect ? ctx.roundRect(-4, 6.5, 8, 5, 1.5) : ctx.rect(-4, 6.5, 8, 5)
    ctx.fill()

    // feathers: fan out with the swing and fluff up when moving fast
    const swing = (this.tilt - this.featherLag) * 1.6
    const spread = 1 + speed * 0.25
    const count = FEATHERS.length
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < count; i++) {
        const k = i / (count - 1) - 0.5
        const ang = k * 2.5 * spread - swing * (0.6 + Math.abs(k))
        const len = 13 + (1 - Math.abs(k) * 1.4) * 4 + speed * 2
        const wid = 5.2 - Math.abs(k) * 1.2
        ctx.save()
        ctx.translate(0, 7)
        ctx.rotate(ang)
        if (pass === 0) {
          ctx.globalAlpha = this.dusterA * 0.35
          ctx.fillStyle = FEATHERS[(i + 3) % count]
          ctx.beginPath()
          ctx.ellipse(0, -len * 0.55, wid * 1.35, len * 0.62, 0, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.globalAlpha = this.dusterA
          const fg = ctx.createLinearGradient(0, 0, 0, -len)
          fg.addColorStop(0, FEATHERS[(i + 4) % count])
          fg.addColorStop(1, FEATHERS[i])
          ctx.fillStyle = fg
          ctx.beginPath()
          ctx.ellipse(0, -len * 0.55, wid, len * 0.55, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'rgba(120,60,40,0.18)'
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(0, -1)
          ctx.lineTo(0, -len * 0.95)
          ctx.stroke()
        }
        ctx.restore()
      }
    }
    // fluffy centre
    ctx.globalAlpha = this.dusterA
    const cg = ctx.createRadialGradient(0, 3, 0, 0, 3, 7)
    cg.addColorStop(0, '#fff8f0')
    cg.addColorStop(1, 'rgba(245,214,192,0)')
    ctx.fillStyle = cg
    ctx.beginPath()
    ctx.arc(0, 3, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
