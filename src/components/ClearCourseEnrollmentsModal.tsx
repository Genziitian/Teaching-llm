'use client'

import React, { useEffect, useState } from 'react'

const CONFIRM_PHRASE = 'REMOVE ALL ENROLLMENTS'

export interface ClearCourseEnrollmentsModalProps {
  open: boolean
  courseId: string
  courseName: string
  onClose: () => void
  onCleared: (result: { removedCount: number }) => void
}

type Step = 1 | 2 | 3

export default function ClearCourseEnrollmentsModal({
  open,
  courseId,
  courseName,
  onClose,
  onCleared,
}: ClearCourseEnrollmentsModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [count, setCount] = useState<number | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [typedPhrase, setTypedPhrase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setCount(null)
    setExporting(false)
    setExported(false)
    setTypedName('')
    setTypedPhrase('')
    setSubmitting(false)
    setError(null)

    let cancelled = false
    ;(async () => {
      setLoadingMeta(true)
      try {
        const res = await fetch(`/api/courses/${courseId}/enrollments`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to load enrollment count')
        if (!cancelled) setCount(typeof data.count === 'number' ? data.count : 0)
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load enrollment count')
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, courseId])

  if (!open) return null

  const nameMatched = typedName.trim().toLowerCase() === courseName.trim().toLowerCase()
  const phraseMatched = typedPhrase.trim().toUpperCase() === CONFIRM_PHRASE
  const canSubmitStep3 = nameMatched && phraseMatched && !submitting && (count ?? 0) > 0

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/enrollments/export`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to export enrollments')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] || `course-enrollments-${courseId}.csv`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setExported(true)
    } catch (err: any) {
      setError(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function handleFinalClear() {
    if (!canSubmitStep3) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/enrollments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmCourseName: typedName.trim(),
          confirmPhrase: typedPhrase.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to clear enrollments')
      onCleared({ removedCount: data.removedCount ?? 0 })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to clear enrollments')
    } finally {
      setSubmitting(false)
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '520px',
    background: '#ffffff',
    borderRadius: '24px',
    border: '2.5px solid #0f172a',
    boxShadow: '8px 8px 0px #0f172a',
    padding: '28px 30px',
    color: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxHeight: '90vh',
    overflowY: 'auto',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 16px',
    fontSize: '15px',
    fontWeight: 700,
    borderRadius: '14px',
    border: '2px solid #0f172a',
    outline: 'none',
    background: '#ffffff',
    color: '#0f172a',
  }

  const primaryBtn = (enabled: boolean, danger = false): React.CSSProperties => ({
    padding: '14px',
    borderRadius: '14px',
    border: enabled ? '2px solid #0f172a' : 'none',
    background: enabled ? (danger ? '#ef4444' : '#0f172a') : '#e2e8f0',
    color: enabled ? '#ffffff' : '#94a3b8',
    fontSize: '14px',
    fontWeight: 800,
    cursor: enabled ? 'pointer' : 'not-allowed',
    boxShadow: enabled ? '3px 3px 0px #0f172a' : 'none',
  })

  const ghostBtn: React.CSSProperties = {
    padding: '14px',
    borderRadius: '14px',
    border: '2px solid #0f172a',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '3px 3px 0px #0f172a',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>
              Confirmation {step} of 3
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
              Remove all enrolled students
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 6 }}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {([1, 2, 3] as Step[]).map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 999,
                background: s <= step ? '#ef4444' : '#e2e8f0',
              }}
            />
          ))}
        </div>

        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#475569', fontWeight: 500 }}>
          Course: <strong style={{ color: '#0f172a' }}>{courseName}</strong>
          {count !== null && (
            <>
              {' '}
              · <strong style={{ color: '#0f172a' }}>{count}</strong> enrolled student{count === 1 ? '' : 's'}
            </>
          )}
        </p>

        {error && (
          <div
            style={{
              background: '#fff1f2',
              border: '1.5px solid #fecdd3',
              borderRadius: 14,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 700,
              color: '#e11d48',
            }}
          >
            {error}
          </div>
        )}

        {step === 1 && (
          <>
            <div
              style={{
                background: '#fff7ed',
                border: '1.5px solid #fed7aa',
                borderRadius: 14,
                padding: '12px 16px',
                fontSize: 13,
                lineHeight: 1.5,
                color: '#9a3412',
                fontWeight: 600,
              }}
            >
              This permanently removes every student&apos;s access to this course. The course itself stays.
              Export a CSV backup first if you may need this list later.
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loadingMeta || count === 0}
              style={{
                ...ghostBtn,
                opacity: exporting || loadingMeta || count === 0 ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {exporting ? 'Exporting…' : exported ? 'Download CSV again' : 'Export enrollment CSV (backup)'}
            </button>

            {exported && (
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#15803d' }}>
                Backup downloaded. You can continue.
              </p>
            )}

            {count === 0 && !loadingMeta && (
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#64748b' }}>
                No enrollments on this course — nothing to remove.
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
              <button type="button" onClick={onClose} style={ghostBtn}>
                Cancel
              </button>
              <button
                type="button"
                disabled={loadingMeta || count === 0}
                onClick={() => setStep(2)}
                style={primaryBtn(!loadingMeta && (count ?? 0) > 0, true)}
              >
                {exported ? 'Continue' : 'Continue without export'}
              </button>
            </div>
            {!exported && (count ?? 0) > 0 && (
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                Export is recommended but not required.
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ margin: 0, fontSize: 14, color: '#475569', fontWeight: 500 }}>
              Second confirmation: type the course name exactly to continue.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: '#64748b', textTransform: 'uppercase' }}>
                Type <span style={{ color: '#0f172a' }}>&quot;{courseName}&quot;</span>
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={courseName}
                style={inputStyle}
                autoFocus
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button type="button" onClick={() => setStep(1)} style={ghostBtn}>
                Back
              </button>
              <button
                type="button"
                disabled={!nameMatched}
                onClick={() => setStep(3)}
                style={primaryBtn(nameMatched, true)}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div
              style={{
                background: '#fff1f2',
                border: '1.5px solid #fecdd3',
                borderRadius: 14,
                padding: '12px 16px',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  flexShrink: 0,
                  fontSize: 14,
                }}
              >
                !
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#e11d48', lineHeight: 1.45, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Final step. This cannot be undone. {count ?? 0} student{count === 1 ? '' : 's'} will lose access immediately.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: '#64748b', textTransform: 'uppercase' }}>
                Re-type course name <span style={{ color: '#0f172a' }}>&quot;{courseName}&quot;</span>
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={courseName}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: '#64748b', textTransform: 'uppercase' }}>
                Type <span style={{ color: '#0f172a' }}>&quot;{CONFIRM_PHRASE}&quot;</span>
              </label>
              <input
                type="text"
                value={typedPhrase}
                onChange={(e) => setTypedPhrase(e.target.value)}
                placeholder={CONFIRM_PHRASE.toLowerCase()}
                style={inputStyle}
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button type="button" onClick={() => setStep(2)} disabled={submitting} style={ghostBtn}>
                Back
              </button>
              <button
                type="button"
                disabled={!canSubmitStep3}
                onClick={handleFinalClear}
                style={primaryBtn(canSubmitStep3, true)}
              >
                {submitting ? 'Removing…' : 'Remove all students'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
