'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { QUIZ_LAB_URL, QUIZ_LAB_LOGO } from './QuizLabBanner'

/**
 * Quiz Lab launch surprise.
 *
 * First visit (per browser): a full-screen reveal. Three gift boxes drop in
 * and wiggle, the side boxes clear away, the Quiz Lab box pops its lid with
 * confetti and the logo jumps out with "NEW" stickers and a Try now button.
 *
 * After that: a small gift box in the bottom-right corner (above "Need Help?")
 * that wiggles now and then; tapping it pops open a small Quiz Lab card.
 */

const SEEN_KEY = 'quizlab-surprise-seen-v1'

type Phase = 'enter' | 'wiggle' | 'focus' | 'open' | 'reveal' | 'leaving'

function readSeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}
function writeSeen() {
  try { localStorage.setItem(SEEN_KEY, '1') } catch {}
}
function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

const CONFETTI_COLORS = ['#22c55e', '#86efac', '#facc15', '#f472b6', '#60a5fa', '#a78bfa', '#ffffff', '#fb923c']
// Fixed spread so server and client render the same markup.
const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  angle: Math.round((360 / 36) * i + ((i * 37) % 17) - 8),
  dist: 150 + ((i * 53) % 140),
  size: 7 + ((i * 7) % 7),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: (i % 6) * 18,
  round: i % 3 === 0,
}))
const MINI_CONFETTI = CONFETTI.filter((_, i) => i % 2 === 0).map(c => ({ ...c, dist: Math.round(c.dist * 0.45) }))

function GiftBox({ color, ribbon, className = '', style }: { color: string; ribbon: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={`qls-gift ${className}`} style={{ ['--gift' as any]: color, ['--ribbon' as any]: ribbon, ...style }}>
      <div className="qls-lid">
        <span className="qls-bow qls-bow-l" />
        <span className="qls-bow qls-bow-r" />
        <span className="qls-knot" />
      </div>
      <div className="qls-body" />
    </div>
  )
}

function Confetti({ pieces }: { pieces: typeof CONFETTI }) {
  return (
    <div className="qls-confetti" aria-hidden="true">
      {pieces.map((c, i) => (
        <span
          key={i}
          style={{
            ['--a' as any]: `${c.angle}deg`,
            ['--d' as any]: `${c.dist}px`,
            width: c.size,
            height: c.round ? c.size : Math.round(c.size * 0.5),
            borderRadius: c.round ? '50%' : '2px',
            background: c.color,
            animationDelay: `${c.delay}ms`,
          }}
        />
      ))}
    </div>
  )
}

