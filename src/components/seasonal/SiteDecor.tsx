'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { activeDecor, isSeasonalRouteBlocked, type DecorTheme } from '@/lib/seasonal/seasons'
import { useSeasonalTick } from './useSeasonalTick'

/**
 * Festival decorations along the top of every page. They go up gradually in
 * the days before a festival (see DECOR_SCHEDULE in seasons.ts):
 *
 *   level 1 (3 days before)  garland goes up
 *   level 2 (2 days before)  hanging strands, ornaments, bulbs hung but off
 *   level 3 (1 day before)   lights switched on, lanterns
 *   level 4 (festival day)   everything glowing
 *
 * Pure SVG, drawn on the visitor's device, never blocks clicks.
 */

type Level = 1 | 2 | 3 | 4
type Css = CSSProperties & Record<`--${string}`, string | number>

const pr = (i: number, a: number, b: number, salt = 1) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return a + (x - Math.floor(x)) * (b - a)
}

export default function SiteDecor() {
  const pathname = usePathname() || '/'
  const [decor, setDecor] = useState<{ theme: DecorTheme; level: Level } | null>(null)
  const [w, setW] = useState(0)
  const tick = useSeasonalTick()

  useEffect(() => { setDecor(activeDecor()) }, [tick])

  useEffect(() => {
    let raf = 0
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setW(window.innerWidth)) }
    onResize()
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  if (!decor || !w || isSeasonalRouteBlocked(pathname)) return null

  return (
    <>
      <style>{CSS}</style>
      <div key={`${decor.theme}-${decor.level}`} className={`sd sd-${decor.theme} sd-l${decor.level}`} aria-hidden="true" data-no-snow>
        {decor.level === 4 && <div className="sd-ambient" />}
        <Garland w={w} theme={decor.theme} level={decor.level} />
      </div>
    </>
  )
}

/* ───────────────────────── geometry ───────────────────────── */

interface Geo {
  w: number
  seg: number
  n: number
  top: number
  depth: number
  mobile: boolean
  hooks: number[]
  /** point on swag s at fraction t */
  at: (s: number, t: number) => { x: number; y: number; a: number }
  path: string
}

function geometry(w: number): Geo {
  const mobile = w < 768
  const n = Math.max(2, Math.round(w / (mobile ? 130 : 210)))
  const seg = w / n
  const top = 2
  const depth = mobile ? 15 : 21
  const hooks = Array.from({ length: n + 1 }, (_, i) => i * seg)
  const at = (s: number, t: number) => {
    const x = s * seg + seg * t
    const y = top + 4 * depth * t * (1 - t)
    const a = Math.atan2(4 * depth * (1 - 2 * t), seg) // slope angle
    return { x, y, a }
  }
  let path = `M0 ${top}`
  for (let i = 0; i < n; i++) path += ` Q${i * seg + seg / 2} ${top + 2 * depth} ${(i + 1) * seg} ${top}`
  return { w, seg, n, top, depth, mobile, hooks, at, path }
}

/** Evenly spaced points along every swag. */
function along(g: Geo, step: number, inset = 0) {
  const out: { x: number; y: number; a: number; s: number; k: number }[] = []
  const per = Math.max(2, Math.round(g.seg / step))
  for (let s = 0; s < g.n; s++) {
    for (let k = 0; k < per; k++) {
      const t = (k + 0.5) / per
      const p = g.at(s, t)
      out.push({ ...p, y: p.y + inset, s, k })
    }
  }
  return out
}

/* ───────────────────────── pieces ───────────────────────── */

function Marigold({ x, y, r, yellow, i }: { x: number; y: number; r: number; yellow: boolean; i: number }) {
  return (
    <g className="sd-pop" style={{ '--i': i } as Css}>
      <circle cx={x} cy={y} r={r} fill={yellow ? 'url(#sdMgY)' : 'url(#sdMgO)'} />
      <circle cx={x} cy={y} r={r * 0.72} fill="none" stroke={yellow ? '#b45309' : '#9a3412'} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="1.2 1.6" />
    </g>
  )
}

