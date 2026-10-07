'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'
import { detectDevice, type DeviceInfo } from '@/lib/device'

// Report the block to analytics only once per page load
let blockReported = false

const PLAY_PACKAGE = 'com.teaching.lms'
const PLAY_REFERRER = encodeURIComponent('utm_source=mobile_web&utm_medium=android_modal')
const MARKET_URL = `market://details?id=${PLAY_PACKAGE}&referrer=${PLAY_REFERRER}`
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&referrer=${PLAY_REFERRER}`

export interface DetectionParams {
  device: DeviceInfo
  isNativeCapacitor?: boolean
  pathname?: string
  search?: string
}

/**
 * The website is blocked on Android PHONES only: they must use the Play Store
 * app. Android tablets, iPads, iPhones and laptops keep using the website.
 */
export function shouldShowAndroidAppModal({
  device,
  isNativeCapacitor = false,
  pathname = '',
  search = '',
}: DetectionParams): boolean {
  // Allow manual preview via URL query param for easy testing/debugging
  if (
    search.includes('preview-android-modal') ||
    search.includes('preview-play-modal')
  ) {
    return true
  }

  // Do not show on download pages since user is already there
  if (pathname.startsWith('/download')) {
    return false
  }

  // Native Capacitor shell has its own sunset banner; don't show here
  if (isNativeCapacitor) {
    return false
  }

  return device.isAndroidPhone
}

export default function AndroidAppModal() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Re-checked on every route change so the block cannot be escaped by
  // navigating inside the app (e.g. from /download to another page).
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isCapacitor = Boolean(
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
        .Capacitor?.isNativePlatform?.() ||
        document.documentElement.classList.contains('is-native')
    )

    const device = detectDevice()
    const show = shouldShowAndroidAppModal({
      device,
      isNativeCapacitor: isCapacitor,
      pathname: window.location.pathname,
      search: window.location.search,
    })

    setIsOpen(show)

    if (show && !blockReported) {
      blockReported = true
      try {
        posthog.capture('android_phone_web_blocked', {
          form_factor: device.formFactor,
          desktop_site_mode: device.desktopSiteMode,
          smallest_screen_side: device.smallestScreenSide,
          ua_mobile_hint: device.signals.uaDataMobile ?? null,
          ua_platform_hint: device.signals.uaDataPlatform ?? null,
          platform: device.signals.platform,
          max_touch_points: device.signals.maxTouchPoints,
          path: window.location.pathname,
        })
      } catch {}
    }
  }, [pathname])

  // Lock body scroll while the block screen is visible
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleDownloadClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    try {
      posthog.capture('play_store_modal_download_clicked', {
        source: 'android_web_modal',
      })
    } catch {}

    const isAndroid = /android/i.test(navigator.userAgent || navigator.vendor || '')
    if (isAndroid) {
      e.preventDefault()
      // Opens the native Google Play Store app directly (not Chrome web)
      window.location.href = MARKET_URL
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="android-app-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
        paddingTop: 'calc(20px + env(safe-area-inset-top))',
        backgroundColor: '#05050f',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        animation: 'playModalFadeIn 0.25s ease-out',
      }}
    >
      <style>{`
        @keyframes playModalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes playModalCardPop {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .play-modal-cut-btn:hover {
          background-color: rgba(255, 255, 255, 0.16) !important;
          color: #ffffff !important;
          transform: scale(1.05);
        }
        .play-modal-cut-btn:active {
          transform: scale(0.95);
        }
        .play-modal-download-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(1, 135, 95, 0.55) !important;
        }
        .play-modal-download-btn:active {
          transform: scale(0.98);
        }
      `}</style>

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '360px',
          background: 'linear-gradient(180deg, #181c28 0%, #0e111a 100%)',
          color: '#ffffff',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          padding: '28px 20px 22px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'playModalCardPop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Google Play Tag */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '100px',
            backgroundColor: 'rgba(1, 135, 95, 0.18)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            color: '#34d399',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}
        >
          <PlayGlyph size={13} />
          <span>Google Play Store</span>
        </div>

        {/* App Logo */}
        <img
          src="/mobile-login-logo.png"
          alt="GenZ IITIAN"
          style={{
            width: '135px',
            height: 'auto',
            marginBottom: '18px',
          }}
        />

        {/* Headline */}
        <h2
          id="android-app-modal-title"
          style={{
            fontSize: '20px',
            fontWeight: 800,
            lineHeight: 1.25,
            letterSpacing: '-0.3px',
            margin: '0 0 8px',
            color: '#ffffff',
          }}
        >
          This site is not made for mobile
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: '13.5px',
            lineHeight: 1.5,
            color: '#94a3b8',
            margin: '0 0 18px',
            maxWidth: '300px',
          }}
        >
          Please use our app. Download the official GenZ IITian app from the Google Play Store to continue.
        </p>

        {/* Feature Pills */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '100%',
            marginBottom: '20px',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '12.5px',
              color: '#e2e8f0',
            }}
          >
            <span style={{ fontSize: '15px' }}>⚡</span>
            <span>Faster & smoother than mobile web</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '12.5px',
              color: '#e2e8f0',
            }}
          >
            <span style={{ fontSize: '15px' }}>🔔</span>
            <span>Real-time lecture & assignment updates</span>
          </div>
        </div>

        {/* Download Now Button */}
        <a
          href={PLAY_STORE_URL}
          onClick={handleDownloadClick}
          className="play-modal-download-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            minHeight: '48px',
            padding: '12px 20px',
            borderRadius: '14px',
            backgroundColor: '#01875f',
            backgroundImage: 'linear-gradient(135deg, #01875f 0%, #006644 100%)',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 6px 20px rgba(1, 135, 95, 0.4)',
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            cursor: 'pointer',
          }}
        >
          <PlayGlyph size={18} />
          <span>Download Now</span>
        </a>
      </div>
    </div>
  )
}

function PlayGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path fill="#34A853" d="M3.5 20.5 14.2 12 3.5 3.5v17z" />
      <path fill="#FBBC04" d="M3.5 20.5 14.2 12l3.2 2.6-13.9 5.9z" />
      <path fill="#EA4335" d="M3.5 3.5 17.4 9.4 14.2 12 3.5 3.5z" />
      <path
        fill="#4285F4"
        d="M17.4 9.4 20.5 11c.7.4.7 1.6 0 2l-3.1 1.6L14.2 12l3.2-2.6z"
      />
    </svg>
  )
}
