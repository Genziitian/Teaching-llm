'use client'

/**
 * Unified custom video player.
 *
 * Supports two engines behind ONE consistent UI (skip ±10s, speed picker,
 * fullscreen with landscape lock on mobile, volume, scrubber, LIVE badge):
 *
 *   • YouTube (via the IFrame Player API + zoom-crop chrome hiding)
 *   • HTML5 <video> (used by our Google-Drive proxy stream)
 *
 * The component picks the engine based on `source.type`. Everything below the
 * engine-init code is shared.
 *
 * Why one component instead of two: the controls UI (skip, speed, scrubber,
 * fullscreen) is identical for both backends. Splitting it into two files
 * would duplicate ~250 lines of JSX for no gain.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
    __ytIframeApiPromise?: Promise<void>
  }
}

/** Load the YouTube IFrame API exactly once per page. */
function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.YT && window.YT.Player) return Promise.resolve()
  if (window.__ytIframeApiPromise) return window.__ytIframeApiPromise

  window.__ytIframeApiPromise = new Promise<void>((resolve) => {
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
    if (window.YT && window.YT.Player) resolve()
  })
  return window.__ytIframeApiPromise
}

export type VideoSource =
  | { type: 'youtube'; videoId: string }
  | { type: 'html5'; src: string }

interface Props {
  source: VideoSource
  aspect?: string
  onReady?: () => void
  onEnded?: () => void
  /** Fires ONCE when playback crosses 90% of the video, or when it ends.
   *  Use this to auto-mark a lecture as completed without waiting for the full run. */
  onProgress?: () => void
}