function Leaf({ x, y, rot, len = 20, dark = false }: { x: number; y: number; rot: number; len?: number; dark?: boolean }) {
  const w = len * 0.36
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M0 0 C ${w} ${len * 0.25}, ${w} ${len * 0.7}, 0 ${len} C ${-w} ${len * 0.7}, ${-w} ${len * 0.25}, 0 0 Z`} fill={dark ? 'url(#sdLeafD)' : 'url(#sdLeaf)'} />
      <path d={`M0 1 L0 ${len - 2}`} stroke="#14532d" strokeOpacity="0.5" strokeWidth="0.7" />
    </g>
  )
}

function Bulb({ x, y, color, i, lit }: { x: number; y: number; color: string; i: number; lit: boolean }) {
  return (
    <g className={`sd-bulb ${lit ? 'is-lit' : ''}`} style={{ '--i': i, '--c': color } as Css}>
      {lit && <circle cx={x} cy={y + 4} r={9} fill={`url(#sdG-${color.slice(1)})`} className="sd-bulb-glow" />}
      <rect x={x - 1.6} y={y - 3} width={3.2} height={3} rx={0.8} fill="#3f3f46" />
      <ellipse cx={x} cy={y + 3.6} rx={2.9} ry={4.2} fill={lit ? color : '#a8a29e'} fillOpacity={lit ? 1 : 0.55} className="sd-bulb-core" />
      <ellipse cx={x - 0.9} cy={y + 2.3} rx={0.8} ry={1.3} fill="#fff" opacity={lit ? 0.85 : 0.5} />
    </g>
  )
}

function Lantern({ x, len, glow, i }: { x: number; len: number; glow: boolean; i: number }) {
  return (
    <g className="sd-swing" style={{ transformOrigin: `${x}px 4px`, '--i': i } as Css}>
      <line x1={x} y1={4} x2={x} y2={len} stroke="#b45309" strokeWidth="1.2" />
      {glow && <circle cx={x} cy={len + 15} r={30} fill="url(#sdGlowWarm)" className="sd-breathe" />}
      <rect x={x - 6} y={len} width={12} height={3.5} rx={1} fill="#92400e" />
      <polygon points={`${x},${len + 2} ${x + 12},${len + 9} ${x + 12},${len + 22} ${x},${len + 30} ${x - 12},${len + 22} ${x - 12},${len + 9}`} fill="url(#sdLantern)" />
      <path d={`M${x - 6} ${len + 6} L${x - 6} ${len + 26} M${x + 6} ${len + 6} L${x + 6} ${len + 26}`} stroke="#7f1d1d" strokeOpacity="0.35" strokeWidth="1" />
      {[-4, -1.5, 1.5, 4].map(d => <line key={d} x1={x + d} y1={len + 29} x2={x + d * 1.2} y2={len + 40} stroke="#f59e0b" strokeWidth="1.1" />)}
    </g>
  )
}

function Bauble({ x, y, len, kind, i }: { x: number; y: number; len: number; kind: 'red' | 'gold' | 'silver'; i: number }) {
  const cy = y + len + 7
  return (
    <g className="sd-pop" style={{ '--i': i } as Css}>
      <g className="sd-swing" style={{ transformOrigin: `${x}px ${y}px`, '--i': i } as Css}>
        <line x1={x} y1={y} x2={x} y2={cy - 7} stroke="#d4af37" strokeWidth="0.8" />
        <rect x={x - 2.4} y={cy - 9} width={4.8} height={3} rx={0.8} fill="#d4af37" />
        <circle cx={x} cy={cy} r={6.5} fill={`url(#sdB-${kind})`} />
        <ellipse cx={x - 2.2} cy={cy - 2.3} rx={1.6} ry={2.2} fill="#fff" opacity="0.7" transform={`rotate(-30 ${x - 2.2} ${cy - 2.3})`} />
      </g>
    </g>
  )
}

function Bow({ x, y, i }: { x: number; y: number; i: number }) {
  return (
    <g className="sd-pop" style={{ '--i': i } as Css} transform={`translate(${x} ${y})`}>
      <path d="M0 0 C -9 -8, -15 -2, -12 4 C -9 8, -4 4, 0 0 Z" fill="url(#sdRibbon)" />
      <path d="M0 0 C 9 -8, 15 -2, 12 4 C 9 8, 4 4, 0 0 Z" fill="url(#sdRibbon)" />
      <path d="M-1 1 L-6 16 L-3 14 L-1 18 Z M1 1 L6 16 L3 14 L1 18 Z" fill="#b91c1c" />
      <circle r={3} fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.6" />
    </g>
  )
}

