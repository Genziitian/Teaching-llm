'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocalCachedAsset } from '@/hooks/useLocalCachedAsset'

function getSafeRedirect(next: string | null): string {
  if (!next) return '/dashboard'
  // Reject null bytes (some browsers handle %00 in unexpected ways)
  if (next.includes('\0')) return '/dashboard'
  // Reject absurdly long URLs
  if (next.length > 2048) return '/dashboard'
  // Prevent open redirect vulnerabilities by ensuring next starts with '/' but not '//' or '/\'
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/dashboard'
  // Prevent redirect loops back to login
  if (next === '/login' || next.startsWith('/login?') || next.startsWith('/login/')) return '/dashboard'
  return next
}

interface OnboardingSlide {
  eyebrow: string
  title: string
  quote: string
  accent: string
  iconBg: string
}

const SLIDES: OnboardingSlide[] = [
  {
    eyebrow: 'BUILT FOR IITM BS STUDENTS',
    title: 'Everything You Need to Succeed in IITM BS',
    quote: 'Live classes, recordings, premium notes, PYQs, and doubt support — designed specifically for IITM BS learners.',
    accent: '#3636e8',
    iconBg: 'linear-gradient(135deg, #3636e8, #6366f1)',
  },
]

const ONBOARDING_KEY = 'genz_mobile_onboarded'

