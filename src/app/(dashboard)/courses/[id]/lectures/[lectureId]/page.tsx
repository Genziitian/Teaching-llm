'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import UserAvatar from '@/components/UserAvatar'
import LectureVideoPlayer from '@/components/courses/LectureVideoPlayer'
import { colorWithOpacity } from '@/lib/color-utils'
import Script from 'next/script'
import { 
  Play, 
  ChevronLeft, 
  Download, 
  MessageSquare, 
  Send, 
  User, 
  CornerDownRight, 
  Clock, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Info
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'
const SecureWebPdfViewerLoader = dynamic(() => import('@/components/pdf/SecureWebPdfViewerLoader'), { ssr: false })

interface Comment {
  id: string
  content: string
  userId: string
  parentId: string | null
  createdAt: string
  user: {
    id: string
    name: string
    avatar: string | null
    gender?: string | null
    role: string
  }
  replies: Comment[]
}

interface ContentItem {
  id: string
  title: string
  description?: string
  videoUrl?: string
  youtubeUrl?: string
  videoSource: string
  pptUrl?: string
  isDemoLocked?: boolean
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

export default function LecturePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const commentIdParam = searchParams ? searchParams.get('commentId') : null
  const courseContextId = (searchParams ? searchParams.get('courseId') : null) || (params?.id as string)
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null)
  const [content, setContent] = useState<ContentItem | null>(null)
  const [offering, setOffering] = useState<any | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showComparisonModal, setShowComparisonModal] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const loadingFact = useLoadingFact(loading)
  
  const [isDesktopMode, setIsDesktopMode] = useState(false)
  const [courseTopics, setCourseTopics] = useState<any[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, string>>({})
  const [activeContentType, setActiveContentType] = useState<'VIDEO' | 'PDF'>('VIDEO')
  const [activePdfContent, setActivePdfContent] = useState<ContentItem | null>(null)
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())
  const [limitLecturesCount, setLimitLecturesCount] = useState(10)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const scrollListRef = useRef<HTMLDivElement>(null)

  const hasValidUpgradePrice = offering != null && (
    (offering.hasRecorded && offering.recordedDiscountPrice != null && offering.recordedDiscountPrice > 0) ||
    (offering.hasLive && offering.liveDiscountPrice != null && offering.liveDiscountPrice > 0)
  );
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  useEffect(() => {
    if (commentIdParam && comments.length > 0) {
      setActiveHighlightId(commentIdParam)
      
      const timer = setTimeout(() => {
        const element = document.getElementById(`comment-${commentIdParam}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 500)

      const fadeTimer = setTimeout(() => {
        setActiveHighlightId(null)
      }, 4500)

      return () => {
        clearTimeout(timer)
        clearTimeout(fadeTimer)
      }
    }
  }, [commentIdParam, comments])
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const videoIframeRef = useRef<HTMLIFrameElement>(null)
  const videoWrapperRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [isNativeApp, setIsNativeApp] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'qa'>('info')
  const [selectedSource, setSelectedSource] = useState<'GOOGLE' | 'YOUTUBE'>('GOOGLE')
  const [downloadConfirmContentId, setDownloadConfirmContentId] = useState<string | null>(null)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    const checkIsDesktop = () => {
      const width = window.innerWidth
      const native = document.documentElement.classList.contains('is-native') ||
                     Boolean((window as any).Capacitor?.isNativePlatform?.() || (window as any).Capacitor?.isNative)
      const isTabletOrMobileDevice = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|webOS/i.test(navigator.userAgent)
      return width >= 1024 && !native && !isTabletOrMobileDevice
    }

    const handleResizeDesktop = () => {
      setIsDesktopMode(checkIsDesktop())
    }

    handleResizeDesktop()
    window.addEventListener('resize', handleResizeDesktop)
    return () => window.removeEventListener('resize', handleResizeDesktop)
  }, [])

  useEffect(() => {
    if (isDesktopMode) {
      document.body.classList.add('lecture-watch-desktop-mode')
    } else {
      document.body.classList.remove('lecture-watch-desktop-mode')
    }
    return () => document.body.classList.remove('lecture-watch-desktop-mode')
  }, [isDesktopMode])

  useEffect(() => {
    const courseId = content?.topic?.course?.id || params.id
    if (isDesktopMode && courseId) {
      fetch(`/api/courses/${courseId}/topics`)
        .then(res => res.json())
        .then(data => setCourseTopics(data))
        .catch(console.error)

      fetch(`/api/lectures/progress?courseId=${courseId}`)
        .then(res => res.json())
        .then(data => {
          const map: Record<string, string> = {}
          data.forEach((p: any) => {
            map[p.contentId] = p.status
          })
          setProgressMap(map)
        })
        .catch(console.error)
    }
  }, [isDesktopMode, content?.topic?.course?.id, params.id])

  useEffect(() => {
    if (content?.topic?.id) {
      setExpandedTopics(prev => {
        const next = new Set(prev)
        next.add(content.topic.id)
        return next
      })
    }
  }, [content?.topic?.id])

  useEffect(() => {
    if (content) {
      const hasYT = Boolean(
        content.youtubeUrl ||
        (content.videoUrl && (content.videoSource === 'YOUTUBE' || /youtu\.?be|youtube\.com/i.test(content.videoUrl)))
      )
      const hasDrive = Boolean(
        content.videoUrl && !/youtu\.?be|youtube\.com/i.test(content.videoUrl)
      )
      const isMobilePlatform = typeof window !== 'undefined' && (
        document.documentElement.classList.contains('is-native') ||
        Boolean((window as any).Capacitor?.isNativePlatform?.() || (window as any).Capacitor?.isNative) ||
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent)
      )
      if (isMobilePlatform) {
        setSelectedSource('YOUTUBE')
      } else {
        if (hasDrive) {
          setSelectedSource('GOOGLE')
        } else if (hasYT) {
          setSelectedSource('YOUTUBE')
        }
      }
    }
  }, [content?.id])

  // Auto-scroll the active item near the top of the scroll list
  useEffect(() => {
    const activeId = activeContentType === 'PDF' ? activePdfContent?.id : content?.id
    if (!activeId) return
    // Also expand the topic containing this item
    if (courseTopics.length > 0) {
      for (const topic of courseTopics) {
        const found = (topic.content || []).some((item: any) => item.id === activeId)
        if (found) {
          setExpandedTopics(prev => {
            const next = new Set(prev)
            next.add(topic.id)
            return next
          })
          break
        }
      }
    }
    const timer = setTimeout(() => {
      const container = scrollListRef.current
      const el = container?.querySelector(`[data-item-id="${activeId}"]`) as HTMLElement | null
      if (container && el) {
        const elTop = el.offsetTop - container.offsetTop
        container.scrollTo({ top: Math.max(0, elTop - 8), behavior: 'smooth' })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [content?.id, activePdfContent?.id, activeContentType, courseTopics])

  const handleSelectLecture = (lectureId: string) => {
    const newUrl = `/courses/${params.id}/lectures/${lectureId}`
    window.history.pushState(null, '', newUrl)
    setLoading(true)
    fetch(`/api/content/${lectureId}`)
      .then(res => res.json())
      .then(data => setContent(data))
      .catch(console.error)
      .finally(() => setLoading(false))
    
    fetch(`/api/content/${lectureId}/comments`)
      .then(res => res.json())
      .then(data => setComments(data))
      .catch(console.error)

    fetch('/api/lectures/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId: lectureId, status: 'IN_PROGRESS' })
    }).catch(console.error)

    setActiveContentType('VIDEO')
  }

  const handleSelectPdf = (item: any) => {
    setActiveContentType('PDF')
    setActivePdfContent(item)
  }

  const getRelativeTimeString = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 14) return '1 week ago'
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  const isNewContentItem = (item: any) => {
    if (!item || !item.createdAt) return false;
    const createdAt = new Date(item.createdAt).getTime()
    return Number.isFinite(createdAt) && (Date.now() - createdAt < 24 * 60 * 60 * 1000) && (Date.now() - createdAt >= 0)
  }

  // Centralized playback helpers are now managed inside LectureVideoPlayer

  const handleUnlockClick = async (courseId: string | null) => {
    if (!courseId) return
    setIsProcessing(true)
    try {
      const res = await fetch('/api/course-offerings')
      if (res.ok) {
        const offerings = await res.json()
        if (Array.isArray(offerings)) {
          const found = offerings.find((o: any) => o.courseId === courseId)
          if (found) {
            setOffering(found)
            setShowPurchaseModal(true)
          } else {
            alert('No batch offering found for this course.')
          }
        }
      } else {
        alert('Failed to load purchase options.')
      }
    } catch (e) {
      console.error(e)
      alert('Something went wrong.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePurchase = async (offeringId: string, accessType: 'RECORDED' | 'LIVE' | 'CHAMPION') => {
    setIsProcessing(true)
    setPurchasing(`${offeringId}-${accessType}`)
    try {
      const res = await fetch(`/api/course-offerings/${offeringId}/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment')

      if (data.isFree) {
        setIsProcessing(false)
        setSuccessOrderId('FREE-ENROLLMENT')
        return
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'GenZ IItian',
        description: `Purchase ${data.courseName} (${accessType})`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: data.userName,
          email: data.userEmail,
        },
        theme: { color: 'var(--accent)' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          setIsProcessing(true)
          try {
            const verifyRes = await fetch(`/api/course-offerings/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyRes.ok) {
              setShowPurchaseModal(false)
              setSuccessOrderId(verifyData.orderId || 'SUCCESS')
            } else {
              alert(verifyData.error || 'Payment verification failed')
            }
          } catch (e) {
            console.error(e)
            alert('Something went wrong during payment verification')
          } finally {
            setIsProcessing(false)
          }
        },
        modal: {
          onDismiss: () => {
            setPurchasing(null)
          }
        }
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
      setIsProcessing(false)
    } catch (e: any) {
      alert(e.message || 'Something went wrong')
      setIsProcessing(false)
      setPurchasing(null)
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const contentUrl = courseContextId
        ? `/api/content/${params.lectureId}?courseId=${encodeURIComponent(courseContextId)}`
        : `/api/content/${params.lectureId}`
      const [contentRes, sessionRes, offeringsRes] = await Promise.all([
        fetch(contentUrl),
        fetch('/api/auth/me'),
        fetch('/api/course-offerings')
      ])
      
      if (!contentRes.ok) {
        router.push(`/courses/${params.id}`)
        return
      }

      const contentData = await contentRes.json()
      const sessionData = await sessionRes.json()
      const offeringsData = offeringsRes.ok ? await offeringsRes.json() : []

      if (Array.isArray(offeringsData)) {
        const found = offeringsData.find((o: any) => o.courseId === (contentData.topic?.course?.id || params.id))
        setOffering(found || null)
      }

      setContent(contentData)
      setCurrentUser(sessionData.user)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [courseContextId, params.id, params.lectureId, router])

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/${params.lectureId}/comments`)
      if (res.ok) {
        const data = await res.json()
        setComments(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCommentsLoading(false)
    }
  }, [params.lectureId])

  useEffect(() => {
    fetchData()
    fetchComments()

    // Mark as in-progress when viewed
    if (params.lectureId) {
      fetch('/api/lectures/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contentId: params.lectureId, 
          status: 'IN_PROGRESS' 
        })
      }).catch(err => console.error('Failed to update progress:', err))
    }
  }, [fetchData, fetchComments, params.lectureId])

  const getEmbedUrl = (url: string | undefined, source: string) => {
    if (!url) return ''
    const u = url.trim()

    // ── YouTube auto-detection (handles youtu.be, youtube.com/watch, /embed, /shorts, m.youtube.com)
    const ytPatterns = [
      /(?:youtu\.be\/)([\w-]+)/,
      /(?:youtube\.com|youtube-nocookie\.com)\/(?:watch\?v=|embed\/|shorts\/|v\/|live\/)([\w-]+)/,
      /(?:m\.youtube\.com)\/(?:watch\?v=|embed\/|shorts\/|live\/)([\w-]+)/,
    ]
    const isYoutubeUrl = /youtu\.?be/i.test(u)
    if (source === 'YOUTUBE' || isYoutubeUrl) {
      for (const re of ytPatterns) {
        const m = u.match(re)
        if (m) {
          // Minimal-chrome YouTube embed:
          //   youtube-nocookie.com  → no tracking, cleaner UI
          //   rel=0                 → only same-channel suggestions
          //   modestbranding=1      → small/no YouTube logo
          //   iv_load_policy=3      → no annotations
          //   cc_load_policy=0      → no auto-captions
          //   playsinline=1         → inline on iOS, not forced FS
          //   showinfo=0            → hide title (deprecated but honored)
          //   disablekb=1           → block YouTube keyboard shortcuts
          //   fs=1                  → fullscreen still allowed
          //   color=white           → minimal red progress bar
          const params = new URLSearchParams({
            rel: '0', modestbranding: '1', iv_load_policy: '3', cc_load_policy: '0',
            playsinline: '1', showinfo: '0', disablekb: '1', fs: '1',
          })
          return `https://www.youtube-nocookie.com/embed/${m[1]}?${params.toString()}`
        }
      }
    }

    // ── Google Drive auto-detection
    // Supports: /file/d/{ID}/view, /file/d/{ID}/preview, ?id={ID}, /uc?id={ID}
    const isDriveUrl = /drive\.google\.com|docs\.google\.com/i.test(u)
    if (source === 'GOOGLE_DRIVE' || isDriveUrl) {
      const fileIdMatch = u.match(/\/d\/([\w-]+)/) || u.match(/[?&]id=([\w-]+)/)
      if (fileIdMatch) {
        return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`
      }
    }

    return u
  }

  const handlePostComment = async (parentId: string | null = null) => {
    const text = parentId ? replyText : newComment
    if (!text.trim()) return

    try {
      const res = await fetch(`/api/content/${params.lectureId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, parentId }),
      })

      if (res.ok) {
        setNewComment('')
        setReplyTo(null)
        setReplyText('')
        fetchComments() // Refresh comments
      }
    } catch (e) {
      console.error(e)
    }
  }

  const renderComments = (commentList: Comment[], depth = 0) => {
    return commentList.map(comment => {
      const isHighlighted = activeHighlightId === comment.id
      return (
        <div 
          key={comment.id} 
          id={`comment-${comment.id}`}
          style={{ 
            marginLeft: depth > 0 ? '40px' : '0', 
            marginTop: '16px',
            borderLeft: isHighlighted 
              ? '3px solid #3636e8' 
              : depth > 0 
                ? '2px solid var(--border)' 
                : 'none',
            paddingLeft: depth > 0 && !isHighlighted ? '16px' : isHighlighted ? '12px' : '0',
            backgroundColor: isHighlighted ? 'rgba(54, 54, 232, 0.05)' : 'transparent',
            paddingTop: isHighlighted ? '8px' : '0',
            paddingBottom: isHighlighted ? '8px' : '0',
            paddingRight: isHighlighted ? '12px' : '0',
            borderRadius: isHighlighted ? '6px' : '0',
            transition: 'all 0.4s ease',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <UserAvatar user={comment.user} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{comment.user.name}</span>
                {comment.user.role !== 'STUDENT' && (
                  <span style={{ 
                    fontSize: '10px', 
                    background: 'linear-gradient(135deg, #3636e8, #6366f1)', 
                    color: '#fff', 
                    padding: '1px 8px', 
                    borderRadius: '50px', 
                    fontWeight: '800',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    textTransform: 'capitalize'
                  }}>
                    {comment.user.role.toLowerCase()}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </span>
                )}
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {new Date(comment.createdAt).toLocaleDateString('en-GB')}
                </span>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '4px 0' }}>{comment.content}</p>
              <button 
                onClick={() => {
                  setReplyTo(comment.id)
                  setReplyText('')
                }}
                style={{ 
                  background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', 
                  fontWeight: '600', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', gap: '4px',
                  marginTop: '4px'
                }}
              >
                <CornerDownRight size={12} />
                Reply
              </button>
  
              {replyTo === comment.id && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    style={{ 
                      flex: 1, padding: '8px 16px', borderRadius: '20px', border: '1px solid var(--border)',
                      fontSize: '13px', outline: 'none'
                    }}
                    autoFocus
                  />
                  <button 
                    onClick={() => handlePostComment(comment.id)}
                    style={{ 
                      background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '50px', 
                      width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                  >
                    <Send size={16} />
                  </button>
                  <button 
                    onClick={() => setReplyTo(null)}
                    style={{ 
                      background: 'var(--surface)', color: 'var(--text-secondary)', border: 'none', borderRadius: '50px', 
                      padding: '0 12px', height: '36px', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
          {comment.replies && comment.replies.length > 0 && renderComments(comment.replies, depth + 1)}
        </div>
      )
    })
  }

  if (loading) {
    return (
      <div className="page-container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {loadingFact && (
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
            <LoadingFactCard fact={loadingFact} />
          </div>
        )}
        <div className="skeleton" style={{ height: '30px', width: '200px', marginBottom: '20px' }} />
        <div className="skeleton" style={{ height: '500px', borderRadius: '24px', marginBottom: '24px' }} />
        <div className="skeleton" style={{ height: '200px', borderRadius: '24px' }} />
      </div>
    )
  }

  if (!content) return null

  if (content.isDemoLocked) {
    return (
      <div className="page-container fade-in" style={{
        maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '70vh', textAlign: 'center'
      }}>
        {/* Back Link */}
        <div style={{ alignSelf: 'flex-start', marginBottom: '24px' }}>
          <Link href={`/courses/${params.id}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            color: 'var(--text-secondary)', fontWeight: '700', fontSize: '14px',
            textDecoration: 'none'
          }}>
            <ChevronLeft size={16} /> Back to Course
          </Link>
        </div>

        {/* Lock Card Container */}
        <div style={{
          background: 'var(--surface-2)',
          borderRadius: '32px',
          padding: '48px 32px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          border: '1.5px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px'
        }}>
          {/* Lock Icon */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'var(--surface)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.15)'
          }}>
            <span style={{ fontSize: '36px' }}>🔒</span>
          </div>

          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '12px' }}>
              Lecture Locked in Demo Mode
            </h1>
            <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
              This premium lecture is not available in the free demo. Upgrade to a full student account to watch this lecture, access comments, download slides, and ask doubts!
            </p>
          </div>

          {hasValidUpgradePrice && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => handleUnlockClick(content.topic?.course?.id || params.id as string)}
                style={{
                  width: '100%', padding: '16px', borderRadius: '50px', border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: 'white', fontWeight: '800', fontSize: '15px', cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Unlock Full Course
              </button>
              <button
                onClick={async () => {
                  setIsProcessing(true)
                  try {
                    const res = await fetch('/api/course-offerings')
                    if (res.ok) {
                      const offerings = await res.json()
                      if (Array.isArray(offerings)) {
                        const found = offerings.find((o: any) => o.courseId === (content.topic?.course?.id || params.id))
                        if (found) {
                          setOffering(found)
                          setShowComparisonModal(true)
                        } else {
                          alert('No batch offering found for this course.')
                        }
                      }
                    } else {
                      alert('Failed to load purchase options.')
                    }
                  } catch (e) {
                    console.error(e)
                  } finally {
                    setIsProcessing(false)
                  }
                }}
                style={{
                  width: '100%', padding: '14px', borderRadius: '50px',
                  border: '1.5px solid var(--border)', background: 'transparent',
                  color: 'var(--text-secondary)', fontWeight: '800', fontSize: '14px', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Click here to Know difference between Pro and Plus batch
              </button>
            </div>
          )}
        </div>

        {/* Processing Modal */}
        {isProcessing && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              background: 'var(--surface)', padding: '40px', borderRadius: '32px',
              textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              width: '320px'
            }}>
              <div className="spinner" style={{
                width: '40px', height: '40px', border: '4px solid #f3f3f3',
                borderTop: '4px solid #6366f1', borderRadius: '50%',
                margin: '0 auto 20px',
                animation: 'spin 1s linear infinite'
              }} />
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Processing...</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Please wait while we set up your course access.</p>
            </div>
          </div>
        )}

        {/* Course Purchase Modal */}
        {showPurchaseModal && offering && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001,
            padding: '20px', overflow: 'auto'
          }} onClick={() => setShowPurchaseModal(false)}>
            <div style={{
              background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '480px',
              boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              padding: '30px',
              animation: 'modalSlideUp 0.3s ease-out',
              position: 'relative'
            }} onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setShowPurchaseModal(false)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--surface)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.2s', zIndex: 10 }}
              >
                ✕
              </button>

              {/* Course Header Color Band */}
              <div style={{
                background: `linear-gradient(135deg, ${offering.course?.color || '#6366f1'}, ${colorWithOpacity(offering.course?.color || '#6366f1', 'cc')})`,
                margin: '-30px -30px 24px -30px',
                padding: '40px 30px 30px 30px',
                borderTopLeftRadius: '32px',
                borderTopRightRadius: '32px',
                color: '#fff',
                position: 'relative',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V5A2.5 2.5 0 0 1 6.5 2.5H20v20H6.5a2.5 2.5 0 0 1-2-2.5z"/></svg>
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#fff', marginBottom: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  {offering.course?.name}
                </h2>
                <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600', marginBottom: '0' }}>
                  {offering.course?.subject}
                </p>
                <button
                  onClick={() => {
                    setShowPurchaseModal(false)
                    setShowComparisonModal(true)
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
                    padding: '6px 14px', borderRadius: '20px', color: '#fff',
                    fontSize: '11px', fontWeight: '800', cursor: 'pointer',
                    marginTop: '12px', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                >
                  Click here to Know difference between Pro and Plus batch
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Recorded Batch Option */}
                {offering.hasRecorded && (
                  <div style={{
                    padding: '16px', borderRadius: '20px',
                    background: 'var(--surface-2, rgba(99, 102, 241, 0.02))',
                    border: '1.5px solid var(--border)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                          📹 Recorded Batch - PLUS
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>
                            ₹{Math.max(Number(offering.recordedDiscountPrice || 0), 1)}
                          </span>
                          {Number(offering.recordedOriginalPrice || 0) > Math.max(Number(offering.recordedDiscountPrice || 0), 1) && (
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                              ₹{offering.recordedOriginalPrice}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePurchase(offering.id, 'RECORDED')}
                      disabled={!!purchasing}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '50px',
                        border: '2.5px solid var(--accent)', background: 'transparent',
                        color: 'var(--accent)', fontSize: '14px', fontWeight: '800',
                        cursor: purchasing ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {purchasing === `${offering.id}-RECORDED` ? 'Processing...' : 'Buy PLUS Batch'}
                    </button>
                  </div>
                )}

                {/* Live Batch Option */}
                {offering.hasLive && (
                  <div style={{
                    padding: '16px', borderRadius: '20px',
                    background: 'var(--surface-2, rgba(99, 102, 241, 0.02))',
                    border: '1.5px solid var(--accent)',
                    position: 'relative',
                    boxShadow: '0 8px 24px rgba(99,102,241,0.08)'
                  }}>
                    <div style={{
                      position: 'absolute', top: '12px', right: '16px',
                      padding: '3px 10px', borderRadius: '20px',
                      background: 'var(--accent)', color: '#fff',
                      fontSize: '9px', fontWeight: '900', letterSpacing: '0.08em',
                    }}>
                      PRO
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                          🔴 Live + Recorded Batch - PRO
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>
                            ₹{Math.max(Number(offering.liveDiscountPrice || 0), 1)}
                          </span>
                          {Number(offering.liveOriginalPrice || 0) > Math.max(Number(offering.liveDiscountPrice || 0), 1) && (
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                              ₹{offering.liveOriginalPrice}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePurchase(offering.id, 'LIVE')}
                      disabled={!!purchasing}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '50px',
                        border: 'none', background: 'var(--accent)',
                        color: '#fff', fontSize: '14px', fontWeight: '800',
                        cursor: purchasing ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {purchasing === `${offering.id}-LIVE` ? 'Processing...' : '⚡ Buy PLUS + PRO Batch'}
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Footer info */}
              <div style={{
                marginTop: '24px',
                textAlign: 'center',
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span>⌛</span> Access Till End Term
                </div>
                <button
                  onClick={() => window.location.href = `/support?openTicket=true&type=GENERAL&classId=${offering?.courseId || ''}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '4px 8px',
                    marginTop: '4px',
                  }}
                >
                  Need Help? Contact Support
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Modal */}
        {showComparisonModal && offering && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002,
            padding: '20px', overflow: 'auto'
          }} onClick={() => {
            setShowComparisonModal(false)
            setShowPurchaseModal(true)
          }}>
            <div style={{
              background: '#1e2230', borderRadius: '24px', width: '100%', maxWidth: '520px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              padding: '30px',
              animation: 'modalSlideUp 0.3s ease-out',
              position: 'relative',
              color: '#ffffff'
            }} onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => {
                  setShowComparisonModal(false)
                  setShowPurchaseModal(true)
                }}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.08)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#a0aec0', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              >
                ✕
              </button>

              <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px', color: '#ffffff' }}>Batch Comparison</h2>
              <p style={{ fontSize: '13px', color: '#a0aec0', marginBottom: '24px', fontWeight: '500' }}>
                Choose the experience that fits your learning style
              </p>

              {/* Comparison Table */}
              <div style={{
                borderRadius: '16px', overflow: 'hidden', border: '1px solid #2d3748',
                background: '#1a1d28', marginBottom: '24px'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2d3748', background: '#171923' }}>
                      <th style={{ padding: '14px 16px', fontWeight: '700', color: '#a0aec0', width: '40%' }}>FEATURES</th>
                      <th style={{ padding: '14px 16px', fontWeight: '800', color: '#d69e2e', textAlign: 'center', width: '30%', background: 'rgba(214, 158, 46, 0.05)' }}>PLUS</th>
                      <th style={{ padding: '14px 16px', fontWeight: '800', color: '#6366f1', textAlign: 'center', width: '30%', background: 'rgba(99, 102, 241, 0.05)' }}>PRO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Lectures', plus: '✅ Full', pro: '✅ Full' },
                      { name: 'Materials', plus: '✅ Full', pro: '✅ Full' },
                      { name: 'Live Classes', plus: '❌ No', pro: '✅ Yes' },
                      { name: 'Q&A w/ Teacher', plus: '❌ No', pro: '✅ Live' },
                      { name: 'Mentorship', plus: '❌ No', pro: '✅ Weekly' },
                      { name: 'Support', plus: '❌ Basic', pro: '✅ Priority' },
                    ].map((row, index) => (
                      <tr key={row.name} style={{ borderBottom: index < 5 ? '1px solid #2d3748' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#e2e8f0' }}>{row.name}</td>
                        <td style={{
                          padding: '12px 16px', textAlign: 'center', fontWeight: '700',
                          color: row.plus.includes('✅') ? '#48bb78' : '#e53e3e',
                          background: 'rgba(214, 158, 46, 0.02)'
                        }}>
                          {row.plus}
                        </td>
                        <td style={{
                          padding: '12px 16px', textAlign: 'center', fontWeight: '700',
                          color: row.pro.includes('✅') ? '#48bb78' : '#e53e3e',
                          background: 'rgba(99, 102, 241, 0.02)'
                        }}>
                          {row.pro}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Got it button */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    setShowComparisonModal(false)
                    setShowPurchaseModal(true)
                  }}
                  style={{
                    padding: '12px 32px', borderRadius: '50px', border: 'none',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#ffffff',
                    fontSize: '14px', fontWeight: '800', cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  Got it, thanks!
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {successOrderId && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001,
            padding: '20px'
          }} onClick={() => { setSuccessOrderId(null); window.location.reload() }}>
            <div style={{
              background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '440px',
              boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              padding: '40px', textAlign: 'center',
              animation: 'modalSlideUp 0.3s ease-out'
            }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Course Unlocked!</h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
                Your payment was verified successfully. You now have full access to all lectures, class materials, and student benefits.
              </p>
              <button
                onClick={() => { setSuccessOrderId(null); window.location.reload() }}
                style={{
                  width: '100%', padding: '16px', borderRadius: '18px', border: 'none',
                  background: 'linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)',
                  color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
              >
                Got it, let&apos;s go! 🚀
              </button>
            </div>
          </div>
        )}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </div>
    )
  }

  if (!content) return null

  const isLongDescription = content.description && content.description.length > 250
  const displayedDescription = showFullDescription || !isLongDescription 
    ? content.description 
    : content.description?.substring(0, 250) + '...'

  if (isDesktopMode) {
    const hasYT = content ? Boolean(
      content.youtubeUrl ||
      (content.videoUrl && (content.videoSource === 'YOUTUBE' || /youtu\.?be|youtube\.com/i.test(content.videoUrl)))
    ) : false
    const hasDrive = content ? Boolean(
      content.videoUrl && !/youtu\.?be|youtube\.com/i.test(content.videoUrl)
    ) : false
    const showSourceToggle = hasYT && hasDrive

    return (
      <div className="desktop-redesign-container" style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ flex: '7.2', padding: '16px 24px 24px 24px', background: 'var(--bg)' }}>
          {activeContentType === 'VIDEO' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', background: 'transparent', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button onClick={() => router.push(`/courses/${params.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <ChevronLeft size={20} /> Back
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {content.title}
                    </h1>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{content.topic.title} / {content.topic.course.name}</span>
                  </div>
                </div>

                {showSourceToggle && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                      Video Source:
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
                        onClick={() => setSelectedSource('GOOGLE')}
                        style={{
                          border: 'none',
                          padding: '4px 14px',
                          borderRadius: '16px',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          background: selectedSource === 'GOOGLE' ? 'var(--accent)' : 'transparent',
                          color: selectedSource === 'GOOGLE' ? '#fff' : 'var(--text-secondary)',
                          transition: 'all 0.2s'
                        }}
                      >
                        GOOGLE
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSource('YOUTUBE')}
                        style={{
                          border: 'none',
                          padding: '4px 14px',
                          borderRadius: '16px',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          background: selectedSource === 'YOUTUBE' ? 'var(--accent)' : 'transparent',
                          color: selectedSource === 'YOUTUBE' ? '#fff' : 'var(--text-secondary)',
                          transition: 'all 0.2s'
                        }}
                      >
                        YOUTUBE
                      </button>
                    </div>
                    
                    <div className="source-info-tooltip-wrapper">
                      <Info size={16} style={{ color: 'var(--text-muted)' }} />
                      <div className="source-info-tooltip">
                        You can choose another video source if one player gives you an error or doesn’t work.
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <LectureVideoPlayer videoUrl={content.videoUrl || undefined} youtubeUrl={content.youtubeUrl || undefined} videoSource={content.videoSource} title={content.title} contentId={content.id} selectedSource={selectedSource} onSourceChange={setSelectedSource} hideToggle={true} />
                <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '16px 24px', borderRadius: '16px', border: '1px solid var(--border)', marginTop: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Study Materials</h2>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {content.pptUrl ? "Lecture Notes / Slides PDF" : "No study material available"}
                    </span>
                  </div>
                  {content.pptUrl && (
                    <button
                      onClick={() => {
                        if (isNativeApp) {
                          setDownloadConfirmContentId(content.id)
                        } else {
                          window.open(`/material/${content.id}/view`, '_blank')
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
                    >
                      <Download size={16} /> Download Material
                    </button>
                  )}
                </section>
                {content.description && content.description.trim() !== '' && (
                  <section style={{ background: 'var(--surface)', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginTop: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px' }}>About this Lecture</h2>
                    <div style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                      {displayedDescription}
                    </div>
                    {isLongDescription && (
                      <button onClick={() => setShowFullDescription(!showFullDescription)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {showFullDescription ? <>Show Less <ChevronUp size={16} /></> : <>Read More <ChevronDown size={16} /></>}
                      </button>
                    )}
                  </section>
                )}
                <section style={{ background: 'var(--surface)', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MessageSquare size={20} color="#6366f1" /> Discussion & Q&A
                    </h2>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>{comments.length} Comment{comments.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {currentUser?.avatar ? <img src={currentUser.avatar} alt={currentUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={24} color="#94a3b8" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Ask a question or share your thoughts..." style={{ width: '100%', padding: '12px 16px', borderRadius: '16px', border: '2px solid var(--border)', fontSize: '14px', minHeight: '80px', outline: 'none', resize: 'vertical' }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                          <button onClick={() => handlePostComment()} disabled={!newComment.trim()} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', padding: '8px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: newComment.trim() ? 1 : 0.6 }}>
                            Post Comment <Send size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {commentsLoading ? <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading comments...</div> : comments.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <MessageSquare size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                      <p style={{ fontSize: '14px' }}>No comments yet. Be the first to start the discussion!</p>
                    </div>
                  ) : <div style={{ display: 'flex', flexDirection: 'column' }}>{renderComments(comments)}</div>}
                </section>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={() => setActiveContentType('VIDEO')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface-2)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                      <ChevronLeft size={16} /> Back to Video
                    </button>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{activePdfContent?.title}</h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {activePdfContent && (activePdfContent.pptUrl || activePdfContent.id) && (
                      <a
                        href={activePdfContent.pptUrl || `/api/drive-doc/${activePdfContent.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        <ExternalLink size={15} />
                        Download Material
                      </a>
                    )}
                  </div>
                </div>
                <div style={{ minHeight: '700px', overflow: 'hidden' }}>
                  <SecureWebPdfViewerLoader fileUrl={`/api/drive-doc/${activePdfContent?.id}`} watermarkEmail={currentUser?.email || ""} title={activePdfContent?.title || ""} />
                </div>
              </>
            )}
          </div>
          <div ref={rightPanelRef} className="desktop-right-panel" style={{ flex: '2.8', borderLeft: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <h2 style={{ fontSize: '15px', fontWeight: 900, margin: 0, letterSpacing: '0.06em', color: 'var(--text-primary)', textTransform: 'uppercase' }}>Next Lectures</h2>
            </div>
            <div ref={scrollListRef} className="desktop-right-panel-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
              {courseTopics.map(topic => {
                const topicItems = (topic.content || []).filter((item: any) => item.videoUrl || item.youtubeUrl || item.pptUrl);
                return (
                <div key={topic.id} style={{ position: 'relative' }}>
                  <button onClick={() => {
                    setExpandedTopics(prev => {
                      const next = new Set(prev);
                      if (next.has(topic.id)) next.delete(topic.id);
                      else next.add(topic.id);
                      return next;
                    });
                  }} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', border: 'none', padding: '16px 20px', cursor: 'pointer', borderRadius: '0', position: 'sticky', top: 0, zIndex: 2, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{topic.title}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{topicItems.length} items</span>
                      <ChevronDown size={16} style={{ flexShrink: 0, color: 'var(--text-muted)', transform: expandedTopics.has(topic.id) ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </div>
                  </button>
                  {expandedTopics.has(topic.id) && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {(topic.content || []).slice(0, topic.id === content.topic?.id ? limitLecturesCount : 9999).map((item: any, idx: number) => {
                        const isVideo = !!(item.videoUrl || item.youtubeUrl);
                        const isDoc = !isVideo && !!item.pptUrl;
                        if (!isVideo && !isDoc) return null;
                        
                        const isActiveVideo = isVideo && item.id === content.id && activeContentType === 'VIDEO';
                        const isActiveDoc = isDoc && item.id === activePdfContent?.id && activeContentType === 'PDF';
                        const isActive = isActiveVideo || isActiveDoc;

                        return (
                          <div key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <div 
                              data-item-id={item.id}
                              onClick={() => {
                                if (isVideo) handleSelectLecture(item.id);
                                else handleSelectPdf(item);
                                setTimeout(() => {
                                  const container = scrollListRef.current;
                                  const el = container?.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement | null;
                                  if (container && el) {
                                    const elTop = el.offsetTop - container.offsetTop;
                                    container.scrollTo({ top: Math.max(0, elTop - 8), behavior: 'smooth' });
                                  }
                                }, 150);
                              }} 
                              style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '12px', backgroundColor: isActive ? 'var(--surface-2)' : 'transparent', transition: 'background-color 0.2s' }}
                            >
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isActive ? 'var(--accent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? 'white' : 'var(--text-muted)', flexShrink: 0 }}>
                                {isVideo ? <Play size={14} fill="currentColor" /> : <FileText size={14} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: isActive ? 'var(--accent)' : 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.title}
                                  {isNewContentItem(item) && <span style={{ marginLeft: '8px', fontSize: '10px', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>NEW</span>}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{getRelativeTimeString(item.createdAt)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {topic.id === content.topic?.id && (topic.content?.length || 0) > limitLecturesCount && (
                        <button onClick={() => setLimitLecturesCount(c => c + 10)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', padding: '12px 20px', textAlign: 'left' }}>
                          Load More Lectures
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </div>
        </div>
      )
    }

  return (
    <div className={`page-container fade-in ${isMobile ? 'lecture-page-mobile' : ''}`} style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px', overflowX: 'visible', overflowY: 'visible' }}>
      {/* Top Header */}
      {isMobile ? (
        // Mobile: compact top bar like inspiration image 4
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '14px 6px',
          marginBottom: '12px',
        }}>
          <Link href={`/courses/${params.id}`} aria-label="Back" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'var(--surface-2)',
            boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
            color: 'var(--text-primary)',
            textDecoration: 'none', flexShrink: 0,
          }}>
            <ChevronLeft size={18} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {content.topic.course.name}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '24px' }}>
          <Link href={`/courses/${params.id}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none', fontWeight: '600',
            marginBottom: '16px', transition: 'color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = content.topic.course.color}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <ChevronLeft size={18} />
            Back to {content.topic.course.name}
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>{content.title}</h1>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{
                  fontSize: '12px', color: content.topic.course.color,
                  background: content.topic.course.color + '15',
                  padding: '4px 10px', borderRadius: '6px', fontWeight: '700'
                }}>
                  {content.topic.title}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Centralized Video Section */}
      <LectureVideoPlayer
        videoUrl={content.videoUrl || undefined}
        youtubeUrl={content.youtubeUrl || undefined}
        videoSource={content.videoSource}
        title={content.title}
        contentId={content.id}
      />

      {isMobile && (
        /* Mobile lecture meta block — appears UNDER the video like inspiration */
        <div style={{ padding: '0 4px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <span style={{
              fontSize: '11px', color: content.topic.course.color,
              background: content.topic.course.color + '18',
              padding: '4px 10px', borderRadius: '50px', fontWeight: 800,
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              {content.topic.title}
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {content.title}
          </h1>
        </div>
      )}

      {isMobile ? (
        /* Unified Mobile Layout (Discussion placed after Study Materials) */
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* About this Lecture — only show on mobile if description exists */}
            {content.description && content.description.trim() !== '' && (
            <section style={{ 
              background: 'var(--surface)', padding: '20px', borderRadius: '20px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                About this Lecture
              </h2>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {displayedDescription}
              </div>
              {isLongDescription && (
                <button 
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  style={{ 
                    background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', 
                    fontWeight: '700', cursor: 'pointer', marginTop: '10px', padding: '0',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  {showFullDescription ? (
                    <>Show Less <ChevronUp size={14} /></>
                  ) : (
                    <>Read More <ChevronDown size={14} /></>
                  )}
                </button>
              )}
            </section>
            )}

            {/* Study Materials */}
            <section style={{ 
              background: 'var(--surface)', padding: '20px', borderRadius: '20px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '14px' }}>Study Materials</h3>
              {content.pptUrl ? (
                <div style={{ 
                  background: 'var(--surface)', padding: '14px', borderRadius: '14px', 
                  border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-light)', 
                      color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                    }}>
                      <Download size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Lecture Resources
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PDF / Presentation / Notes</div>
                    </div>
                  </div>
                  {isNativeApp ? (
                    <button
                      onClick={() => setDownloadConfirmContentId(content.id)}
                      style={{
                        background: 'var(--accent)', color: 'white', border: 'none', textAlign: 'center',
                        padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: '700',
                        cursor: 'pointer', fontFamily: 'inherit', width: '100%',
                      }}
                    >
                      Download Notes
                    </button>
                  ) : (
                    <Link
                      href={`/material/${content.id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'var(--accent)', color: 'white', textDecoration: 'none', textAlign: 'center',
                        padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: '700',
                      }}
                    >
                      Download Notes
                    </Link>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '13px' }}>No material available.</p>
                </div>
              )}
            </section>

            {/* Discussion Section (Moved directly after Study Materials!) */}
            <section style={{ 
              background: 'var(--surface)', padding: '20px', borderRadius: '20px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={18} color="#6366f1" />
                  Discussion & Q&A
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {comments.length} Comment{comments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Post a Comment */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', 
                    background: 'var(--surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {currentUser?.avatar ? (
                      <img src={currentUser.avatar} alt={currentUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={20} color="#94a3b8" />
                    )}
                  </div>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <textarea 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Ask a question or share your thoughts..."
                      style={{ 
                        width: '100%', padding: '10px 14px', borderRadius: '12px', border: '2px solid var(--border)',
                        fontSize: '13px', minHeight: '70px', outline: 'none', resize: 'vertical',
                        transition: 'border-color 0.2s', fontFamily: 'inherit'
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--surface)'}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button 
                        onClick={() => handlePostComment()}
                        disabled={!newComment.trim()}
                        style={{ 
                          background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', 
                          padding: '6px 14px', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px', opacity: newComment.trim() ? 1 : 0.6,
                        }}
                      >
                        Post
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comment List */}
              {commentsLoading ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading comments...</div>
              ) : comments.length === 0 ? (
                <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <MessageSquare size={28} style={{ marginBottom: '10px', opacity: 0.3 }} />
                  <p style={{ fontSize: '13px' }}>No comments yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {renderComments(comments)}
                </div>
              )}
            </section>

            {/* Course Info */}
            <section style={{ 
              background: 'var(--surface)', padding: '20px', borderRadius: '20px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '14px' }}>Course Info</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: content.topic.course.color }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>{content.topic.course.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>{content.topic.title}</span>
                </div>
              </div>
              <button 
                onClick={() => router.push(`/courses/${params.id}`)}
                style={{ 
                  marginTop: '16px', width: '100%', background: 'var(--surface)', border: 'none', 
                  padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', 
                  color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                View Course Syllabus
                <ExternalLink size={12} />
              </button>
            </section>
          </div>
        </>
      ) : (
        /* Original Desktop View (Unchanged!) */
        <div className="lecture-layout-grid">
          {/* Left Column: Description + Q&A */}
          <div style={{ minWidth: 0 }}>
            {/* Description Section */}
            {content.description && content.description.trim() !== '' && (
            <section style={{ 
              background: 'var(--surface)', padding: '24px', borderRadius: '24px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: '24px' 
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                About this Lecture
              </h2>
              <div style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                {displayedDescription || 'No description provided for this lecture.'}
              </div>
              {isLongDescription && (
                <button 
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  style={{ 
                    background: 'none', border: 'none', color: 'var(--accent)', fontSize: '14px', 
                    fontWeight: '700', cursor: 'pointer', marginTop: '12px', padding: '0',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  {showFullDescription ? (
                    <>Show Less <ChevronUp size={16} /></>
                  ) : (
                    <>Read More <ChevronDown size={16} /></>
                  )}
                </button>
              )}
            </section>
            )}

            {/* Discussion Section */}
            <section style={{ 
              background: 'var(--surface)', padding: '24px', borderRadius: '24px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={20} color="#6366f1" />
                  Discussion & Q&A
                </h2>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {comments.length} Comment{comments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Post a Comment */}
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', 
                    background: 'var(--surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {currentUser?.avatar ? (
                      <img src={currentUser.avatar} alt={currentUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={24} color="#94a3b8" />
                    )}
                  </div>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <textarea 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Ask a question or share your thoughts..."
                      style={{ 
                        width: '100%', padding: '12px 16px', borderRadius: '16px', border: '2px solid var(--border)',
                        fontSize: '14px', minHeight: '80px', outline: 'none', resize: 'vertical',
                        transition: 'border-color 0.2s', fontFamily: 'inherit'
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--surface)'}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button 
                        onClick={() => handlePostComment()}
                        disabled={!newComment.trim()}
                        style={{ 
                          background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', 
                          padding: '8px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '8px', opacity: newComment.trim() ? 1 : 0.6,
                          transition: 'transform 0.1s'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        Post Comment
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comment List */}
              {commentsLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading comments...</div>
              ) : comments.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <MessageSquare size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                  <p style={{ fontSize: '14px' }}>No comments yet. Be the first to start the discussion!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {renderComments(comments)}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Sidebar */}
          <div>
            <section style={{ 
              background: 'var(--surface)', padding: '24px', borderRadius: '24px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)', position: 'sticky', top: '24px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px' }}>Study Materials</h3>
              {content.pptUrl ? (
                <div style={{ 
                  background: 'var(--surface)', padding: '16px', borderRadius: '16px', 
                  border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      width: '36px', height: '36px', borderRadius: '8px', background: 'var(--primary-light)', 
                      color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                    }}>
                      <Download size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Lecture Resources
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PDF / Presentation / Notes</div>
                    </div>
                  </div>
                  {isNativeApp ? (
                    <button
                      onClick={() => setDownloadConfirmContentId(content.id)}
                      style={{
                        background: 'var(--accent)', color: 'white', border: 'none', textAlign: 'center',
                        padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: '700',
                        cursor: 'pointer', fontFamily: 'inherit', width: '100%',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                    >
                      Download Notes
                    </button>
                  ) : (
                    <Link
                      href={`/material/${content.id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'var(--accent)', color: 'white', textDecoration: 'none', textAlign: 'center',
                        padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: '700',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                    >
                      Download Notes
                    </Link>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '13px' }}>No material available.</p>
                </div>
              )}

              <div style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px' }}>Course Info</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: content.topic.course.color }} />
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>{content.topic.course.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>{content.topic.title}</span>
                  </div>
                </div>
                <button 
                  onClick={() => router.push(`/courses/${params.id}`)}
                  style={{ 
                    marginTop: '24px', width: '100%', background: 'var(--surface)', border: 'none', 
                    padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: '700', 
                    color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                >
                  View Course Syllabus
                  <ExternalLink size={14} />
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {downloadConfirmContentId && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--surface)',
            width: '100%',
            maxWidth: '400px',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px' }}>
              Download Material
            </h3>
            <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px' }}>
              Please Use your registered Mail to open or download this File
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDownloadConfirmContentId(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '50px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-secondary)',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const url = `/material/${downloadConfirmContentId}/view`
                  window.open(url, '_blank')
                  setDownloadConfirmContentId(null)
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '50px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'white',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px var(--accent-light)',
                }}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

/**
 * OPAQUE click-eaters layered over the YouTube iframe that BOTH hide and block
 * clicks on YouTube branding:
 *   - top title row + channel name + news-source disclaimer
 *   - top-left clickable title that links to youtube.com/watch
 *   - bottom-right "More videos" suggestion pop-up + YouTube wordmark
 *   - bottom-left "Copy link" chain icon
 *
 * Center-top (settings/CC/volume) and center-bottom (play/progress/time/fullscreen)
 * are LEFT CLEAR so the player remains usable.
 *
 * Each mask is solid black (or fades-to-black gradient) — taps land on it and
 * are eaten via preventDefault, never reaching the iframe's link handlers.
 */
function YouTubeChromeMaskers() {
  const eat = (e: React.MouseEvent | React.TouchEvent) => { e.stopPropagation(); e.preventDefault() }
  const base: React.CSSProperties = {
    position: 'absolute', zIndex: 10, pointerEvents: 'auto', cursor: 'default',
  }
  return (
    <>
      {/* TOP gradient — fades from solid black at the very top to transparent over ~80px.
          Hides the video title, channel name, and the news-source disclaimer overlay.
          Right side leaves 150px clear for YouTube's settings/CC/volume icons. */}
      <div
        aria-hidden
        onClick={eat}
        onTouchStart={eat}
        style={{
          ...base,
          top: 0, left: 0, right: '150px', height: '90px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 55%, rgba(0,0,0,0) 100%)',
        }}
      />
      {/* TOP-RIGHT tiny corner — covers the small "more options / Watch on YouTube" button that sometimes appears here */}
      <div
        aria-hidden
        onClick={eat}
        onTouchStart={eat}
        style={{
          ...base,
          top: 0, right: 0, width: '40px', height: '38px',
          background: '#000',
        }}
      />
      {/* BOTTOM-RIGHT solid black — covers "More videos" thumbnail + "YouTube" wordmark.
          ~32% wide and ~50px tall, positioned at the very bottom so it doesn't cover the progress bar above. */}
      <div
        aria-hidden
        onClick={eat}
        onTouchStart={eat}
        style={{
          ...base,
          bottom: 0, right: 0, width: '34%', height: '54px',
          background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 70%, rgba(0,0,0,0) 100%)',
        }}
      />
      {/* BOTTOM-LEFT — covers the chain-link "Copy link" icon */}
      <div
        aria-hidden
        onClick={eat}
        onTouchStart={eat}
        style={{
          ...base,
          bottom: 0, left: 0, width: '70px', height: '50px',
          background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 70%, rgba(0,0,0,0) 100%)',
        }}
      />
    </>
  )
}
