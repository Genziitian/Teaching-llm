'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { FestiveFx } from './festiveFx'

/**
 * Full-screen festival moments: Diwali, Chhath Puja, Christmas.
 *
 * Each one starts dark and quiet and asks for one tap: light the diya, watch
 * the sun rise, light the star. Then the screen comes alive (fireworks,
 * floating diyas, tree lights) and a short greeting appears. If nobody taps,
 * it plays by itself after a few seconds.
 *
 * Shown full screen once per festival; afterwards a small badge in the corner
 * can replay it. Pure HTML/CSS/SVG + one canvas. Nothing is loaded from the server.
 */

export type FestivalId = 'diwali' | 'chhath' | 'christmas'

const SEEN_KEY = (id: FestivalId) => `festival-greeting-seen-${id}-2026`
const AUTO_PLAY_MS = 5000

type Mode = 'none' | 'full' | 'corner'
type Css = CSSProperties & Record<`--${string}`, string | number>
type FxRef = RefObject<FestiveFx | null>
type HostRef = RefObject<HTMLDivElement | null>

const reduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// Fixed pseudo-random spreads, same on every render.
const pr = (i: number, a: number, b: number, salt = 1) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return a + (x - Math.floor(x)) * (b - a)
}

const STARS = Array.from({ length: 70 }, (_, i) => ({
  left: pr(i, 0, 100, 3), top: pr(i, 0, 58, 7), size: pr(i, 1, 2.4, 11), delay: pr(i, 0, 4, 13), dur: pr(i, 2, 4.5, 17),
}))
const EMBERS = Array.from({ length: 24 }, (_, i) => ({
  left: pr(i, 4, 96, 5), delay: pr(i, 0, 6, 19), dur: pr(i, 5, 9, 23), size: pr(i, 2, 4.5, 29), drift: pr(i, -40, 40, 31),
}))
const TORAN = Array.from({ length: 23 }, (_, i) => ({ len: 4 + (i % 3 === 1 ? 2 : i % 2), delay: 0.3 + Math.abs(i - 11) * 0.05 }))

function centerOf(el: Element | null, host: Element | null) {
  if (!el || !host) return null
  const r = el.getBoundingClientRect()
  const h = host.getBoundingClientRect()
  return { x: r.left + r.width / 2 - h.left, y: r.top + r.height / 2 - h.top }
}

/* ───────────────────────── shared pieces ───────────────────────── */

function Diya({ delay = 0, size = 1, className = '' }: { delay?: number; size?: number; className?: string }) {
  return (
    <div className={`fg-diya ${className}`} style={{ '--d': `${delay}s`, '--s': size } as Css}>
      <div className="fg-diya-glow" />
      <div className="fg-flame"><div className="fg-flame-core" /></div>
      <div className="fg-diya-bowl"><span /></div>
    </div>
  )
}

function Stars() {
  return (
    <div className="fg-stars" aria-hidden="true">
      {STARS.map((s, i) => (
        <i key={i} style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />
      ))}
    </div>
  )
}

function Title({ text, className }: { text: string; className: string }) {
  let n = 0
  return (
    <h1 className={className} aria-label={text}>
      {text.split(' ').map((word, w) => (
        <span key={w} className="fg-word" aria-hidden="true">
          {word.split('').map((ch, k) => <span key={k} style={{ '--i': n++ } as Css}>{ch}</span>)}
        </span>
      ))}
    </h1>
  )
}

function Hint({ text, show }: { text: string; show: boolean }) {
  return <div className={`fg-hint ${show ? '' : 'is-gone'}`} aria-hidden={!show}>{text}</div>
}

/* ───────────────────────── Diwali ───────────────────────── */

