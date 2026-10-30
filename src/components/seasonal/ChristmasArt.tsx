'use client'

import type { CSSProperties } from 'react'

/**
 * Christmas drawings shared by the site decorations and the Christmas greeting:
 * Santa's sleigh with reindeer, a snowman, pine trees, a decorated tree, a cabin,
 * candy canes. Pure SVG + CSS (CHRISTMAS_ART_CSS must be on the page once).
 */

type Css = CSSProperties & Record<`--${string}`, string | number>

function Reindeer({ x, lead = false, k }: { x: number; lead?: boolean; k: number }) {
  // outer <g> places the reindeer; inner <g> bobs (CSS transform would override the placement)
  return (
    <g transform={`translate(${x} 30)`}>
      <g className="xa-deer" style={{ '--k': k } as Css}>
        <g className="xa-legs-b"><path d="M-10 6 L-14 18 M-6 6 L-4 18" stroke="#5b3a1e" strokeWidth="2.6" strokeLinecap="round" /></g>
        <ellipse cx="0" cy="2" rx="15" ry="7.5" fill="#8b5a2b" />
        <ellipse cx="2" cy="5" rx="9" ry="3.6" fill="#c08a52" opacity=".7" />
        <path d="M-14 0 l-5 -4" stroke="#8b5a2b" strokeWidth="3" strokeLinecap="round" />
        <g className="xa-legs-f"><path d="M8 6 L12 18 M12 5 L17 15" stroke="#5b3a1e" strokeWidth="2.6" strokeLinecap="round" /></g>
        <path d="M10 -2 C 14 -8, 16 -12, 20 -14" stroke="#8b5a2b" strokeWidth="6" strokeLinecap="round" fill="none" />
        <ellipse cx="24" cy="-14" rx="6.5" ry="4.5" fill="#8b5a2b" />
        <circle cx="22.5" cy="-15.5" r="1" fill="#1f130a" />
        <path d="M19 -18 L15 -27 M16 -24 L11 -26 M22 -18 L23 -28 M23 -24 L28 -27" stroke="#d6b48a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M-8 -4 L-8 8" stroke="#b91c1c" strokeWidth="2.4" />
        <circle cx="-8" cy="8" r="1.8" fill="#fde047" />
        {lead ? (
          <>
            <circle cx="31" cy="-13" r="7" fill="#ff3b3b" opacity=".35" className="xa-rudolph" />
            <circle cx="31" cy="-13" r="2.8" fill="#ff2d2d" />
          </>
        ) : (
          <circle cx="30.5" cy="-13" r="1.8" fill="#2b1a0e" />
        )}
      </g>
    </g>
  )
}

