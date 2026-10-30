'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { activeDecor, isSeasonalRouteBlocked, type DecorTheme } from '@/lib/seasonal/seasons'
import { useSeasonalTick } from './useSeasonalTick'
import { CHRISTMAS_ART_CSS, SantaSleigh } from './ChristmasArt'

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
      {decor.theme === 'christmas' && <style>{CHRISTMAS_ART_CSS}</style>}
      <div key={`${decor.theme}-${decor.level}`} className={`sd sd-${decor.theme} sd-l${decor.level}`} aria-hidden="true" data-no-snow>
        {decor.level === 4 && <div className="sd-ambient" />}
        <Garland w={w} theme={decor.theme} level={decor.level} />
      </div>
      {decor.theme === 'christmas' && decor.level >= 2 && <ChristmasGround level={decor.level} mobile={w < 768} />}
      {decor.theme === 'diwali' && <DiwaliGround level={decor.level} mobile={w < 768} />}
      {decor.theme === 'christmas' && decor.level >= 3 && <SantaFlight />}
    </>
  )
}

/* ───────────────────────── Diwali: diyas, rangoli, urli and sparklers along the bottom ───────────────────────── */

function GroundDiya({ x, s = 1, lit, i }: { x: number; s?: number; lit: boolean; i: number }) {
  return (
    <g transform={`translate(${x} 90) scale(${s})`}>
      <g className="sd-pop-up" style={{ '--i': i } as Css}>
        {lit && <circle cx="12" cy="-26" r="22" fill="url(#sdDiyaGlow)" className="sd-breathe" />}
        <path d="M-14 -12 Q 0 2 16 -12 Q 18 -6 14 -4 Q 0 6 -12 -4 Q -16 -6 -14 -12 Z" fill="#b45309" />
        <path d="M-14 -12 Q 0 -6 16 -12 L 22 -16 Q 18 -9 16 -12" fill="#c2410c" />
        <path d="M-14 -12 Q 0 -7 16 -12" stroke="#fbbf24" strokeWidth="1.4" fill="none" />
        {[-7, -1, 5].map(dx => <circle key={dx} cx={dx} cy={-6} r={1} fill="#fde68a" />)}
        {lit && (
          <g className="sd-flame" style={{ animationDelay: `${i * -0.23}s` }}>
            <path d="M19 -15 C 13 -21, 16 -30, 20 -36 C 24 -30, 27 -21, 21 -15 Z" fill="#f97316" />
            <path d="M20 -16 C 17 -20, 18 -26, 20 -30 C 22 -26, 23 -20, 20 -16 Z" fill="#fde68a" />
          </g>
        )}
      </g>
    </g>
  )
}

function HalfRangoli({ cx, r, i }: { cx: number; r: number; i: number }) {
  const ring = (n: number, rr: number, rx: number, ry: number, fill: string) =>
    Array.from({ length: n }, (_, k) => <ellipse key={k} cx={0} cy={-rr} rx={rx} ry={ry} fill={fill} transform={`rotate(${(360 / n) * k})`} />)
  return (
    <g transform={`translate(${cx} 92)`} className="sd-rangoli-in" style={{ '--i': i } as Css}>
      <g transform={`scale(${r / 100})`}>
        <g className="sd-spin-slow">{ring(20, 82, 8, 18, '#f97316')}{ring(40, 98, 2.4, 2.4, '#fde047')}</g>
        <g>{ring(14, 56, 9, 18, '#e11d48')}{ring(14, 52, 4, 9, '#fda4af')}</g>
        <g>{ring(8, 28, 9, 15, '#facc15')}<circle r="14" fill="#7c3aed" /><circle r="7" fill="#fde047" /></g>
      </g>
    </g>
  )
}

