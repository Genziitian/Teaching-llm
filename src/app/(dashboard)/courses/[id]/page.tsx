'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import MobileCourseDetail from '@/components/courses/MobileCourseDetail'
import FeedbackModal from '@/components/FeedbackModal'
import { X } from 'lucide-react'
import { colorWithOpacity, getCourseDisplayPalette } from '@/lib/color-utils'
import { useTheme } from '@/components/ThemeProvider'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

interface ContentItem {
  id: string
  title: string
  description?: string
  videoUrl?: string
  youtubeUrl?: string
  pptUrl?: string
  order: number
  createdAt?: string
  duration?: string | null
  isDemo?: boolean
}

interface Topic {
  id: string
  title: string
  order: number
  content: ContentItem[]
}

interface CourseDetail {
  id: string
  name: string
  description: string
  subject: string
  color: string
  expiresAt?: string
  teacherName: string
  aboutUs?: string | null
  startDate?: string | null
  endDate?: string | null
  isCommunityActive?: boolean
  isDisabled?: boolean
  isEffectivelyDisabled?: boolean
  isDemo?: boolean
  enrollmentType?: 'LIVE' | 'RECORDED' | 'DEMO' | 'FREE' | null
  liveUpgradePrice?: number | null
  instructorAssignments?: { instructor: { id: string; name: string } }[]
  _count?: { topics: number; lectures: number; materials: number; courseEvents: number }
  createdAt?: string
  enrollment?: {
    id: string
    createdAt: string
    type: string
  } | null
  courseEvents?: {
    id: string
    title: string
    description: string | null
    startTime: string
    endTime: string
    meetLink: string | null
    type: string
    status: string
    instructor?: { name: string } | null
  }[]
}

function isCardActionElement(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest('a, button, input, select, textarea, [role="button"], [role="menu"], [role="menuitem"]')
}