export default function CustomVideoPlayer({ source, aspect = '16 / 9', onReady, onEnded, onProgress }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)          // YT iframe mount point
  const videoElRef = useRef<HTMLVideoElement>(null)     // HTML5 video element
  const ytPlayerRef = useRef<any>(null)
  const speedMenuRef = useRef<HTMLDivElement>(null)
  // Keep onProgress in a ref so the engine init effects don't re-run when the
  // parent passes a new function identity on every render.
  const onProgressRef = useRef(onProgress)
  useEffect(() => { onProgressRef.current = onProgress })

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
  const progressFiredRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(80)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [isLive, setIsLive] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isYouTube = source.type === 'youtube'
  const sourceKey = isYouTube ? source.videoId : source.src

  // Reset the 90% completion latch + error state whenever the source changes
  useEffect(() => {
    progressFiredRef.current = false
    setErrorMsg(null)
    setReady(false)
  }, [sourceKey])

  function fireProgressIfPast90(currentSec: number, totalSec: number) {
    if (progressFiredRef.current) return
    if (totalSec <= 0 || !isFinite(totalSec)) return
    if (currentSec / totalSec >= 0.9) {
      progressFiredRef.current = true
      try { onProgressRef.current?.() } catch {}
    }
  }

  // ─── Engine init: YouTube
  useEffect(() => {
    if (!isYouTube) return
    let destroyed = false
    const videoId = (source as { type: 'youtube'; videoId: string }).videoId

    loadYouTubeIframeApi().then(() => {
      if (destroyed || !hostRef.current || !window.YT?.Player) return
      ytPlayerRef.current = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          showinfo: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          fs: 0,
          playsinline: 1,
          autoplay: 0,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        events: {
          onReady: () => {
            if (destroyed) return
            setReady(true)
            try {
              const d = ytPlayerRef.current.getDuration?.() ?? 0
              const live = !isFinite(d) || d === 0 || !!ytPlayerRef.current?.getVideoData?.()?.isLive
              setIsLive(live)
              setDuration(typeof d === 'number' && isFinite(d) ? d : 0)
              const v = ytPlayerRef.current.getVolume?.() ?? 80
              setVolume(typeof v === 'number' ? v : 80)
            } catch {}
            onReady?.()
          },
          onStateChange: (e: any) => {
            const s = e.data
            setPlaying(s === 1)
            setBuffering(s === 3)
            if (s === 0) {
              if (!progressFiredRef.current) { progressFiredRef.current = true; try { onProgressRef.current?.() } catch {} }
              onEnded?.()
            }
            if (s === 1) {
              try {
                const d = ytPlayerRef.current.getDuration?.() ?? 0
                const live = !isFinite(d) || d === 0 || !!ytPlayerRef.current?.getVideoData?.()?.isLive
                setIsLive(live)
                setDuration(typeof d === 'number' && isFinite(d) ? d : 0)
              } catch {}
            }
          },
        },
      })
    })

    return () => {
      destroyed = true
      try { ytPlayerRef.current?.destroy?.() } catch {}
      ytPlayerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey])

  // ─── Engine init: HTML5 <video>
  useEffect(() => {
    if (isYouTube) return
    const v = videoElRef.current
    if (!v) return

    const onLoadedMeta = () => {
      setReady(true)
      const d = isFinite(v.duration) ? v.duration : 0
      setDuration(d)
      setIsLive(!isFinite(v.duration))
      setVolume(Math.round(v.volume * 100))
      setMuted(v.muted)
      onReady?.()
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onWaiting = () => setBuffering(true)
    const onPlayingEv = () => setBuffering(false)
    const onEndedEv = () => {
      setPlaying(false)
      // Treat natural end as a definitive "watched" signal even if 90% logic missed
      if (!progressFiredRef.current) { progressFiredRef.current = true; try { onProgressRef.current?.() } catch {} }
      onEnded?.()
    }
    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime)
      fireProgressIfPast90(v.currentTime, isFinite(v.duration) ? v.duration : 0)
    }
    const onVolChange = () => { setVolume(Math.round(v.volume * 100)); setMuted(v.muted) }
    const onErrorEv = async () => {
      // Native MediaError codes (1..4) are useless on their own. Probe the URL
      // to get the JSON error our proxy actually returned (auth / Drive denial / etc).
      const code = v.error?.code
      const generic =
        code === 1 ? 'Video load was aborted'
        : code === 2 ? 'Network error while loading video'
        : code === 3 ? "Browser couldn't decode this video"
        : code === 4 ? 'Video source not supported'
        : 'Video could not be loaded'
      let detail = generic
      try {
        const src = (source as { type: 'html5'; src: string }).src
        const r = await fetch(src, { method: 'GET', headers: { Range: 'bytes=0-1' } })
        if (!r.ok) {
          const ct = r.headers.get('content-type') || ''
          if (ct.includes('application/json')) {
            const data = await r.json().catch(() => null)
            if (data?.error) detail = `${data.error}`
          } else {
            detail = `${generic} (HTTP ${r.status})`
          }
        }
      } catch {}
      setErrorMsg(detail)
    }

    v.addEventListener('loadedmetadata', onLoadedMeta)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('waiting', onWaiting)
    v.addEventListener('playing', onPlayingEv)
    v.addEventListener('ended', onEndedEv)
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('volumechange', onVolChange)
    v.addEventListener('error', onErrorEv)

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMeta)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('waiting', onWaiting)
      v.removeEventListener('playing', onPlayingEv)
      v.removeEventListener('ended', onEndedEv)
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('volumechange', onVolChange)
      v.removeEventListener('error', onErrorEv)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey])

  // ─── Tick currentTime while playing (YouTube only — HTML5 uses timeupdate event)
  useEffect(() => {
    if (!playing || !isYouTube) return
    const t = setInterval(() => {
      try {
        const ct = ytPlayerRef.current?.getCurrentTime?.() ?? 0
        const ctNum = typeof ct === 'number' ? ct : 0
        setCurrentTime(ctNum)
        let dur = duration
        if (!dur || dur < 1) {
          const d = ytPlayerRef.current?.getDuration?.() ?? 0
          if (d > 0) { setDuration(d); dur = d }
        }
        fireProgressIfPast90(ctNum, dur)
      } catch {}
    }, 250)
    return () => clearInterval(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration, isYouTube])

  // ─── Auto-hide controls 2.5s after playback starts
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setShowControls(false), 2500)
  }, [])
  useEffect(() => {
    if (playing) scheduleHide()
    else setShowControls(true)
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current) }
  }, [playing, scheduleHide])

  function flashControls() {
    setShowControls(true)
    if (playing) scheduleHide()
  }

  // ─── Fullscreen state tracking
  useEffect(() => {
    const onChange = () => {
      const el = (document.fullscreenElement || (document as any).webkitFullscreenElement)
      setIsFullscreen(!!el)
      if (el) {
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
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange as any)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange as any)
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

  // ─── Speed-menu: tap-outside closes it (mobile especially)
  useEffect(() => {
    if (!showSpeedMenu) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (!speedMenuRef.current) return
      if (!speedMenuRef.current.contains(e.target as Node)) setShowSpeedMenu(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [showSpeedMenu])

  // ─── Android back-button → exit fullscreen instead of leaving the page.
  // Uses @capacitor/app if present; no-op outside Capacitor.
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
    return () => { cancelled = true; removeListener?.() }
  }, [isFullscreen])

  // ─── Controls (engine-aware)
  function togglePlay() {
    if (isYouTube) {
      const p = ytPlayerRef.current
      if (!p) return
      if (playing) p.pauseVideo()
      else p.playVideo()
    } else {
      const v = videoElRef.current
      if (!v) return
      if (playing) v.pause()
      else v.play().catch(() => {})
    }
    flashControls()
  }
  function seekTo(seconds: number) {
    const clamped = Math.max(0, Math.min(duration || seconds, seconds))
    if (isYouTube) {
      try { ytPlayerRef.current?.seekTo?.(clamped, true) } catch {}
    } else {
      const v = videoElRef.current
      if (v) v.currentTime = clamped
    }
    setCurrentTime(clamped)
  }
  function skip(delta: number) {
    const base = isYouTube
      ? (ytPlayerRef.current?.getCurrentTime?.() ?? currentTime)
      : (videoElRef.current?.currentTime ?? currentTime)
    seekTo(base + delta)
    flashControls()
  }
  function toggleMute() {
    if (isYouTube) {
      const p = ytPlayerRef.current
      if (!p) return
      if (muted) { p.unMute(); setMuted(false) }
      else { p.mute(); setMuted(true) }
    } else {
      const v = videoElRef.current
      if (!v) return
      v.muted = !v.muted
      setMuted(v.muted)
    }
  }
  function setVolumePct(v: number) {
    const clamped = Math.max(0, Math.min(100, v))
    if (isYouTube) {
      try { ytPlayerRef.current?.setVolume?.(clamped) } catch {}
    } else {
      const el = videoElRef.current
      if (el) el.volume = clamped / 100
    }
    setVolume(clamped)
    if (clamped === 0) {
      if (isYouTube) { try { ytPlayerRef.current?.mute?.() } catch {} }
      else { const el = videoElRef.current; if (el) el.muted = true }
      setMuted(true)
    } else if (muted) {
      if (isYouTube) { try { ytPlayerRef.current?.unMute?.() } catch {} }
      else { const el = videoElRef.current; if (el) el.muted = false }
      setMuted(false)
    }
  }
  function setPlaybackRate(rate: number) {
    if (isYouTube) {
      try { ytPlayerRef.current?.setPlaybackRate?.(rate) } catch {}
    } else {
      const v = videoElRef.current
      if (v) v.playbackRate = rate
    }
    setSpeed(rate)
    setShowSpeedMenu(false)
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
      else if (el.msRequestFullscreen) el.msRequestFullscreen()
    } catch {}

    if (screenOrientationRef.current) {
      screenOrientationRef.current.unlock().catch(() => {})
    } else {
      const isPhone = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
      if (isPhone) {
        try { await (screen.orientation as any)?.lock?.('landscape') } catch {}
      }
    }
  }

  const pctPlayed = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onMouseMove={flashControls}
      onTouchStart={flashControls}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={e => {
        // Standard player keyboard shortcuts. Live videos can't seek meaningfully,
        // so arrow keys no-op when isLive.
        if (e.code === 'Space') { e.preventDefault(); togglePlay() }
        else if (e.code === 'KeyF') { e.preventDefault(); toggleFullscreen() }
        else if (e.code === 'KeyM') { e.preventDefault(); toggleMute() }
        else if (!isLive && e.code === 'ArrowRight') { e.preventDefault(); skip(10) }
        else if (!isLive && e.code === 'ArrowLeft') { e.preventDefault(); skip(-10) }
      }}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: aspect,
        paddingTop: '56.25%',
        background: '#000',
        borderRadius: isFullscreen ? 0 : '16px',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        outline: 'none',
      }}
    >
      {/* ── Engine surface ──
          YouTube: iframe inside a transform:scale(1.12) wrapper. The parent has
          overflow:hidden, so YouTube's top title row and bottom YT-wordmark get
          cropped out of the visible area. Side cropping is acceptable for 16:9
          lecture content.
          HTML5: native <video> — no chrome to hide, no zoom needed. */}
      {isYouTube ? (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            transform: 'scale(1.12)',
            transformOrigin: 'center center',
            pointerEvents: 'none',
          }}
        >
          <div
            ref={hostRef}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              pointerEvents: 'none',
            }}
          />
        </div>
      ) : (
        <video
          ref={videoElRef}
          src={(source as { type: 'html5'; src: string }).src}
          playsInline
          preload="metadata"
          controlsList="nodownload"
          onContextMenu={e => e.preventDefault()}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: '#000', objectFit: 'contain',
          }}
        />
      )}

      {/* PAUSE MASK — only meaningful for YouTube. Hides the .ytp-pause-overlay-container
          "More videos" thumbnail grid that appears on pause. */}
      {isYouTube && ready && !playing && (
        <div
          aria-hidden
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
            background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.92) 55%, rgba(0,0,0,0) 100%)',
            zIndex: 4, pointerEvents: 'none',
          }}
        />
      )}

      {/* Click target — single tap toggles play/pause, double-tap fullscreens. */}
      <div
        onClick={() => { setShowSpeedMenu(false); togglePlay() }}
        onDoubleClick={toggleFullscreen}
        style={{ position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 2 }}
      />

      {/* LIVE pill */}
      {ready && isLive && (
        <div
          style={{
            position: 'absolute', top: '12px', left: '12px',
            zIndex: 7,
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '5px 10px', borderRadius: '50px',
            background: 'rgba(220, 38, 38, 0.95)', color: '#ffffff',
            fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
            pointerEvents: 'none',
          }}
        >
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%', background: '#ffffff',
            animation: 'cvpLivePulse 1.4s ease-in-out infinite',
          }} />
          LIVE
        </div>
      )}

      {/* Center cluster */}
      {ready && (showControls || !playing) && (
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 5,
            display: 'flex', alignItems: 'center', gap: 'clamp(20px, 6vw, 36px)',
            pointerEvents: 'none',
          }}
        >
          {!isLive && (
            <button
              onClick={e => { e.stopPropagation(); skip(-10) }}
              aria-label="Skip back 10 seconds"
              style={{ ...centerIconBtn, pointerEvents: 'auto' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
              <span style={centerIconLabel}>10</span>
            </button>
          )}

          <button
            onClick={e => { e.stopPropagation(); togglePlay() }}
            aria-label={playing ? 'Pause' : 'Play'}
            style={{
              pointerEvents: 'auto',
              width: 'clamp(60px, 14vw, 78px)', height: 'clamp(60px, 14vw, 78px)',
              borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              transition: 'transform 0.15s ease',
            }}
          >
            {playing ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#1e1e3a">
                <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#1e1e3a" style={{ marginLeft: '4px' }}>
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
            )}
          </button>

          {!isLive && (
            <button
              onClick={e => { e.stopPropagation(); skip(10) }}
              aria-label="Skip forward 10 seconds"
              style={{ ...centerIconBtn, pointerEvents: 'auto' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              <span style={centerIconLabel}>10</span>
            </button>
          )}
        </div>
      )}

      {/* Buffering spinner */}
      {buffering && ready && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 5, pointerEvents: 'none' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" style={{ animation: 'cvpSpin 0.9s linear infinite' }}>
            <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        </div>
      )}

      {/* Loading state — hidden once an error is surfaced */}
      {!ready && !errorMsg && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: 600, zIndex: 1 }}>
          Loading…
        </div>
      )}

      {/* Error overlay — surfaces proxy errors (auth / Drive denial / codec) so the
          user isn't stuck on a black "Loading…" forever. */}
      {errorMsg && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', color: '#f1f5f9', zIndex: 8, background: 'rgba(15,23,42,0.92)' }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Can't play this video</div>
          <div style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 500, maxWidth: '420px', lineHeight: 1.5 }}>
            {/cannotDownloadFile|download by the user/i.test(errorMsg)
              ? 'The Drive file has download disabled. In Drive: right-click the file → File information → "Disable options to download, print, and copy" → turn OFF, then reload this page.'
              : /not enrolled/i.test(errorMsg)
              ? "You're not enrolled in this course. Enroll first, then come back."
              : /Unauthorized/i.test(errorMsg)
              ? 'Your session has expired. Refresh the page and sign in again.'
              : errorMsg}
          </div>
          <button
            onClick={() => { setErrorMsg(null); setReady(false); videoElRef.current?.load() }}
            style={{
              marginTop: '14px', padding: '8px 18px', borderRadius: '50px',
              background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Bottom controls bar */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.15) 70%, transparent)',
          padding: '32px 16px 12px',
          zIndex: 6,
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      >
        {/* Progress bar — hidden for live streams.
            A transparent <input type="range"> sits on top of the styled bar; it
            handles drag + keyboard + touch natively while the visible bar shows
            our custom styling. */}
        {!isLive && (
          <div
            style={{
              width: '100%', height: '5px',
              background: 'rgba(255, 255, 255, 0.25)',
              borderRadius: '50px',
              position: 'relative',
              marginBottom: '10px',
            }}
          >
            <div style={{
              width: `${pctPlayed}%`, height: '100%',
              background: 'var(--primary)',
              borderRadius: '50px',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', left: `${pctPlayed}%`, top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '13px', height: '13px', borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 2px 6px rgba(128, 128, 128, 0.6)',
              pointerEvents: 'none',
            }} />
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onChange={e => seekTo(Number(e.target.value))}
              aria-label="Seek video"
              className="cvp-scrubber"
              style={{
                position: 'absolute', inset: 0, top: '-7px',
                width: '100%', height: '19px',
                opacity: 0, cursor: 'pointer',
                WebkitAppearance: 'none',
                appearance: 'none',
                background: 'transparent',
                margin: 0, padding: 0,
              }}
            />
          </div>
        )}

        {/* Buttons row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#ffffff' }}>
          {!isLive && (
            <ControlBtn label="Skip back 10s" onClick={() => skip(-10)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </ControlBtn>
          )}

          <ControlBtn label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
            )}
          </ControlBtn>

          {!isLive && (
            <ControlBtn label="Skip forward 10s" onClick={() => skip(10)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </ControlBtn>
          )}

          {/* Volume — icon always visible; slider expands on hover (desktop only). */}
          <div className="cvp-volume-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ControlBtn label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
              {muted || volume === 0 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              )}
            </ControlBtn>
            <div className="cvp-volume-slider-wrap">
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                onChange={e => setVolumePct(Number(e.target.value))}
                aria-label="Volume"
                style={{
                  width: '80px', height: '3px',
                  accentColor: 'var(--primary)',
                  cursor: 'pointer',
                  display: 'block',
                }}
                className="cvp-volume"
              />
            </div>
          </div>

          {/* Time / LIVE */}
          {isLive ? (
            <span style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.08em', userSelect: 'none', color: '#fca5a5' }}>
              ● LIVE
            </span>
          ) : (
            <span style={{ fontSize: '12.5px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em', userSelect: 'none' }}>
              {fmtTime(currentTime)} / {fmtTime(duration)}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* Speed picker — hidden on live */}
          {!isLive && (
            <div ref={speedMenuRef} style={{ position: 'relative' }}>
              <ControlBtn label={`${speed}x`} onClick={() => setShowSpeedMenu(v => !v)}>
                <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em' }}>{speed}×</span>
              </ControlBtn>
              {showSpeedMenu && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
                  background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(8px)',
                  borderRadius: '12px', padding: '6px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', flexDirection: 'column', gap: '2px',
                  zIndex: 20, minWidth: '64px',
                }}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(r => (
                    <button
                      key={r}
                      onClick={() => setPlaybackRate(r)}
                      style={{
                        background: r === speed ? 'var(--primary)' : 'transparent',
                        color: r === speed ? '#ffffff' : 'rgba(255,255,255,0.85)',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: '12px', fontWeight: 600,
                        padding: '7px 12px', borderRadius: '8px',
                        textAlign: 'center', letterSpacing: '0.02em',
                      }}
                    >
                      {r}×
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <ControlBtn label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen}>
            {isFullscreen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            )}
          </ControlBtn>
        </div>
      </div>

      <style jsx>{`
        @keyframes cvpSpin { to { transform: rotate(360deg); } }
        @keyframes cvpLivePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.7); }
        }
        .cvp-volume::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #ffffff; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
        .cvp-volume::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #ffffff; cursor: pointer; border: none; }

        /* Invisible scrubber overlay — needs a tappable thumb area on touch */
        .cvp-scrubber::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 19px; height: 19px; background: transparent; cursor: pointer; }
        .cvp-scrubber::-moz-range-thumb { width: 19px; height: 19px; background: transparent; border: none; cursor: pointer; }

        /* Volume hover-expand (desktop). Slider wrapper width collapses to 0,
           expands to 90px when the volume group is hovered. */
        .cvp-volume-slider-wrap {
          width: 0;
          overflow: hidden;
          transition: width 0.2s ease;
        }
        .cvp-volume-group:hover .cvp-volume-slider-wrap,
        .cvp-volume-group:focus-within .cvp-volume-slider-wrap {
          width: 90px;
        }
        @media (max-width: 600px) {
          /* On phones: hide the slider entirely (mute toggle is enough). */
          .cvp-volume-slider-wrap { display: none; }
        }
      `}</style>
    </div>
  )
}

const centerIconBtn: React.CSSProperties = {
  position: 'relative',
  width: 'clamp(44px, 10vw, 54px)', height: 'clamp(44px, 10vw, 54px)',
  borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'rgba(15, 23, 42, 0.55)',
  backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
}
const centerIconLabel: React.CSSProperties = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -45%)',
  color: '#ffffff', fontSize: '9px', fontWeight: 600, letterSpacing: '0.04em',
  pointerEvents: 'none',
}

function ControlBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: '#ffffff', padding: '6px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '8px',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const mm = (m % 60).toString().padStart(2, '0')
    const ss = sec.toString().padStart(2, '0')
    return `${h}:${mm}:${ss}`
  }
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/** Extract a YouTube video ID from any of the URL shapes we accept. */
export function extractYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null
  const s = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  const patterns = [
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com|youtube-nocookie\.com)\/(?:watch\?v=|embed\/|shorts\/|v\/|live\/)([\w-]{11})/,
    /(?:m\.youtube\.com)\/(?:watch\?v=|embed\/|shorts\/|live\/)([\w-]{11})/,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m) return m[1]
  }
  return null
}
