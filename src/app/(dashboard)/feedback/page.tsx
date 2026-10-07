'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import FeedbackModal from '@/components/FeedbackModal'
import ManagerUserModal from '@/components/ManagerUserModal'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface CourseItem {
  id: string
  name: string
  subject: string
  color: string
  requireFeedback?: boolean
}

interface FeedbackItem {
  id: string
  type: 'COURSE' | 'APP' | 'WEBSITE'
  studentId: string
  teacherRating: number
  conceptRating: number
  materialRating: number
  recommendScore: number
  comment: string
  createdAt: string
  student: { id: string; name: string; email: string; securityNumber?: string | null }
  course: { id: string; name: string }
}

export default function FeedbackPage() {
  const { data: userData } = useSWR('/api/auth/me', fetcher)
  const user = userData?.user
  const loadingFact = useLoadingFact(!user)

  if (!user) {
    return (
      <div className="page-container fade-in">
        {loadingFact && (
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <LoadingFactCard fact={loadingFact} />
          </div>
        )}
        <div className="card skeleton" style={{ height: '400px' }} />
      </div>
    )
  }

  if (user.role === 'MANAGER') {
    return <ManagerFeedbackView />
  }

  if ((user.role === 'ADMIN' || user.role === 'MODERATOR') || user.role === 'INSTRUCTOR') {
    return <AdminFeedbackView user={user} />
  }

  return <StudentFeedbackView userId={user.id} />
}