function Urli({ x, lit, i }: { x: number; lit: boolean; i: number }) {
  return (
    <g transform={`translate(${x} 90)`}>
      <g className="sd-pop-up" style={{ '--i': i } as Css}>
        <ellipse cx="0" cy="-14" rx="38" ry="8" fill="#7c2d12" />
        <path d="M-38 -14 Q 0 14 38 -14 Z" fill="url(#sdBrass)" />
        <ellipse cx="0" cy="-14" rx="34" ry="6" fill="#1e3a5f" opacity=".85" />
        {[[-20, -15, '#f97316'], [-8, -17, '#facc15'], [6, -14, '#ef4444'], [20, -16, '#f97316'], [13, -12, '#facc15'], [-15, -11, '#fb7185']].map(([fx, fy, c], k) => (
          <g key={k}><circle cx={fx as number} cy={fy as number} r="4" fill={c as string} /><circle cx={fx as number} cy={fy as number} r="2.6" fill="none" stroke="#7c2d12" strokeOpacity=".4" strokeDasharray="1 1.2" /></g>
        ))}
        {lit && (
          <g className="sd-flame" style={{ animationDelay: '-.4s' }}>
            <path d="M-1 -18 C -5 -22, -3 -28, 0 -32 C 3 -28, 5 -22, 1 -18 Z" fill="#fbbf24" />
          </g>
        )}
      </g>
    </g>
  )
}

function Sparkler({ x, i }: { x: number; i: number }) {
  return (
    <g transform={`translate(${x} 90) rotate(-14)`} className="sd-pop-up" style={{ '--i': i } as Css}>
      <path d="M0 0 L0 -44" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
      <path d="M0 -30 L0 -44" stroke="#4b5563" strokeWidth="3" strokeLinecap="round" />
      <circle cx="0" cy="-46" r="8" fill="url(#sdDiyaGlow)" className="sd-breathe" />
      <g className="sd-sparks">
        {Array.from({ length: 12 }, (_, k) => {
          const a = (k / 12) * Math.PI * 2
          return <path key={k} d={`M0 -46 L${(Math.cos(a) * 14).toFixed(1)} ${(-46 + Math.sin(a) * 14).toFixed(1)}`} stroke={k % 2 ? '#fde68a' : '#fff'} strokeWidth="1.2" strokeLinecap="round" style={{ animationDelay: `${(k % 4) * -0.12}s` }} />
        })}
      </g>
    </g>
  )
}

function DiwaliGround({ level, mobile }: { level: Level; mobile: boolean }) {
  const lit = level >= 3
  const defs = (
    <defs>
      <radialGradient id="sdDiyaGlow"><stop offset="0" stopColor="#ffd27a" stopOpacity=".75" /><stop offset="1" stopColor="#ffb347" stopOpacity="0" /></radialGradient>
      <linearGradient id="sdBrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbbf24" /><stop offset="1" stopColor="#92400e" /></linearGradient>
    </defs>
  )
  let n = 0
  return (
    <div className="sd-ground" aria-hidden="true" data-no-snow>
      {!mobile && (
        <svg className="sd-pile sd-pile-left" viewBox="-30 -20 270 112" width="270" height="112">
          {defs}
          <HalfRangoli cx={90} r={level >= 2 ? 62 : 46} i={n++} />
          {level >= 2 && <><GroundDiya x={18} lit={lit} i={n++} /><GroundDiya x={58} s={0.9} lit={lit} i={n++} /><GroundDiya x={128} s={0.9} lit={lit} i={n++} /></>}
          {level >= 2 && <Urli x={190} lit={lit} i={n++} />}
          {level >= 4 && <Sparkler x={232} i={n++} />}
        </svg>
      )}
      <svg className="sd-pile sd-pile-right" viewBox="-30 -20 270 112" width="270" height="112">
        {defs}
        <HalfRangoli cx={140} r={level >= 2 ? 62 : 46} i={n++} />
        {level >= 4 && <Sparkler x={0} i={n++} />}
        {level >= 2 && <Urli x={50} lit={lit} i={n++} />}
        {level >= 2 && <><GroundDiya x={108} s={0.9} lit={lit} i={n++} /><GroundDiya x={176} s={0.9} lit={lit} i={n++} /><GroundDiya x={214} lit={lit} i={n++} /></>}
      </svg>
    </div>
  )
}

/* ───────────────────────── Christmas: gifts along the bottom ───────────────────────── */

type GiftSpec = { x: number; w: number; h: number; c: string; r: string; tilt?: number; min: Level }
const GIFT_COLORS: Record<string, [string, string]> = {
  red: ['#ef4444', '#991b1b'], gold: ['#facc15', '#a16207'], green: ['#22c55e', '#166534'],
  blue: ['#3b82f6', '#1e3a8a'], purple: ['#a855f7', '#6b21a8'], white: ['#f8fafc', '#94a3b8'],
}

