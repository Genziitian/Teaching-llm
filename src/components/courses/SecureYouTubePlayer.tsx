'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
} from 'lucide-react'

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
    __secureYtIframeApiPromise?: Promise<void>
  }
}

const YT_QUALITY_PREF_KEY = 'preferredVideoQuality'
const YT_QUALITY_LEGACY_PREF_KEY = 'yt_quality_pref'
const YT_QUALITY_AUTO = 'auto'
const YT_SPEED_PREF_KEY = 'yt_speed_pref'
const YT_POSITION_PREFIX = 'yt_pos_'
const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

const QUALITY_LABELS: Record<string, string> = {
  highres: '2160p',
  hd2160: '2160p',
  hd1440: '1440p',
  hd1080: '1080p',
  hd720: '720p',
  large: '480p',
  medium: '360p',
  small: '240p',
  tiny: '144p',
  auto: 'Auto',
}

const QUALITY_HEIGHTS: Record<string, number> = {
  highres: 2160,
  hd2160: 2160,
  hd1440: 1440,
  hd1080: 1080,
  hd720: 720,
  large: 480,
  medium: 360,
  small: 240,
  tiny: 144,
}

type PreferredQuality = number | typeof YT_QUALITY_AUTO

function parsePreferredQuality(value: string | null): PreferredQuality | null {
  if (!value) return null
  if (value === YT_QUALITY_AUTO) return YT_QUALITY_AUTO
  if (QUALITY_HEIGHTS[value]) return QUALITY_HEIGHTS[value]

  const match = value.match(/\d+/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function readPreferredQuality(): PreferredQuality {
  if (typeof window === 'undefined') return YT_QUALITY_AUTO

  try {
    const saved = parsePreferredQuality(localStorage.getItem(YT_QUALITY_PREF_KEY))
    if (saved !== null) return saved

    const legacy = parsePreferredQuality(localStorage.getItem(YT_QUALITY_LEGACY_PREF_KEY))
    if (legacy !== null) {
      localStorage.setItem(YT_QUALITY_PREF_KEY, String(legacy))
      return legacy
    }
  } catch {}

  return YT_QUALITY_AUTO
}

function writePreferredQuality(quality: string) {
  if (typeof window === 'undefined') return

  try {
    if (quality === YT_QUALITY_AUTO) {
      localStorage.setItem(YT_QUALITY_PREF_KEY, YT_QUALITY_AUTO)
      return
    }

    const height = QUALITY_HEIGHTS[quality]
    if (height) localStorage.setItem(YT_QUALITY_PREF_KEY, String(height))
  } catch {}
}

function qualityTokenFromPreference(preference: PreferredQuality): string {
  if (preference === YT_QUALITY_AUTO) return YT_QUALITY_AUTO
  if (preference >= 2160) return 'hd2160'
  if (preference >= 1440) return 'hd1440'
  if (preference >= 1080) return 'hd1080'
  if (preference >= 720) return 'hd720'
  if (preference >= 480) return 'large'
  if (preference >= 360) return 'medium'
  if (preference >= 240) return 'small'
  return 'tiny'
}

function closestAvailableQuality(preference: PreferredQuality, available: string[]): string {
  if (preference === YT_QUALITY_AUTO) return YT_QUALITY_AUTO

  const ranked = available
    .map(quality => ({ quality, height: QUALITY_HEIGHTS[quality] || 0 }))
    .filter(item => item.height > 0)
    .sort((a, b) => b.height - a.height)

  if (ranked.length === 0) return qualityTokenFromPreference(preference)

  const belowOrExact = ranked.find(item => item.height <= preference)
  return belowOrExact?.quality || ranked[ranked.length - 1].quality
}

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.YT?.Player) return Promise.resolve()
  if (window.__secureYtIframeApiPromise) return window.__secureYtIframeApiPromise

  window.__secureYtIframeApiPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if (!existing) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.async = true
      document.body.appendChild(tag)
    }

    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      try { prev?.() } catch {}
      resolve()
    }

    if (window.YT?.Player) resolve()
  })

  return window.__secureYtIframeApiPromise
}

