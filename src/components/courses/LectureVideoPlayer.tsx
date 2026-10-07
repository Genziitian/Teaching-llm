'use client'

import { useEffect, useState } from 'react'
import { Play, AlertCircle } from 'lucide-react'
import { detectDevice } from '@/lib/device'
import SecureYouTubePlayer, {
  extractYouTubeId,
  isLikelyYouTubeLive,
} from './SecureYouTubePlayer'

interface LectureVideoPlayerProps {
  videoUrl?: string       // Google Drive video URL
  youtubeUrl?: string     // YouTube video URL
  videoSource?: string    // Default source indicator (e.g., 'GOOGLE_DRIVE' or 'YOUTUBE')
  title: string           // Lecture/video title
  fill?: boolean          // If true, takes 100% height/width (no border radius/margins)
  contentId?: string      // For server-side video resume (YouTube only)
  selectedSource?: 'GOOGLE' | 'YOUTUBE'
  onSourceChange?: (source: 'GOOGLE' | 'YOUTUBE') => void
  hideToggle?: boolean
}

export default function LectureVideoPlayer({
  videoUrl,
  youtubeUrl,
  videoSource = 'GOOGLE_DRIVE',
  title,
  fill = false,
  contentId,
  selectedSource,
  onSourceChange,
  hideToggle = false,
}: LectureVideoPlayerProps) {
  const [isNativeApp, setIsNativeApp] = useState(false)
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [internalSource, setInternalSource] = useState<'GOOGLE' | 'YOUTUBE'>('GOOGLE')

  const activeSource = selectedSource || internalSource
  const setActiveSource = onSourceChange || setInternalSource

  // 1. Platform & Device Detection
  useEffect(() => {
    const detectPlatform = () => {
      if (typeof window === 'undefined') return

      // Detect WebView/Capacitor app
      const w = window as any
      const native =
        document.documentElement.classList.contains('is-native') ||
        Boolean(w.Capacitor?.isNativePlatform?.() || w.Capacitor?.isNative)
      setIsNativeApp(native)

      // Phones only. Tablets (iPad, Android tablets) are NOT treated as
      // mobile: in a tablet browser the student can play whichever source the
      // lecture has (Google Drive or YouTube), same as on a laptop.
      const mobile = detectDevice().formFactor === 'phone'
      setIsMobileDevice(mobile)
    }

    detectPlatform()
    const observer = new MutationObserver(detectPlatform)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  // 2. Compute available sources
  const hasYouTubeLink = Boolean(
    youtubeUrl ||
    (videoUrl && (videoSource === 'YOUTUBE' || /youtu\.?be|youtube\.com/i.test(videoUrl)))
  )

  const hasDriveLink = Boolean(
    videoUrl && !/youtu\.?be|youtube\.com/i.test(videoUrl)
  )

  const getYouTubeUrl = (): string | null => {
    if (youtubeUrl) return youtubeUrl
    if (videoUrl && /youtu\.?be|youtube\.com/i.test(videoUrl)) return videoUrl
    return null
  }

  const getEmbedUrl = (url: string | undefined): string => {
    if (!url) return ''
    const u = url.trim()
    const fileIdMatch = u.match(/\/d\/([\w-]+)/) || u.match(/[?&]id=([\w-]+)/)
    if (fileIdMatch) {
      return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`
    }
    return u
  }

  // 3. Fallback logic based on platform classification
  const isMobilePlatform = isNativeApp || isMobileDevice

  useEffect(() => {
    if (isMobilePlatform) {
      setActiveSource('YOUTUBE')
    } else {
      // Desktop/Laptop: Google Drive is primary
      if (hasDriveLink) {
        setActiveSource('GOOGLE')
      } else if (hasYouTubeLink) {
        setActiveSource('YOUTUBE')
      }
    }
  }, [isMobilePlatform, hasDriveLink, hasYouTubeLink, setActiveSource])

  // 4. Render toggle (only on Desktop if both sources are available)
  const showSourceToggle = !hideToggle && !isMobilePlatform && hasDriveLink && hasYouTubeLink

  const renderSourceToggle = () => {
    if (!showSourceToggle) return null
    return (
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '14px',
        alignItems: 'center',
        padding: '0 4px'
      }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
          Source:
        </span>
        <div style={{
          display: 'inline-flex',
          background: 'var(--surface-2)',
          padding: '3px',
          borderRadius: '20px',
          boxShadow: 'inset 2px 2px 5px var(--neu-dark), inset -2px -2px 5px var(--neu-light)'
        }}>
          <button
            type="button"
            onClick={() => setActiveSource('GOOGLE')}
            style={{
              border: 'none',
              padding: '4px 14px',
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              background: activeSource === 'GOOGLE' ? 'var(--accent)' : 'transparent',
              color: activeSource === 'GOOGLE' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            GOOGLE
          </button>
          <button
            type="button"
            onClick={() => setActiveSource('YOUTUBE')}
            style={{
              border: 'none',
              padding: '4px 14px',
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              background: activeSource === 'YOUTUBE' ? 'var(--accent)' : 'transparent',
              color: activeSource === 'YOUTUBE' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            YOUTUBE
          </button>
        </div>
      </div>
    )
  }

  // 5. Build components to return
  const renderPlayer = () => {
    // ----------------------------------------------------
    // CASE A: MOBILE PLATFORM (Capacitor App or Mobile Web)
    // ----------------------------------------------------
    if (isMobilePlatform) {
      if (hasYouTubeLink) {
        const ytUrl = getYouTubeUrl()
        const ytId = ytUrl ? extractYouTubeId(ytUrl) : null
        if (ytId) {
          return (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              <SecureYouTubePlayer
                videoId={ytId}
                contentId={contentId}
                title={title}
                isLive={isLikelyYouTubeLive(ytUrl!)}
              />
            </div>
          )
        }
      }

      // If YouTube link is missing, show App unsupported Google Drive warning
      return (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1b4b, #0f172a)',
          color: '#fff', padding: '20px', textAlign: 'center'
        }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '16px', border: '1px solid rgba(239, 68, 68, 0.25)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}>
            <AlertCircle size={28} color="#ef4444" />
          </div>
          <span style={{ fontSize: '15px', fontWeight: '800', color: '#f87171', marginBottom: '8px' }}>
            Video not playing on mobile
          </span>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '280px', lineHeight: '1.4' }}>
            Please use laptop or browser to watch this lecture.
          </p>
        </div>
      )
    }

    // ----------------------------------------------------
    // CASE B: DESKTOP / LAPTOP PLATFORM
    // ----------------------------------------------------
    if (activeSource === 'YOUTUBE' && hasYouTubeLink) {
      const ytUrl = getYouTubeUrl()
      const ytId = ytUrl ? extractYouTubeId(ytUrl) : null
      if (ytId) {
        return (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <SecureYouTubePlayer
              videoId={ytId}
              contentId={contentId}
              title={title}
              isLive={isLikelyYouTubeLive(ytUrl!)}
            />
          </div>
        )
      }
    }

    if (activeSource === 'GOOGLE' && hasDriveLink) {
      return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          <iframe
            src={getEmbedUrl(videoUrl)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            scrolling="no"
            onContextMenu={e => e.preventDefault()}
            style={{ width: '100%', height: '100%', border: 'none', overflow: 'hidden', background: '#000' }}
          />
        </div>
      )
    }

    // Fallback
    if (hasDriveLink) {
      return (
        <iframe
          src={getEmbedUrl(videoUrl)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          scrolling="no"
          onContextMenu={e => e.preventDefault()}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', overflow: 'hidden', background: '#000' }}
        />
      )
    }

    if (hasYouTubeLink) {
      const ytUrl = getYouTubeUrl()
      const ytId = ytUrl ? extractYouTubeId(ytUrl) : null
      if (ytId) {
        return (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <SecureYouTubePlayer
              videoId={ytId}
              contentId={contentId}
              title={title}
              isLive={isLikelyYouTubeLive(ytUrl!)}
            />
          </div>
        )
      }
    }

    return (
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-secondary)', textAlign: 'center', padding: '20px'
      }}>
        <Play size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-muted)' }}>No video available</h3>
        <p style={{ fontSize: '14px' }}>This lecture doesn't have a video attached.</p>
      </div>
    )
  }

  return (
    <>
      {renderSourceToggle()}
      <div style={fill ? {
        background: '#000',
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      } : {
        background: 'var(--text-primary)',
        borderRadius: isMobilePlatform ? '16px' : '24px',
        overflow: 'hidden',
        boxShadow: isMobilePlatform ? '0 14px 32px -10px rgba(15, 23, 42, 0.40)' : '0 20px 40px rgba(0,0,0,0.15)',
        position: 'relative',
        paddingTop: '56.25%', // 16:9 Aspect Ratio
        width: '100%',
        marginBottom: isMobilePlatform ? '10px' : '32px',
      }}>
        {renderPlayer()}
      </div>
    </>
  )
}