function Gift({ x, w, h, c, r, tilt = 0, i }: GiftSpec & { i: number }) {
  const [top, bottom] = GIFT_COLORS[c]
  const id = `sdg-${c}`
  const lid = 8
  return (
    <g className="sd-gift" style={{ '--i': i } as Css} transform={`translate(${x} ${90 - h}) rotate(${tilt} ${w / 2} ${h})`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient>
      </defs>
      <rect x={2} y={lid - 1} width={w - 4} height={h - lid + 1} rx={3} fill={`url(#${id})`} />
      <rect x={0} y={0} width={w} height={lid} rx={2.5} fill={top} />
      <rect x={0} y={lid - 2} width={w} height={2} fill="#000" opacity=".15" />
      <rect x={w / 2 - 3.5} y={0} width={7} height={h} fill={r} />
      <path d={`M${w / 2} 0 C ${w / 2 - 16} -14, ${w / 2 - 20} 2, ${w / 2} 0 Z M${w / 2} 0 C ${w / 2 + 16} -14, ${w / 2 + 20} 2, ${w / 2} 0 Z`} fill={r} stroke="#000" strokeOpacity=".12" />
      <circle cx={w / 2} cy={0} r={3.2} fill={r} />
      <rect x={5} y={lid + 3} width={3} height={h - lid - 8} rx={1.5} fill="#fff" opacity=".18" />
    </g>
  )
}

function MiniTree({ x, i }: { x: number; i: number }) {
  return (
    <g className="sd-gift" style={{ '--i': i } as Css} transform={`translate(${x} 0)`}>
      <rect x={24} y={76} width={8} height={14} rx={2} fill="#6b3f1f" />
      <path d="M28 10 L50 46 L6 46 Z" fill="#166534" />
      <path d="M28 26 L54 64 L2 64 Z" fill="#15803d" />
      <path d="M28 44 L58 80 L-2 80 Z" fill="#166534" />
      {[[22, 40, '#ff4d6d'], [36, 54, '#ffd166'], [16, 70, '#4cc9f0'], [42, 72, '#f72585'], [28, 62, '#80ed99'], [33, 32, '#ffb703']].map(([cx, cy, col], k) => (
        <circle key={k} cx={cx as number} cy={cy as number} r={2.6} fill={col as string} className="sd-twinkle" style={{ animationDelay: `${k * -0.4}s` }} />
      ))}
      <path d="M28 2 l2.4 5 5.4.6-4 3.7 1.1 5.3L28 14l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" fill="#ffd166" className="sd-star" />
    </g>
  )
}

function CandyCane({ x, i }: { x: number; i: number }) {
  return (
    <g className="sd-gift" style={{ '--i': i } as Css} transform={`translate(${x} 30) rotate(10 10 60)`}>
      <path d="M8 60 L8 14 C8 2, 26 2, 26 14" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <path d="M8 60 L8 14 C8 2, 26 2, 26 14" fill="none" stroke="#dc2626" strokeWidth="7" strokeLinecap="round" strokeDasharray="5 6" />
    </g>
  )
}

const LEFT_PILE: GiftSpec[] = [
  { x: 58, w: 50, h: 40, c: 'red', r: '#fde68a', min: 2 },
  { x: 104, w: 34, h: 54, c: 'gold', r: '#b91c1c', min: 3 },
  { x: 134, w: 40, h: 28, c: 'green', r: '#fef3c7', tilt: -7, min: 2 },
  { x: 176, w: 30, h: 22, c: 'white', r: '#dc2626', tilt: 9, min: 4 },
]
const RIGHT_PILE: GiftSpec[] = [
  { x: 6, w: 34, h: 26, c: 'purple', r: '#fde68a', tilt: -10, min: 4 },
  { x: 38, w: 46, h: 46, c: 'blue', r: '#f8fafc', min: 2 },
  { x: 80, w: 36, h: 32, c: 'red', r: '#22c55e', tilt: 6, min: 3 },
  { x: 114, w: 30, h: 50, c: 'green', r: '#fde68a', min: 2 },
]

function ChristmasGround({ level, mobile }: { level: Level; mobile: boolean }) {
  let n = 0
  const pile = (gifts: GiftSpec[]) => gifts.filter(g => g.min <= level).map((g, k) => <Gift key={k} {...g} i={n++} />)
  return (
    <div className="sd-ground" aria-hidden="true" data-no-snow>
      {!mobile && (
        <svg className="sd-pile sd-pile-left" viewBox="-4 -14 216 106" width="216" height="106">
          {level >= 3 && <MiniTree x={0} i={n++} />}
          {pile(LEFT_PILE)}
        </svg>
      )}
      <svg className="sd-pile sd-pile-right" viewBox="-4 -14 214 106" width="214" height="106">
        {pile(RIGHT_PILE)}
        {level >= 4 && <CandyCane x={150} i={n++} />}
        {level >= 3 && <MiniTree x={170} i={n++} />}
      </svg>
    </div>
  )
}

/* ───────────────────────── Christmas: Santa's sleigh flies across ───────────────────────── */

function SantaFlight() {
  return (
    <div className="sd-santa-lane" aria-hidden="true" data-no-snow>
      <div className="sd-santa"><SantaSleigh className="sd-santa-svg" width={340} /></div>
    </div>
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

/* Christmas: gifts along the bottom (under the header, sidebar, menus and modals; the snowbank covers their feet) */
.sd-ground { position: fixed; left: 0; right: 0; bottom: 0; height: 106px; z-index: 45; pointer-events: none; }
.sd-pile { position: absolute; bottom: -6px; overflow: visible; filter: drop-shadow(0 6px 8px rgba(0,0,0,.35)); }
.sd-pile-left { left: max(84px, 5.5vw); }
.sd-pile-right { right: 168px; }
.sd-gift { animation: sdGiftIn .7s cubic-bezier(.2,1.6,.4,1) both; animation-delay: calc(.6s + var(--i) * 110ms); }
.sd-twinkle { animation: sdTwinkleDot 1.8s ease-in-out infinite; }
.sd-pop-up { animation: sdGiftIn .7s cubic-bezier(.2,1.6,.4,1) both; animation-delay: calc(.5s + var(--i) * 120ms); }
.sd-rangoli-in { animation: sdFadeIn 1.2s ease both; animation-delay: .3s; }
.sd-spin-slow { transform-box: fill-box; transform-origin: center; animation: sdSpin 60s linear infinite; }
.sd-flame { transform-box: fill-box; transform-origin: 50% 100%; animation: sdFlicker 1.3s ease-in-out infinite; filter: drop-shadow(0 0 6px #f59e0b); }
.sd-sparks path { animation: sdSpark .5s linear infinite; }
@keyframes sdFlicker { 0%, 100% { transform: scale(1, 1) skewX(0); } 25% { transform: scale(.92, 1.08) skewX(3deg); } 50% { transform: scale(1.05, .95) skewX(-2deg); } 75% { transform: scale(.96, 1.04) skewX(1deg); } }
@keyframes sdSpark { 0% { opacity: 1; stroke-dasharray: 2 20; stroke-dashoffset: 0; } 100% { opacity: 0; stroke-dasharray: 2 20; stroke-dashoffset: -14; } }
@keyframes sdFadeIn { from { opacity: 0; } to { opacity: 1; } }
.sd-star { filter: drop-shadow(0 0 4px #ffd166); }
@keyframes sdGiftIn { from { opacity: 0; translate: 0 30px; } to { opacity: 1; translate: 0 0; } }
@keyframes sdTwinkleDot { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }

/* Christmas: Santa's sleigh, every ~45 s across the top of the page */
.sd-santa-lane { position: fixed; left: 0; right: 0; top: 92px; height: 90px; z-index: 946; pointer-events: none; overflow: hidden; }
.sd-santa { position: absolute; left: 0; top: 4px; animation: sdSantaFly 46s linear 4s infinite; transform: translateX(-360px); }
@keyframes sdSantaFly { 0% { transform: translate(-360px, 26px); } 26% { transform: translate(calc(100vw + 20px), -10px); } 100% { transform: translate(calc(100vw + 20px), -10px); } }

@media (max-width: 767px) {
  .sd-ground { bottom: calc(64px + max(env(safe-area-inset-bottom, 0px), var(--android-nav-bottom, 0px))); height: 80px; }
  .sd-pile-right { right: 50%; transform: translateX(50%) scale(.72); transform-origin: 50% 100%; }
  .sd-santa-lane { top: 70px; }
  .sd-santa-svg { width: 240px; height: 49px; }
}

@media (prefers-reduced-motion: reduce) {
  .sd * { animation: none !important; }
  .sd-santa-lane { display: none; }
}
@media print { .sd { display: none; } }
`