export function extractYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null
  const s = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s) && !s.includes('/')) return s

  const patterns = [
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube(?:-nocookie)?\.com\/)(?:watch\?v=|embed\/|live\/|shorts\/|v\/)([A-Za-z0-9_-]{11})/,
    /(?:m\.youtube\.com\/)(?:watch\?v=|embed\/|live\/|shorts\/)([A-Za-z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = s.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

export function isLikelyYouTubeLive(input: string | null | undefined): boolean {
  if (!input) return false
  const s = input.toLowerCase()
  return s.includes('/live/') || s.includes('live_stream')
}

interface Props {
  videoId: string
  contentId?: string      // LectureProgress contentId — for server-side resume sync
  title?: string
  aspectRatio?: string
  autoplay?: boolean
  isLive?: boolean
  onEnded?: () => void
  onProgress?: () => void
}

export default function SecureYouTubePlayer({
  videoId,
  contentId,
  title,
  aspectRatio = '16 / 9',
  autoplay = false,
  isLive: initialIsLive = false,
  onEnded,
  onProgress,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressFiredRef = useRef(false)
  const onProgressRef = useRef(onProgress)
  const preferredQualityRef = useRef<PreferredQuality>(YT_QUALITY_AUTO)
  const preferredQualityAppliedRef = useRef(false)
  const preferredQualityAppliedWithLevelsRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(true)
  const [ended, setEnded] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLive, setIsLive] = useState(initialIsLive)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [availableQualities, setAvailableQualities] = useState<string[]>([])
  const [currentQuality, setCurrentQuality] = useState(YT_QUALITY_AUTO)
  const [showQualitySheet, setShowQualitySheet] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showSpeedSheet, setShowSpeedSheet] = useState(false)

  useEffect(() => { onProgressRef.current = onProgress }, [onProgress])

  const screenOrientationRef = useRef<any>(null)

  useEffect(() => {
    let active = true
    const loadPlugins = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (Capacitor.isNativePlatform() && active) {
          const orientationMod = await import('@capacitor/screen-orientation')
          screenOrientationRef.current = orientationMod.ScreenOrientation
        }
      } catch (err) {
        console.warn('Failed to load screen orientation plugin', err)
      }
    }
    loadPlugins()
    return () => {
      active = false
    }
  }, [])

  const updateQualities = useCallback(() => {
    const player = playerRef.current
    if (!player) return []

    try {
      const raw = player.getAvailableQualityLevels?.() ?? []
      const levels = Array.isArray(raw)
        ? raw.filter((q: string) => q && q !== YT_QUALITY_AUTO && QUALITY_LABELS[q])
        : []
      setAvailableQualities(levels)
      return levels
    } catch {}
    return []
  }, [])

  const applyPreferredQuality = useCallback((levels: string[] = []) => {
    const player = playerRef.current
    const preference = preferredQualityRef.current
    if (!player || preference === YT_QUALITY_AUTO) return
    if (levels.length > 0 && preferredQualityAppliedWithLevelsRef.current) return
    if (levels.length === 0 && preferredQualityAppliedRef.current) return

    const quality = closestAvailableQuality(preference, levels)
    try { player.setPlaybackQuality?.(quality) } catch {}
    setCurrentQuality(quality)
    preferredQualityAppliedRef.current = true
    if (levels.length > 0) preferredQualityAppliedWithLevelsRef.current = true
  }, [])

  const qualityDisplayLabel = useCallback(() => {
    if (availableQualities.length === 0) return ''
    if (currentQuality === YT_QUALITY_AUTO) {
      const actual = playerRef.current?.getPlaybackQuality?.()
      const resolved = actual && actual !== 'auto' && actual !== 'unknown'
        ? QUALITY_LABELS[actual] || actual
        : QUALITY_LABELS[availableQualities[0]] || availableQualities[0]
      return `Auto · ${resolved}`
    }
    return QUALITY_LABELS[currentQuality] || currentQuality
  }, [availableQualities, currentQuality])

  const fireProgressIfPast90 = useCallback((currentSec: number, totalSec: number) => {
    if (progressFiredRef.current) return
    if (!Number.isFinite(totalSec) || totalSec <= 0) return
    if (currentSec / totalSec >= 0.9) {
      progressFiredRef.current = true
      try { onProgressRef.current?.() } catch {}
    }
  }, [])

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (!playing) return
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000)
  }, [playing])

  const revealControls = useCallback(() => {
    setShowControls(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    let destroyed = false
    progressFiredRef.current = false
    setReady(false)
    setBuffering(true)
    setErrorMsg(null)
    setEnded(false)
    setPosition(0)
    setDuration(0)
    setIsLive(initialIsLive)
    setShowQualitySheet(false)
    setShowSpeedSheet(false)
    preferredQualityAppliedRef.current = false
    preferredQualityAppliedWithLevelsRef.current = false

    loadYouTubeIframeApi().then(() => {
      if (destroyed || !hostRef.current || !window.YT?.Player) return

      const savedQuality = readPreferredQuality()
      preferredQualityRef.current = savedQuality
      setCurrentQuality(qualityTokenFromPreference(savedQuality))

      const savedSpeed = parseFloat(localStorage.getItem(YT_SPEED_PREF_KEY) || '1')
      const validSpeed = SPEED_OPTIONS.includes(savedSpeed) ? savedSpeed : 1
      setSpeed(validSpeed)

      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          showinfo: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          fs: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (destroyed) return
            const player = playerRef.current
            try {
              const d = player?.getDuration?.() ?? 0
              const live = initialIsLive || !Number.isFinite(d) || d === 0 || Boolean(player?.getVideoData?.()?.isLive)
              setIsLive(live)
              setDuration(Number.isFinite(d) ? d : 0)
              const levels = updateQualities()
              applyPreferredQuality(levels)
              if (validSpeed !== 1) player?.setPlaybackRate?.(validSpeed)

              // Resume from saved position
              if (!live) {
                try {
                  // Instant resume from localStorage first
                  const savedPos = parseFloat(localStorage.getItem(YT_POSITION_PREFIX + videoId) || '0')
                  const totalDur = Number.isFinite(d) ? d : 0
                  if (savedPos > 5 && totalDur > 0 && savedPos < totalDur - 30) {
                    player?.seekTo?.(savedPos, true)
                    setPosition(savedPos)
                  }
                  // Then fetch server position (may override if newer)
                  if (contentId) {
                    fetch(`/api/lectures/video-position?contentId=${contentId}`)
                      .then(r => r.json())
                      .then(data => {
                        if (destroyed) return
                        const serverPos = data?.position ?? 0
                        const dur = playerRef.current?.getDuration?.() ?? totalDur
                        if (serverPos > 5 && dur > 0 && serverPos < dur - 30 && serverPos > savedPos) {
                          playerRef.current?.seekTo?.(serverPos, true)
                          setPosition(serverPos)
                          localStorage.setItem(YT_POSITION_PREFIX + videoId, String(serverPos))
                        }
                      })
                      .catch(() => {})
                  }
                } catch {}
              }

              if (autoplay) player?.playVideo?.()
            } catch {}
            setReady(true)
            setBuffering(false)
          },
          onStateChange: (event: any) => {
            if (destroyed) return
            const state = event.data
            setPlaying(state === window.YT.PlayerState.PLAYING)
            setBuffering(state === window.YT.PlayerState.BUFFERING)
            if (state === window.YT.PlayerState.PLAYING) {
              setEnded(false)
              try {
                const d = playerRef.current?.getDuration?.() ?? 0
                const live = initialIsLive || !Number.isFinite(d) || d === 0 || Boolean(playerRef.current?.getVideoData?.()?.isLive)
                setIsLive(live)
                setDuration(Number.isFinite(d) ? d : 0)
                const levels = updateQualities()
                applyPreferredQuality(levels)
              } catch {}
            }
            if (state === window.YT.PlayerState.ENDED) {
              setEnded(true)
              setPlaying(false)
              // Clear saved position — video fully watched, next open starts fresh
              try { localStorage.removeItem(YT_POSITION_PREFIX + videoId) } catch {}
              if (contentId) {
                fetch('/api/lectures/video-position', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contentId, position: 0 }),
                }).catch(() => {})
              }
              if (!progressFiredRef.current) {
                progressFiredRef.current = true
                try { onProgressRef.current?.() } catch {}
              }
              onEnded?.()
            }
          },
          onError: (event: any) => {
            const code = event?.data
            const isEmbedBlocked = code === 101 || code === 150 || code === 152
            setBuffering(false)
            setErrorMsg(
              isEmbedBlocked
                ? 'This YouTube video cannot be played inside the web player because embedding is restricted.'
                : 'Could not load the YouTube video. Check your connection and try again.'
            )
          },
        },
      })
    })

    return () => {
      destroyed = true
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      try { playerRef.current?.destroy?.() } catch {}
      playerRef.current = null
    }
  }, [applyPreferredQuality, autoplay, initialIsLive, onEnded, updateQualities, videoId])

  useEffect(() => {
    if (!playing) {
      setShowControls(true)
      return
    }
    scheduleHide()
  }, [playing, scheduleHide])

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      try {
        const player = playerRef.current
        const current = player?.getCurrentTime?.() ?? 0
        const total = player?.getDuration?.() ?? duration
        setPosition(typeof current === 'number' ? current : 0)
        if (typeof total === 'number' && Number.isFinite(total)) setDuration(total)
        fireProgressIfPast90(current, total)
      } catch {}
    }, 250)
    return () => clearInterval(timer)
  }, [duration, fireProgressIfPast90, playing])

  // Save playback position to localStorage every 5 seconds
  useEffect(() => {
    if (!playing || isLive) return
    const saveTimer = setInterval(() => {
      try {
        const current = playerRef.current?.getCurrentTime?.() ?? 0
        if (current > 5) {
          localStorage.setItem(YT_POSITION_PREFIX + videoId, String(Math.floor(current)))
        }
      } catch {}
    }, 5000)
    return () => clearInterval(saveTimer)
  }, [playing, isLive, videoId])

  // Sync playback position to server every 15 seconds (cross-device resume)
  useEffect(() => {
    if (!playing || isLive || !contentId) return
    const syncTimer = setInterval(() => {
      try {
        const current = playerRef.current?.getCurrentTime?.() ?? 0
        if (current > 5) {
          fetch('/api/lectures/video-position', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentId, position: Math.floor(current) }),
          }).catch(() => {})
        }
      } catch {}
    }, 15000)
    return () => clearInterval(syncTimer)
  }, [playing, isLive, contentId])

  useEffect(() => {
    const onFullscreenChange = () => {
      const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement
      setIsFullscreen(Boolean(fsElement))
      if (fsElement) {
        if (screenOrientationRef.current) {
          screenOrientationRef.current.unlock().catch(() => {})
        }
      } else {
        if (screenOrientationRef.current) {
          screenOrientationRef.current.lock({ orientation: 'portrait' }).catch(() => {})
        } else {
          try { (screen.orientation as any)?.unlock?.() } catch {}
        }
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange as any)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange as any)
    }
  }, [])

  // ─── Cleanup orientation lock on unmount
  useEffect(() => {
    return () => {
      if (screenOrientationRef.current) {
        screenOrientationRef.current.lock({ orientation: 'portrait' }).catch(() => {})
      } else {
        try {
          import('@capacitor/screen-orientation').then(async (mod) => {
            await mod?.ScreenOrientation?.lock?.({ orientation: 'portrait' })
          }).catch(() => {})
        } catch {}
      }
    }
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        try { playerRef.current?.pauseVideo?.() } catch {}
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!isFullscreen) return
    let removeListener: (() => void) | null = null
    let cancelled = false
    ;(async () => {
      try {
        const mod: any = await import('@capacitor/app').catch(() => null)
        if (!mod || cancelled) return
        const handle = await mod.App.addListener('backButton', () => {
          try { document.exitFullscreen?.() } catch {}
        })
        removeListener = () => { try { handle?.remove?.() } catch {} }
      } catch {}
    })()
    return () => {
      cancelled = true
      removeListener?.()
    }
  }, [isFullscreen])

  function toggleControls() {
    setShowControls(v => {
      const next = !v
      if (next) scheduleHide()
      return next
    })
  }

  function togglePlay() {
    const player = playerRef.current
    if (!player) return
    if (ended) {
      player.seekTo?.(0, true)
      player.playVideo?.()
      setEnded(false)
    } else if (playing) {
      player.pauseVideo?.()
    } else {
      player.playVideo?.()
    }
    revealControls()
  }

  function seekTo(target: number) {
    if (isLive) return
    const clamped = Math.max(0, Math.min(duration || target, target))
    try { playerRef.current?.seekTo?.(clamped, true) } catch {}
    setPosition(clamped)
    revealControls()
  }

  function skip(seconds: number) {
    if (isLive) return
    const current = playerRef.current?.getCurrentTime?.() ?? position
    seekTo(current + seconds)
  }

  async function toggleFullscreen() {
    const el: any = wrapperRef.current
    if (!el) return

    if (isFullscreen) {
      try { await (document.exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.()) } catch {}
      if (screenOrientationRef.current) {
        screenOrientationRef.current.lock({ orientation: 'portrait' }).catch(() => {})
      } else {
        try { (screen.orientation as any)?.unlock?.() } catch {}
      }
      return
    }

    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' } as any)
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
    } catch {}

    if (screenOrientationRef.current) {
      screenOrientationRef.current.unlock().catch(() => {})
    } else {
      const isPhone = window.matchMedia('(max-width: 768px)').matches
      if (isPhone) {
        try { await (screen.orientation as any)?.lock?.('landscape') } catch {}
      }
    }

    revealControls()
  }

  function pickQuality(quality: string) {
    setCurrentQuality(quality)
    writePreferredQuality(quality)
    preferredQualityRef.current = parsePreferredQuality(quality) || YT_QUALITY_AUTO
    preferredQualityAppliedRef.current = quality !== YT_QUALITY_AUTO
    preferredQualityAppliedWithLevelsRef.current = quality !== YT_QUALITY_AUTO
    try {
      if (quality === YT_QUALITY_AUTO) {
        playerRef.current?.setPlaybackQuality?.('default')
      } else {
        playerRef.current?.setPlaybackQuality?.(quality)
      }
    } catch {}
    setShowQualitySheet(false)
    revealControls()
  }

  function pickSpeed(rate: number) {
    setSpeed(rate)
    localStorage.setItem(YT_SPEED_PREF_KEY, String(rate))
    try { playerRef.current?.setPlaybackRate?.(rate) } catch {}
    setShowSpeedSheet(false)
    revealControls()
  }

  const canSeek = !isLive && duration > 0
  const playedPct = canSeek ? Math.min(100, (position / duration) * 100) : 0
  const qualityLabel = qualityDisplayLabel()

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={e => {
        if (e.code === 'Space') { e.preventDefault(); togglePlay() }
        else if (e.code === 'KeyF') { e.preventDefault(); toggleFullscreen() }
        else if (!isLive && e.code === 'ArrowLeft') { e.preventDefault(); skip(-10) }
        else if (!isLive && e.code === 'ArrowRight') { e.preventDefault(); skip(10) }
      }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        aspectRatio,
        background: '#000',
        borderRadius: isFullscreen ? 0 : '16px',
        overflow: 'hidden',
        outline: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <div
        className="secure-yt-surface"
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'scale(1.12)',
          transformOrigin: 'center center',
          pointerEvents: 'none',
        }}
      >
        <div ref={hostRef} className="secure-yt-host" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      </div>

      <button
        aria-label={showControls ? 'Hide controls' : 'Show controls'}
        onClick={toggleControls}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
        }}
      />

      {buffering && !errorMsg && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 4, pointerEvents: 'none' }}>
          <Loader2 size={38} color="#fff" strokeWidth={2.6} className="secure-yt-spin" />
        </div>
      )}

      {!ready && !errorMsg && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 3, color: 'rgba(255,255,255,0.72)', fontSize: '13px', fontWeight: 600 }}>
          Loading player...
        </div>
      )}

      {errorMsg && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center', padding: '24px' }}>
          <AlertCircle size={42} color="#f87171" />
          <p style={{ maxWidth: '440px', margin: 0, color: 'rgba(255,255,255,0.78)', fontSize: '13px', lineHeight: 1.5 }}>{errorMsg}</p>
        </div>
      )}

      {!errorMsg && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none',
            transition: 'opacity 180ms ease',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.8) 100%)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px 0' }}>
            {isLive && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '50px', background: '#ef4444', color: '#fff', fontSize: '10.5px', fontWeight: 600, letterSpacing: '1.2px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff' }} />
                LIVE
              </span>
            )}
            {title ? (
              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff', fontSize: '13.5px', fontWeight: 600 }}>
                {title}
              </div>
            ) : (
              <div style={{ flex: 1 }} />
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
            {!isLive && (
              <CircleAction label="Skip back 10 seconds" onClick={() => skip(-10)}>
                <RotateCcw size={24} />
              </CircleAction>
            )}
            <CircleAction label={playing ? 'Pause' : 'Play'} onClick={togglePlay} size={72}>
              {playing ? <Pause size={36} fill="currentColor" /> : <Play size={38} fill="currentColor" style={{ marginLeft: 3 }} />}
            </CircleAction>
            {!isLive && (
              <CircleAction label="Skip forward 10 seconds" onClick={() => skip(10)}>
                <RotateCw size={24} />
              </CircleAction>
            )}
          </div>

          <div style={{ padding: '0 12px 10px' }}>
            {!isLive && (
              <div style={{ position: 'relative', height: '28px', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, height: '3px', borderRadius: '99px', background: 'rgba(255,255,255,0.27)' }}>
                  <div style={{ width: `${playedPct}%`, height: '100%', borderRadius: '99px', background: 'var(--primary)' }} />
                </div>
                <div style={{ position: 'absolute', left: `${playedPct}%`, transform: 'translateX(-50%)', width: '14px', height: '14px', borderRadius: '50%', background: '#fff' }} />
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.5}
                  value={Math.min(position, duration || position)}
                  onChange={e => seekTo(Number(e.target.value))}
                  aria-label="Seek video"
                  className="secure-yt-scrubber"
                  style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', margin: 0 }}
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#fff', fontSize: '11.5px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {isLive ? 'Live' : `${fmtTime(position)} / ${fmtTime(duration)}`}
              </span>
              <div style={{ flex: 1 }} />
              {!isLive && (
                <button
                  type="button"
                  onClick={() => { setShowSpeedSheet(true); setShowQualitySheet(false) }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    border: 0,
                    borderRadius: '8px',
                    padding: '6px 10px',
                    color: '#fff',
                    background: 'rgba(0,0,0,0.32)',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: 600,
                  }}
                >
                  <Gauge size={16} />
                  {speed === 1 ? 'Speed' : `${speed}×`}
                </button>
              )}
              {!isLive && availableQualities.length > 0 && qualityLabel && (
                <button
                  type="button"
                  onClick={() => { setShowQualitySheet(true); setShowSpeedSheet(false) }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    border: 0,
                    borderRadius: '8px',
                    padding: '6px 10px',
                    color: '#fff',
                    background: 'rgba(0,0,0,0.32)',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: 600,
                  }}
                >
                  <Settings size={16} />
                  {qualityLabel}
                </button>
              )}
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                style={{
                  width: '38px',
                  height: '38px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 0,
                  borderRadius: '10px',
                  color: '#fff',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {ended && !errorMsg && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 7, background: 'rgba(0,0,0,0.8)', display: 'grid', placeItems: 'center' }}>
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Replay video"
            style={{ width: '76px', height: '76px', borderRadius: '50%', border: 0, background: 'transparent', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          >
            <RotateCcw size={56} fill="currentColor" />
          </button>
        </div>
      )}

      {showSpeedSheet && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 12, background: 'rgba(0,0,0,0.34)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowSpeedSheet(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'rgba(11,16,32,0.96)',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              padding: '14px 20px 18px',
              color: '#fff',
              boxShadow: '0 -16px 36px rgba(0,0,0,0.36)',
            }}
          >
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.34)', margin: '0 auto 12px' }} />
            <div style={{ fontSize: '17px', fontWeight: 600, marginBottom: '10px' }}>Playback Speed</div>
            {SPEED_OPTIONS.map(rate => (
              <QualityRow
                key={rate}
                label={rate === 1 ? 'Normal' : `${rate}×`}
                sub={rate === 1 ? 'Default speed' : rate < 1 ? 'Slower' : 'Faster'}
                selected={speed === rate}
                onClick={() => pickSpeed(rate)}
              />
            ))}
          </div>
        </div>
      )}

      {showQualitySheet && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 12, background: 'rgba(0,0,0,0.34)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowQualitySheet(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'rgba(11,16,32,0.96)',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              padding: '14px 20px 18px',
              color: '#fff',
              boxShadow: '0 -16px 36px rgba(0,0,0,0.36)',
            }}
          >
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.34)', margin: '0 auto 12px' }} />
            <div style={{ fontSize: '17px', fontWeight: 600, marginBottom: '10px' }}>Quality</div>
            <QualityRow
              label="Auto"
              sub={availableQualities.length ? `Best for your connection (up to ${QUALITY_LABELS[availableQualities[0]] || availableQualities[0]})` : ''}
              selected={currentQuality === YT_QUALITY_AUTO}
              onClick={() => pickQuality(YT_QUALITY_AUTO)}
            />
            {availableQualities.map(quality => (
              <QualityRow
                key={quality}
                label={QUALITY_LABELS[quality] || quality}
                sub="YouTube quality level"
                selected={currentQuality === quality}
                onClick={() => pickQuality(quality)}
              />
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .secure-yt-spin {
          animation: secureYtSpin 0.9s linear infinite;
        }
        @keyframes secureYtSpin {
          to { transform: rotate(360deg); }
        }
        .secure-yt-surface :global(iframe),
        .secure-yt-host :global(iframe) {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          max-height: none !important;
          display: block !important;
        }
        .secure-yt-scrubber::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          background: transparent;
        }
        .secure-yt-scrubber::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border: 0;
          background: transparent;
        }
      `}</style>
    </div>
  )
}

function CircleAction({
  children,
  label,
  onClick,
  size = 52,
}: {
  children: ReactNode
  label: string
  onClick: () => void
  size?: number
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        border: 0,
        color: '#fff',
        background: 'rgba(0,0,0,0.4)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </button>
  )
}

function QualityRow({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string
  sub: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        border: 0,
        borderRadius: '10px',
        background: selected ? 'rgba(128, 128, 128,0.18)' : 'transparent',
        color: '#fff',
        padding: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {selected ? <CheckCircle2 size={18} color="#6366f1" /> : <Circle size={18} color="rgba(255,255,255,0.6)" />}
      <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>{label}</span>
        {sub ? <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{sub}</span> : null}
      </span>
    </button>
  )
}

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${two(h)}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}
