'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Semver comparison helper
 * Returns true if the currentVersion is older than targetVersion
 */
function isOlderVersion(currentVersion: string, targetVersion: string): boolean {
  const currentParts = currentVersion.split('.').map(num => parseInt(num, 10) || 0)
  const targetParts = targetVersion.split('.').map(num => parseInt(num, 10) || 0)

  for (let i = 0; i < Math.max(currentParts.length, targetParts.length); i++) {
    const cur = currentParts[i] || 0
    const tgt = targetParts[i] || 0
    if (tgt > cur) return true
    if (cur > tgt) return false
  }
  return false
}

export default function AppUpdater() {
  const [isNativeAndroid, setIsNativeAndroid] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isForceUpdate, setIsForceUpdate] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [apkUrl, setApkUrl] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [latestVersionStr, setLatestVersionStr] = useState('')
  const [currentVersionStr, setCurrentVersionStr] = useState('')

  // Interval reference for animating simulated progress smooth bar
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let active = true

    const initUpdater = async (isManual = false) => {
      try {
        // Dynamic imports prevent SSR failure during Next.js server compilation
        const { Capacitor } = await import('@capacitor/core')
        
        // This is only relevant for native Android APK distribution
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
          if (isManual) {
            alert('App update checks are only available in the Android application.')
          }
          return
        }

        if (active) setIsNativeAndroid(true)

        // 1. Fetch current native build info
        const { App } = await import('@capacitor/app')
        const info = await App.getInfo()
        const currentVersion = info.version // e.g., '1.0.0'
        if (active) setCurrentVersionStr(currentVersion)

        // 2. Fetch the latest release configurations from the server
        const res = await fetch('/api/app-version')
        if (!res.ok) throw new Error('Failed to fetch version configuration api')
        const data = await res.json()

        if (!data || !data.latestVersion) return

        if (active) {
          setApkUrl(data.apkUrl || '')
          setReleaseNotes(data.releaseNotes || '')
          setLatestVersionStr(data.latestVersion)
        }

        // Compare native version vs server requirements
        const isNewer = isOlderVersion(currentVersion, data.latestVersion)
        const isForce = isOlderVersion(currentVersion, data.minRequiredVersion || data.latestVersion)

        if (isNewer) {
          if (active) {
            setUpdateAvailable(true)
            setIsForceUpdate(isForce)
          }
        } else if (isManual) {
          alert(`Your app is already up to date! (v${currentVersion})`)
        }
      } catch (err) {
        console.warn('[AppUpdater] Failed to verify system version:', err)
        if (isManual) {
          alert('Failed to check for updates. Please check your internet connection and try again.')
        }
      }
    }

    // Run automatically on load
    initUpdater(false)

    // Listen for manual check trigger from UI (e.g. settings or menu page)
    const handleManualCheck = (e: Event) => {
      const customEvent = e as CustomEvent
      initUpdater(customEvent.detail?.manual || false)
    }

    window.addEventListener('check-for-app-updates', handleManualCheck)

    return () => {
      active = false
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      window.removeEventListener('check-for-app-updates', handleManualCheck)
    }
  }, [])

  const handleUpdate = async () => {
    if (!apkUrl) return

    setDownloading(true)
    setStatusMessage('Preparing download...')
    setDownloadProgress(2)

    // Simulate smooth progress loader in UX since Capacitor downloadFile is a single Promise
    let prog = 2
    progressTimerRef.current = setInterval(() => {
      prog += Math.random() * 8
      if (prog > 92) {
        prog = 92
        if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      }
      setDownloadProgress(Math.floor(prog))
      setStatusMessage(`Downloading update package... ${Math.floor(prog)}%`)
    }, 300)

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const { FileOpener } = await import('@capacitor-community/file-opener')

      setStatusMessage('Downloading APK file...')
      
      // Cache Directory is highly reliable because it doesn't require runtime storage permission prompts on Android
      const downloadResult = await Filesystem.downloadFile({
        url: apkUrl,
        path: 'teaching-lms-update.apk',
        directory: Directory.Cache,
      })

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
      }
      setDownloadProgress(100)
      setStatusMessage('Download complete! Opening package installer...')

      // Trigger standard Android package installer intent
      await FileOpener.open({
        filePath: downloadResult.path,
        contentType: 'application/vnd.android.package-archive'
      })

      // After the installer opens, exit the app so Android restarts fresh with the new version
      setTimeout(async () => {
        try {
          const { App } = await import('@capacitor/app')
          await App.exitApp()
        } catch (e) { /* ignore */ }
      }, 2000)
    } catch (err) {
      console.error('[AppUpdater] Failed to download or install package natively:', err)
      
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
      }

      // Automatically fall back to browser download
      setStatusMessage('Opening system browser to download directly...')
      setDownloadProgress(75)

      setTimeout(async () => {
        try {
          const { Browser } = await import('@capacitor/browser')
          await Browser.open({ url: apkUrl })
        } catch (e) {
          window.open(apkUrl, '_blank')
        }
        
        // Reset the updating status after the browser opens
        setTimeout(() => {
          setDownloading(false)
          setDownloadProgress(0)
        }, 2000)
      }, 1500)
    }
  }

  if (!isNativeAndroid || !updateAvailable) return null

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(12px)',
        animation: 'fadeInAppUpdater 0.3s ease-out forwards',
        padding: '20px',
      }}
    >
      <div
        className="update-card"
        style={{
          width: '100%',
          maxWidth: '430px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.96) 0%, rgba(15, 23, 42, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px color-mix(in srgb, var(--primary) 18%, transparent)',
          borderRadius: '24px',
          padding: '32px',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          animation: 'scaleInAppUpdater 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Animated Glow Logo / Update Icon */}
        <div
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px color-mix(in srgb, var(--primary) 40%, transparent), 0 0 30px rgba(59, 130, 246, 0.2)',
            marginBottom: '24px',
            position: 'relative',
          }}
          className="update-icon-pulse"
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '22px',
            fontWeight: '800',
            letterSpacing: '-0.025em',
            margin: '0 0 8px 0',
            background: 'linear-gradient(to right, #ffffff, #f1f5f9)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          New Version Available!
        </h3>

        {/* Version tags */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '22px',
            fontSize: '13px',
          }}
        >
          <span style={{ color: '#94a3b8' }}>v{currentVersionStr}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
          <span
            style={{
              color: '#38bdf8',
              fontWeight: '700',
              background: 'rgba(56, 189, 248, 0.12)',
              padding: '2px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(56, 189, 248, 0.2)',
            }}
          >
            v{latestVersionStr}
          </span>
        </div>

        {/* Release Notes */}
        {releaseNotes && (
          <div
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'left',
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#cbd5e1',
              maxHeight: '120px',
              overflowY: 'auto',
              marginBottom: '28px',
            }}
          >
            <strong style={{ display: 'block', color: '#ffffff', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              What's New:
            </strong>
            {releaseNotes}
          </div>
        )}

        {/* Interactive Downloader Container */}
        {downloading ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* linear progress bar */}
            <div
              style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '999px',
                overflow: 'hidden',
                marginBottom: '16px',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${downloadProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(to right, var(--primary), #3b82f6)',
                  borderRadius: '999px',
                  transition: 'width 0.2s ease-out',
                  boxShadow: '0 0 8px color-mix(in srgb, var(--primary) 50%, transparent)',
                }}
              />
            </div>

            {/* Status message */}
            <span
              style={{
                fontSize: '13px',
                color: '#94a3b8',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg className="animate-spin-updater" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="#3b82f6" />
              </svg>
              {statusMessage}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {/* Primary Action Button */}
            <button
              onClick={handleUpdate}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 4px 18px color-mix(in srgb, var(--primary) 35%, transparent), 0 0 0 2px rgba(255, 255, 255, 0.05)',
                transition: 'all 0.2s',
              }}
              className="update-action-btn"
            >
              Update Now
            </button>

            {/* Cancel Button (only if not forced) */}
            {!isForceUpdate && (
              <button
                onClick={() => setUpdateAvailable(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '14px',
                  background: 'transparent',
                  color: '#94a3b8',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                }}
                className="update-cancel-btn"
              >
                Later
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInAppUpdater {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleInAppUpdater {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .update-action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 22px rgba(79, 70, 229, 0.45), 0 0 0 2px rgba(255, 255, 255, 0.1) !important;
        }
        .update-action-btn:active {
          transform: translateY(0);
        }
        .update-cancel-btn:hover {
          color: #ffffff !important;
        }
        .animate-spin-updater {
          animation: spin-updater 1s linear infinite;
        }
        @keyframes spin-updater {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .update-icon-pulse {
          animation: updater-pulse 2s infinite;
        }
        @keyframes updater-pulse {
          0% { transform: scale(1); box-shadow: 0 8px 24px rgba(79, 70, 229, 0.4); }
          50% { transform: scale(1.05); box-shadow: 0 8px 30px rgba(79, 70, 229, 0.6), 0 0 20px rgba(59, 130, 246, 0.3); }
          100% { transform: scale(1); box-shadow: 0 8px 24px rgba(79, 70, 229, 0.4); }
        }
      `}</style>
    </div>
  )
}
