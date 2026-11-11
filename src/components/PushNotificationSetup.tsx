'use client'

import { useEffect, useState } from 'react'
import { isCapacitorNative, registerCapacitorPush, checkCapacitorPermission } from '@/lib/capacitor-push'
import { usePushNotifications } from '@/hooks/usePushNotifications'

// ─── localStorage keys ────────────────────────────────────────────────────────
const KEY_INTERACTED        = 'push_permission_modal_interacted'
const KEY_LAST_DECLINED     = 'push_permission_last_declined_time'
const KEY_PUSH_ENABLED      = 'push_enabled'
const KEY_DENIED_LAST_SHOWN = 'push_denied_modal_last_shown'

const SEVEN_DAYS  = 7  * 24 * 60 * 60 * 1000
const ONE_DAY     = 24 * 60 * 60 * 1000

// ─── Helper: open Android notification settings via Capacitor ─────────────────
async function openAndroidNotificationSettings() {
  try {
    // Get the app package name to build the deep-link
    const { App } = await import('@capacitor/app')
    const { Browser } = await import('@capacitor/browser')
    const info = await App.getInfo().catch(() => ({ id: '' }))
    const pkg  = info.id ?? ''

    // "app-settings:" is a well-known URI scheme that Android resolves to
    // the app-specific notification settings screen (Android 8+)
    const uri = pkg
      ? `app-settings:${pkg}`
      : 'android.settings.APP_NOTIFICATION_SETTINGS'

    await Browser.open({ url: uri }).catch(async () => {
      // Fallback: open the generic notification settings page
      await Browser.open({ url: 'android.settings.APPLICATION_DETAILS_SETTINGS' })
    })
  } catch (err) {
    console.error('[PushNotificationSetup] Could not open Android settings:', err)
  }
}


// ═════════════════════════════════════════════════════════════════════════════
// Modal A — First-time permission request
// ═════════════════════════════════════════════════════════════════════════════
function RequestPermissionModal({
  onEnable,
  onLater,
}: {
  onEnable: () => void
  onLater:  () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.50)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onLater}
    >
      <style>{`
        @keyframes pnsSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes pnsPulse {
          0%   { transform: scale(0.95); opacity: 0.8; }
          50%  { transform: scale(1.18); opacity: 0.25; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'var(--surface-2)',
          borderRadius: '28px',
          padding: '32px 28px 24px',
          boxShadow: '0 24px 48px rgba(15,23,42,0.18), 0 8px 16px rgba(15,23,42,0.08), inset 0 1px 0 var(--neu-glow)',
          border: '1px solid rgba(255,255,255,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'pnsSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{ position: 'relative', marginBottom: '22px' }}>
          <div style={{
            position: 'absolute', inset: '-10px', borderRadius: '50%',
            background: 'color-mix(in srgb, var(--primary) 13%, transparent)', animation: 'pnsPulse 2.2s infinite',
          }} />
          <div style={{
            width: '68px', height: '68px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--primary))',
            boxShadow: '0 8px 20px color-mix(in srgb, var(--primary) 28%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
        </div>

        <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '10px', fontFamily: "'Outfit', sans-serif" }}>
          Enable Live Alerts
        </div>
        <p style={{ fontSize: '13.5px', lineHeight: '1.65', color: 'var(--text-secondary)', marginBottom: '26px', padding: '0 4px' }}>
          Get instant updates for live sessions, subject blueprints, announcements, and study notes so you never miss a class.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '10px' }}>
          <button
            type="button"
            onClick={onEnable}
            style={{
              width: '100%', border: 'none', borderRadius: '50px',
              padding: '14px 20px', fontFamily: 'inherit', fontSize: '14px', fontWeight: '700',
              cursor: 'pointer', color: '#fff',
              background: 'linear-gradient(135deg, var(--primary), var(--primary))',
              boxShadow: '4px 4px 10px color-mix(in srgb, var(--primary) 25%, transparent), inset 1px 1px 0 var(--neu-glow)',
              transition: 'all 0.2s ease',
            }}
          >
            Enable Now
          </button>
          <button
            type="button"
            onClick={onLater}
            style={{
              width: '100%', border: 'none', background: 'transparent',
              padding: '10px 20px', fontFamily: 'inherit', fontSize: '13.5px',
              fontWeight: '600', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.2s ease',
            }}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Modal B — Permission Denied (24-hr throttle) — step-by-step guide
// ═════════════════════════════════════════════════════════════════════════════
function PermissionDeniedModal({ onDismiss }: { onDismiss: () => void }) {
  const steps = [
    { icon: '⚙️', text: 'Open your phone\'s Settings' },
    { icon: '📱', text: 'Tap  Apps  →  GENz IITIAN' },
    { icon: '🔔', text: 'Tap  Notifications' },
    { icon: '✅', text: 'Toggle  Allow Notifications  ON' },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10, 10, 30, 0.60)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onDismiss}
    >
      <style>{`
        @keyframes deniedSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes deniedShake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-4px); }
          40%     { transform: translateX(4px); }
          60%     { transform: translateX(-3px); }
          80%     { transform: translateX(3px); }
        }
        @keyframes stepFadeIn {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'linear-gradient(160deg, #1a1a3a 0%, #12122a 100%)',
          borderRadius: '28px',
          padding: '30px 26px 24px',
          boxShadow: '0 32px 64px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 var(--neu-glow)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'deniedSlideUp 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon */}
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          boxShadow: '0 8px 24px rgba(245,158,11,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '18px',
          animation: 'deniedShake 0.5s ease 0.4s',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="22" x2="12" y2="22" />
          </svg>
        </div>

        {/* Headline */}
        <div style={{
          fontSize: '18px', fontWeight: '800', color: '#ffffff',
          marginBottom: '6px', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.3px',
        }}>
          Notifications are Blocked 🔕
        </div>
        <p style={{
          fontSize: '13px', lineHeight: '1.6', color: 'rgba(255,255,255,0.55)',
          marginBottom: '22px', padding: '0 4px',
        }}>
          You&apos;ll miss live class alerts &amp; announcements. Enable them in Android Settings — it only takes 10 seconds.
        </p>

        {/* Step-by-step guide */}
        <div style={{
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          textAlign: 'left',
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '2px' }}>
            How to enable
          </div>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                animation: `stepFadeIn 0.3s ease ${0.1 + i * 0.07}s both`,
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
                background: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px',
              }}>
                {step.icon}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--primary), var(--primary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: '800', color: '#fff',
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.80)', lineHeight: '1.4' }}>
                  {step.text}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '10px' }}>
          <button
            type="button"
            onClick={async () => {
              await openAndroidNotificationSettings()
              onDismiss()
            }}
            style={{
              width: '100%', border: 'none', borderRadius: '50px',
              padding: '14px 20px', fontFamily: 'inherit', fontSize: '14px', fontWeight: '700',
              cursor: 'pointer', color: '#fff',
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              boxShadow: '0 6px 20px rgba(245,158,11,0.30), inset 1px 1px 0 var(--neu-glow)',
              transition: 'all 0.2s ease',
            }}
          >
            Open Settings Now →
          </button>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              width: '100%', border: 'none', background: 'transparent',
              padding: '10px 20px', fontFamily: 'inherit', fontSize: '13px',
              fontWeight: '600', color: 'rgba(255,255,255,0.30)', cursor: 'pointer',
              transition: 'color 0.2s ease',
            }}
          >
            Remind me tomorrow
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Web Browser Custom Modals
// ═════════════════════════════════════════════════════════════════════════════

function WebBlockedModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <>
      <style>{`
        @keyframes wpSlideDown {
          from { opacity: 0; transform: translateY(-30px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          top: '24px',
          left: '24px',
          zIndex: 99999,
          width: 'min(380px, calc(100vw - 48px))',
          background: '#ffffff',
          borderRadius: '20px',
          padding: '24px 24px 20px',
          boxShadow: '0 20px 48px rgba(15,23,42,0.14), 0 8px 16px rgba(15,23,42,0.06)',
          border: '1.5px solid rgba(15,23,42,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'wpSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Custom Graphics Header with Red Slash/Blocked notification bell */}
        <svg width="220" height="85" viewBox="0 0 220 85" fill="none" style={{ marginBottom: '16px' }}>
          <rect x="68" y="24" width="28" height="40" rx="4" fill="#e2e8f0" />
          <rect x="110" y="28" width="48" height="28" rx="3" fill="#e2e8f0" />
          <circle cx="106" cy="38" r="22" fill="#ef4444" stroke="#fff" strokeWidth="3.5" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }} />
          <path d="M106 25 A 5 5 0 0 0 101 30 C 101 36 98 38 98 38 L 114 38 C 114 38 111 36 111 30 A 5 5 0 0 0 106 25 Z" fill="#fff" />
          <path d="M102 41 A 2 2 0 0 0 110 41 Z" fill="#fff" />
          <line x1="94" y1="26" x2="118" y2="50" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </svg>

        <div style={{ fontSize: '13.5px', lineHeight: '1.65', color: '#1e293b', fontWeight: '700', marginBottom: '18px', fontFamily: "'Outfit', sans-serif" }}>
          Oops! It seems like you have blocked desktop notifications from GENz IITIAN. Please allow notification permission for GENz IITIAN
        </div>

        <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif" }}>
          How to Unblock
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13.5px', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit', sans-serif", marginBottom: '20px' }}>
          <span style={{ color: '#10b981', fontSize: '15px' }}>🎛️</span> &gt; Notifications &gt; Allow
        </div>

        <button
          type="button"
          onClick={onDismiss}
          style={{
            width: '100%', border: 'none', borderRadius: '8px',
            padding: '10px 18px', fontFamily: 'inherit', fontSize: '13px', fontWeight: '750',
            cursor: 'pointer', color: '#fff',
            background: '#ef4444',
            boxShadow: '0 4px 10px rgba(239,68,68,0.2)',
            transition: 'all 0.15s ease',
          }}
        >
          Got it
        </button>
      </div>
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════
type ModalKind = 'request' | 'denied' | null

export default function PushNotificationSetup() {
  const { isSupported, isSubscribed } = usePushNotifications()
  const [modalKind, setModalKind] = useState<ModalKind>(null)
  const [showWebBlocked, setShowWebBlocked] = useState(false)

  useEffect(() => {
    console.log('[PushNotificationSetup] useEffect triggered')

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('reset_push') === 'true') {
        console.log('[PushNotificationSetup] reset_push=true — clearing push localStorage keys')
        localStorage.removeItem(KEY_INTERACTED)
        localStorage.removeItem(KEY_LAST_DECLINED)
        localStorage.removeItem(KEY_PUSH_ENABLED)
        localStorage.removeItem(KEY_DENIED_LAST_SHOWN)
      }
    }

    // ── Capacitor Native App ─────────────────────────────────────────────────
    if (isCapacitorNative()) {
      checkCapacitorPermission().then((status) => {
        console.log('[PushNotificationSetup] Permission status:', status)

        if (status === 'granted') {
          // Already granted — silently sync token
          registerCapacitorPush()
          return
        }

        if (status === 'denied') {
          // User previously denied in OS — show "go to Settings" modal once/24h
          const lastShown = localStorage.getItem(KEY_DENIED_LAST_SHOWN)
          const elapsed   = lastShown ? Date.now() - Number(lastShown) : Infinity

          if (elapsed < ONE_DAY) {
            console.log('[PushNotificationSetup] Denied modal suppressed — shown < 24h ago')
            return
          }

          const timer = setTimeout(() => {
            setModalKind('denied')
          }, 1500)
          return () => clearTimeout(timer)
        }

        // status === 'prompt' / 'prompt-with-rationale' — first-time ask
        const interacted   = localStorage.getItem(KEY_INTERACTED)
        const lastDeclined = localStorage.getItem(KEY_LAST_DECLINED)

        let shouldPrompt = false
        if (interacted !== 'true') {
          shouldPrompt = true
        } else if (lastDeclined) {
          const elapsed = Date.now() - Number(lastDeclined)
          if (elapsed > SEVEN_DAYS) {
            shouldPrompt = true
          }
        }

        if (shouldPrompt) {
          const timer = setTimeout(() => {
            setModalKind('request')
          }, 1200)
          return () => clearTimeout(timer)
        }
      })

      return
    }

    // ── Browser Web Push ─────────────────────────────────────────────────────
    if (!isSupported || isSubscribed) return

    // Listen for custom trigger to show blocked modal on desktop
    const handleShowBlocked = () => {
      setShowWebBlocked(true)
    }
    window.addEventListener('show-push-blocked-modal', handleShowBlocked)

    return () => {
      window.removeEventListener('show-push-blocked-modal', handleShowBlocked)
    }
  }, [isSupported, isSubscribed])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleEnable = async () => {
    setModalKind(null)
    localStorage.setItem(KEY_INTERACTED, 'true')

    const success = await registerCapacitorPush()
    if (success) {
      localStorage.setItem(KEY_PUSH_ENABLED, 'true')
      localStorage.removeItem(KEY_LAST_DECLINED)
    } else {
      // Permission was denied at the OS prompt level — treat as denied next time
      localStorage.setItem(KEY_PUSH_ENABLED, 'false')
      localStorage.setItem(KEY_LAST_DECLINED, Date.now().toString())
      // Next open will detect status=denied and show the settings modal
    }
  }

  const handleLater = () => {
    setModalKind(null)
    localStorage.setItem(KEY_INTERACTED, 'true')
    localStorage.setItem(KEY_PUSH_ENABLED, 'false')
    localStorage.setItem(KEY_LAST_DECLINED, Date.now().toString())
  }

  const handleDeniedDismiss = () => {
    setModalKind(null)
    // Record timestamp — won't show again for 24h
    localStorage.setItem(KEY_DENIED_LAST_SHOWN, Date.now().toString())
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isCapacitorNative()) {
    if (modalKind === 'request') {
      return <RequestPermissionModal onEnable={handleEnable} onLater={handleLater} />
    }
    if (modalKind === 'denied') {
      return <PermissionDeniedModal onDismiss={handleDeniedDismiss} />
    }
    return null
  }

  if (showWebBlocked) {
    return <WebBlockedModal onDismiss={() => setShowWebBlocked(false)} />
  }

  return null
}
