'use client'

/**
 * Theme provider — drives light/dark/system mode for the whole app.
 *
 * How it works:
 *   • The user's choice ('light' | 'dark' | 'system') is stored in localStorage.
 *   • The resolved value ('light' | 'dark') is written to <html data-theme="...">,
 *     which globals.css uses to swap the CSS-variable palette.
 *   • An inline script in src/app/layout.tsx <head> sets data-theme BEFORE first
 *     paint (anti-FOUC), so this provider only reconciles + wires up listeners.
 *   • On change we also update <meta name="theme-color"> (browser/PWA chrome) and
 *     dispatch a 'themechange' event so CapacitorBridge can re-skin the native
 *     Android status bar.
 *
 * No external dependency (no next-themes) — keeps the supply-chain surface small.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

type ThemeChoice = 'light' | 'dark' | 'black' | 'system'
type ResolvedTheme = 'light' | 'dark' | 'black'

interface ThemeContextValue {
  theme: ThemeChoice
  resolvedTheme: ResolvedTheme
  /** `origin` (viewport px) makes the change flow out from that point like a water ripple (web only). */
  setTheme: (t: ThemeChoice, origin?: { x: number; y: number }) => void
  /** true while the light theme is switched off (winter season); pickers hide "Light" */
  lightHidden: boolean
}

/**
 * Winter season: the light theme is off until this date (inclusive, visitor's local date).
 * Anyone on Light (or System while their device is light) sees Black instead. Their saved
 * choice is kept, so it comes back by itself afterwards. Keep in sync with layout.tsx.
 */
export const LIGHT_HIDDEN_UNTIL = 20000101 // YYYYMMDD — redesign branch: Light is on (was 20261231)

export function isLightHidden(d = new Date()): boolean {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() <= LIGHT_HIDDEN_UNTIL
}

const STORAGE_KEY = 'theme'

/** Status-bar / browser-chrome colors per resolved theme. Keep in sync with the
 *  inline script in layout.tsx and the dark/black `--sidebar-bg` in globals.css. */
const CHROME_COLOR: Record<ResolvedTheme, string> = {
  light: '#e8eaf0',
  dark: '#161a23',
  black: '#000000',
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function normalize(v: string | null): ThemeChoice {
  return v === 'light' || v === 'dark' || v === 'black' || v === 'system' ? v : 'system'
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  const r = choice === 'system' ? getSystemTheme() : choice
  return r === 'light' && isLightHidden() ? 'black' : r
}

/** Push the resolved theme to the DOM, browser chrome, and native shell. */
function applyResolved(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  root.style.colorScheme = (resolved === 'dark' || resolved === 'black') ? 'dark' : 'light'

  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', CHROME_COLOR[resolved])

  // Let the native bridge (Capacitor) re-apply the status bar style/color.
  window.dispatchEvent(new CustomEvent('themechange', { detail: resolved }))
}


/** Water-ripple reveal: the new theme flows out from `origin` instead of flipping at once.
 *  Web only — skipped in the native app shell, with reduced motion, or without View Transitions. */
function rippleSupported(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  if ((window as any).Capacitor?.isNativePlatform?.()) return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return typeof (document as any).startViewTransition === 'function'
}

function runRipple(origin: { x: number; y: number }, update: () => void) {
  const { x, y } = origin
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const DURATION = 1100
  const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)'

  // Soft concentric rings that travel with the wavefront (the "water" part).
  ;[0, 140].forEach((delay, i) => {
    const ring = document.createElement('div')
    ring.setAttribute('aria-hidden', 'true')
    ring.style.cssText =
      `position:fixed;left:${x}px;top:${y}px;width:${radius * 2}px;height:${radius * 2}px;margin:${-radius}px 0 0 ${-radius}px;` +
      `border-radius:50%;pointer-events:none;z-index:2147483646;border:${i ? 1 : 2}px solid currentColor;` +
      `color:rgba(128,128,128,${i ? 0.25 : 0.4});opacity:0;transform:scale(0);`
    document.body.appendChild(ring)
    const a = ring.animate(
      [
        { transform: 'scale(0)', opacity: 0.9 },
        { opacity: 0.5, offset: 0.6 },
        { transform: 'scale(1)', opacity: 0 },
      ],
      { duration: DURATION, delay, easing: EASE, fill: 'forwards' },
    )
    a.onfinish = () => ring.remove()
  })

  const vt = (document as any).startViewTransition(() => { flushSync(update) })
  vt.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: DURATION, easing: EASE, pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => {})
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Defaults match SSR; the real values are read from storage on mount below.
  const [theme, setThemeState] = useState<ThemeChoice>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  // Hydrate from storage. The inline <head> script already set data-theme before
  // paint, so this just syncs React state (and reconciles, which is harmless).
  useEffect(() => {
    let stored: ThemeChoice = 'system'
    try { stored = normalize(localStorage.getItem(STORAGE_KEY)) } catch {}
    const r = resolve(stored)
    setThemeState(stored)
    setResolvedTheme(r)
    applyResolved(r)
  }, [])

  const setTheme = useCallback((next: ThemeChoice, origin?: { x: number; y: number }) => {
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    const r = resolve(next)
    const apply = () => {
      setThemeState(next)
      setResolvedTheme(r)
      applyResolved(r)
    }
    if (origin && rippleSupported()) runRipple(origin, apply)
    else apply()
  }, [])

  // When on "system", follow live OS appearance changes.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const r = resolve('system')
      setResolvedTheme(r)
      applyResolved(r)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  // Cross-tab sync: another tab changed the preference.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const v = normalize(e.newValue)
      const r = resolve(v)
      setThemeState(v)
      setResolvedTheme(r)
      applyResolved(r)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, lightHidden: isLightHidden() }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  // Safe fallback if a component renders outside the provider.
  if (!ctx) return { theme: 'system', resolvedTheme: 'light', setTheme: () => {}, lightHidden: false }
  return ctx
}
