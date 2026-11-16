'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import FeedbackModal from '@/components/FeedbackModal'
import { CourseIconBadge } from '@/lib/course-icons'
import { getCourseDisplayPalette } from '@/lib/color-utils'
import { useTheme } from '@/components/ThemeProvider'

interface CourseItem {
  id: string
  name: string
  description?: string
  subject?: string
  color?: string
  icon?: string | null
  courseIconType?: string | null
  teacherName?: string
  enrollmentType?: string
  expiresAt?: string | null
  _count?: { lectures?: number; materials?: number; topics?: number }
}

interface ProgressRow { contentId: string; status: string }

function TeacherIcon({ size = 28, color }: { size?: number; color: string }) {
  const subtleBg = color.startsWith('#') ? `${color}14` : 'var(--surface-2)'

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: subtleBg,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={Math.max(13, Math.round(size * 0.58))} height={Math.max(13, Math.round(size * 0.58))} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </span>
  )
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  return res.json().catch(() => ({}))
}

export default function MyCoursesMobile() {
  const { data: rawCourses } = useSWR('/api/courses', fetcher, { revalidateOnFocus: false })
  const { data: rawProgress } = useSWR('/api/lectures/progress', fetcher, { revalidateOnFocus: false })
  const { data: userData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false })
  const role = userData?.user?.role || userData?.role || 'STUDENT'

  const { data: feedbacksRaw, mutate: mutateFeedbacks } = useSWR(role === 'STUDENT' ? '/api/feedback' : null, fetcher)
  const feedbacks = Array.isArray(feedbacksRaw) ? feedbacksRaw : []
  const [selectedFeedbackCourse, setSelectedFeedbackCourse] = useState<CourseItem | null>(null)

  const courses: CourseItem[] = useMemo(() => {
    if (Array.isArray(rawCourses)) return rawCourses
    return rawCourses?.courses || []
  }, [rawCourses])

  const allProgress: ProgressRow[] = useMemo(() => {
    if (Array.isArray(rawProgress)) return rawProgress
    return rawProgress?.progress || []
  }, [rawProgress])

  const [search, setSearch] = useState('')

  // Per-course progress and access metadata
  const enriched = useMemo(() => {
    return courses.map(c => {
      const total = c._count?.lectures || 0
      const done = 0 // global progress map; per-course breakdown is fetched on detail page
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      const expires = c.expiresAt ? new Date(c.expiresAt) : null
      const now = new Date()
      const accessDays = expires ? Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : null
      const expired = expires ? expires.getTime() < now.getTime() : false
      return { course: c, pct, accessDays, expired }
    })
  }, [courses, allProgress])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enriched.filter(e => !q || e.course.name.toLowerCase().includes(q) || (e.course.subject || '').toLowerCase().includes(q))
  }, [enriched, search])

  const enrolledCount = enriched.length

  return (
    <div className="page-container fade-in" style={{ paddingBottom: '24px' }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', padding: '0 4px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.05 }}>
            My Courses
          </h1>
          <p style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '4px' }}>
            {enrolledCount} enrolled
          </p>
        </div>
        <button
          aria-label="Filter"
          style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'var(--surface)', border: 'none', cursor: 'pointer', flexShrink: 0,
            boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e1e3a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="7" y1="12" x2="17" y2="12"/>
            <line x1="10" y1="18" x2="14" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '22px' }}>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9999b0" strokeWidth="2.2"
          style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)' }}
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search your courses..."
          style={{
            width: '100%',
            padding: '12px 18px 12px 44px',
            borderRadius: '50px',
            border: 'none',
            background: 'var(--surface)',
            boxShadow: 'inset 4px 4px 8px var(--neu-dark), inset -4px -4px 8px var(--neu-light)',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: '13.5px',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* All courses */}
      <div>
        <div style={{ padding: '0 4px', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            All courses
          </h2>
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
            {enrolledCount} enrolled course{enrolledCount === 1 ? '' : 's'}
          </p>
        </div>
        {visible.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visible.map(({ course, pct, accessDays, expired }) => {
              const hasFeedback = feedbacks.some((f: any) => f.courseId === course.id)
              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  accessDays={accessDays}
                  expired={expired}
                  role={role}
                  hasFeedback={hasFeedback}
                  onGiveFeedback={() => setSelectedFeedbackCourse(course)}
                />
              )
            })}
          </div>
        )}
      </div>

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
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Course Card — purple gradient header + stat tiles
   ───────────────────────────────────────────────────────── */