/** Santa in his sleigh, sack full of gifts, four reindeer (Rudolph leading). Flies to the right. */
export function SantaSleigh({ className = '', width = 330 }: { className?: string; width?: number }) {
  return (
    <svg viewBox="-90 -6 420 86" width={width} height={(width * 86) / 420} className={`xa-santa ${className}`} aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map(k => (
        <circle key={k} cx={-6 - k * 12} cy={54 + (k % 2) * 6} r={2.4 - k * 0.25} fill="#fff3c4" className="xa-trail" style={{ animationDelay: `${k * 0.11}s` }} />
      ))}
      <path d="M70 40 C 110 34, 150 36, 192 34 C 230 32, 260 34, 292 33" stroke="#fbbf24" strokeWidth="1.2" fill="none" opacity=".85" />
      <g>
        <path d="M6 64 C 18 70, 70 70, 96 62 C 104 59, 104 52, 98 52" stroke="#fbbf24" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M14 34 C 12 50, 20 60, 34 60 L 86 60 C 94 60, 96 52, 92 44 L 80 44 C 70 44, 66 36, 58 36 L 22 30 Z" fill="#dc2626" />
        <path d="M18 40 L 86 52" stroke="#fde68a" strokeWidth="2" opacity=".8" />
        {/* sack full of gifts */}
        <ellipse cx="26" cy="27" rx="17" ry="14" fill="#7c4a24" />
        <path d="M14 20 Q 26 10 38 20" stroke="#5b3418" strokeWidth="2" fill="none" />
        <rect x="12" y="8" width="11" height="10" rx="1.5" fill="#22c55e" /><rect x="16.5" y="8" width="2" height="10" fill="#fde68a" />
        <rect x="24" y="4" width="10" height="13" rx="1.5" fill="#3b82f6" /><rect x="28" y="4" width="2" height="13" fill="#f8fafc" />
        <rect x="33" y="10" width="9" height="8" rx="1.5" fill="#facc15" /><rect x="36.5" y="10" width="2" height="8" fill="#dc2626" />
        <path d="M26 4 c-4 -5 -8 -1 0 0 c 4 -5 8 -1 0 0" stroke="#f8fafc" strokeWidth="1.4" fill="none" />
        {/* Santa */}
        <ellipse cx="58" cy="34" rx="12" ry="11" fill="#e11d48" />
        <rect x="47" y="38" width="22" height="3.5" rx="1.5" fill="#1f2937" />
        <rect x="56" y="38" width="5" height="3.5" fill="#facc15" />
        <circle cx="61" cy="18" r="7" fill="#f8c9a8" />
        <path d="M54 20 C 54 31, 68 31, 68 20 C 66 24, 56 24, 54 20 Z" fill="#fff" />
        <path d="M54 15 C 55 6, 66 4, 72 10 L 75 14 L 66 13 Z" fill="#e11d48" />
        <rect x="53" y="12.5" width="15" height="4" rx="2" fill="#fff" />
        <circle cx="76" cy="15" r="2.6" fill="#fff" />
        <g className="xa-wave"><path d="M66 30 L 74 22" stroke="#e11d48" strokeWidth="5" strokeLinecap="round" /><circle cx="75" cy="21" r="2.6" fill="#f8fafc" /></g>
      </g>
      <Reindeer x={126} k={0} />
      <Reindeer x={176} k={1} />
      <Reindeer x={226} k={2} />
      <Reindeer x={276} k={3} lead />
    </svg>
  )
}

export function Snowman({ className = '', size = 120 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 120 150" width={size} height={(size * 150) / 120} className={`xa-snowman ${className}`} aria-hidden="true">
      <defs>
        <radialGradient id="xaSnow" cx="40%" cy="35%"><stop offset="0" stopColor="#ffffff" /><stop offset=".7" stopColor="#eef4fb" /><stop offset="1" stopColor="#c3d3e8" /></radialGradient>
      </defs>
      <ellipse cx="60" cy="146" rx="46" ry="6" fill="#000" opacity=".18" />
      {/* stick arms (right one waves) */}
      <path d="M30 86 L 6 70 M14 75 L 8 66" stroke="#6b3f1f" strokeWidth="3" strokeLinecap="round" fill="none" />
      <g className="xa-arm"><path d="M90 86 L 114 66 M106 72 L 113 62" stroke="#6b3f1f" strokeWidth="3" strokeLinecap="round" fill="none" /></g>
      <circle cx="60" cy="118" r="30" fill="url(#xaSnow)" />
      <circle cx="60" cy="80" r="23" fill="url(#xaSnow)" />
      <circle cx="60" cy="48" r="17" fill="url(#xaSnow)" />
      {/* scarf */}
      <path d="M43 60 Q 60 70 77 60 L 77 66 Q 60 76 43 66 Z" fill="#dc2626" />
      <path d="M68 64 L 74 86 L 66 86 L 62 66 Z" fill="#b91c1c" />
      <path d="M66 82 L 74 82 M 67 78 L 73 78" stroke="#fde68a" strokeWidth="1.4" />
      {/* face */}
      <circle cx="54" cy="44" r="2.2" fill="#1f2937" />
      <circle cx="66" cy="44" r="2.2" fill="#1f2937" />
      <path d="M60 49 L 76 52 L 60 53 Z" fill="#f97316" />
      {[0, 1, 2, 3, 4].map(k => <circle key={k} cx={51 + k * 4.5} cy={56 + Math.sin((k / 4) * Math.PI) * 2.4} r="1.2" fill="#1f2937" />)}
      {/* buttons */}
      <circle cx="60" cy="76" r="2.4" fill="#1f2937" /><circle cx="60" cy="86" r="2.4" fill="#1f2937" /><circle cx="60" cy="110" r="2.6" fill="#1f2937" />
      {/* hat */}
      <rect x="42" y="30" width="36" height="5" rx="2" fill="#111827" />
      <rect x="47" y="10" width="26" height="22" rx="3" fill="#111827" />
      <rect x="47" y="25" width="26" height="5" fill="#dc2626" />
      <path d="M70 24 l4 -4 l3 4 l-3 3 z" fill="#22c55e" /><circle cx="73" cy="23" r="1.6" fill="#ef4444" />
    </svg>
  )
}