export default function CourseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const loadingFact = useLoadingFact(loading)
  const [role, setRole] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())
  const [progressMap, setProgressMap] = useState<Record<string, string>>({})
  const [infoModalCourse, setInfoModalCourse] = useState<CourseDetail | null>(null)
  const [upgradeModalCourse, setUpgradeModalCourse] = useState<CourseDetail | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [showUpgradeHint, setShowUpgradeHint] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isNative, setIsNative] = useState(false)

  // Store offering/purchase modal states
  const [offering, setOffering] = useState<any | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showComparisonModal, setShowComparisonModal] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [purchasedCourse, setPurchasedCourse] = useState<any>(null)
  const [showForcedFeedback, setShowForcedFeedback] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [activeSectionTab, setActiveSectionTab] = useState<'lectures' | 'materials' | 'about'>('lectures')
  const [searchQuery, setSearchQuery] = useState('')

  const hasValidUpgradePrice = offering != null && (
    (offering.hasRecorded && offering.recordedDiscountPrice != null && offering.recordedDiscountPrice > 0) ||
    (offering.hasLive && offering.liveDiscountPrice != null && offering.liveDiscountPrice > 0)
  );

  const getLectureHref = useCallback((contentId: string) => {
    const courseId = params.id as string
    return `/courses/${courseId}/lectures/${contentId}?courseId=${encodeURIComponent(courseId)}`
  }, [params.id])

  const openLecture = useCallback((contentId: string) => {
    router.push(getLectureHref(contentId))
  }, [getLectureHref, router])

  const fetchData = useCallback(async () => {
    try {
      const [courseRes, topicsRes, sessionRes, progressRes, offeringsRes] = await Promise.all([
        fetch(`/api/courses/${params.id}`),
        fetch(`/api/courses/${params.id}/topics`),
        fetch('/api/auth/me'),
        fetch(`/api/lectures/progress?courseId=${params.id}`),
        fetch('/api/course-offerings'),
      ])
      if (!courseRes.ok) {
        setCourse(null)
        setLoading(false)
        return
      }
      const courseData = await courseRes.json()
      const topicsData = topicsRes.ok ? await topicsRes.json() : []
      const sessionData = await sessionRes.json()
      const progressData = progressRes.ok ? await progressRes.json() : []
      const offeringsData = offeringsRes.ok ? await offeringsRes.json() : []

      if (Array.isArray(progressData)) {
        const pMap = progressData.reduce((acc: any, curr: any) => {
          acc[curr.contentId] = curr.status
          return acc
        }, {})
        setProgressMap(pMap)
      }

      if (Array.isArray(offeringsData)) {
        const found = offeringsData.find((o: any) => o.courseId === params.id)
        setOffering(found || null)
      }

      const activeCourse = courseData.course || courseData
      const activeTopics = Array.isArray(topicsData) ? topicsData : []
      setCourse(activeCourse)
      setTopics(activeTopics)
      setRole(sessionData.user?.role || '')
      setUserId(sessionData.user?.id || '')

      const isStudent = sessionData.user?.role === 'STUDENT'
      if (activeCourse?.requireFeedback && !activeCourse?.hasSubmittedFeedback && isStudent) {
        setShowForcedFeedback(true)
      }

      // Topics start collapsed — user expands on click
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [params.id])

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
        setPurchasedCourse({ courseName: data.courseName, accessType })
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
          name: data.userName || '',
          email: data.userEmail || '',
        },
        theme: { color: 'var(--accent)' },
        handler: async (response: any) => {
          setIsProcessing(true)
          setVerifyingPayment(true)
          try {
            const verifyRes = await fetch(`/api/course-offerings/${offeringId}/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                accessType,
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyRes.ok) {
              setSuccessOrderId(verifyData.orderId || 'SUCCESS')
              setPurchasedCourse({ 
                courseName: data.courseName,
                accessType,
                orderId: verifyData.orderId,
                courseTier: accessType === 'LIVE' ? 'Live + Recorded (Pro)' : 'Recorded (Plus)'
              })
            } else {
              alert('Verification failed: ' + verifyData.error)
            }
          } catch {
            alert('Payment verification failed. Please contact support.')
          } finally {
            setIsProcessing(false)
            setPurchasing(null)
            setVerifyingPayment(false)
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false)
            setPurchasing(null)
          },
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
      setIsProcessing(false)
    } catch (err: any) {
      alert(err.message)
      setIsProcessing(false)
      setPurchasing(null)
    }
  }

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const w = window as any
      setIsNative(!!(w.Capacitor?.isNativePlatform?.() || w.Capacitor?.isNative))
    }
  }, [])

  const updateProgress = async (contentId: string, status: string) => {
    setProgressMap(prev => ({ ...prev, [contentId]: status })) // Optimistic UI update
    try {
      await fetch('/api/lectures/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, status })
      })
    } catch (e) {
      console.error("Failed to update progress", e)
    }
  }

  const toggleTopic = (id: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openCourseCommunity = () => {
    if (!course?.id || course.isCommunityActive === false || course.isEffectivelyDisabled) {
      alert('Community not available for this course')
      return
    }

    router.push(`/community?course=${encodeURIComponent(course.id)}`)
  }

  const [upgradeSuccessOrderId, setUpgradeSuccessOrderId] = useState<string | null>(null)

  const handleUpgrade = async (courseId: string) => {
    setIsProcessing(true)
    setUpgrading(true)
    try {
      // Step 1: Create Razorpay order
      const orderRes = await fetch(`/api/courses/${courseId}/create-razorpay-order`, { method: 'POST' })
      if (!orderRes.ok) {
        const data = await orderRes.json()
        alert(data.error || 'Failed to create order')
        setIsProcessing(false)
        setUpgrading(false)
        return
      }
      const orderData = await orderRes.json()

      // Step 2: Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'GenZ IItian',
        description: `PRO Upgrade — ${orderData.courseName}`,
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: orderData.userName,
          email: orderData.userEmail,
        },
        theme: { color: 'var(--accent)' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          // Step 3: Verify payment and upgrade
          setIsProcessing(true)
          try {
            const verifyRes = await fetch(`/api/courses/${courseId}/upgrade`, {
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
              setUpgradeModalCourse(null)
              setUpgradeSuccessOrderId(verifyData.orderId)
              fetchData()
            } else {
              alert(verifyData.error || 'Payment verification failed')
            }
          } catch {
            alert('Payment verification failed. Please contact support.')
          } finally {
            setIsProcessing(false)
            setUpgrading(false)
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false)
            setUpgrading(false)
          },
        },
      }

      const rzp = new (window as unknown as { Razorpay: new (opts: typeof options) => { open: () => void } }).Razorpay(options)
      rzp.open()
      setIsProcessing(false)
    } catch (e: any) {
      alert(e.message || 'Something went wrong')
      setIsProcessing(false)
      setUpgrading(false)
    }
  }



  if (loading) {
    return (
      <>
        {/* Mobile Skeleton */}
        <div className="course-detail-mobile-only" style={{ paddingBottom: '24px', background: 'var(--bg)', minHeight: '100vh' }}>
          {loadingFact && (
            <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'center' }}>
              <LoadingFactCard fact={loadingFact} />
            </div>
          )}
          {/* Mobile Hero Cover Skeleton */}
          <div style={{
            height: '240px',
            background: 'var(--skeleton-shine)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
              <div className="skeleton" style={{ width: '40px', height: '18px', borderRadius: '10px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton" style={{ height: '22px', width: '80%', borderRadius: '4px' }} />
              <div className="skeleton" style={{ height: '14px', width: '40%', borderRadius: '4px' }} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <div className="skeleton" style={{ height: '12px', width: '60px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ height: '12px', width: '80px', borderRadius: '4px' }} />
              </div>
            </div>
          </div>

          {/* Progress Card Skeleton */}
          <div style={{ margin: '-20px 16px 20px', position: 'relative', zIndex: 10 }}>
            <div style={{
              background: 'var(--surface)',
              borderRadius: '24px',
              padding: '16px 20px',
              boxShadow: '0 12px 30px -10px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div className="skeleton" style={{ height: '12px', width: '60px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ height: '12px', width: '30px', borderRadius: '4px' }} />
                </div>
                <div className="skeleton" style={{ height: '6px', width: '100%', borderRadius: '3px' }} />
              </div>
            </div>
          </div>

          {/* Mobile Tabs Skeleton */}
          <div style={{
            display: 'flex',
            margin: '0 16px 20px',
            borderRadius: '16px',
            background: 'var(--surface-2)',
            padding: '4px',
            boxShadow: 'inset 2px 2px 5px var(--neu-dark), inset -2px -2px 5px var(--neu-light)'
          }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ flex: 1, padding: '12px', display: 'flex', justifyContent: 'center' }}>
                <div className="skeleton" style={{ height: '14px', width: '60px', borderRadius: '4px' }} />
              </div>
            ))}
          </div>

          {/* Curriculum List Skeleton */}
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'var(--surface)',
                borderRadius: '24px',
                padding: '16px 20px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: '14px', width: '70%', marginBottom: '4px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ height: '10px', width: '40%', borderRadius: '4px' }} />
                  </div>
                </div>
                <div className="skeleton" style={{ width: '14px', height: '14px', borderRadius: '50%' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Skeleton */}
        <div className="page-container course-detail-desktop-only">
          {loadingFact && (
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
              <LoadingFactCard fact={loadingFact} />
            </div>
          )}
          {/* Header Banner Skeleton */}
          <div className="card" style={{ overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ background: 'var(--skeleton-shine)', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton" style={{ height: '12px', width: '100px', borderRadius: '4px', marginBottom: '12px' }} />
              <div className="skeleton" style={{ height: '28px', width: '250px', borderRadius: '4px', marginBottom: '6px' }} />
              <div className="skeleton" style={{ height: '14px', width: '450px', borderRadius: '4px', marginBottom: '14px' }} />
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="skeleton" style={{ height: '20px', width: '80px', borderRadius: '20px' }} />
                <div className="skeleton" style={{ height: '12px', width: '150px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ height: '20px', width: '180px', borderRadius: '20px' }} />
                <div className="skeleton" style={{ height: '20px', width: '160px', borderRadius: '20px' }} />
              </div>
            </div>
          </div>

          {/* Topics List Skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ overflow: 'hidden', padding: '0' }}>
                {/* Topic Header Skeleton */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '12px' }}>
                  <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: '15px', width: '200px', borderRadius: '4px', marginBottom: '4px' }} />
                    <div className="skeleton" style={{ height: '12px', width: '80px', borderRadius: '4px' }} />
                  </div>
                  <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                </div>

                {/* Topic Expanded Content Skeleton */}
                <div style={{ borderTop: '1px solid #d8dae3', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[1, 2].map((j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 20px', borderRadius: '24px', background: 'var(--surface-2)' }}>
                      <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton" style={{ height: '14px', width: '180px', borderRadius: '4px', marginBottom: '6px' }} />
                        <div className="skeleton" style={{ height: '11px', width: '240px', borderRadius: '4px' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div className="skeleton" style={{ height: '32px', width: '80px', borderRadius: '50px' }} />
                        <div className="skeleton" style={{ height: '32px', width: '32px', borderRadius: '50%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  if (!course) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p style={{ fontSize: '16px', fontWeight: '500' }}>Course not found</p>
          <Link href="/courses" className="btn btn-primary" style={{ marginTop: '16px' }}>Back to Courses</Link>
        </div>
      </div>
    )
  }

  const isManager = ['MANAGER', 'ADMIN'].includes(role)
  const canManage = isManager
  const NEW_CONTENT_WINDOW_MS = 24 * 60 * 60 * 1000
  const coursePalette = getCourseDisplayPalette(course.color, resolvedTheme)

  const isNewContentItem = (item: { createdAt?: string | null }) => {
    if (!item.createdAt) return false
    const createdAt = new Date(item.createdAt).getTime()
    return Number.isFinite(createdAt) && Date.now() - createdAt < NEW_CONTENT_WINDOW_MS
  }

  const renderNewBadge = () => (
    <span style={{
      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
      color: 'white',
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '9px',
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
      flexShrink: 0,
      lineHeight: 1.2,
    }}>
      New
    </span>
  )

  const getFilteredTopics = () => {
    return topics.map(topic => {
      let filteredContent = [...(topic.content || [])]

      if (activeSectionTab === 'materials') {
        filteredContent = filteredContent.filter(item => !!item.pptUrl)
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        filteredContent = filteredContent.filter(item => 
          (item.title || '').toLowerCase().includes(query) || 
          (item.description || '').toLowerCase().includes(query)
        )
      }

      return {
        ...topic,
        content: filteredContent
      }
    }).filter(topic => topic.content.length > 0)
  }

  const isExpired = !isManager && Boolean(course.expiresAt && new Date(course.expiresAt).getTime() < new Date().getTime());

  if (isExpired) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', background: 'var(--surface)', padding: '40px', borderRadius: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', maxWidth: '500px', width: '100%' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--danger-light)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Access Expired
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>
            Your access to {course.name} has expired. You can no longer view the course lectures or materials.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', width: '100%' }}>
            <Link href="/courses" className="btn btn-ghost" style={{ padding: '12px 24px', borderRadius: '16px', background: 'var(--surface)', color: 'var(--text-secondary)', fontWeight: '700', textDecoration: 'none' }}>Back to Courses</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    {/* Mobile redesign */}
    <div className="course-detail-mobile-only">
      <MobileCourseDetail
        course={course as any}
        topics={topics as any}
        expandedTopics={expandedTopics}
        toggleTopic={toggleTopic}
        progressMap={progressMap}
        updateProgress={updateProgress}
        role={role}
        setInfoModalCourse={setInfoModalCourse}
        setUpgradeModalCourse={setUpgradeModalCourse}
        setShowPurchaseModal={setShowPurchaseModal}
        offering={offering}
      />
    </div>
    {/* Desktop layout */}
    <div className="page-container fade-in course-detail-desktop-only">
      {/* Course Header Banner */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: '20px' }}>
        <div 
          onMouseEnter={() => setShowUpgradeHint(true)}
          onMouseLeave={() => setShowUpgradeHint(false)}
          style={{
            background: ['RECORDED', 'FREE'].includes(course.enrollmentType || '') ? 'linear-gradient(135deg, #6b7280, #9ca3af)' : coursePalette.background,
            padding: '28px 24px', position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', width: '180px', height: '180px', borderRadius: '50%', background: coursePalette.decorativeColor, top: '-60px', right: '40px' }} />
          <div style={{ position: 'absolute', width: '100px', height: '100px', borderRadius: '50%', background: coursePalette.decorativeColor, bottom: '-30px', right: '200px' }} />

          {/* Info Button for Recorded users (Top Right) */}
          {course.enrollmentType === 'RECORDED' && course.liveUpgradePrice && !isManager && (
            <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 10 }}>
              <button
                onClick={() => setInfoModalCourse(course)}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
                  color: '#fff', fontSize: '16px', fontWeight: '800', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s',
                }}
                title={`Compare PRO vs ${['FREE', 'DEMO'].includes(course.enrollmentType || '') ? 'General Batch' : 'PLUS ( Recorded )'}`}
              >
                i
              </button>
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: '0',
                background: 'var(--text-primary)', color: 'var(--text-inverse)', padding: '8px 14px', borderRadius: '12px',
                fontSize: '11px', fontWeight: '600', width: '200px', textAlign: 'center',
                boxShadow: '0 8px 25px rgba(0,0,0,0.4)', pointerEvents: 'none',
                opacity: showUpgradeHint ? 1 : 0, 
                transform: showUpgradeHint ? 'translateY(0)' : 'translateY(5px)',
                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', zIndex: 100,
                lineHeight: '1.4'
              }} className="info-tooltip">
                Click here to see difference between PLUS AND PRO batches
                <div style={{ position: 'absolute', bottom: '100%', right: '10px', border: '6px solid transparent', borderBottomColor: 'var(--text-primary)' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', position: 'relative' }}>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <Link href="/courses" style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                color: coursePalette.secondaryText, fontSize: '13px', marginBottom: '12px', textDecoration: 'none',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Courses
              </Link>
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: coursePalette.textColor, marginBottom: '6px' }}>{course.name}</h1>
              {course.description && (
                <p style={{ color: coursePalette.secondaryText, fontSize: '14px', maxWidth: '600px', lineHeight: '1.5' }}>{course.description}</p>
              )}
              <div style={{ display: 'flex', gap: '16px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                {course.subject && (
                  <span style={{ background: coursePalette.badgeBg, color: coursePalette.badgeText, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                    {course.subject}
                  </span>
                )}
                <span style={{ color: coursePalette.secondaryText, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {course._count?.topics || 0} topic{(course._count?.topics !== 1) ? 's' : ''} &middot; {course._count?.lectures || 0} lecture{(course._count?.lectures !== 1) ? 's' : ''} &middot; {course._count?.materials || 0} material{(course._count?.materials !== 1) ? 's' : ''}
                </span>
                {course.expiresAt && (
                  <span style={{ 
                    background: 'rgba(255,165,0,0.2)', 
                    color: '#ffa500', 
                    padding: '4px 12px', 
                    borderRadius: '20px', 
                    fontSize: '12px', 
                    fontWeight: '600',
                    border: '1px solid rgba(255,165,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {(() => {
                      const expiry = new Date(course.expiresAt || '')
                      const diff = expiry.getTime() - new Date().getTime()
                      const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
                      return days > 0 ? `Course Access Ends In: ${days} Day${days !== 1 ? 's' : ''}` : 'Course Access Ending Soon'
                    })()}
                  </span>
                )}
                  <span style={{ background: coursePalette.badgeBg, color: coursePalette.badgeText, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Teacher Name: {course.teacherName}
                  </span>

                {/* Upgrade Button for Recorded users perfectly inline */}
                {course.enrollmentType === 'RECORDED' && course.liveUpgradePrice && (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setUpgradeModalCourse(course)}
                      onMouseEnter={() => setShowUpgradeHint(true)}
                      onMouseLeave={() => setShowUpgradeHint(false)}
                      style={{
                        background: 'var(--surface)', color: 'var(--text-primary)', padding: '6px 16px', borderRadius: '50px',
                        fontSize: '12px', fontWeight: '800', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ fontSize: '8px', background: 'var(--bg)', padding: '1px 6px', borderRadius: '10px', color: 'var(--text-secondary)' }}>OPTIONAL</span>
                      ⚡ Upgrade to PRO
                    </button>
                  </div>
                )}
              </div>
            </div>

              {role === 'MANAGER' && (
                <button
                  onClick={() => router.push(`/courses/${params.id}/edit`)}
                  style={{
                    background: coursePalette.badgeBg, border: `1px solid ${coursePalette.badgeBg}`,
                    color: coursePalette.badgeText, padding: '8px 16px', borderRadius: '20px',
                    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(4px)',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Manage Course
                </button>
              )}
          </div>
        </div>
      </div>

      {/* Dynamic inline styles for desktop interactions */}
      <style dangerouslySetInnerHTML={{ __html: `
        .lecture-card {
          transition: all 0.2s ease-in-out;
        }
        .lecture-card-clickable {
          cursor: pointer;
        }
        .lecture-card-clickable:hover {
          transform: translateY(-1.5px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04) !important;
          border-color: ${coursePalette.accent} !important;
        }
        .search-input-hover {
          transition: all 0.15s ease-in-out;
        }
        .search-input-hover:focus, .search-input-hover:hover {
          border-color: ${coursePalette.accent} !important;
          background: var(--surface) !important;
          outline: none;
        }
        .btn-watch-hover {
          transition: all 0.15s ease-in-out;
        }
        .btn-watch-hover:hover {
          background: ${coursePalette.hoverAccent} !important;
          transform: translateY(-1px);
        }
        .btn-watch-hover:active {
          transform: translateY(0) scale(0.98);
        }
        .btn-notes-hover {
          transition: all 0.15s ease-in-out;
        }
        .btn-notes-hover:hover {
          background: rgba(74, 85, 104, 0.04) !important;
          border-color: ${coursePalette.accent} !important;
          transform: translateY(-1px);
        }
        .btn-notes-hover:active {
          transform: translateY(0) scale(0.98);
        }
        .btn-progress-hover {
          transition: all 0.15s ease-in-out;
        }
        .btn-progress-hover:hover {
          transform: translateY(-1px);
          filter: brightness(0.96);
        }
        .btn-progress-hover:active {
          transform: translateY(0) scale(0.98);
        }
        .tab-underline-hover {
          transition: all 0.2s ease-in-out;
        }
        .tab-underline-hover:hover {
          color: ${coursePalette.accent} !important;
          opacity: 0.85;
        }
        .demo-unenroll-button:hover {
          background: color-mix(in srgb, var(--danger-light) 76%, var(--surface) 24%) !important;
          border-color: color-mix(in srgb, var(--danger) 74%, transparent) !important;
          color: var(--danger) !important;
        }
        .course-content-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          min-width: 0;
        }
        @container (max-width: 935px) {
          .course-content-grid {
            grid-template-columns: 1fr;
          }
        }
        @supports not (container-type: inline-size) {
          @media (max-width: 1100px) {
            .course-content-grid {
              grid-template-columns: 1fr;
            }
          }
        }
      `}} />

      {/* Tab Navigation and Search/Filter Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '0px'
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '32px', rowGap: 0, flexWrap: 'wrap', flex: '1 1 420px', minWidth: 0 }}>
          {(['lectures', 'materials', 'community', 'help', 'about'] as const).map(tab => {
            const isActive = tab !== 'community' && activeSectionTab === tab;
            return (
              <button
                key={tab}
                className="tab-underline-hover"
                onClick={() => {
                  if (tab === 'community') {
                    openCourseCommunity()
                    return
                  }
                  if (tab === 'help') {
                    router.push('/support')
                    return
                  }
                  setActiveSectionTab(tab);
                  setSearchQuery('');
                }}
                style={{
                  padding: '12px 4px',
                  fontSize: '15px',
                  fontWeight: '700',
                  border: 'none',
                  background: 'none',
                  color: isActive ? coursePalette.accent : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  borderBottom: isActive ? `3px solid ${coursePalette.accent}` : '3px solid transparent',
                  marginBottom: '-1px',
                  zIndex: 2,
                }}
              >
                {tab === 'lectures' ? 'Lectures' : tab === 'materials' ? 'Materials' : tab === 'community' ? 'Community' : tab === 'help' ? 'Get Help' : 'About Course'}
              </button>
            );
          })}
        </div>

        {/* Search (only visible for Lectures/Materials tabs) */}
        {activeSectionTab !== 'about' && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: isNative ? 1 : '1 1 360px', minWidth: isNative ? '100%' : 'min(100%, 360px)', justifyContent: 'flex-end', paddingBottom: '8px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 220px', minWidth: '180px', maxWidth: '320px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                className="form-input search-input-hover"
                placeholder="Search lecture..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: '34px',
                  borderRadius: '10px',
                  height: '36px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                  width: '100%',
                  boxShadow: 'none',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Render area based on selected tab */}
      {activeSectionTab === 'about' ? (
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '14px' }}>About Course</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {course.aboutUs || 'No about course details available.'}
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Teacher</div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {course.teacherName || 'Not Assigned'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Course Duration</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>
                  {course.startDate ? new Date(course.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not Available'}
                  {' - '}
                  {course.endDate ? new Date(course.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not Available'}
                </span>
              </div>
            </div>
          </div>

          {role === 'STUDENT' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-start' }}>
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="btn btn-primary"
                style={{
                  padding: '10px 20px',
                  borderRadius: '50px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  background: coursePalette.accent,
                  color: '#fff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Give Feedback
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Lectures and Materials View */
        (() => {
          const filteredTopics = getFilteredTopics()
          if (filteredTopics.length === 0) {
            return (
              <div className="card empty-state" style={{ padding: '48px' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ marginBottom: '12px' }}>
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <p style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>No matches found</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Try refining your search query or sorting options.
                </p>
              </div>
            )
          }

          const handleProgressCycle = async (itemId: string) => {
            const currentStatus = progressMap[itemId]
            let nextStatus: 'COMPLETED' | 'REWATCH' | 'NOT_STARTED' = 'COMPLETED'
            if (currentStatus === 'COMPLETED') {
              nextStatus = 'REWATCH'
            } else if (currentStatus === 'REWATCH') {
              nextStatus = 'NOT_STARTED'
            }
            await updateProgress(itemId, nextStatus)
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', containerType: 'inline-size' }}>
              {filteredTopics.map((topic, topicIdx) => {
                const hasNewContent = isNewContentItem(topic as any) || topic.content?.some((item: any) => isNewContentItem(item));

                const videoNumbers = new Map<string, string>();
                let videoSeq = 0;
                (topic.content || []).forEach((item: any) => {
                  const isVideo = !!(item.videoUrl || item.youtubeUrl);
                  if (isVideo) {
                    videoSeq++;
                    videoNumbers.set(item.id, String(videoSeq).padStart(2, '0'));
                  }
                });

	                const activeContent = topic.content.filter((item) => !(item as any).isDemoLocked)
	                const lockedContent = topic.content.filter((item) => (item as any).isDemoLocked)
	                const topicNumber = String(topicIdx + 1).padStart(2, '0')
	                const topicItemCount = topic.content.length
	                const topicItemLabel = activeSectionTab === 'materials'
	                  ? `Material${topicItemCount !== 1 ? 's' : ''}`
	                  : `Lecture${topicItemCount !== 1 ? 's' : ''}`

	                return (
	                  <div key={topic.id} style={{ display: 'flex', flexDirection: 'column', gap: expandedTopics.has(topic.id) ? '16px' : '0' }}>
	                    {/* Topic Accordion Header */}
	                    <div style={{
	                      display: 'flex',
	                      alignItems: 'center',
	                      width: '100%',
	                      minHeight: '62px',
	                      background: 'var(--topic-header-bg)',
	                      border: '1px solid var(--border)',
	                      borderRadius: '15px',
	                      boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)',
	                      overflow: 'hidden',
	                      position: 'relative',
	                    }}>
	                      <div style={{
	                        position: 'absolute',
	                        left: 0,
	                        top: '10px',
	                        bottom: '10px',
	                        width: '4px',
	                        borderRadius: '0 4px 4px 0',
	                        background: coursePalette.accent,
	                        opacity: 0.9,
	                      }} />
	                      <button
	                        onClick={() => toggleTopic(topic.id)}
	                        style={{
                          flex: 1, minWidth: 0, minHeight: '62px', padding: '8px 20px 8px 24px', background: 'transparent', border: 'none',
	                          display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer',
	                          textAlign: 'left',
	                        }}
	                      >
	                        <div style={{
	                          width: '42px', height: '42px',
	                          borderRadius: '11px',
	                          background: coursePalette.softBg,
	                          border: `1px solid ${coursePalette.softBorder}`,
	                          color: coursePalette.accent,
	                          display: 'flex', alignItems: 'center', justifyContent: 'center',
	                          fontSize: '16px', fontWeight: '900', flexShrink: 0,
	                          lineHeight: 1,
	                        }}>
	                          {topicNumber}
	                        </div>
	                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
	                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
	                            <span style={{
	                              fontSize: '16px',
	                              fontWeight: '900',
	                              color: 'var(--topic-header-text)',
	                              overflow: 'hidden',
	                              textOverflow: 'ellipsis',
	                              whiteSpace: 'nowrap',
	                            }}>
	                              {topic.title}
	                            </span>
	                            {hasNewContent && renderNewBadge()}
	                          </div>
	                          <span style={{ fontSize: '12px', color: 'var(--topic-header-muted)', fontWeight: '700' }}>
	                            {topicItemCount} {topicItemLabel}
	                          </span>
	                        </div>
	                        <svg
	                          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--topic-header-muted)" strokeWidth="2.5"
	                          style={{ transition: 'transform 0.2s', transform: expandedTopics.has(topic.id) ? 'rotate(180deg)' : 'none' }}
	                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                    </div>

	                    {/* Topic Accordion Content */}
	                    {expandedTopics.has(topic.id) && (
	                      <div style={{ padding: '0', minHeight: '60px' }}>
                        <div className="course-content-grid" style={isNative ? { gridTemplateColumns: '1fr' } : undefined}>
                          {activeContent.map((item) => {
                            const isDocument = (!item.videoUrl && !item.youtubeUrl) || activeSectionTab === 'materials';
                            const isVideo = !isDocument;
                            const videoNum = videoNumbers.get(item.id);
                            const gridCol = 'auto';

                            if (isDocument && activeSectionTab === 'lectures') {
                              return (
                                <div
                                  key={item.id}
                                  className="lecture-card"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'var(--surface-2)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    padding: '10px 16px',
                                    gap: '6px',
                                    position: 'relative',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.01)',
                                    gridColumn: gridCol,
                                    minHeight: '82px',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                                    <div style={{
                                      width: '40px',
                                      height: '40px',
                                      borderRadius: '8px',
                                      background: 'rgba(74, 85, 104, 0.08)',
                                      color: 'var(--text-muted)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0
                                    }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }} title={item.title}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.title}</span>
                                        {isNewContentItem(item) && renderNewBadge()}
                                      </h4>
                                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{
                                          background: 'rgba(74, 85, 104, 0.08)',
                                          color: 'var(--text-muted)',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '9px',
                                          fontWeight: '800',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.05em'
                                        }}>
                                          NOTES ONLY
                                        </span>
                                      {item.createdAt && (
                                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          • Added on {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                      )}
                                      </div>
                                    </div>
                                  </div>
                                  {item.pptUrl && (
                                    <Link
                                      href={`/material/${item.id}/view`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-ghost btn-notes-hover"
                                      style={{
                                        padding: '5px 13px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        borderRadius: '8px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        height: '28px',
                                        border: '1px solid var(--border)',
                                        background: 'transparent',
                                        boxShadow: 'none',
                                        flexShrink: 0,
                                      }}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                      </svg>
                                      Download Notes
                                    </Link>
                                  )}
                                </div>
                              );
                            }

                            if (isDocument) {
                              return (
                                <div
                                  key={item.id}
                                  className="lecture-card"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'var(--surface-2)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    padding: '8px 16px',
                                    gap: '16px',
                                    position: 'relative',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.01)',
                                    gridColumn: gridCol,
                                    height: '66px',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  {/* Left part: Icon + Text info */}
                                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                                    {/* Document Icon Container */}
                                    <div style={{
                                      width: '40px',
                                      height: '40px',
                                      borderRadius: '8px',
                                      background: 'rgba(74, 85, 104, 0.08)',
                                      color: 'var(--text-muted)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0
                                    }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    </div>

                                    {/* Text info */}
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }} title={item.title}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.title}</span>
                                        {isNewContentItem(item) && renderNewBadge()}
                                      </h4>
                                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{
                                          background: 'rgba(74, 85, 104, 0.08)',
                                          color: 'var(--text-muted)',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '9px',
                                          fontWeight: '800',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.05em'
                                        }}>
                                          {activeSectionTab === 'materials' ? 'NOTES' : 'NOTES ONLY'}
                                        </span>
                                        {item.createdAt && (
                                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            • Added on {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right part: Action Button */}
                                  <div style={{ flexShrink: 0 }}>
                                    {item.pptUrl && (
                                      <Link
                                        href={`/material/${item.id}/view`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-ghost btn-notes-hover"
                                        style={{
                                          padding: '5px 12px',
                                          fontSize: '11px',
                                          fontWeight: '700',
                                          borderRadius: '8px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          height: '28px',
                                          border: '1px solid var(--border)',
                                          background: 'transparent',
                                          boxShadow: 'none',
                                        }}
                                      >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                        Download Notes
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            // Video item styling
                            return (
                              <div
                                key={item.id}
                                className="lecture-card lecture-card-clickable"
                                role="link"
                                tabIndex={0}
                                onClick={(e) => {
                                  if (isCardActionElement(e.target)) return
                                  openLecture(item.id)
                                }}
                                onKeyDown={(e) => {
                                  if (isCardActionElement(e.target)) return
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    openLecture(item.id)
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  background: 'var(--surface-2)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '12px',
                                  padding: '10px 16px',
                                  gap: '6px',
                                  position: 'relative',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.01)',
                                  gridColumn: gridCol,
                                  minHeight: '82px',
                                  boxSizing: 'border-box'
                                }}
                              >
                                {/* Card Top: Icon/Number container on left, status on right */}
                                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                  {/* Left part: Number Badge + Title/Badge */}
                                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                                    <div style={{
                                      width: '40px',
                                      height: '40px',
                                      borderRadius: '8px',
                                      background: coursePalette.softerBg,
                                      color: coursePalette.accent,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '14px',
                                      fontWeight: '700',
                                      flexShrink: 0
                                    }}>
                                      {videoNum || '00'}
                                    </div>

                                    {/* Title & Badge */}
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }} title={item.title}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.title}</span>
                                        {isNewContentItem(item) && renderNewBadge()}
                                      </h4>
                                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{
                                          background: coursePalette.softBg,
                                          color: coursePalette.accent,
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '9px',
                                          fontWeight: '800',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.05em'
                                        }}>
                                          VIDEO
                                        </span>
                                        {item.duration && (
                                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                            • {item.duration}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right part: Status Buttons */}
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                    {role === 'STUDENT' && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            updateProgress(item.id, progressMap[item.id] === 'REWATCH' ? 'NOT_STARTED' : 'REWATCH')
                                          }}
                                          className="btn-progress-hover"
                                          style={{
                                            background: progressMap[item.id] === 'REWATCH' ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
                                            color: progressMap[item.id] === 'REWATCH' ? '#ca8a04' : 'var(--text-muted)',
                                            border: `1px solid ${progressMap[item.id] === 'REWATCH' ? '#eab308' : 'var(--border)'}`,
                                            padding: '3px 8px',
                                            borderRadius: '50px',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            transition: 'all 0.2s ease',
                                            boxShadow: 'none',
                                          }}
                                        >
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/></svg>
                                          Rewatch
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            updateProgress(item.id, progressMap[item.id] === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED')
                                          }}
                                          className="btn-progress-hover"
                                          style={{
                                            background: progressMap[item.id] === 'COMPLETED' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                            color: progressMap[item.id] === 'COMPLETED' ? 'var(--success)' : 'var(--text-muted)',
                                            border: `1px solid ${progressMap[item.id] === 'COMPLETED' ? 'var(--success)' : 'var(--border)'}`,
                                            padding: '3px 8px',
                                            borderRadius: '50px',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            transition: 'all 0.2s ease',
                                            boxShadow: 'none',
                                          }}
                                        >
                                          {progressMap[item.id] === 'COMPLETED' ? (
                                            <>
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                              Completed
                                            </>
                                          ) : (
                                            <>
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                              Complete
                                            </>
                                          )}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Card Description */}
                                {item.description && (
                                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', margin: '0' }}>
                                    {item.description}
                                  </p>
                                )}

                                {/* Card Bottom: Added date + action buttons */}
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginTop: '2px'
                                }}>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    {item.createdAt && (
                                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        Added on {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                  {item.pptUrl && (
                                    <Link
                                      href={`/material/${item.id}/view`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="btn btn-ghost btn-notes-hover"
                                      style={{
                                        padding: '5px 13px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        borderRadius: '8px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        height: '28px',
                                        border: '1px solid var(--border)',
                                        background: 'transparent',
                                        boxShadow: 'none',
                                      }}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                      </svg>
                                      Download Notes
                                    </Link>
                                  )}
                                  {(item.videoUrl || item.youtubeUrl) && (
                                    <Link
                                      href={getLectureHref(item.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="btn btn-primary btn-watch-hover"
                                      style={{
                                        padding: '5px 14px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        borderRadius: '8px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        height: '28px',
                                        background: coursePalette.accent,
                                        color: '#fff',
                                        border: 'none',
                                        boxShadow: 'none',
                                      }}
                                    >
                                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                      Watch
                                    </Link>
                                  )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Blurred Locked Content */}
                        {lockedContent.length > 0 && (
                          <div style={{ position: 'relative', marginTop: activeContent.length > 0 ? '20px' : '0' }}>
                            <div className="course-content-grid" style={{
                              ...(isNative ? { gridTemplateColumns: '1fr' } : {}),
                              filter: 'blur(5px) grayscale(50%)',
                              opacity: 0.45,
                              pointerEvents: 'none',
                              userSelect: 'none',
                            }}>
                              {lockedContent.map((item) => {
                                const isDocument = (!item.videoUrl && !item.youtubeUrl) || activeSectionTab === 'materials';
                                const isVideo = !isDocument;
                                const videoNum = videoNumbers.get(item.id);
                                const gridCol = 'auto';

                                if (isDocument) {
                                  return (
                                    <div
                                      key={item.id}
                                      className="lecture-card"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: 'var(--surface-2)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        padding: '8px 16px',
                                        gap: '16px',
                                        position: 'relative',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.01)',
                                        gridColumn: gridCol,
                                        height: '66px',
                                        boxSizing: 'border-box'
                                      }}
                                    >
                                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                                        {/* Smaller 40px Icon container */}
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(74, 85, 104, 0.08)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                          <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h4>
                                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <span style={{
                                              background: 'rgba(74, 85, 104, 0.08)',
                                              color: 'var(--text-muted)',
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              fontSize: '9px',
                                              fontWeight: '800',
                                              textTransform: 'uppercase',
                                              letterSpacing: '0.05em'
                                            }}>
                                              {activeSectionTab === 'materials' ? 'NOTES' : 'NOTES ONLY'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={item.id}
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between',
                                      background: 'var(--surface-2)',
                                      border: '1px solid var(--border)',
                                      borderRadius: '12px',
                                      padding: '10px 16px',
                                      gap: '6px',
                                      position: 'relative',
                                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.01)',
                                      gridColumn: gridCol,
                                      minHeight: '82px',
                                      boxSizing: 'border-box'
                                    }}
                                  >
                                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                                        {/* Smaller 40px Number container */}
                                        <div style={{
                                          width: '40px',
                                          height: '40px',
                                          borderRadius: '8px',
                                          background: coursePalette.softerBg,
                                          color: coursePalette.accent,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '14px',
                                          fontWeight: '700',
                                          flexShrink: 0
                                        }}>
                                          {videoNum || '00'}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                          <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h4>
                                          <span style={{
                                            background: coursePalette.softBg,
                                            color: coursePalette.accent,
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '9px',
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                          }}>
                                            VIDEO
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Center Premium Overlay Lock Card */}
                            <div
                              onClick={() => setShowPurchaseModal(true)}
                              style={{
                              position: 'absolute',
                              top: 0, left: 0, right: 0, bottom: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 10,
                              padding: '16px',
                              cursor: 'pointer',
                            }}>
                              <div
                                onClick={() => setShowPurchaseModal(true)}
                                style={{
                                  background: 'rgba(23, 27, 38, 0.92)',
                                  backdropFilter: 'blur(16px)',
                                  WebkitBackdropFilter: 'blur(16px)',
                                  border: '1.5px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '24px',
                                  padding: '24px 32px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  textAlign: 'center',
                                  cursor: 'pointer',
                                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 50px rgba(99, 102, 241, 0.15)',
                                  maxWidth: '340px',
                                  width: '100%',
                                  pointerEvents: 'auto',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <div style={{
                                  width: '44px',
                                  height: '44px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(79, 70, 229, 0.2))',
                                  border: '1.5px solid rgba(99, 102, 241, 0.4)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginBottom: '12px',
                                  color: '#818cf8',
                                }}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                  </svg>
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', marginBottom: '16px' }}>
                                  Unlock All Lectures
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>⌛</span> Access Till End Term
                                </div>
                                <button style={{
                                  width: '100%',
                                  padding: '10px 20px',
                                  borderRadius: '50px',
                                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                  color: '#ffffff',
                                  fontWeight: '800',
                                  fontSize: '13px',
                                  border: 'none',
                                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                  cursor: 'pointer',
                                }}>
                                  Unlock Now
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()
      )}
      {/* Info Modal */}
      {infoModalCourse && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '20px'
        }} onClick={() => setInfoModalCourse(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '750px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
            animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '30px 40px', background: 'linear-gradient(135deg, var(--surface-2), var(--border))', borderBottom: '1.5px solid var(--border)', position: 'relative' }}>
              <button onClick={() => setInfoModalCourse(null)} style={{ position: 'absolute', top: '25px', right: '30px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Batch Comparison</h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: '500' }}>Choose the experience that fits your learning style</p>
            </div>

            {/* Comparison Table */}
            <div style={{ padding: '30px 40px' }}>
              <div style={{ borderRadius: '24px', overflow: 'hidden', border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)' }}>
                      <th style={{ padding: '18px 24px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Features</th>
                      <th style={{ padding: '18px 24px', fontSize: '13px', color: 'var(--warning)', fontWeight: '800', background: 'var(--warning-light)', textAlign: 'center' }}>
                        {['FREE', 'DEMO'].includes(infoModalCourse?.enrollmentType || '') ? 'General Batch' : 'PLUS ( Recorded )'}
                      </th>
                      <th style={{ padding: '18px 24px', fontSize: '13px', color: 'var(--primary-dark)', fontWeight: '800', background: 'var(--primary-light)', textAlign: 'center' }}>PRO ( LIVE )</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { f: 'Course Lectures', g: '✅ Full Access', p: '✅ Full Access' },
                      { f: 'Course Materials', g: '✅ Full Access', p: '✅ Full Access' },
                      { f: 'Live Classes', g: '❌ No Access', p: '✅ Direct Entry' },
                      { f: 'Direct Q&A with Teacher', g: '❌ No', p: '✅ Yes (Live)' },
                      { f: 'Weekly Mentorship', g: '❌ No', p: '✅ Every Sunday' },
                      { f: 'Priority Support', g: '❌ Standard', p: '✅ 24/7 Priority' },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>{row.f}</td>
                        <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--warning)', textAlign: 'center', background: 'var(--warning-light)' }}>{row.g}</td>
                        <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--primary-dark)', fontWeight: '700', textAlign: 'center', background: 'var(--surface)' }}>{row.p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '0 40px 40px', textAlign: 'center' }}>
              <button onClick={() => setInfoModalCourse(null)} style={{ background: 'var(--primary)', color: 'white', padding: '14px 40px', borderRadius: '16px', fontSize: '15px', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Confirmation Modal */}
      {upgradeModalCourse && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          padding: '20px'
        }} onClick={() => !upgrading && setUpgradeModalCourse(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '440px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden',
            animation: 'modalSlideUp 0.3s ease-out', position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            {upgrading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', marginBottom: '24px' }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"/>
                </svg>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px' }}>Processing Payment...</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', textAlign: 'center' }}>
                  Please wait while we securely process your transaction.<br/>Do not close or refresh this page.
                </p>
                <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } }`}} />
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <button 
                  onClick={() => setUpgradeModalCourse(null)}
                  style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', fontSize: '28px', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}
                >&times;</button>
                <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--surface)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Upgrade to PRO Batch</h2>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>{upgradeModalCourse.name}</div>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>
                  You will get access to <strong>live classes, real-time mentorship,</strong> and everything as in your current plan.
                </p>
                
                <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '24px', marginBottom: '32px', border: '1.5px solid var(--border)' }}>
                  <div style={{ fontSize: '36px', fontWeight: '900', color: 'var(--accent)', marginBottom: '8px' }}>₹{upgradeModalCourse.liveUpgradePrice}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>One-time upgrade fee</div>
                </div>

                <div style={{ display: 'flex', gap: '14px' }}>
                  <button 
                    onClick={() => setUpgradeModalCourse(null)} 
                    style={{ flex: 1, padding: '16px', borderRadius: '18px', border: '2px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleUpgrade(upgradeModalCourse.id)}
                    style={{ 
                      flex: 1.5, padding: '16px', borderRadius: '18px', border: 'none', 
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)', 
                      color: 'white', fontWeight: '700', cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    ✓ Confirm Upgrade
                  </button>
                </div>
                
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '24px' }}>
                  Course will be updated automatically after Payment
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />

      {/* Upgrade Success Modal */}
      {upgradeSuccessOrderId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          padding: '20px'
        }} onClick={() => setUpgradeSuccessOrderId(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '440px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px', textAlign: 'center',
            animation: 'modalSlideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Welcome to PRO!</h2>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
              Your upgrade was successful. You now have full access to live classes, mentorship, and priority support.
            </p>
            <div style={{ background: 'var(--success-light)', borderRadius: '16px', padding: '16px', marginBottom: '24px', border: '1.5px solid var(--border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Order ID</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--success)', fontFamily: 'monospace' }}>{upgradeSuccessOrderId}</div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>A confirmation email has been sent to your registered email.</p>
            <button
              onClick={() => setUpgradeSuccessOrderId(null)}
              style={{
                width: '100%', padding: '16px', borderRadius: '18px', border: 'none',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
              }}
            >
              Got it, let&apos;s go! 🚀
            </button>
          </div>
        </div>
      )}

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
              margin: '0 auto 20px'
            }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Processing...</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Please wait while we set up your course access.</p>
          </div>
        </div>
      )}

      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    </div>

    {/* ── Modals (shared between mobile & desktop) ── */}
      {/* Info Modal */}
      {infoModalCourse && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '20px'
        }} onClick={() => setInfoModalCourse(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '750px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
            animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '24px 24px', background: 'linear-gradient(135deg, var(--surface-2), var(--border))', borderBottom: '1.5px solid var(--border)', position: 'relative' }}>
              <button onClick={() => setInfoModalCourse(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>Batch Comparison</h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: '500' }}>Choose the experience that fits your learning style</p>
            </div>

            {/* Comparison Table wrapper with swipe-to-scroll for mobile */}
            <div style={{ padding: '20px 20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1.5px solid var(--border)', background: 'var(--surface)', minWidth: '460px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)' }}>
                      <th style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Features</th>
                      <th style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--warning)', fontWeight: '800', background: 'var(--warning-light)', textAlign: 'center' }}>
                        {['FREE', 'DEMO'].includes(infoModalCourse?.enrollmentType || '') ? 'General Batch' : 'PLUS ( Recorded )'}
                      </th>
                      <th style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--primary-dark)', fontWeight: '800', background: 'var(--primary-light)', textAlign: 'center' }}>PRO ( LIVE )</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { f: 'Course Lectures', g: '✅ Full Access', p: '✅ Full Access' },
                      { f: 'Course Materials', g: '✅ Full Access', p: '✅ Full Access' },
                      { f: 'Live Classes', g: '❌ No Access', p: '✅ Direct Entry' },
                      { f: 'Direct Q&A with Teacher', g: '❌ No', p: '✅ Yes (Live)' },
                      { f: 'Weekly Mentorship', g: '❌ No', p: '✅ Every Sunday' },
                      { f: 'Priority Support', g: '❌ Standard', p: '✅ 24/7 Priority' },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>{row.f}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--warning)', textAlign: 'center', background: 'var(--warning-light)' }}>{row.g}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--primary-dark)', fontWeight: '700', textAlign: 'center', background: 'var(--surface)' }}>{row.p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
              <button onClick={() => setInfoModalCourse(null)} style={{ background: 'var(--primary)', color: 'white', padding: '12px 36px', borderRadius: '14px', fontSize: '14px', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Confirmation Modal */}
      {upgradeModalCourse && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          padding: '20px'
        }} onClick={() => !upgrading && setUpgradeModalCourse(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '440px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden',
            animation: 'modalSlideUp 0.3s ease-out', position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            {upgrading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', marginBottom: '24px' }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"/>
                </svg>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px' }}>Processing Payment...</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', textAlign: 'center' }}>
                  Please wait while we securely process your transaction.<br/>Do not close or refresh this page.
                </p>
                <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } }`}} />
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <button
                  onClick={() => setUpgradeModalCourse(null)}
                  style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', fontSize: '28px', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}
                >&times;</button>
                <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--surface)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Upgrade to PRO Batch</h2>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>{upgradeModalCourse.name}</div>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>
                  You will get access to <strong>live classes, real-time mentorship,</strong> and everything as in your current plan.
                </p>

                <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '24px', marginBottom: '32px', border: '1.5px solid var(--border)' }}>
                  <div style={{ fontSize: '36px', fontWeight: '900', color: 'var(--accent)', marginBottom: '8px' }}>₹{upgradeModalCourse.liveUpgradePrice}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>One-time upgrade fee</div>
                </div>

                <div style={{ display: 'flex', gap: '14px' }}>
                  <button
                    onClick={() => setUpgradeModalCourse(null)}
                    style={{ flex: 1, padding: '16px', borderRadius: '18px', border: '2px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpgrade(upgradeModalCourse.id)}
                    style={{
                      flex: 1.5, padding: '16px', borderRadius: '18px', border: 'none',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: 'white', fontWeight: '700', cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    ✓ Confirm Upgrade
                  </button>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '24px' }}>
                  Course will be updated automatically after Payment
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />

      {/* Upgrade Success Modal */}
      {upgradeSuccessOrderId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          padding: '20px'
        }} onClick={() => setUpgradeSuccessOrderId(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '440px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px', textAlign: 'center',
            animation: 'modalSlideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Welcome to PRO!</h2>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
              Your upgrade was successful. You now have full access to live classes, mentorship, and priority support.
            </p>
            <div style={{ background: 'var(--success-light)', borderRadius: '16px', padding: '16px', marginBottom: '24px', border: '1.5px solid var(--border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Order ID</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--success)', fontFamily: 'monospace' }}>{upgradeSuccessOrderId}</div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>A confirmation email has been sent to your registered email.</p>
            <button
              onClick={() => setUpgradeSuccessOrderId(null)}
              style={{
                width: '100%', padding: '16px', borderRadius: '18px', border: 'none',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
              }}
            >
              Got it, let&apos;s go! 🚀
            </button>
          </div>
        </div>
      )}

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
              margin: '0 auto 20px'
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
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          padding: '20px', overflow: 'auto'
        }} onClick={() => setShowPurchaseModal(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '480px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '30px',
            animation: 'modalSlideUp 0.3s ease-out',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            {/* Info / Know Difference Button */}
            <div style={{ position: 'absolute', top: '20px', right: '60px', zIndex: 10 }}>
              <button 
                onClick={() => {
                  setShowPurchaseModal(false)
                  setShowComparisonModal(true)
                }}
                title="Click here to Know difference between Pro and Plus batch"
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
                  const tooltip = document.getElementById('purchase-modal-tooltip')
                  if (tooltip) tooltip.style.opacity = '1'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                  const tooltip = document.getElementById('purchase-modal-tooltip')
                  if (tooltip) tooltip.style.opacity = '0'
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: '800', fontFamily: 'serif' }}>i</span>
              </button>

              {/* Tooltip style bubble */}
              <div 
                id="purchase-modal-tooltip"
                style={{
                  position: 'absolute',
                  top: '40px',
                  right: '50%',
                  transform: 'translateX(50%)',
                  background: '#6366f1',
                  color: 'white',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                  opacity: 0,
                  pointerEvents: 'none',
                  transition: 'opacity 0.2s ease',
                  zIndex: 20,
                  textAlign: 'center'
                }}
              >
                Click here to see difference between PLUS AND PRO batches
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  marginLeft: '-5px',
                  borderWidth: '5px',
                  borderStyle: 'solid',
                  borderColor: 'transparent transparent #6366f1 transparent'
                }} />
              </div>
            </div>

            <button 
              onClick={() => setShowPurchaseModal(false)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--surface)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.2s', zIndex: 10 }}
            >
              <X size={18} />
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

              {/* Champion Option */}
              {offering.championDiscountPrice > 0 && (
                <div style={{
                  padding: '16px', borderRadius: '20px',
                  background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                  border: '1.5px solid #fca5a5',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: '12px', right: '16px',
                    padding: '3px 10px', borderRadius: '20px',
                    background: 'var(--danger)', color: '#fff',
                    fontSize: '9px', fontWeight: '900', letterSpacing: '0.08em',
                  }}>
                    CHAMPION
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                        🏆 Champion - {offering.championSubtitle || 'Premium Wrapper'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>
                          ₹{offering.championDiscountPrice}
                        </span>
                        {offering.championOriginalPrice > offering.championDiscountPrice && (
                          <span style={{ fontSize: '14px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                            ₹{offering.championOriginalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePurchase(offering.id, 'CHAMPION')}
                    disabled={!!purchasing}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '50px',
                      border: 'none', background: 'var(--danger)',
                      color: '#fff', fontSize: '14px', fontWeight: '800',
                      cursor: purchasing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {purchasing === `${offering.id}-CHAMPION` ? 'Processing...' : '⚡ Buy PLUS + PRO + CHAMPION Batch'}
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
                onClick={() => router.push(`/support?openTicket=true&type=GENERAL&classId=${offering?.courseId || ''}`)}
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

      {/* Course Unlocked Success Modal */}
      {successOrderId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
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
              Congratulations! You have successfully unlocked the full version of the course. All lectures, materials, and features are now fully available to you.
            </p>
            <div style={{ background: 'var(--success-light)', borderRadius: '16px', padding: '16px', marginBottom: '24px', border: '1.5px solid var(--border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Order ID</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--success)', fontFamily: 'monospace' }}>{successOrderId}</div>
            </div>
            <button
              onClick={() => { setSuccessOrderId(null); window.location.reload() }}
              style={{
                width: '100%', padding: '16px', borderRadius: '18px', border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer',
              }}
            >
              Start Learning! 🚀
            </button>
          </div>
        </div>
      )}

      {(showForcedFeedback || showFeedbackModal) && course && (
        <FeedbackModal
          courseId={course.id}
          courseName={course.name}
          courseSubject={course.subject || ''}
          isForced={showForcedFeedback}
          onClose={() => {
            setShowForcedFeedback(false)
            setShowFeedbackModal(false)
          }}
          onSuccess={() => {
            setShowForcedFeedback(false)
            setShowFeedbackModal(false)
            fetchData()
          }}
        />
      )}

      {/* Batch Comparison Modal */}
      {showComparisonModal && offering && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002,
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
    </>
  )
}
