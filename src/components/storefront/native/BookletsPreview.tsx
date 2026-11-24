'use client'

import { useState, type CSSProperties } from 'react'
import { Check, Layers, RotateCcw } from 'lucide-react'
import { COVERS, discountPercent, type Booklet } from './BookletsData'
import s from './BookletsPreview.module.css'

/*
 * Native port of the storefront-panel booklet cover (BookletVisual in
 * storefront-panel/src/components/booklet/BookletCard.tsx). Same markup and
 * measurements, with Tailwind replaced by inline styles + a CSS module.
 */

const INK = '#0b1120'
const GRAY_400 = '#9ca3af'
const GRAY_500 = '#6b7280'
const SLATE_200 = '#e2e8f0'
const COIL_BG = 'linear-gradient(135deg,#ffffff 0%,#cbd5e1 55%,#94a3b8 100%)'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
const fill: CSSProperties = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }
const kicker = (size: number, spacing = '0.18em'): CSSProperties => ({
  fontSize: size, fontWeight: 900, textTransform: 'uppercase', letterSpacing: spacing,
})

function Coils({ side }: { side: boolean }) {
  const n = side ? 9 : 11
  const pos: CSSProperties = side
    ? { flexDirection: 'column', left: -11, top: '7%', bottom: '7%' }
    : { flexDirection: 'row', top: -11, left: '7%', right: '7%' }
  return (
    <div aria-hidden style={{ position: 'absolute', zIndex: 30, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none', ...pos }}>
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          style={{
            display: 'block', borderRadius: 9999, border: `2.5px solid ${INK}`, background: COIL_BG,
            width: side ? 24 : 9, height: side ? 9 : 24,
          }}
        />
      ))}
    </div>
  )
}

function Holes({ side }: { side: boolean }) {
  const n = side ? 9 : 11
  const pos: CSSProperties = side
    ? { flexDirection: 'column', left: 7, top: '7%', bottom: '7%' }
    : { flexDirection: 'row', top: 7, left: '7%', right: '7%' }
  return (
    <div aria-hidden style={{ position: 'absolute', display: 'flex', justifyContent: 'space-between', pointerEvents: 'none', ...pos }}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{ display: 'block', width: 7, height: 7, borderRadius: 9999, background: INK, opacity: 0.85 }} />
      ))}
    </div>
  )
}

