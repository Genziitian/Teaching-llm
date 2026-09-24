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

type ThemeChoice = 'light' | 'dark' | 'black' | 'system'
type ResolvedTheme = 'light' | 'dark' | 'black'

interface ThemeContextValue {
  theme: ThemeChoice
  resolvedTheme: ResolvedTheme
  setTheme: (t: ThemeChoice) => void
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
  return choice === 'system' ? getSystemTheme() : choice
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

  const setTheme = useCallback((next: ThemeChoice) => {
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    const r = resolve(next)
    setThemeState(next)
    setResolvedTheme(r)
    applyResolved(r)
  }, [])

  // When on "system", follow live OS appearance changes.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const r = getSystemTheme()
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
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  // Safe fallback if a component renders outside the provider.
  if (!ctx) return { theme: 'system', resolvedTheme: 'light', setTheme: () => {} }
  return ctx
}