function CourseCard({
  course,
  accessDays,
  expired,
  role,
  hasFeedback,
  onGiveFeedback,
}: {
  course: CourseItem
  accessDays: number | null
  expired: boolean
  role: string
  hasFeedback: boolean
  onGiveFeedback: () => void
}) {
  const { resolvedTheme } = useTheme()
  const coursePalette = getCourseDisplayPalette(course.color || '#6366F1', resolvedTheme)
  const accent = coursePalette.accent
  const headerBg = coursePalette.isRefinedLightPalette
    ? coursePalette.background
    : `linear-gradient(135deg, ${course.color || 'var(--accent)'} 0%, ${course.color || 'var(--accent)'}dd 60%, ${course.color || 'var(--accent)'}aa 100%)`
  const teacherAccent = coursePalette.isRefinedLightPalette ? accent : course.color || 'var(--accent)'
  const enrollmentBadge = course.enrollmentType === 'LIVE' ? 'LIVE BATCH'
    : course.enrollmentType === 'RECORDED' ? 'PRO BATCH'
    : course.enrollmentType === 'FREE' ? 'FREE'
    : course.enrollmentType === 'DEMO' ? 'DEMO'
    : null
  const termLabel = course.subject || null

  return (
    <Link
      href={`/courses/${course.id}`}
      style={{
        display: 'block',
        borderRadius: '14px',
        background: 'var(--surface)',
        boxShadow: '0 14px 30px -12px rgba(15, 23, 42, 0.15), 0 4px 8px -2px rgba(15, 23, 42, 0.04)',
        border: '1px solid rgba(15, 23, 42, 0.05)',
        overflow: 'hidden',
        textDecoration: 'none', color: 'inherit',
      }}
    >
      {/* Gradient header band */}
      <div style={{
        position: 'relative',
        padding: '18px 18px 20px',
        background: headerBg,
        color: '#ffffff',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-50px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '120px', height: '120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '12px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <CourseIconBadge
              type={course.courseIconType || course.icon}
              size={42}
              iconSize={21}
              radius={14}
              style={{
                background: 'rgba(255,255,255,0.24)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.32)',
              }}
            />
            {enrollmentBadge && (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase',
                padding: '4px 10px', borderRadius: '50px',
                background: 'rgba(255,255,255,0.22)',
                backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.30)',
                whiteSpace: 'nowrap',
              }}>
                {enrollmentBadge}
              </span>
            )}
          </div>
          {termLabel && (
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.92)', letterSpacing: '0.02em' }}>
              {termLabel}
            </span>
          )}
        </div>

        <div style={{ fontSize: '20px', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.01em', position: 'relative' }}>
          {course.name}
        </div>
        {course.description && (
          <div style={{
            fontSize: '12.5px', fontWeight: 500, color: 'rgba(255,255,255,0.88)',
            marginTop: '4px', position: 'relative', lineHeight: 1.45,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {course.description}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <TeacherIcon size={28} color={teacherAccent} />
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {course.teacherName || 'Mentor'}
          </span>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{
            fontSize: '11px', fontWeight: 600,
            color: expired ? 'var(--danger)' : accessDays !== null && accessDays <= 7 ? 'var(--warning)' : 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {accessDays !== null
              ? (expired ? 'Access expired' : `access ends in ${accessDays} day${accessDays === 1 ? '' : 's'}`)
              : 'Active enrollment'}
          </span>
        </div>

        {/* Mobile Course Feedback option */}
        {role === 'STUDENT' && !hasFeedback && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onGiveFeedback()
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '50px',
              border: 'none',
              background: 'var(--surface)',
              color: 'var(--warning)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '14px',
              boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontFamily: 'inherit',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Give Feedback
          </button>
        )}

        {/* Stat tiles: Topics · Lectures · Materials */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[
            { value: course._count?.topics ?? 0,    label: 'Topics' },
            { value: course._count?.lectures ?? 0,  label: 'Lectures' },
            { value: course._count?.materials ?? 0, label: 'Materials' },
          ].map(s => (
            <div
              key={s.label}
              style={{
                padding: '12px 8px',
                borderRadius: '12px',
                background: 'var(--surface-2)',
                boxShadow: '5px 5px 12px var(--neu-dark), -5px -5px 12px var(--neu-light)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '5px', letterSpacing: '0.04em' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  )
}

function EmptyState({ search }: { search: string }) {
  return (
    <div style={{
      padding: '40px 20px', textAlign: 'center',
      background: 'var(--surface)', borderRadius: '14px',
      border: '1px solid rgba(15, 23, 42, 0.05)',
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.6" style={{ marginBottom: '10px' }}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
        {search ? `No courses matching "${search}"` : 'No courses enrolled yet'}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        {search ? 'Try a different keyword.' : 'Enrolled courses will show up here.'}
      </div>
    </div>
  )
}
