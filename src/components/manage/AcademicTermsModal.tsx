'use client'

import React, { useState, useEffect } from 'react'

interface ExamCycleDate {
  startDate?: string
  endDate?: string
}

interface TermConfig {
  id: string
  name: string
  termKey: 'JAN' | 'MAY' | 'SEP'
  year: number
  startDate: string
  endDate: string
  isCurrent?: boolean
  examCycles: {
    QUIZ_1: ExamCycleDate
    QUIZ_2: ExamCycleDate
    END_TERM: ExamCycleDate
  }
}

interface AcademicTermsModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdated?: () => void
}

export default function AcademicTermsModal({ isOpen, onClose, onUpdated }: AcademicTermsModalProps) {
  const [terms, setTerms] = useState<TermConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingTerm, setEditingTerm] = useState<TermConfig | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadTerms()
    }
  }, [isOpen])

  async function loadTerms() {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/manage/academic-terms')
      const data = await res.json()
      if (data.success && Array.isArray(data.terms)) {
        setTerms(data.terms)
      }
    } catch (e) {
      console.error(e)
      setErrorMsg('Failed to load academic terms')
    } finally {
      setLoading(false)
    }
  }

  function handleStartAdd() {
    setIsNew(true)
    const currentYear = new Date().getFullYear()
    setEditingTerm({
      id: `JAN-${currentYear}`,
      name: `January ${currentYear} Term`,
      termKey: 'JAN',
      year: currentYear,
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-04-30`,
      isCurrent: false,
      examCycles: {
        QUIZ_1: { startDate: `${currentYear}-01-10`, endDate: `${currentYear}-02-15` },
        QUIZ_2: { startDate: `${currentYear}-02-16`, endDate: `${currentYear}-03-22` },
        END_TERM: { startDate: `${currentYear}-03-23`, endDate: `${currentYear}-04-30` },
      },
    })
  }

  function handleStartEdit(term: TermConfig) {
    setIsNew(false)
    setEditingTerm(JSON.parse(JSON.stringify(term)))
  }

  async function handleSaveEditing() {
    if (!editingTerm) return
    setSaving(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/manage/academic-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTerm),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save term')
      }
      setEditingTerm(null)
      setIsNew(false)
      await loadTerms()
      if (onUpdated) onUpdated()
    } catch (e: any) {
      setErrorMsg(e.message || 'Error saving term')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(termId: string) {
    if (!confirm('Are you sure you want to delete this term configuration?')) return
    try {
      const res = await fetch(`/api/manage/academic-terms?id=${termId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        loadTerms()
        if (onUpdated) onUpdated()
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface, #1e1e2d)',
          color: 'var(--text-primary, #ffffff)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          border: '1px solid var(--border, #2e2e42)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border, #2e2e42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
              Academic Terms & Exam Cycles
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted, #9999b0)' }}>
              Configure start dates, end dates, and exam stages for each academic trimester.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #9999b0)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              {errorMsg}
            </div>
          )}

          {editingTerm ? (
            /* Editing / Creating View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                  {isNew ? 'Create New Academic Term' : `Edit ${editingTerm.name}`}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingTerm(null)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border, #2e2e42)',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--text-secondary, #cccccc)',
                    cursor: 'pointer',
                  }}
                >
                  Back to List
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Term Trimester
                  </label>
                  <select
                    value={editingTerm.termKey}
                    onChange={(e) => {
                      const key = e.target.value as 'JAN' | 'MAY' | 'SEP'
                      const name = `${key === 'JAN' ? 'January' : key === 'MAY' ? 'May' : 'September'} ${editingTerm.year} Term`
                      setEditingTerm({ ...editingTerm, termKey: key, id: `${key}-${editingTerm.year}`, name })
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--surface-2, #28283c)',
                      border: '1px solid var(--border, #3b3b54)',
                      color: '#fff',
                      fontSize: '13px',
                    }}
                  >
                    <option value="JAN">January Term</option>
                    <option value="MAY">May Term</option>
                    <option value="SEP">September Term</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Academic Year
                  </label>
                  <input
                    type="number"
                    value={editingTerm.year}
                    onChange={(e) => {
                      const year = Number(e.target.value) || 2026
                      const name = `${editingTerm.termKey === 'JAN' ? 'January' : editingTerm.termKey === 'MAY' ? 'May' : 'September'} ${year} Term`
                      setEditingTerm({ ...editingTerm, year, id: `${editingTerm.termKey}-${year}`, name })
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--surface-2, #28283c)',
                      border: '1px solid var(--border, #3b3b54)',
                      color: '#fff',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              {/* Term Dates */}
              <div style={{ background: 'var(--surface-2, #252538)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border, #36364e)' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Term Start & End Dates
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Term Starts</label>
                    <input
                      type="date"
                      value={editingTerm.startDate || ''}
                      onChange={(e) => setEditingTerm({ ...editingTerm, startDate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--surface, #1e1e2d)',
                        border: '1px solid var(--border, #3b3b54)',
                        color: '#fff',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Term Ends</label>
                    <input
                      type="date"
                      value={editingTerm.endDate || ''}
                      onChange={(e) => setEditingTerm({ ...editingTerm, endDate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--surface, #1e1e2d)',
                        border: '1px solid var(--border, #3b3b54)',
                        color: '#fff',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Exam Cycles */}
              <div style={{ background: 'var(--surface-2, #252538)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border, #36364e)' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Exam Stage Start & End Dates
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Quiz 1 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa' }}>Quiz 1</span>
                    <input
                      type="date"
                      value={editingTerm.examCycles?.QUIZ_1?.startDate || ''}
                      onChange={(e) => setEditingTerm({
                        ...editingTerm,
                        examCycles: {
                          ...editingTerm.examCycles,
                          QUIZ_1: { ...editingTerm.examCycles?.QUIZ_1, startDate: e.target.value },
                        },
                      })}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'var(--surface, #1e1e2d)',
                        border: '1px solid var(--border, #3b3b54)',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <input
                      type="date"
                      value={editingTerm.examCycles?.QUIZ_1?.endDate || ''}
                      onChange={(e) => setEditingTerm({
                        ...editingTerm,
                        examCycles: {
                          ...editingTerm.examCycles,
                          QUIZ_1: { ...editingTerm.examCycles?.QUIZ_1, endDate: e.target.value },
                        },
                      })}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'var(--surface, #1e1e2d)',
                        border: '1px solid var(--border, #3b3b54)',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                  </div>

                  {/* Quiz 2 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399' }}>Quiz 2</span>
                    <input
                      type="date"
                      value={editingTerm.examCycles?.QUIZ_2?.startDate || ''}
                      onChange={(e) => setEditingTerm({
                        ...editingTerm,
                        examCycles: {
                          ...editingTerm.examCycles,
                          QUIZ_2: { ...editingTerm.examCycles?.QUIZ_2, startDate: e.target.value },
                        },
                      })}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'var(--surface, #1e1e2d)',
                        border: '1px solid var(--border, #3b3b54)',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <input
                      type="date"
                      value={editingTerm.examCycles?.QUIZ_2?.endDate || ''}
                      onChange={(e) => setEditingTerm({
                        ...editingTerm,
                        examCycles: {
                          ...editingTerm.examCycles,
                          QUIZ_2: { ...editingTerm.examCycles?.QUIZ_2, endDate: e.target.value },
                        },
                      })}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'var(--surface, #1e1e2d)',
                        border: '1px solid var(--border, #3b3b54)',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                  </div>

                  {/* End Term */}
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24' }}>End Term</span>
                    <input
                      type="date"
                      value={editingTerm.examCycles?.END_TERM?.startDate || ''}
                      onChange={(e) => setEditingTerm({
                        ...editingTerm,
                        examCycles: {
                          ...editingTerm.examCycles,
                          END_TERM: { ...editingTerm.examCycles?.END_TERM, startDate: e.target.value },
                        },
                      })}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'var(--surface, #1e1e2d)',
                        border: '1px solid var(--border, #3b3b54)',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <input
                      type="date"
                      value={editingTerm.examCycles?.END_TERM?.endDate || ''}
                      onChange={(e) => setEditingTerm({
                        ...editingTerm,
                        examCycles: {
                          ...editingTerm.examCycles,
                          END_TERM: { ...editingTerm.examCycles?.END_TERM, endDate: e.target.value },
                        },
                      })}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'var(--surface, #1e1e2d)',
                        border: '1px solid var(--border, #3b3b54)',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Active / Current Term checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={Boolean(editingTerm.isCurrent)}
                  onChange={(e) => setEditingTerm({ ...editingTerm, isCurrent: e.target.checked })}
                />
                <span>Set as Currently Active Academic Term</span>
              </label>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingTerm(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #3b3b54)',
                    background: 'transparent',
                    color: 'var(--text-secondary, #ccc)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditing}
                  disabled={saving}
                  style={{
                    padding: '8px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#6366f1',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </div>
          ) : (
            /* Terms List View */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Configured Trimesters ({terms.length})
                </span>
                <button
                  type="button"
                  onClick={handleStartAdd}
                  style={{
                    background: '#6366f1',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Academic Term
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading terms...
                </div>
              ) : terms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No academic terms configured yet. Click "Add Academic Term" above to create one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {terms.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        background: 'var(--surface-2, #252538)',
                        border: '1px solid var(--border, #36364e)',
                        borderRadius: '12px',
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800 }}>{t.name}</span>
                          {t.isCurrent && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: '#dcfce7',
                                color: '#16a34a',
                                fontSize: '10px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                              }}
                            >
                              Current
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(t)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              background: 'transparent',
                              border: '1px solid var(--border, #454562)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Edit Dates
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t.id)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: 'transparent',
                              border: '1px solid #ef4444',
                              color: '#ef4444',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Term Duration: </span>
                          <span>{t.startDate} to {t.endDate}</span>
                        </div>
                        <div>
                          <span style={{ fontWeight: 700, color: '#a78bfa' }}>Quiz 1: </span>
                          <span>{t.examCycles?.QUIZ_1?.startDate || '--'} to {t.examCycles?.QUIZ_1?.endDate || '--'}</span>
                        </div>
                        <div>
                          <span style={{ fontWeight: 700, color: '#34d399' }}>Quiz 2: </span>
                          <span>{t.examCycles?.QUIZ_2?.startDate || '--'} to {t.examCycles?.QUIZ_2?.endDate || '--'}</span>
                        </div>
                        <div>
                          <span style={{ fontWeight: 700, color: '#fbbf24' }}>End Term: </span>
                          <span>{t.examCycles?.END_TERM?.startDate || '--'} to {t.examCycles?.END_TERM?.endDate || '--'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border, #2e2e42)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--surface-2, #28283c)',
              color: 'var(--text-primary, #fff)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