export default function QuizLabSurprise() {
  const [mode, setMode] = useState<'none' | 'full' | 'corner'>('none')
  const [phase, setPhase] = useState<Phase>('enter')
  const [cornerOpen, setCornerOpen] = useState(false)
  const timers = useRef<number[]>([])

  const clearTimers = () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = [] }
  const after = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }

  const runOpen = useCallback(() => {
    clearTimers()
    setPhase('open')
    after(650, () => setPhase('reveal'))
  }, [])

  // Decide what to show on mount (client only).
  useEffect(() => {
    if (readSeen()) { setMode('corner'); return }
    setMode('full')
    if (prefersReducedMotion()) { setPhase('reveal'); return }
    setPhase('enter')
    after(900, () => setPhase('wiggle'))
    after(2300, () => setPhase('focus'))
    after(3000, () => runOpen())
    return clearTimers
  }, [runOpen])

  // Lock page scroll and allow Escape while the full-screen reveal is up.
  useEffect(() => {
    if (mode !== 'full') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFull() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function closeFull() {
    writeSeen()
    clearTimers()
    setPhase('leaving')
    after(prefersReducedMotion() ? 0 : 520, () => setMode('corner'))
  }

  function tryNow() {
    writeSeen()
  }

  if (mode === 'none') return null

  return (
    <>
      <style>{CSS}</style>

      {mode === 'full' && (
        <div className={`qls-overlay qls-${phase}`} role="dialog" aria-modal="true" aria-label="Quiz Lab is here">
          <div className="qls-backdrop" onClick={phase === 'reveal' ? closeFull : undefined} />
          <button type="button" className="qls-close" onClick={closeFull} aria-label="Close">×</button>

          <div className="qls-stage">
            <div className="qls-rays" aria-hidden="true" />

            <div className="qls-boxes">
              <GiftBox className="qls-side qls-side-l" color="#6366f1" ribbon="#fde68a" />
              <button
                type="button"
                className="qls-center-btn"
                onClick={phase === 'enter' || phase === 'wiggle' || phase === 'focus' ? runOpen : undefined}
                aria-label="Open the surprise"
              >
                <GiftBox className="qls-center" color="#16a34a" ribbon="#facc15" />
              </button>
              <GiftBox className="qls-side qls-side-r" color="#f59e0b" ribbon="#fef3c7" />
            </div>

            {(phase === 'open' || phase === 'reveal' || phase === 'leaving') && <Confetti pieces={CONFETTI} />}

            <div className="qls-reveal">
              <div className="qls-logo-wrap">
                <img className="qls-logo" src={QUIZ_LAB_LOGO} alt="Quiz Lab" width={168} height={168} />
                <span className="qls-sticker qls-s1">NEW</span>
                <span className="qls-sticker qls-s2">NEW!</span>
                <span className="qls-sticker qls-s3">NEW</span>
              </div>
              <h2 className="qls-title">Quiz Lab is here</h2>
              <p className="qls-sub">Practice quizzes to test what you&apos;ve learned.</p>
              <div className="qls-actions">
                <a className="qls-try" href={QUIZ_LAB_URL} onClick={tryNow}>Try now →</a>
                <button type="button" className="qls-later" onClick={closeFull}>Maybe later</button>
              </div>
            </div>

            {(phase === 'enter' || phase === 'wiggle' || phase === 'focus') && (
              <p className="qls-hint">Something new is inside… tap the box</p>
            )}
          </div>
        </div>
      )}

      {mode === 'corner' && (
        <div className={`qls-corner ${cornerOpen ? 'is-open' : ''}`}>
          {cornerOpen && (
            <div className="qls-card" role="dialog" aria-label="Quiz Lab">
              <Confetti pieces={MINI_CONFETTI} />
              <button type="button" className="qls-card-x" onClick={() => setCornerOpen(false)} aria-label="Close">×</button>
              <img className="qls-card-logo" src={QUIZ_LAB_LOGO} alt="" width={72} height={72} />
              <div className="qls-card-title">Quiz Lab <span className="qls-card-new">NEW</span></div>
              <div className="qls-card-sub">Practice quizzes to test yourself.</div>
              <a className="qls-try qls-try-sm" href={QUIZ_LAB_URL}>Try now →</a>
            </div>
          )}
          <button
            type="button"
            className="qls-corner-btn"
            onClick={() => setCornerOpen(o => !o)}
            aria-label={cornerOpen ? 'Close Quiz Lab' : 'Open Quiz Lab surprise'}
          >
            <GiftBox className={`qls-mini ${cornerOpen ? 'is-open' : ''}`} color="#16a34a" ribbon="#facc15" />
            {!cornerOpen && <span className="qls-corner-new">NEW</span>}
          </button>
        </div>
      )}
    </>
  )
}

const CSS = `
/* ───────── Gift box (drawn in CSS) ───────── */
.qls-gift { --s: 120px; position: relative; width: var(--s); height: var(--s); }
.qls-body {
  position: absolute; left: 0; right: 0; bottom: 0; height: 70%; border-radius: 12px;
  background:
    linear-gradient(90deg, transparent 42%, var(--ribbon) 42%, var(--ribbon) 58%, transparent 58%),
    linear-gradient(160deg, color-mix(in srgb, var(--gift) 82%, #fff), var(--gift) 45%, color-mix(in srgb, var(--gift) 70%, #000));
  box-shadow: inset 0 -10px 18px rgba(0,0,0,0.18), 0 14px 30px rgba(0,0,0,0.35);
}
.qls-lid {
  position: absolute; left: -7%; right: -7%; top: 12%; height: 22%; border-radius: 10px; z-index: 2;
  background:
    linear-gradient(90deg, transparent 43%, var(--ribbon) 43%, var(--ribbon) 57%, transparent 57%),
    linear-gradient(180deg, color-mix(in srgb, var(--gift) 75%, #fff), color-mix(in srgb, var(--gift) 85%, #000));
  box-shadow: 0 6px 12px rgba(0,0,0,0.25);
  transform-origin: 50% 100%;
}
.qls-bow { position: absolute; bottom: 88%; width: 30%; height: 70%; border: calc(var(--s) * 0.06) solid var(--ribbon); border-radius: 50% 50% 10% 50%; }
.qls-bow-l { right: 50%; transform: rotate(-20deg); transform-origin: 100% 100%; }
.qls-bow-r { left: 50%; transform: scaleX(-1) rotate(-20deg); transform-origin: 0% 100%; }
.qls-knot { position: absolute; left: 50%; bottom: 80%; width: 14%; height: 40%; transform: translateX(-50%); background: var(--ribbon); border-radius: 6px; }

/* ───────── Full-screen overlay ───────── */
.qls-overlay { position: fixed; inset: 0; z-index: 2147482000; display: flex; align-items: center; justify-content: center; }
.qls-backdrop {
  position: absolute; inset: 0;
  background: radial-gradient(60% 55% at 50% 50%, rgba(22,163,74,0.35), rgba(5,8,12,0.92) 70%);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  animation: qlsFade 400ms ease both;
}
.qls-close {
  position: absolute; top: 18px; right: 20px; z-index: 5; width: 42px; height: 42px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff;
  font-size: 26px; line-height: 1; cursor: pointer;
}
.qls-stage { position: relative; z-index: 2; width: min(92vw, 560px); min-height: 460px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.qls-boxes { position: relative; display: flex; align-items: flex-end; justify-content: center; gap: clamp(18px, 5vw, 40px); height: 200px; }
.qls-center-btn { background: none; border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.qls-center { --s: 150px; }
.qls-side { --s: 104px; }
.qls-hint { margin-top: 26px; color: rgba(236,253,245,0.8); font-size: 15px; font-weight: 600; animation: qlsFade 500ms 700ms ease both, qlsBreath 1.6s 1.2s ease-in-out infinite; }

/* enter: boxes drop in one after another */
.qls-enter .qls-gift { animation: qlsDrop 700ms cubic-bezier(.2,1.4,.4,1) both; }
.qls-enter .qls-side-l { animation-delay: 0ms; }
.qls-enter .qls-center { animation-delay: 120ms; }
.qls-enter .qls-side-r { animation-delay: 240ms; }

/* wiggle: all three shake, out of sync */
.qls-wiggle .qls-gift { animation: qlsWiggle 700ms ease-in-out 2; transform-origin: 50% 100%; }
.qls-wiggle .qls-side-l { animation-delay: 80ms; }
.qls-wiggle .qls-side-r { animation-delay: 200ms; }

/* focus: side boxes leave, the Quiz Lab box grows and shakes hard */
.qls-focus .qls-side, .qls-open .qls-side, .qls-reveal .qls-side, .qls-leaving .qls-side { animation: qlsAway 450ms ease forwards; }
.qls-focus .qls-side-r, .qls-open .qls-side-r, .qls-reveal .qls-side-r, .qls-leaving .qls-side-r { animation-name: qlsAwayR; }
.qls-focus .qls-center { animation: qlsBigShake 700ms ease-in-out both; transform-origin: 50% 100%; }

/* open: lid flies off, box pumps, rays + confetti */
.qls-open .qls-center, .qls-reveal .qls-center, .qls-leaving .qls-center { animation: qlsPump 420ms ease-out both; }
.qls-open .qls-center .qls-lid, .qls-reveal .qls-center .qls-lid, .qls-leaving .qls-center .qls-lid { animation: qlsLidOff 650ms cubic-bezier(.3,.7,.4,1) forwards; }
.qls-reveal .qls-center, .qls-leaving .qls-center { animation: qlsSink 600ms 200ms ease both; }
.qls-rays {
  position: absolute; left: 50%; top: 50%; width: 620px; height: 620px; margin: -310px 0 0 -310px; border-radius: 50%; pointer-events: none; opacity: 0;
  background: repeating-conic-gradient(rgba(134,239,172,0.22) 0deg 10deg, transparent 10deg 24deg);
  -webkit-mask: radial-gradient(circle, #000 18%, transparent 68%); mask: radial-gradient(circle, #000 18%, transparent 68%);
}
.qls-open .qls-rays, .qls-reveal .qls-rays, .qls-leaving .qls-rays { animation: qlsRaysIn 600ms ease forwards, qlsSpin 14s linear infinite; }

.qls-confetti { position: absolute; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; z-index: 3; }
.qls-confetti span { position: absolute; left: 0; top: 0; opacity: 0; animation: qlsBurst 1100ms cubic-bezier(.15,.7,.3,1) forwards; }

/* reveal: logo pops out of the box, stickers slap on, text and buttons rise */
.qls-overlay .qls-reveal { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; pointer-events: none; opacity: 0; }
.qls-overlay.qls-reveal .qls-reveal, .qls-overlay.qls-leaving .qls-reveal { opacity: 1; pointer-events: auto; }
.qls-logo-wrap { position: relative; }
.qls-logo { display: block; width: clamp(130px, 34vw, 168px); height: auto; border-radius: 36px; box-shadow: 0 0 0 1px rgba(255,255,255,0.15), 0 0 60px rgba(74,222,128,0.65), 0 24px 50px rgba(0,0,0,0.45); }
.qls-overlay.qls-reveal .qls-logo { animation: qlsPopOut 800ms cubic-bezier(.2,1.6,.4,1) both, qlsFloat 3.2s 900ms ease-in-out infinite; }
.qls-sticker { position: absolute; padding: 5px 11px; border-radius: 999px; font-size: 13px; font-weight: 900; letter-spacing: 0.06em; color: #0d5c33; background: #dcfce7; box-shadow: 0 6px 16px rgba(0,0,0,0.3); opacity: 0; }
.qls-s1 { top: -10px; right: -38px; background: #facc15; color: #422006; }
.qls-s2 { bottom: 14px; left: -48px; }
.qls-s3 { top: 46%; right: -58px; background: #f472b6; color: #500724; font-size: 11px; }
.qls-overlay.qls-reveal .qls-sticker { animation: qlsSlap 520ms cubic-bezier(.2,1.8,.4,1) both, qlsTilt 2.4s 1.4s ease-in-out infinite; }
.qls-overlay.qls-reveal .qls-s1 { animation-delay: 550ms, 1.4s; }
.qls-overlay.qls-reveal .qls-s2 { animation-delay: 700ms, 1.6s; }
.qls-overlay.qls-reveal .qls-s3 { animation-delay: 850ms, 1.8s; }
.qls-title { margin: 26px 0 6px; color: #fff; font-size: clamp(28px, 6vw, 38px); font-weight: 900; letter-spacing: -0.03em; }
.qls-sub { margin: 0; color: rgba(236,253,245,0.85); font-size: 16px; }
.qls-actions { margin-top: 22px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; }
.qls-overlay.qls-reveal .qls-title { animation: qlsRise 500ms 650ms ease both; }
.qls-overlay.qls-reveal .qls-sub { animation: qlsRise 500ms 760ms ease both; }
.qls-overlay.qls-reveal .qls-actions { animation: qlsRise 500ms 880ms ease both; }
.qls-try {
  position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 14px 30px; border-radius: 999px; text-decoration: none; font-size: 16px; font-weight: 900; color: #fff;
  background: linear-gradient(135deg, #22c55e, #15803d); box-shadow: 0 10px 30px rgba(34,197,94,0.45);
  animation: qlsPulse 2s 1.6s ease-in-out infinite;
}
.qls-try::after { content: ''; position: absolute; top: 0; left: -60%; width: 40%; height: 100%; background: linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent); transform: skewX(-20deg); animation: qlsShine 2.8s 1.8s ease-in-out infinite; }
.qls-try:hover { filter: brightness(1.08); }
.qls-later { padding: 13px 20px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.22); background: transparent; color: rgba(255,255,255,0.85); font-size: 15px; font-weight: 700; cursor: pointer; }

/* leaving: whole reveal shrinks off toward the corner box */
.qls-leaving .qls-stage { animation: qlsToCorner 520ms cubic-bezier(.5,0,.75,0) forwards; }
.qls-leaving .qls-backdrop { animation: qlsFadeOut 520ms ease forwards; }

/* ───────── Corner box ───────── */
.qls-corner { position: fixed; right: 28px; bottom: 96px; z-index: 1001; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
.qls-corner-btn { position: relative; width: 64px; height: 64px; border-radius: 20px; border: 1px solid rgba(74,222,128,0.4); cursor: pointer; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 8px; background: radial-gradient(circle at 50% 30%, #14532d, #052e16); box-shadow: 0 10px 26px rgba(0,0,0,0.35), 0 0 18px rgba(34,197,94,0.35); animation: qlsCornerIn 600ms cubic-bezier(.2,1.5,.4,1) both; -webkit-tap-highlight-color: transparent; }
.qls-mini { --s: 40px; animation: qlsIdleWiggle 5s 1.2s ease-in-out infinite; transform-origin: 50% 100%; }
.qls-mini .qls-body { border-radius: 6px; box-shadow: inset 0 -4px 6px rgba(0,0,0,0.18); }
.qls-mini .qls-lid { border-radius: 4px; }
.qls-mini.is-open { animation: none; }
.qls-mini.is-open .qls-lid { animation: qlsMiniLid 380ms ease forwards; }
.qls-corner-new { position: absolute; top: -8px; right: -10px; padding: 2px 7px; border-radius: 999px; background: #facc15; color: #422006; font-size: 10px; font-weight: 900; letter-spacing: 0.06em; box-shadow: 0 4px 10px rgba(0,0,0,0.3); animation: qlsBadge 1.8s ease-in-out infinite; }
.qls-card { position: relative; width: 240px; padding: 18px 18px 16px; border-radius: 22px; text-align: center; color: #fff; background: radial-gradient(120% 120% at 50% 0%, #166534, #052e16 75%); border: 1px solid rgba(74,222,128,0.35); box-shadow: 0 20px 44px rgba(0,0,0,0.45); animation: qlsCardPop 420ms cubic-bezier(.2,1.5,.4,1) both; transform-origin: 85% 100%; }
.qls-card .qls-confetti { top: 54px; }
.qls-card-x { position: absolute; top: 8px; right: 10px; width: 28px; height: 28px; border-radius: 50%; border: 0; background: rgba(255,255,255,0.12); color: #fff; font-size: 18px; line-height: 1; cursor: pointer; }
.qls-card-logo { display: block; margin: 0 auto; width: 72px; height: 72px; border-radius: 18px; box-shadow: 0 0 24px rgba(74,222,128,0.6); animation: qlsPopOut 600ms 120ms cubic-bezier(.2,1.6,.4,1) both; }
.qls-card-title { margin-top: 10px; font-size: 18px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 6px; }
.qls-card-new { font-size: 10px; font-weight: 900; padding: 2px 7px; border-radius: 999px; background: #facc15; color: #422006; animation: qlsSlap 420ms 300ms cubic-bezier(.2,1.8,.4,1) both; }
.qls-card-sub { margin: 4px 0 14px; font-size: 13px; color: rgba(236,253,245,0.82); }
.qls-try-sm { padding: 10px 22px; font-size: 14px; width: 100%; box-sizing: border-box; }

@media (max-width: 640px) {
  .qls-center { --s: 120px; } .qls-side { --s: 82px; }
  .qls-s3 { display: none; }
  .qls-corner { right: 18px; bottom: 90px; }
}

/* ───────── Keyframes ───────── */
@keyframes qlsFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes qlsFadeOut { to { opacity: 0; } }
@keyframes qlsBreath { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes qlsDrop { 0% { opacity: 0; transform: translateY(-120px) scale(0.7) rotate(-8deg); } 70% { opacity: 1; transform: translateY(8px) scale(1.04, 0.94); } 100% { transform: none; } }
@keyframes qlsWiggle { 0%,100% { transform: rotate(0); } 15% { transform: rotate(-9deg); } 30% { transform: rotate(8deg); } 45% { transform: rotate(-6deg); } 60% { transform: rotate(4deg); } 75% { transform: rotate(-2deg); } }
@keyframes qlsAway { to { opacity: 0; transform: translateX(-60px) scale(0.6) rotate(-14deg); } }
@keyframes qlsAwayR { to { opacity: 0; transform: translateX(60px) scale(0.6) rotate(14deg); } }
@keyframes qlsBigShake { 0% { transform: scale(1); } 20% { transform: scale(1.12) rotate(-10deg); } 40% { transform: scale(1.16) rotate(10deg); } 60% { transform: scale(1.18) rotate(-8deg); } 80% { transform: scale(1.2) rotate(6deg); } 100% { transform: scale(1.2) rotate(0); } }
@keyframes qlsPump { 0% { transform: scale(1.2); } 40% { transform: scale(1.32, 1.05); } 100% { transform: scale(1.2); } }
@keyframes qlsLidOff { 0% { transform: none; } 100% { transform: translate(70px, -230px) rotate(55deg); opacity: 0; } }
@keyframes qlsSink { from { transform: scale(1.2); } to { opacity: 0; transform: translateY(40px) scale(0.9); } }
@keyframes qlsRaysIn { to { opacity: 1; } }
@keyframes qlsSpin { to { transform: rotate(360deg); } }
@keyframes qlsBurst { 0% { opacity: 1; transform: rotate(var(--a)) translateY(0) rotate(0); } 70% { opacity: 1; } 100% { opacity: 0; transform: rotate(var(--a)) translateY(calc(-1 * var(--d))) rotate(540deg); } }
@keyframes qlsPopOut { 0% { opacity: 0; transform: translateY(70px) scale(0.2) rotate(-12deg); } 60% { opacity: 1; transform: translateY(-14px) scale(1.12) rotate(4deg); } 100% { transform: none; } }
@keyframes qlsFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes qlsSlap { 0% { opacity: 0; transform: scale(2.4) rotate(-20deg); } 100% { opacity: 1; transform: scale(1) rotate(-8deg); } }
@keyframes qlsTilt { 0%,100% { transform: rotate(-8deg) scale(1); } 50% { transform: rotate(6deg) scale(1.08); } }
@keyframes qlsRise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes qlsPulse { 0%,100% { box-shadow: 0 10px 30px rgba(34,197,94,0.45), 0 0 0 0 rgba(34,197,94,0.5); } 50% { box-shadow: 0 10px 30px rgba(34,197,94,0.45), 0 0 0 12px rgba(34,197,94,0); } }
@keyframes qlsShine { 0% { left: -60%; } 55%,100% { left: 130%; } }
@keyframes qlsToCorner { to { opacity: 0; transform: translate(38vw, 38vh) scale(0.1); } }
@keyframes qlsCornerIn { 0% { opacity: 0; transform: scale(0.3) rotate(-20deg); } 100% { opacity: 1; transform: none; } }
@keyframes qlsIdleWiggle { 0%, 82%, 100% { transform: rotate(0); } 85% { transform: rotate(-14deg); } 88% { transform: rotate(12deg); } 91% { transform: rotate(-9deg); } 94% { transform: rotate(6deg); } 97% { transform: rotate(-3deg); } }
@keyframes qlsMiniLid { to { transform: translate(8px, -14px) rotate(28deg); } }
@keyframes qlsBadge { 0%,100% { transform: scale(1) rotate(-6deg); } 50% { transform: scale(1.12) rotate(4deg); } }
@keyframes qlsCardPop { 0% { opacity: 0; transform: scale(0.4) translateY(20px); } 100% { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .qls-overlay *, .qls-corner *, .qls-corner-btn { animation: none !important; }
  .qls-overlay .qls-sticker, .qls-overlay .qls-reveal { opacity: 1 !important; }
  .qls-overlay .qls-boxes { display: none; }
}
`