/** Simple pine silhouette (for distant forests). */
export function Pine({ x, h, color, snow = true }: { x: number; h: number; color: string; snow?: boolean }) {
  const w = h * 0.55
  return (
    <g transform={`translate(${x} ${-h})`}>
      <path d={`M${w / 2} 0 L${w * 0.82} ${h * 0.34} L${w * 0.66} ${h * 0.34} L${w} ${h * 0.68} L${w * 0.62} ${h * 0.68} L${w * 0.62} ${h} L${w * 0.38} ${h} L${w * 0.38} ${h * 0.68} L0 ${h * 0.68} L${w * 0.34} ${h * 0.34} L${w * 0.18} ${h * 0.34} Z`} fill={color} />
      {snow && <path d={`M${w / 2} 0 L${w * 0.64} ${h * 0.14} L${w * 0.36} ${h * 0.14} Z M${w * 0.24} ${h * 0.32} L${w * 0.76} ${h * 0.32} L${w * 0.7} ${h * 0.37} L${w * 0.3} ${h * 0.37} Z M${w * 0.06} ${h * 0.66} L${w * 0.94} ${h * 0.66} L${w * 0.86} ${h * 0.71} L${w * 0.14} ${h * 0.71} Z`} fill="#eef4fb" opacity=".85" />}
    </g>
  )
}

/** A row of snowy pines along a hill (width 1000 units, scaled by CSS). */
export function Forest({ seed = 1, color = '#16324a', className = '' }: { seed?: number; color?: string; className?: string }) {
  const trees = Array.from({ length: 22 }, (_, i) => {
    const r = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
    const f = r - Math.floor(r)
    return { x: i * 46 + f * 20 - 10, h: 40 + f * 46 }
  })
  return (
    <svg viewBox="0 -90 1000 92" preserveAspectRatio="none" className={`xa-forest ${className}`} aria-hidden="true">
      {trees.map((t, i) => <Pine key={i} x={t.x} h={t.h} color={color} />)}
    </svg>
  )
}

/** Small decorated tree with twinkling lights. */
export function DecoTree({ className = '', size = 90 }: { className?: string; size?: number }) {
  const lights = [[22, 40, '#ff4d6d'], [36, 54, '#ffd166'], [16, 70, '#4cc9f0'], [42, 72, '#f72585'], [28, 62, '#80ed99'], [33, 32, '#ffb703'], [20, 56, '#ffd166'], [30, 46, '#4cc9f0']] as const
  return (
    <svg viewBox="-4 -2 64 96" width={size} height={(size * 96) / 64} className={`xa-decotree ${className}`} aria-hidden="true">
      <rect x="24" y="78" width="8" height="14" rx="2" fill="#6b3f1f" />
      <path d="M28 10 L50 46 L6 46 Z" fill="#166534" />
      <path d="M28 26 L54 64 L2 64 Z" fill="#15803d" />
      <path d="M28 44 L58 82 L-2 82 Z" fill="#166534" />
      <path d="M8 44 Q 28 52 48 44 M4 62 Q 28 72 52 62 M0 80 Q 28 90 56 80" stroke="#f1f5fb" strokeWidth="2.4" fill="none" opacity=".85" strokeLinecap="round" />
      {lights.map(([cx, cy, col], k) => <circle key={k} cx={cx} cy={cy} r="2.6" fill={col} className="xa-twinkle" style={{ animationDelay: `${k * -0.37}s` }} />)}
      <path d="M28 1 l2.4 5 5.4.6-4 3.7 1.1 5.3L28 13l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" fill="#ffd166" style={{ filter: 'drop-shadow(0 0 4px #ffd166)' }} />
    </svg>
  )
}