export default function MobileLoginExperience() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    const seen = typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_KEY) === '1'
    setShowOnboarding(!seen)
  }, [])

  function finishOnboarding() {
    try { localStorage.setItem(ONBOARDING_KEY, '1') } catch {}
    setShowOnboarding(false)
  }

  function nextSlide() {
    if (slideIndex < SLIDES.length - 1) setSlideIndex(i => i + 1)
    else finishOnboarding()
  }

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) {
      if (dx < 0 && slideIndex < SLIDES.length - 1) setSlideIndex(i => i + 1)
      else if (dx > 0 && slideIndex > 0) setSlideIndex(i => i - 1)
    }
    touchStartX.current = null
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 100,
    }}>
      {/* Soft decorative blobs */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-80px', left: '-60px',
          width: '260px', height: '260px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)',
          filter: 'blur(20px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-100px', right: '-80px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.14), transparent 70%)',
          filter: 'blur(24px)',
        }} />
      </div>

      {showOnboarding ? (
        <OnboardingView
          slides={SLIDES}
          index={slideIndex}
          onNext={nextSlide}
          onSkip={finishOnboarding}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          setSlideIndex={setSlideIndex}
        />
      ) : (
        <LoginView onBackToOnboarding={() => { setSlideIndex(0); setShowOnboarding(true) }} />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   ONBOARDING SLIDES — light neumorphic theme
   ───────────────────────────────────────────────────────── */
function OnboardingView({
  slides, index, onNext, onSkip, onTouchStart, onTouchEnd, setSlideIndex,
}: {
  slides: OnboardingSlide[]
  index: number
  onNext: () => void
  onSkip: () => void
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  setSlideIndex: (i: number) => void
}) {
  const slide = slides[index]

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        display: 'flex', flexDirection: 'column', flex: 1,
        padding: 'max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom))',
        position: 'relative', zIndex: 1,
      }}
    >
      {/* Top bar: clean branding text */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '12px', marginTop: '4px' }}>
        <span style={{ 
          fontSize: '15.5px', 
          fontWeight: 900, 
          color: 'var(--text-muted)', 
          letterSpacing: '0.18em', 
          textTransform: 'uppercase',
        }}>
          GenZ IITian
        </span>
      </div>

      {/* Center: logo with concentric rings */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: '240px' }}>
        {/* Concentric rings */}
        {[1, 2, 3].map(r => (
          <div
            key={r}
            style={{
              position: 'absolute',
              width: `${240 + r * 60}px`,
              height: `${240 + r * 60}px`,
              borderRadius: '50%',
              border: `1px dashed ${slide.accent}${r === 1 ? '55' : r === 2 ? '33' : '1c'}`,
              animation: `ringPulse${r} 4s ease-in-out infinite`,
            }}
          />
        ))}
        <div style={{
          width: '240px', height: '240px', borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '12px 12px 30px var(--neu-dark), -12px -12px 30px var(--neu-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          padding: '12px',
        }}>
          <img src="/welcome.png" alt="Welcome to GenZ IITian" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      </div>

      {/* Bottom: card with eyebrow, title, quote, button */}
      <div
        key={`slide-${index}`}
        style={{
          background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '28px',
          padding: '24px 22px 20px',
          boxShadow: '0 18px 36px -12px rgba(0,0,0,0.5), 0 6px 12px -4px rgba(0,0,0,0.3)',
          animation: 'glSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#a78bfa', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
          {slide.eyebrow}
        </div>
        <h1 style={{
          fontSize: '22px', fontWeight: 900, lineHeight: 1.25, letterSpacing: '-0.02em',
          color: '#ffffff', margin: 0, marginBottom: '12px',
        }}>
          {slide.title}
        </h1>
        <p style={{
          fontSize: '13.5px', lineHeight: 1.6, color: 'rgba(255,255,255,0.65)',
          margin: 0, marginBottom: '22px',
        }}>
          {slide.quote}
        </p>

        {/* CTA */}
        <button
          onClick={onNext}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '50px',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: '15.5px', fontWeight: 800,
            background: slide.iconBg,
            color: '#ffffff',
            boxShadow: `0 10px 24px ${slide.accent}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            letterSpacing: '0.01em',
            transition: 'all 0.25s ease',
          }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = `0 12px 28px ${slide.accent}66`;
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = `0 10px 24px ${slide.accent}55`;
          }}
        >
          Continue &rarr;
        </button>
      </div>

      <style jsx>{`
        @keyframes glSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ringPulse1 { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
        @keyframes ringPulse2 { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.03); } }
        @keyframes ringPulse3 { 0%, 100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 0.55; transform: scale(1.02); } }
      `}</style>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   LOGIN VIEW (after onboarding) — light neumorphic
   ───────────────────────────────────────────────────────── */
function LoginView({ onBackToOnboarding }: { onBackToOnboarding: () => void }) {
  const logoSrc = useLocalCachedAsset('/mobile-login-logo.png')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [gError, setGError] = useState('')
  const [gLoading, setGLoading] = useState(false)
  const [gsiReady, setGsiReady] = useState(false)
  const [isCapacitor, setIsCapacitor] = useState(false)
  const [nativeReady, setNativeReady] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement>(null)

  const isDev = process.env.NODE_ENV === 'development'
  const GOOGLE_WEB_CLIENT_ID = '990282572765-bn1ls79tuhpa589eiici5r9mr6c98c8h.apps.googleusercontent.com'

  // Detect Capacitor at mount so we know whether to use native plugin or GSI
  useEffect(() => {
    const w = window as any
    const native = !!(w?.Capacitor?.isNativePlatform?.() || w?.Capacitor?.isNative)
    setIsCapacitor(native)
  }, [])

  // Initialize the native Social Login plugin inside the Capacitor APK
  useEffect(() => {
    if (!isCapacitor) return
    let cancelled = false
    ;(async () => {
      try {
        const { SocialLogin } = await import('@capgo/capacitor-social-login')
        await SocialLogin.initialize({
          google: { webClientId: GOOGLE_WEB_CLIENT_ID },
        })
        if (!cancelled) setNativeReady(true)
      } catch (err) {
        console.error('Failed to init native Google sign-in', err)
        if (!cancelled) setGError('Native sign-in is not available. Please try again.')
      }
    })()
    return () => { cancelled = true }
  }, [isCapacitor])

  // Load Google Identity Services (web only)
  useEffect(() => {
    if (isCapacitor) return

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    const onReady = () => {
      if ((window as any).google) {
        try {
          ;(window as any).google.accounts.id.initialize({
            client_id: GOOGLE_WEB_CLIENT_ID,
            callback: handleGoogleResponse,
          })
          setGsiReady(true)
        } catch (e) { console.warn('GSI init failed', e) }
      }
    }
    if (existing) onReady()
    else {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true; script.defer = true
      script.onload = onReady
      document.body.appendChild(script)
    }
  }, [isCapacitor])

  // Render the standard GSI button on web only
  useEffect(() => {
    if (isCapacitor) return

    if (gsiReady && googleBtnRef.current && (window as any).google) {
      ;(window as any).google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleBtnRef.current.parentElement?.offsetWidth || 312,
        type: 'standard',
        shape: 'pill',
        text: 'continue_with',
      })
    }
  }, [gsiReady, isCapacitor])

  async function handleGoogleResponse(response: any) {
    setGLoading(true); setGError('')
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      })
      const data = await res.json()
      if (!res.ok) { setGError(data.error || 'Google login failed'); return }
      const nextParam = searchParams.get('next')
      router.push(getSafeRedirect(nextParam)); router.refresh()
    } catch {
      setGError('Something went wrong with Google login.')
    } finally { setGLoading(false) }
  }

  async function handleNativeGoogleSignIn() {
    setGLoading(true)
    setGError('')
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login')
      const result = await SocialLogin.login({
        provider: 'google',
        options: { style: 'standard' }
      })

      const idToken =
        (result as any)?.result?.idToken ||
        (result as any)?.result?.responsePayload?.idToken ||
        (result as any)?.result?.authentication?.idToken

      if (idToken) {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: idToken }),
        })
        const data = await res.json()
        if (!res.ok) {
          setGError(data.error || 'Google login failed')
          return
        }
        const nextParam = searchParams.get('next')
        router.push(getSafeRedirect(nextParam))
        router.refresh()
      } else {
        setGError('Google login did not return a valid ID token.')
      }
    } catch (err: any) {
      console.error('Native login error:', err)
      setGError(err.message || 'Something went wrong with native Google login.')
    } finally {
      setGLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1,
      padding: 'max(16px, env(safe-area-inset-top)) 24px max(16px, env(safe-area-inset-bottom))',
      position: 'relative', zIndex: 1,
      minHeight: '100%',
      background: 'var(--bg)',
      boxSizing: 'border-box',
    }}>
      {/* 1. Top: Minimal back arrow */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '4px' }}>
        <button
          onClick={onBackToOnboarding}
          aria-label="Back to intro"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
            width: '40px', height: '40px', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* 2. Logo directly on background */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
        <img
          src={logoSrc}
          alt="GenZ IITian"
          className="mobile-login-logo-img"
          style={{ height: '52px', maxWidth: '160px', objectFit: 'contain' }}
        />
      </div>

      {/* 3. Welcome Back & Subtitle */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em',
        }}>
          Welcome Back!
        </h1>
        <p style={{
          fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: 0,
          lineHeight: 1.5, fontWeight: 400,
        }}>
          Sign in to access your live classes, recordings,<br />
          premium notes, and personalized study plan.
        </p>
      </div>

      {/* Error */}
      {gError && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', color: '#dc2626',
          padding: '12px 14px', borderRadius: '12px', fontSize: '13px',
          marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
          border: '1px solid rgba(239,68,68,0.20)', fontWeight: 600,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {gError}
        </div>
      )}

      {/* 4. Google Login Button (Flat, clean, 12px radius, no shadow) */}
      <div style={{
        marginBottom: '20px',
        position: 'relative',
      }}>
        <div style={{ position: 'relative', minHeight: '52px', display: 'flex', justifyContent: 'center' }}>
          {!isCapacitor && (
            <div 
              ref={googleBtnRef} 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                opacity: 0.01, 
                zIndex: 10,
                cursor: gsiReady ? 'pointer' : 'default',
                overflow: 'hidden'
              }} 
            />
          )}

          {isCapacitor ? (
            !nativeReady ? (
              <div style={{
                width: '100%', height: '52px', boxSizing: 'border-box',
                padding: '0 20px', borderRadius: '12px',
                background: 'var(--surface)', color: 'var(--text-muted)',
                fontSize: '13px', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)',
              }}>
                Preparing secure sign-in…
              </div>
            ) : (
              <button
                onClick={handleNativeGoogleSignIn}
                disabled={gLoading}
                style={{
                  width: '100%',
                  height: '52px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  fontSize: '14.5px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  boxShadow: 'none',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            )
          ) : (
            !gsiReady ? (
              <div style={{
                width: '100%', height: '52px', boxSizing: 'border-box',
                padding: '0 20px', borderRadius: '12px',
                background: 'var(--surface)', color: 'var(--text-muted)',
                fontSize: '13px', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)',
              }}>
                Preparing secure sign-in…
              </div>
            ) : (
              <button
                disabled={gLoading}
                style={{
                  width: '100%',
                  height: '52px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  fontSize: '14.5px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  boxShadow: 'none',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            )
          )}
        </div>

        {gLoading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'var(--surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '12px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.4" style={{ animation: 'gSpin 0.8s linear infinite' }}>
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Explore Courses Action */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
        <a
          href="/courses"
          onClick={(e) => {
            e.preventDefault()
            const nextParam = searchParams.get('next')
            router.push('/courses')
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '14px', fontWeight: 700, color: '#4f46e5',
            textDecoration: 'none',
            background: 'transparent',
            padding: '6px 12px',
          }}
        >
          Explore Courses
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </a>
      </div>

      <div style={{ flex: 1 }} />

      {/* 7. Bottom Legal Section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', paddingBottom: '8px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', margin: 0, fontWeight: 400 }}>
          By continuing, you agree to our
        </p>
        <p style={{ fontSize: '12px', margin: 0, fontWeight: 600 }}>
          <a href="/company/terms-and-conditions" style={{ color: '#4f46e5', textDecoration: 'none' }}>Terms</a>
          <span style={{ color: 'var(--text-secondary)' }}> · </span>
          <a href="/company/privacy-policy" style={{ color: '#4f46e5', textDecoration: 'none' }}>Privacy</a>
          <span style={{ color: 'var(--text-secondary)' }}> · </span>
          <a href="/company/refund-policy" style={{ color: '#4f46e5', textDecoration: 'none' }}>Refund</a>
        </p>
      </div>

      <style jsx>{`
        @keyframes gSpin { to { transform: rotate(360deg); } }
        :global([data-theme="dark"]) .mobile-login-logo-img {
          filter: brightness(0) invert(1);
        }
      `}</style>
    </div>
  )
}

function Spinner({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  )
}