function SunOrnament({ x, len }: { x: number; len: number }) {
  const cy = len + 14
  return (
    <g className="sd-swing" style={{ transformOrigin: `${x}px 4px` } as Css}>
      <line x1={x} y1={4} x2={x} y2={cy - 12} stroke="#b45309" strokeWidth="1.1" />
      <circle cx={x} cy={cy} r={26} fill="url(#sdGlowWarm)" className="sd-breathe" />
      <g className="sd-spin" style={{ transformOrigin: `${x}px ${cy}px` }}>
        {Array.from({ length: 12 }, (_, k) => (
          <path key={k} d={`M${x} ${cy - 15} L${x + 2.4} ${cy - 9} L${x - 2.4} ${cy - 9} Z`} fill="#f59e0b" transform={`rotate(${k * 30} ${x} ${cy})`} />
        ))}
      </g>
      <circle cx={x} cy={cy} r={8.5} fill="url(#sdSun)" />
    </g>
  )
}

/* ───────────────────────── garlands ───────────────────────── */

function Defs() {
  return (
    <defs>
      <radialGradient id="sdMgO" cx="45%" cy="40%"><stop offset="0" stopColor="#ffedd5" /><stop offset="0.25" stopColor="#fb923c" /><stop offset="0.7" stopColor="#ea580c" /><stop offset="1" stopColor="#9a3412" /></radialGradient>
      <radialGradient id="sdMgY" cx="45%" cy="40%"><stop offset="0" stopColor="#fefce8" /><stop offset="0.25" stopColor="#fde047" /><stop offset="0.7" stopColor="#f59e0b" /><stop offset="1" stopColor="#a16207" /></radialGradient>
      <linearGradient id="sdLeaf" x1="0" x2="1"><stop offset="0" stopColor="#4ade80" /><stop offset="1" stopColor="#15803d" /></linearGradient>
      <linearGradient id="sdLeafD" x1="0" x2="1"><stop offset="0" stopColor="#22c55e" /><stop offset="1" stopColor="#166534" /></linearGradient>
      <radialGradient id="sdGlowWarm"><stop offset="0" stopColor="#ffd27a" stopOpacity="0.55" /><stop offset="1" stopColor="#ffb347" stopOpacity="0" /></radialGradient>
      <radialGradient id="sdLantern" cx="50%" cy="45%"><stop offset="0" stopColor="#fff3c4" /><stop offset="0.35" stopColor="#f97316" /><stop offset="1" stopColor="#b91c1c" /></radialGradient>
      <radialGradient id="sdSun" cx="45%" cy="40%"><stop offset="0" stopColor="#fffbe6" /><stop offset="0.5" stopColor="#ffd166" /><stop offset="1" stopColor="#f97316" /></radialGradient>
      <radialGradient id="sdB-red" cx="35%" cy="35%"><stop offset="0" stopColor="#fca5a5" /><stop offset="0.45" stopColor="#dc2626" /><stop offset="1" stopColor="#7f1d1d" /></radialGradient>
      <radialGradient id="sdB-gold" cx="35%" cy="35%"><stop offset="0" stopColor="#fef3c7" /><stop offset="0.45" stopColor="#eab308" /><stop offset="1" stopColor="#854d0e" /></radialGradient>
      <radialGradient id="sdB-silver" cx="35%" cy="35%"><stop offset="0" stopColor="#ffffff" /><stop offset="0.45" stopColor="#cbd5e1" /><stop offset="1" stopColor="#475569" /></radialGradient>
      {[...WARM, ...MULTI].map(c => (
        <radialGradient key={c} id={`sdG-${c.slice(1)}`}><stop offset="0" stopColor={c} stopOpacity="0.95" /><stop offset="0.4" stopColor={c} stopOpacity="0.45" /><stop offset="1" stopColor={c} stopOpacity="0" /></radialGradient>
      ))}
      <linearGradient id="sdRibbon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ef4444" /><stop offset="1" stopColor="#991b1b" /></linearGradient>
    </defs>
  )
}

const WARM = ['#ffd27a', '#ffc35c', '#ffe3a3']
const MULTI = ['#ff4d6d', '#ffd166', '#4cc9f0', '#80ed99', '#f72585', '#ffb703']