/** The 3D notebook: cover with the name, inside page with the contents. Re-renders live from `booklet`. */
export function BookletVisual({ booklet, index = 0, peek = true }: { booklet: Booklet; index?: number; peek?: boolean }) {
  const [open, setOpen] = useState(false)
  const [peeked, setPeeked] = useState(false)
  const c = COVERS[booklet.cover] ?? COVERS.mint
  const side = booklet.binding !== 'spiral-top'
  const spiral = booklet.binding !== 'spine'
  const isBundle = booklet.kind === 'bundle'
  const contents = booklet.contents.map((x) => x.trim()).filter(Boolean) // ignore blank lines while typing
  const off = discountPercent(booklet)
  const sticker = booklet.price <= 0 ? 'FREE' : off > 0 ? `${off}% OFF` : ''
  const meta = [booklet.term, booklet.exam].filter(Boolean).join(' · ')
  const preview = contents.slice(0, 3)
  const more = contents.length - preview.length
  const sheet: CSSProperties = { ...fill, borderRadius: 18, border: `3px solid ${INK}` }

  return (
    <div
      className={cx(s.scene, side ? s.side : s.top, open && s.open, peek && !peeked && !open && s.peek)}
      style={{ ['--bk-delay' as string]: `${300 + index * 180}ms` } as CSSProperties}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
      onClick={() => setOpen((o) => !o)}
      role="button"
      tabIndex={0}
      aria-pressed={open}
      aria-label={`${booklet.title} — ${open ? 'close' : 'peek inside'}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}
    >
      <div className={s.body}>
        {/* Extra sheets behind a bundle */}
        {isBundle && (
          <>
            <div style={{ ...sheet, background: COVERS.sun.bg, transform: 'translate(14px, 12px) rotate(3.5deg)' }} />
            <div style={{ ...sheet, background: COVERS.mint.bg, transform: 'translate(7px, 6px) rotate(1.6deg)' }} />
          </>
        )}

        {/* Inside page: what this booklet contains */}
        <div className={s.dots} style={{ ...sheet, overflow: 'hidden', backgroundColor: c.paper, boxShadow: `6px 6px 0 ${INK}` }}>
          {spiral && <Holes side={side} />}
          <div
            style={{
              position: 'absolute', display: 'flex', flexDirection: 'column',
              ...(side
                ? { top: 0, bottom: 0, right: 0, left: '33%', justifyContent: 'center', padding: '0 16px' }
                : { left: 0, right: 0, bottom: 0, top: '36%', padding: '0 20px 20px' }),
            }}
          >
            <p className={s.line} style={{ ...kicker(10), marginBottom: 8, color: GRAY_500 }}>
              {isBundle ? `${contents.length} booklets inside` : 'Inside this booklet'}
            </p>
            <ol style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {contents.slice(0, 6).map((item, i) => (
                <li
                  key={i}
                  className={s.line}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, fontWeight: 700, lineHeight: 1.375, color: INK, transitionDelay: `${120 + i * 70}ms` }}
                >
                  <span
                    style={{
                      marginTop: 1, display: 'grid', placeItems: 'center', width: 18, height: 18, flexShrink: 0,
                      borderRadius: 9999, border: `2px solid ${INK}`, fontSize: 9, fontWeight: 900, lineHeight: 1,
                      background: c.bg, color: c.ink,
                    }}
                  >
                    {isBundle ? <Check size={10} strokeWidth={4} /> : i + 1}
                  </span>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{item}</span>
                </li>
              ))}
              {contents.length > 6 && <li className={s.line} style={{ fontSize: 11, fontWeight: 700, color: GRAY_500 }}>+{contents.length - 6} more</li>}
              {contents.length === 0 && <li className={s.line} style={{ fontSize: 12, fontWeight: 600, color: GRAY_400 }}>Contents coming soon</li>}
            </ol>
          </div>
        </div>

        {/* Front cover */}
        <div
          onAnimationEnd={() => setPeeked(true)}
          className={s.cover}
          style={{ ...sheet, zIndex: 20, overflow: 'hidden', background: c.bg, color: c.ink }}
        >
          {/* corner stripes */}
          <div
            aria-hidden
            style={{
              position: 'absolute', bottom: -40, right: -40, width: 160, height: 160, transform: 'rotate(12deg)', opacity: 0.25,
              background: `repeating-linear-gradient(45deg, ${c.deep} 0 8px, transparent 8px 18px)`,
            }}
          />
          {booklet.binding === 'spine' && (
            <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '11%', borderRight: `3px solid ${INK}`, background: c.deep }}>
              <div style={{ position: 'absolute', top: 12, bottom: 12, left: '50%', borderLeft: '2px dashed rgba(255,255,255,0.7)' }} />
            </div>
          )}
          {spiral && <Holes side={side} />}

          <div
            style={{
              position: 'relative', display: 'flex', flexDirection: 'column', height: '100%',
              padding: side ? '16px 16px 16px 13%' : '28px 16px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span className={s.truncate} style={{ ...kicker(10), opacity: 0.8 }}>
                {isBundle ? `Bundle · ${contents.length} booklets` : meta || booklet.level}
              </span>
            </div>

            {/* Name label, like a school notebook label */}
            <div style={{ marginTop: 12, borderRadius: 12, border: `3px solid ${INK}`, background: '#ffffff', padding: 12, boxShadow: `3px 3px 0 ${INK}`, color: INK }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <p className={s.truncate} style={{ ...kicker(9, '0.2em'), color: GRAY_400 }}>{isBundle ? 'Booklet bundle' : booklet.subject || 'Booklet'}</p>
                {booklet.badge && (
                  <span style={{ ...kicker(9, '0.05em'), flexShrink: 0, borderRadius: 9999, padding: '2px 8px', background: c.bg, color: c.ink }}>
                    {booklet.badge}
                  </span>
                )}
              </div>
              <h4 style={{ marginTop: 2, fontSize: 19, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.025em', color: INK, overflowWrap: 'anywhere' }}>
                {booklet.title || 'Untitled'}
              </h4>
              <div aria-hidden style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ height: 2, width: '100%', borderRadius: 4, background: SLATE_200 }} />
                <div style={{ height: 2, width: '66.666%', borderRadius: 4, background: SLATE_200 }} />
              </div>
            </div>

            {/* Big exam mark in the middle */}
            {(booklet.exam || booklet.subject) && (
              <p
                aria-hidden
                className={s.truncate}
                style={{
                  marginTop: 16, pointerEvents: 'none', fontSize: 44, fontWeight: 900, textTransform: 'uppercase', lineHeight: 1,
                  letterSpacing: '-0.05em', color: 'transparent', WebkitTextStroke: `2px ${c.ink}`, opacity: 0.35,
                }}
              >
                {isBundle ? `×${contents.length}` : booklet.exam || booklet.subject}
              </p>
            )}

            {/* What it contains, on the front */}
            <div style={{ marginTop: 'auto', paddingTop: 12 }}>
              <p style={{ ...kicker(9), marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, opacity: 0.75 }}>
                {isBundle ? <Layers size={12} /> : null} Contains
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {preview.map((p, i) => (
                  <span
                    key={i}
                    className={s.truncate}
                    style={{ maxWidth: '100%', borderRadius: 6, border: `2px solid ${INK}`, background: 'rgba(255,255,255,0.85)', padding: '2px 6px', fontSize: 10.5, fontWeight: 700, color: INK }}
                  >
                    {p}
                  </span>
                ))}
                {more > 0 && (
                  <span style={{ borderRadius: 6, border: `2px dashed ${c.ink}`, padding: '2px 6px', fontSize: 10.5, fontWeight: 900 }}>+{more}</span>
                )}
              </div>
              <p style={{ ...kicker(9), marginTop: 10, opacity: 0.6 }}>Tap to peek inside</p>
            </div>
          </div>
        </div>

        {spiral && <Coils side={side} />}

        {/* Round price stamp */}
        {sticker && (
          <div
            className={s.sticker}
            style={{
              position: 'absolute', right: -12, top: -16, zIndex: 40, display: 'grid', placeItems: 'center',
              width: 62, height: 62, borderRadius: 9999, border: `3px solid ${INK}`, textAlign: 'center',
              fontSize: 12, fontWeight: 900, lineHeight: 1,
              background: booklet.price <= 0 ? '#bef264' : '#fde047', color: INK, boxShadow: `3px 3px 0 ${INK}`,
            }}
          >
            {sticker}
          </div>
        )}
      </div>
    </div>
  )
}

/** "Live preview" card shown beside the editor, matching the original Booklets tab. */
export default function BookletsPreview({ booklet }: { booklet: Booklet }) {
  const [replay, setReplay] = useState(0)
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)' }}>Live preview</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setReplay((k) => k + 1)} title="Replay the opening animation">
          <RotateCcw size={13} /> Replay animation
        </button>
      </div>
      <div style={{ padding: '0 12px 8px' }}>
        <BookletVisual key={`${booklet.id}-${replay}`} booklet={booklet} />
      </div>
      <p style={{ marginTop: 20, marginBottom: 0, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>Hover or click the booklet to open it.</p>
    </div>
  )
}
