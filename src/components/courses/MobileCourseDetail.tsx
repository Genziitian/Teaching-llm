'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import FeedbackModal from '@/components/FeedbackModal'
import { getCourseDisplayPalette, isGradient } from '@/lib/color-utils'
import { Capacitor } from '@capacitor/core'
import { useTheme } from '@/components/ThemeProvider'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const USE_REDESIGNED_MOBILE_CARDS = true

function getUploadAge(createdAt?: string | Date): string {
  if (!createdAt) return 'Today'
  const createdDate = new Date(createdAt)
  const nowDate = new Date()
  
  const d1 = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate())
  const d2 = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate())
  
  const diffTime = d2.getTime() - d1.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays <= 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return '1 day ago'
  } else {
    return `${diffDays} days ago`
  }
}

interface ContentItem {
  id: string
  title: string
  description?: string
  videoUrl?: string
  youtubeUrl?: string
  pptUrl?: string
  order: number
  durationMinutes?: number
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
  description?: string
  subject?: string
  color?: string
  expiresAt?: string
  teacherName?: string
  isDemo?: boolean
  enrollmentType?: string | null
  liveUpgradePrice?: number | null
  instructorAssignments?: { instructor: { id: string; name: string } }[]
  _count?: { topics?: number; lectures?: number; materials?: number; courseEvents?: number }
}

interface Props {
  course: CourseDetail
  topics: Topic[]
  expandedTopics: Set<string>
  toggleTopic: (id: string) => void
  progressMap: Record<string, string>
  updateProgress: (contentId: string, status: string) => void
  role: string
  setInfoModalCourse?: (course: any) => void
  setUpgradeModalCourse?: (course: any) => void
  setShowPurchaseModal?: (show: boolean) => void
  offering?: any
}

type TabKey = 'curriculum' | 'overview' | 'feedback'

/* ───── 3-state cycle: NOT_STARTED → COMPLETED → REWATCH → NOT_STARTED ───── */
function cycleStatus(current: string): string {
  if (current === 'COMPLETED') return 'REWATCH'
  if (current === 'REWATCH') return 'NOT_STARTED'
  return 'COMPLETED'
}

function isCardActionElement(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest('a, button, input, select, textarea, [role="button"], [role="menu"], [role="menuitem"]')
}

