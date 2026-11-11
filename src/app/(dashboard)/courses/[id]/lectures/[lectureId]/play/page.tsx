'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, AlertCircle } from 'lucide-react'
import LectureVideoPlayer from '@/components/courses/LectureVideoPlayer'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

interface ContentItem {
  id: string
  title: string
  description?: string
  videoUrl?: string
  youtubeUrl?: string
  videoSource: string
  topic: {
    id: string
    title: string
    course: {
      id: string
      name: string
      color: string
    }
  }
}

export default function PlayDriveVideoPage() {
  const params = useParams()
  const router = useRouter()
  const [content, setContent] = useState<ContentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isNativeApp, setIsNativeApp] = useState(false)
  const [streamToken, setStreamToken] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)

  useEffect(() => {
    const detectNativeApp = () => {
      const w = window as any
      setIsNativeApp(
        document.documentElement.classList.contains('is-native') ||
        Boolean(w.Capacitor?.isNativePlatform?.() || w.Capacitor?.isNative)
      )
    }

    detectNativeApp()
    const observer = new MutationObserver(detectNativeApp)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!content || !isNativeApp) return
    if (content.videoSource !== 'GOOGLE_DRIVE') return

    const fetchToken = async () => {
      setTokenLoading(true)
      setTokenError(null)
      try {
        const res = await fetch(`/api/auth/stream-token?lectureId=${params.lectureId}`)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          setTokenError(errData.error || 'Failed to authenticate video stream')
          return
        }
        const data = await res.json()
        setStreamToken(data.token)
      } catch (err) {
        console.error('Error fetching stream token:', err)
        setTokenError('Network error while authenticating stream')
      } finally {
        setTokenLoading(false)
      }
    }

    fetchToken()
  }, [content, isNativeApp, params.lectureId])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/${params.lectureId}`)
      if (!res.ok) {
        setError('Failed to load video details')
        return
      }
      const data = await res.json()
      if (data.isDemoLocked) {
        router.push(`/courses/${params.id}/lectures/${params.lectureId}`)
        return
      }
      setContent(data)
    } catch (e) {
      console.error(e)
      setError('An error occurred while loading video details')
    } finally {
      setLoading(false)
    }
  }, [params.lectureId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // central player handles url conversion
  const isPlayerLoading = loading || (isNativeApp && content?.videoSource === 'GOOGLE_DRIVE' && tokenLoading)
  const fact = useLoadingFact(isPlayerLoading)

  if (isPlayerLoading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#090d16', color: '#fff', gap: '16px', padding: '24px'
      }}>
        <Loader2 className="animate-spin" size={36} color="var(--primary)" />
        <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: '500' }}>
          {tokenLoading ? 'Authenticating secure player...' : 'Loading player...'}
        </span>
        {fact && (
          <div style={{ marginTop: '16px', width: '100%', maxWidth: '420px' }}>
            <LoadingFactCard fact={fact} />
          </div>
        )}
      </div>
    )
  }

  if (error || tokenError || !content) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#090d16', color: '#fff', gap: '16px', padding: '24px', textAlign: 'center'
      }}>
        <AlertCircle size={48} color="#ef4444" />
        <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Error Loading Video</h3>
        <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '300px' }}>
          {error || tokenError || "We couldn't retrieve the video content."}
        </p>
        <button
          onClick={() => router.back()}
          style={{
            background: '#334155', color: '#fff', border: 'none', borderRadius: '50px',
            padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '12px'
          }}
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', background: '#000', color: '#fff',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
      overflow: 'hidden'
    }}>
      {/* Top Header Row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', background: 'rgba(9, 13, 22, 0.85)',
        backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 10, flexShrink: 0
      }}>
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#fff', cursor: 'pointer', transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {content.topic.course.name}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {content.title}
          </div>
        </div>
      </div>

      {/* Main Video Area */}
      <div style={{
        flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#000', width: '100%', minHeight: 0
      }}>
        <LectureVideoPlayer
          videoUrl={content.videoUrl || undefined}
          youtubeUrl={content.youtubeUrl || undefined}
          videoSource={content.videoSource}
          title={content.title}
          contentId={content.id}
          fill
        />
      </div>
    </div>
  )
}
