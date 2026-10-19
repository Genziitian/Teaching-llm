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
      <div className="page-container fade-in">
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
    <div className="page-container fade-in">


      <div className="grid-3" style={{ marginTop: '24px' }}>
        {courses.map(course => (
          <div
            key={course.id}
            style={{
              background: 'var(--surface-2)',
              borderRadius: '28px',
              boxShadow: '8px 8px 16px var(--neu-dark), -8px -8px 16px var(--neu-light)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
            }}
          >
            {/* Gradient Banner */}
            <div style={{
              height: '100px',
              background: `linear-gradient(135deg, ${course.color || 'var(--accent)'}ee, ${course.color || 'var(--accent)'}99)`,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ position: 'absolute', width: '130px', height: '130px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', top: '-50px', right: '-30px' }} />
              <div style={{ position: 'absolute', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', bottom: '-20px', left: '24px' }} />
              <CourseIconBadge
                type={course.courseIconType || course.icon}
                size={58}
                iconSize={28}
                radius="50%"
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.28)',
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 1,
                }}
              />
            </div>

            {/* Card Body */}
            <div style={{ padding: '18px 20px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                marginBottom: '4px',
                lineHeight: '1.3',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {course.name}
              </h3>

              {course.subject && (
                <span style={{
                  display: 'inline-block',
                  padding: '3px 12px',
                  borderRadius: '50px',
                  background: (course.color || 'var(--accent)') + '18',
                  color: (course.color || 'var(--accent)'),
                  fontSize: '12px',
                  fontWeight: '700',
                  marginBottom: '8px',
                  letterSpacing: '0.02em',
                  width: 'fit-content',
                }}>
                  {course.subject}
                </span>
              )}

              {course.teacherName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                  <UserAvatar user={{ name: course.teacherName }} size={24} />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: '500' }}>
                    {course.teacherName}
                  </span>
                </div>
              )}

              {/* Stats row */}
              <div style={{
                display: 'flex',
                gap: '10px',
                paddingTop: '12px',
                borderTop: '1.5px solid rgba(0,0,0,0.06)',
                marginTop: 'auto',
                marginBottom: '16px'
              }}>
                <div style={{
                  flex: 1, padding: '8px 10px', borderRadius: '14px',
                  background: 'var(--surface-2)', boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>{course._count?.topics || 0}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Topics</div>
                </div>
                <div style={{
                  flex: 1, padding: '8px 10px', borderRadius: '14px',
                  background: 'var(--surface-2)', boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>{course._count?.lectures || 0}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Lectures</div>
                </div>
                <div style={{
                  flex: 1, padding: '8px 10px', borderRadius: '14px',
                  background: 'var(--surface-2)', boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>{course._count?.materials || 0}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Materials</div>
                </div>
              </div>

              {/* Managing Tools */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-ghost"
                  title="Share"
                  aria-label="Share course"
                  onClick={() => setShareCourse({ id: course.id, name: course.name })}
                  style={{ padding: '0 14px', borderRadius: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', height: 'auto', color: 'var(--accent)' }}
                >
                  <ShareIcon size={18} />
                </button>
                {course.isEnrolled ? (
                  <>
                    <button 
                      disabled={loadingId === course.id}
                      className="btn" 
                      style={{ flex: 1, background: 'var(--success)', color: 'white', border: 'none', borderRadius: '50px', fontWeight: '700', padding: '12px 20px', fontSize: '14.5px', minHeight: '44px', height: 'auto' }}
                      onClick={() => { window.location.href = `/courses/${course.id}` }}
                    >
                      Open Course
                    </button>
                    <button 
                      disabled={loadingId === course.id}
                      className="btn btn-ghost" 
                      title="Unenroll"
                      onClick={() => handleEnroll(course.id, true)}
                      style={{ padding: '0 16px', color: 'var(--danger)', borderColor: 'var(--danger-light)', borderRadius: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', height: 'auto' }}
                    >
                      {loadingId === course.id ? '...' : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      )}
                    </button>
                  </>
                ) : (
                  <button 
                    disabled={loadingId === course.id}
                    className="btn btn-primary" 
                    style={{ flex: 1, borderRadius: '50px', fontWeight: '700', background: 'var(--primary)', border: 'none', padding: '12px 20px', fontSize: '14.5px', minHeight: '44px', height: 'auto' }}
                    onClick={() => handleEnroll(course.id, false)}
                  >
                    {loadingId === course.id ? 'Enrolling...' : 'Enroll for Free'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
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
