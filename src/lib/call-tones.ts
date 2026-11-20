'use client'

// Call sounds generated with Web Audio: no audio files, nothing to license.
// ringback = what the caller hears while waiting (Indian style: 400+450 Hz, double ring every 3 s);
// ringtone = incoming call alert (two-note chirp every 2.5 s).
type Burst = { at: number; dur: number; freqs: number[] }
const PATTERNS: Record<'ringback' | 'ringtone', { every: number; bursts: Burst[]; volume: number }> = {
  ringback: { every: 3, volume: 0.08, bursts: [{ at: 0, dur: 0.4, freqs: [400, 450] }, { at: 0.6, dur: 0.4, freqs: [400, 450] }] },
  ringtone: {
    every: 2.5, volume: 0.12,
    bursts: [0, 0.3, 0.6, 0.9].map((at, i) => ({ at, dur: 0.25, freqs: [i % 2 ? 660 : 880] })),
  },
}

let ctx: AudioContext | null = null

/** Starts a looping tone and returns a stop function. Silently does nothing if audio is blocked. */
export function playTone(kind: 'ringback' | 'ringtone'): () => void {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {}) // needs a prior user gesture on the page
    const ac = ctx
    const out = ac.createGain()
    out.connect(ac.destination)
    const { every, bursts, volume } = PATTERNS[kind]
    const cycle = () => {
      const t0 = ac.currentTime + 0.05
      for (const b of bursts) {
        const g = ac.createGain()
        g.gain.setValueAtTime(0, t0 + b.at)
        g.gain.linearRampToValueAtTime(volume, t0 + b.at + 0.02) // short ramps avoid clicks
        g.gain.setValueAtTime(volume, t0 + b.at + b.dur - 0.02)
        g.gain.linearRampToValueAtTime(0, t0 + b.at + b.dur)
        g.connect(out)
        for (const f of b.freqs) {
          const o = ac.createOscillator()
          o.frequency.value = f
          o.connect(g)
          o.start(t0 + b.at)
          o.stop(t0 + b.at + b.dur)
        }
      }
    }
    cycle()
    const timer = setInterval(cycle, every * 1000)
    return () => { clearInterval(timer); out.disconnect() }
  } catch {
    return () => {}
  }
}
