'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface FeedbackModalProps {
  courseId: string
  courseName: string
  courseSubject: string
  onClose: () => void
  onSuccess: () => void
  isForced?: boolean
  existingFeedback?: {
    id: string
    teacherRating: number
    conceptRating: number
    materialRating: number
    recommendScore: number
    comment: string | null
  }
}

const CATEGORIES = [
  { id: 'teacherRating', label: 'Teacher Quality' },
  { id: 'conceptRating', label: 'Concept Quality' },
  { id: 'materialRating', label: 'Study Materials Quality' },
  { id: 'recommendScore', label: 'Recommendation Score' },
]

export default function FeedbackModal({ courseId, courseName, courseSubject, onClose, onSuccess, isForced = false, existingFeedback }: FeedbackModalProps) {
  const router = useRouter()
  const [ratings, setRatings] = useState<Record<string, number>>({
    teacherRating: existingFeedback?.teacherRating || 0,
    conceptRating: existingFeedback?.conceptRating || 0,
    materialRating: existingFeedback?.materialRating || 0,
    recommendScore: existingFeedback?.recommendScore || 0,
  })

  const [cancelClicked, setCancelClicked] = useState(false)
  const [helpClicked, setHelpClicked] = useState(false)

  const handleCancelClick = () => {
    if (isForced) {
      setCancelClicked(true)
      setError("Please fill these first and submit.")
    } else {
      onClose()
    }
  }

  const handleHelpClick = () => {
    if (isForced) {
      setHelpClicked(true)
      setError("Please fill these first and submit.")
    } else {
      router.push('/support')
    }
  }

  const [isCapacitor, setIsCapacitor] = useState<boolean>(false)

  useEffect(() => {
    const check = () => {
      const hasClass = document.documentElement.classList.contains('is-native')
      const hasWindow = !!(window as any).Capacitor?.isNativePlatform?.()
      if (hasClass || hasWindow) {
        setIsCapacitor(true)
        return true
      }
      return false
    }

    if (check()) return

    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        setIsCapacitor(true)
      }
    }).catch(() => {})

    const intervalId = setInterval(() => {
      if (check()) {
        clearInterval(intervalId)
      }
    }, 100)

    const timeoutId = setTimeout(() => {
      clearInterval(intervalId)
    }, 2000)

    return () => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }
  }, [])
  const [comment, setComment] = useState(existingFeedback?.comment || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleRate = (catId: string, value: number) => {
    setRatings(prev => ({ ...prev, [catId]: value }))
  }

  const handleSubmit = async () => {
    // Validation
    const missing = CATEGORIES.find(c => ratings[c.id] === 0)
    if (missing) {
      setError(`Please rate "${missing.label}"`)
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const isEdit = !!existingFeedback
      const body: any = {
        courseId,
        ...ratings,
        comment,
      }
      if (isEdit) {
        body.id = existingFeedback.id
      }
      const res = await fetch('/api/feedback', {
        method: isEdit ? 'PUT' : 'POST',
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
      background: isForced ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
      backdropFilter: isForced ? 'blur(12px)' : 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: 'clamp(12px, 3vw, 20px)',
    }}>
      <div
        className={`fade-in feedback-modal-box ${isCapacitor ? 'capacitor-mode' : ''}`}
        style={{
          background: 'var(--surface)',
          width: '100%',
          maxWidth: 'min(800px, calc(100vw - 24px))',
          borderRadius: 'clamp(20px, 4vw, 32px)',
          padding: 'clamp(20px, 5vw, 40px)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.12)',
          position: 'relative',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
        }}
      >
        {/* Close Button */}
        {!isForced && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'var(--surface)',
              border: 'none',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              zIndex: 5,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}

        <h2 style={{ fontSize: 'clamp(20px, 5.4vw, 26px)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', paddingRight: '48px', lineHeight: 1.2 }}>
          Feedback for {courseName}
        </h2>
        <p style={{ fontSize: 'clamp(13px, 3.4vw, 15px)', color: 'var(--text-secondary)', marginBottom: 'clamp(20px, 5vw, 32px)' }}>
          {courseSubject}
        </p>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'clamp(20px, 5vw, 32px)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
            gap: 'clamp(20px, 5vw, 32px) clamp(24px, 6vw, 48px)',
            marginBottom: 'clamp(20px, 5vw, 32px)',
          }}>
            {CATEGORIES.map(cat => (
              <div key={cat.id}>
                <p style={{ fontSize: 'clamp(13px, 3.6vw, 15px)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>{cat.label}</p>
                <div className="feedback-stars" style={{ display: 'flex', gap: 'clamp(6px, 2vw, 10px)' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => handleRate(cat.id, star)}
                      aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: ratings[cat.id] >= star ? '#fbbf24' : 'var(--surface-2)',
                        transition: 'transform 0.1s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <svg
                        className="feedback-star-svg"
                        width={isCapacitor ? "42" : "34"}
                        height={isCapacitor ? "42" : "34"}
                        viewBox="0 0 24 24"
                        fill={ratings[cat.id] >= star ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Additional Comments</p>
            <textarea
              placeholder="Tell us more about your experience..."
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 500))}
              style={{
                width: '100%',
                height: '120px',
                padding: '20px',
                borderRadius: '14px',
                border: '2px solid var(--border)',
                fontSize: '15px',
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                transition: 'all 0.2s ease',
                background: 'var(--bg)',
                color: 'var(--text-primary)',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.background = 'var(--surface-2)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--bg)'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{comment.length}/500</span>
            </div>
          </div>
        </div>

        <div style={{ 
          marginTop: '24px', 
          padding: '16px', 
          background: 'var(--surface)', 
          borderRadius: '12px',
          border: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
            → Your feedback is completely private. Teachers cannot see your feedback or ratings.
          </p>
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '16px', fontWeight: '600' }}>{error}</p>
        )}

        <div className="feedback-modal-footer" style={{ display: 'flex', gap: '10px', marginTop: 'clamp(20px, 5vw, 32px)', flexWrap: 'wrap' }}>
          <button
            onClick={handleHelpClick}
            disabled={isForced && helpClicked}
            style={{
              flex: '1 1 140px',
              padding: '14px',
              borderRadius: '50px',
              border: 'none',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: (isForced && helpClicked) ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: (isForced && helpClicked) ? 0.4 : 1,
              pointerEvents: (isForced && helpClicked) ? 'none' : 'auto',
            }}
          >
            Need More Help?
          </button>
          <div className="feedback-modal-footer-actions" style={{ display: 'flex', gap: '10px', flex: '2 1 220px' }}>
            <button
              onClick={handleCancelClick}
              disabled={isForced && cancelClicked}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '50px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '13.5px',
                cursor: (isForced && cancelClicked) ? 'default' : 'pointer',
                opacity: (isForced && cancelClicked) ? 0.4 : 1,
                pointerEvents: (isForced && cancelClicked) ? 'none' : 'auto',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                flex: 1.6,
                padding: '14px',
                borderRadius: '50px',
                border: 'none',
                background: '#0a0a0a',
                color: 'white',
                fontWeight: 600,
                fontSize: '13.5px',
                cursor: 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>

        <style>{`
          @media (max-width: 600px) {
            .feedback-modal-box {
              padding: 16px 14px !important;
              border-radius: 20px !important;
              max-height: calc(100dvh - 24px) !important;
            }
            .feedback-modal-box h2 {
              font-size: 18px !important;
              margin-bottom: 4px !important;
            }
            .feedback-modal-box p {
              margin-bottom: 16px !important;
            }
            .feedback-modal-box:not(.capacitor-mode) .feedback-stars svg {
              width: 26px !important;
              height: 26px !important;
            }
            .feedback-modal-box textarea {
              height: 80px !important;
              padding: 12px !important;
              border-radius: 14px !important;
            }
            .feedback-modal-footer {
              margin-top: 16px !important;
              gap: 8px !important;
            }
            .feedback-modal-footer button {
              padding: 11px 14px !important;
              font-size: 12.5px !important;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
