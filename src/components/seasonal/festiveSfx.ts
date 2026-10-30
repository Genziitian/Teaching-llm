/**
 * Festival sounds, synthesised with Web Audio (no audio files to download).
 *
 * Browsers only allow sound after the visitor has interacted with the site.
 * If the page already had a click (normal when they navigated to the dashboard)
 * sound plays straight away; otherwise it starts from their first tap.
 * Sounds that can't play yet are skipped, never queued.
 */

export type FestiveSound = 'ignite' | 'launch' | 'boom' | 'crackle' | 'bell' | 'plop' | 'jingle' | 'chime' | 'twinkle'

const MUTE_KEY = 'festival-sound-muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let lastBoom = 0

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

export function setMuted(m: boolean) {
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch {}
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.42, ctx.currentTime, 0.05)
}

function ensure(): AudioContext | null {
  if (ctx) return ctx
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC() as AudioContext
  } catch {
    return null
  }
  master = ctx.createGain()
  master.gain.value = isMuted() ? 0 : 0.42
  // gentle limiter so overlapping fireworks never clip
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 6
  master.connect(comp)
  comp.connect(ctx.destination)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

/** Call from any tap/click: lets sound start if the browser was waiting for a gesture. */
export function unlockSound() {
  const c = ensure()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

function out(c: AudioContext, pan: number): AudioNode {
  if (!master) return c.destination
  if (!c.createStereoPanner) return master
  const p = c.createStereoPanner()
  p.pan.value = Math.max(-1, Math.min(1, pan))
  p.connect(master)
  return p
}

function tone(c: AudioContext, dest: AudioNode, o: { f: number; f2?: number; t?: number; dur: number; type?: OscillatorType; vol?: number; attack?: number }) {
  const st = c.currentTime + (o.t || 0)
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = o.type || 'sine'
  osc.frequency.setValueAtTime(o.f, st)
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, st + o.dur)
  g.gain.setValueAtTime(0.0001, st)
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, st + (o.attack ?? 0.008))
  g.gain.exponentialRampToValueAtTime(0.0001, st + o.dur)
  osc.connect(g)
  g.connect(dest)
  osc.start(st)
  osc.stop(st + o.dur + 0.05)
}

function noise(c: AudioContext, dest: AudioNode, o: { t?: number; dur: number; f: number; f2?: number; q?: number; vol?: number; type?: BiquadFilterType; attack?: number }) {
  if (!noiseBuf) return
  const st = c.currentTime + (o.t || 0)
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  const flt = c.createBiquadFilter()
  flt.type = o.type || 'bandpass'
  flt.Q.value = o.q ?? 1
  flt.frequency.setValueAtTime(o.f, st)
  if (o.f2) flt.frequency.exponentialRampToValueAtTime(o.f2, st + o.dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, st)
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, st + (o.attack ?? 0.01))
  g.gain.exponentialRampToValueAtTime(0.0001, st + o.dur)
  src.connect(flt)
  flt.connect(g)
  g.connect(dest)
  src.start(st, Math.random() * 1.5)
  src.stop(st + o.dur + 0.05)
}

/** A metal bell: a few inharmonic partials with long decays. */
function bell(c: AudioContext, dest: AudioNode, base: number, t = 0, vol = 0.22, dur = 2.6) {
  const partials = [1, 2.0, 2.76, 4.07, 5.4]
  partials.forEach((m, i) => tone(c, dest, { f: base * m, t, dur: dur / (1 + i * 0.45), vol: vol / (1 + i * 0.9), attack: 0.003 }))
}

/** x from 0 (left edge) to 1 (right edge): fireworks sound from where they burst. */
export function play(name: FestiveSound, x = 0.5) {
  if (isMuted()) return
  const c = ensure()
  if (!c || c.state !== 'running') return
  const dest = out(c, x * 2 - 1)
  try {
    switch (name) {
      case 'ignite': // match strike + the flame catching
        noise(c, dest, { dur: 0.18, f: 2500, f2: 5000, q: 1.2, vol: 0.35 })
        noise(c, dest, { t: 0.12, dur: 0.7, f: 300, f2: 900, q: 0.7, vol: 0.28, attack: 0.08 })
        tone(c, dest, { t: 0.12, f: 90, f2: 60, dur: 0.5, vol: 0.18, attack: 0.05 })
        break
      case 'launch': // rising whistle with a hiss
        tone(c, dest, { f: 700, f2: 2100, dur: 0.85, vol: 0.05, type: 'sine', attack: 0.05 })
        noise(c, dest, { dur: 0.75, f: 1500, f2: 4500, q: 2, vol: 0.06, attack: 0.05 })
        break
      case 'boom': { // deep thump + rumble, softer when many overlap
        const now = c.currentTime
        const v = now - lastBoom < 0.35 ? 0.55 : 1
        lastBoom = now
        tone(c, dest, { f: 110, f2: 38, dur: 0.9, vol: 0.55 * v, attack: 0.004 })
        noise(c, dest, { dur: 1.5, f: 900, f2: 120, q: 0.6, vol: 0.4 * v, type: 'lowpass', attack: 0.004 })
        noise(c, dest, { t: 0.05, dur: 0.5, f: 3000, q: 0.8, vol: 0.06 * v })
        break
      }
      case 'crackle': // glitter popping after a burst
        for (let i = 0; i < 16; i++) {
          noise(c, dest, { t: 0.35 + Math.random() * 1.1, dur: 0.035, f: 3000 + Math.random() * 4000, q: 3, vol: 0.12 + Math.random() * 0.1, attack: 0.002 })
        }
        break
      case 'bell': // temple bell (ghanti)
        bell(c, dest, 523, 0, 0.2, 3.2)
        bell(c, dest, 523, 1.1, 0.12, 2.6)
        break
      case 'plop': // a diya set gently on water
        tone(c, dest, { f: 420, f2: 140, dur: 0.22, vol: 0.28, attack: 0.004 })
        noise(c, dest, { t: 0.04, dur: 0.35, f: 1200, f2: 400, q: 1.5, vol: 0.08 })
        break
      case 'jingle': // sleigh bells
        for (let i = 0; i < 9; i++) {
          const t = i * 0.085 + (i % 3 === 2 ? 0.05 : 0)
          noise(c, dest, { t, dur: 0.22, f: 7000 + (i % 3) * 900, q: 9, vol: 0.18, attack: 0.002 })
          tone(c, dest, { t, f: 3150 + (i % 2) * 420, dur: 0.18, vol: 0.03, type: 'triangle', attack: 0.002 })
        }
        break
      case 'chime': // bright rising arpeggio
        ;[784, 988, 1175, 1568].forEach((f, i) => bell(c, dest, f, i * 0.11, 0.09, 1.6))
        break
      case 'twinkle':
        bell(c, dest, 1568 + Math.random() * 600, 0, 0.05, 0.9)
        break
    }
  } catch {}
}