function Garland({ w, theme, level }: { w: number; theme: DecorTheme; level: Level }) {
  const g = geometry(w)
  const H = 130
  const parts: ReactNode[] = []
  const lit = level >= 3
  const mgR = g.mobile ? 5 : 6.2

  if (theme === 'diwali') {
    parts.push(<path key="rope" d={g.path} fill="none" stroke="#7c2d12" strokeWidth="1.4" />)
    along(g, mgR * 1.75).forEach((p, i) => parts.push(<Marigold key={`m${i}`} x={p.x} y={p.y + 1} r={mgR} yellow={(p.k + p.s) % 2 === 1} i={i} />))
    if (level >= 2) {
      g.hooks.forEach((x, h) => {
        const len = 3 + (h % 2)
        for (let k = 0; k < len; k++) parts.push(<Marigold key={`h${h}-${k}`} x={x} y={g.top + 5 + k * mgR * 1.7} r={mgR * 0.95} yellow={k % 2 === 0} i={h * 3 + k} />)
        parts.push(<Leaf key={`hl${h}`} x={x} y={g.top + 3 + len * mgR * 1.7} rot={pr(h, -14, 14)} len={g.mobile ? 14 : 18} />)
      })
      along(g, g.mobile ? 30 : 36, 9).forEach((p, i) => parts.push(<Bulb key={`b${i}`} x={p.x} y={p.y} color={WARM[i % 3]} i={i} lit={lit} />))
    }
    if (level >= 3) {
      const picks = g.mobile ? [g.n - 1] : [1, g.n - 1]
      picks.forEach((h, k) => {
        parts.push(<Lantern key={`lan${k}`} x={g.hooks[h]} len={g.top + (g.mobile ? 30 : 34)} glow={level >= 4} i={k} />)
      })
    }
  }

  if (theme === 'chhath') {
    parts.push(<path key="rope" d={g.path} fill="none" stroke="#6b4423" strokeWidth="1.3" />)
    along(g, g.mobile ? 9 : 11).forEach((p, i) => {
      const rot = (p.a * 180) / Math.PI * 0.4 + pr(i, -10, 10, 3)
      parts.push(<g key={`l${i}`} className="sd-pop" style={{ '--i': i } as Css}><Leaf x={p.x} y={p.y} rot={rot} len={g.mobile ? 17 : 22} dark={i % 2 === 1} /></g>)
    })
    if (level >= 2) {
      along(g, g.mobile ? 27 : 33, 2).forEach((p, i) => parts.push(<Marigold key={`m${i}`} x={p.x} y={p.y} r={mgR * 0.9} yellow={i % 2 === 0} i={i} />))
      g.hooks.forEach((x, h) => {
        for (let k = 0; k < 2; k++) parts.push(<Marigold key={`h${h}-${k}`} x={x} y={g.top + 5 + k * mgR * 1.7} r={mgR * 0.9} yellow={k % 2 === 1} i={h * 2 + k} />)
        parts.push(<Leaf key={`hl${h}`} x={x} y={g.top + 3 + 2 * mgR * 1.7} rot={pr(h, -12, 12, 9)} len={g.mobile ? 14 : 18} />)
      })
      along(g, g.mobile ? 30 : 38, 16).forEach((p, i) => parts.push(<Bulb key={`b${i}`} x={p.x} y={p.y} color={WARM[i % 3]} i={i} lit={lit} />))
    }
    if (level >= 3) {
      parts.push(<SunOrnament key="sun" x={g.hooks[g.n - 1]} len={g.top + (g.mobile ? 26 : 30)} />)
    }
  }

  if (theme === 'christmas') {
    // layered strokes give a fuzzy pine look
    parts.push(<path key="p1" d={g.path} fill="none" stroke="#0f3d24" strokeWidth={g.mobile ? 11 : 14} strokeLinecap="round" />)
    parts.push(<path key="p2" d={g.path} fill="none" stroke="#166534" strokeWidth={g.mobile ? 10 : 13} strokeDasharray="2 2.5" strokeLinecap="round" />)
    parts.push(<path key="p3" d={g.path} fill="none" stroke="#15803d" strokeWidth={g.mobile ? 7 : 9} strokeDasharray="1.5 3.5" strokeLinecap="round" transform="translate(0 -1)" />)
    parts.push(<path key="p4" d={g.path} fill="none" stroke="#22c55e" strokeOpacity="0.55" strokeWidth={g.mobile ? 4 : 5} strokeDasharray="1 4" strokeLinecap="round" transform="translate(0 -2)" />)
    if (level >= 4) {
      along(g, 5, -4).forEach((p, i) => i % 2 === 0 && parts.push(<circle key={`sn${i}`} cx={p.x + pr(i, -1, 1)} cy={p.y + pr(i, -1, 1, 5)} r={pr(i, 1.2, 2.6, 7)} fill="#fff" opacity="0.92" />))
    }
    if (level >= 2) {
      const kinds = ['red', 'gold', 'silver'] as const
      for (let s = 0; s < g.n; s++) {
        const p = g.at(s, 0.5)
        parts.push(<Bauble key={`ba${s}`} x={p.x} y={p.y + 4} len={8 + (s % 3) * 6} kind={kinds[s % 3]} i={s} />)
        if (!g.mobile) {
          const q = g.at(s, 0.27)
          parts.push(<Bauble key={`bb${s}`} x={q.x} y={q.y + 4} len={4} kind={kinds[(s + 1) % 3]} i={s + 20} />)
        }
      }
      g.hooks.forEach((x, h) => parts.push(<Bow key={`bow${h}`} x={x} y={g.top + 4} i={h} />))
      along(g, g.mobile ? 22 : 26, 6).forEach((p, i) => parts.push(<Bulb key={`b${i}`} x={p.x} y={p.y} color={MULTI[i % MULTI.length]} i={i} lit={lit} />))
    }
  }

  return (
    <svg className="sd-svg" width={w} height={H} viewBox={`0 0 ${w} ${H}`}>
      <Defs />
      <g className="sd-hang">{parts}</g>
    </svg>
  )
}

