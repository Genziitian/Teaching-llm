'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import Script from 'next/script'
import { formatISTDate, getEventStatus } from '@/lib/date-utils'
import { normalizeMeetLink } from '@/lib/meet-link'
import HomeHeroSlider, { HeroSlide } from '@/components/home/HomeHeroSlider'
import { colorWithOpacity } from '@/lib/color-utils'
import { saveDashboardSnapshot, getDashboardSnapshot } from '@/lib/offline-db'
import OfflineBanner from '@/components/ui/OfflineBanner'
import OfflinePageNotice from '@/components/OfflinePageNotice'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface AnnouncementMetadata {
  ctaText?: string
  ctaLink?: string
  importance?: 'high' | 'default'
  sound?: 'default' | 'none'
}

function parseAnnouncementContent(content: string): { body: string; metadata: AnnouncementMetadata } {
  const metaRegex = /<!-- fcm_meta:({.*?}) -->$/
  const match = content.match(metaRegex)
  if (match) {
    try {
      const metadata = JSON.parse(match[1])
      const body = content.replace(metaRegex, '').trim()
      return { body, metadata }
    } catch {
      // Ignore
    }
  }
  return { body: content, metadata: {} }
}

export default function DashboardPage() {
  const router = useRouter()
  const { data: dashboardData, error, isLoading: loading, mutate } = useSWR('/api/dashboard', fetcher, {
    revalidateOnFocus: false
  })
  
  const [upgradeModalCourse, setUpgradeModalCourse] = useState<{ id: string; name: string; liveUpgradePrice: number } | null>(null)

  const { data: userData } = useSWR('/api/auth/me', fetcher)
  const user = userData?.user
  const { data: deletionRequestData } = useSWR('/api/user/delete-request', fetcher)

  const [cachedSnapshot, setCachedSnapshot] = useState<any | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [offlineChecked, setOfflineChecked] = useState<boolean>(false)

  // Save student dashboard snapshot to IndexedDB when live data arrives
  useEffect(() => {
    if (user?.id && user.role === 'STUDENT' && dashboardData) {
      saveDashboardSnapshot(user.id, dashboardData).catch(console.error)
      try {
        localStorage.setItem('cached_student_id', user.id)
        localStorage.setItem('cached_student_email', user.email || '')
        localStorage.setItem('cached_student_role', user.role)
      } catch {}
    }
  }, [user, dashboardData])

  // If offline or network error, attempt to load cached student snapshot
  useEffect(() => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
    if (!dashboardData && (error || isOffline)) {
      const studentId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('cached_student_id') : null)
      if (studentId) {
        getDashboardSnapshot(studentId)
          .then(snapshot => {
            if (snapshot) {
              setCachedSnapshot(snapshot.data)
              setCachedAt(snapshot.cachedAt)
            }
            setOfflineChecked(true)
          })
          .catch(() => setOfflineChecked(true))
      } else {
        setOfflineChecked(true)
      }
    }
  }, [dashboardData, error, user])

  const effectiveData = dashboardData || cachedSnapshot
  const fact = useLoadingFact(loading && !effectiveData)

  const [showRatingModal, setShowRatingModal] = useState(false)
  const [rating, setRating] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)

  useEffect(() => {
    if (!user || user.role !== 'STUDENT') return

    // 1. Check if user is at least 7 days old
    const registerDate = new Date(user.createdAt)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    if (registerDate > sevenDaysAgo) return

    // 2. Check snooze in localStorage
    const snoozeUntil = localStorage.getItem('app_feedback_snooze_until')
    if (snoozeUntil && new Date(snoozeUntil) > new Date()) return

    // 3. Check submission via check API
    const isNative = typeof document !== 'undefined' && document.documentElement.classList.contains('is-native')
    const platform = isNative ? 'APP' : 'WEB'
    fetch(`/api/feedback/app/check?platform=${platform}`)
      .then(res => {
        if (!res.ok) throw new Error('Feedback check failed')
        return res.json()
      })
      .then(data => {
        if (data.submitted) return

        // 4. Delay show by 3s, checking for other active modals in DOM
        const timer = setTimeout(() => {
          const hasModal = !!document.querySelector('.modal-overlay') || 
                           !!document.querySelector('.modal') || 
                           !!document.querySelector('.blocker') || 
                           !!document.querySelector('[class*="modal"]')
          if (hasModal) return

          setShowRatingModal(true)
        }, 3000)

        return () => clearTimeout(timer)
      })
      .catch(console.error)
  }, [user])
  const [upgrading, setUpgrading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [upgradeSuccessOrderId, setUpgradeSuccessOrderId] = useState<string | null>(null)

  // Purchase modal states
  const [offering, setOffering] = useState<any | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showComparisonModal, setShowComparisonModal] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null)

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
          name: data.userName || '',
          email: data.userEmail || '',
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
              mutate()
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

  const handleUpgrade = async (courseId: string) => {
    setIsProcessing(true)
    setUpgrading(true)
    try {
      const orderRes = await fetch(`/api/courses/${courseId}/create-razorpay-order`, { method: 'POST' })
      if (!orderRes.ok) {
        const data = await orderRes.json()
        alert(data.error || 'Failed to create order')
        setIsProcessing(false)
        setUpgrading(false)
        return
      }
      const orderData = await orderRes.json()

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
              mutate()
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
  const { data: featuredOfferings } = useSWR('/api/course-offerings', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const { data: homeSlidesData } = useSWR('/api/admin/home-slides', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const homeSlides = Array.isArray(homeSlidesData) ? homeSlidesData : []

  // Move declarations up to avoid Temporal Dead Zone (TDZ)
  const stats = effectiveData?.stats || null
  const examCountdown = effectiveData?.examCountdown || null
  const role = effectiveData?.user?.role || user?.role || (typeof window !== 'undefined' ? localStorage.getItem('cached_student_role') : '') || ''
  const isManager = role === 'MANAGER'
  const isStudentView = role === 'STUDENT' || role === 'ADMIN'

  const liveSessions = effectiveData?.liveSessions || []
  const liveNow = liveSessions.filter((s: any) => 
    getEventStatus(s.startTime, s.endTime, s.manualStatus || s.status) === 'live'
  )
  const liveNowCount = liveNow.length
  const upNextSessions = liveSessions.filter((s: any) => 
    getEventStatus(s.startTime, s.endTime, s.manualStatus || s.status) === 'upcoming'
  ).slice(0, 2)
  const upNextCount = liveSessions.filter((s: any) =>
    getEventStatus(s.startTime, s.endTime, s.manualStatus || s.status) === 'upcoming'
  ).length

  const recentViewedLecture = effectiveData?.recentViewedLecture || null
  const announcements = (effectiveData?.announcements || []).slice(0, 3)

  const [activeCard, setActiveCard] = useState(0)
  const [sliding, setSliding] = useState(false)
  const [nowTick, setNowTick] = useState(Date.now())
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTick(Date.now()), 30000)
    return () => window.clearInterval(intervalId)
  }, [])

  // Auto-refresh countdown timer at 12:01 AM each day
  useEffect(() => {
    const refreshAtMidnight = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 1, 0, 0) // 12:01 AM

      const timeUntilMidnight = tomorrow.getTime() - now.getTime()

      const timerId = window.setTimeout(() => {
        mutate() // Refresh data at 12:01 AM
        refreshAtMidnight() // Schedule next refresh
      }, timeUntilMidnight)

      return () => window.clearTimeout(timerId)
    }

    const cleanup = refreshAtMidnight()
    return cleanup
  }, [])

  // Auto-roll carousel every 10s if multiple sessions are active
  useEffect(() => {
    if (liveNow.length <= 1) {
      if (activeCard !== 0) setActiveCard(0)
      return
    }

    const rollInterval = setInterval(() => {
      handleNextLive(liveNow.length)
    }, 10000)

    return () => clearInterval(rollInterval)
  }, [liveNow.length])

  const handleNextLive = (count?: number | React.MouseEvent) => {
    const total = typeof count === 'number' ? count : liveNow.length
    if (total <= 1) return
    setSliding(true)
    setTimeout(() => {
      setActiveCard(prev => (prev + 1) % total)
      setSliding(false)
    }, 180)
  }


  const [isEditingTimer, setIsEditingTimer] = useState(false)
  const [timerTitle, setTimerTitle] = useState('')
  const [timerDays, setTimerDays] = useState(0)

  const handleUpdateTimer = async () => {
    try {
      const res = await fetch('/api/admin/dashboard/countdown', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: timerTitle, daysLeft: Number(timerDays) })
      })
      if (res.ok) {
        mutate()
        setIsEditingTimer(false)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const getTimerColor = (days: number) => {
    if (days === 0) return 'var(--surface)'
    if (days <= 3) return 'var(--danger-light)'
    return 'var(--warning-light)' // Soft yellow
  }


  const statCards = [
    { label: 'Total Courses', value: stats?.totalCourses ?? 0, color: 'var(--accent)', bg: 'var(--primary-light)', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
    )},
    { label: 'Lectures', value: stats?.totalLectures ?? 0, color: 'var(--accent)', bg: 'var(--primary-light)', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
    )},
    ...(!isStudentView ? [{
      label: 'Students Enrolled', value: stats?.totalStudents ?? 0, color: 'var(--success)', bg: 'var(--success-light)', icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
      ),
    }] : [
      { label: 'Upcoming Sessions', value: upNextCount, color: 'var(--warning)', bg: 'var(--warning-light)', icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
      )},
    ]),
    { 
      label: examCountdown?.title || 'Exam Countdown', 
      value: `${examCountdown?.daysLeft ?? 0} Days`, 
      color: (examCountdown?.daysLeft ?? 0) <= 3 && (examCountdown?.daysLeft ?? 0) > 0 ? 'var(--danger)' : 'var(--warning)', 
      bg: getTimerColor(examCountdown?.daysLeft ?? 0),
      isTimer: true,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      )
    },
    ...(!isStudentView ? [
      { 
        label: 'Active Sessions', 
        value: liveNowCount, 
        color: 'var(--danger)',
        bg: 'var(--danger-light)',
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
        )
      },
      { 
        label: 'Support System', 
        value: dashboardData?.supportSummary?.isSupportActive ? 'Online' : 'Offline', 
        color: 'var(--primary)', 
        bg: '#ebebff', 
        isSupport: true,
        summary: dashboardData?.supportSummary,
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3636e8" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )
      }
    ] : [])
  ]
  // Offline fallback if no effective data exists
  if (!effectiveData && (error || (typeof navigator !== 'undefined' && !navigator.onLine)) && offlineChecked) {
    if (user?.role === 'MANAGER' || user?.role === 'ADMIN') {
      return (
        <div className="page-container fade-in" style={{ padding: '24px 16px' }}>
          <OfflinePageNotice
            sectionName="Manager Dashboard"
            description="Manager and Admin operations require an active internet connection."
          />
        </div>
      )
    }
    return (
      <div className="page-container fade-in" style={{ padding: '24px 16px' }}>
        <OfflinePageNotice
          sectionName="Dashboard"
          description="No offline dashboard snapshot found yet. Connect to internet once to cache your courses."
        />
      </div>
    )
  }

  if (loading && !effectiveData) {
    return (
      <div className="page-container dashboard-home-page">
        {fact && (
          <div style={{ marginBottom: isMobile ? '16px' : '20px', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <LoadingFactCard fact={fact} />
          </div>
        )}
        {/* Shimmering Stats Grid */}
        <div
          className="dashboard-stats-grid"
          style={{
            marginBottom: isMobile ? '16px' : '24px',
            marginTop: isMobile ? '16px' : '-8px',
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? '12px' : '20px'
          }}
        >
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stat-card" style={{ background: 'var(--surface)' }}>
              <div className="skeleton" style={{ width: isMobile ? '36px' : '48px', height: isMobile ? '36px' : '48px', borderRadius: isMobile ? '10px' : '14px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="skeleton" style={{ height: '12px', width: '60px', marginBottom: '6px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ height: '22px', width: '40px', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>

        {!isMobile && (
          <>
            {/* Hero Slider Skeleton */}
            <div className="card" style={{ height: '240px', borderRadius: '24px', marginBottom: '24px', overflow: 'hidden' }}>
              <div className="skeleton" style={{ width: '100%', height: '100%' }} />
            </div>

            {/* Row 1: Active Sessions + Up Next Panels */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
              marginBottom: '20px'
            }}>
              {/* Active Session Skeleton */}
              <div className="card" style={{ padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '200px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="skeleton" style={{ height: '24px', width: '120px', borderRadius: '20px' }} />
                  <div className="skeleton" style={{ height: '18px', width: '60px' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton" style={{ height: '24px', width: '70%', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ height: '14px', width: '40%', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div className="skeleton" style={{ height: '8px', width: '40px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ height: '42px', width: '140px', borderRadius: '14px' }} />
                </div>
              </div>

              {/* Up Next Skeleton */}
              <div className="card" style={{ padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '200px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="skeleton" style={{ height: '20px', width: '80px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ height: '14px', width: '60px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'center' }}>
                  {[1, 2].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '14px', background: 'var(--surface-2)' }}>
                      <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton" style={{ height: '14px', width: '60%', marginBottom: '4px', borderRadius: '4px' }} />
                        <div className="skeleton" style={{ height: '10px', width: '40%', borderRadius: '4px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {isMobile && (
          /* Mobile-only Upcoming Session skeleton */
          <div style={{ marginBottom: '24px' }}>
            <div className="skeleton" style={{ height: '20px', width: '150px', marginBottom: '14px', borderRadius: '4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', borderRadius: '20px', background: 'var(--surface)' }}>
              <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: '12px', width: '80px', marginBottom: '6px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ height: '16.5px', width: '70%', marginBottom: '6px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ height: '12px', width: '50%', borderRadius: '4px' }} />
              </div>
              <div className="skeleton" style={{ height: '32px', width: '70px', borderRadius: '50px', flexShrink: 0 }} />
            </div>
          </div>
        )}

        {/* Row 2: Recent Lecture Viewed */}
        <div className={isMobile ? '' : 'card'} style={isMobile ? { marginBottom: '24px' } : { padding: '22px 20px', borderRadius: '22px', marginBottom: '20px' }}>
          <div className="skeleton" style={{ height: '20px', width: '150px', marginBottom: isMobile ? '14px' : '18px', borderRadius: '4px' }} />
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? '16px' : '24px',
            padding: isMobile ? '18px' : '24px',
            borderRadius: isMobile ? '20px' : '24px',
            background: isMobile ? 'var(--surface)' : 'var(--surface-2)',
            width: '100%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
              <div className="skeleton" style={{ width: isMobile ? '48px' : '56px', height: isMobile ? '48px' : '56px', borderRadius: isMobile ? '14px' : '16px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="skeleton" style={{ height: '12px', width: '100px', marginBottom: '6px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ height: '18px', width: '80%', marginBottom: '6px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ height: '12px', width: '60%', borderRadius: '4px' }} />
              </div>
            </div>
            <div className="skeleton" style={{ height: '44px', width: isMobile ? '100%' : '160px', borderRadius: isMobile ? '18px' : '50px', flexShrink: 0 }} />
          </div>
        </div>

        {/* Row 4: Announcements Skeleton */}
        <div className="card" style={{ padding: '20px 24px', borderRadius: '16px', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
            <div className="skeleton" style={{ height: '18px', width: '130px', borderRadius: '4px' }} />
            <div className="skeleton" style={{ height: '14px', width: '75px', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[1, 2, 3].map((i, idx, arr) => (
              <div key={i} style={{ padding: '16px 0', borderBottom: idx !== arr.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                  <div className="skeleton" style={{ width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div className="skeleton" style={{ height: '15px', width: '180px', borderRadius: '4px' }} />
                      <div className="skeleton" style={{ height: '15px', width: '60px', borderRadius: '4px' }} />
                    </div>
                    <div className="skeleton" style={{ height: '13px', width: '75%', borderRadius: '4px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                  <div className="skeleton" style={{ height: '12px', width: '75px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ height: '32px', width: '120px', borderRadius: '8px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const frontSession = liveNow[activeCard] || liveNow[0]
  const hasLive = liveNow.length > 0

  return (
    <>
    <div className="page-container fade-in dashboard-home-page" data-tour="dashboard-hero">
      <style>{`
        @media (max-width: 768px) {
          .dashboard-stats-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
            margin-bottom: 16px !important;
            margin-top: 16px !important;
          }
          .stat-card {
            padding: 12px 14px !important;
            gap: 10px !important;
            border-radius: 16px !important;
          }
          .stat-card-icon {
            width: 36px !important;
            height: 36px !important;
            border-radius: 10px !important;
          }
          .stat-card-icon svg {
            width: 16px !important;
            height: 16px !important;
          }
          .stat-card-label {
            font-size: 9px !important;
            letter-spacing: 0.03em !important;
          }
          .stat-card-value {
            font-size: 18px !important;
          }
        }
        @media (max-width: 380px) {
          .dashboard-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .stat-card {
            padding: 8px 10px !important;
            gap: 6px !important;
            border-radius: 12px !important;
          }
          .stat-card-icon {
            width: 28px !important;
            height: 28px !important;
            border-radius: 8px !important;
          }
          .stat-card-icon svg {
            width: 14px !important;
            height: 14px !important;
          }
          .stat-card-value {
            font-size: 15px !important;
          }
        }
        @media (max-width: 640px) {
          .announcement-compact-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .announcement-compact-right {
            width: 100% !important;
            justify-content: space-between !important;
            padding-left: 56px !important;
          }
        }
      `}</style>

      {/* Offline Banner Indicator */}
      <OfflineBanner cachedAt={cachedAt} />

      {/* Stats Grid */}
      <div
        className="dashboard-stats-grid"
        style={{
          marginBottom: isMobile ? '16px' : '24px',
          marginTop: isMobile ? '16px' : '-8px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
          gap: isMobile ? '12px' : '20px'
        }}
      >
        {statCards.filter(c => !c.isSupport && c.label !== 'Active Sessions' && !isMobile).map((card) => {
          const mobileHero = isMobile && card.isTimer
          return (
          <div 
            key={card.label} 
            className="stat-card" 
            onClick={() => {
              if (card.label === 'Total Courses' || card.label === 'Lectures') {
                router.push('/courses')
              }
            }}
            style={{
              background: mobileHero
                ? 'linear-gradient(135deg, var(--surface) 0%, var(--surface) 55%, var(--primary-light) 100%)'
                : (card.isTimer ? card.bg : undefined),
              padding: mobileHero ? '22px 22px' : (isMobile ? '12px 14px' : '22px 24px'),
              gap: isMobile ? '14px' : '20px',
              borderRadius: mobileHero ? '22px' : (isMobile ? '16px' : '20px'),
              border: mobileHero ? '1px solid rgba(99, 102, 241, 0.10)' : undefined,
              boxShadow: mobileHero ? '0 12px 30px -10px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.04)' : undefined,
              position: 'relative', overflow: 'hidden',
              cursor: 'default',
            } as React.CSSProperties}
          >
            {mobileHero && (
              <span style={{ position: 'absolute', top: '-40px', right: '-30px', width: '140px', height: '140px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.10), transparent 70%)', pointerEvents: 'none' }} />
            )}
            <div style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
              height: '100%',
              position: 'relative',
              zIndex: 1
            }}>
              {/* Left stack: Icon & Label */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between', 
                height: '100%', 
                alignItems: 'flex-start' 
              }}>
                <div className="stat-card-icon" style={{
                  background: mobileHero ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : (card.isTimer ? 'rgba(255,255,255,0.4)' : card.bg),
                  color: mobileHero ? '#ffffff' : card.color,
                  width: mobileHero ? '48px' : (isMobile ? '36px' : '48px'),
                  height: mobileHero ? '48px' : (isMobile ? '36px' : '48px'),
                  borderRadius: mobileHero ? '14px' : (isMobile ? '10px' : '14px'),
                  boxShadow: mobileHero ? '0 8px 18px rgba(99,102,241,0.35)' : undefined,
                  flexShrink: 0,
                }}>
                  {card.icon}
                </div>
                <div className="stat-card-label" style={{
                  color: mobileHero ? 'var(--accent)' : (card.isTimer && (examCountdown?.daysLeft ?? 0) > 0 ? 'var(--quiz-countdown-label-color)' : undefined),
                  fontSize: mobileHero ? '10.5px' : undefined,
                  fontWeight: mobileHero ? 800 : undefined,
                  letterSpacing: mobileHero ? '0.08em' : undefined,
                }}>
                  {card.label}
                </div>
              </div>

              {/* Right: Value (number) */}
              <div className="stat-card-value" style={{
                fontSize: mobileHero 
                  ? '26px' 
                  : (isMobile 
                      ? '24px' 
                      : (card.isTimer ? '36px' : '48px')),
                fontWeight: 900,
                color: mobileHero ? 'var(--text-primary)' : 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
                marginRight: card.isTimer ? '24px' : '48px', // Shift non-timer numbers further left to center them
              }}>
                {card.value}
              </div>
            </div>

            {card.isTimer && isManager && (
              <button
                onClick={() => {
                  setTimerTitle(examCountdown?.title || 'Exam Countdown')
                  setTimerDays(examCountdown?.daysLeft || 0)
                  setIsEditingTimer(true)
                }}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--quiz-countdown-edit-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--quiz-countdown-edit-icon)" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
          </div>
          )
        })}
      </div>

      {/* Manager Specific Cards (Active Sessions & Support) */}
      {isManager && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 5fr) minmax(0, 2fr)',
          gap: isMobile ? '12px' : '20px',
          marginBottom: '24px'
        }}>
          {/* Active Sessions Card (Student UI Style) */}
          <div className="card" style={{
            padding: '24px',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {hasLive && frontSession ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    background: 'rgba(244,63,94,0.1)',
                    padding: '6px 14px', borderRadius: '20px',
                  }}>
                    <div style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: 'var(--danger)', flexShrink: 0,
                      animation: 'livePulse 1.5s infinite',
                    }} />
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Active Sessions
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                      {frontSession.time}
                    </span>
                    {liveSessions.length > 1 && (
                      <button
                        onClick={handleNextLive}
                        style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'var(--surface-2)',
                          boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: 'none', cursor: 'pointer', transition: 'box-shadow 0.2s',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div 
                  key={activeCard}
                  style={{
                    opacity: sliding ? 0 : 1,
                    transform: sliding ? 'translateX(-16px)' : 'translateX(0)',
                    transition: 'all 0.2s ease',
                    flex: 1
                  }}
                >
                  <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.2', marginBottom: '8px' }}>
                    {frontSession.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {frontSession.instructor}{frontSession.course?.name ? ` · ${frontSession.course.name}` : ''}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  {liveSessions.length > 1 ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {liveSessions.map((_, i) => (
                        <div
                          key={i}
                          onClick={() => setActiveCard(i)}
                          style={{
                            width: i === activeCard ? '24px' : '8px',
                            height: '8px',
                            borderRadius: '4px',
                            background: i === activeCard ? 'var(--danger)' : 'var(--surface-2)',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  ) : <div />}

                  <a
                    href={normalizeMeetLink(frontSession.meetLink) ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{
                      background: 'var(--danger)',
                      boxShadow: '0 8px 20px rgba(244,63,94,0.3)',
                      padding: '12px 24px',
                      fontSize: '14px',
                      fontWeight: '800'
                    }}
                  >
                    Join as Instructor
                  </a>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', gap: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: '700' }}>No Active Sessions</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>All live courses are currently offline</div>
                </div>
              </div>
            )}
          </div>

          {/* Support System Card (Refined) */}
          <div className="card" style={{
            padding: '24px',
            borderRadius: '20px',
            background: 'var(--primary-light)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                boxShadow: '0 4px 12px rgba(54,54,232,0.1)'
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div style={{
                padding: '6px 12px',
                borderRadius: '50px',
                background: dashboardData?.supportSummary?.isSupportActive ? 'var(--success-light)' : 'var(--danger-light)',
                color: dashboardData?.supportSummary?.isSupportActive ? 'var(--success)' : 'var(--danger)',
                fontSize: '11px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {dashboardData?.supportSummary?.isSupportActive ? 'Online' : 'Offline'}
              </div>
            </div>

            <div style={{ margin: '20px 0' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Support System
              </div>
              <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>
                {dashboardData?.supportSummary?.openTickets ?? 0}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                Open Support Tickets
              </div>
            </div>

            <Link href="/support" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '800',
              borderRadius: '12px',
              boxShadow: '0 8px 20px rgba(54,54,232,0.3)',
              textDecoration: 'none',
              transition: 'transform 0.2s'
            }}>
              Go to Support
            </Link>
          </div>
        </div>
      )}

      {/* Timer Edit Modal */}
      {isEditingTimer && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 800 }}>Edit Exam Timer</h3>
              <button onClick={() => setIsEditingTimer(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Headline / Title</label>
                <input 
                  className="form-input"
                  value={timerTitle}
                  onChange={e => setTimerTitle(e.target.value)}
                  placeholder="e.g., JEE Advanced 2026"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Days Remaining</label>
                <input 
                  className="form-input"
                  type="number"
                  value={timerDays}
                  onChange={e => setTimerDays(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsEditingTimer(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdateTimer}>Update Timer</button>
            </div>
          </div>
        </div>
      )}

      {!isManager && (
        <>
          {deletionRequestData?.hasRequested && (
            <div
              style={{
                marginBottom: '16px',
                padding: '14px 20px',
                borderRadius: '16px',
                background: deletionRequestData.request?.status === 'APPROVED'
                  ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(16, 185, 129, 0.12))'
                  : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.12))',
                border: deletionRequestData.request?.status === 'APPROVED'
                  ? '1.5px solid rgba(59, 130, 246, 0.35)'
                  : '1.5px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>
                  {deletionRequestData.request?.status === 'APPROVED' ? '⏳' : '⚠️'}
                </span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {deletionRequestData.request?.status === 'APPROVED'
                      ? 'Manager Accepted Deletion Request'
                      : 'Account Deletion Requested'}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    {deletionRequestData.request?.status === 'APPROVED'
                      ? 'Manager has accepted your request. Deletion will proceed after the 24-hour window expires. You can review or cancel in Settings.'
                      : 'Your request is in the 24-hour cancellation period. You can review the status or cancel anytime in Settings.'}
                  </div>
                </div>
              </div>

              <Link
                href="/settings"
                className="btn btn-ghost"
                style={{
                  borderRadius: '50px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  padding: '7px 18px',
                  background: 'var(--surface)',
                  color: deletionRequestData.request?.status === 'APPROVED' ? '#3b82f6' : '#ef4444',
                  border: deletionRequestData.request?.status === 'APPROVED'
                    ? '1px solid rgba(59, 130, 246, 0.3)'
                    : '1px solid rgba(239, 68, 68, 0.3)',
                  textDecoration: 'none',
                }}
              >
                View Status &amp; Timeline →
              </Link>
            </div>
          )}

          <HomeHeroSlider slides={homeSlides} />
          {/* ── Row 1: Active Now + Up Next (desktop only on mobile they're replaced by Featured Courses) ── */}
          {!isMobile && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '20px',
            alignItems: 'stretch',
          }}>
            {/* Active Now card */}
            <div className="card" style={{
              padding: '20px',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
            }}>
              {hasLive && frontSession ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '7px',
                      background: 'rgba(16,185,129,0.12)',
                      padding: '5px 12px', borderRadius: '20px',
                      animation: 'badgeGlow 2s ease-in-out infinite',
                    }}>
                      <div style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: 'var(--success)', flexShrink: 0,
                        animation: 'greenPulse 1.5s infinite',
                      }} />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Active Now
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
                        {frontSession.time}
                      </span>
                      {liveSessions.length > 1 && (
                        <button
                          onClick={handleNextLive}
                          style={{
                            width: '30px', height: '30px', borderRadius: '50%',
                            background: 'var(--surface-2)',
                            boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                            border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'box-shadow 0.15s',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    key={activeCard}
                    style={{
                      opacity: sliding ? 0 : 1,
                      transform: sliding ? 'translateX(-16px)' : 'translateX(0)',
                      transition: 'opacity 0.18s ease, transform 0.18s ease',
                      animation: sliding ? 'none' : 'slideInRight 0.32s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '20px',
                      marginTop: '8px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.2', marginBottom: '2px' }}>
                        {frontSession.title}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                        {frontSession.instructor}{frontSession.course?.name ? ` · ${frontSession.course.name}` : ''}
                      </div>
                    </div>

                    {frontSession.isRecordedOnly || frontSession.enrollmentType === 'DEMO' ? (
                      <button
                        onClick={() => {
                          if (frontSession.courseId) {
                            handleUnlockClick(frontSession.courseId)
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '14px 32px',
                          borderRadius: '14px', border: 'none', cursor: 'pointer',
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                          color: '#ffffff', fontSize: '15px', fontWeight: '800',
                          letterSpacing: '0.01em',
                          animation: 'joinPulse 2s ease-in-out infinite, joinGlow 2.5s ease-in-out infinite',
                          transition: 'transform 0.2s, background 0.18s',
                          boxShadow: '0 8px 20px rgba(239,68,68,0.3)',
                          whiteSpace: 'nowrap',
                          marginLeft: '10px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '6px',
                          background: 'rgba(255,255,255,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                          </svg>
                        </div>
                        Unlock to Join
                      </button>
                    ) : (
                      <a
                        href={normalizeMeetLink(frontSession.meetLink) ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '14px 32px',
                          borderRadius: '14px',
                          background: 'var(--danger)',
                          color: '#ffffff', fontSize: '15px', fontWeight: '800',
                          textDecoration: 'none', letterSpacing: '0.01em',
                          animation: 'joinPulse 2s ease-in-out infinite, joinGlow 2.5s ease-in-out infinite',
                          transition: 'transform 0.2s, background 0.18s',
                          boxShadow: '0 8px 20px rgba(239,68,68,0.3)',
                          whiteSpace: 'nowrap',
                          marginLeft: '10px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '6px',
                          background: 'rgba(255,255,255,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                          </svg>
                        </div>
                        Join Live
                      </a>
                    )}
                  </div>

                  {liveSessions.length > 1 && (
                    <div style={{ display: 'flex', gap: '5px', marginTop: '12px' }}>
                      {liveSessions.map((_, i) => (
                        <div
                          key={i}
                          onClick={() => setActiveCard(i)}
                          style={{
                            width: i === activeCard ? '18px' : '6px',
                            height: '6px',
                            borderRadius: '3px',
                            background: i === activeCard ? 'var(--success)' : 'var(--neu-dark)',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '10px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--neu-dark)" strokeWidth="2">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500', textAlign: 'center' }}>No active courses right now</div>
                  <Link href="/live" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600', textDecoration: 'none' }}>View schedule →</Link>
                </div>
              )}
            </div>

            {/* Up Next panel */}
            <div className="card" style={{ padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Up Next</h3>
                <Link href="/live" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600', textDecoration: 'none' }}>
                  View All →
                </Link>
              </div>
              {upNextSessions.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No upcoming sessions
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {upNextSessions.map((session, idx) => (
                    <Link
                      key={session.id}
                      href={session.isRecordedOnly ? '#' : '/live'}
                      onClick={(e) => {
                        if (session.isRecordedOnly) {
                          e.preventDefault()
                          if (session.courseId) {
                            handleUnlockClick(session.courseId)
                          }
                        }
                      }}
                      style={{ textDecoration: 'none', cursor: 'pointer' }}
                    >
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '13px 14px',
                          borderRadius: '14px',
                          background: 'var(--surface-2)',
                          boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                          transition: 'box-shadow 0.2s',
                        }}
                      >
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '11px', flexShrink: 0,
                          background: idx === 0 ? 'var(--primary-light)' : '#f3f4f8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={idx === 0 ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth="2">
                            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {idx === 0 && (
                            <div style={{
                              display: 'inline-block', fontSize: '9.5px', fontWeight: '700', color: 'var(--accent)',
                              background: 'var(--primary-light)', padding: '1px 7px', borderRadius: '20px',
                              textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px',
                            }}>
                              Up Next
                            </div>
                          )}
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {session.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {session.date} · {session.time}
                          </div>
                        </div>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--neu-dark)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          )}


          {/* Categories: temporarily hidden — will be re-enabled later. */}

          {/* ── Mobile-only: Upcoming Session (compact) ── */}
          {isMobile && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px', padding: '0 4px', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                    Upcoming Session
                  </h3>
                </div>
                <Link href="/live" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  View All →
                </Link>
              </div>
              {hasLive && frontSession ? (
                 <div
                  onClick={() => {
                    if (frontSession.isRecordedOnly) {
                      if (frontSession.courseId) {
                        handleUnlockClick(frontSession.courseId)
                      }
                    } else {
                      router.push('/live')
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '18px',
                    borderRadius: '20px',
                    background: 'var(--surface)',
                    border: '1px solid rgba(15, 23, 42, 0.05)',
                    boxShadow: '0 14px 30px -12px rgba(15, 23, 42, 0.15), 0 4px 8px -2px rgba(15, 23, 42, 0.04)',
                    cursor: 'pointer',
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  <span style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(180deg, #ef4444, #f97316)' }} />
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 18px rgba(239,68,68,0.4)',
                    animation: 'redLivePulse 2s ease-in-out infinite',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--danger)', animation: 'redLivePulse 1.4s infinite' }} />
                      LIVE NOW
                    </div>
                    <div style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {frontSession.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {frontSession.instructor}{frontSession.course?.name ? ` · ${frontSession.course.name}` : ''}
                    </div>
                  </div>
                  {frontSession.isRecordedOnly ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '12px', fontWeight: 800, color: '#ffffff',
                      padding: '8px 14px', borderRadius: '50px',
                      background: 'linear-gradient(135deg, #ef4444, #f97316)',
                      boxShadow: '0 6px 14px rgba(239,68,68,0.4)',
                      flexShrink: 0,
                    }}>
                      Upgrade
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '12px', fontWeight: 800, color: '#ffffff',
                      padding: '8px 14px', borderRadius: '50px',
                      background: 'linear-gradient(135deg, #ef4444, #f97316)',
                      boxShadow: '0 6px 14px rgba(239,68,68,0.4)',
                      flexShrink: 0,
                    }}>
                      Join
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </span>
                  )}
                </div>
              ) : upNextSessions.length > 0 ? (
                <div
                  onClick={() => {
                    const upNext = upNextSessions[0]
                    if (upNext.isRecordedOnly) {
                      if (upNext.courseId) {
                        handleUnlockClick(upNext.courseId)
                      }
                    } else {
                      router.push('/live')
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '18px',
                    borderRadius: '20px',
                    background: 'var(--surface)',
                    border: '1px solid rgba(15, 23, 42, 0.05)',
                    boxShadow: '0 14px 30px -12px rgba(15, 23, 42, 0.15), 0 4px 8px -2px rgba(15, 23, 42, 0.04)',
                    cursor: 'pointer',
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  <span style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(180deg, #6366f1, #4f46e5)' }} />
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 18px rgba(99,102,241,0.40)',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
                      {upNextSessions[0].time}
                    </div>
                    <div style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {upNextSessions[0].title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {upNextSessions[0].date}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9999b0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              ) : (
                <div style={{
                  padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px',
                  background: 'var(--surface)', borderRadius: '20px',
                  border: '1px solid rgba(15, 23, 42, 0.05)',
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" style={{ marginBottom: '8px' }}>
                    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                  <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>No upcoming sessions</div>
                  <div style={{ fontSize: '11px', marginTop: '2px' }}>Check back later for live classes</div>
                </div>
              )}
            </div>
          )}

          {/* ── Row 2: Recent Lecture Viewed ── */}
          {recentViewedLecture && (
            <div className={isMobile ? '' : 'card'} style={isMobile ? { marginBottom: '24px' } : { padding: '22px 20px', borderRadius: '22px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: isMobile ? '14px' : '18px', padding: isMobile ? '0 4px' : '0', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: isMobile ? '18px' : '16px', fontWeight: isMobile ? 900 : 700, color: 'var(--text-primary)', letterSpacing: isMobile ? '-0.02em' : 'normal', margin: 0 }}>
                    Recent Lecture
                  </h3>
                </div>
                <Link href="/materials/recordings" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  View All →
                </Link>
              </div>
              <div style={{ display: 'flex' }}>
                {(() => {
                  const lec = recentViewedLecture.content
                  const accent = lec.topic?.course?.color || 'var(--accent)'
                  return (
                    <div
                      key={lec.id}
                      style={{
                        padding: isMobile ? '18px' : '24px',
                        borderRadius: isMobile ? '20px' : '24px',
                        background: isMobile ? 'var(--surface)' : 'var(--surface-2)',
                        boxShadow: isMobile
                          ? '0 14px 30px -12px rgba(15, 23, 42, 0.15), 0 4px 8px -2px rgba(15, 23, 42, 0.04)'
                          : '8px 8px 16px var(--neu-dark), -8px -8px 16px var(--neu-light)',
                        border: isMobile ? '1px solid rgba(15, 23, 42, 0.05)' : undefined,
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                        gap: isMobile ? '16px' : '24px',
                        width: '100%',
                        transition: 'all 0.2s',
                        position: 'relative', overflow: 'hidden',
                      }}
                    >
                      {isMobile && (
                        <span style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: `linear-gradient(180deg, ${accent}, ${accent}88)`, borderRadius: '4px 0 0 4px' }} />
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
                        <div style={{
                          width: isMobile ? '48px' : '56px', height: isMobile ? '48px' : '56px', borderRadius: isMobile ? '14px' : '16px',
                          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                          color: '#ffffff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: isMobile ? `0 8px 18px ${accent}40` : undefined,
                        }}>
                          <svg width={isMobile ? '22' : '24'} height={isMobile ? '22' : '24'} viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: isMobile ? '10px' : '11px', color: accent, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
                            {lec.topic?.course?.name || 'Course Lecture'}
                          </div>
                          <div style={{
                            fontSize: isMobile ? '15.5px' : '18px', fontWeight: 800, color: 'var(--text-primary)',
                            lineHeight: '1.25', marginBottom: '4px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {lec.title}
                          </div>
                          <div style={{ fontSize: isMobile ? '11px' : '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Last viewed on {formatISTDate(recentViewedLecture.updatedAt)}
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/courses/${lec.topic?.courseId}/lectures/${lec.id}`}
                        className="btn btn-primary"
                        style={{
                          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                          boxShadow: `0 8px 18px ${accent}40`,
                          padding: isMobile ? '12px 22px' : '12px 28px',
                          fontSize: isMobile ? '13.5px' : '14px',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                          width: isMobile ? '100%' : 'auto',
                          justifyContent: 'center',
                          letterSpacing: '0.01em',
                        }}
                      >
                        Continue Watching
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}><polyline points="9 18 15 12 9 6"/></svg>
                      </Link>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ── Row 3: Action Buttons (Mobile) ── */}
          {isMobile && (
            <div style={{ marginBottom: '24px', padding: '0 4px' }}>
              <style dangerouslySetInnerHTML={{__html: `
                .quick-actions-bar {
                  display: flex;
                  flex-direction: row;
                  justify-content: space-around;
                  align-items: center;
                  padding: 20px 12px;
                  border-radius: 26px;
                  background: #ffffff;
                  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.025), 0 2px 4px rgba(0, 0, 0, 0.015);
                  border: 1px solid rgba(0, 0, 0, 0.01);
                  margin-bottom: 24px;
                }
                :root[data-theme="dark"] .quick-actions-bar {
                  background: var(--surface-2);
                  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
                  border: 1px solid rgba(255, 255, 255, 0.01);
                }
                .quick-action-item {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  text-decoration: none;
                  width: 22%;
                  transition: transform 0.15s ease;
                }
                .quick-action-item:active {
                  transform: scale(0.92);
                }
                .quick-action-icon-box {
                  width: 54px;
                  height: 54px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #ffffff;
                  margin-bottom: 8px;
                }
                .quick-action-name {
                  font-size: 11.5px;
                  font-weight: 700;
                  color: var(--text-secondary);
                  text-align: center;
                  line-height: 1.2;
                }
                :root[data-theme="dark"] .quick-action-name {
                  color: var(--text-muted);
                }
              `}} />
              <div className="quick-actions-bar">
                <Link href="/community" className="quick-action-item">
                  <div 
                    className="quick-action-icon-box" 
                    style={{ 
                      background: 'linear-gradient(135deg, #f43f5e, #a855f7)',
                      boxShadow: '0 6px 14px rgba(244, 63, 94, 0.3)'
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <span className="quick-action-name">Community</span>
                </Link>
                <Link href="/calendar" className="quick-action-item">
                  <div 
                    className="quick-action-icon-box" 
                    style={{ 
                      background: 'linear-gradient(135deg, #b58bfd, #703bf7)',
                      boxShadow: '0 6px 14px rgba(112, 59, 247, 0.3)'
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                      <line x1="16" x2="16" y1="2" y2="6"/>
                      <line x1="8" x2="8" y1="2" y2="6"/>
                      <line x1="3" x2="21" y1="10" y2="10"/>
                    </svg>
                  </div>
                  <span className="quick-action-name">Calendar</span>
                </Link>
                <Link href="/free-resources" className="quick-action-item">
                  <div 
                    className="quick-action-icon-box" 
                    style={{ 
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      boxShadow: '0 6px 14px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </div>
                  <span className="quick-action-name">Downloads</span>
                </Link>
                <Link href="/settings" className="quick-action-item">
                  <div 
                    className="quick-action-icon-box" 
                    style={{ 
                      background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
                      boxShadow: '0 6px 14px rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 1 1 2 0l.43.25a2 2 0 1 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 1 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </div>
                  <span className="quick-action-name">Settings</span>
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Row 3: Announcements ── */}
      {announcements.length > 0 && (
        <div
          className="card announcements-web-container"
          style={{
            padding: '20px 24px',
            borderRadius: '16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'none',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border)',
              marginBottom: '4px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Announcements
            </h3>
            <Link
              href="/announcements"
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--primary)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'opacity 0.15s ease',
              }}
            >
              View All →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {announcements.map((a, index) => {
              const { body: parsedBody, metadata } = parseAnnouncementContent(a.content)
              const isHighPriority = metadata.importance === 'high'
              const formattedDate = new Date(a.createdAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })

              // Icon & badge config based on existing types and importance
              let iconSvg = (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
                </svg>
              )
              let iconColor = 'var(--primary, #4f46e5)'
              let iconBg = 'rgba(79, 70, 229, 0.1)'
              let badgeLabel = 'General'
              let badgeColor = 'var(--primary, #4f46e5)'
              let badgeBg = 'rgba(79, 70, 229, 0.08)'

              if (isHighPriority || a.type === 'error') {
                iconColor = 'var(--danger, #ef4444)'
                iconBg = 'rgba(239, 68, 68, 0.1)'
                badgeLabel = isHighPriority ? 'Important' : 'Alert'
                badgeColor = '#ef4444'
                badgeBg = 'rgba(239, 68, 68, 0.08)'
                iconSvg = (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                )
              } else if (a.type === 'warning') {
                iconColor = '#f59e0b'
                iconBg = 'rgba(245, 158, 11, 0.1)'
                badgeLabel = 'Update'
                badgeColor = '#d97706'
                badgeBg = 'rgba(245, 158, 11, 0.08)'
                iconSvg = (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                )
              } else if (a.type === 'success') {
                iconColor = '#10b981'
                iconBg = 'rgba(16, 185, 129, 0.1)'
                badgeLabel = 'Success'
                badgeColor = '#059669'
                badgeBg = 'rgba(16, 185, 129, 0.08)'
                iconSvg = (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                )
              }

              const isLast = index === announcements.length - 1
              const hasCta = Boolean(metadata.ctaText && metadata.ctaLink)

              return (
                <div
                  key={a.id}
                  className="announcement-compact-row"
                  style={{
                    padding: '16px 0',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    minHeight: '80px',
                  }}
                >
                  {/* Left Side: Icon + Content (Title, Tag, Description) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: iconBg,
                        color: iconColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      {iconSvg}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: 'var(--text-primary)',
                            lineHeight: '1.3',
                          }}
                        >
                          {a.title}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: badgeBg,
                            color: badgeColor,
                            letterSpacing: '0.02em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {badgeLabel}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                          lineHeight: '1.4',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {parsedBody}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Date & CTA */}
                  <div
                    className="announcement-compact-right"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formattedDate}
                    </span>

                    {hasCta && (
                      <a
                        href={metadata.ctaLink}
                        target={metadata.ctaLink!.startsWith('http') ? '_blank' : '_self'}
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          minWidth: '120px',
                          maxWidth: '150px',
                          borderRadius: '8px',
                          background: 'var(--primary)',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: '600',
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                          transition: 'opacity 0.15s ease',
                          boxSizing: 'border-box',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {metadata.ctaText}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                          <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes badgeGlow {
          0%, 100% { box-shadow: 0 0 6px rgba(16,185,129,0.25); }
          50%       { box-shadow: 0 0 14px rgba(16,185,129,0.55); }
        }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.85); }
          70% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes joinGlow {
          0%, 100% { box-shadow: 0 4px 15px rgba(239,68,68,0.4); }
          50%       { box-shadow: 0 4px 28px rgba(239,68,68,0.7); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes greenPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(16,185,129,0.6); }
          50%       { opacity: 0.55; box-shadow: 0 0 3px rgba(16,185,129,0.15); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 10px rgba(239,68,68,0.7); }
          50%       { opacity: 0.5; box-shadow: 0 0 4px rgba(239,68,68,0.2); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @media (max-width: 640px) {
          .announcement-row-card {
            flex-direction: column !important;
            gap: 12px !important;
            padding: 14px 16px !important;
          }
          .announcement-row-right {
            flex-direction: row-reverse !important;
            align-items: center !important;
            justifyContent: space-between !important;
            width: 100% !important;
            padding-top: 10px !important;
            border-top: 1px solid var(--border) !important;
          }
        }
        @media (max-width: 767px) {
          .page-container > div[style*='grid-template-columns'] {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes redirectFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes redirectSpin { to { transform: rotate(360deg); } }
        @keyframes redLivePulse { 0%, 100% { box-shadow: 0 8px 18px rgba(239,68,68,0.40); } 50% { box-shadow: 0 8px 24px rgba(239,68,68,0.65); } }
      `}</style>

    </div>

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
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden',
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

              <div style={{ background: 'var(--surface-2)', borderRadius: '20px', padding: '24px', marginBottom: '32px', border: '1.5px solid var(--border)' }}>
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

    {/* Batch Comparison Modal */}
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
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          padding: '40px', textAlign: 'center',
          animation: 'modalSlideUp 0.3s ease-out'
        }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Welcome to PRO!</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
            Your upgrade was successful. You now have full access to live classes, mentorship, and priority support.
          </p>
          <div style={{ background: 'var(--success-light)', borderRadius: '16px', padding: '16px', marginBottom: '24px', border: '1.5px solid var(--success)' }}>
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
            margin: '0 auto 20px',
            animation: 'spin 1s linear infinite'
          }} />
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Processing...</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Please wait while we set up your course access.</p>
        </div>
      </div>
    )}

    {/* App/Website Rating Modal */}
    {showRatingModal && (
      <div
        className="modal-overlay fade-in"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        <div
          className="modal scale-up"
          style={{
            width: '100%',
            maxWidth: '480px',
            background: 'var(--surface)',
            borderRadius: '24px',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            marginBottom: '18px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 10px', fontFamily: "'Outfit', sans-serif" }}>
            {typeof document !== 'undefined' && document.documentElement.classList.contains('is-native') 
              ? 'Liked our App? Please rate us so we know!' 
              : 'Liked our Website? Please rate us so we know!'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.4 }}>
            Your feedback helps us improve your learning journey.
          </p>

          {/* Stars selection */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {[1, 2, 3, 4, 5].map(s => {
              const active = s <= rating
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: active ? '#fbbf24' : 'var(--text-muted)',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill={active ? '#fbbf24' : 'none'} stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
              )
            })}
          </div>

          {/* Comment Text Box */}
          <textarea
            placeholder="Tell us what you liked or how we can improve (optional)..."
            value={ratingComment}
            onChange={e => setRatingComment(e.target.value)}
            maxLength={500}
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              resize: 'none',
              marginBottom: '20px',
              fontFamily: 'inherit',
            }}
          />

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <button
              type="button"
              disabled={rating === 0 || submittingRating}
              onClick={async () => {
                setSubmittingRating(true)
                try {
                  const isNative = typeof document !== 'undefined' && document.documentElement.classList.contains('is-native')
                  const res = await fetch('/api/feedback/app', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      rating,
                      comment: ratingComment.trim() || null,
                      platform: isNative ? 'APP' : 'WEB',
                    })
                  })
                  if (res.ok) {
                    setShowRatingModal(false)
                  } else {
                    const data = await res.json()
                    alert(data.error || 'Failed to submit rating')
                  }
                } catch (e) {
                  console.error(e)
                  alert('Something went wrong')
                } finally {
                  setSubmittingRating(false)
                }
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                border: 'none',
                background: rating === 0 ? 'var(--text-muted)' : 'var(--primary)',
                color: rating === 0 ? 'var(--text-secondary)' : '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                cursor: rating === 0 ? 'default' : 'pointer',
                opacity: rating === 0 ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              {submittingRating ? 'Submitting...' : 'Submit'}
            </button>

            <button
              type="button"
              disabled={submittingRating}
              onClick={() => {
                const sevenDaysLater = new Date()
                sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
                localStorage.setItem('app_feedback_snooze_until', sevenDaysLater.toISOString())
                setShowRatingModal(false)
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Remind me after 7 days
            </button>
          </div>
        </div>
      </div>
    )}

    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes modalSlideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}} />

    <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    </>
  )
}
