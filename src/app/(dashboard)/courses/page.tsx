'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import useSWR, { mutate } from 'swr'
import { useRouter } from 'next/navigation'
import FeedbackModal from '@/components/FeedbackModal'
import { extractHex, colorWithOpacity, getCourseDisplayPalette, isGradient } from '@/lib/color-utils'
import { CourseIconBadge } from '@/lib/course-icons'
import { useTheme } from '@/components/ThemeProvider'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || `Request failed for ${url}`)
  }
  return data
}

interface CourseItem {
  id: string
  name: string
  description: string
  subject: string
  color: string
  icon: string
  courseIconType?: string | null
  teacherName: string
  enrollmentType?: string
  liveUpgradePrice?: number | null
  isDemo?: boolean
  _count: { lectures: number; materials: number; topics: number; courseEvents: number }
}

function TeacherIcon({ size = 24, color, background }: { size?: number; color: string; background: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={Math.max(12, Math.round(size * 0.58))} height={Math.max(12, Math.round(size * 0.58))} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </span>
  )
}

export default function CoursesPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { data, error, isLoading } = useSWR<CourseItem[]>('/api/courses', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
  const coursesFact = useLoadingFact(isLoading)
  const { data: userData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false })
  const { data: helpCard } = useSWR('/api/support/help-card', fetcher)
  const { data: offeringsData } = useSWR('/api/course-offerings', fetcher, { revalidateOnFocus: false })
  const isManager = userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER'
  const isStudent = userData?.user?.role === 'STUDENT' || userData?.role === 'STUDENT'
  
  const { data: feedbacksRaw, mutate: mutateFeedbacks } = useSWR(isStudent ? '/api/feedback' : null, fetcher)
  const feedbacks = Array.isArray(feedbacksRaw) ? feedbacksRaw : []
  const [selectedFeedbackCourse, setSelectedFeedbackCourse] = useState<CourseItem | null>(null)

  const courses = Array.isArray(data) ? data : (data as any)?.courses || []
  const [search, setSearch] = useState('')
  const [batchTab, setBatchTab] = useState<'all' | 'pro' | 'one' | 'general'>('all')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [infoModalCourse, setInfoModalCourse] = useState<CourseItem | null>(null)
  const [upgradeModalCourse, setUpgradeModalCourse] = useState<CourseItem | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [showUpgradeHint, setShowUpgradeHint] = useState<string | null>(null)
  const [upgradeSuccessOrderId, setUpgradeSuccessOrderId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Purchase modal states
  const [offering, setOffering] = useState<any | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showComparisonModal, setShowComparisonModal] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
    }, 500)
    return () => clearTimeout(handler)
  }, [search])

  const isOneOnOne = (c: CourseItem) => /(^|\s)1\s*[:×x]\s*1\b/i.test(c.name || '')
  const batchKind = (c: CourseItem): 'pro' | 'one' | 'general' | 'plus' => {
    if (c.enrollmentType === 'FREE' || c.isDemo) return 'general'
    if (isOneOnOne(c)) return 'one'
    if (c.enrollmentType === 'RECORDED') return 'plus'
    return 'pro'
  }
  const filtered = courses.filter((c: CourseItem) =>
    (c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      c.subject?.toLowerCase().includes(debouncedSearch.toLowerCase())) &&
    (batchTab === 'all' || batchKind(c) === batchTab || (batchTab === 'pro' && batchKind(c) === 'plus'))
  )
  // Banner art: the same illustrations the Store uses, picked from the course's term / name
  const courseArt = (c: CourseItem & { academicTerm?: string | null }) => {
    const t = `${(c as any).academicTerm || ''} ${c.subject || ''} ${c.name || ''}`.toLowerCase()
    if (/crash/.test(t)) return '/store-art/store-course.webp'
    if (/re-?attempt/.test(t)) return '/store-art/term-reattempt.webp'
    if (/qualifier/.test(t)) return '/store-art/term-qualifier.webp'
    if (/diploma/.test(t)) return '/store-art/term-diploma.webp'
    if (/degree/.test(t)) return '/store-art/term-degree.webp'
    if (/foundation/.test(t)) return '/store-art/term-foundation.webp'
    if (batchKind(c) === 'general') return '/store-art/term-general.webp'
    return '/store-art/store-course.webp'
  }

  async function handleUpgrade(courseId: string) {
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
              mutate('/api/courses')
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
              mutate('/api/courses')
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

  if (isLoading) {
    return (
      <div className="page-container">
        <style>{`
          :root {
            --course-card-padding: 18px 20px 16px;
            --course-banner-height: 100px;
            --course-icon-size: 58px;
            --course-card-radius: 28px;
          }
          @media (max-width: 767px) {
            .grid-3 {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 12px !important;
            }
            :root {
              --course-card-padding: 10px 10px 12px;
              --course-banner-height: 70px;
              --course-icon-size: 38px;
              --course-card-radius: 20px;
            }
          }
          @media (max-width: 600px) {
            .courses-header-row { margin-bottom: 18px !important; }
            .courses-search-wrap { width: 100%; }
            .courses-search-input { width: 100% !important; }
          }
        `}</style>
        
        {coursesFact && (
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <LoadingFactCard fact={coursesFact} />
          </div>
        )}

        {/* Header and Filter Search Skeletons */}
        <div className="courses-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' }}>
          <div className="skeleton" style={{ height: '14px', width: '120px', borderRadius: '4px' }} />
          <div className="courses-search-wrap" style={{ position: 'relative' }}>
            <div className="skeleton courses-search-input" style={{ width: '260px', height: '40px', borderRadius: '50px' }} />
          </div>
        </div>

        {/* Enhanced Card Grid Skeletons */}
        <div className="grid-3 courses-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div
              key={i}
              style={{
                background: 'var(--surface-2)',
                borderRadius: 'var(--course-card-radius, 28px)',
                boxShadow: '8px 8px 16px var(--neu-dark), -8px -8px 16px var(--neu-light)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '320px',
                position: 'relative'
              }}
            >
              {/* Banner Skeleton */}
              <div style={{
                height: 'var(--course-banner-height, 100px)',
                background: 'var(--skeleton-shine)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div className="skeleton" style={{
                  width: 'var(--course-icon-size, 58px)',
                  height: 'var(--course-icon-size, 58px)',
                  borderRadius: '50%'
                }} />
                <div className="skeleton" style={{
                  position: 'absolute', top: '10px', left: '12px',
                  height: '16px', width: '70px', borderRadius: '20px'
                }} />
              </div>

              {/* Card Body Skeleton */}
              <div style={{ padding: 'var(--course-card-padding, 18px 20px 16px)', display: 'flex', flexDirection: 'column', flex: 1, gap: '8px' }}>
                <div className="skeleton" style={{ height: '18px', width: '80%', borderRadius: '4px' }} />
                <div className="skeleton" style={{ height: '14px', width: '50%', borderRadius: '4px' }} />
                
                <div className="skeleton" style={{ height: '20px', width: '70px', borderRadius: '50px', marginTop: '4px' }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', marginBottom: '8px' }}>
                  <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                  <div className="skeleton" style={{ height: '12px', width: '90px', borderRadius: '4px' }} />
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <div className="skeleton" style={{ height: '42px', width: '100%', borderRadius: '50px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container fade-in" data-tour="courses-page-grid">
      {error ? (
        <div
          className="card"
          style={{
            marginBottom: '16px',
            padding: '14px 18px',
            border: '1px solid var(--border)',
            color: 'var(--danger)',
            background: 'var(--danger-light)',
          }}
        >
          Failed to load courses. {error.message}
        </div>
      ) : null}
      <div className="gz-courses-bar">
        <input
          type="text"
          placeholder="Search courses…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="gz-input gz-courses-bar__search"
        />
        <div className="gz-tabs">
          {([['all', 'All'], ['pro', 'PRO'], ['one', '1:1'], ['general', 'General']] as const).map(([k, label]) => (
            <button key={k} className={batchTab === k ? 'is-on' : ''} onClick={() => setBatchTab(k)}>{label}</button>
          ))}
        </div>
      </div>
      <style>{`
        .courses-search-input {
          border: 1.5px solid #000000 !important;
          color: #000000 !important;
          background: #ffffff !important;
        }
        .courses-search-input::placeholder {
          color: #000000 !important;
          opacity: 0.65 !important;
        }
        .courses-search-input:focus {
          border-color: #000000 !important;
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.15) !important;
        }

        :root {
          --course-card-padding: 18px 20px 16px;
          --course-banner-height: 100px;
          --course-icon-size: 58px;
          --course-icon-svg-size: 28px;
          --course-title-size: 16px;
          --course-desc-display: -webkit-box;
          --course-teacher-display: flex;
          --course-stats-padding: 8px 10px;
          --course-stats-font-size: 15px;
          --course-stats-label-size: 11px;
          --course-stats-gap: 10px;
          --course-badge-padding: 3px 10px;
          --course-badge-font: 10px;
          --course-card-radius: 28px;
          --course-teacher-margin: 14px;
          --course-upgrade-padding: 14px 16px;
          --course-upgrade-font-size: 13px;
          --course-badge-pos: absolute;
          --course-badge-left: 12px;
          --course-upgrade-flex-dir: row;
          --course-optional-margin: 0;
        }

        @media (max-width: 767px) {
          .grid-3 {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
          
          :root {
            --course-card-padding: 10px 10px 12px;
            --course-banner-height: 70px;
            --course-icon-size: 38px;
            --course-icon-svg-size: 18px;
            --course-title-size: 13.5px;
            --course-desc-display: none; /* Hide descriptions to keep card heights small & consistent */
            --course-teacher-display: none; /* Hide teacher name to save vertical space on mobile cards */
            --course-stats-padding: 4px 6px;
            --course-stats-font-size: 12px;
            --course-stats-label-size: 8px;
            --course-stats-gap: 6px;
            --course-badge-padding: 2px 6px;
            --course-badge-font: 8px;
            --course-card-radius: 20px;
            --course-teacher-margin: 6px;
            --course-upgrade-padding: 8px 6px;
            --course-upgrade-font-size: 9px;
            --course-badge-pos: relative;
            --course-badge-left: auto;
            --course-upgrade-flex-dir: column;
            --course-optional-margin: 0 0 4px 0;
          }

          /* Match compact margins for headers inside the card */
          .grid-3 h3 {
            margin-bottom: 2px !important;
          }

          .mobile-only-feedback-btn {
            display: flex !important;
          }
        }

        .mobile-only-feedback-btn {
          display: none !important;
        }

        /* Big screens: fit as many ~300px cards per row as there is room for, no empty gaps */
        @media (min-width: 1024px) {
          .courses-grid {
            grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)) !important;
            gap: 24px !important;
            --course-card-max: none;
          }
        }

        @media (max-width: 600px) {
          .courses-header-row { margin-bottom: 18px !important; }
          .courses-search-wrap { width: 100%; }
          .courses-search-input { width: 100% !important; }
        }
      `}</style>

      <style>{`
        @keyframes proShine {
          0% { left: -100%; }
          20% { left: 200%; }
          100% { left: 200%; }
        }
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .help-icon-float {
          animation: gentleFloat 3s ease-in-out infinite;
        }
      `}</style>

        <div className="gz-cc-grid gz-cc-grid--courses">
        {filtered.map((course: CourseItem) => {
          const kind = batchKind(course)
          const isRecorded = ['RECORDED', 'FREE'].includes(course.enrollmentType || '')
          const isFreeOrDemo = course.enrollmentType === 'FREE' || !!course.isDemo
          const hasUpgradePrice = isRecorded && !isFreeOrDemo && course.liveUpgradePrice != null && course.liveUpgradePrice > 0
          const batchLabel = kind === 'general' ? 'General Batch' : kind === 'one' ? '1:1 Batch' : kind === 'plus' ? 'PLUS' : 'PRO Batch'
          const isCourseExpired = (course as any).isExpired
          const tint = /^#/.test(course.color || '') ? course.color : 'var(--gz-ink)'

          const inner = (
            <div data-snow className={`gz-cc${isCourseExpired ? ' is-expired' : ''}`}
              onMouseEnter={() => { if (!isCourseExpired && !isFreeOrDemo && isRecorded) setShowUpgradeHint(course.id) }}
              onMouseLeave={() => setShowUpgradeHint(null)}
            >
              <div className="gz-cc__banner gz-cc__banner--art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={courseArt(course)} alt="" loading="lazy" decoding="async" />
                <span className="gz-cc__pill">{batchLabel}</span>
                {isCourseExpired && <span className="gz-cc__expired">Expired</span>}
                {isRecorded && !isFreeOrDemo && !isManager && (
                  <button
                    className="gz-cc__info"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setInfoModalCourse(course) }}
                    title="Compare PRO vs PLUS"
                    aria-label="Compare PRO and PLUS batches"
                  >i</button>
                )}
              </div>

              <div className="gz-cc__body">
                <div className="gz-cc__name">
                  {course.name}
                  {course.isDemo && <span className="gz-cc__tag" style={{ marginLeft: 8, background: 'var(--gz-chip)', color: 'var(--gz-ink-2)' }}>DEMO</span>}
                </div>
                <div className="gz-cc__meta">
                  {course.subject && <span className="gz-cc__tag" style={{ color: tint, background: `color-mix(in srgb, ${tint} 10%, transparent)` }}>{course.subject}</span>}
                  {course.teacherName && <span className="gz-cc__who">{course.teacherName}</span>}
                </div>

                {hasUpgradePrice && (
                  <button className="gz-btn" onClick={e => { e.preventDefault(); e.stopPropagation(); setUpgradeModalCourse(course) }}>
                    ⚡ Upgrade to PRO — ₹{course.liveUpgradePrice}
                  </button>
                )}

                {isStudent && !feedbacks.some((f: any) => f.courseId === course.id) && (
                  <button
                    className="gz-btn gz-btn--ghost mobile-only-feedback-btn"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setSelectedFeedbackCourse(course) }}
                  >
                    Give Feedback
                  </button>
                )}

                <div className="gz-cc__stats">
                  <div><b>{course._count?.topics || 0}</b><span>Topics</span></div>
                  <div><b>{course._count?.lectures || 0}</b><span>Lectures</span></div>
                  <div><b>{course._count?.materials || 0}</b><span>Materials</span></div>
                </div>
              </div>
            </div>
          )

          return isCourseExpired ? (
            <div key={course.id} style={{ display: 'flex' }}>{inner}</div>
          ) : (
            <Link key={course.id} href={`/courses/${course.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>{inner}</Link>
          )
        })}

        {helpCard && helpCard.isEnabled && (
          <a href={helpCard.redirectUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>
            <div data-snow className="gz-cc gz-cc--help">
              <div className="gz-cc__banner gz-cc__banner--help">
                <span className="help-icon-float gz-cc__arrow">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </span>
              </div>
              <div className="gz-cc__body" style={{ alignItems: 'center', textAlign: 'center', justifyContent: 'center' }}>
                <div className="gz-cc__name">{helpCard.title}</div>
                <span className="gz-btn" style={{ width: '100%' }}>{helpCard.buttonText || 'Enroll in More'}</span>
              </div>
            </div>
          </a>
        )}
      </div>

      {filtered.length === 0 && (!helpCard || !helpCard.isEnabled) && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>No courses found</p>
          <p style={{ fontSize: '13px' }}>Try a different search term</p>
        </div>
      )}

      {/* ── Info / Comparison Modal ── */}
      {infoModalCourse && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '20px'
        }} onClick={() => setInfoModalCourse(null)}>
          <style dangerouslySetInnerHTML={{ __html: `
            .batch-cmp-modal { padding: 30px 40px; }
            .batch-cmp-table-wrap { padding: 30px 40px; }
            .batch-cmp-footer { padding: 0 40px 40px; }
            .batch-cmp-th { padding: 14px 16px; font-size: 13px; }
            .batch-cmp-td { padding: 14px 16px; font-size: 13px; }
            .batch-cmp-title { font-size: 24px; }
            .batch-cmp-sub { font-size: 15px; }
            @media (max-width: 520px) {
              .batch-cmp-modal { padding: 18px 16px 14px; }
              .batch-cmp-table-wrap { padding: 12px; }
              .batch-cmp-footer { padding: 0 12px 16px; }
              .batch-cmp-th { padding: 8px 8px; font-size: 10px; }
              .batch-cmp-td { padding: 10px 8px; font-size: 11px; }
              .batch-cmp-title { font-size: 18px; }
              .batch-cmp-sub { font-size: 12px; }
            }
          `}} />
          <div style={{
            background: 'var(--surface)', borderRadius: '24px', width: '100%', maxWidth: '750px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
            animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="batch-cmp-modal" style={{ background: 'linear-gradient(135deg, var(--surface-2), var(--border))', borderBottom: '1.5px solid var(--border)', position: 'relative' }}>
              <button onClick={() => setInfoModalCourse(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'var(--surface)', border: 'none', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <h2 className="batch-cmp-title" style={{ fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px', paddingRight: '40px' }}>Batch Comparison</h2>
              <p className="batch-cmp-sub" style={{ color: 'var(--text-secondary)', fontWeight: '500', margin: 0 }}>Choose the experience that fits your learning style</p>
            </div>

            {/* Comparison Table */}
            <div className="batch-cmp-table-wrap">
              <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '38%' }} />
                    <col style={{ width: '31%' }} />
                    <col style={{ width: '31%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--surface)' }}>
                      <th className="batch-cmp-th" style={{ color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Features</th>
                      <th className="batch-cmp-th" style={{ color: 'var(--warning)', fontWeight: '800', background: 'var(--warning-light)', textAlign: 'center', wordBreak: 'break-word' }}>
                        {infoModalCourse?.enrollmentType === 'FREE' || infoModalCourse?.enrollmentType === 'DEMO' ? 'General' : 'PLUS'}
                      </th>
                      <th className="batch-cmp-th" style={{ color: 'var(--primary-dark)', fontWeight: '800', background: 'var(--primary-light)', textAlign: 'center' }}>PRO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { f: 'Lectures', g: '✅ Full', p: '✅ Full' },
                      { f: 'Materials', g: '✅ Full', p: '✅ Full' },
                      { f: 'Live Classes', g: '❌ No', p: '✅ Yes' },
                      { f: 'Q&A w/ Teacher', g: '❌ No', p: '✅ Live' },
                      { f: 'Mentorship', g: '❌ No', p: '✅ Weekly' },
                      { f: 'Support', g: '❌ Basic', p: '✅ Priority' },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="batch-cmp-td" style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{row.f}</td>
                        <td className="batch-cmp-td" style={{ color: 'var(--warning)', textAlign: 'center', background: 'var(--warning-light)' }}>{row.g}</td>
                        <td className="batch-cmp-td" style={{ color: 'var(--primary-dark)', fontWeight: '700', textAlign: 'center', background: 'var(--surface)' }}>{row.p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="batch-cmp-footer" style={{ textAlign: 'center' }}>
              <button onClick={() => setInfoModalCourse(null)} style={{ background: 'var(--primary)', color: 'white', padding: '12px 32px', borderRadius: '14px', fontSize: '14px', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upgrade Confirmation Modal ── */}
      {upgradeModalCourse && (
        <div
          onClick={() => !upgrading && setUpgradeModalCourse(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            background: 'rgba(10,10,30,0.6)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '440px',
              boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              padding: '40px', textAlign: 'center', position: 'relative',
              animation: 'modalSlideUp 0.3s ease-out'
            }}
          >
            {upgrading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', marginBottom: '24px' }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"/>
                </svg>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px' }}>Processing Payment...</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  Please wait while we securely process your transaction.<br/>Do not close or refresh this page.
                </p>
                <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } }`}} />
              </div>
            ) : (
              <>
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
                    style={{
                      flex: 1, padding: '16px', borderRadius: '18px', border: '2px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--text-secondary)', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpgrade(upgradeModalCourse.id)}
                    style={{
                      flex: 1.5, padding: '16px', borderRadius: '18px', border: 'none',
                      background: 'linear-gradient(135deg, var(--primary), var(--primary))',
                      color: 'white', fontWeight: '700', cursor: 'pointer',
                      boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    ✓ Confirm Upgrade
                  </button>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '24px' }}>
                  Course will be updated automatically after Payment
                </div>
              </>
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
                  background: 'var(--surface-2, color-mix(in srgb, var(--primary) 2%, transparent))',
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
                  background: 'var(--surface-2, color-mix(in srgb, var(--primary) 2%, transparent))',
                  border: '1.5px solid var(--accent)',
                  position: 'relative',
                  boxShadow: '0 8px 24px color-mix(in srgb, var(--primary) 8%, transparent)'
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
                boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent)',
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
                    <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--primary)', textAlign: 'center', width: '30%', background: 'color-mix(in srgb, var(--primary) 5%, transparent)' }}>PRO</th>
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
                        background: 'color-mix(in srgb, var(--primary) 2%, transparent)'
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
                  background: 'linear-gradient(135deg, var(--primary), var(--primary))', color: '#ffffff',
                  fontSize: '14px', fontWeight: '800', cursor: 'pointer',
                  boxShadow: '0 4px 15px color-mix(in srgb, var(--primary) 30%, transparent)', transition: 'all 0.2s'
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
              borderTop: '4px solid var(--primary)', borderRadius: '50%',
              margin: '0 auto 20px'
            }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Processing...</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Please wait while we set up your course access.</p>
          </div>
        </div>
      )}

      {selectedFeedbackCourse && (
        <FeedbackModal
          courseId={selectedFeedbackCourse.id}
          courseName={selectedFeedbackCourse.name}
          courseSubject={selectedFeedbackCourse.subject || ''}
          onClose={() => setSelectedFeedbackCourse(null)}
          onSuccess={() => {
            mutateFeedbacks()
          }}
        />
      )}

      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