export function Cabin({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 110" width="140" height="110" className={`xa-cabin ${className}`} aria-hidden="true">
      <g className="xa-smoke">{[0, 1, 2].map(k => <circle key={k} cx={98} cy={18} r={6 + k * 2} fill="#cbd5e1" opacity=".5" style={{ animationDelay: `${k * 1.1}s` }} />)}</g>
      <rect x="92" y="22" width="12" height="26" fill="#5b3418" />
      <path d="M8 58 L70 18 L132 58 Z" fill="#7c2d12" />
      <path d="M2 60 L70 14 L138 60 L132 62 L70 22 L8 62 Z" fill="#f8fafc" />
      <rect x="18" y="58" width="104" height="48" fill="#8b5a2b" />
      {[64, 74, 84, 94].map(y => <path key={y} d={`M18 ${y} H122`} stroke="#6b3f1f" strokeWidth="1.2" />)}
      <rect x="30" y="68" width="22" height="18" rx="2" fill="#ffd27a" className="xa-window" />
      <path d="M41 68 V86 M30 77 H52" stroke="#8b5a2b" strokeWidth="2" />
      <rect x="86" y="72" width="22" height="34" rx="2" fill="#5b3418" />
      <circle cx="104" cy="90" r="1.6" fill="#fde68a" />
      <path d="M18 106 Q 70 98 122 106" stroke="#f8fafc" strokeWidth="5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function CandyCane({ className = '', size = 34 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 34 70" width={size} height={(size * 70) / 34} className={`xa-cane ${className}`} aria-hidden="true">
      <path d="M8 66 L8 16 C8 2, 28 2, 28 16" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <path d="M8 66 L8 16 C8 2, 28 2, 28 16" fill="none" stroke="#dc2626" strokeWidth="7" strokeLinecap="round" strokeDasharray="5 6" />
    </svg>
  )
}

export const CHRISTMAS_ART_CSS = `
.xa-santa { overflow: visible; filter: drop-shadow(0 4px 6px rgba(0,0,0,.4)); animation: xaBob 1.6s ease-in-out infinite; }
.xa-deer { animation: xaDeerBob .5s ease-in-out infinite alternate; animation-delay: calc(var(--k) * -.12s); }
.xa-legs-f, .xa-legs-b { transform-box: fill-box; transform-origin: 50% 0; animation: xaGallop .5s ease-in-out infinite alternate; }
.xa-legs-b { animation-direction: alternate-reverse; }
.xa-rudolph { animation: xaPulse 1.2s ease-in-out infinite; }
.xa-trail { animation: xaTwinkle .9s ease-in-out infinite; }
.xa-wave, .xa-arm { transform-box: fill-box; transform-origin: 0% 100%; animation: xaWave 1.4s ease-in-out infinite; }
.xa-arm { transform-origin: 0% 100%; }
.xa-twinkle { animation: xaTwinkle 1.8s ease-in-out infinite; }
.xa-window { animation: xaFlicker 3s ease-in-out infinite; }
.xa-smoke circle { animation: xaSmoke 3.3s ease-out infinite; transform-box: fill-box; transform-origin: center; }
.xa-forest { display: block; width: 100%; overflow: visible; }
@keyframes xaBob { 0%, 100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-5px) rotate(1deg); } }
@keyframes xaDeerBob { from { transform: translateY(-2px); } to { transform: translateY(2px); } }
@keyframes xaGallop { from { transform: rotate(-22deg); } to { transform: rotate(18deg); } }
@keyframes xaPulse { 0%, 100% { opacity: .25; } 50% { opacity: .7; } }
@keyframes xaTwinkle { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@keyframes xaWave { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-16deg); } }
@keyframes xaFlicker { 0%, 100% { opacity: 1; } 45% { opacity: .82; } 55% { opacity: .95; } }
@keyframes xaSmoke { 0% { opacity: 0; transform: translate(0, 0) scale(.5); } 20% { opacity: .55; } 100% { opacity: 0; transform: translate(14px, -26px) scale(1.6); } }
@media (prefers-reduced-motion: reduce) { .xa-santa, .xa-santa *, .xa-snowman *, .xa-decotree *, .xa-cabin * { animation: none !important; } }
`
