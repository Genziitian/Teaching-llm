'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Volume2, VolumeX, X } from 'lucide-react';

/**
 * Quiz Lab launch announcement.
 *  1) First visit: a clean announcement card over a dimmed page.
 *  2) Every visit after: a small "Quiz Lab" pill in the bottom-right corner that opens a mini card.
 * Self-contained: plain CSS + React state, no extra libraries.
 * To see the announcement again: localStorage.removeItem('quizlab-launch-seen-v1')
 */

const STORAGE_KEY = 'quizlab-launch-seen-v1';
const SOUND_KEY = 'quizlab-launch-sound-v1';
const QUIZ_URL = 'https://quiz.genziitian.in/';
const LOGO_SRC = '/landing-assets/quiz-lab-logo.webp';

const cv = (o: Record<string, string | number>) => o as React.CSSProperties;

const readSeen = () => {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
};
const writeSeen = () => {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* storage unavailable */ }
};
const prefersReduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Sound: one soft chime on open, one tick on close (Web Audio, no files).
 * Browsers only allow audio after the user has interacted with the page,
 * so on a brand-new visit it stays silent until the first tap/key press. */
/* ------------------------------------------------------------------ */
let actx: AudioContext | null = null;
let outNode: GainNode | null = null;
let gestureSeen = false;
let unlockBound = false;

const soundOn = () => {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
};
const setSoundOn = (on: boolean) => {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
};

const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined' || !soundOn()) return null;
  const activated = gestureSeen || !!(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
  if (!activated) return null;
  try {
    if (!actx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      outNode = actx.createGain();
      outNode.gain.value = 0.7;
      outNode.connect(actx.destination);
    }
    if (actx.state === 'suspended') void actx.resume().catch(() => undefined);
    return actx.state === 'running' ? actx : null;
  } catch { return null; }
};

const bindAudioUnlock = () => {
  if (unlockBound || typeof window === 'undefined') return;
  unlockBound = true;
  const unlock = () => { gestureSeen = true; getCtx(); };
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true, passive: true });
};