export default function MobileCourseDetail({
  course, topics, expandedTopics, toggleTopic, progressMap, updateProgress, role,
  setInfoModalCourse, setUpgradeModalCourse, setShowPurchaseModal, offering,
}: Props) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [tab, setTab] = useState<TabKey>('curriculum')
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  const [isNative, setIsNative] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const w = window as any
      setIsNative(!!(w.Capacitor?.isNativePlatform?.() || w.Capacitor?.isNative))
    }
  }, [])

  const { data: submittedFeedbacksRaw, mutate: mutateFeedbacks } = useSWR(role === 'STUDENT' ? '/api/feedback' : null, fetcher)
  const submittedFeedbacks = Array.isArray(submittedFeedbacksRaw) ? submittedFeedbacksRaw : []
  const hasFeedback = submittedFeedbacks.some((f: any) => f.courseId === course.id)

  const rawColor = course.color || '#6366F1'
  const coursePalette = getCourseDisplayPalette(rawColor, resolvedTheme)

  const hasValidUpgradePrice = offering != null && (
    (offering.hasRecorded && offering.recordedDiscountPrice != null && offering.recordedDiscountPrice > 0) ||
    (offering.hasLive && offering.liveDiscountPrice != null && offering.liveDiscountPrice > 0)
  );
  const accent = coursePalette.accent
  const totalLectures = course._count?.lectures || topics.reduce((s, t) => s + (t.content?.length || 0), 0)

  const completedCount = useMemo(() => {
    let count = 0
    topics.forEach(t => t.content?.forEach(c => {
      if (progressMap[c.id] === 'COMPLETED') count++
    }))
    return count
  }, [topics, progressMap])

  const allContentCount = useMemo(() => {
    return topics.reduce((s, t) => s + (t.content?.length || 0), 0)
  }, [topics])

  const progressPercent = allContentCount > 0 ? Math.round((completedCount / allContentCount) * 100) : 0

  const totalMinutesAll = useMemo(() => {
    let m = 0
    topics.forEach(t => t.content?.forEach(c => {
      m += (typeof c.durationMinutes === 'number' && c.durationMinutes > 0) ? c.durationMinutes : 14
    }))
    return m
  }, [topics])

  const durationLabel = totalMinutesAll > 0
    ? (Math.floor(totalMinutesAll / 60) > 0
      ? `${Math.floor(totalMinutesAll / 60)}h ${totalMinutesAll % 60}m`
      : `${totalMinutesAll}m`)
    : null

  const accessDays = useMemo(() => {
    if (!course.expiresAt) return null
    const exp = new Date(course.expiresAt)
    const now = new Date()
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }, [course.expiresAt])

  const expiresOnLabel = useMemo(() => {
    if (!course.expiresAt) return null
    return new Date(course.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }, [course.expiresAt])

  const isRecorded = ['RECORDED', 'FREE'].includes(course.enrollmentType || '');
  const isManager = role === 'ADMIN' || role === 'MANAGER'
  const heroBg = isRecorded
    ? 'linear-gradient(135deg, #4b5563 0%, #374151 50%, #111827 100%)'
    : coursePalette.isRefinedLightPalette
      ? coursePalette.background
      : isGradient(rawColor) ? rawColor : `linear-gradient(135deg, ${accent} 0%, ${accent}dd 50%, #1e1e3a 100%)`
  const badge = course.enrollmentType === 'LIVE' ? 'PRO'
    : course.enrollmentType === 'RECORDED' ? 'PLUS'
    : course.enrollmentType === 'FREE' ? 'FREE'
    : course.isDemo ? 'DEMO' : null;

  const mentorName = course.teacherName || course.instructorAssignments?.[0]?.instructor?.name || 'Mentor'

  return (
    <div className="mobile-course-detail" style={{ paddingBottom: '24px', background: 'var(--bg)', minHeight: '100vh' }}>
      <style>{`
        @keyframes mcdFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mcdPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        @keyframes mcdCheck { from { stroke-dashoffset: 20; } to { stroke-dashoffset: 0; } }
        .mcd-topic-card { transition: all 0.2s ease; }
        .mcd-topic-card:active { transform: scale(0.985); }
        .mcd-lecture-row { transition: all 0.15s ease; }
        .mcd-lecture-row-clickable { cursor: pointer; }
        .mcd-lecture-row-clickable:active { transform: scale(0.98); background: var(--surface-2) !important; }
        .mcd-status-btn { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .mcd-status-btn:active { transform: scale(0.85); }
        .mcd-tab-btn { transition: all 0.2s ease; position: relative; }
        .mcd-tab-btn::after {
          content: '';
          position: absolute;
          bottom: -1.5px;
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 24px;
          height: 2.5px;
          border-radius: 2px;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .mcd-tab-btn.active::after {
          transform: translateX(-50%) scaleX(1);
        }
        .mcd-redesigned-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          width: 100%;
          margin-top: 8px;
        }
        .mcd-redesigned-card {
          display: flex;
          flex-direction: column;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          transition: transform 0.15s ease, background-color 0.15s ease;
          width: 100%;
          box-sizing: border-box;
        }
        .mcd-redesigned-card:active {
          transform: scale(0.97);
          background: var(--surface);
        }
        .mcd-redesigned-thumbnail {
          width: 100%;
          aspect-ratio: 16 / 9;
          background: rgba(0, 0, 0, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid var(--border);
          position: relative;
        }
        .mcd-redesigned-info {
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          background: var(--surface-2);
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
        }
        .mcd-redesigned-title-wrapper {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
          flex: 1;
          width: 100%;
        }
        .mcd-redesigned-title {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mcd-redesigned-new-badge {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          padding: 1px 3.5px;
          border-radius: 2.5px;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }
        .mcd-redesigned-age {
          font-size: 10.5px;
          color: var(--text-muted);
          font-weight: 500;
          flex-shrink: 0;
        }
      `}</style>

      {/* ──── HERO ──── */}
      <div style={{
        position: 'relative',
        padding: '20px 22px 24px',
        paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
        background: heroBg,
        color: '#fff',
        borderRadius: '0 0 32px 32px',
        overflow: 'hidden',
        boxShadow: `0 12px 32px -8px ${isRecorded ? 'rgba(0,0,0,0.15)' : coursePalette.shadow}`,
      }}>
        {/* Decorative glass orbs */}
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 75%)', filter: 'blur(8px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '-20px', width: '140px', height: '140px', borderRadius: '50%', background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`, opacity: 0.28, filter: 'blur(20px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '35%', right: '10%', width: '90px', height: '90px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0))', border: '1px solid rgba(255,255,255,0.08)', pointerEvents: 'none' }} />

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', position: 'relative', zIndex: 2 }}>
          <button
            onClick={() => router.push('/courses')}
            aria-label="Back to courses"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              padding: '8px 16px', borderRadius: '50px', color: '#fff',
              fontSize: '12px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {badge && (
              <span style={{
                fontSize: '9.5px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '6px 12px', borderRadius: '50px',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))', color: '#fff',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                {badge}{course.subject ? ` · ${course.subject}` : ''}
              </span>
            )}
            {course.enrollmentType === 'RECORDED' && course.liveUpgradePrice && !isManager && setInfoModalCourse && (
              <button
                onClick={() => setInfoModalCourse(course)}
                aria-label="Compare PRO vs PLUS batches"
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  color: '#fff', fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                i
              </button>
            )}
            <button
              aria-label="Share course"
              onClick={() => {
                if (typeof navigator !== 'undefined' && (navigator as any).share) {
                  (navigator as any).share({ title: course.name, url: typeof window !== 'undefined' ? window.location.href : '' }).catch(() => {})
                }
              }}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                cursor: 'pointer', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            </button>
          </div>
        </div>

        {/* Subject Label */}
        {course.subject && (
          <div style={{
            fontSize: '11px',
            fontWeight: 900,
            color: 'rgba(255, 255, 255, 0.75)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '4px',
            position: 'relative',
            zIndex: 2,
          }}>
            {course.subject}
          </div>
        )}
        {/* Title */}
        <h1 style={{
          fontSize: '25px', fontWeight: 900, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.02em',
          margin: '0 0 8px', position: 'relative', zIndex: 2,
          textShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}>
          {course.name}
        </h1>
        {course.description && (
          <p style={{
            fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', fontWeight: 500,
            margin: '0 0 16px', position: 'relative', zIndex: 2, lineHeight: 1.45,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {course.description}
          </p>
        )}



        {/* Upgrade Button */}
        {course.enrollmentType === 'RECORDED' && course.liveUpgradePrice && !isManager && setUpgradeModalCourse && (
          <button
            onClick={() => setUpgradeModalCourse(course)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '50px',
              border: 'none',
              background: 'var(--primary)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(30, 30, 58, 0.35)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '14px',
              position: 'relative',
            }}
          >
            <span style={{
              fontSize: '8px', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '20px',
              color: '#fff', letterSpacing: '0.05em', fontWeight: '900', border: '1px solid rgba(255,255,255,0.2)'
            }}>
              OPTIONAL
            </span>
            <span>⚡ Upgrade to PRO — ₹{course.liveUpgradePrice}</span>
          </button>
        )}

      </div>

      {/* ──── CONTENT AREA ──── */}
      <div style={{ padding: '0 14px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>





        {/* ──── Tabs ──── */}
        <div style={{
          display: 'flex', gap: '0',
          borderBottom: '1.5px solid var(--border)',
          marginTop: '4px',
        }}>
          {([
            { key: 'curriculum' as TabKey, label: 'Curriculum', count: topics.length },
            { key: 'overview' as TabKey, label: 'Overview' },
            role === 'STUDENT' && { key: 'feedback' as TabKey, label: 'Feedback' },
          ].filter(Boolean) as any[]).map(t => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                className={`mcd-tab-btn ${active ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  padding: '10px 18px',
                  fontSize: '13px', fontWeight: active ? 900 : 600,
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  marginBottom: '-1.5px',
                  ...(active ? { ['--after-bg' as string]: accent } : {}),
                }}
              >
                <style>{`.mcd-tab-btn.active::after { background: ${accent}; }`}</style>
                {t.label}
                {typeof t.count === 'number' && (
                  <span style={{
                    marginLeft: '5px',
                    fontSize: '10px', fontWeight: 800,
                    color: active ? accent : '#b0b0c0',
                    background: active ? coursePalette.softerBg : 'transparent',
                    padding: '1px 6px', borderRadius: '8px',
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ──── Tab Content ──── */}
        {tab === 'curriculum' && (
          <CurriculumTab
            courseId={course.id}
            accent={accent}
            accentSoft={coursePalette.softBg}
            accentBorder={coursePalette.softBorder}
            accentShadow={coursePalette.shadow}
            topics={topics}
            expandedTopics={expandedTopics}
            toggleTopic={toggleTopic}
            progressMap={progressMap}
            updateProgress={updateProgress}
            isStudent={role === 'STUDENT'}
            setShowPurchaseModal={setShowPurchaseModal}
            course={course}
            offering={offering}
            role={role}
          />
        )}

        {tab === 'overview' && (
          <OverviewTab 
            course={course} 
            mentorName={mentorName} 
            totalLectures={totalLectures} 
            accent={accent} 
            accessDays={accessDays} 
          />
        )}

        {tab === 'feedback' && (
          <FeedbackTab 
            course={course} 
            hasFeedback={hasFeedback} 
            setShowFeedbackModal={setShowFeedbackModal} 
          />
        )}
      </div>

      {showFeedbackModal && (
        <FeedbackModal
          courseId={course.id}
          courseName={course.name}
          courseSubject={course.subject || ''}
          onClose={() => setShowFeedbackModal(false)}
          onSuccess={() => {
            mutateFeedbacks()
          }}
        />
      )}
    </div>
  )
}


/* ───────── Curriculum Tab ───────── */
function CurriculumTab({
  courseId, accent, accentSoft, accentBorder, accentShadow, topics, expandedTopics, toggleTopic, progressMap, updateProgress, isStudent, setShowPurchaseModal,
  course, offering, role,
}: {
  courseId: string
  accent: string
  accentSoft: string
  accentBorder: string
  accentShadow: string
  topics: Topic[]
  expandedTopics: Set<string>
  toggleTopic: (id: string) => void
  progressMap: Record<string, string>
  updateProgress: (contentId: string, status: string) => void
  isStudent: boolean
  setShowPurchaseModal?: (show: boolean) => void
  course?: CourseDetail
  offering?: any
  role: string
}) {
  const [activeDownloadUrl, setActiveDownloadUrl] = useState<string | null>(null)
  const [pendingDocument, setPendingDocument] = useState<ContentItem | null>(null)
  const router = useRouter()
  const [isNative, setIsNative] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const w = window as any
      setIsNative(!!(w.Capacitor?.isNativePlatform?.() || w.Capacitor?.isNative))
    }
  }, [])

  const lowestPrice = (() => {
    if (offering) {
      const prices: number[] = []
      if (offering.hasRecorded && typeof offering.recordedDiscountPrice === 'number') prices.push(offering.recordedDiscountPrice)
      if (offering.hasLive && typeof offering.liveDiscountPrice === 'number') prices.push(offering.liveDiscountPrice)
      if (typeof offering.championDiscountPrice === 'number' && offering.championDiscountPrice > 0) prices.push(offering.championDiscountPrice)
      if (prices.length > 0) return Math.min(...prices)
    }
    if (course && typeof course.liveUpgradePrice === 'number') {
      return course.liveUpgradePrice
    }
    return null
  })()
  const hasValidUpgradePrice = offering != null && (
    (offering.hasRecorded && offering.recordedDiscountPrice != null && offering.recordedDiscountPrice > 0) ||
    (offering.hasLive && offering.liveDiscountPrice != null && offering.liveDiscountPrice > 0)
  );
  const lectureHref = (contentId: string) => `/courses/${courseId}/lectures/${contentId}?courseId=${encodeURIComponent(courseId)}`
  const openLecture = (contentId: string) => router.push(lectureHref(contentId))

  if (topics.length === 0) {
    return (
      <div style={{
        padding: '40px 20px', textAlign: 'center',
        background: 'var(--surface)', borderRadius: '18px',
        border: '1px solid rgba(15,23,42,0.05)',
        color: 'var(--text-muted)', fontSize: '13px',
      }}>
        <div style={{ fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '4px' }}>No content yet</div>
        <div>Topics and lectures will appear here once your instructor adds them.</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {topics.map((topic, idx) => {
        const open = expandedTopics.has(topic.id)
        const completed = topic.content.filter(c => progressMap[c.id] === 'COMPLETED').length
        const rewatchCount = topic.content.filter(c => progressMap[c.id] === 'REWATCH').length
        const totalMinutes = topic.content.reduce((sum, c) => {
          const d = typeof c.durationMinutes === 'number' && c.durationMinutes > 0 ? c.durationMinutes : 14
          return sum + d
        }, 0)
        const durationLabel = totalMinutes > 0
          ? (Math.floor(totalMinutes / 60) > 0
            ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
            : `${totalMinutes}m`)
          : null
        const topicProgress = topic.content.length > 0 ? Math.round((completed / topic.content.length) * 100) : 0

        return (
          <div key={topic.id} className="mcd-topic-card" style={{
            background: 'var(--surface)',
            borderRadius: '18px',
            border: '1px solid rgba(15,23,42,0.08)',
            boxShadow: '0 4px 15px rgba(15,23,42,0.03)',
            overflow: 'hidden',
            marginBottom: '4px',
          }}>
            <button
              onClick={() => toggleTopic(topic.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px',
                background: 'linear-gradient(135deg, var(--surface-2), var(--surface))',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left',
                borderLeft: `4px solid ${accent}`,
              }}
            >
              {/* Topic number */}
              <div style={{
                width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                background: accentSoft,
                color: accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 800,
              }}>
                {String(idx + 1).padStart(2, '0')}
              </div>

              {/* Title + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic.title}</span>
                  {(((topic as any).createdAt && new Date().getTime() - new Date((topic as any).createdAt).getTime() < 24 * 60 * 60 * 1000) ||
                    topic.content?.some((item: any) => item.createdAt && new Date().getTime() - new Date(item.createdAt).getTime() < 24 * 60 * 60 * 1000)) && (
                    <span style={{
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: 'white', padding: '2px 6px', borderRadius: '4px',
                      fontSize: '9px', fontWeight: '800', textTransform: 'uppercase',
                      letterSpacing: '0.05em', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
                      flexShrink: 0
                    }}>
                      NEW
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {topic.content.length} lecture{topic.content.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Progress ring + expand */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {topic.content.length > 0 && (
                  <div style={{ position: 'relative', width: '26px', height: '26px' }}>
                    <svg width="26" height="26" viewBox="0 0 26 26" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="13" cy="13" r="10" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                      <circle
                        cx="13" cy="13" r="10" fill="none"
                        stroke={topicProgress === 100 ? 'var(--success)' : accent}
                        strokeWidth="2.5"
                        strokeDasharray={`${2 * Math.PI * 10}`}
                        strokeDashoffset={`${2 * Math.PI * 10 * (1 - topicProgress / 100)}`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                      />
                    </svg>
                    <span style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '7.5px', fontWeight: 800,
                      color: topicProgress === 100 ? 'var(--success)' : 'var(--text-secondary)',
                    }}>
                      {topicProgress === 100 ? '✓' : `${completed}/${topic.content.length}`}
                    </span>
                  </div>
                )}
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.4"
                  style={{ transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </button>

            {/* Lectures list inside nested tray */}
            {open && (
              <div style={{ 
                padding: '12px', 
                background: 'var(--surface)', 
                borderTop: '1px solid rgba(15,23,42,0.06)',
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px' 
              }}>
                {topic.content.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid rgba(15,23,42,0.05)' }}>
                    No lectures in this topic yet
                  </div>
                ) : (
                  <>
                    {/* Render Unlocked/Available Lectures */}
                    {USE_REDESIGNED_MOBILE_CARDS ? (
                      <div className="mcd-redesigned-grid">
                        {topic.content.filter((item) => !(item as any).isDemoLocked).map((item) => {
                          const isVideo = !!(item.videoUrl || item.youtubeUrl);
                          const isNew = (item as any).createdAt && new Date().getTime() - new Date((item as any).createdAt).getTime() < 24 * 60 * 60 * 1000;
                          const uploadAge = getUploadAge((item as any).createdAt);

                          const cardInner = (
                            <>
                              <div className="mcd-redesigned-thumbnail">
                                {isVideo ? (
                                  <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--accent)' }}>
                                    <polygon points="5 3 19 12 5 21 5 3"/>
                                  </svg>
                                ) : (
                                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ color: 'var(--accent)' }}>
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="16" y1="13" x2="8" y2="13"/>
                                    <line x1="16" y1="17" x2="8" y2="17"/>
                                  </svg>
                                )}
                              </div>
                              <div className="mcd-redesigned-info">
                                <div className="mcd-redesigned-title-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span className="mcd-redesigned-title">{item.title}</span>
                                  {isNew && <span className="mcd-redesigned-new-badge">NEW</span>}
                                </div>
                                <span className="mcd-redesigned-age">{uploadAge}</span>
                              </div>
                            </>
                          );

                          if (isVideo) {
                            return (
                              <Link
                                key={item.id}
                                href={lectureHref(item.id)}
                                className="mcd-redesigned-card"
                              >
                                {cardInner}
                              </Link>
                            );
                          } else {
                            return (
                              <button
                                key={item.id}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPendingDocument(item);
                                }}
                                className="mcd-redesigned-card"
                                style={{ textAlign: 'left', padding: 0 }}
                              >
                                {cardInner}
                              </button>
                            );
                          }
                        })}
                      </div>
                    ) : (
                      topic.content.filter((item) => !(item as any).isDemoLocked).map((item) => {
                        const isVideo = !!(item.videoUrl || item.youtubeUrl);
                        const currentStatus = progressMap[item.id] || 'NOT_STARTED'
                        const isCompleted = currentStatus === 'COMPLETED'
                        const isRewatch = currentStatus === 'REWATCH'

                        if (!isVideo) {
                          return (
                            <div key={item.id} className="mcd-material-row" style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '16px 16px',
                              borderRadius: '16px',
                              background: 'var(--surface)',
                              border: '1px solid rgba(15,23,42,0.05)',
                              boxShadow: '0 2px 8px rgba(15,23,42,0.02)',
                              justifyContent: 'space-between',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                {/* PDF Style Document Icon with Red Highlight */}
                                <div style={{
                                  width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
                                  background: '#fef2f2',
                                  color: '#ef4444',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="16" y1="13" x2="8" y2="13"/>
                                    <line x1="16" y1="17" x2="8" y2="17"/>
                                  </svg>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                  }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                                    {(item as any).createdAt && new Date().getTime() - new Date((item as any).createdAt).getTime() < 24 * 60 * 60 * 1000 && (
                                      <span style={{
                                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                        color: 'white', padding: '2px 6px', borderRadius: '4px',
                                        fontSize: '9px', fontWeight: '800', textTransform: 'uppercase',
                                        letterSpacing: '0.05em', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
                                        flexShrink: 0
                                      }}>
                                        NEW
                                      </span>
                                    )}
                                  </div>
                                  {(item as any).description && (
                                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px', margin: 0 }}>
                                      {(item as any).description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Download Action Button */}
                              {item.pptUrl ? (
                                Capacitor.isNativePlatform() ? (
                                  <button
                                    onClick={() => setActiveDownloadUrl(item.pptUrl || null)}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                                      padding: '10px 18px', borderRadius: '50px',
                                      background: 'var(--surface)', color: 'var(--text-secondary)',
                                      border: '1.5px solid var(--border)',
                                      fontSize: '13px', fontWeight: 800,
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    Open
                                  </button>
                                ) : (
                                  <a
                                    href={item.pptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                                      padding: '10px 18px', borderRadius: '50px',
                                      background: 'var(--surface)', color: 'var(--text-secondary)',
                                      border: '1.5px solid var(--border)',
                                      fontSize: '13px', fontWeight: 800,
                                      textDecoration: 'none',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    Open
                                  </a>
                                )
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>—</span>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={item.id}
                            className="mcd-lecture-row mcd-lecture-row-clickable"
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
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '16px 16px',
                            borderRadius: '16px',
                            background: 'var(--surface)',
                            border: '1px solid rgba(15,23,42,0.05)',
                            boxShadow: '0 2px 8px rgba(15,23,42,0.02)',
                            position: 'relative',
                          }}>
                            {/* 3-state toggle button */}
                            {isStudent && (
                              <button
                                className="mcd-status-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateProgress(item.id, cycleStatus(currentStatus))
                                }}
                                aria-label={`Status: ${currentStatus}. Tap to change.`}
                                style={{
                                  width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
                                  background:
                                    isCompleted ? 'var(--success)' :
                                    isRewatch ? 'var(--warning)' : '#fff',
                                  color:
                                    (isCompleted || isRewatch) ? '#fff' : 'var(--text-muted)',
                                  border:
                                    (isCompleted || isRewatch) ? 'none' : '2px solid #d4d8e0',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer',
                                  boxShadow:
                                    isCompleted ? '0 2px 6px rgba(16,185,129,0.35)' :
                                    isRewatch ? '0 2px 6px rgba(245,158,11,0.35)' : 'none',
                                  padding: 0,
                                }}
                              >
                                {isCompleted && (
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                )}
                                {isRewatch && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/></svg>
                                )}
                              </button>
                            )}

                            {/* Title + duration */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                display: 'flex', alignItems: 'center', gap: '6px',
                              }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                                {/* Added on date hidden on mobile viewports */}
                                {(item as any).createdAt && new Date().getTime() - new Date((item as any).createdAt).getTime() < 24 * 60 * 60 * 1000 && (
                                  <span style={{
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    color: 'white', padding: '2px 6px', borderRadius: '4px',
                                    fontSize: '9px', fontWeight: '800', textTransform: 'uppercase',
                                    letterSpacing: '0.05em', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
                                    flexShrink: 0
                                  }}>
                                    NEW
                                  </span>
                                )}
                              </div>
                              {typeof item.durationMinutes === 'number' && item.durationMinutes > 0 && (
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                                  {Math.floor(item.durationMinutes / 60) > 0
                                    ? `${Math.floor(item.durationMinutes / 60)}h ${item.durationMinutes % 60}m`
                                    : `${item.durationMinutes}m`}
                                </div>
                              )}
                            </div>

                            {/* Action */}
                            {(item.videoUrl || item.youtubeUrl) ? (
                              <Link
                                href={lectureHref(item.id)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                                  padding: '10px 18px', borderRadius: '50px',
                                  background: isCompleted ? '#fff' : accent,
                                  color: isCompleted ? accent : '#fff',
                                  border: isCompleted ? `1.5px solid ${accentBorder}` : 'none',
                                  fontSize: '13px', fontWeight: 800,
                                  textDecoration: 'none',
                                  boxShadow: isCompleted ? 'none' : `0 2px 8px ${accentShadow}`,
                                  flexShrink: 0,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {isCompleted ? (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/></svg>
                                    Rewatch
                                  </>
                                ) : (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    Watch
                                  </>
                                )}
                              </Link>
                            ) : item.pptUrl ? (
                              Capacitor.isNativePlatform() ? (
                                <button
                                  onClick={() => setActiveDownloadUrl(item.pptUrl || null)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '10px 18px', borderRadius: '50px',
                                    background: 'var(--surface)', color: 'var(--text-secondary)',
                                    border: '1.5px solid var(--border)',
                                    fontSize: '13px', fontWeight: 800,
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  Open
                                </button>
                              ) : (
                                <a
                                  href={item.pptUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '10px 18px', borderRadius: '50px',
                                    background: 'var(--surface)', color: 'var(--text-secondary)',
                                    border: '1.5px solid var(--border)',
                                    fontSize: '13px', fontWeight: 800,
                                    textDecoration: 'none',
                                    flexShrink: 0,
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  Open
                                </a>
                              )
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>—</span>
                            )}
                          </div>
                        )
                      })
                    )}

                    {/* Render Locked Lectures blurred as a group */}
                    {(() => {
                      const lockedItems = topic.content.filter((item) => (item as any).isDemoLocked)
                      if (lockedItems.length === 0) return null

                      return (
                        <div style={{ position: 'relative', marginTop: topic.content.some((item) => !(item as any).isDemoLocked) ? '12px' : '0' }}>
                          {/* Blurred rows */}
                          <div style={{
                            filter: 'blur(4px) grayscale(30%)',
                            opacity: 0.5,
                            pointerEvents: 'none',
                            userSelect: 'none',
                          }}>
                            {USE_REDESIGNED_MOBILE_CARDS ? (
                              <div className="mcd-redesigned-grid">
                                {lockedItems.map((item) => {
                                  const isVideo = !!(item.videoUrl || item.youtubeUrl);
                                  const isNew = (item as any).createdAt && new Date().getTime() - new Date((item as any).createdAt).getTime() < 24 * 60 * 60 * 1000;
                                  const uploadAge = getUploadAge((item as any).createdAt);

                                  return (
                                    <div key={item.id} className="mcd-redesigned-card">
                                      <div className="mcd-redesigned-thumbnail">
                                        {isVideo ? (
                                          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--accent)' }}>
                                            <polygon points="5 3 19 12 5 21 5 3"/>
                                          </svg>
                                        ) : (
                                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ color: 'var(--accent)' }}>
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                            <polyline points="14 2 14 8 20 8"/>
                                            <line x1="16" y1="13" x2="8" y2="13"/>
                                            <line x1="16" y1="17" x2="8" y2="17"/>
                                          </svg>
                                        )}
                                      </div>
                                      <div className="mcd-redesigned-info">
                                        <div className="mcd-redesigned-title-wrapper">
                                          <span className="mcd-redesigned-title">{item.title}</span>
                                          {isNew && <span className="mcd-redesigned-new-badge">NEW</span>}
                                        </div>
                                        <span className="mcd-redesigned-age">{uploadAge}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {lockedItems.map((item) => (
                                  <div key={item.id} className="mcd-lecture-row" style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '16px 16px',
                                    borderRadius: '16px',
                                    background: 'var(--surface)',
                                    border: '1px solid rgba(15,23,42,0.05)',
                                    boxShadow: '0 2px 8px rgba(15,23,42,0.02)',
                                  }}>
                                    {/* Lecture icon */}
                                    <div style={{
                                      width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
                                      background: 'var(--surface)',
                                      color: 'var(--text-muted)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      {(item.videoUrl || item.youtubeUrl) ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                      ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                      )}
                                    </div>

                                    {/* Title */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.title}
                                      </div>
                                    </div>

                                    {/* Lock icon */}
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                      </svg>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Center Premium Overlay Card */}
                          <div
                            onClick={hasValidUpgradePrice ? () => setShowPurchaseModal?.(true) : undefined}
                            style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10,
                            padding: '12px',
                            cursor: hasValidUpgradePrice ? 'pointer' : 'default',
                          }}>
                            <div
                              onClick={hasValidUpgradePrice ? () => setShowPurchaseModal?.(true) : (e) => e.stopPropagation()}
                              style={{
                                background: 'rgba(23, 27, 38, 0.94)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '20px',
                                padding: '16px 20px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center',
                                cursor: hasValidUpgradePrice ? 'pointer' : 'default',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                                maxWidth: '280px',
                                width: '100%',
                                pointerEvents: 'auto',
                              }}
                            >
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(79, 70, 229, 0.2))',
                                border: '1.5px solid rgba(99, 102, 241, 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '10px',
                                color: '#818cf8',
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                              </div>
                              {hasValidUpgradePrice ? (
                                <>
                                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', marginBottom: '12px' }}>
                                    Unlock All Lectures
                                  </div>
                                  <div style={{ fontSize: '10px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>⌛</span> Access Till End Term
                                  </div>
                                  <button style={{
                                    width: '100%',
                                    padding: '8px 16px',
                                    borderRadius: '50px',
                                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                    color: '#ffffff',
                                    fontWeight: '800',
                                    fontSize: '11px',
                                    border: 'none',
                                    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.25)',
                                    cursor: 'pointer',
                                  }}>
                                    Unlock Now
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', marginBottom: '8px' }}>
                                    Locked
                                  </div>
                                  <div style={{ fontSize: '11.5px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.65)', padding: '0 8px', lineHeight: '1.4' }}>
                                    This lecture is premium and not available in the demo batch.
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
      {activeDownloadUrl && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setActiveDownloadUrl(null)}>
          <div className="modal" style={{ maxWidth: '400px', borderRadius: '24px', padding: '24px', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '12px', color: 'var(--text-primary)' }}>
              Important Note
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Please ensure you use your registered email address to download or view this document.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setActiveDownloadUrl(null)}
                style={{
                  padding: '10px 20px', borderRadius: '50px',
                  border: '1.5px solid var(--border)', background: 'transparent',
                  color: 'var(--text-secondary)', fontWeight: 700, fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  window.open(activeDownloadUrl, '_blank')
                  setActiveDownloadUrl(null)
                }}
                style={{
                  padding: '10px 24px', borderRadius: '50px',
                  border: 'none', background: 'var(--primary)',
                  color: '#ffffff', fontWeight: 700, fontSize: '13px',
                  cursor: 'pointer', boxShadow: '0 2px 8px rgba(54,54,232,0.25)'
                }}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDocument && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setPendingDocument(null)}>
          <div className="modal" style={{ maxWidth: '400px', borderRadius: '24px', padding: '24px', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '12px', color: 'var(--text-primary)' }}>
              Open Study Material
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Please use your registered GenZ IITian account to open or download this file.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setPendingDocument(null)}
                style={{
                  padding: '10px 20px', borderRadius: '50px',
                  border: '1.5px solid var(--border)', background: 'transparent',
                  color: 'var(--text-secondary)', fontWeight: 700, fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const doc = pendingDocument
                  setPendingDocument(null)
                  if (!role) {
                    const nextPath = window.location.pathname + window.location.search
                    router.push(`/login?next=${encodeURIComponent(nextPath)}`)
                    return
                  }
                  if (doc.pptUrl) {
                    if (Capacitor.isNativePlatform()) {
                      setActiveDownloadUrl(doc.pptUrl)
                    } else {
                      window.open(doc.pptUrl, '_blank')
                    }
                  }
                }}
                style={{
                  padding: '10px 24px', borderRadius: '50px',
                  border: 'none', background: 'var(--primary)',
                  color: '#ffffff', fontWeight: 700, fontSize: '13px',
                  cursor: 'pointer', boxShadow: '0 2px 8px rgba(54,54,232,0.25)'
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function OverviewTab({ 
  course, mentorName, totalLectures, accent, accessDays 
}: { 
  course: CourseDetail; 
  mentorName: string; 
  totalLectures: number; 
  accent: string; 
  accessDays: number | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Access expiry info / warning */}
      {accessDays !== null && accessDays > 0 && (
        accessDays <= 10 ? (
          /* Warning Banner (<= 10 days) */
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 16px',
            borderRadius: '16px',
            background: accessDays <= 3 ? 'var(--danger-light)' : 'var(--warning-light)',
            border: `1px solid ${accessDays <= 3 ? 'var(--border)' : 'var(--border)'}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: accessDays <= 3
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #f97316, #ea580c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              boxShadow: accessDays <= 3 ? '0 4px 12px rgba(239,68,68,0.3)' : '0 4px 12px rgba(249,115,22,0.3)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: accessDays <= 3 ? 'var(--danger)' : 'var(--warning)', lineHeight: 1.3 }}>
                ⚠️ Access ending soon!
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: accessDays <= 3 ? 'var(--danger)' : 'var(--warning)', marginTop: '2px' }}>
                Only {accessDays} day{accessDays === 1 ? '' : 's'} left — your course access ends soon.
              </div>
            </div>
          </div>
        ) : (
          /* Neutral Info Banner (> 10 days) */
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 16px',
            borderRadius: '16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #94a3b8, #64748b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                Course access ends in {accessDays} days
              </div>
            </div>
          </div>
        )
      )}

      <div style={{
        background: 'var(--surface)',
        borderRadius: '16px',
        padding: '16px',
        border: '1px solid rgba(15,23,42,0.05)',
        boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
      }}>
        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
          About this course
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
          {course.description || 'No description provided yet. Check the curriculum tab for the full lecture list.'}
        </p>
      </div>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '16px',
        padding: '16px',
        border: '1px solid rgba(15,23,42,0.05)',
        boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
          <OverviewStat label="Subject" value={course.subject || '—'} accent={accent} />
          <OverviewStat label="Mentor" value={mentorName} accent={accent} />
          <OverviewStat label="Lectures" value={String(totalLectures)} accent={accent} />
          <OverviewStat label="Materials" value={String(course._count?.materials || 0)} accent={accent} />
        </div>
      </div>
    </div>
  )
}

function OverviewStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: '12px',
      background: 'var(--surface)',
    }}>
      <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </div>
    </div>
  )
}

/* ───────── Feedback Tab ───────── */
function FeedbackTab({ 
  course, hasFeedback, setShowFeedbackModal 
}: { 
  course: CourseDetail; 
  hasFeedback: boolean;
  setShowFeedbackModal: (show: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {hasFeedback ? (
        /* Already Submitted View */
        <div style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          padding: '30px 20px',
          border: '1px solid rgba(34, 197, 94, 0.12)',
          boxShadow: '0 2px 12px rgba(34, 197, 94, 0.04)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4ade80, #22c55e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 6px 18px rgba(34, 197, 94, 0.25)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>Feedback Submitted</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
              Thank you for sharing your experience! Your private review helps us improve the learning quality.
            </p>
          </div>
        </div>
      ) : (
        /* Invite to Rate View */
        <div style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          padding: '30px 20px',
          border: '1px solid rgba(217, 119, 6, 0.12)',
          boxShadow: '0 2px 12px rgba(217, 119, 6, 0.04)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fbbf24, #d97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 6px 18px rgba(217, 119, 6, 0.25)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>Share Your Experience</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
              Help us make {course.name} even better. Your rating and comments are completely private.
            </p>
          </div>
          
          <button
            onClick={() => setShowFeedbackModal(true)}
            style={{
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              color: 'white',
              padding: '14px 32px',
              borderRadius: '16px',
              fontSize: '14px',
              fontWeight: '800',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(217, 119, 6, 0.2)',
              width: '100%',
              fontFamily: 'inherit',
            }}
          >
            ⭐ Rate & Review Course
          </button>
        </div>
      )}
    </div>
  )
}
