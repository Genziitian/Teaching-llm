'use client'

import { PRIVACY_POLICY_HTML } from '@/lib/privacy-policy'
import { TERMS_AND_CONDITIONS_HTML } from '@/lib/terms-and-conditions'
import { useState, Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import MobileLoginExperience from '@/components/auth/MobileLoginExperience'
import posthog from 'posthog-js'
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

function PoliciesDropdown({ 
  links, 
  align = 'left' 
}: { 
  links: Array<{ label: string, icon: string, onClick: () => void }>, 
  align?: 'left' | 'right' | 'center' 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setIsOpen(true)
  }

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setIsOpen(false), 150)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  return (
    <div 
      ref={dropdownRef} 
      className="policies-dropdown-container" 
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="policies-dropdown-trigger"
        style={{
          fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600',
          padding: '8px 16px', background: 'var(--surface-2)', borderRadius: '50px', border: 'none', cursor: 'pointer',
          boxShadow: 'var(--shadow)', transition: 'all 0.2s ease',
          outline: 'none'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          e.currentTarget.style.color = 'var(--primary)';
        }}
        onMouseOut={(e) => {
          if (!isOpen) {
            e.currentTarget.style.boxShadow = 'var(--shadow)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }
        }}
      >
        <span style={{ fontSize: '14px' }}>⚖️</span>
        <span>Policies</span>
        <span style={{ 
          fontSize: '9px', 
          transition: 'transform 0.2s ease', 
          transform: isOpen ? 'rotate(180deg)' : 'none',
          display: 'inline-block'
        }}>▼</span>
      </button>

      {isOpen && (
        <div 
          className="policies-dropdown-menu"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: align === 'left' ? 0 : align === 'right' ? 'auto' : '50%',
            right: align === 'right' ? 0 : 'auto',
            transform: align === 'center' ? 'translateX(-50%)' : 'none',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            zIndex: 999,
            minWidth: '170px',
            animation: 'slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {links.map((link, idx) => (
            <button
              key={idx}
              onClick={() => {
                link.onClick();
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 14px',
                border: 'none',
                background: 'none',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: '600',
                color: '#6b6b8a',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#F3F4F6';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = '#6b6b8a';
              }}
            >
              <span style={{ fontSize: '14px' }}>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const logoSrc = useLocalCachedAsset('/mobile-login-logo.png')
  const [showRefundPolicy, setShowRefundPolicy] = useState(false)
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)
  const [showTermsConditions, setShowTermsConditions] = useState(false)
  const [isCapacitor, setIsCapacitor] = useState(false)

  useEffect(() => {
    const w = window as any
    const native = !!(w?.Capacitor?.isNativePlatform?.() || w?.Capacitor?.isNative)
    setIsCapacitor(native)
  }, [])

  const footerLinksData = [
    { label: 'Refund Policy', icon: '💸', onClick: () => setShowRefundPolicy(true) },
    { label: 'Privacy Policy', icon: '🔒', onClick: () => setShowPrivacyPolicy(true) },
    { label: 'Terms & Conditions', icon: '📜', onClick: () => setShowTermsConditions(true) },
  ]

  // Show error from query params if any
  const queryError = searchParams.get('error')
  const errorMap: Record<string, string> = {
    AccountDeactivated: 'Your account has been deactivated. Please contact support.',
    InternalError: 'An internal error occurred. Please try again later.',
  }

  const displayError = queryError ? errorMap[queryError] || `Login error: ${queryError}` : ''

  if (isCapacitor) {
    return <MobileLoginExperience />
  }

  return (
    <>
      {/* Mobile-only experience: 3-slide onboarding + clean dark login */}
      <div className="mobile-only-login"><MobileLoginExperience /></div>

      {/* Desktop login (hidden on mobile via CSS) */}
      <div className="login-container desktop-only-login">
      {/* Left Panel - Branding */}
      <div className="login-left-panel">
        {/* Logo & Tagline Centered Layout */}
        <div className="login-logo-container">
          <div 
            className="login-logo-card"
            style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            overflow: 'hidden',
            flexShrink: 0,
            width: '100%',
            maxWidth: '320px',
            minHeight: '200px',
            padding: '24px 22px 20px',
            borderRadius: '28px',
            background: '#ffffff',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
            cursor: 'default',
          }}>
            <img 
              src={logoSrc} 
              alt="GenZ IITIAN Logo" 
              style={{ 
                width: '100%',
                maxWidth: '260px',
                height: 'auto',
                maxHeight: '130px',
                objectFit: 'contain',
                display: 'block',
              }} 
            />
            <p style={{ fontSize: '17px', color: '#6b6b8a', fontWeight: '600', letterSpacing: '0.02em', marginTop: '12px', textAlign: 'center' }}>
              Upgrade How You Learn
            </p>
          </div>
        </div>
          
          {/* Geometric Characters Composition */}
          <div className="login-geometric-composition">
            {/* Purple Rectangle */}
            <div className="animate-float" style={{ width: '160px', height: '200px', animationDelay: '0s', position: 'relative' }}>
              <div style={{ width: '100%', height: '100%', background: '#8B5CF6', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 15px 35px rgba(139, 92, 246, 0.35)', transform: 'rotate(-8deg)', transformOrigin: 'center' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%' }} />
                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%' }} />
                </div>
                <div style={{ width: '32px', height: '16px', border: '4px solid white', borderTop: 'none', borderRadius: '0 0 16px 16px', marginTop: '12px' }} />
              </div>
            </div>

            {/* Black Rounded Rectangle */}
            <div className="animate-float" style={{ width: '180px', height: '220px', animationDelay: '2s', position: 'relative' }}>
              <div style={{ width: '100%', height: '100%', background: '#111827', borderRadius: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 15px 35px rgba(17, 24, 39, 0.35)', transform: 'rotate(4deg)', transformOrigin: 'center' }}>
                <div style={{ display: 'flex', gap: '14px' }}>
                  <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%' }} />
                  <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%' }} />
                </div>
                <div style={{ width: '40px', height: '10px', background: 'white', borderRadius: '5px', marginTop: '16px' }} />
              </div>
            </div>

            {/* Orange Semicircle */}
            <div className="animate-float" style={{ width: '200px', height: '100px', animationDelay: '4s', position: 'relative' }}>
              <div style={{ width: '100%', height: '100%', background: '#F97316', borderRadius: '100px 100px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '16px', boxShadow: '0 15px 35px rgba(249, 115, 22, 0.35)' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                  <div style={{ width: '12px', height: '12px', background: 'white', borderRadius: '50%' }} />
                  <div style={{ width: '12px', height: '12px', background: 'white', borderRadius: '50%' }} />
                </div>
                <div style={{ width: '36px', height: '18px', border: '4px solid white', borderTop: 'none', borderRadius: '0 0 18px 18px' }} />
              </div>
            </div>

            {/* Yellow Organic Blob */}
            <div className="animate-float" style={{ width: '180px', height: '180px', animationDelay: '6s', position: 'relative' }}>
              <div style={{ width: '100%', height: '100%', background: '#FACC15', borderRadius: '50% 50% 30% 70% / 50% 50% 70% 30%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 15px 35px rgba(250, 204, 21, 0.35)', transform: 'rotate(8deg)', transformOrigin: 'center' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%' }} />
                  <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%' }} />
                </div>
                <div style={{ width: '32px', height: '3px', background: 'white', marginTop: '12px' }} />
              </div>
            </div>
          </div>
        
        {/* Footer Links */}
        <div className="login-footer-links desktop-only-footer-links">
          <PoliciesDropdown links={footerLinksData} align="left" />
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="login-right-panel">
        <div className="modal login-card-container">
          <h2 className="login-card-title">Welcome Back !</h2>

          {/* Error display */}
          {displayError && (
            <div style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {displayError}
            </div>
          )}



          <GoogleLoginButton onTermsClick={() => setShowTermsConditions(true)} onPrivacyClick={() => setShowPrivacyPolicy(true)} />
        </div>

        {/* Explore Courses CTA below the card */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <a 
            href="https://app.genziitian.in/courses" 
            target="_blank" 
            rel="noopener noreferrer"
            className="login-explore-btn"
            style={{
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 14px 32px rgba(30, 30, 58, 0.45)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(30, 30, 58, 0.35)';
            }}
          >
            <span>Explore Courses</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
        </div>
        
        {/* Right Panel Footer (Contact + Mobile Policies) */}
        <div className="login-right-footer-container">
          <a
            href="mailto:admin@genziitian.org"
            className="login-contact-developer"
            style={{ 
              fontSize: '12px', 
              color: 'var(--text-muted)', 
              textDecoration: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontWeight: '600',
              padding: '8px 16px',
              background: 'var(--surface-2)',
              borderRadius: '50px',
              boxShadow: 'var(--shadow)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <span style={{ fontSize: '14px' }}>✉️</span><span>Contact Us</span>
          </a>

          <div className="mobile-only-policies-container">
            <PoliciesDropdown links={footerLinksData} align="right" />
          </div>
        </div>
      </div>

      {/* Policy Modals */}
      {[
        { 
          show: showRefundPolicy, 
          close: () => setShowRefundPolicy(false), 
          title: 'Return & Refund Policy', 
          content: (
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '12px' }}>At GenZ IITian, we provide 100% digital educational services in the form of online courses. There is no physical product, shipment, or delivery involved.</p>
              <p style={{ marginBottom: '12px' }}>Due to the nature of digital content, all purchases are final. We do not offer refunds, returns, or exchanges under any circumstances once a course has been purchased.</p>
              <p style={{ marginBottom: '12px' }}>We strongly recommend reviewing course details before making a purchase.</p>
              <p style={{ marginBottom: '12px' }}>In case of any technical issues, payment errors, or access-related problems, you can contact our support team. We will ensure that you receive proper access to your purchased course.</p>
              <p>We reserve the right to update or modify this policy at any time without prior notice. Changes will be effective immediately upon posting.</p>
            </div>
          )
        },
        { 
          show: showPrivacyPolicy, 
          close: () => setShowPrivacyPolicy(false), 
          title: 'Privacy Policy',
          content: (
            <div
              style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', maxHeight: '60vh', overflowY: 'auto', paddingRight: '6px' }}
              dangerouslySetInnerHTML={{ __html: PRIVACY_POLICY_HTML }}
            />
          )
        },
        { 
          show: showTermsConditions, 
          close: () => setShowTermsConditions(false), 
          title: 'Terms & Conditions',
          content: (
            <div
              style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', maxHeight: '60vh', overflowY: 'auto', paddingRight: '6px' }}
              dangerouslySetInnerHTML={{ __html: TERMS_AND_CONDITIONS_HTML }}
            />
          )
        }
      ].map((modal, i) => modal.show && (
        <div 
          key={i}
          style={{ 
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' 
          }}
          onClick={(e) => { if (e.target === e.currentTarget) modal.close() }}
        >
          <div className="modal" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto', padding: '44px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{modal.title}</h2>
              <button onClick={modal.close} style={{ background: 'none', border: 'none', fontSize: '24px', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 8px' }}>&times;</button>
            </div>
            {modal.content}
          </div>
        </div>
      ))}

    </div>
    </>
  )
}

const GOOGLE_WEB_CLIENT_ID = '990282572765-bn1ls79tuhpa589eiici5r9mr6c98c8h.apps.googleusercontent.com'

function GoogleLoginButton({ onTermsClick, onPrivacyClick }: { onTermsClick?: () => void, onPrivacyClick?: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [gLoading, setGLoading] = useState(false)
  const [gError, setGError] = useState('')
  const [gsiReady, setGsiReady] = useState(false)
  const [isCapacitor, setIsCapacitor] = useState(false)
  const [nativeReady, setNativeReady] = useState(false)
  const [quickLoading, setQuickLoading] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement>(null)

  // Backup APK sign-in for when native Google isn't available. Gated server-side by STUDENT_QUICK_LOGIN_EMAIL.
  async function handleQuickLogin() {
    if (quickLoading) return
    setQuickLoading(true)
    setGError('')
    try {
      const res = await fetch('/api/auth/student-quick-login', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGError(data.error || 'Quick login failed.')
        return
      }
      const nextParam = searchParams.get('next')
      router.push(getSafeRedirect(nextParam))
      router.refresh()
    } catch {
      setGError('Something went wrong with quick login.')
    } finally {
      setQuickLoading(false)
    }
  }

  // Detect Capacitor at mount so we know whether to use the native plugin or GSI.
  useEffect(() => {
    const w = window as any
    const native = !!(w?.Capacitor?.isNativePlatform?.() || w?.Capacitor?.isNative)
    setIsCapacitor(native)
  }, [])

  // Initialize the native Social Login plugin inside the Capacitor APK.
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

  // Load Google Identity Services (web only — GSI is blocked inside WebViews).
  useEffect(() => {
    if (isCapacitor) return

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: GOOGLE_WEB_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
          itp_support: true,
        })
        setGsiReady(true)
        // Prompt Google One Tap automatically for a premium sign-in experience
        try {
          (window as any).google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed()) {
              console.log('[Google One Tap] Not displayed:', notification.getNotDisplayedReason())
            } else if (notification.isSkippedMoment()) {
              console.log('[Google One Tap] Skipped:', notification.getSkippedReason())
            } else if (notification.isDismissedMoment()) {
              console.log('[Google One Tap] Dismissed:', notification.getDismissedReason())
            }
          })
        } catch (e) {
          console.error('[Google One Tap] Failed to prompt:', e)
        }
      }
    }
    document.body.appendChild(script)

    return () => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
      if (existing) existing.remove()
    }
  }, [isCapacitor])

  // Render the GSI button on web only.
  useEffect(() => {
    if (isCapacitor) return
    if (gsiReady && googleBtnRef.current && (window as any).google) {
      (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleBtnRef.current.parentElement?.offsetWidth || 312,
        type: 'standard',
        shape: 'pill',
      });
    }
  }, [gsiReady, isCapacitor])

  // Native sign-in handler (Capacitor APK).
  async function handleNativeGoogleSignIn() {
    if (gLoading || !nativeReady) return
    setGLoading(true)
    setGError('')
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login')
      const res = await SocialLogin.login({
        provider: 'google',
        options: { style: 'standard' },
      })
      const idToken =
        (res as any)?.result?.idToken ||
        (res as any)?.result?.responsePayload?.idToken ||
        (res as any)?.result?.authentication?.idToken
      if (!idToken) {
        setGError('Google did not return an ID token. Please try again.')
        return
      }
      await sendCredentialToServer(idToken)
    } catch (err: any) {
      if (err?.code === 'USER_CANCELLED' || err?.message?.includes('cancel')) {
        // Silent — user backed out
      } else {
        console.error(err)
        setGError(err?.message || 'Google sign-in failed.')
      }
    } finally {
      setGLoading(false)
    }
  }

  async function sendCredentialToServer(credential: string) {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setGError(data.error || 'Google login failed')
      // Track failed login
      posthog.capture('login_failed', { method: 'google', error: data.error })
      return
    }
    // Track successful login & identify user
    if (data.user) {
      posthog.identify(data.user.id, {
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
      })
    }
    posthog.capture('user_logged_in', { method: 'google', platform: isCapacitor ? 'app' : 'web' })
    const nextParam = searchParams.get('next')
    router.push(getSafeRedirect(nextParam))
    router.refresh()
  }

  async function handleGoogleResponse(response: any) {
    setGLoading(true)
    setGError('')
    try {
      await sendCredentialToServer(response.credential)
    } catch {
      setGError('Something went wrong with Google login.')
    } finally {
      setGLoading(false)
    }
  }

  return (
    <div>
      {gError && (
        <div style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', padding: '10px 14px', borderRadius: '12px', fontSize: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {gError}
        </div>
      )}

      <p className="login-card-subtitle">
        Log in or create a new account with Google
      </p>

      <div style={{ position: 'relative', marginBottom: '16px' }}>
        {/* GSI hidden overlay — web only; the native plugin handles clicks inside Capacitor */}
        {!isCapacitor && (
          <div
            ref={googleBtnRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0.001,
              zIndex: 10,
              cursor: gsiReady ? 'pointer' : 'default',
              overflow: 'hidden'
            }}
          />
        )}

        <button
          onClick={isCapacitor ? handleNativeGoogleSignIn : undefined}
          disabled={isCapacitor ? (!nativeReady || gLoading) : (!gsiReady || gLoading)}
          style={{
            width: '100%',
            padding: '14px 24px',
            borderRadius: '50px',
            border: '1px solid rgba(0,0,0,0.08)',
            background: '#ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            cursor: (isCapacitor ? nativeReady : gsiReady) && !gLoading ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '16px',
            fontWeight: '700',
            color: '#1e1e3a',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
            opacity: (isCapacitor ? nativeReady : gsiReady) ? 1 : 0.6,
          }}
          onMouseOver={(e) => {
            if ((isCapacitor ? nativeReady : gsiReady) && !gLoading) {
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
            e.currentTarget.style.transform = 'none'
          }}
        >
          {gLoading ? (
            <>
              <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"/></svg>
              Signing in...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={async () => {
              setGLoading(true)
              setGError('')
              try {
                const res = await fetch('/api/auth/dev-login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: 'lkiitmng2428@gmail.com' }), // Default manager account
                })
                const data = await res.json()
                if (!res.ok) {
                  setGError(data.error || 'Dev login failed')
                  return
                }
                const nextParam = searchParams.get('next')
                router.push(getSafeRedirect(nextParam))
                router.refresh()
              } catch {
                setGError('Something went wrong with dev login.')
              } finally {
                setGLoading(false)
              }
            }}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: '50px',
              border: 'none',
              background: '#8B5CF6',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '14px',
              fontWeight: '700',
              color: '#ffffff',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.25)'
              e.currentTarget.style.transform = 'none'
            }}
          >
            ⚡ Dev Quick Login (Manager)
          </button>

          <button
            onClick={async () => {
              setGLoading(true)
              setGError('')
              try {
                const res = await fetch('/api/auth/dev-login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: 'student@teacherai.com' }), // Student account
                })
                const data = await res.json()
                if (!res.ok) {
                  setGError(data.error || 'Dev login failed')
                  return
                }
                const nextParam = searchParams.get('next')
                router.push(getSafeRedirect(nextParam))
                router.refresh()
              } catch {
                setGError('Something went wrong with dev login.')
              } finally {
                setGLoading(false)
              }
            }}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: '50px',
              border: 'none',
              background: '#10B981',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '14px',
              fontWeight: '700',
              color: '#ffffff',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)'
              e.currentTarget.style.transform = 'none'
            }}
          >
            ⚡ Dev Quick Login (Student)
          </button>
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <p className="login-terms-text">
          By continuing, you agree to the <span onClick={onTermsClick} style={{ color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline' }}>Terms & Conditions</span> & <span onClick={onPrivacyClick} style={{ color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline' }}>privacy policy</span>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
