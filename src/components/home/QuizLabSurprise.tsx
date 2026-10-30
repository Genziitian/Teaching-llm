'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { QUIZ_LAB_URL, QUIZ_LAB_LOGO } from './QuizLabBanner'

/**
 * Quiz Lab launch surprise.
 *
 * First visit (per browser): a full-screen reveal. An animated background with
 * floating quiz pieces fills the screen, three gift boxes drop in and wiggle,
 * the Quiz Lab box pops with a flash, shockwave and confetti, and the logo
 * jumps out with "NEW" stickers, a sample question, a score card and a Try now
 * button.
 *
 * After that: a small gift box in the bottom-right corner (above "Need Help?")
 * that wiggles now and then; tapping it pops open a small Quiz Lab card.
 */

// v2: everyone sees the new full-screen version once, even if they saw v1.
const SEEN_KEY = 'quizlab-surprise-seen-v2'

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

const COLORS = ['#22c55e', '#86efac', '#facc15', '#f472b6', '#60a5fa', '#a78bfa', '#5eead4', '#fb923c']

/* ───────── Sounds (synthesised with Web Audio, no files) ─────────
 * Browsers only allow sound after the person has interacted with the page.
 * Sounds that would play before that are skipped (never queued), and the
 * first tap anywhere on the surprise unlocks sound for the rest of it.
 */
const MUTE_KEY = 'quizlab-sound-muted'
type SfxName = 'thud' | 'rattle' | 'rise' | 'pop' | 'tada' | 'slap' | 'ding' | 'whoosh' | 'mini'

function createSfx() {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noiseBuf: AudioBuffer | null = null
  let muted = false
  try { muted = localStorage.getItem(MUTE_KEY) === '1' } catch {}

  const ensure = () => {
    if (ctx) return ctx
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return null
    ctx = new AC() as AudioContext
    master = ctx.createGain()
    master.gain.value = 0.35
    master.connect(ctx.destination)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return ctx
  }

  const tone = (c: AudioContext, o: { f: number; f2?: number; t?: number; dur: number; type?: OscillatorType; vol?: number }) => {
    const st = c.currentTime + (o.t || 0)
    const osc = c.createOscillator(); const g = c.createGain()
    osc.type = o.type || 'sine'
    osc.frequency.setValueAtTime(o.f, st)
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, st + o.dur)
    g.gain.setValueAtTime(0.0001, st)
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.4, st + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, st + o.dur)
    osc.connect(g); g.connect(master!)
    osc.start(st); osc.stop(st + o.dur + 0.05)
  }
  const noise = (c: AudioContext, o: { t?: number; dur: number; f: number; f2?: number; q?: number; vol?: number }) => {
    const st = c.currentTime + (o.t || 0)
    const src = c.createBufferSource(); src.buffer = noiseBuf
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = o.q ?? 1
    bp.frequency.setValueAtTime(o.f, st)
    if (o.f2) bp.frequency.exponentialRampToValueAtTime(o.f2, st + o.dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, st)
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.4, st + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, st + o.dur)
    src.connect(bp); bp.connect(g); g.connect(master!)
    src.start(st); src.stop(st + o.dur + 0.05)
  }
  const chord = (c: AudioContext, notes: number[], t0: number, step: number, dur: number, vol: number) =>
    notes.forEach((f, i) => tone(c, { f, t: t0 + i * step, dur, type: 'triangle', vol }))

  const SOUNDS: Record<SfxName, (c: AudioContext) => void> = {
    thud: c => { tone(c, { f: 150, f2: 55, dur: 0.28, vol: 0.9 }); noise(c, { dur: 0.06, f: 1800, vol: 0.2 }) },
    rattle: c => { for (let i = 0; i < 6; i++) { noise(c, { t: i * 0.075, dur: 0.05, f: 2400 + i * 180, q: 4, vol: 0.35 }); tone(c, { t: i * 0.075, f: 320 + (i % 2) * 90, dur: 0.06, type: 'square', vol: 0.04 }) } },
    rise: c => { tone(c, { f: 220, f2: 880, dur: 0.75, type: 'sawtooth', vol: 0.06 }); tone(c, { f: 330, f2: 1320, dur: 0.75, type: 'triangle', vol: 0.08 }); noise(c, { dur: 0.75, f: 600, f2: 4000, q: 2, vol: 0.12 }) },
    pop: c => {
      noise(c, { dur: 0.3, f: 900, q: 0.7, vol: 0.9 }); tone(c, { f: 520, f2: 80, dur: 0.32, vol: 0.8 })
      for (let i = 0; i < 9; i++) tone(c, { t: 0.08 + i * 0.045, f: 1800 + ((i * 373) % 1700), dur: 0.14, vol: 0.1 })
    },
    tada: c => { chord(c, [523.25, 659.25, 783.99, 1046.5], 0, 0.09, 0.55, 0.28); chord(c, [523.25, 659.25, 783.99, 1046.5], 0.42, 0, 1.3, 0.13) },
    slap: c => { tone(c, { f: 280, f2: 120, dur: 0.11, type: 'square', vol: 0.08 }); noise(c, { dur: 0.06, f: 1300, vol: 0.3 }) },
    ding: c => { tone(c, { f: 1318.5, dur: 0.5, vol: 0.22 }); tone(c, { t: 0.07, f: 1975.5, dur: 0.6, vol: 0.14 }) },
    whoosh: c => { noise(c, { dur: 0.45, f: 3200, f2: 300, q: 1.5, vol: 0.5 }) },
    mini: c => { tone(c, { f: 700, f2: 200, dur: 0.16, vol: 0.45 }); noise(c, { dur: 0.12, f: 1200, vol: 0.4 }); chord(c, [783.99, 1046.5, 1318.5], 0.1, 0.08, 0.45, 0.2) },
  }

  return {
    get muted() { return muted },
    setMuted(m: boolean) { muted = m; try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch {} },
    unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}) },
    play(name: SfxName) {
      if (muted) return
      const c = ensure()
      if (!c || c.state !== 'running') return
      try { SOUNDS[name](c) } catch {}
    },
  }
}