function StudentFeedbackView({ userId }: { userId: string }) {
  const router = useRouter()
  const { data: coursesRaw, isLoading } = useSWR('/api/courses', fetcher)
  const { data: submittedFeedbacksRaw, mutate: mutateFeedbacks } = useSWR('/api/feedback?studentId=' + userId, fetcher)

  // Safety: always ensure arrays — API may return an error object on 401
  const courses: CourseItem[] = Array.isArray(coursesRaw) ? coursesRaw : []
  const submittedFeedbacks: any[] = Array.isArray(submittedFeedbacksRaw) ? submittedFeedbacksRaw : []

  const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null)
  const [selectedCourseForEdit, setSelectedCourseForEdit] = useState<{ course: CourseItem; feedback: any } | null>(null)
  const [selectedPlatformFeedback, setSelectedPlatformFeedback] = useState<{ id?: string; type: 'APP' | 'WEBSITE'; rating: number; comment: string } | null>(null)

  const [isNativeApp, setIsNativeApp] = useState(false)
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

  const platformFeedbackObj = submittedFeedbacks.find(f => f.type === (isNativeApp ? 'APP' : 'WEBSITE'))
  const hasPlatformFeedback = !!platformFeedbackObj

  const isAlreadySubmitted = (courseId: string) => {
    return submittedFeedbacks.some(f => f.courseId === courseId)
  }

  if (isLoading) return <div className="page-container animate-pulse" />

  return (
    <div className="page-container fade-in" style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
      <style>{`
        .mobile-back-header {
          display: none !important;
        }
        @media (max-width: 767px) {
          .mobile-back-header {
            display: flex !important;
          }
        }
      `}</style>
      {/* Premium Neumorphic Page Header */}
      <div className="mobile-back-header" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '28px',
        justifyContent: 'flex-start'
      }}>
        <button
          onClick={() => router.back()}
          aria-label="Go Back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--surface)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 900,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            fontFamily: "'Outfit', 'Nunito', sans-serif"
          }}>
            Feedback
          </h1>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            margin: '3px 0 0',
            fontFamily: "'Outfit', sans-serif"
          }}>
            Ratings &amp; student reviews
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* App / Website Feedback Card */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '24px',
            padding: '24px 28px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '12px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{
              fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              Platform Feedback
            </span>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              {isNativeApp ? 'App Feedback' : 'Website Feedback'}
            </h3>
          </div>

          <p style={{ fontSize: '14px', color: hasPlatformFeedback ? 'var(--success)' : 'var(--text-muted)', fontWeight: '600', margin: 0 }}>
            {hasPlatformFeedback ? '✓ Feedback submitted' : 'No feedback given yet'}
          </p>

          {hasPlatformFeedback && platformFeedbackObj && (
            <div style={{ width: '100%', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  Rating
                </span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill={s <= platformFeedbackObj.teacherRating ? '#fbbf24' : 'var(--surface-2)'}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>
              </div>
              {platformFeedbackObj.comment && (
                <div style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0, fontStyle: 'italic' }}>
                    "{platformFeedbackObj.comment}"
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => {
              setSelectedPlatformFeedback({
                id: platformFeedbackObj?.id,
                type: isNativeApp ? 'APP' : 'WEBSITE',
                rating: platformFeedbackObj?.teacherRating || 0,
                comment: platformFeedbackObj?.comment || '',
              })
            }}
            style={{
              background: '#0a0a0a',
              color: 'white',
              padding: '12px 28px',
              borderRadius: '50px',
              border: 'none',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'transform 0.2s ease',
              marginTop: '4px'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {hasPlatformFeedback ? 'Edit Review' : 'Share Feedback'}
          </button>
        </div>

        {courses.map(course => {
          const submitted = isAlreadySubmitted(course.id)
          const feedbackObj = submittedFeedbacks.find(f => f.courseId === course.id)
          return (
            <div
              key={course.id}
              style={{
                background: 'var(--surface)',
                borderRadius: '24px',
                padding: '24px 28px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '12px',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{
                  fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  {course.subject}
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{course.name}</h3>
              </div>

              <p style={{ fontSize: '14px', color: submitted ? 'var(--success)' : 'var(--text-muted)', fontWeight: '600', margin: 0 }}>
                {submitted ? '✓ Feedback submitted' : 'No feedback given yet'}
              </p>

              {submitted && feedbackObj && (
                <div style={{ width: '100%', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '4px' }}>
                    {[
                      { label: 'Teacher', val: feedbackObj.teacherRating },
                      { label: 'Concept', val: feedbackObj.conceptRating },
                      { label: 'Materials', val: feedbackObj.materialRating },
                      { label: 'Recommend', val: feedbackObj.recommendScore },
                    ].map(r => (
                      <div key={r.label}>
                        <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                          {r.label}
                        </span>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {[1,2,3,4,5].map(s => (
                            <svg key={s} width="11" height="11" viewBox="0 0 24 24" fill={s <= r.val ? '#fbbf24' : 'var(--surface-2)'}>
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {feedbackObj.comment && (
                    <div style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0, fontStyle: 'italic' }}>
                        "{feedbackObj.comment}"
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedCourseForEdit({ course, feedback: feedbackObj })}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      padding: '8px 16px',
                      borderRadius: '50px',
                      fontWeight: '700',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      alignSelf: 'flex-start',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    Edit Feedback
                  </button>
                </div>
              )}

              {!submitted && (
                <button
                  onClick={() => setSelectedCourse(course)}
                  style={{
                    background: '#0a0a0a',
                    color: 'white',
                    padding: '12px 28px',
                    borderRadius: '50px',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease',
                    marginTop: '4px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  Share Feedback
                </button>
              )}
            </div>
          )
        })}

        {courses.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <p>You are not enrolled in any courses yet.</p>
          </div>
        )}
      </div>

      {selectedCourse && (
        <FeedbackModal
          courseId={selectedCourse.id}
          courseName={selectedCourse.name}
          courseSubject={selectedCourse.subject}
          onClose={() => setSelectedCourse(null)}
          onSuccess={() => {
            mutateFeedbacks()
          }}
        />
      )}

      {selectedCourseForEdit && (
        <FeedbackModal
          courseId={selectedCourseForEdit.course.id}
          courseName={selectedCourseForEdit.course.name}
          courseSubject={selectedCourseForEdit.course.subject}
          existingFeedback={{
            id: selectedCourseForEdit.feedback.id,
            teacherRating: selectedCourseForEdit.feedback.teacherRating,
            conceptRating: selectedCourseForEdit.feedback.conceptRating,
            materialRating: selectedCourseForEdit.feedback.materialRating,
            recommendScore: selectedCourseForEdit.feedback.recommendScore,
            comment: selectedCourseForEdit.feedback.comment,
          }}
          onClose={() => setSelectedCourseForEdit(null)}
          onSuccess={() => {
            mutateFeedbacks()
          }}
        />
      )}

      {selectedPlatformFeedback && (
        <AppFeedbackModal
          initialData={selectedPlatformFeedback}
          onClose={() => setSelectedPlatformFeedback(null)}
          onSuccess={() => {
            mutateFeedbacks()
          }}
        />
      )}
    </div>
  )
}

function ManagerFeedbackView() {
  const router = useRouter()
  const { data: feedbacksRaw, isLoading } = useSWR('/api/feedback', fetcher)
  const { data: coursesRaw, mutate: mutateCourses } = useSWR('/api/courses', fetcher)

  // Safety: always ensure arrays — API may return an error object on 401
  const feedbacks: FeedbackItem[] = Array.isArray(feedbacksRaw) ? feedbacksRaw : []
  const courses: CourseItem[] = Array.isArray(coursesRaw) ? coursesRaw : []

  const [filterCourse, setFilterCourse] = useState('')
  const [searchStudent, setSearchStudent] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showForceSettings, setShowForceSettings] = useState(false)

  const filtered = feedbacks.filter(f => {
    let matchCourse = true
    if (filterCourse === 'COURSE_ONLY') {
      matchCourse = f.course.id !== 'APP' && f.course.id !== 'WEB'
    } else if (filterCourse === 'APP') {
      matchCourse = f.course.id === 'APP'
    } else if (filterCourse === 'WEB') {
      matchCourse = f.course.id === 'WEB'
    } else if (filterCourse) {
      matchCourse = f.course.id === filterCourse
    }

    const matchStudent = !searchStudent || 
      f.student.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
      f.student.email.toLowerCase().includes(searchStudent.toLowerCase())
    return matchCourse && matchStudent
  })

  // Analytics calculation for Manager view
  const totalResponses = filtered.length
  let overallRating = 0
  let teacherAvg = 0
  let conceptAvg = 0
  let materialAvg = 0
  let recommendAvg = 0
  const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }

  if (totalResponses > 0) {
    let sumTeacher = 0
    let sumConcept = 0
    let sumMaterial = 0
    let sumRecommend = 0
    let sumAllRatings = 0

    filtered.forEach(f => {
      sumTeacher += f.teacherRating
      sumConcept += f.conceptRating
      sumMaterial += f.materialRating
      sumRecommend += f.recommendScore

      const avgForResponse = (f.teacherRating + f.conceptRating + f.materialRating + f.recommendScore) / 4
      sumAllRatings += avgForResponse

      const stars = Math.round(avgForResponse) as 5 | 4 | 3 | 2 | 1
      const clampedStars = Math.max(1, Math.min(5, stars)) as 5 | 4 | 3 | 2 | 1
      starCounts[clampedStars]++
    })

    overallRating = sumAllRatings / totalResponses
    teacherAvg = sumTeacher / totalResponses
    conceptAvg = sumConcept / totalResponses
    materialAvg = sumMaterial / totalResponses
    recommendAvg = sumRecommend / totalResponses
  }

  if (isLoading) return <div className="page-container animate-pulse" />

  return (
    <div className="page-container fade-in" style={{ padding: 'clamp(16px, 4vw, 32px)' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (min-width: 768px) {
          .feedback-mobile-header {
            display: none !important;
          }
        }
      `}} />
      {/* Premium Neumorphic Page Header */}
      <div className="feedback-mobile-header" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '28px',
        justifyContent: 'flex-start'
      }}>
        <button
          onClick={() => router.back()}
          aria-label="Go Back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--surface)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 900,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            fontFamily: "'Outfit', 'Nunito', sans-serif"
          }}>
            Feedback
          </h1>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            margin: '3px 0 0',
            fontFamily: "'Outfit', sans-serif"
          }}>
            Student reviews &amp; platform feedback
          </p>
        </div>
      </div>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <button
          onClick={() => setShowForceSettings(true)}
          style={{
            background: '#0a0a0a',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: '700',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'transform 0.1s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span>⚙️</span> Required Feedback
        </button>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <select 
              value={filterCourse}
              onChange={e => setFilterCourse(e.target.value)}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: '14px',
                color: 'var(--text-primary)',
                outline: 'none',
                appearance: 'none',
                minWidth: '200px',
              }}
            >
              <option value="">All Feedback</option>
              <option value="COURSE_ONLY">Course Feedback</option>
              <option value="APP">App Feedback</option>
              <option value="WEB">Website Feedback</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <input 
            type="text"
            placeholder="Search student..."
            value={searchStudent}
            onChange={e => setSearchStudent(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>
      </div>      {/* Analytics Card */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: '24px',
        padding: '24px',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          {/* Left panel: Overall Rating */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid var(--border)', paddingRight: '20px' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Overall Rating
            </span>
            <span style={{ fontSize: '42px', fontWeight: '950', color: 'var(--text-primary)', lineHeight: '1.0' }}>
              {totalResponses > 0 ? overallRating.toFixed(1) : '0.0'}
            </span>
            <span style={{ fontSize: '24px', color: '#fbbf24', margin: '4px 0' }}>★ ★ ★ ★ ★</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
              Based on {totalResponses} {totalResponses === 1 ? 'response' : 'responses'}
            </span>
          </div>

          {/* Right panel: Star Distribution Bar Chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = starCounts[star as 5|4|3|2|1] || 0
              const pct = totalResponses > 0 ? (count / totalResponses) * 100 : 0
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                  <div style={{ width: '40px', fontWeight: '800', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {star} <span style={{ color: '#fbbf24' }}>★</span>
                  </div>
                  <div style={{ flex: 1, height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                  </div>
                  <div style={{ width: '32px', textAlign: 'right', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {count}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Category Averages */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          {[
            { label: 'Teacher', val: teacherAvg },
            { label: 'Concept', val: conceptAvg },
            { label: 'Materials', val: materialAvg },
            { label: 'Recommend', val: recommendAvg },
          ].map(cat => (
            <div key={cat.label} style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
                {cat.label}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                {cat.val.toFixed(1)}
                <span style={{ color: '#fbbf24', fontSize: '12px' }}>★</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {filtered.map(f => {
          const isAppOrWeb = f.course.id === 'APP' || f.course.id === 'WEB'
          return (
            <div 
              key={f.id}
              style={{
                background: 'var(--surface)',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'flex-start' }}>
                <div>
                  <button
                    onClick={() => setSelectedUserId(f.studentId)}
                    title="View Student Profile"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--primary)',
                      fontWeight: '700',
                      fontSize: '16px',
                      marginBottom: '2px',
                      display: 'inline-block',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                  >
                    {f.student.name}
                  </button>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    ID: {(f.student as any).securityNumber || 'N/A'} • {f.student.email} • {new Date(f.createdAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div style={{ 
                  background: isAppOrWeb ? 'rgba(54,54,232,0.05)' : 'var(--surface)', 
                  padding: '6px 14px', borderRadius: '50px', 
                  fontSize: '12px', fontWeight: '700', 
                  color: f.course.id === 'APP' ? '#3636e8' : f.course.id === 'WEB' ? '#10b981' : 'var(--primary)', 
                  border: '1px solid var(--border)' 
                }}>
                  {f.course.name}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                {isAppOrWeb ? (
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Rating
                    </p>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {[1,2,3,4,5].map(s => (
                        <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill={s <= f.teacherRating ? '#fbbf24' : 'var(--surface-2)'}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      ))}
                    </div>
                  </div>
                ) : (
                  [
                    { label: 'Teacher', val: f.teacherRating },
                    { label: 'Concept', val: f.conceptRating },
                    { label: 'Materials', val: f.materialRating },
                    { label: 'Recommend', val: f.recommendScore },
                  ].map(r => (
                    <div key={r.label}>
                      <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{r.label}</p>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1,2,3,4,5].map(s => (
                          <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill={s <= r.val ? '#fbbf24' : 'var(--surface-2)'}>
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {f.comment && (
                <div style={{ padding: '14px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                    "{f.comment}"
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '16px', fontWeight: '500' }}>No feedback entries found.</p>
          </div>
        )}
      </div>

      {selectedUserId && (
        <ManagerUserModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} onUpdate={() => {}} />
      )}

      {showForceSettings && (
        <ForceFeedbackSettingsModal
          courses={courses}
          onClose={() => setShowForceSettings(false)}
          onMutate={mutateCourses}
        />
      )}
    </div>
  )
}

function ForceFeedbackSettingsModal({ 
  courses, 
  onClose, 
  onMutate 
}: { 
  courses: CourseItem[], 
  onClose: () => void, 
  onMutate: () => void 
}) {
  // Track toggled state per course (initialised from current DB values)
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    courses.forEach(c => { init[c.id] = !!c.requireFeedback })
    return init
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Courses whose toggle differs from the saved DB value
  const changedCourses = courses.filter(c => toggles[c.id] !== !!c.requireFeedback)

  const handleToggle = (courseId: string) => {
    setToggles(prev => ({ ...prev, [courseId]: !prev[courseId] }))
    setError('')
    setSuccess('')
  }

  const handleApplyAll = async () => {
    if (changedCourses.length === 0) return

    const names = changedCourses.map(c => c.name).join(', ')
    if (!window.confirm(`Are you sure you want to update feedback settings for: ${names}?`)) {
      return
    }

    setIsUpdating(true)
    setError('')
    setSuccess('')

    try {
      const results = await Promise.all(
        changedCourses.map(c =>
          fetch(`/api/courses/${c.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: c.name,
              subject: c.subject,
              color: c.color,
              requireFeedback: toggles[c.id]
            })
          })
        )
      )

      const failed = results.filter(r => !r.ok)
      if (failed.length > 0) {
        throw new Error(`Failed to update ${failed.length} course(s)`)
      }

      setSuccess(`Successfully updated ${changedCourses.length} course(s)!`)
      onMutate()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--surface)',
        width: '100%',
        maxWidth: '520px',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        border: '1px solid var(--border)',
        position: 'relative',
        fontFamily: "'Outfit', sans-serif",
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Forced Feedback Settings
        </h3>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.4' }}>
          Toggle courses below to require or disable forced extensive feedback. Students must submit feedback before accessing enabled courses.
        </p>

        {/* Scrollable course list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '16px',
          maxHeight: '340px',
          paddingRight: '4px',
        }}>
          {courses.map(c => {
            const isEnabled = toggles[c.id]
            const hasChanged = isEnabled !== !!c.requireFeedback
            return (
              <button
                key={c.id}
                onClick={() => handleToggle(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: hasChanged ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  background: hasChanged ? 'rgba(99, 102, 241, 0.04)' : 'var(--surface)',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                {/* Custom checkbox */}
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '6px',
                  border: isEnabled ? 'none' : '2px solid var(--border)',
                  background: isEnabled ? '#0a0a0a' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}>
                  {isEnabled && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {c.subject}
                  </div>
                </div>

                {/* Status indicator */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  flexShrink: 0,
                }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: isEnabled ? 'var(--success)' : 'var(--text-muted)',
                    opacity: 0.8,
                  }} />
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: isEnabled ? 'var(--success)' : 'var(--text-muted)',
                  }}>
                    {isEnabled ? 'ON' : 'OFF'}
                  </span>
                  {hasChanged && (
                    <span style={{
                      fontSize: '9px',
                      fontWeight: '800',
                      color: 'var(--primary)',
                      background: 'rgba(99, 102, 241, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      marginLeft: '4px',
                    }}>
                      CHANGED
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '13px', margin: '0 0 12px', fontWeight: '600' }}>
            ⚠️ {error}
          </p>
        )}

        {success && (
          <p style={{ color: 'var(--success)', fontSize: '13px', margin: '0 0 12px', fontWeight: '600' }}>
            ✓ {success}
          </p>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
            {changedCourses.length > 0 ? `${changedCourses.length} change(s) pending` : 'No changes'}
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '50px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            <button
              onClick={handleApplyAll}
              disabled={isUpdating || changedCourses.length === 0}
              style={{
                padding: '10px 20px',
                borderRadius: '50px',
                border: 'none',
                background: changedCourses.length === 0 ? 'var(--surface-2)' : '#0a0a0a',
                color: changedCourses.length === 0 ? 'var(--text-muted)' : 'white',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: changedCourses.length === 0 || isUpdating ? 'default' : 'pointer',
                opacity: isUpdating ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
            >
              {isUpdating ? 'Applying...' : `Apply${changedCourses.length > 0 ? ` (${changedCourses.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface AppFeedbackModalProps {
  initialData: { id?: string; type: 'APP' | 'WEBSITE'; rating: number; comment: string }
  onClose: () => void
  onSuccess: () => void
}

function AppFeedbackModal({ initialData, onClose, onSuccess }: AppFeedbackModalProps) {
  const [rating, setRating] = useState(initialData.rating)
  const [comment, setComment] = useState(initialData.comment)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const isEdit = !!initialData.id
      const url = '/api/feedback/app'
      const method = isEdit ? 'PUT' : 'POST'

      const body: any = {
        rating,
        comment,
      }

      if (isEdit) {
        body.id = initialData.id
      } else {
        body.platform = initialData.type === 'APP' ? 'APP' : 'WEB'
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit feedback')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--surface)',
        width: '100%',
        maxWidth: '450px',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        border: '1px solid var(--border)',
        position: 'relative',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
          {initialData.type === 'APP' ? 'App Review' : 'Website Review'}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Your review helps us improve the learning platform.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Rating</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: s <= rating ? '#fbbf24' : 'var(--surface-2)',
                    transition: 'transform 0.1s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill={s <= rating ? '#fbbf24' : 'none'} stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Comments</p>
            <textarea
              placeholder="Tell us what you liked or how we can improve..."
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 500))}
              style={{
                width: '100%',
                height: '100px',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
              }}
            />
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '12px', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '50px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                flex: 1.5,
                padding: '10px',
                borderRadius: '50px',
                border: 'none',
                background: '#0a0a0a',
                color: 'white',
                fontWeight: '700',
                cursor: 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminFeedbackView({ user }: { user: any }) {
  const router = useRouter()
  const enrolledCourses = (user?.enrollments || []).map((e: any) => e.course).filter(Boolean)
  const instructorCourses = (user?.instructorAssignments || []).map((a: any) => a.course).filter(Boolean)
  const assignedCoursesMap = new Map<string, any>()
  for (const c of [...enrolledCourses, ...instructorCourses]) {
    if (c?.id && !assignedCoursesMap.has(c.id)) {
      assignedCoursesMap.set(c.id, c)
    }
  }
  const assignedCourses = Array.from(assignedCoursesMap.values())
  
  const [selectedCourseId, setSelectedCourseId] = useState(assignedCourses[0]?.id || '')

  const { data: feedbacksRaw, isLoading } = useSWR(
    selectedCourseId ? `/api/feedback?courseId=${selectedCourseId}` : null,
    fetcher
  )

  const feedbacks: FeedbackItem[] = Array.isArray(feedbacksRaw) ? feedbacksRaw : []

  // Analytics calculation
  const totalResponses = feedbacks.length
  let overallRating = 0
  let teacherAvg = 0
  let conceptAvg = 0
  let materialAvg = 0
  let recommendAvg = 0
  const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }

  if (totalResponses > 0) {
    let sumTeacher = 0
    let sumConcept = 0
    let sumMaterial = 0
    let sumRecommend = 0
    let sumAllRatings = 0

    feedbacks.forEach(f => {
      sumTeacher += f.teacherRating
      sumConcept += f.conceptRating
      sumMaterial += f.materialRating
      sumRecommend += f.recommendScore

      const avgForResponse = (f.teacherRating + f.conceptRating + f.materialRating + f.recommendScore) / 4
      sumAllRatings += avgForResponse

      const stars = Math.round(avgForResponse) as 5 | 4 | 3 | 2 | 1
      const clampedStars = Math.max(1, Math.min(5, stars)) as 5 | 4 | 3 | 2 | 1
      starCounts[clampedStars]++
    })

    overallRating = sumAllRatings / totalResponses
    teacherAvg = sumTeacher / totalResponses
    conceptAvg = sumConcept / totalResponses
    materialAvg = sumMaterial / totalResponses
    recommendAvg = sumRecommend / totalResponses
  }

  const renderStars = (rating: number) => {
    return (
      <div style={{ display: 'flex', gap: '2px', color: '#fbbf24' }}>
        {[1, 2, 3, 4, 5].map(s => (
          <span key={s} style={{ fontSize: '15px' }}>
            {s <= rating ? '★' : '☆'}
          </span>
        ))}
      </div>
    )
  }

  if (assignedCourses.length === 0) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '18px', fontWeight: '600' }}>No Assigned Courses</p>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>You are not currently assigned to any courses. Please contact the manager.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container fade-in" style={{ padding: 'clamp(16px, 4vw, 32px)', maxWidth: '900px', margin: '0 auto' }}>
      {/* Mobile back header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <button
          onClick={() => router.back()}
          aria-label="Go Back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--surface)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--primary)'
            e.currentTarget.style.boxShadow = '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-secondary)'
            e.currentTarget.style.boxShadow = '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 900,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            fontFamily: "'Outfit', 'Nunito', sans-serif"
          }}>
            Feedback Dashboard
          </h1>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            margin: '3px 0 0',
            fontFamily: "'Outfit', sans-serif"
          }}>
            Anonymized student course evaluations
          </p>
        </div>
      </div>

      {/* Course Selector */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-secondary)' }}>
          Viewing feedback for:
        </span>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <select 
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            style={{
              padding: '8px 36px 8px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: '15px',
              fontWeight: '800',
              color: 'var(--primary)',
              outline: 'none',
              appearance: 'none',
              cursor: 'pointer',
              minWidth: '160px',
              boxShadow: '2px 2px 5px rgba(0,0,0,0.02)'
            }}
          >
            {assignedCourses.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
            ▼
          </div>
        </div>
      </div>

      {/* Analytics Card */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: '24px',
        padding: '24px',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          {/* Left panel: Overall Rating */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid var(--border)', paddingRight: '20px' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Overall Rating
            </span>
            <span style={{ fontSize: '42px', fontWeight: '950', color: 'var(--text-primary)', lineHeight: '1.0' }}>
              {totalResponses > 0 ? overallRating.toFixed(1) : '0.0'}
            </span>
            <span style={{ fontSize: '24px', color: '#fbbf24', margin: '4px 0' }}>★ ★ ★ ★ ★</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
              Based on {totalResponses} {totalResponses === 1 ? 'response' : 'responses'}
            </span>
          </div>

          {/* Right panel: Star Distribution Bar Chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = starCounts[star as 5|4|3|2|1] || 0
              const pct = totalResponses > 0 ? (count / totalResponses) * 100 : 0
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                  <div style={{ width: '40px', fontWeight: '800', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {star} <span style={{ color: '#fbbf24' }}>★</span>
                  </div>
                  <div style={{ flex: 1, height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                  </div>
                  <div style={{ width: '32px', textAlign: 'right', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {count}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Category Averages */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          {[
            { label: 'Teacher', val: teacherAvg },
            { label: 'Concept', val: conceptAvg },
            { label: 'Materials', val: materialAvg },
            { label: 'Recommend', val: recommendAvg },
          ].map(cat => (
            <div key={cat.label} style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
                {cat.label}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                {cat.val.toFixed(1)}
                <span style={{ color: '#fbbf24', fontSize: '12px' }}>★</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Individual Anonymized Feedback Cards */}
      <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.01em' }}>
        Individual Responses
      </h2>

      {isLoading ? (
        <div className="animate-pulse" style={{ display: 'grid', gap: '16px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '140px', background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)' }} />
          ))}
        </div>
      ) : feedbacks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '15px', fontWeight: '600' }}>No feedback submissions for this course yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {feedbacks.map((f: any) => (
            <div 
              key={f.id}
              style={{
                background: 'var(--surface)',
                borderRadius: '20px',
                padding: '20px',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    Student ID: {f.student?.securityNumber || 'ANONYMOUS'}
                  </span>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '600' }}>
                    {new Date(f.createdAt).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>

              {/* Star Ratings */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Teacher', val: f.teacherRating },
                  { label: 'Concept', val: f.conceptRating },
                  { label: 'Materials', val: f.materialRating },
                  { label: 'Recommend', val: f.recommendScore },
                ].map(r => (
                  <div key={r.label}>
                    <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.05em' }}>
                      {r.label}
                    </p>
                    {renderStars(r.val)}
                  </div>
                ))}
              </div>

              {f.comment && (
                <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: '12px', border: '1px solid var(--border)', fontStyle: 'italic' }}>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                    "{f.comment}"
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

