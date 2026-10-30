'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { isSeasonalRouteBlocked, readPrefs, readSnowPref, realToday, snowAmount, SNOW_HINT_KEY, writePrefs, writeSnowPref } from '@/lib/seasonal/seasons'
import { useSeasonalTick } from './useSeasonalTick'
import type { SnowEngine } from './snow/SnowEngine'
import styles from './SeasonalEffects.module.css'

/**
 * Winter snow for the whole site, plus its on/off button.
 * Mounted once in the root layout. The snow code itself is only downloaded
 * on days with snow, after the page has finished loading.
 */

const CAP_SELECTOR = [
  '[data-snow]',
  '.card',
  '.stat-card',
  '.metric-card',
  '.lecture-card',
  '.home-hero-slider',
  '.dashboard-video-box',
  '.qls-card',
  '.store-mine-card',
].join(', ')
const TEXT_CAP_SELECTOR = '[data-snow="text"], .stat-card-value'
const EXCLUDE_SELECTOR = [
  '[data-no-snow]',
  '.modal',
  '.modal-overlay',
  '[role="dialog"]',
  '[aria-modal="true"]',
  '.skeleton',
  'form',
  '.sidebar',
  '.mobile-bottom-nav',
].join(', ')

type IdleHandle = number
const w = () => window as any
const onIdle = (cb: () => void): IdleHandle =>
  typeof w().requestIdleCallback === 'function' ? w().requestIdleCallback(cb, { timeout: 2500 }) : window.setTimeout(cb, 700)
const cancelIdle = (h: IdleHandle) =>
  typeof w().cancelIdleCallback === 'function' ? w().cancelIdleCallback(h) : window.clearTimeout(h)

export default function SeasonalEffects() {
  const pathname = usePathname() || '/'
  const [amount, setAmount] = useState(0)
  const [snowOn, setSnowOn] = useState(false)
  const [ready, setReady] = useState(false)
  const [hint, setHint] = useState<'hidden' | 'show' | 'leaving'>('hidden')
  const [touch, setTouch] = useState(false)
  const [pop, setPop] = useState(0)
  const [previewDate, setPreviewDate] = useState<string | null>(null)
  const engineRef = useRef<SnowEngine | null>(null)
  const firstRun = useRef(true)
  const tick = useSeasonalTick()

  useEffect(() => {
    const p = readPrefs().date
    setPreviewDate(p && p !== realToday() ? p : null)
    const a = snowAmount()
    setAmount(a)
    if (a <= 0) { setReady(false); return }
    const pref = readSnowPref()
    const forced = new URLSearchParams(window.location.search).get('snow') === '1'
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setSnowOn(forced || pref === 'on' || (pref !== 'off' && !reduce))
    setTouch(window.matchMedia('(pointer: coarse)').matches)
    setReady(true)
  }, [tick])

  const blocked = isSeasonalRouteBlocked(pathname)
  const active = ready && snowOn && !blocked && amount > 0

  const dismissHint = useCallback(() => {
    setHint(h => (h === 'show' ? 'leaving' : h))
    try { localStorage.setItem(SNOW_HINT_KEY, '1') } catch {}
    window.setTimeout(() => setHint('hidden'), 350)
  }, [])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const startMode = firstRun.current ? 'scattered' : 'fromTop'
    const handle = onIdle(() => {
      import('./snow/SnowEngine')
        .then(({ SnowEngine }) => {
          if (cancelled) return
          firstRun.current = false
          const engine = new SnowEngine({
            amount,
            capSelector: CAP_SELECTOR,
            textCapSelector: TEXT_CAP_SELECTOR,
            excludeSelector: EXCLUDE_SELECTOR,
            startMode,
            onFirstDust: dismissHint,
          })
          engineRef.current = engine
          engine.start()
        })
        .catch(() => {})
    })
    return () => {
      cancelled = true
      cancelIdle(handle)
      engineRef.current?.stop()
      engineRef.current = null
    }
  }, [active, amount, dismissHint])

  // First winter visit: a small hint about the duster, once.
  useEffect(() => {
    if (!active) return
    let seen = false
    try { seen = localStorage.getItem(SNOW_HINT_KEY) === '1' } catch {}
    if (seen) return
    const show = window.setTimeout(() => setHint('show'), 7000)
    const hide = window.setTimeout(() => dismissHint(), 7000 + 9000)
    return () => { window.clearTimeout(show); window.clearTimeout(hide) }
  }, [active, dismissHint])

  const toggle = () => {
    const next = !snowOn
    setSnowOn(next)
    setPop(p => p + 1)
    writeSnowPref(next)
    if (!next) dismissHint()
  }

  const pill = previewDate && !blocked ? (
    <div className={styles.preview} role="status" data-no-snow>
      <span className={styles.previewDot} />
      Previewing {new Date(previewDate + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
      <button type="button" onClick={() => writePrefs({ date: undefined })}>Back to today</button>
    </div>
  ) : null

  if (!ready || blocked) return pill

  return (
    <>
      {pill}
      <button
        type="button"
        className={`${styles.toggle} ${snowOn ? '' : styles.off}`}
        onClick={toggle}
        aria-pressed={snowOn}
        aria-label={snowOn ? 'Turn snow off' : 'Turn snow on'}
        data-no-snow
      >
        <span className={styles.mound} aria-hidden="true" />
        <svg key={pop} className={`${styles.icon} ${pop ? styles.pop : ''}`} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5" />
            <path d="M9.6 4.2 12 6.3l2.4-2.1M9.6 19.8 12 17.7l2.4 2.1M4.3 10.2l3.1.9-.7-3.1M19.7 13.8l-3.1-.9.7 3.1M4.3 13.8l3.1-.9-.7 3.1M19.7 10.2l-3.1.9.7-3.1" />
          </g>
        </svg>
        <svg className={styles.slash} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M4 20 20 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className={styles.label}>{snowOn ? 'Snow on' : 'Snow off'}</span>
      </button>

      {hint !== 'hidden' && (
        <div className={`${styles.hint} ${hint === 'leaving' ? styles.hintOut : ''}`} role="status" data-no-snow>
          <svg className={styles.hintIcon} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M4 20 13 11" stroke="#a16207" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M12.5 11.5c-1-3 1-7.5 6-8.5-1 5-5.5 7-6 8.5Z" fill="#f2cdb6" />
            <path d="M12.5 11.5c3 1 7.5-1 8.5-6-5 1-7 5.5-8.5 6Z" fill="#e9ae94" />
            <path d="M12.5 11.5c-.5-2.5 2-6 4.5-7M12.5 11.5c2.5.5 6-2 7-4.5" stroke="#b9775f" strokeWidth=".8" fill="none" />
          </svg>
          <span>{touch ? 'Swipe across the snow on a card to brush it off.' : 'Sweep your mouse over the snow on a card to dust it off.'}</span>
          <button type="button" className={styles.hintClose} onClick={dismissHint} aria-label="Close">×</button>
        </div>
      )}
    </>
  )
}