function DiwaliScene({ fx, hostRef, onClose }: { fx: FxRef; hostRef: HostRef; onClose: () => void }) {
  const [lit, setLit] = useState(false)
  const heroRef = useRef<HTMLButtonElement>(null)

  const light = useCallback(() => setLit(true), [])

  useEffect(() => {
    const t = window.setTimeout(light, AUTO_PLAY_MS)
    return () => window.clearTimeout(t)
  }, [light])

  useEffect(() => {
    if (!lit) return
    const p = centerOf(heroRef.current, hostRef.current)
    if (p) fx.current?.sparkle(p.x, p.y - 30, 70)
    const t1 = window.setTimeout(() => {
      fx.current?.launch(undefined, undefined, 'peony', '#ffd166')
      window.setTimeout(() => fx.current?.launch(undefined, undefined, 'willow'), 260)
      window.setTimeout(() => fx.current?.launch(undefined, undefined, 'ring', '#ff8fd8'), 520)
    }, 1500)
    const t2 = window.setTimeout(() => fx.current?.autoFireworks(true), 2800)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); fx.current?.autoFireworks(false) }
  }, [lit, fx, hostRef])

  const onSky = (e: ReactPointerEvent) => {
    if (!lit || (e.target as Element).closest('button') || !hostRef.current) return
    const h = hostRef.current.getBoundingClientRect()
    fx.current?.launch(e.clientX - h.left, e.clientY - h.top)
  }

  return (
    <div className={`fg-scene fg-scene-diwali ${lit ? 'is-lit' : ''}`} onPointerDown={onSky}>
      <div className="fg-bg fg-bg-night" />
      <div className="fg-bg fg-bg-diwali" />
      <Stars />
      <div className="fg-wave" aria-hidden="true" />

      <div className="fg-toran" aria-hidden="true">
        <div className="fg-toran-rope" />
        {TORAN.map((t, i) => (
          <div key={i} className="fg-toran-strand" style={{ '--td': `${t.delay}s` } as Css}>
            {Array.from({ length: t.len }, (_, k) => <i key={k} className={(i + k) % 2 ? 'is-yellow' : ''} />)}
            <b />
          </div>
        ))}
      </div>

      <div className="fg-embers" aria-hidden="true">
        {EMBERS.map((e, i) => (
          <i key={i} style={{ left: `${e.left}%`, width: e.size, height: e.size, animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s`, '--drift': `${e.drift}px` } as Css} />
        ))}
      </div>

      <div className="fg-copy fg-copy-diwali">
        <div className="fg-kicker fg-deva">शुभ दीपावली</div>
        <Title text="Happy Diwali" className="fg-title fg-title-gold" />
        <button type="button" className="fg-cta" onClick={onClose}>Continue</button>
      </div>

      <div className="fg-diya-row" aria-hidden="true">
        {[2, 1, 0].map(k => <Diya key={`l${k}`} delay={1.6 + k * 0.22} size={1 - k * 0.08} className="fg-row-diya" />)}
        <div className="fg-hero-slot" />
        {[0, 1, 2].map(k => <Diya key={`r${k}`} delay={1.6 + k * 0.22} size={1 - k * 0.08} className="fg-row-diya" />)}
      </div>

      <button type="button" ref={heroRef} className="fg-hero" onClick={light} aria-label="Light the diya" disabled={lit}>
        <span className="fg-hero-ring" />
        <Diya delay={0} size={1.9} className="fg-hero-diya" />
      </button>
      <Hint text="Tap the diya" show={!lit} />
    </div>
  )
}

/* ───────────────────────── Chhath ───────────────────────── */

function Sugarcane({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={`fg-cane fg-cane-${side}`} aria-hidden="true">
      {[0, 1, 2].map(k => (
        <div key={k} className="fg-cane-stalk" style={{ '--k': k } as Css}>
          <div className="fg-cane-leaves">{[0, 1, 2, 3, 4].map(l => <i key={l} style={{ '--l': l } as Css} />)}</div>
        </div>
      ))}
    </div>
  )
}

const START_FLOATERS = [
  { x: 14, y: 62, id: -1 }, { x: 31, y: 30, id: -2 }, { x: 68, y: 44, id: -3 }, { x: 86, y: 70, id: -4 },
]

function ChhathScene({ fx, hostRef, onClose }: { fx: FxRef; hostRef: HostRef; onClose: () => void }) {
  const [floaters, setFloaters] = useState(START_FLOATERS)
  const [tapped, setTapped] = useState(false)
  const nextId = useRef(1)

  const onWater = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    setTapped(true)
    setFloaters(f => [...f.slice(-13), { x, y: Math.max(8, y), id: nextId.current++ }])
    if (!hostRef.current) return
    const h = hostRef.current.getBoundingClientRect()
    fx.current?.sparkle(e.clientX - h.left, e.clientY - h.top - 14, 26)
  }

  return (
    <div className="fg-scene fg-scene-chhath">
      <div className="fg-bg fg-bg-dawn" />
      <div className="fg-bg fg-bg-predawn" />
      <Stars />
      <div className="fg-sun-wrap" aria-hidden="true">
        <div className="fg-sun-halo" />
        <div className="fg-sun-rays" />
        <div className="fg-sun" />
      </div>
      <div className="fg-birds" aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <svg key={i} className="fg-bird" style={{ '--b': i } as Css} viewBox="0 0 40 16"><path d="M1 8 Q10 0 20 9 Q30 0 39 8" /></svg>
        ))}
      </div>
      <div className="fg-water" onPointerDown={onWater}>
        <div className="fg-water-glow" aria-hidden="true" />
        <div className="fg-reflection" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--r': i } as Css} />)}</div>
        <div className="fg-ripples" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--r': i, left: `${pr(i, 2, 88, 71)}%`, top: `${pr(i, 10, 90, 73)}%` } as Css} />)}
        </div>
        {floaters.map(f => (
          <div key={f.id} className={`fg-floater ${f.id > 0 ? 'is-new' : ''}`} style={{ left: `${f.x}%`, top: `${f.y}%`, '--f': Math.abs(f.id) } as Css}>
            <span className="fg-splash" />
            <Diya delay={f.id > 0 ? 0.05 : 2 + Math.abs(f.id) * 0.3} size={0.62} />
          </div>
        ))}
      </div>
      <Sugarcane side="left" />
      <Sugarcane side="right" />

      <div className="fg-copy fg-copy-chhath">
        <div className="fg-kicker fg-deva">छठ पूजा की हार्दिक शुभकामनाएँ</div>
        <Title text="Happy Chhath Puja" className="fg-title fg-title-dawn" />
        <div className="fg-pill">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" fill="currentColor" /></svg>
          All the best for your exams
        </div>
        <button type="button" className="fg-cta" onClick={onClose}>Continue</button>
      </div>
      <Hint text="Tap the water to float a diya" show={!tapped} />
    </div>
  )
}

/* ───────────────────────── Christmas ───────────────────────── */

const BULB_COLORS = ['#ff4d6d', '#ffd166', '#4cc9f0', '#80ed99', '#f72585', '#ffb703']
const TREE_ROWS = [{ y: 70, w: 70 }, { y: 125, w: 104 }, { y: 185, w: 140 }, { y: 250, w: 176 }]
const TREE_BULBS = TREE_ROWS.flatMap((r, ri) => {
  const n = 4 + ri * 2
  return Array.from({ length: n }, (_, k) => {
    const t = (k + 0.5) / n
    return { x: 150 - r.w * 0.86 + t * r.w * 1.72, y: r.y - 6 + Math.sin(t * Math.PI) * 14, c: BULB_COLORS[(k + ri) % BULB_COLORS.length], on: 0.35 + ri * 0.28 + t * 0.2, tw: pr(k + ri * 10, 0, 2, 83) }
  })
})

function ChristmasScene({ fx, hostRef, onClose }: { fx: FxRef; hostRef: HostRef; onClose: () => void }) {
  const [lit, setLit] = useState(false)
  const starRef = useRef<SVGGElement>(null)
  const light = useCallback(() => setLit(true), [])

  useEffect(() => {
    // the canvas is created by the parent right after this mounts
    const t = window.setTimeout(() => fx.current?.snow(window.innerWidth < 768 ? 70 : 140), 60)
    return () => window.clearTimeout(t)
  }, [fx])
  useEffect(() => {
    const t = window.setTimeout(light, AUTO_PLAY_MS)
    return () => window.clearTimeout(t)
  }, [light])
  useEffect(() => {
    if (!lit) return
    // wait for the tree to slide into place before bursting from the star
    const t = window.setTimeout(() => {
      const p = centerOf(starRef.current, hostRef.current)
      if (!p) return
      fx.current?.sparkle(p.x, p.y, 90)
      fx.current?.burst(p.x, p.y, 'ring', '#ffd166', '#fff3c4')
    }, 200)
    return () => window.clearTimeout(t)
  }, [lit, fx, hostRef])

  const onTap = (e: ReactPointerEvent) => {
    if (!lit || (e.target as Element).closest('button') || !hostRef.current) return
    const h = hostRef.current.getBoundingClientRect()
    fx.current?.sparkle(e.clientX - h.left, e.clientY - h.top, 30, ['#ffffff', '#cfe8ff', '#ffd166'])
  }

  return (
    <div className={`fg-scene fg-scene-xmas ${lit ? 'is-lit' : ''}`} onPointerDown={onTap}>
      <div className="fg-bg fg-bg-xmas" />
      <Stars />
      <div className="fg-moon" aria-hidden="true" />
      <div className="fg-hills" aria-hidden="true"><i /><i /></div>
      <div className="fg-xmas-layout">
        <div className="fg-copy fg-copy-xmas">
          <div className="fg-kicker fg-kicker-xmas">Season&apos;s greetings</div>
          <Title text="Merry Christmas" className="fg-title fg-title-xmas" />
          <button type="button" className="fg-cta" onClick={onClose}>Continue</button>
        </div>
        <div className="fg-xmas-art">
          <div className="fg-tree-glow" aria-hidden="true" />
          <svg className="fg-tree" viewBox="0 -14 300 330" aria-hidden="true">
            <defs>
              <linearGradient id="fgTreeG" x1="0" x2="1">
                <stop offset="0" stopColor="#0f5132" /><stop offset="0.5" stopColor="#1b7a4a" /><stop offset="1" stopColor="#0c3f27" />
              </linearGradient>
              <radialGradient id="fgStarG"><stop offset="0" stopColor="#fff7c2" /><stop offset="1" stopColor="#ffb703" /></radialGradient>
              <radialGradient id="fgHaloG"><stop offset="0" stopColor="#ffe08a" stopOpacity="0.9" /><stop offset="0.45" stopColor="#ffd166" stopOpacity="0.35" /><stop offset="1" stopColor="#ffd166" stopOpacity="0" /></radialGradient>
            </defs>
            <rect x="136" y="262" width="28" height="40" rx="4" fill="#5b3418" />
            {TREE_ROWS.map((r, i) => (
              <path key={i} d={`M150 ${r.y - 70 - i * 6} L${150 + r.w} ${r.y + 14} Q150 ${r.y + 30} ${150 - r.w} ${r.y + 14} Z`} fill="url(#fgTreeG)" />
            ))}
            {TREE_ROWS.map((r, i) => (
              <path key={`s${i}`} d={`M${150 - r.w * 0.92} ${r.y + 8} Q150 ${r.y + 26} ${150 + r.w * 0.92} ${r.y + 8}`} fill="none" stroke="#f1f5fb" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
            ))}
            {TREE_ROWS.map((r, i) => (
              <path key={`g${i}`} d={`M${150 - r.w * 0.86} ${r.y - 6} Q150 ${r.y + 16} ${150 + r.w * 0.86} ${r.y - 6}`} fill="none" stroke="#2c3e33" strokeWidth="1.2" />
            ))}
            {TREE_BULBS.map((b, i) => (
              <g key={i} className="fg-bulb" style={{ '--on': `${b.on}s`, '--tw': `${b.tw}s` } as Css}>
                <circle cx={b.x} cy={b.y} r="10" fill={b.c} className="fg-bulb-glow" />
                <circle cx={b.x} cy={b.y} r="4" fill={b.c} className="fg-bulb-core" />
                <circle cx={b.x - 1.2} cy={b.y - 1.3} r="1.2" fill="#fff" opacity="0.7" />
              </g>
            ))}
            <g ref={starRef} className="fg-tree-star" onClick={light} role="button" aria-label="Light the star">
              <circle cx="150" cy="10" r="46" fill="url(#fgHaloG)" className="fg-star-halo" />
              <circle cx="150" cy="8" r="30" fill="transparent" />
              <path d="M150 -10 L156 3 L170 4 L159 13 L163 27 L150 19 L137 27 L141 13 L130 4 L144 3 Z" fill="url(#fgStarG)" transform="translate(0 4)" className="fg-star-shape" />
            </g>
          </svg>
          <div className="fg-gifts" aria-hidden="true">
            <div className="fg-gift" style={{ '--gc': '#e63946', '--gr': '#ffd166', '--gd': '1.5s' } as Css} />
            <div className="fg-gift fg-gift-tall" style={{ '--gc': '#457b9d', '--gr': '#f1faee', '--gd': '1.7s' } as Css} />
            <div className="fg-gift" style={{ '--gc': '#2a9d8f', '--gr': '#e9c46a', '--gd': '1.9s' } as Css} />
          </div>
          <Hint text="Tap the star" show={!lit} />
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── corner badge ───────────────────────── */

const MINI: Record<FestivalId, { title: string; text: string; cls: string }> = {
  diwali: { title: 'Happy Diwali', text: 'Wishing you light and happiness.', cls: 'fg-mini-diwali' },
  chhath: { title: 'Happy Chhath Puja', text: 'All the best for your exams.', cls: 'fg-mini-chhath' },
  christmas: { title: 'Merry Christmas', text: 'Rest, recharge and shine on.', cls: 'fg-mini-xmas' },
}

function BadgeArt({ id }: { id: FestivalId }) {
  if (id === 'diwali') return <div className="fg-badge-diya"><Diya delay={0.3} size={0.62} /></div>
  if (id === 'chhath') return <div className="fg-badge-sun"><span /><i /><i /><i /></div>
  return (
    <svg className="fg-badge-tree" viewBox="0 0 40 46">
      <path d="M20 4 L34 34 Q20 38 6 34 Z" fill="#1b7a4a" />
      <rect x="17" y="34" width="6" height="7" rx="1.5" fill="#7c4a24" />
      {([[16, 18, '#ff4d6d'], [24, 24, '#ffd166'], [14, 29, '#4cc9f0'], [27, 31, '#80ed99'], [20, 13, '#f72585']] as const).map(([x, y, c], k) => (
        <circle key={k} cx={x} cy={y} r="2" fill={c} className="fg-badge-bulb" style={{ animationDelay: `${k * 0.3}s` }} />
      ))}
      <path d="M20 0 l1.6 3.4 3.6.4-2.7 2.4.8 3.6L20 8l-3.3 1.8.8-3.6-2.7-2.4 3.6-.4z" fill="#ffd166" />
    </svg>
  )
}

/* ───────────────────────── main ───────────────────────── */

export default function FestivalGreeting({ festival }: { festival: FestivalId }) {
  const [mode, setMode] = useState<Mode>('none')
  const [leaving, setLeaving] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const [run, setRun] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fx = useRef<FestiveFx | null>(null)

  useEffect(() => {
    let seen = false
    try { seen = localStorage.getItem(SEEN_KEY(festival)) === '1' } catch {}
    const forced = new URLSearchParams(window.location.search).get('festival') === festival
    setMode(seen && !forced ? 'corner' : 'full')
    return () => window.clearTimeout(timer.current)
  }, [festival])

  const close = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY(festival), '1') } catch {}
    setLeaving(true)
    timer.current = window.setTimeout(() => { setMode('corner'); setLeaving(false) }, reduced() ? 0 : 650)
  }, [festival])

  // canvas effects live only while the full screen is open
  useEffect(() => {
    if (mode !== 'full' || !canvasRef.current) return
    fx.current = new FestiveFx(canvasRef.current)
    return () => { fx.current?.destroy(); fx.current = null }
  }, [mode, run])

  useEffect(() => {
    if (mode !== 'full') return
    const pb = document.body.style.overflow
    const ph = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = pb
      document.documentElement.style.overflow = ph
      window.removeEventListener('keydown', onKey)
    }
  }, [mode, close])

  if (mode === 'none') return null

  const replay = () => { setCardOpen(false); setRun(r => r + 1); setMode('full') }
  const Scene = festival === 'diwali' ? DiwaliScene : festival === 'chhath' ? ChhathScene : ChristmasScene

  return (
    <>
      <style>{CSS}</style>
      {mode === 'full' && (
        <div
          ref={hostRef}
          key={run}
          className={`fg-overlay fg-${festival} ${leaving ? 'is-leaving' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={MINI[festival].title}
          data-no-snow
        >
          <Scene fx={fx} hostRef={hostRef} onClose={close} />
          <canvas ref={canvasRef} className="fg-canvas" aria-hidden="true" />
          <button type="button" className="fg-x" onClick={close} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
      {mode === 'corner' && (
        <div className="fg-corner" data-no-snow>
          {cardOpen && (
            <div className={`fg-mini ${MINI[festival].cls}`} role="dialog" aria-label={MINI[festival].title}>
              <button type="button" className="fg-mini-x" onClick={() => setCardOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </button>
              <div className="fg-mini-art"><BadgeArt id={festival} /></div>
              <div className="fg-mini-title">{MINI[festival].title}</div>
              <div className="fg-mini-text">{MINI[festival].text}</div>
              <button type="button" className="fg-mini-cta" onClick={replay}>
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></svg>
                Replay
              </button>
            </div>
          )}
          <button
            type="button"
            className={`fg-badge fg-badge-${festival}`}
            onClick={() => setCardOpen(o => !o)}
            aria-label={MINI[festival].title}
            aria-expanded={cardOpen}
          >
            <BadgeArt id={festival} />
          </button>
        </div>
      )}
    </>
  )
}

/* ───────────────────────── styles ───────────────────────── */

const CSS = `
.fg-overlay { position: fixed; inset: 0; z-index: 10050; overflow: hidden; color: #fff; font-family: 'Outfit','Nunito',system-ui,sans-serif; animation: fgIn .8s ease both; isolation: isolate; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
.fg-overlay.is-leaving { animation: fgOut .65s ease forwards; }
.fg-scene { position: absolute; inset: 0; }
.fg-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 3; }
.fg-bg { position: absolute; inset: 0; }
.fg-x { position: absolute; top: max(16px, env(safe-area-inset-top)); right: 18px; z-index: 20; width: 42px; height: 42px; border-radius: 50%; border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.1); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); transition: transform .25s, background .2s; }
.fg-x:hover { transform: rotate(90deg); background: rgba(255,255,255,.2); }

.fg-stars { position: absolute; inset: 0; pointer-events: none; }
.fg-stars i { position: absolute; border-radius: 50%; background: #fff; box-shadow: 0 0 6px rgba(255,255,255,.9); animation: fgTwinkle 3s ease-in-out infinite; }

.fg-copy { position: absolute; left: 0; right: 0; z-index: 4; text-align: center; padding: 0 20px; pointer-events: none; }
.fg-copy > * { opacity: 0; }
.fg-copy .fg-cta { pointer-events: auto; }
.fg-kicker { font-size: clamp(15px, 2.1vw, 22px); font-weight: 700; letter-spacing: .05em; margin-bottom: 4px; }
.fg-deva { font-family: 'Noto Sans Devanagari','Mukta','Hind',system-ui,sans-serif; }
.fg-title { margin: 0; font-size: clamp(46px, 9vw, 120px); font-weight: 900; line-height: 1.02; letter-spacing: -.025em; }
.fg-title .fg-word { display: inline-block; white-space: nowrap; }
.fg-title .fg-word + .fg-word { margin-left: .24em; }
.fg-title .fg-word span { display: inline-block; opacity: 0; transform: translateY(46px) scale(.5) rotate(-8deg); }
.fg-cta { margin-top: 26px; padding: 13px 34px; border-radius: 999px; border: 1px solid rgba(255,255,255,.35); background: rgba(255,255,255,.12); color: #fff; font: 700 15px/1 'Outfit','Nunito',sans-serif; letter-spacing: .04em; cursor: pointer; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); transition: transform .2s ease, background .2s ease, border-color .2s; }
.fg-cta:hover { transform: translateY(-2px); background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.6); }
.fg-cta:active { transform: scale(.96); }
/* reveal: Diwali/Christmas after the tap, Chhath after sunrise */
.is-lit .fg-copy > *, .fg-scene-chhath .fg-copy > * { animation: fgUp .9s cubic-bezier(.2,.9,.3,1) forwards; }
.is-lit .fg-copy .fg-kicker { animation-delay: 1.2s; }
.is-lit .fg-copy .fg-cta { animation-delay: 3s; }
.is-lit .fg-copy .fg-title, .fg-scene-chhath .fg-copy .fg-title { opacity: 1; animation: none; }
.is-lit .fg-title .fg-word span { animation: fgLetter .8s cubic-bezier(.2,1.6,.4,1) forwards; animation-delay: calc(1.4s + var(--i) * 60ms); }
.fg-scene-chhath .fg-copy .fg-kicker { animation-delay: 3.4s; }
.fg-scene-chhath .fg-title .fg-word span { animation: fgLetter .8s cubic-bezier(.2,1.6,.4,1) forwards; animation-delay: calc(3.6s + var(--i) * 55ms); }
.fg-scene-chhath .fg-copy .fg-pill { animation-delay: 4.9s; }
.fg-scene-chhath .fg-copy .fg-cta { animation-delay: 5.6s; }

.fg-hint { position: absolute; left: 50%; translate: -50% 0; z-index: 5; padding: 9px 16px; border-radius: 999px; font: 600 13px/1 'Outfit','Nunito',sans-serif; letter-spacing: .06em; color: rgba(255,255,255,.9); background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); white-space: nowrap; animation: fgHintIn .8s ease 1s both, fgHintPulse 2.2s ease-in-out 1.8s infinite; transition: opacity .4s ease, transform .4s ease; pointer-events: none; }
.fg-hint.is-gone { opacity: 0 !important; animation: none; transform: translateY(8px); }

/* ── Diwali ── */
.fg-bg-night { background: radial-gradient(90% 60% at 50% 100%, #1d0c24, #07040d 70%); }
.fg-bg-diwali { background: radial-gradient(120% 70% at 50% 108%, #9a3412 0%, #4a0f35 36%, #1c0b30 62%, #0a0614 100%); opacity: 0; transition: opacity 2.4s ease .3s; }
.fg-bg-diwali::after { content: ''; position: absolute; inset: 0; background: radial-gradient(60% 38% at 50% 100%, rgba(255,170,60,.38), transparent 70%); animation: fgBreath 4s ease-in-out infinite; }
.is-lit .fg-bg-diwali { opacity: 1; }
.fg-scene-diwali .fg-stars { opacity: .5; transition: opacity 2s; }
.fg-scene-diwali.is-lit .fg-stars { opacity: 1; }
.fg-wave { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%; background: radial-gradient(circle, rgba(255,214,140,.55), rgba(255,140,60,.18) 45%, transparent 70%); opacity: 0; pointer-events: none; }
.is-lit .fg-wave { animation: fgWave 2.2s cubic-bezier(.2,.7,.2,1) forwards; }

.fg-hero { position: absolute; left: 50%; top: 50%; z-index: 6; translate: -50% -50%; padding: 30px 40px 20px; border: 0; background: transparent; cursor: pointer; transition: top 1.4s cubic-bezier(.6,0,.2,1) .9s, translate 1.4s cubic-bezier(.6,0,.2,1) .9s; }
.fg-hero:disabled { cursor: default; }
.is-lit .fg-hero { top: calc(100% - max(6px, env(safe-area-inset-bottom))); translate: -50% -100%; }
.fg-hero-ring { position: absolute; left: 50%; top: 58%; width: 190px; height: 190px; margin: -95px 0 0 -95px; border-radius: 50%; border: 1.5px solid rgba(255,200,120,.45); animation: fgRing 2.2s ease-out infinite; pointer-events: none; }
.is-lit .fg-hero-ring { display: none; }
.fg-scene-diwali:not(.is-lit) .fg-hero-diya .fg-flame, .fg-scene-diwali:not(.is-lit) .fg-hero-diya .fg-diya-glow { animation: none; transform: scale(0); opacity: 0; }
.fg-scene-diwali .fg-hint { top: calc(50% + 90px); }

.fg-diya-row { position: absolute; left: 0; right: 0; bottom: max(26px, env(safe-area-inset-bottom)); z-index: 5; display: flex; justify-content: center; align-items: flex-end; gap: clamp(14px, 3.4vw, 50px); pointer-events: none; }
.fg-hero-slot { width: 122px; }
.fg-row-diya { transition: opacity .8s ease 1.4s, transform .8s ease 1.4s; }
.fg-scene-diwali:not(.is-lit) .fg-row-diya { opacity: 0; transform: translateY(20px); }
.fg-scene-diwali:not(.is-lit) .fg-row-diya .fg-flame, .fg-scene-diwali:not(.is-lit) .fg-row-diya .fg-diya-glow { animation: none; opacity: 0; }

.fg-copy-diwali { top: 50%; translate: 0 -62%; }
.fg-diwali .fg-kicker { color: #fde68a; text-shadow: 0 0 18px rgba(253,224,71,.5); }
.fg-title-gold .fg-word span { background: linear-gradient(180deg, #fffbe6 0%, #fde68a 30%, #fbbf24 58%, #d97706 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 4px 22px rgba(245,158,11,.6)); }

.fg-toran { position: absolute; top: 0; left: 0; right: 0; height: 160px; display: flex; justify-content: space-between; padding: 0 1%; z-index: 2; pointer-events: none; }
.fg-toran-rope { position: absolute; top: 6px; left: 0; right: 0; height: 4px; background: linear-gradient(#b45309, #78350f); box-shadow: 0 2px 4px rgba(0,0,0,.4); opacity: 0; transition: opacity .6s .6s; }
.is-lit .fg-toran-rope { opacity: 1; }
.fg-toran-strand { position: relative; top: 8px; display: flex; flex-direction: column; align-items: center; transform-origin: 50% 0; opacity: 0; }
.is-lit .fg-toran-strand { animation: fgDrop .9s cubic-bezier(.2,1.4,.4,1) forwards, fgSwayStrand 3.4s ease-in-out infinite; animation-delay: calc(var(--td) + .6s), calc(var(--td) + 1.5s); }
.fg-toran-strand i { width: 18px; height: 18px; margin-top: -3px; border-radius: 50%; background: radial-gradient(circle at 50% 45%, #ffedd5 0 8%, #fb923c 20%, #ea580c 55%, #9a3412 100%); box-shadow: inset 0 -2px 3px rgba(0,0,0,.35), 0 0 8px rgba(251,146,60,.35); }
.fg-toran-strand i.is-yellow { background: radial-gradient(circle at 50% 45%, #fefce8 0 8%, #fde047 22%, #f59e0b 60%, #a16207 100%); }
.fg-toran-strand b { width: 10px; height: 22px; margin-top: 1px; border-radius: 0 100% 0 100%; background: linear-gradient(135deg, #4ade80, #166534); transform: rotate(45deg); }

.fg-embers { position: absolute; inset: 0; pointer-events: none; z-index: 1; opacity: 0; transition: opacity 2s 1.5s; }
.is-lit .fg-embers { opacity: 1; }
.fg-embers i { position: absolute; bottom: -10px; border-radius: 50%; background: #ffd166; box-shadow: 0 0 10px 2px rgba(255,170,60,.8); animation: fgEmber linear infinite; opacity: 0; }

.fg-diya { position: relative; width: calc(64px * var(--s)); height: calc(70px * var(--s)); display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
.fg-diya-bowl { position: relative; width: 100%; height: calc(26px * var(--s)); border-radius: 6px 6px 50% 50% / 6px 6px 100% 100%; background: linear-gradient(180deg, #f59e0b 0 12%, #c2410c 13%, #9a3412 60%, #6b210a 100%); box-shadow: inset 0 3px 0 rgba(255,220,150,.45), 0 6px 14px rgba(0,0,0,.45); }
.fg-diya-bowl::before { content: ''; position: absolute; top: calc(-5px * var(--s)); right: calc(-6px * var(--s)); width: calc(18px * var(--s)); height: calc(12px * var(--s)); border-radius: 0 60% 20% 0; background: #c2410c; transform: rotate(-18deg); }
.fg-diya-bowl span { position: absolute; left: 12%; right: 12%; top: 45%; height: 4px; background: radial-gradient(circle, #fde68a 1.5px, transparent 2px) 0 0 / 9px 4px repeat-x; opacity: .8; }
.fg-flame { position: absolute; bottom: calc(22px * var(--s)); right: calc(2px * var(--s)); width: calc(16px * var(--s)); height: calc(30px * var(--s)); transform-origin: 50% 100%; transform: scale(0); animation: fgFlameIn .7s cubic-bezier(.2,1.6,.4,1) forwards, fgFlicker 1.3s ease-in-out infinite; animation-delay: var(--d), calc(var(--d) + .7s); border-radius: 50% 50% 45% 45% / 65% 65% 35% 35%; background: radial-gradient(ellipse at 50% 85%, #fff 0 15%, #fde047 35%, #f97316 70%, rgba(234,88,12,0) 100%); filter: blur(.4px) drop-shadow(0 0 10px #f59e0b) drop-shadow(0 0 22px rgba(249,115,22,.7)); }
.fg-flame-core { position: absolute; left: 32%; right: 32%; bottom: 8%; height: 40%; border-radius: 50%; background: rgba(255,255,255,.9); filter: blur(1px); }
.fg-diya-glow { position: absolute; bottom: calc(18px * var(--s)); right: calc(-30px * var(--s)); width: calc(110px * var(--s)); height: calc(110px * var(--s)); border-radius: 50%; background: radial-gradient(circle, rgba(255,190,80,.5), transparent 65%); opacity: 0; animation: fgGlowIn .9s ease forwards, fgBreath 2.2s ease-in-out infinite; animation-delay: var(--d), calc(var(--d) + .9s); pointer-events: none; }

/* ── Chhath ── */
.fg-bg-dawn { background: linear-gradient(180deg, #2b1d5c 0%, #6a2c70 24%, #c0436b 42%, #f2994a 56%, #ffd27a 63%); }
.fg-bg-predawn { background: linear-gradient(180deg, #050816 0%, #0b1433 40%, #1b2350 63%); animation: fgFadeOut 6.5s cubic-bezier(.4,0,.6,1) .3s forwards; }
.fg-scene-chhath .fg-stars { animation: fgFadeOut 5s ease 1s forwards; }
.fg-sun-wrap { position: absolute; left: 50%; top: 63%; width: 0; height: 0; }
.fg-sun { position: absolute; width: clamp(130px, 22vmin, 220px); aspect-ratio: 1; left: 0; top: 0; translate: -50% -50%; border-radius: 50%; background: radial-gradient(circle at 50% 45%, #fffbe6, #ffd166 40%, #ff8c42 75%, #e8590c 100%); box-shadow: 0 0 60px 20px rgba(255,170,70,.55), 0 0 160px 60px rgba(255,120,60,.3); animation: fgSunRise 6.5s cubic-bezier(.25,.6,.25,1) .3s both; }
.fg-sun-halo { position: absolute; width: 140vmax; aspect-ratio: 1; left: 0; top: 0; translate: -50% -50%; border-radius: 50%; background: radial-gradient(circle, rgba(255,200,120,.45), rgba(255,140,90,.12) 30%, transparent 55%); opacity: 0; animation: fgFadeIn 5s ease 2s forwards; }
.fg-sun-rays { position: absolute; width: clamp(520px, 95vmin, 980px); aspect-ratio: 1; left: 0; top: 0; translate: -50% -50%; border-radius: 50%; background: repeating-conic-gradient(from 0deg, rgba(255,226,160,.2) 0 3deg, transparent 3deg 12deg); -webkit-mask: radial-gradient(circle, #000 14%, transparent 62%); mask: radial-gradient(circle, #000 14%, transparent 62%); clip-path: inset(0 0 50% 0); opacity: 0; animation: fgSpin 70s linear infinite, fgFadeIn 3s ease 4s forwards; }
.fg-water { position: absolute; left: 0; right: 0; top: 63%; bottom: 0; overflow: hidden; z-index: 2; cursor: pointer; background: linear-gradient(180deg, #2a2050 0%, #17204a 30%, #0b1330 100%); }
.fg-water::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(242,153,74,.35), rgba(192,67,107,.12) 30%, transparent 60%); opacity: 0; animation: fgFadeIn 5s ease 2.5s forwards; }
.fg-water-glow { position: absolute; left: 50%; top: 0; width: 60%; height: 70%; translate: -50% 0; background: radial-gradient(50% 60% at 50% 0%, rgba(255,190,110,.35), transparent 70%); opacity: 0; animation: fgFadeIn 4s ease 3s forwards; }
.fg-reflection { position: absolute; left: 50%; top: 0; width: clamp(140px, 24vmin, 240px); translate: -50% 0; display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 5px; opacity: 0; animation: fgFadeIn 3s ease 3.4s forwards; }
.fg-reflection i { display: block; height: 4px; width: calc(100% - var(--r) * 6%); border-radius: 4px; background: linear-gradient(90deg, transparent, rgba(255,214,140,.9), transparent); animation: fgShimmer 2.6s ease-in-out infinite; animation-delay: calc(var(--r) * -.21s); }
.fg-ripples i { position: absolute; width: 80px; height: 2px; border-radius: 2px; background: rgba(255,230,200,.2); animation: fgRipple 4s ease-in-out infinite; animation-delay: calc(var(--r) * -.5s); }
.fg-floater { position: absolute; translate: -50% -100%; animation: fgBob 3s ease-in-out infinite; animation-delay: calc(var(--f) * -.6s); pointer-events: none; }
.fg-floater::after { content: ''; position: absolute; left: -12px; right: -12px; bottom: -6px; height: 12px; border-radius: 50%; background: radial-gradient(rgba(255,180,80,.5), transparent 70%); }
.fg-floater.is-new { animation: fgPlop .7s cubic-bezier(.2,1.5,.4,1) both, fgBob 3s ease-in-out .7s infinite; }
.fg-splash { position: absolute; left: 50%; bottom: -4px; width: 20px; height: 7px; margin-left: -10px; border-radius: 50%; border: 1.5px solid rgba(255,220,180,.7); opacity: 0; }
.fg-floater.is-new .fg-splash { animation: fgSplash 1.1s ease-out .15s; }
.fg-cane { position: absolute; bottom: 20%; height: 74%; display: flex; gap: 14px; align-items: flex-end; z-index: 3; pointer-events: none; }
.fg-cane-left { left: 2%; }
.fg-cane-right { right: 2%; flex-direction: row-reverse; }
.fg-cane-stalk { position: relative; width: 11px; height: calc(100% - var(--k) * 12%); border-radius: 6px; background: repeating-linear-gradient(180deg, #24122f 0 46px, #12081b 46px 50px); transform-origin: 50% 100%; animation: fgCane 6s ease-in-out infinite; animation-delay: calc(var(--k) * -1.3s); }
.fg-cane-leaves { position: absolute; top: 0; left: 50%; }
.fg-cane-leaves i { position: absolute; top: calc(var(--l) * 10px); left: 0; width: 110px; height: 9px; border-radius: 0 100% 0 100%; background: #1a0d24; transform-origin: 0 50%; transform: rotate(calc(-150deg + var(--l) * 38deg)); }
.fg-cane-right .fg-cane-leaves i { transform: rotate(calc(-30deg - var(--l) * 38deg)); }
.fg-birds { position: absolute; inset: 0; pointer-events: none; }
.fg-bird { position: absolute; width: 44px; top: calc(16% + var(--b) * 5%); left: -60px; fill: none; stroke: #2b1236; stroke-width: 2.4; stroke-linecap: round; animation: fgFly 18s linear infinite, fgFlap .6s ease-in-out infinite alternate; animation-delay: calc(var(--b) * -3.2s + 4s), 0s; }
.fg-copy-chhath { top: max(9vh, 64px); }
.fg-chhath .fg-kicker { color: #ffe8b0; text-shadow: 0 2px 16px rgba(120,30,60,.6); }
.fg-title-dawn { font-size: clamp(42px, 8vw, 104px); }
.fg-title-dawn .fg-word span { background: linear-gradient(180deg, #fffaf0 0%, #ffe08a 45%, #ffb347 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 4px 20px rgba(120,20,60,.55)); }
.fg-pill { display: inline-flex; align-items: center; gap: 8px; margin-top: 18px; padding: 10px 18px; border-radius: 999px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.3); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); font-size: clamp(15px, 1.6vw, 18px); font-weight: 700; color: #fff8e7; }
.fg-pill svg { color: #ffd166; }
.fg-copy-chhath .fg-cta { display: block; margin: 16px auto 0; }
.fg-scene-chhath .fg-hint { bottom: max(24px, env(safe-area-inset-bottom)); animation: fgHintIn .8s ease 5s both, fgHintPulse 2.2s ease-in-out 6s infinite; }

/* ── Christmas ── */
.fg-bg-xmas { background: radial-gradient(120% 90% at 70% 0%, #1d3a6b 0%, #0d1f3c 50%, #050c1c 100%); }
.fg-moon { position: absolute; top: 9%; right: 12%; width: 74px; height: 74px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fffef2, #e8e6d0 70%); box-shadow: 0 0 40px 10px rgba(255,255,230,.25); }
.fg-hills { position: absolute; left: 0; right: 0; bottom: 0; height: 24%; z-index: 1; }
.fg-hills i { position: absolute; bottom: 0; border-radius: 50% 50% 0 0; background: linear-gradient(#f8fbff, #c9d8ec); box-shadow: inset 0 10px 30px rgba(255,255,255,.7); }
.fg-hills i:first-child { left: -10%; width: 75%; height: 100%; }
.fg-hills i:last-child { right: -12%; width: 80%; height: 82%; background: linear-gradient(#eef4fc, #b9cbe3); }
.fg-xmas-layout { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: clamp(20px, 6vw, 100px); padding: 60px 24px 0; z-index: 2; }
.fg-copy-xmas { position: relative; left: auto; right: auto; max-width: 560px; text-align: left; padding: 0; }
.fg-kicker-xmas { color: #ffd166; text-transform: uppercase; letter-spacing: .24em; font-size: 14px; }
.fg-title-xmas { font-size: clamp(50px, 8vw, 112px); }
.fg-title-xmas .fg-word span { background: linear-gradient(180deg, #ffffff 0%, #ffe8a3 55%, #ffb703 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 4px 18px rgba(230,57,70,.45)); }
.fg-xmas-art { position: relative; width: clamp(240px, 32vw, 400px); flex-shrink: 0; align-self: flex-end; margin-bottom: 12vh; transition: transform 1.2s cubic-bezier(.6,0,.2,1); }
.fg-tree { position: relative; width: 100%; overflow: visible; filter: drop-shadow(0 20px 30px rgba(0,0,0,.45)); z-index: 1; }
.fg-tree-glow { position: absolute; left: 50%; top: 45%; width: 150%; aspect-ratio: 1; translate: -50% -50%; border-radius: 50%; background: radial-gradient(circle, rgba(255,209,102,.28), transparent 60%); opacity: 0; transition: opacity 2s ease .6s; }
.is-lit .fg-tree-glow { opacity: 1; }
.fg-bulb .fg-bulb-glow { opacity: 0; }
.fg-bulb .fg-bulb-core { filter: saturate(.15) brightness(.55); transition: filter .3s ease var(--on); }
.is-lit .fg-bulb .fg-bulb-core { filter: none; }
.is-lit .fg-bulb .fg-bulb-glow { animation: fgBulbOn .4s ease forwards, fgBulb 1.8s ease-in-out infinite; animation-delay: var(--on), calc(var(--on) + 1s + var(--tw)); }
.fg-tree-star { cursor: pointer; transform-origin: 150px 12px; }
.fg-star-shape { filter: saturate(.3) brightness(.7); transition: filter .4s; }
.fg-star-halo { opacity: .3; animation: fgStarWait 1.8s ease-in-out infinite; transform-origin: 150px 10px; }
.is-lit .fg-tree-star { animation: fgStar 2.6s ease-in-out .6s infinite; cursor: default; }
.is-lit .fg-star-shape { filter: drop-shadow(0 0 8px #ffd166); }
.is-lit .fg-star-halo { animation: fgHalo 2s ease-in-out infinite; }
.fg-gifts { position: absolute; left: 6%; right: 6%; bottom: -1%; display: flex; justify-content: space-between; align-items: flex-end; pointer-events: none; z-index: 2; }
.fg-gift { position: relative; width: 22%; aspect-ratio: 1; border-radius: 6px; background: linear-gradient(90deg, transparent 43%, var(--gr) 43% 57%, transparent 57%), linear-gradient(var(--gc), color-mix(in srgb, var(--gc) 70%, #000)); box-shadow: 0 8px 16px rgba(0,0,0,.35); transform: translateY(40%) scale(0); transform-origin: 50% 100%; }
.is-lit .fg-gift { animation: fgGiftPop .8s cubic-bezier(.2,1.7,.4,1) forwards; animation-delay: var(--gd); }
.fg-gift::before { content: ''; position: absolute; left: -6%; right: -6%; top: -8%; height: 24%; border-radius: 4px; background: linear-gradient(90deg, transparent 43%, var(--gr) 43% 57%, transparent 57%), var(--gc); filter: brightness(1.1); }
.fg-gift::after { content: ''; position: absolute; left: 50%; top: -30%; width: 40%; height: 26%; translate: -50% 0; border: 4px solid var(--gr); border-radius: 50% 50% 0 0; border-bottom: 0; }
.fg-gift-tall { width: 18%; aspect-ratio: .7; }
.fg-scene-xmas .fg-hint { top: auto; bottom: -46px; }
.fg-scene-xmas:not(.is-lit) .fg-xmas-art { transform: translateX(calc(-1 * min(28vw, 330px))); }

/* ── corner badge ── */
.fg-corner { position: fixed; right: 28px; bottom: 96px; z-index: 1001; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; font-family: 'Outfit','Nunito',system-ui,sans-serif; }
.fg-badge { position: relative; width: 72px; height: 72px; border-radius: 22px; border: 1px solid rgba(255,255,255,.18); cursor: pointer; display: flex; align-items: center; justify-content: center; animation: fgBadgeIn .6s cubic-bezier(.2,1.5,.4,1) both, fgBadgeFloat 3.4s ease-in-out .6s infinite; -webkit-tap-highlight-color: transparent; transition: transform .2s; overflow: hidden; }
.fg-badge:hover { transform: scale(1.06); }
.fg-badge-diwali { background: radial-gradient(circle at 50% 30%, #4a1d4f, #1a0b2e); box-shadow: 0 10px 26px rgba(0,0,0,.35), 0 0 22px rgba(245,158,11,.45); }
.fg-badge-chhath { background: linear-gradient(180deg, #5b2a6e, #f2994a 60%, #1b2a4a 60%); box-shadow: 0 10px 26px rgba(0,0,0,.35), 0 0 22px rgba(255,150,70,.4); }
.fg-badge-christmas { background: radial-gradient(circle at 50% 30%, #1d3a6b, #071428); box-shadow: 0 10px 26px rgba(0,0,0,.35), 0 0 22px rgba(255,209,102,.35); }
.fg-badge-diya { margin-top: 2px; }
.fg-badge-diya .fg-diya-glow { display: none; }
.fg-badge-sun { position: relative; width: 100%; height: 100%; }
.fg-badge-sun span { position: absolute; left: 50%; top: 60%; width: 34px; height: 34px; translate: -50% -50%; border-radius: 50%; background: radial-gradient(circle, #fffbe6, #ffd166 45%, #ff8c42); box-shadow: 0 0 16px 4px rgba(255,170,70,.6); clip-path: inset(-20px -20px 50% -20px); animation: fgBadgeSun 3s ease-in-out infinite; }
.fg-badge-sun i { position: absolute; left: 50%; height: 2px; border-radius: 2px; translate: -50% 0; background: rgba(255,200,110,.8); animation: fgShimmer 2.4s ease-in-out infinite; }
.fg-badge-sun i:nth-of-type(1) { top: 66%; width: 30px; }
.fg-badge-sun i:nth-of-type(2) { top: 74%; width: 22px; animation-delay: -.6s; }
.fg-badge-sun i:nth-of-type(3) { top: 82%; width: 14px; animation-delay: -1.2s; }
.fg-badge-tree { width: 40px; height: 46px; }
.fg-badge-bulb { animation: fgBulb 1.6s ease-in-out infinite; }
.fg-mini { position: relative; width: 240px; padding: 18px 18px 16px; border-radius: 22px; text-align: center; color: #fff; box-shadow: 0 20px 44px rgba(0,0,0,.45); animation: fgMiniPop .42s cubic-bezier(.2,1.5,.4,1) both; transform-origin: 85% 100%; }
.fg-mini-diwali { background: radial-gradient(120% 120% at 50% 0%, #4a1d4f, #1a0b2e 75%); border: 1px solid rgba(245,158,11,.35); }
.fg-mini-chhath { background: linear-gradient(180deg, #5b2a6e, #b83f6b 55%, #f2994a); border: 1px solid rgba(255,210,122,.4); }
.fg-mini-xmas { background: radial-gradient(120% 120% at 50% 0%, #1d3a6b, #071428 75%); border: 1px solid rgba(255,209,102,.3); }
.fg-mini-art { width: 64px; height: 64px; margin: 0 auto 6px; display: flex; align-items: center; justify-content: center; border-radius: 18px; overflow: hidden; }
.fg-mini-chhath .fg-mini-art { background: linear-gradient(180deg, #5b2a6e, #f2994a 60%, #1b2a4a 60%); }
.fg-mini-title { font-size: 19px; font-weight: 800; }
.fg-mini-text { font-size: 13.5px; line-height: 1.45; color: rgba(255,255,255,.82); margin-top: 3px; }
.fg-mini-cta { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; padding: 9px 16px; border: 1px solid rgba(255,255,255,.25); border-radius: 999px; background: rgba(255,255,255,.12); color: #fff; font: 700 13px/1 'Outfit','Nunito',sans-serif; cursor: pointer; transition: background .2s; }
.fg-mini-cta:hover { background: rgba(255,255,255,.24); }
.fg-mini-x { position: absolute; top: 8px; right: 10px; width: 28px; height: 28px; border-radius: 50%; border: 0; background: rgba(255,255,255,.12); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }

@media (max-width: 767px) {
  .fg-corner { right: 16px; bottom: 90px; }
  .fg-toran-strand i { width: 13px; height: 13px; }
  .fg-toran-strand:nth-child(2n+1) { display: none; }
  .fg-diya-row { gap: 10px; }
  .fg-diya-row .fg-row-diya:first-child, .fg-diya-row .fg-row-diya:last-child { display: none; }
  .fg-hero-slot { width: 104px; }
  .fg-copy-diwali { translate: 0 -75%; }
  .fg-cane { height: 52%; bottom: 30%; }
  .fg-cane-leaves i { width: 64px; }
  .fg-xmas-layout { flex-direction: column-reverse; justify-content: center; gap: 18px; padding: 70px 20px 8vh; }
  .fg-copy-xmas { text-align: center; }
  .fg-xmas-art { align-self: center; margin-bottom: 0; width: min(62vw, 260px); }
  .fg-scene-xmas:not(.is-lit) .fg-xmas-art { transform: translateY(16vh); }
  .fg-hills { height: 12%; }
}

@keyframes fgIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fgOut { to { opacity: 0; transform: scale(1.04); filter: blur(4px); } }
@keyframes fgUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes fgLetter { to { opacity: 1; transform: none; } }
@keyframes fgTwinkle { 0%, 100% { opacity: .25; transform: scale(.7); } 50% { opacity: 1; transform: scale(1.1); } }
@keyframes fgBreath { 0%, 100% { opacity: .75; } 50% { opacity: 1; } }
@keyframes fgSpin { to { transform: rotate(360deg); } }
@keyframes fgWave { 0% { opacity: 1; transform: scale(1); } 70% { opacity: .55; } 100% { opacity: 0; transform: scale(70); } }
@keyframes fgRing { 0% { transform: scale(.5); opacity: .9; } 100% { transform: scale(1.4); opacity: 0; } }
@keyframes fgHintIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes fgHintPulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
@keyframes fgDrop { from { opacity: 0; translate: 0 -70px; } to { opacity: 1; translate: 0 0; } }
@keyframes fgSwayStrand { 0%, 100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
@keyframes fgEmber { 0% { opacity: 0; transform: translate(0, 0) scale(.6); } 10% { opacity: 1; } 80% { opacity: .8; } 100% { opacity: 0; transform: translate(var(--drift), -85vh) scale(.2); } }
@keyframes fgFlameIn { 0% { transform: scale(0); } 100% { transform: scale(1); } }
@keyframes fgFlicker { 0%, 100% { transform: scale(1, 1) skewX(0); } 20% { transform: scale(.94, 1.06) skewX(2deg); } 40% { transform: scale(1.04, .96) skewX(-2deg); } 60% { transform: scale(.97, 1.05) skewX(1deg); } 80% { transform: scale(1.02, .98) skewX(-1deg); } }
@keyframes fgGlowIn { to { opacity: 1; } }
@keyframes fgFadeOut { to { opacity: 0; } }
@keyframes fgFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fgSunRise { from { transform: translateY(75%); } to { transform: none; } }
@keyframes fgShimmer { 0%, 100% { opacity: .45; transform: scaleX(.85); } 50% { opacity: 1; transform: scaleX(1.08); } }
@keyframes fgRipple { 0%, 100% { opacity: .08; transform: translateX(0) scaleX(.6); } 50% { opacity: .45; transform: translateX(16px) scaleX(1); } }
@keyframes fgBob { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-5px) rotate(2deg); } }
@keyframes fgPlop { 0% { opacity: 0; transform: translateY(-60px) scale(.6); } 60% { opacity: 1; transform: translateY(4px) scale(1.05); } 100% { transform: none; } }
@keyframes fgSplash { 0% { opacity: .9; transform: scale(.4); } 100% { opacity: 0; transform: scale(3.2); } }
@keyframes fgCane { 0%, 100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
@keyframes fgFly { from { transform: translateX(0); } to { transform: translateX(calc(100vw + 120px)); } }
@keyframes fgFlap { from { scale: 1 1; } to { scale: 1 .45; } }
@keyframes fgBulbOn { from { opacity: 0; } to { opacity: .45; } }
@keyframes fgBulb { 0%, 100% { opacity: .2; } 50% { opacity: .6; } }
@keyframes fgStar { 0%, 100% { transform: scale(1) rotate(0); } 50% { transform: scale(1.1) rotate(6deg); } }
@keyframes fgStarWait { 0%, 100% { opacity: .15; transform: scale(.7); } 50% { opacity: .5; transform: scale(1.05); } }
@keyframes fgHalo { 0%, 100% { opacity: .75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
@keyframes fgGiftPop { 0% { transform: translateY(40%) scale(0); } 100% { transform: none; } }
@keyframes fgBadgeIn { from { opacity: 0; transform: translateY(20px) scale(.6); } to { opacity: 1; transform: none; } }
@keyframes fgBadgeFloat { 0%, 100% { translate: 0 0; } 50% { translate: 0 -5px; } }
@keyframes fgBadgeSun { 0%, 100% { transform: translateY(2px); } 50% { transform: translateY(-2px); } }
@keyframes fgMiniPop { from { opacity: 0; transform: scale(.6) translateY(16px); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .fg-overlay *, .fg-overlay *::before, .fg-overlay *::after, .fg-corner * { animation-duration: .01ms !important; animation-iteration-count: 1 !important; animation-delay: 0s !important; transition-duration: .01ms !important; transition-delay: 0s !important; }
}
`