const tone = (c: AudioContext, f: number, t: number, d: number, v: number) => {
  const osc = c.createOscillator(); const g = c.createGain(); const at = c.currentTime + t;
  osc.type = 'sine'; osc.frequency.setValueAtTime(f, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(v, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + d);
  osc.connect(g); g.connect(outNode!);
  osc.start(at); osc.stop(at + d + 0.03);
};
const sfx = {
  chime: (delay = 0) => { try { const c = getCtx(); if (c) { tone(c, 659, delay, 0.55, 0.1); tone(c, 880, delay + 0.11, 0.8, 0.09); } } catch { /* optional */ } },
  tick: (delay = 0) => { try { const c = getCtx(); if (c) tone(c, 740, delay, 0.07, 0.08); } catch { /* optional */ } },
};

/* ------------------------------------------------------------------ */
/* Announcement card                                                   */
/* ------------------------------------------------------------------ */
const FEATURES = ['Topic-wise quizzes', 'Instant results', 'Track your progress'];

function Announcement({ onClose, reduced, cornerRef }: {
  onClose: () => void; reduced: boolean; cornerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [closing, setClosing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundOn());
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const closingRef = useRef(false);
  const timer = useRef<number>(0);

  /* lock page scroll while open */
  useEffect(() => {
    const body = document.body; const html = document.documentElement;
    const prev = { bo: body.style.overflow, ho: html.style.overflow, pr: body.style.paddingRight };
    const sb = window.innerWidth - html.clientWidth;
    body.style.overflow = 'hidden'; html.style.overflow = 'hidden';
    if (sb > 0) body.style.paddingRight = `${sb}px`;
    return () => { body.style.overflow = prev.bo; html.style.overflow = prev.ho; body.style.paddingRight = prev.pr; };
  }, []);

  useEffect(() => { bindAudioUnlock(); if (!reduced) sfx.chime(0.12); }, [reduced]);
  useEffect(() => { ctaRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    writeSeen();
    if (reduced) { onClose(); return; }
    const card = cardRef.current; const corner = cornerRef.current;
    if (card && corner) {
      const a = card.getBoundingClientRect(); const b = corner.getBoundingClientRect();
      card.style.setProperty('--tx', `${b.left + b.width / 2 - (a.left + a.width / 2)}px`);
      card.style.setProperty('--ty', `${b.top + b.height / 2 - (a.top + a.height / 2)}px`);
    }
    sfx.tick();
    setClosing(true);
    timer.current = window.setTimeout(onClose, 300);
  }, [onClose, reduced, cornerRef]);

  /* Escape + focus trap */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const root = rootRef.current; if (!root) return;
      const list = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'))
        .filter(el => el.getClientRects().length > 0);
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0]; const last = list[list.length - 1]; const act = document.activeElement as HTMLElement | null;
      if (!act || !root.contains(act)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && act === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundOn(next); setSoundEnabled(next);
    if (next) sfx.tick();
  };

  return (
    <div ref={rootRef} className={`qll-backdrop ${closing ? 'is-closing' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div ref={cardRef} className="qll-card" role="dialog" aria-modal="true" aria-labelledby="qll-title">
        <div className="qll-top">
          <span className="qll-tag">New launch</span>
          <div className="qll-tools">
            <button type="button" className="qll-icon" aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'} aria-pressed={!soundEnabled} onClick={toggleSound}>
              {soundEnabled ? <Volume2 strokeWidth={2.2} /> : <VolumeX strokeWidth={2.2} />}
            </button>
            <button type="button" className="qll-icon" aria-label="Close" onClick={close}><X strokeWidth={2.4} /></button>
          </div>
        </div>

        <img className="qll-logo" src={LOGO_SRC} alt="Quiz Lab logo" width={84} height={84} />
        <h2 id="qll-title" className="qll-title">Introducing Quiz Lab</h2>
        <p className="qll-sub">Practice quizzes to test what you&apos;ve learned.</p>

        <ul className="qll-list">
          {FEATURES.map((f, i) => (
            <li key={f} style={cv({ '--i': i })}><Check strokeWidth={3} aria-hidden="true" />{f}</li>
          ))}
        </ul>

        <a ref={ctaRef} className="qll-cta" href={QUIZ_URL} onClick={() => writeSeen()}>Try Quiz Lab →</a>
        <button type="button" className="qll-later" onClick={close}>Maybe later</button>
        <p className="qll-by">by <b>Gen-Z</b> <em>IITian</em></p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Corner pill                                                         */
/* ------------------------------------------------------------------ */
function Corner({ hidden, boxRef }: { hidden: boolean; boxRef: React.RefObject<HTMLDivElement | null> }) {
  const [cardOpen, setCardOpen] = useState(false);
  const [bottom, setBottom] = useState(0);

  // sit just above the floating 1:1 pill (or the mobile tab bar) if present
  useEffect(() => {
    const measure = () => {
      const pill = document.querySelector('aside[aria-label="1:1 Personalised Batch"]') as HTMLElement | null;
      if (!pill) { setBottom(0); return; }
      const r = pill.getBoundingClientRect();
      if (!r.width || !r.height) { setBottom(0); return; }
      setBottom(Math.max(0, Math.round(window.innerHeight - r.top + 12)));
    };
    measure();
    const id = window.setInterval(measure, 800);
    window.addEventListener('resize', measure);
    return () => { window.clearInterval(id); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => { if (hidden) setCardOpen(false); }, [hidden]);
  useEffect(() => {
    if (!cardOpen) return;
    const down = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) setCardOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setCardOpen(false); };
    document.addEventListener('pointerdown', down); window.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, [cardOpen, boxRef]);

  return (
    <div ref={boxRef} className={`qll-corner ${hidden ? 'is-hidden' : 'qll-enter'}`} style={cv({ '--qll-bot': `${bottom}px` })}>
      {cardOpen && (
        <div className="qll-pop" role="group" aria-label="Quiz Lab">
          <button type="button" className="qll-pop-x" aria-label="Close" onClick={() => setCardOpen(false)}><X strokeWidth={2.6} /></button>
          <div className="qll-pop-top">
            <img src={LOGO_SRC} alt="" width={44} height={44} />
            <div>
              <div className="qll-pop-name"><b>Quiz Lab</b><span className="qll-new">NEW</span></div>
              <small>by Gen-Z <em>IITian</em></small>
            </div>
          </div>
          <p>Practice quizzes to test what you&apos;ve learned.</p>
          <a className="qll-pop-cta" href={QUIZ_URL}>Try Quiz Lab →</a>
        </div>
      )}
      <button type="button" className="qll-pill" aria-expanded={cardOpen} aria-label="Quiz Lab, new" onClick={() => setCardOpen(o => !o)}>
        <img src={LOGO_SRC} alt="" width={30} height={30} />
        <span>Quiz Lab</span>
        <span className="qll-new">NEW</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */
export default function QuizLabLaunch() {
  const reduced = useMemo(() => prefersReduced(), []);
  const [open, setOpen] = useState<boolean>(() => !readSeen());
  const cornerRef = useRef<HTMLDivElement | null>(null);
  const handleClose = useCallback(() => setOpen(false), []);
  useEffect(() => { bindAudioUnlock(); }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <style>{CSS}</style>
      <Corner hidden={open} boxRef={cornerRef} />
      {open && <Announcement onClose={handleClose} reduced={reduced} cornerRef={cornerRef} />}
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const CSS = `
.qll-backdrop,.qll-backdrop *,.qll-corner,.qll-corner *{box-sizing:border-box}
.qll-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;
  background:rgba(11,17,32,.66);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:inherit;overscroll-behavior:contain;
  -webkit-tap-highlight-color:transparent;animation:qll-fade .2s ease both}
.qll-backdrop.is-closing{animation:qll-bd-out .3s ease forwards}
@keyframes qll-fade{from{opacity:0}}
@keyframes qll-bd-out{to{opacity:0}}

.qll-card{position:relative;width:100%;max-width:440px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;overscroll-behavior:contain;
  background:#fff;color:#0b1120;border:3px solid #0b1120;border-radius:24px;box-shadow:8px 8px 0 #10b981;padding:18px 24px 20px;text-align:center;
  animation:qll-in .34s cubic-bezier(.2,.8,.2,1) both}
@keyframes qll-in{from{opacity:0;transform:translateY(16px) scale(.97)}}
.qll-backdrop.is-closing .qll-card{animation:qll-out .3s cubic-bezier(.5,0,.8,.4) forwards}
@keyframes qll-out{to{opacity:0;transform:translate(var(--tx,0),var(--ty,0)) scale(.1)}}

.qll-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.qll-tag{padding:4px 10px;border-radius:999px;background:#ecfdf5;color:#047857;border:1.5px solid #a7f3d0;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
.qll-tools{display:flex;gap:4px}
.qll-icon{all:unset;box-sizing:border-box;width:36px;height:36px;display:grid;place-items:center;border-radius:50%;cursor:pointer;color:#6b7280}
.qll-icon:hover{background:#f3f4f6;color:#0b1120}
.qll-icon svg{width:19px;height:19px}
.qll-icon:focus-visible,.qll-later:focus-visible,.qll-pop-x:focus-visible,.qll-pill:focus-visible{outline:3px solid #10b981;outline-offset:2px}

.qll-logo{display:block;width:84px;height:84px;margin:6px auto 14px;border-radius:20px;object-fit:cover;border:2px solid #0b1120;box-shadow:3px 3px 0 #0b1120;
  animation:qll-pop .4s cubic-bezier(.2,1.2,.4,1) .08s both}
@keyframes qll-pop{from{opacity:0;transform:scale(.86)}}
.qll-title{margin:0;font-size:clamp(1.5rem,6vw,1.85rem);font-weight:900;line-height:1.15;letter-spacing:-.02em;color:#0b1120}
.qll-sub{margin:8px 0 0;font-size:15px;font-weight:600;line-height:1.45;color:#4b5563}
.qll-list{list-style:none;margin:18px 0 20px;padding:14px 16px;border-radius:16px;background:#f8fafc;border:1.5px solid #e5e7eb;display:flex;flex-direction:column;gap:9px;text-align:left}
.qll-list li{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700;color:#1f2937;animation:qll-up .3s ease both;animation-delay:calc(var(--i)*.05s + .14s)}
.qll-list svg{width:18px;height:18px;padding:3px;border-radius:50%;background:#10b981;color:#fff;flex:none}
@keyframes qll-up{from{opacity:0;transform:translateY(8px)}}

.qll-cta{display:block;width:100%;padding:.85em 1em;border-radius:14px;background:#10b981;color:#052e1f;border:2px solid #0b1120;box-shadow:3px 3px 0 #0b1120;
  font-size:16px;font-weight:900;text-decoration:none;text-align:center;transition:transform .12s ease,box-shadow .12s ease}
.qll-cta:hover{background:#34d399;transform:translate(-1px,-1px);box-shadow:4px 4px 0 #0b1120}
.qll-cta:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #0b1120}
.qll-cta:focus-visible{outline:3px solid #0b1120;outline-offset:3px}
.qll-later{all:unset;box-sizing:border-box;display:block;margin:8px auto 0;padding:.6em 1.2em;cursor:pointer;font-size:14px;font-weight:700;color:#6b7280;border-radius:999px}
.qll-later:hover{color:#0b1120;text-decoration:underline}
.qll-by{margin:6px 0 0;font-size:12px;font-weight:700;color:#6b7280}
.qll-by b{color:#0b1120;font-weight:900}.qll-by em{font-style:normal;color:#ef4444;font-weight:900}
@media (max-height:560px){.qll-list{display:none}.qll-logo{width:64px;height:64px;margin-bottom:10px}}

/* corner pill */
.qll-corner{--qll-def-bot:24px;position:fixed;z-index:160;right:calc(16px + env(safe-area-inset-right,0px));bottom:max(var(--qll-def-bot),var(--qll-bot,0px))}
@media (min-width:640px){.qll-corner{right:calc(24px + env(safe-area-inset-right,0px))}}
@media (max-width:767px){.qll-corner{--qll-def-bot:calc(env(safe-area-inset-bottom,0px) + 88px)}}
.qll-corner.is-hidden{visibility:hidden;pointer-events:none}
.qll-corner.qll-enter{animation:qll-corner-in .35s cubic-bezier(.2,.8,.2,1) .3s backwards}
@keyframes qll-corner-in{from{opacity:0;transform:translateY(10px)}}
.qll-pill{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;padding:5px 12px 5px 5px;border-radius:999px;cursor:pointer;
  background:#0b1120;color:#fff;border:2px solid #0b1120;box-shadow:0 6px 18px rgba(11,17,32,.22);font-family:inherit;font-size:13px;font-weight:800;white-space:nowrap;transition:background .15s ease,transform .15s ease}
.qll-pill:hover{background:#18233f;transform:translateY(-1px)}
.qll-pill img{width:30px;height:30px;border-radius:50%;object-fit:cover;display:block}
.qll-new{padding:2px 6px;border-radius:999px;background:#10b981;color:#052e1f;font-size:9px;font-weight:900;letter-spacing:.06em}
.qll-pop{position:absolute;right:0;bottom:calc(100% + 12px);width:min(300px,calc(100vw - 32px));padding:16px;border-radius:18px;background:#fff;color:#0b1120;
  border:3px solid #0b1120;box-shadow:5px 5px 0 #10b981;text-align:left;transform-origin:90% 100%;animation:qll-pop-in .22s cubic-bezier(.2,.8,.2,1) both}
@keyframes qll-pop-in{from{opacity:0;transform:translateY(8px) scale(.96)}}
.qll-pop-top{display:flex;align-items:center;gap:10px;padding-right:24px}
.qll-pop-top img{width:44px;height:44px;border-radius:12px;object-fit:cover;border:2px solid #0b1120;flex:none}
.qll-pop-name{display:flex;align-items:center;gap:8px}
.qll-pop-name b{font-size:16px;font-weight:900}
.qll-pop-top small{display:block;margin-top:2px;font-size:11px;font-weight:800;color:#6b7280}.qll-pop-top em{font-style:normal;color:#ef4444}
.qll-pop p{margin:10px 0 12px;font-size:13.5px;line-height:1.4;font-weight:600;color:#4b5563}
.qll-pop-cta{display:block;text-align:center;padding:.7em 1em;border-radius:12px;background:#10b981;color:#052e1f;border:2px solid #0b1120;box-shadow:3px 3px 0 #0b1120;font-weight:900;font-size:14px;text-decoration:none}
.qll-pop-cta:hover{background:#34d399}.qll-pop-cta:focus-visible{outline:3px solid #0b1120;outline-offset:2px}
.qll-pop-x{all:unset;box-sizing:border-box;position:absolute;top:10px;right:10px;width:26px;height:26px;display:grid;place-items:center;cursor:pointer;border-radius:50%;color:#6b7280}
.qll-pop-x:hover{background:#f3f4f6;color:#0b1120}.qll-pop-x svg{width:15px;height:15px}

@media (prefers-reduced-motion:reduce){
  .qll-backdrop,.qll-backdrop *,.qll-corner,.qll-corner *{animation:none!important;transition:none!important}
}
`;
