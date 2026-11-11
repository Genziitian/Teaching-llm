'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useLocalCachedAsset } from '@/hooks/useLocalCachedAsset'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

export default function SplashOverlay() {
  const [mounted, setMounted] = useState(false)
  const [showLoader, setShowLoader] = useState(true)
  const [promoVisible, setPromoVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isNative, setIsNative] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [promo, setPromo] = useState({
    image: '/splash-screen.png',
    durationMs: 2500,
  })
  const pathname = usePathname()

  const hasHiddenRef = useRef(false)
  const claimedPagesRef = useRef(new Set<string>())
  const logoSrc = useLocalCachedAsset('/mobile-login-logo.png')
  const fact = useLoadingFact(showLoader)

  // Avoid hydration mismatch by waiting until client mount
  useEffect(() => {
    setMounted(true)
    const w = window as any
    setIsNative(!!(w?.Capacitor?.isNativePlatform?.() || w?.Capacitor?.isNative))
  }, [])

  // Safely check image loading completion (including cache hits)
  useEffect(() => {
    if (!mounted) return
    const img = new Image()
    img.src = logoSrc
    if (img.complete) {
      setImageLoaded(true)
    } else {
      img.onload = () => setImageLoaded(true)
      img.onerror = () => setImageLoaded(true) // Proceed if load fails to prevent freeze
    }
  }, [mounted, logoSrc])

  // Failsafe timer: Force loading state to true after 5 seconds to prevent app lockups
  useEffect(() => {
    if (!mounted) return
    const timer = setTimeout(() => {
      console.warn('[SplashOverlay] Failsafe timer reached. Forcing imageLoaded state.')
      setImageLoaded(true)
    }, 5000)

    return () => clearTimeout(timer)
  }, [mounted])

  // Synchronized Handoff: Dismiss native splash screen once React first frame is painted
  useEffect(() => {
    if (!mounted || !imageLoaded) return
    if (!isNative) return

    if (hasHiddenRef.current) return
    hasHiddenRef.current = true

    // Double requestAnimationFrame ensures that the React DOM elements (logo + loader)
    // are fully layouted and painted to the Chromium view buffer before dismissing the native dialog.
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        try {
          const { SplashScreen } = await import('@capacitor/splash-screen')
          await SplashScreen.hide({ fadeOutDuration: 400 })
          console.log('[SplashOverlay] Native splash screen dismissed successfully.')
        } catch (err) {
          console.warn('[SplashOverlay] Failed to dismiss native splash screen:', err)
        }
      })
    })
  }, [mounted, imageLoaded, isNative])

  // Keep the same branded loading screen visible for the full splash duration.
  useEffect(() => {
    if (!mounted) return

    const startTime = Date.now()
    const duration = 1500

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const percent = Math.min((elapsed / duration) * 100, 100)
      setProgress(percent)

      if (percent >= 100) {
        clearInterval(interval)
        setShowLoader(false)
      }
    }, 30)

    return () => clearInterval(interval)
  }, [mounted])

  useEffect(() => {
    if (!mounted || showLoader || !pathname || claimedPagesRef.current.has(pathname)) return
    claimedPagesRef.current.add(pathname)
    const controller = new AbortController()
    fetch('/api/promo-splash/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: pathname }),
      signal: controller.signal,
    })
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        if (!result?.eligible || !result.image) return
        const durationMs = Math.min(10000, Math.max(1000, Number(result.durationMs) || 2500))
        setPromo({ image: result.image, durationMs })
        setPromoVisible(true)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [mounted, pathname, showLoader])

  useEffect(() => {
    if (!promoVisible) return
    const timer = window.setTimeout(() => setPromoVisible(false), promo.durationMs)
    return () => window.clearTimeout(timer)
  }, [promoVisible, promo.durationMs])

  if (!mounted || (!showLoader && !promoVisible)) return null

  return (
    <div className="gz-splash" role="presentation">
      {showLoader ? (
        <div className="gz-splash__card">
          {/* GenZ IITIAN logo */}
          <img
            src={logoSrc}
            alt="GenZ IITIAN"
            onLoad={() => setImageLoaded(true)}
            className="gz-splash__logo"
          />

          {/* Progress */}
          <div className="gz-splash__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
            <div className="gz-splash__fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="gz-splash__status">
            <span>Loading</span>
            <span>{Math.round(progress)}%</span>
          </div>

          {fact && (
            <div className="gz-splash__fact">
              <LoadingFactCard fact={fact} />
            </div>
          )}
        </div>
      ) : (
        <img
          src={promo.image}
          alt="GenZ IITian promotion"
          style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'var(--gz-splash-bg)' }}
        />
      )}

      <style>{`
        .gz-splash {
          --gz-splash-bg: #ececea; --gz-splash-card: #fbfbfa; --gz-splash-line: #e7e7e3;
          --gz-splash-ink: #171717; --gz-splash-ink3: #6b6b68; --gz-splash-ink4: #8a8a86; --gz-splash-track: #e7e7e3;
          position: fixed; inset: 0; z-index: 999999; background: var(--gz-splash-bg);
          display: flex; align-items: center; justify-content: center; padding: 16px; user-select: none;
          font-family: 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--gz-splash-ink);
        }
        :root[data-theme="dark"] .gz-splash {
          --gz-splash-bg: #0c0c0d; --gz-splash-card: #151517; --gz-splash-line: #26262a;
          --gz-splash-ink: #ededeb; --gz-splash-ink3: #a1a19c; --gz-splash-ink4: #77777a; --gz-splash-track: #26262a;
        }
        :root[data-theme="black"] .gz-splash {
          --gz-splash-bg: #000; --gz-splash-card: #0a0a0a; --gz-splash-line: #1e1e1e;
          --gz-splash-ink: #f2f2f0; --gz-splash-ink3: #a1a19c; --gz-splash-ink4: #77777a; --gz-splash-track: #1e1e1e;
        }
        .gz-splash__card {
          width: 100%; max-width: 400px; background: var(--gz-splash-card); border: 1px solid var(--gz-splash-line);
          border-radius: 18px; padding: 32px 28px 24px; display: flex; flex-direction: column; align-items: center;
          animation: splashFadeIn .3s ease-out;
        }
        .gz-splash__logo { width: 150px; height: auto; margin-bottom: 28px; }
        :root[data-theme="dark"] .gz-splash__logo, :root[data-theme="black"] .gz-splash__logo { filter: invert(1) hue-rotate(180deg); }
        .gz-splash__bar { width: 100%; height: 4px; border-radius: 999px; background: var(--gz-splash-track); overflow: hidden; }
        .gz-splash__fill { height: 100%; background: var(--gz-splash-ink); border-radius: 999px; transition: width .1s linear; }
        .gz-splash__status {
          width: 100%; display: flex; justify-content: space-between; margin-top: 10px;
          font-family: 'Geist Mono', ui-monospace, monospace; font-size: 10.5px; letter-spacing: .06em;
          text-transform: uppercase; color: var(--gz-splash-ink4);
        }
        .gz-splash__fact { width: 100%; margin-top: 22px; }
        @keyframes splashFadeIn { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .gz-splash__card { animation: none; } .gz-splash__fill { transition: none; } }
      `}</style>
    </div>
  )
}