/* ───────────────────────── styles ───────────────────────── */

const CSS = `
.sd { position: fixed; top: 0; left: 0; right: 0; height: 130px; z-index: 945; pointer-events: none; overflow: visible; }
.sd-svg { display: block; overflow: visible; filter: drop-shadow(0 3px 3px rgba(15,23,42,.18)); }
.sd-hang { animation: sdHang 1.1s cubic-bezier(.2,1.3,.4,1) both; }
.sd-pop { animation: sdPop .5s cubic-bezier(.2,1.5,.4,1) both; animation-delay: calc(.35s + var(--i) * 6ms); transform-box: fill-box; transform-origin: 50% 0; }
.sd-swing { animation: sdSwing 4.5s ease-in-out infinite; animation-delay: calc(var(--i, 0) * -1.3s); }
.sd-breathe { animation: sdBreathe 2.6s ease-in-out infinite; }
.sd-spin { animation: sdSpin 24s linear infinite; }
.sd-bulb.is-lit .sd-bulb-glow { opacity: .6; animation: sdTwinkle 2.4s ease-in-out infinite; animation-delay: calc(var(--i) * -.37s); }
.sd-bulb.is-lit .sd-bulb-core { filter: drop-shadow(0 0 3px var(--c)); }
.sd-ambient { position: absolute; left: 0; right: 0; top: 0; height: 120px; opacity: .55; animation: sdBreathe 5s ease-in-out infinite; }
.sd-diwali .sd-ambient { background: radial-gradient(60% 100% at 50% 0%, rgba(255,170,60,.22), transparent 70%); }
.sd-chhath .sd-ambient { background: radial-gradient(60% 100% at 50% 0%, rgba(255,150,80,.25), transparent 70%); }
.sd-christmas .sd-ambient { background: radial-gradient(60% 100% at 50% 0%, rgba(255,209,102,.16), transparent 70%); }

@keyframes sdHang { from { transform: translateY(-40px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes sdPop { from { transform: scale(0); } to { transform: none; } }
@keyframes sdSwing { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes sdBreathe { 0%, 100% { opacity: .65; } 50% { opacity: 1; } }
@keyframes sdSpin { to { transform: rotate(360deg); } }
@keyframes sdTwinkle { 0%, 100% { opacity: .35; } 50% { opacity: .85; } }

@media (prefers-reduced-motion: reduce) {
  .sd * { animation: none !important; }
}
@media print { .sd { display: none; } }
`
