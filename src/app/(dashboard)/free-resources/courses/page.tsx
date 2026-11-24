'use client'

import { useState } from 'react'
import ShareLinkModal, { ShareIcon } from '@/components/ShareLinkModal'
import useSWR, { mutate } from 'swr'
import { CourseIconBadge } from '@/lib/course-icons'
import UserAvatar from '@/components/UserAvatar'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

export default function FreeCoursesPage() {
  const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
  const { data: courses, isLoading, mutate: mutateFreeCourses } = useSWR<any[]>('/api/free-resources/courses', fetcher)
  const loadingFact = useLoadingFact(isLoading)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [shareCourse, setShareCourse] = useState<{ id: string; name: string } | null>(null)

  const handleEnroll = async (courseId: string, currentlyEnrolled: boolean) => {
    setLoadingId(courseId)
    const nextEnrolledState = !currentlyEnrolled

    // Optimistic UI update: flip the button instantly, and do NOT revalidate
    // right now (a refetch here can return stale data and revert the flip).
    const setEnrolled = (value: boolean) =>
      mutateFreeCourses(
        (current?: any[]) =>
          (current || []).map((c: any) => (c.id === courseId ? { ...c, isEnrolled: value } : c)),
        { revalidate: false }
      )
    setEnrolled(nextEnrolledState)

    try {
      if (currentlyEnrolled) {
        // Unenroll
        const res = await fetch(`/api/free-resources/enroll?courseId=${courseId}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Failed to unenroll')
      } else {
        // Enroll
        const res = await fetch('/api/free-resources/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId }),
        })
        if (!res.ok) throw new Error('Failed to enroll')
      }

      // Server confirmed: keep the optimistic state. Refresh other pages' caches only.
      mutate('/api/courses')
      mutate('/api/auth/me')
      mutate('/api/dashboard')
    } catch (error) {
      console.error(error)
      alert('Error updating enrollment status.')
      setEnrolled(currentlyEnrolled)
    } finally {
      setLoadingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="gz-page fade-in">
        {loadingFact && (
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <LoadingFactCard fact={loadingFact} />
          </div>
        )}
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Free Courses...</div>
      </div>
    )
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="page-container fade-in">
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No free courses available at the moment.
        </div>
      </div>
    )
  }

  return (
    <div className="gz-page fade-in">
      <div className="gz-cc-grid">
        {courses.map(course => {
          const tint = course.color && /^#/.test(course.color) ? course.color : 'var(--gz-ink)'
          return (
            <div key={course.id} className="gz-cc">
              <div className="gz-cc__banner" style={{ background: `color-mix(in srgb, ${tint} 12%, var(--gz-shell))` }}>
                <span className="gz-cc__pill">Free</span>
                <CourseIconBadge
                  type={course.courseIconType || course.icon}
                  size={52}
                  iconSize={26}
                  radius="14px"
                  style={{ background: 'var(--gz-panel)', color: tint, border: '1px solid var(--gz-line)', boxShadow: 'none' }}
                />
              </div>
              <div className="gz-cc__body">
                <div className="gz-cc__name">{course.name}</div>
                <div className="gz-cc__meta">
                  {course.subject && <span className="gz-cc__tag" style={{ color: tint, background: `color-mix(in srgb, ${tint} 10%, transparent)` }}>{course.subject}</span>}
                  {course.teacherName && (
                    <span className="gz-cc__who"><UserAvatar user={{ name: course.teacherName }} size={20} />{course.teacherName}</span>
                  )}
                </div>
                <div className="gz-cc__stats">
                  <div><b>{course._count?.topics || 0}</b><span>Topics</span></div>
                  <div><b>{course._count?.lectures || 0}</b><span>Lectures</span></div>
                  <div><b>{course._count?.materials || 0}</b><span>Materials</span></div>
                </div>
                <div className="gz-cc__actions">
                  <button className="gz-btn gz-btn--ghost gz-btn--icon" title="Share" aria-label="Share course" onClick={() => setShareCourse({ id: course.id, name: course.name })}>
                    <ShareIcon size={16} />
                  </button>
                  {course.isEnrolled ? (
                    <>
                      <button disabled={loadingId === course.id} className="gz-btn" style={{ flex: 1 }} onClick={() => { window.location.href = `/courses/${course.id}` }}>
                        Open Course
                      </button>
                      <button disabled={loadingId === course.id} className="gz-btn gz-btn--ghost gz-btn--icon gz-cc__x" title="Unenroll" aria-label="Unenroll" onClick={() => handleEnroll(course.id, true)}>
                        {loadingId === course.id ? '…' : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        )}
                      </button>
                    </>
                  ) : (
                    <button disabled={loadingId === course.id} className="gz-btn" style={{ flex: 1 }} onClick={() => handleEnroll(course.id, false)}>
                      {loadingId === course.id ? 'Enrolling…' : 'Enroll for Free'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <ShareLinkModal
        open={!!shareCourse}
        onClose={() => setShareCourse(null)}
        title={shareCourse?.name || ''}
        message={`Check out this free course on GenZ IITIAN: ${shareCourse?.name || ''}`}
        url={shareCourse ? `https://class.genziitian.in/free-resources/courses?course=${shareCourse.id}` : ''}
      />
    </div>
  )
}