// Fixed, pseudo-random spreads so server and client render the same markup.
const CONFETTI = Array.from({ length: 44 }, (_, i) => ({
  angle: Math.round((360 / 44) * i + ((i * 37) % 17) - 8),
  dist: 170 + ((i * 53) % 190),
  size: 7 + ((i * 7) % 8),
  color: COLORS[i % COLORS.length],
  delay: (i % 6) * 18,
  round: i % 3 === 0,
}))
const MINI_CONFETTI = CONFETTI.filter((_, i) => i % 2 === 0).map(c => ({ ...c, dist: Math.round(c.dist * 0.4) }))
const RAIN = Array.from({ length: 46 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: (i * 211) % 4200,
  dur: 4.2 + ((i * 13) % 30) / 10,
  size: 6 + ((i * 5) % 7),
  color: COLORS[(i * 3) % COLORS.length],
  round: i % 4 === 0,
}))
const SPARKS = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 29 + 5) % 100,
  delay: (i * 397) % 9000,
  dur: 7 + ((i * 11) % 60) / 10,
  size: 2 + (i % 3),
}))
const TWINKLES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 41 + 7) % 100,
  top: (i * 67 + 13) % 100,
  delay: (i * 173) % 3000,
}))

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
)
const ICONS: Record<string, ReactNode> = {
  bulb: icon(<><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></>),
  trophy: icon(<><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h3a3 3 0 0 1-3 4" /><path d="M7 5H4a3 3 0 0 0 3 4" /></>),
  timer: icon(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5" /><path d="M9 2h6" /></>),
  check: icon(<><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>),
  pencil: icon(<><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></>),
  flask: icon(<><path d="M9 3h6" /><path d="M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3" /><path d="M7 15h10" /></>),
  target: icon(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
  star: <svg viewBox="0 0 24 24" width="58%" height="58%" aria-hidden="true"><path fill="currentColor" d="m12 2 3 6.6 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.2l1.5-7L2 9.4l7-.8z" /></svg>,
  flame: <svg viewBox="0 0 24 24" width="58%" height="58%" aria-hidden="true"><path fill="currentColor" d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 10.5 11C10.5 7 12 2 12 2z" /></svg>,
}

type Float = { kind: 'q' | 'opt' | 'xp' | 'icon'; v: string; x: number; y: number; s: number; d: number; dur: number; r: number; c: string; sm?: boolean }
// x/y in % of the screen. `sm` = also shown on phones (the rest hide to keep it clean).
const FLOATS: Float[] = [
  { kind: 'q', v: '?', x: 6, y: 12, s: 64, d: 100, dur: 6, r: -12, c: '#22c55e', sm: true },
  { kind: 'icon', v: 'bulb', x: 17, y: 30, s: 58, d: 250, dur: 7, r: 10, c: '#facc15' },
  { kind: 'opt', v: 'A', x: 4, y: 46, s: 50, d: 400, dur: 5.5, r: -8, c: '#60a5fa' },
  { kind: 'icon', v: 'trophy', x: 13, y: 70, s: 62, d: 550, dur: 6.5, r: 8, c: '#fb923c', sm: true },
  { kind: 'xp', v: '+10 XP', x: 3, y: 86, s: 44, d: 700, dur: 6, r: -6, c: '#a78bfa' },
  { kind: 'opt', v: 'B', x: 24, y: 88, s: 46, d: 850, dur: 7.5, r: 12, c: '#f472b6' },
  { kind: 'icon', v: 'star', x: 26, y: 8, s: 44, d: 200, dur: 5, r: 0, c: '#facc15' },
  { kind: 'icon', v: 'timer', x: 92, y: 10, s: 58, d: 150, dur: 6.2, r: 10, c: '#60a5fa', sm: true },
  { kind: 'q', v: '?', x: 80, y: 26, s: 52, d: 300, dur: 7, r: 14, c: '#f472b6' },
  { kind: 'opt', v: 'C', x: 94, y: 44, s: 50, d: 450, dur: 5.8, r: 8, c: '#22c55e' },
  { kind: 'icon', v: 'flask', x: 84, y: 64, s: 60, d: 600, dur: 6.8, r: -10, c: '#86efac', sm: true },
  { kind: 'icon', v: 'check', x: 95, y: 82, s: 52, d: 750, dur: 5.6, r: 6, c: '#22c55e' },
  { kind: 'opt', v: 'D', x: 74, y: 90, s: 46, d: 900, dur: 7.2, r: -12, c: '#fb923c' },
  { kind: 'icon', v: 'pencil', x: 72, y: 6, s: 46, d: 350, dur: 6.4, r: -14, c: '#f472b6' },
  { kind: 'icon', v: 'target', x: 38, y: 93, s: 44, d: 1000, dur: 6, r: 0, c: '#f87171' },
  { kind: 'icon', v: 'flame', x: 60, y: 94, s: 42, d: 1100, dur: 5.2, r: 0, c: '#fb923c' },
  { kind: 'xp', v: '+25 XP', x: 88, y: 96, s: 40, d: 1200, dur: 6.6, r: 6, c: '#facc15', sm: true },
  { kind: 'q', v: '?', x: 45, y: 4, s: 40, d: 500, dur: 6, r: 10, c: '#a78bfa' },
]

const TITLE_WORDS = [
  { w: 'Quiz', accent: true },
  { w: 'Lab', accent: true },
  { w: 'is', accent: false },
  { w: 'here', accent: false },
]

const FEATURES = [
  { icon: 'target', label: 'Topic-wise quizzes' },
  { icon: 'timer', label: 'Instant results' },
  { icon: 'trophy', label: 'Track your progress' },
]

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

function FloatItem({ f }: { f: Float }) {
  let inner: ReactNode
  if (f.kind === 'icon') inner = ICONS[f.v]
  else inner = f.v
  return (
    <div
      className={`qls-float qls-float-${f.kind} ${f.sm ? '' : 'qls-hide-sm'}`}
      style={{
        left: `${f.x}%`, top: `${f.y}%`,
        ['--fs' as any]: `${f.s}px`, ['--fd' as any]: `${f.d}ms`, ['--dur' as any]: `${f.dur}s`,
        ['--rot' as any]: `${f.r}deg`, ['--c' as any]: f.c,
      }}
      aria-hidden="true"
    >
      <div className="qls-float-in">{inner}</div>
    </div>
  )
}

export default function QuizLabSurprise() {
  const [mode, setMode] = useState<'none' | 'full' | 'corner'>('none')
  const [phase, setPhase] = useState<Phase>('enter')
  const [cornerOpen, setCornerOpen] = useState(false)
  const [score, setScore] = useState(0)
  const [muted, setMuted] = useState(false)
  const timers = useRef<number[]>([])
  const sfxRef = useRef<ReturnType<typeof createSfx> | null>(null)
  const sfx = () => {
    if (!sfxRef.current && typeof window !== 'undefined') sfxRef.current = createSfx()
    return sfxRef.current
  }

  const clearTimers = () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = [] }
  const after = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }

  const runOpen = useCallback(() => {
    clearTimers()
    setPhase('open')
    after(700, () => setPhase('reveal'))
  }, [])

  // Decide what to show on mount (client only).
  useEffect(() => {
    if (readSeen()) { setMode('corner'); return }
    setMode('full')
    if (prefersReducedMotion()) { setPhase('reveal'); return }
    setPhase('enter')
    after(1000, () => setPhase('wiggle'))
    after(2400, () => setPhase('focus'))
    after(3100, () => runOpen())
    return clearTimers
  }, [runOpen])

  // Read the saved mute choice once on the client.
  useEffect(() => { setMuted(Boolean(sfx()?.muted)) }, [])

  // Sounds for each step of the full-screen surprise.
  useEffect(() => {
    if (mode !== 'full') return
    const s = sfx()
    if (!s) return
    s.unlock()
    if (phase === 'enter') [570, 690, 810, 930, 1050].forEach(ms => after(ms, () => s.play('thud')))
    if (phase === 'wiggle') { s.play('rattle'); after(700, () => s.play('rattle')) }
    if (phase === 'focus') s.play('rise')
    if (phase === 'open') s.play('pop')
    if (phase === 'reveal') {
      s.play('tada')
      ;[550, 700, 850].forEach(ms => after(ms, () => s.play('slap')))
      after(2350, () => s.play('ding'))
    }
    if (phase === 'leaving') s.play('whoosh')
  }, [mode, phase])

  function toggleMute() {
    const s = sfx()
    if (!s) return
    s.setMuted(!s.muted)
    setMuted(s.muted)
    if (!s.muted) { s.unlock(); s.play('mini') }
  }

  // Score counter on the right-hand card.
  useEffect(() => {
    if (mode !== 'full' || phase !== 'reveal') return
    if (prefersReducedMotion()) { setScore(90); return }
    let v = 0
    const start = window.setTimeout(() => {
      const id = window.setInterval(() => {
        v += 3
        setScore(Math.min(v, 90))
        if (v >= 90) window.clearInterval(id)
      }, 28)
      timers.current.push(id)
    }, 1300)
    return () => window.clearTimeout(start)
  }, [mode, phase])

  // Lock page scroll and allow Escape while the full-screen reveal is up.
  useEffect(() => {
    if (mode !== 'full') return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFull() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function closeFull() {
    writeSeen()
    clearTimers()
    setPhase('leaving')
    after(prefersReducedMotion() ? 0 : 560, () => setMode('corner'))
  }

  if (mode === 'none') return null

  const opened = phase === 'open' || phase === 'reveal' || phase === 'leaving'
  const boxesClickable = phase === 'enter' || phase === 'wiggle' || phase === 'focus'
  let letterIndex = 0

  return (
    <>
      <style>{CSS}</style>

      {mode === 'full' && (
        <div className={`qls-overlay qls-${phase}`} role="dialog" aria-modal="true" aria-label="Quiz Lab is here" onPointerDown={() => sfx()?.unlock()}>
          {/* Background: aurora, grid, twinkles, rising sparks */}
          <div className="qls-bg" aria-hidden="true">
            <span className="qls-blob qls-blob-1" />
            <span className="qls-blob qls-blob-2" />
            <span className="qls-blob qls-blob-3" />
            <span className="qls-grid" />
            {TWINKLES.map((t, i) => (
              <span key={i} className="qls-twinkle" style={{ left: `${t.left}%`, top: `${t.top}%`, animationDelay: `${t.delay}ms` }} />
            ))}
            {SPARKS.map((s, i) => (
              <span key={i} className="qls-spark" style={{ left: `${s.left}%`, width: s.size, height: s.size, animationDelay: `${s.delay}ms`, animationDuration: `${s.dur}s` }} />
            ))}
          </div>

          {/* Floating quiz pieces all around the screen */}
          <div className="qls-floats">
            {FLOATS.map((f, i) => <FloatItem key={i} f={f} />)}
          </div>

          {/* Confetti rain after the reveal */}
          {opened && (
            <div className="qls-rain" aria-hidden="true">
              {RAIN.map((r, i) => (
                <span key={i} style={{ left: `${r.left}%`, width: r.size, height: r.round ? r.size : r.size * 0.45, borderRadius: r.round ? '50%' : 2, background: r.color, animationDelay: `${800 + r.delay}ms`, animationDuration: `${r.dur}s` }} />
              ))}
            </div>
          )}

          {opened && <div className="qls-flash" aria-hidden="true" />}

          {/* Burst effects live on their own layer so they can never cause scrollbars */}
          <div className="qls-fx" aria-hidden="true">
            <div className="qls-rays" />
            <span className="qls-shock" />
            {opened && <Confetti pieces={CONFETTI} />}
          </div>

          <div className="qls-brand">
            <img src={QUIZ_LAB_LOGO} alt="" width={40} height={40} />
            <div>
              <b>QUIZ LAB</b>
              <span>by GenZ IITian</span>
            </div>
          </div>

          <button type="button" className="qls-sound" onClick={toggleMute} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
            {muted ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></svg>
            )}
          </button>

          <button type="button" className="qls-close" onClick={closeFull} aria-label="Close">×</button>

          {/* Side cards (wide screens) */}
          <aside className="qls-side-card qls-card-left" aria-hidden="true">
            <div className="qls-sc-head"><span className="qls-sc-tag">Sample question</span><span className="qls-sc-meta">Q3 · Physics</span></div>
            <p className="qls-sc-q">Which of these is a vector quantity?</p>
            {['Speed', 'Distance', 'Velocity', 'Time'].map((o, i) => (
              <div key={o} className={`qls-opt ${i === 2 ? 'is-right' : ''}`} style={{ ['--oi' as any]: i }}>
                <span className="qls-opt-l">{'ABCD'[i]}</span>{o}
                {i === 2 && <span className="qls-opt-tick">✓</span>}
              </div>
            ))}
            <span className="qls-xp-pop">+10 XP</span>
          </aside>

          <aside className="qls-side-card qls-card-right" aria-hidden="true">
            <div className="qls-sc-head"><span className="qls-sc-tag">Your score</span><span className="qls-sc-meta">Chapter test</span></div>
            <div className="qls-ring-row">
              <div className="qls-ring">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" className="qls-ring-bg" />
                  <circle cx="50" cy="50" r="42" className="qls-ring-fg" />
                </svg>
                <span className="qls-ring-num">{score}<small>%</small></span>
              </div>
              <div className="qls-streak">
                <span className="qls-streak-ic">{ICONS.flame}</span>
                <b>5 day</b><span>streak</span>
              </div>
            </div>
            <div className="qls-lb">
              {[{ n: '#1', xp: 980 }, { n: '#2', xp: 940 }, { n: 'You', xp: 900, me: true }].map((r, i) => (
                <div key={r.n} className={`qls-lb-row ${r.me ? 'is-me' : ''}`} style={{ ['--li' as any]: i }}>
                  <span className="qls-lb-av" />
                  <span className="qls-lb-n">{r.n}</span>
                  <span className="qls-lb-bar"><i style={{ width: `${(r.xp / 980) * 100}%` }} /></span>
                  <span className="qls-lb-xp">{r.xp}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="qls-scroll">
            <div className="qls-stage">
              <div className="qls-cell">

                <div className="qls-boxes">
                  <GiftBox className="qls-side qls-outer qls-outer-l" color="#ec4899" ribbon="#fbcfe8" />
                  <GiftBox className="qls-side qls-side-l" color="#6366f1" ribbon="#fde68a" />
                  <button
                    type="button"
                    className="qls-center-btn"
                    onClick={boxesClickable ? runOpen : undefined}
                    aria-label="Open the surprise"
                  >
                    <GiftBox className="qls-center" color="#16a34a" ribbon="#facc15" />
                  </button>
                  <GiftBox className="qls-side qls-side-r" color="#f59e0b" ribbon="#fef3c7" />
                  <GiftBox className="qls-side qls-outer qls-outer-r" color="#0ea5e9" ribbon="#e0f2fe" />
                  {boxesClickable && (
                    <>
                      <span className="qls-box-spark qls-bs1" aria-hidden="true" />
                      <span className="qls-box-spark qls-bs2" aria-hidden="true" />
                      <span className="qls-box-spark qls-bs3" aria-hidden="true" />
                    </>
                  )}
                </div>

                <div className="qls-reveal">
                  <div className="qls-logo-wrap">
                    <span className="qls-ripple" aria-hidden="true" />
                    <span className="qls-ripple qls-ripple-2" aria-hidden="true" />
                    <img className="qls-logo" src={QUIZ_LAB_LOGO} alt="Quiz Lab" width={168} height={168} />
                    <span className="qls-sticker qls-s1">NEW</span>
                    <span className="qls-sticker qls-s2">NEW!</span>
                    <span className="qls-sticker qls-s3">NEW</span>
                  </div>
                  <div className="qls-eyebrow"><i />GenZ IITian presents<i /></div>
                  <h2 className="qls-title">
                    {TITLE_WORDS.map((word, wi) => (
                      <span key={wi} className={`qls-word ${word.accent ? 'is-accent' : ''}`}>
                        {word.w.split('').map((ch, ci) => {
                          const i = letterIndex++
                          return <span key={ci} className="qls-letter" style={{ ['--li' as any]: i }}>{ch}</span>
                        })}
                      </span>
                    ))}
                  </h2>
                  <p className="qls-sub">Practice quizzes to test what you&apos;ve learned.</p>
                  <div className="qls-actions">
                    <a className="qls-try" href={QUIZ_LAB_URL} onClick={writeSeen}>Try now →</a>
                    <button type="button" className="qls-later" onClick={closeFull}>Maybe later</button>
                  </div>
                  <div className="qls-features">
                    {FEATURES.map((f, i) => (
                      <span key={f.label} className="qls-feature" style={{ ['--fi' as any]: i }}>
                        <span className="qls-feature-ic">{ICONS[f.icon]}</span>{f.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {boxesClickable && <p className="qls-hint">Something new is inside… tap the box</p>}
            </div>
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
              <div className="qls-card-by">by GenZ IITian</div>
              <div className="qls-card-sub">Practice quizzes to test yourself.</div>
              <a className="qls-try qls-try-sm" href={QUIZ_LAB_URL}>Try now →</a>
            </div>
          )}
          <button
            type="button"
            className="qls-corner-btn"
            onClick={() => {
              setCornerOpen(o => {
                if (!o) { const s = sfx(); s?.unlock(); window.setTimeout(() => s?.play('mini'), 30) }
                return !o
              })
            }}
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
.qls-overlay { position: fixed; inset: 0; z-index: 2147482000; overflow: hidden; color: #fff; isolation: isolate; }
.qls-bg { position: absolute; inset: 0; z-index: 0; overflow: hidden; background: radial-gradient(120% 90% at 50% 40%, #0b3b22 0%, #04170d 55%, #020805 100%); animation: qlsFade 450ms ease both; }
.qls-blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.55; mix-blend-mode: screen; }
.qls-blob-1 { width: 55vmax; height: 55vmax; left: -15vmax; top: -18vmax; background: #16a34a; animation: qlsBlob1 16s ease-in-out infinite alternate; }
.qls-blob-2 { width: 45vmax; height: 45vmax; right: -14vmax; bottom: -16vmax; background: #4f46e5; opacity: 0.35; animation: qlsBlob2 19s ease-in-out infinite alternate; }
.qls-blob-3 { width: 35vmax; height: 35vmax; right: 10vmax; top: -12vmax; background: #0ea5e9; opacity: 0.22; animation: qlsBlob3 14s ease-in-out infinite alternate; }
.qls-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(134,239,172,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(134,239,172,0.07) 1px, transparent 1px); background-size: 46px 46px; -webkit-mask: radial-gradient(ellipse at 50% 45%, #000 20%, transparent 75%); mask: radial-gradient(ellipse at 50% 45%, #000 20%, transparent 75%); animation: qlsGrid 20s linear infinite; }
.qls-twinkle { position: absolute; width: 4px; height: 4px; border-radius: 50%; background: #dcfce7; box-shadow: 0 0 8px 2px rgba(187,247,208,0.7); animation: qlsTwinkle 2.6s ease-in-out infinite; }
.qls-spark { position: absolute; bottom: -10px; border-radius: 50%; background: #86efac; box-shadow: 0 0 10px #4ade80; opacity: 0; animation: qlsRise linear infinite; }

.qls-floats { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
.qls-float { position: absolute; width: var(--fs); height: var(--fs); margin: calc(var(--fs) / -2) 0 0 calc(var(--fs) / -2); animation: qlsFloatIn 700ms cubic-bezier(.2,1.5,.4,1) var(--fd) both; }
.qls-float-in {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  border-radius: 30%; color: var(--c); font-weight: 900; font-size: calc(var(--fs) * 0.5);
  background: color-mix(in srgb, var(--c) 16%, rgba(255,255,255,0.04));
  border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
  box-shadow: 0 10px 30px rgba(0,0,0,0.35), 0 0 22px color-mix(in srgb, var(--c) 30%, transparent);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  animation: qlsDrift var(--dur) ease-in-out calc(var(--fd) + 700ms) infinite;
  transform: rotate(var(--rot));
}
.qls-float-q .qls-float-in { border-radius: 50%; font-size: calc(var(--fs) * 0.58); }
.qls-float-opt .qls-float-in { border-radius: 14px; }
.qls-float-xp { width: auto; height: auto; margin: 0; }
.qls-float-xp .qls-float-in { padding: 8px 14px; border-radius: 999px; font-size: 14px; white-space: nowrap; }

/* Confetti rain + open flash */
.qls-rain { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; }
.qls-rain span { position: absolute; top: -20px; opacity: 0; animation: qlsFall linear infinite; }
.qls-flash { position: absolute; inset: 0; z-index: 6; pointer-events: none; background: radial-gradient(circle at 50% 45%, #fff, rgba(187,247,208,0.6) 30%, transparent 70%); animation: qlsFlash 650ms ease-out forwards; }

.qls-close {
  position: absolute; top: max(14px, env(safe-area-inset-top)); right: 16px; z-index: 8; width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.22); background: rgba(255,255,255,0.08); color: #fff;
  font-size: 26px; line-height: 1; cursor: pointer; transition: transform 200ms ease, background 200ms ease;
}
.qls-close:hover { transform: rotate(90deg); background: rgba(255,255,255,0.16); }

/* Centre column scrolls if the screen is very short */
.qls-scroll { position: absolute; inset: 0; z-index: 4; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; }
.qls-scroll::-webkit-scrollbar { display: none; }
.qls-fx { position: absolute; left: 50%; top: 44%; width: 0; height: 0; z-index: 3; pointer-events: none; }
.qls-fx .qls-confetti { left: 0; top: 0; }
.qls-brand { position: absolute; z-index: 8; top: max(14px, env(safe-area-inset-top)); left: max(16px, env(safe-area-inset-left)); display: flex; align-items: center; gap: 10px; padding: 6px 14px 6px 6px; border-radius: 16px; background: rgba(255,255,255,0.07); border: 1px solid rgba(134,239,172,0.25); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); animation: qlsBrandIn 700ms cubic-bezier(.2,1.3,.4,1) 250ms both; }
.qls-brand img { width: 38px; height: 38px; border-radius: 11px; display: block; box-shadow: 0 0 14px rgba(74,222,128,0.5); }
.qls-brand b { display: block; font-size: 15px; font-weight: 900; letter-spacing: 0.16em; line-height: 1.1; background: linear-gradient(90deg, #ffffff, #86efac, #ffffff); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: qlsShimmer 4s linear infinite; }
.qls-brand span { display: block; margin-top: 2px; font-size: 11.5px; font-weight: 700; color: rgba(236,253,245,0.75); letter-spacing: 0.02em; }
.qls-sound { position: absolute; top: max(14px, env(safe-area-inset-top)); right: 70px; z-index: 8; width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.22); background: rgba(255,255,255,0.08); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 200ms ease; }
.qls-sound:hover { background: rgba(255,255,255,0.16); }
.qls-eyebrow { display: inline-flex; align-items: center; gap: 10px; margin-top: clamp(14px, 2.6vh, 24px); font-size: clamp(11px, 1.5vw, 13px); font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #86efac; opacity: 0; }
.qls-eyebrow i { width: 26px; height: 2px; border-radius: 2px; background: currentColor; opacity: 0.7; }
.qls-overlay.qls-reveal .qls-eyebrow { animation: qlsUp 500ms 500ms ease both; }
.qls-card-by { margin-top: 2px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #86efac; }
.qls-stage { min-height: 100%; box-sizing: border-box; padding: clamp(56px, 8vh, 90px) 16px clamp(28px, 5vh, 60px); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.qls-cell { position: relative; display: grid; place-items: center; width: min(100%, 640px); }
.qls-cell > .qls-boxes, .qls-cell > .qls-reveal { grid-area: 1 / 1; }

.qls-boxes { position: relative; display: flex; align-items: flex-end; justify-content: center; gap: clamp(12px, 3.2vw, 40px); height: clamp(180px, 34vh, 300px); }
.qls-center-btn { background: none; border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.qls-center { --s: clamp(130px, 25vh, 215px); }
.qls-side { --s: clamp(92px, 17vh, 150px); }
.qls-outer { --s: clamp(72px, 13vh, 118px); }
.qls-cell { width: min(100%, 900px); }
.qls-box-spark { position: absolute; width: 10px; height: 10px; background: #fde68a; clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); animation: qlsSparkle 1.4s ease-in-out infinite; }
.qls-bs1 { left: 18%; top: 4%; } .qls-bs2 { right: 16%; top: 18%; animation-delay: 450ms; width: 14px; height: 14px; } .qls-bs3 { left: 50%; top: -12%; animation-delay: 900ms; }
.qls-hint { margin: 20px 0 0; color: rgba(236,253,245,0.85); font-size: clamp(14px, 2vw, 16px); font-weight: 600; animation: qlsFade 500ms 900ms ease both, qlsBreath 1.6s 1.4s ease-in-out infinite; }

/* enter: boxes drop in one after another */
.qls-enter .qls-gift { animation: qlsDrop 700ms cubic-bezier(.2,1.4,.4,1) both; }
.qls-enter .qls-outer-l { animation-delay: 80ms; }
.qls-enter .qls-side-l { animation-delay: 200ms; }
.qls-enter .qls-center { animation-delay: 320ms; }
.qls-enter .qls-side-r { animation-delay: 440ms; }
.qls-enter .qls-outer-r { animation-delay: 560ms; }

/* wiggle: all three shake, out of sync */
.qls-wiggle .qls-gift { animation: qlsWiggle 700ms ease-in-out 2; transform-origin: 50% 100%; }
.qls-wiggle .qls-outer-l { animation-delay: 140ms; }
.qls-wiggle .qls-side-l { animation-delay: 80ms; }
.qls-wiggle .qls-side-r { animation-delay: 200ms; }
.qls-wiggle .qls-outer-r { animation-delay: 40ms; }

/* focus: side boxes leave, the Quiz Lab box grows and shakes hard */
.qls-focus .qls-side, .qls-open .qls-side, .qls-reveal .qls-side, .qls-leaving .qls-side { animation: qlsAway 450ms ease forwards; }
.qls-focus .qls-side-r, .qls-open .qls-side-r, .qls-reveal .qls-side-r, .qls-leaving .qls-side-r { animation-name: qlsAwayR; }
.qls-focus .qls-outer-l, .qls-open .qls-outer-l, .qls-reveal .qls-outer-l, .qls-leaving .qls-outer-l { animation: qlsAwayFar 500ms ease forwards; }
.qls-focus .qls-outer-r, .qls-open .qls-outer-r, .qls-reveal .qls-outer-r, .qls-leaving .qls-outer-r { animation: qlsAwayFarR 500ms ease forwards; }
.qls-focus .qls-center { animation: qlsBigShake 700ms ease-in-out both; transform-origin: 50% 100%; }
.qls-focus .qls-center .qls-body { animation: qlsGlowBox 700ms ease-in-out both; }

/* open: lid flies off, box pumps, flash, shockwave, rays + confetti */
.qls-open .qls-center { animation: qlsPump 420ms ease-out both; }
.qls-open .qls-center .qls-lid, .qls-reveal .qls-center .qls-lid, .qls-leaving .qls-center .qls-lid { animation: qlsLidOff 650ms cubic-bezier(.3,.7,.4,1) forwards; }
.qls-reveal .qls-center, .qls-leaving .qls-center { animation: qlsSink 600ms 200ms ease both; }
.qls-rays {
  position: absolute; left: 0; top: 0; width: min(140vw, 1100px); height: min(140vw, 1100px); transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none; opacity: 0;
  background: repeating-conic-gradient(rgba(134,239,172,0.2) 0deg 9deg, transparent 9deg 22deg);
  -webkit-mask: radial-gradient(circle, #000 12%, transparent 62%); mask: radial-gradient(circle, #000 12%, transparent 62%);
}
.qls-open .qls-rays, .qls-reveal .qls-rays, .qls-leaving .qls-rays { animation: qlsRaysIn 600ms ease forwards, qlsSpin 16s linear infinite; }
.qls-shock { position: absolute; left: 0; top: 0; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; border: 4px solid rgba(187,247,208,0.9); opacity: 0; pointer-events: none; }
.qls-open .qls-shock { animation: qlsShock 800ms ease-out forwards; }

.qls-confetti { position: absolute; left: 50%; top: 42%; width: 0; height: 0; pointer-events: none; z-index: 3; }
.qls-confetti span { position: absolute; left: 0; top: 0; opacity: 0; animation: qlsBurst 1200ms cubic-bezier(.15,.7,.3,1) forwards; }

/* reveal: logo pops out of the box, stickers slap on, title letters bounce in */
.qls-overlay .qls-reveal { display: flex; flex-direction: column; align-items: center; pointer-events: none; opacity: 0; position: relative; z-index: 2; }
.qls-overlay.qls-reveal .qls-reveal, .qls-overlay.qls-leaving .qls-reveal { opacity: 1; pointer-events: auto; }
.qls-logo-wrap { position: relative; }
.qls-logo { position: relative; z-index: 1; display: block; width: clamp(110px, min(30vw, 22vh), 176px); height: auto; border-radius: 22%; box-shadow: 0 0 0 1px rgba(255,255,255,0.15), 0 0 60px rgba(74,222,128,0.65), 0 24px 50px rgba(0,0,0,0.45); }
.qls-overlay.qls-reveal .qls-logo { animation: qlsPopOut 850ms cubic-bezier(.2,1.6,.4,1) both, qlsFloat 3.2s 1s ease-in-out infinite; }
.qls-ripple { position: absolute; inset: 0; border-radius: 22%; border: 2px solid rgba(134,239,172,0.7); opacity: 0; }
.qls-overlay.qls-reveal .qls-ripple { animation: qlsRipple 2.4s 900ms ease-out infinite; }
.qls-overlay.qls-reveal .qls-ripple-2 { animation-delay: 2.1s; }
.qls-sticker { position: absolute; z-index: 2; padding: 5px 11px; border-radius: 999px; font-size: clamp(11px, 1.6vw, 13px); font-weight: 900; letter-spacing: 0.06em; color: #0d5c33; background: #dcfce7; box-shadow: 0 6px 16px rgba(0,0,0,0.3); opacity: 0; }
.qls-s1 { top: -10px; right: -34px; background: #facc15; color: #422006; }
.qls-s2 { bottom: 14px; left: -46px; }
.qls-s3 { top: 48%; right: -56px; background: #f472b6; color: #500724; font-size: 11px; }
.qls-overlay.qls-reveal .qls-sticker { animation: qlsSlap 520ms cubic-bezier(.2,1.8,.4,1) both, qlsTilt 2.4s 1.4s ease-in-out infinite; }
.qls-overlay.qls-reveal .qls-s1 { animation-delay: 550ms, 1.4s; }
.qls-overlay.qls-reveal .qls-s2 { animation-delay: 700ms, 1.6s; }
.qls-overlay.qls-reveal .qls-s3 { animation-delay: 850ms, 1.8s; }

.qls-title { margin: 6px 0 6px; font-size: clamp(28px, min(7vw, 6vh), 52px); font-weight: 900; letter-spacing: -0.03em; line-height: 1.05; display: flex; flex-wrap: wrap; justify-content: center; gap: 0 0.28em; }
.qls-word { display: inline-flex; }
.qls-word.is-accent .qls-letter { background: linear-gradient(90deg, #86efac, #facc15, #4ade80, #86efac); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; }
.qls-letter { display: inline-block; opacity: 0; }
.qls-overlay.qls-reveal .qls-letter { animation: qlsLetter 600ms cubic-bezier(.2,1.6,.4,1) calc(650ms + var(--li) * 40ms) both; }
.qls-overlay.qls-reveal .qls-word.is-accent .qls-letter { animation: qlsLetter 600ms cubic-bezier(.2,1.6,.4,1) calc(650ms + var(--li) * 40ms) both, qlsShimmer 3s linear 1.6s infinite; }
.qls-sub { margin: 0; color: rgba(236,253,245,0.85); font-size: clamp(14px, 2.2vw, 17px); }
.qls-actions { margin-top: clamp(16px, 3vh, 24px); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; }
.qls-overlay.qls-reveal .qls-sub { animation: qlsUp 500ms 1150ms ease both; }
.qls-overlay.qls-reveal .qls-actions { animation: qlsUp 500ms 1300ms ease both; }
.qls-try {
  position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: clamp(12px, 1.8vh, 15px) clamp(26px, 4vw, 36px); border-radius: 999px; text-decoration: none; font-size: clamp(15px, 2vw, 17px); font-weight: 900; color: #fff;
  background: linear-gradient(135deg, #22c55e, #15803d); box-shadow: 0 10px 30px rgba(34,197,94,0.45);
  animation: qlsPulse 2s 1.8s ease-in-out infinite; transition: transform 200ms ease, filter 200ms ease;
}
.qls-try::after { content: ''; position: absolute; top: 0; left: -60%; width: 40%; height: 100%; background: linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent); transform: skewX(-20deg); animation: qlsShine 2.8s 2s ease-in-out infinite; }
.qls-try:hover { filter: brightness(1.08); transform: translateY(-2px) scale(1.03); }
.qls-later { padding: clamp(11px, 1.7vh, 14px) 20px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.22); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.88); font-size: 15px; font-weight: 700; cursor: pointer; transition: background 200ms ease; }
.qls-later:hover { background: rgba(255,255,255,0.1); }
.qls-features { margin-top: clamp(16px, 3vh, 26px); display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.qls-feature { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px 8px 8px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(134,239,172,0.22); font-size: 13.5px; font-weight: 700; color: rgba(236,253,245,0.92); opacity: 0; }
.qls-feature-ic { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: rgba(34,197,94,0.22); color: #86efac; }
.qls-overlay.qls-reveal .qls-feature { animation: qlsUp 500ms calc(1500ms + var(--fi) * 120ms) ease both; }

/* Side cards */
.qls-side-card {
  position: absolute; top: 50%; z-index: 3; width: clamp(230px, 19vw, 300px); padding: 18px; border-radius: 22px; box-sizing: border-box; text-align: left;
  background: linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03)); border: 1px solid rgba(134,239,172,0.22);
  box-shadow: 0 24px 60px rgba(0,0,0,0.45); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  opacity: 0; pointer-events: none; display: none;
}
.qls-card-left { left: clamp(20px, 4vw, 80px); transform: translate(-60px, -50%) rotate(-4deg); }
.qls-card-right { right: clamp(20px, 4vw, 80px); transform: translate(60px, -50%) rotate(4deg); }
.qls-overlay.qls-reveal .qls-card-left { animation: qlsCardL 800ms cubic-bezier(.2,1.2,.4,1) 900ms forwards; }
.qls-overlay.qls-reveal .qls-card-right { animation: qlsCardR 800ms cubic-bezier(.2,1.2,.4,1) 1050ms forwards; }
.qls-sc-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.qls-sc-tag { font-size: 11px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; color: #86efac; }
.qls-sc-meta { font-size: 11.5px; color: rgba(236,253,245,0.6); font-weight: 600; }
.qls-sc-q { margin: 0 0 12px; font-size: 15px; font-weight: 800; line-height: 1.35; }
.qls-opt { position: relative; display: flex; align-items: center; gap: 10px; padding: 9px 10px; margin-top: 7px; border-radius: 12px; font-size: 13.5px; font-weight: 600; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); opacity: 0; }
.qls-opt-l { width: 24px; height: 24px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; background: rgba(255,255,255,0.1); }
.qls-opt-tick { margin-left: auto; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #22c55e; color: #fff; font-size: 13px; font-weight: 900; transform: scale(0); }
.qls-overlay.qls-reveal .qls-opt { animation: qlsUp 400ms calc(1300ms + var(--oi) * 110ms) ease both; }
.qls-overlay.qls-reveal .qls-opt.is-right { animation: qlsUp 400ms calc(1300ms + var(--oi) * 110ms) ease both, qlsRight 500ms 2200ms ease forwards; }
.qls-overlay.qls-reveal .qls-opt-tick { animation: qlsTick 450ms cubic-bezier(.2,1.8,.4,1) 2350ms forwards; }
.qls-xp-pop { position: absolute; right: 18px; bottom: 54px; padding: 4px 10px; border-radius: 999px; background: #facc15; color: #422006; font-size: 12px; font-weight: 900; opacity: 0; }
.qls-overlay.qls-reveal .qls-xp-pop { animation: qlsXp 1.4s ease-out 2500ms forwards; }
.qls-ring-row { display: flex; align-items: center; gap: 16px; }
.qls-ring { position: relative; width: 104px; height: 104px; flex-shrink: 0; }
.qls-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.qls-ring-bg { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 9; }
.qls-ring-fg { fill: none; stroke: #22c55e; stroke-width: 9; stroke-linecap: round; stroke-dasharray: 264; stroke-dashoffset: 264; filter: drop-shadow(0 0 6px rgba(34,197,94,0.7)); }
.qls-overlay.qls-reveal .qls-ring-fg { animation: qlsRing 1.3s cubic-bezier(.3,.8,.3,1) 1300ms forwards; }
.qls-ring-num { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; }
.qls-ring-num small { font-size: 13px; margin-left: 1px; color: rgba(236,253,245,0.7); }
.qls-streak { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; font-size: 13px; color: rgba(236,253,245,0.7); }
.qls-streak b { font-size: 18px; color: #fff; }
.qls-streak-ic { width: 34px; height: 34px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: rgba(251,146,60,0.18); color: #fb923c; margin-bottom: 4px; animation: qlsFlame 1.2s ease-in-out infinite; }
.qls-lb { margin-top: 14px; display: flex; flex-direction: column; gap: 7px; }
.qls-lb-row { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 12px; background: rgba(255,255,255,0.05); font-size: 12.5px; font-weight: 700; opacity: 0; }
.qls-lb-row.is-me { background: rgba(34,197,94,0.18); border: 1px solid rgba(74,222,128,0.4); }
.qls-lb-av { width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, #a78bfa, #60a5fa); flex-shrink: 0; }
.qls-lb-row.is-me .qls-lb-av { background: linear-gradient(135deg, #4ade80, #16a34a); }
.qls-lb-n { width: 30px; }
.qls-lb-bar { flex: 1; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
.qls-lb-bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #22c55e, #86efac); transform-origin: left; transform: scaleX(0); }
.qls-lb-xp { color: rgba(236,253,245,0.75); font-variant-numeric: tabular-nums; }
.qls-overlay.qls-reveal .qls-lb-row { animation: qlsUp 400ms calc(1700ms + var(--li) * 140ms) ease both; }
.qls-overlay.qls-reveal .qls-lb-bar i { animation: qlsBar 900ms ease-out 2100ms forwards; }

/* leaving: everything shrinks off toward the corner box */
.qls-leaving .qls-scroll, .qls-leaving .qls-side-card, .qls-leaving .qls-floats { animation: qlsToCorner 560ms cubic-bezier(.5,0,.75,0) forwards !important; }
.qls-leaving .qls-bg, .qls-leaving .qls-rain, .qls-leaving .qls-close, .qls-leaving .qls-sound, .qls-leaving .qls-brand, .qls-leaving .qls-fx { animation: qlsFadeOut 560ms ease forwards; }

/* ───────── Responsive ───────── */
@media (min-width: 1180px) and (min-height: 600px) { .qls-side-card { display: block; } }
@media (max-width: 900px) { .qls-outer { display: none; } }
@media (max-width: 640px) {
  .qls-hide-sm { display: none; }
  .qls-center { --s: clamp(104px, 31vw, 150px); }
  .qls-side { --s: clamp(70px, 20vw, 100px); }
  .qls-boxes { gap: 10px; }
  .qls-s3 { display: none; }
  .qls-s2 { left: -34px; }
  .qls-s1 { right: -24px; }
  .qls-features { gap: 8px; }
  .qls-feature { font-size: 12.5px; padding: 6px 12px 6px 6px; }
  .qls-float-xp .qls-float-in { font-size: 12px; padding: 6px 10px; }
  .qls-float { --fs: 40px !important; opacity: 0.7; }
  .qls-brand { padding: 4px 10px 4px 4px; gap: 8px; }
  .qls-brand img { width: 30px; height: 30px; border-radius: 9px; }
  .qls-brand b { font-size: 12.5px; }
  .qls-brand span { font-size: 10px; }
  .qls-sound { right: 66px; width: 40px; height: 40px; }
  .qls-close { width: 40px; height: 40px; }
}
@media (max-height: 560px) {
  .qls-features { display: none; }
  .qls-hint { margin-top: 8px; }
  .qls-stage { padding-top: 48px; padding-bottom: 20px; }
}
@media (max-height: 420px) {
  .qls-floats { display: none; }
  .qls-sub { display: none; }
}

/* ───────── Corner box ───────── */
.qls-corner { position: fixed; right: 28px; bottom: 96px; z-index: 1001; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
.qls-corner-btn { position: relative; width: 78px; height: 78px; border-radius: 24px; border: 1px solid rgba(74,222,128,0.4); cursor: pointer; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 10px; background: radial-gradient(circle at 50% 30%, #14532d, #052e16); box-shadow: 0 10px 26px rgba(0,0,0,0.35), 0 0 18px rgba(34,197,94,0.35); animation: qlsCornerIn 600ms cubic-bezier(.2,1.5,.4,1) both; -webkit-tap-highlight-color: transparent; }
.qls-mini { --s: 50px; animation: qlsIdleWiggle 5s 1.2s ease-in-out infinite; transform-origin: 50% 100%; }
.qls-mini .qls-body { border-radius: 6px; box-shadow: inset 0 -4px 6px rgba(0,0,0,0.18); }
.qls-mini .qls-lid { border-radius: 4px; }
.qls-mini.is-open { animation: none; }
.qls-mini.is-open .qls-lid { animation: qlsMiniLid 380ms ease forwards; }
.qls-corner-new { position: absolute; top: -8px; right: -10px; padding: 2px 7px; border-radius: 999px; background: #facc15; color: #422006; font-size: 10px; font-weight: 900; letter-spacing: 0.06em; box-shadow: 0 4px 10px rgba(0,0,0,0.3); animation: qlsBadge 1.8s ease-in-out infinite; }
.qls-card { position: relative; width: 240px; padding: 18px 18px 16px; border-radius: 22px; text-align: center; color: #fff; background: radial-gradient(120% 120% at 50% 0%, #166534, #052e16 75%); border: 1px solid rgba(74,222,128,0.35); box-shadow: 0 20px 44px rgba(0,0,0,0.45); animation: qlsCardPop 420ms cubic-bezier(.2,1.5,.4,1) both; transform-origin: 85% 100%; }
.qls-card .qls-confetti { top: 54px; z-index: 0; }
.qls-card-logo, .qls-card-title, .qls-card-by, .qls-card-sub { position: relative; z-index: 1; }
.qls-card-x { position: absolute; top: 8px; right: 10px; width: 28px; height: 28px; border-radius: 50%; border: 0; background: rgba(255,255,255,0.12); color: #fff; font-size: 18px; line-height: 1; cursor: pointer; }
.qls-card-logo { display: block; margin: 0 auto; width: 72px; height: 72px; border-radius: 18px; box-shadow: 0 0 24px rgba(74,222,128,0.6); animation: qlsPopOut 600ms 120ms cubic-bezier(.2,1.6,.4,1) both; }
.qls-card-title { margin-top: 10px; font-size: 18px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 6px; }
.qls-card-new { font-size: 10px; font-weight: 900; padding: 2px 7px; border-radius: 999px; background: #facc15; color: #422006; animation: qlsSlap 420ms 300ms cubic-bezier(.2,1.8,.4,1) both; }
.qls-card-sub { margin: 4px 0 14px; font-size: 13px; color: rgba(236,253,245,0.82); }
.qls-try-sm { padding: 10px 22px; font-size: 14px; width: 100%; box-sizing: border-box; }
@media (max-width: 640px) { .qls-corner { right: 16px; bottom: 90px; } }

/* ───────── Keyframes ───────── */
@keyframes qlsFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes qlsBrandIn { from { opacity: 0; transform: translateX(-30px) scale(0.9); } to { opacity: 1; transform: none; } }
@keyframes qlsFadeOut { to { opacity: 0; } }
@keyframes qlsBreath { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes qlsBlob1 { to { transform: translate(18vw, 14vh) scale(1.15); } }
@keyframes qlsBlob2 { to { transform: translate(-16vw, -12vh) scale(1.2); } }
@keyframes qlsBlob3 { to { transform: translate(-22vw, 20vh) scale(0.9); } }
@keyframes qlsGrid { to { background-position: 46px 46px, 46px 46px; } }
@keyframes qlsTwinkle { 0%,100% { opacity: 0.15; transform: scale(0.6); } 50% { opacity: 1; transform: scale(1.2); } }
@keyframes qlsRise { 0% { opacity: 0; transform: translateY(0); } 10% { opacity: 0.9; } 100% { opacity: 0; transform: translateY(-110vh) translateX(30px); } }
@keyframes qlsFloatIn { 0% { opacity: 0; transform: scale(0) rotate(-30deg); } 100% { opacity: 1; transform: none; } }
@keyframes qlsDrift { 0%,100% { transform: translateY(0) rotate(var(--rot)); } 50% { transform: translateY(-16px) rotate(calc(var(--rot) * -1)); } }
@keyframes qlsFall { 0% { opacity: 0; transform: translateY(0) rotate(0); } 8% { opacity: 1; } 100% { opacity: 0.9; transform: translateY(110vh) translateX(40px) rotate(720deg); } }
@keyframes qlsFlash { 0% { opacity: 0; } 20% { opacity: 0.85; } 100% { opacity: 0; } }
@keyframes qlsDrop { 0% { opacity: 0; transform: translateY(-140px) scale(0.7) rotate(-8deg); } 70% { opacity: 1; transform: translateY(8px) scale(1.04, 0.94); } 100% { transform: none; } }
@keyframes qlsWiggle { 0%,100% { transform: rotate(0); } 15% { transform: rotate(-9deg); } 30% { transform: rotate(8deg); } 45% { transform: rotate(-6deg); } 60% { transform: rotate(4deg); } 75% { transform: rotate(-2deg); } }
@keyframes qlsSparkle { 0%,100% { opacity: 0; transform: scale(0.3) rotate(0); } 50% { opacity: 1; transform: scale(1.3) rotate(90deg); } }
@keyframes qlsAway { to { opacity: 0; transform: translateX(-70px) scale(0.6) rotate(-14deg); } }
@keyframes qlsAwayFar { to { opacity: 0; transform: translate(-140px, -40px) scale(0.5) rotate(-24deg); } }
@keyframes qlsAwayFarR { to { opacity: 0; transform: translate(140px, -40px) scale(0.5) rotate(24deg); } }
@keyframes qlsAwayR { to { opacity: 0; transform: translateX(70px) scale(0.6) rotate(14deg); } }
@keyframes qlsBigShake { 0% { transform: scale(1); } 20% { transform: scale(1.12) rotate(-10deg); } 40% { transform: scale(1.16) rotate(10deg); } 60% { transform: scale(1.18) rotate(-8deg); } 80% { transform: scale(1.2) rotate(6deg); } 100% { transform: scale(1.2) rotate(0); } }
@keyframes qlsGlowBox { 100% { box-shadow: inset 0 -10px 18px rgba(0,0,0,0.18), 0 0 50px 10px rgba(74,222,128,0.7); } }
@keyframes qlsPump { 0% { transform: scale(1.2); } 40% { transform: scale(1.34, 1.04); } 100% { transform: scale(1.2); } }
@keyframes qlsLidOff { 0% { transform: none; } 100% { transform: translate(110px, -300px) rotate(60deg); opacity: 0; } }
@keyframes qlsSink { from { transform: scale(1.2); } to { opacity: 0; transform: translateY(40px) scale(0.9); } }
@keyframes qlsRaysIn { to { opacity: 1; } }
@keyframes qlsSpin { to { transform: translate(-50%, -50%) rotate(360deg); } }
@keyframes qlsShock { 0% { opacity: 1; transform: scale(0.3); } 100% { opacity: 0; transform: scale(9); border-width: 1px; } }
@keyframes qlsBurst { 0% { opacity: 1; transform: rotate(var(--a)) translateY(0) rotate(0); } 70% { opacity: 1; } 100% { opacity: 0; transform: rotate(var(--a)) translateY(calc(-1 * var(--d))) rotate(540deg); } }
@keyframes qlsPopOut { 0% { opacity: 0; transform: translateY(80px) scale(0.2) rotate(-14deg); } 60% { opacity: 1; transform: translateY(-16px) scale(1.12) rotate(4deg); } 100% { transform: none; } }
@keyframes qlsFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
@keyframes qlsRipple { 0% { opacity: 0.8; transform: scale(1); } 100% { opacity: 0; transform: scale(1.7); } }
@keyframes qlsSlap { 0% { opacity: 0; transform: scale(2.4) rotate(-20deg); } 100% { opacity: 1; transform: scale(1) rotate(-8deg); } }
@keyframes qlsTilt { 0%,100% { transform: rotate(-8deg) scale(1); } 50% { transform: rotate(6deg) scale(1.08); } }
@keyframes qlsLetter { 0% { opacity: 0; transform: translateY(36px) rotate(-14deg) scale(0.6); } 100% { opacity: 1; transform: none; } }
@keyframes qlsShimmer { to { background-position: 300% 0; } }
@keyframes qlsUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes qlsPulse { 0%,100% { box-shadow: 0 10px 30px rgba(34,197,94,0.45), 0 0 0 0 rgba(34,197,94,0.5); } 50% { box-shadow: 0 10px 30px rgba(34,197,94,0.45), 0 0 0 14px rgba(34,197,94,0); } }
@keyframes qlsShine { 0% { left: -60%; } 55%,100% { left: 130%; } }
@keyframes qlsCardL { to { opacity: 1; transform: translate(0, -50%) rotate(-3deg); } }
@keyframes qlsCardR { to { opacity: 1; transform: translate(0, -50%) rotate(3deg); } }
@keyframes qlsRight { to { background: rgba(34,197,94,0.22); border-color: rgba(74,222,128,0.6); box-shadow: 0 0 20px rgba(34,197,94,0.35); } }
@keyframes qlsTick { to { transform: scale(1); } }
@keyframes qlsXp { 0% { opacity: 0; transform: translateY(10px) scale(0.6); } 25% { opacity: 1; transform: translateY(-6px) scale(1.1); } 100% { opacity: 0; transform: translateY(-40px) scale(1); } }
@keyframes qlsRing { to { stroke-dashoffset: 26.4; } }
@keyframes qlsFlame { 0%,100% { transform: scale(1) rotate(-4deg); } 50% { transform: scale(1.12) rotate(4deg); } }
@keyframes qlsBar { to { transform: scaleX(1); } }
@keyframes qlsToCorner { to { opacity: 0; transform: translate(38vw, 38vh) scale(0.1); } }
@keyframes qlsCornerIn { 0% { opacity: 0; transform: scale(0.3) rotate(-20deg); } 100% { opacity: 1; transform: none; } }
@keyframes qlsIdleWiggle { 0%, 82%, 100% { transform: rotate(0); } 85% { transform: rotate(-14deg); } 88% { transform: rotate(12deg); } 91% { transform: rotate(-9deg); } 94% { transform: rotate(6deg); } 97% { transform: rotate(-3deg); } }
@keyframes qlsMiniLid { to { transform: translate(8px, -14px) rotate(28deg); } }
@keyframes qlsBadge { 0%,100% { transform: scale(1) rotate(-6deg); } 50% { transform: scale(1.12) rotate(4deg); } }
@keyframes qlsCardPop { 0% { opacity: 0; transform: scale(0.4) translateY(20px); } 100% { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .qls-overlay *, .qls-corner *, .qls-corner-btn { animation: none !important; }
  .qls-overlay .qls-sticker, .qls-overlay .qls-reveal, .qls-overlay .qls-letter, .qls-overlay .qls-feature,
  .qls-overlay .qls-side-card, .qls-overlay .qls-opt, .qls-overlay .qls-lb-row, .qls-overlay .qls-eyebrow { opacity: 1 !important; }
  .qls-overlay .qls-side-card { transform: translateY(-50%) !important; }
  .qls-overlay .qls-boxes, .qls-overlay .qls-rain, .qls-overlay .qls-spark { display: none; }
}
`
