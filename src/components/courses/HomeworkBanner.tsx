'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  FileText,
  Upload,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Plus,
  X,
  ExternalLink,
  Users,
  Download,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock
} from 'lucide-react'

interface HomeworkItem {
  id: string
  courseId: string
  title: string
  description?: string | null
  fileUrls: string[]
  dueAt: string
  createdAt: string
  submissionsCount?: number
  isSubmitted?: boolean
  mySubmission?: {
    id: string
    fileUrls: string[]
    note?: string | null
    submittedAt: string
  } | null
  isPastDue?: boolean
  isOpen?: boolean
}

interface StudentSubmissionRecord {
  studentId: string
  name: string
  email: string
  securityNumber?: string | null
  mobileNumber?: string | null
  avatar?: string | null
  isSubmitted: boolean
  submission?: {
    id: string
    fileUrls: string[]
    note?: string | null
    submittedAt: string
  } | null
}

interface HomeworkBannerProps {
  courseId: string
  isManager: boolean
  courseColor?: string
  isHomePage?: boolean
  initialHomeworkId?: string | null
  onNavigateToHomework?: (homeworkId?: string) => void
}

function isHomeworkPastDue(hw: { dueAt: string; isPastDue?: boolean }) {
  if (hw.isPastDue) return true
  const due = new Date(hw.dueAt).getTime()
  return !isNaN(due) && due <= Date.now()
}

function canSubmitHomework(hw: { dueAt: string; isPastDue?: boolean; isOpen?: boolean }) {
  return (hw.isOpen ?? true) && !isHomeworkPastDue(hw)
}

function formatCountdown(dueAtStr: string) {
  const diff = new Date(dueAtStr).getTime() - Date.now()
  if (diff <= 0) return 'Past deadline'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

function getFileName(url: string) {
  try {
    const parts = url.split('/')
    return parts[parts.length - 1] || 'Attachment'
  } catch {
    return 'Attachment'
  }
}

export default function HomeworkBanner({
  courseId,
  isManager,
  courseColor = '#6366f1',
  isHomePage = false,
  initialHomeworkId = null,
  onNavigateToHomework
}: HomeworkBannerProps) {
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({})

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingHomework, setEditingHomework] = useState<HomeworkItem | null>(null)
  const [submittingHomework, setSubmittingHomework] = useState<HomeworkItem | null>(null)
  const [viewingSubmissionsHw, setViewingSubmissionsHw] = useState<HomeworkItem | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<string | null>(initialHomeworkId)
  const [showAllHomework, setShowAllHomework] = useState(false)
  const [materialPickerHomework, setMaterialPickerHomework] = useState<HomeworkItem | null>(null)
  const [imagePreviewMaterial, setImagePreviewMaterial] = useState<{ url: string; label: string } | null>(null)

  useEffect(() => {
    if (initialHomeworkId) {
      setSelectedHomeworkId(initialHomeworkId)
    }
  }, [initialHomeworkId])

  const fetchHomework = useCallback(async () => {
    try {
      const res = await fetch(`/api/homework?courseId=${encodeURIComponent(courseId)}`)
      if (res.ok) {
        const data = await res.json()
        setHomeworkList(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Failed to load homework:', e)
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchHomework()
  }, [fetchHomework])

  const handleDeleteHomework = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete homework "${title}"? All submissions will also be deleted.`)) return
    try {
      const res = await fetch(`/api/homework/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setHomeworkList(prev => prev.filter(h => h.id !== id))
      } else {
        alert('Failed to delete homework')
      }
    } catch {
      alert('Error deleting homework')
    }
  }

  const handleToggleSubmission = async (hw: HomeworkItem) => {
    const nextIsOpen = !(hw.isOpen ?? true)
    setTogglingId(hw.id)
    try {
      const res = await fetch(`/api/homework/${hw.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: nextIsOpen })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update submission control')
      }
      setHomeworkList(prev => prev.map(item => item.id === hw.id ? { ...item, isOpen: nextIsOpen } : item))
    } catch (err: any) {
      alert(err.message || 'Error updating submission control')
    } finally {
      setTogglingId(null)
    }
  }

  if (loading) return null

  // If no homework and not a manager, render nothing
  if (homeworkList.length === 0 && !isManager) return null

  const sortedHomework = [...homeworkList].sort((a, b) => {
    const createdDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (createdDiff !== 0) return createdDiff
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  })
  const activeHomework = sortedHomework.filter(hw => canSubmitHomework(hw))
  const previewHomework = activeHomework[0] || sortedHomework[0]
  const selectedHomework = selectedHomeworkId ? sortedHomework.find(hw => hw.id === selectedHomeworkId) || null : null
  const getSerial = (id: string) => Math.max(1, sortedHomework.findIndex(hw => hw.id === id) + 1)

  // If on home page, do NOT show banner if no active homework exists (deadline passed or closed)
  if (isHomePage && activeHomework.length === 0) {
    return null
  }

  const openHomeworkDetail = (id: string) => {
    setSelectedHomeworkId(id)
    setShowAllHomework(false)
  }

  const isImageMaterial = (url: string) => /\.(jpg|jpeg|png|webp|gif|avif)($|\?)/i.test(url)
  const isPdfMaterial = (url: string) => /\.pdf($|\?)/i.test(url) || /application%2Fpdf|application\/pdf/i.test(url)

  const openMaterialUrl = (url: string, label: string) => {
    if (isImageMaterial(url)) {
      setImagePreviewMaterial({ url, label })
      return
    }
    if (isPdfMaterial(url)) {
      const href = `/homework/material-viewer?url=${encodeURIComponent(url)}&title=${encodeURIComponent(label)}`
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const openHomeworkMaterials = (hw: HomeworkItem) => {
    const urls = hw.fileUrls || []
    if (urls.length === 1) {
      openMaterialUrl(urls[0], 'Material 1')
      return
    }
    if (urls.length > 1) {
      setMaterialPickerHomework(hw)
    }
  }

  const renderHomeworkDetail = (hw: HomeworkItem) => {
    const serial = getSerial(hw.id)
    const isSubmitted = !!hw.isSubmitted
    const isPastDue = isHomeworkPastDue(hw)
    const isOpen = (hw.isOpen ?? true) && !isPastDue
    const canSubmit = isOpen && !isPastDue
    const isExpanded = !!expandedDesc[hw.id]
    const hasMaterials = hw.fileUrls && hw.fileUrls.length > 0

    return (
      <div
        key={hw.id}
        style={{
          background: 'var(--surface)',
          borderRadius: '12px',
          border: `1px solid ${
            isPastDue
              ? 'rgba(148, 163, 184, 0.28)'
              : isSubmitted
              ? 'rgba(34, 197, 94, 0.4)'
              : 'rgba(245, 158, 11, 0.36)'
          }`,
          boxShadow: isPastDue ? 'none' : '0 8px 24px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          marginBottom: '14px',
          position: 'relative',
          filter: isPastDue ? 'grayscale(0.92)' : 'none',
          opacity: isPastDue ? 0.9 : 1
        }}
      >
        <div style={{
          height: '3px',
          background: isPastDue
            ? 'linear-gradient(90deg, #64748b, #475569)'
            : isSubmitted
            ? 'linear-gradient(90deg, #10b981, #059669)'
            : 'linear-gradient(90deg, #f59e0b, #d97706)'
        }} />

        <div style={{ padding: '16px 20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: isPastDue
                  ? 'rgba(148, 163, 184, 0.16)'
                  : isSubmitted
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(245, 158, 11, 0.15)',
                color: isPastDue ? '#94a3b8' : isSubmitted ? '#10b981' : '#d97706',
                border: `1px solid ${
                  isPastDue
                    ? 'rgba(148, 163, 184, 0.3)'
                    : isSubmitted
                    ? 'rgba(34, 197, 94, 0.3)'
                    : 'rgba(245, 158, 11, 0.3)'
                }`
              }}>
                #{serial} {
                  isPastDue
                    ? <><AlertCircle size={13} /> Past Deadline</>
                    : isSubmitted
                    ? <><CheckCircle2 size={13} /> Submitted</>
                    : <><Clock size={13} /> Homework Pending</>
                }
              </span>

              {!canSubmit && !isPastDue && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  background: 'rgba(100, 116, 139, 0.14)',
                  color: 'var(--text-secondary)',
                  border: '1px solid rgba(100, 116, 139, 0.28)'
                }}>
                  <Lock size={12} /> Submissions Closed
                </span>
              )}

              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                fontWeight: 600
              }}>
                <Calendar size={13} /> Due: {formatDate(hw.dueAt)}
                <span style={{ fontWeight: 700, color: isPastDue ? '#94a3b8' : '#d97706', marginLeft: '4px' }}>
                  ({formatCountdown(hw.dueAt)})
                </span>
              </span>
            </div>

            {isManager && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => handleToggleSubmission(hw)}
                  disabled={togglingId === hw.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '12px',
                    border: `1px solid ${isOpen ? 'rgba(239, 68, 68, 0.24)' : 'rgba(34, 197, 94, 0.28)'}`,
                    background: isOpen ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.1)',
                    color: isOpen ? '#ef4444' : '#10b981',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: togglingId === hw.id ? 'not-allowed' : 'pointer',
                    opacity: togglingId === hw.id ? 0.7 : 1
                  }}
                  title={isOpen ? 'Close homework submissions' : 'Open homework submissions'}
                >
                  {isOpen ? <Lock size={14} /> : <Unlock size={14} />}
                  {isOpen ? 'Close Submission' : 'Open Submission'}
                </button>
                <button
                  onClick={() => setViewingSubmissionsHw(hw)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="View student submissions"
                >
                  <Users size={14} /> Submissions ({hw.submissionsCount || 0})
                </button>
                <button
                  onClick={() => setEditingHomework(hw)}
                  style={{ padding: '5px 8px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  title="Edit homework"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => handleDeleteHomework(hw.id, hw.title)}
                  style={{ padding: '5px 8px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer' }}
                  title="Delete homework"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>

          <div style={{ marginTop: '10px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              {hw.title}
            </h3>
            {hw.description && (
              <div style={{ marginTop: '4px' }}>
                <p style={{
                  fontSize: '13.5px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  margin: 0,
                  display: isExpanded ? 'block' : '-webkit-box',
                  WebkitLineClamp: isExpanded ? 'unset' : 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {hw.description}
                </p>
                {hw.description.length > 120 && (
                  <button
                    onClick={() => setExpandedDesc(prev => ({ ...prev, [hw.id]: !prev[hw.id] }))}
                    style={{ background: 'none', border: 'none', color: courseColor, fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '2px 0', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                  >
                    {isExpanded ? <>Less <ChevronUp size={12} /></> : <>Read more <ChevronDown size={12} /></>}
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              {isSubmitted && hw.mySubmission ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCheck size={16} style={{ color: isPastDue ? '#94a3b8' : '#10b981' }} />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    You submitted {hw.mySubmission.fileUrls.length} file(s) on {formatDate(hw.mySubmission.submittedAt)}
                    {isPastDue && ' — Submissions closed'}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {canSubmit
                    ? 'Submit before the deadline.'
                    : isPastDue
                    ? 'Deadline has passed. Submissions are closed.'
                    : 'Submission is currently closed by admin.'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hasMaterials && (
                <button
                  type="button"
                  onClick={() => openHomeworkMaterials(hw)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '999px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  <FileText size={14} /> View Homework Material
                </button>
              )}
              <button
                onClick={() => canSubmit && setSubmittingHomework(hw)}
                disabled={!canSubmit}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '999px',
                  border: isPastDue
                    ? '1px solid rgba(148, 163, 184, 0.25)'
                    : isSubmitted
                    ? '1px solid var(--border)'
                    : 'none',
                  background: isPastDue
                    ? 'var(--surface-2)'
                    : !canSubmit
                    ? 'var(--surface-2)'
                    : isSubmitted
                    ? 'var(--surface-2)'
                    : courseColor,
                  color: isPastDue
                    ? 'var(--text-muted)'
                    : !canSubmit
                    ? 'var(--text-muted)'
                    : isSubmitted
                    ? 'var(--text-primary)'
                    : '#fff',
                  boxShadow: isPastDue || isSubmitted || !canSubmit ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.65
                }}
              >
                {isPastDue ? <Lock size={14} /> : <Upload size={14} />}
                {isPastDue
                  ? 'Submission Closed'
                  : !canSubmit
                  ? 'Submission Closed'
                  : isSubmitted
                  ? 'Update Submission'
                  : 'Submit Homework'}
              </button>

              {isManager && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', borderRadius: '999px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus size={14} /> New Homework
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '20px', width: '100%' }}>
      {isHomePage ? (
        /* HOME PAGE / LECTURES VIEW: Banner for active homework only */
        activeHomework.length > 0 && (
          <div style={{
            border: '1px solid rgba(245, 158, 11, 0.28)',
            borderLeft: '5px solid #f59e0b',
            background: 'rgba(245, 158, 11, 0.07)',
            borderRadius: '14px',
            padding: '14px 16px',
            minHeight: '72px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div
              style={{
                flex: '1 1 280px',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                textAlign: 'left'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#d97706', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', flexShrink: 0 }}>
                <Clock size={14} /> Homework #{getSerial(activeHomework[0].id)}
              </span>
              <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'min(420px, 100%)' }}>
                {activeHomework[0].title}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                <Calendar size={13} /> {formatDate(activeHomework[0].dueAt)}
                <span style={{ color: '#d97706' }}>({formatCountdown(activeHomework[0].dueAt)})</span>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToHomework) {
                    onNavigateToHomework(activeHomework[0].id)
                  } else {
                    openHomeworkDetail(activeHomework[0].id)
                  }
                }}
                style={{ border: 'none', background: courseColor, color: '#fff', borderRadius: '999px', padding: '9px 18px', fontSize: '13px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 6px 14px rgba(0,0,0,0.14)' }}
              >
                View Homework
              </button>
              {activeHomework.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToHomework) {
                      onNavigateToHomework()
                    } else {
                      setShowAllHomework(true)
                    }
                  }}
                  style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '999px', padding: '9px 14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                >
                  View All Homework
                </button>
              )}
              {isManager && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  style={{ border: 'none', background: courseColor, color: '#fff', borderRadius: '999px', padding: '9px 14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={13} /> New Homework
                </button>
              )}
            </div>
          </div>
        )
      ) : (
        /* HOMEWORK TAB VIEW */
        <div>
          {/* Empty state when no homework exists */}
          {homeworkList.length === 0 && (
            isManager ? (
              <div style={{
                background: 'var(--surface)',
                border: '1px dashed var(--border)',
                borderRadius: '16px',
                padding: '24px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={20} style={{ color: courseColor }} />
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '14px', margin: 0, color: 'var(--text-primary)' }}>
                      No active homework for this course
                    </p>
                    <p style={{ fontSize: '12px', margin: 0, color: 'var(--text-secondary)' }}>
                      Create assignments with photos, PDFs, and submission tracking.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    background: courseColor,
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={16} /> New Homework
                </button>
              </div>
            ) : (
              <div style={{
                background: 'var(--surface)',
                border: '1px dashed var(--border)',
                borderRadius: '16px',
                padding: '36px 20px',
                textAlign: 'center'
              }}>
                <FileText size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', display: 'block' }} />
                <p style={{ fontWeight: 800, fontSize: '15px', margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  No homework assigned yet
                </p>
                <p style={{ fontSize: '12.5px', margin: 0, color: 'var(--text-secondary)' }}>
                  Assignments and project tasks will appear here.
                </p>
              </div>
            )
          )}

          {/* When homework exist */}
          {homeworkList.length > 0 && (
            <div>
              {selectedHomework ? (
                <div>
                  {sortedHomework.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedHomeworkId(null)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '14px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-2)',
                        color: 'var(--text-primary)',
                        borderRadius: '999px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      ← Back to All Homework
                    </button>
                  )}
                  {renderHomeworkDetail(selectedHomework)}
                </div>
              ) : sortedHomework.length === 1 ? (
                <div>
                  {isManager && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: 'none',
                          background: courseColor,
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={16} /> New Homework
                      </button>
                    </div>
                  )}
                  {renderHomeworkDetail(sortedHomework[0])}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
                      Homework Assignments ({sortedHomework.length})
                    </h2>
                    {isManager && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: 'none',
                          background: courseColor,
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={16} /> New Homework
                      </button>
                    )}
                  </div>
                  {sortedHomework.map(hw => renderHomeworkDetail(hw))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal: Student Homework Submit */}
      {submittingHomework && (
        <SubmitHomeworkModal
          homework={submittingHomework}
          courseColor={courseColor}
          onClose={() => setSubmittingHomework(null)}
          onSuccess={() => {
            setSubmittingHomework(null)
            fetchHomework()
          }}
        />
      )}

      {/* Modal: Manager Create or Edit Homework */}
      {(showCreateModal || editingHomework) && (
        <HomeworkFormModal
          courseId={courseId}
          courseColor={courseColor}
          initialData={editingHomework}
          onClose={() => {
            setShowCreateModal(false)
            setEditingHomework(null)
          }}
          onSuccess={() => {
            setShowCreateModal(false)
            setEditingHomework(null)
            fetchHomework()
          }}
        />
      )}

      {/* Modal: Manager View Submissions */}
      {viewingSubmissionsHw && (
        <SubmissionsViewerModal
          homework={viewingSubmissionsHw}
          courseColor={courseColor}
          onClose={() => setViewingSubmissionsHw(null)}
          onSubmissionDeleted={fetchHomework}
        />
      )}

      {materialPickerHomework && (
        <HomeworkMaterialPickerModal
          homework={materialPickerHomework}
          courseColor={courseColor}
          onOpenMaterial={openMaterialUrl}
          onClose={() => setMaterialPickerHomework(null)}
        />
      )}

      {imagePreviewMaterial && (
        <HomeworkImagePreviewModal
          material={imagePreviewMaterial}
          onClose={() => setImagePreviewMaterial(null)}
        />
      )}
    </div>
  )
}

function HomeworkMaterialPickerModal({
  homework,
  courseColor,
  onOpenMaterial,
  onClose
}: {
  homework: HomeworkItem
  courseColor: string
  onOpenMaterial: (url: string, label: string) => void
  onClose: () => void
}) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.62)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '18px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.22)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>
              View Homework Material
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {homework.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {homework.fileUrls.map((url, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onOpenMaterial(url, `Material ${idx + 1}`)
                onClose()
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={15} style={{ color: courseColor }} />
                Material {idx + 1}
              </span>
              <ExternalLink size={13} style={{ opacity: 0.7 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function HomeworkImagePreviewModal({
  material,
  onClose
}: {
  material: { url: string; label: string }
  onClose: () => void
}) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.92)',
      zIndex: 10001,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.12)'
      }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: 900 }}>{material.label}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href={material.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '999px',
              background: '#10b981',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 900,
              textDecoration: 'none'
            }}
          >
            <Download size={14} /> Download
          </a>
          <button
            type="button"
            onClick={onClose}
            style={{ border: '1px solid rgba(255,255,255,0.24)', background: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: '999px', padding: '8px 10px', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <img
          src={material.url}
          alt={material.label}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>
    </div>
  )
}

/* ========================================================================= */
/* MODAL: Student Submit Homework                                            */
/* ========================================================================= */
function SubmitHomeworkModal({
  homework,
  courseColor,
  onClose,
  onSuccess
}: {
  homework: HomeworkItem
  courseColor: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [note, setNote] = useState(homework.mySubmission?.note || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isPastDue = isHomeworkPastDue(homework)
  const canSubmit = canSubmitHomework(homework)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...filesArray])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      setError(isPastDue ? 'Deadline has passed. Submissions are closed.' : 'Submissions are currently closed.')
      return
    }
    if (selectedFiles.length === 0 && !note.trim() && (!homework.mySubmission?.fileUrls || homework.mySubmission.fileUrls.length === 0)) {
      setError('Please select at least one photo/PDF or enter your note.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('note', note)
      selectedFiles.forEach(file => {
        formData.append('files', file)
      })

      const res = await fetch(`/api/homework/${homework.id}/submit`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit homework')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Error submitting homework')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Submit Homework
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {homework.title}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: '50%'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {!canSubmit && (
            <div style={{
              background: 'rgba(148, 163, 184, 0.12)',
              border: '1px solid rgba(148, 163, 184, 0.28)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              marginBottom: '16px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Lock size={15} style={{ color: '#94a3b8', flexShrink: 0 }} />
              <span>{isPastDue ? 'The deadline has passed. Submissions are closed.' : 'Submissions are currently closed.'}</span>
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '16px',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          {/* Previous submission reminder */}
          {homework.mySubmission && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '16px'
            }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
                You previously submitted on {formatDate(homework.mySubmission.submittedAt)}.
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Submitting now will update your files and notes.
              </p>
            </div>
          )}

          {/* File Upload Box */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Upload Photos or PDFs
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border)',
                borderRadius: '16px',
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--surface-2)',
                transition: 'all 0.2s'
              }}
            >
              <Upload size={28} style={{ color: courseColor, margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: '13.5px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                Click to browse files
              </p>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>
                Supports JPG, PNG, PDF up to 15MB each
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* List of newly selected files */}
            {selectedFiles.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Selected Files ({selectedFiles.length}):
                </span>
                {selectedFiles.map((file, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--surface-2)',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      fontSize: '12.5px'
                    }}
                  >
                    <span style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student Note */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Note or Comments (Optional)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add any note or comments regarding your submission..."
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                resize: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '50px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              style={{
                flex: 1.5,
                padding: '12px',
                borderRadius: '50px',
                border: !canSubmit ? '1px solid var(--border)' : 'none',
                background: !canSubmit ? 'var(--surface-2)' : courseColor,
                color: !canSubmit ? 'var(--text-muted)' : '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: !canSubmit ? 'not-allowed' : loading ? 'not-allowed' : 'pointer',
                opacity: !canSubmit ? 0.65 : loading ? 0.7 : 1
              }}
            >
              {!canSubmit ? 'Submission Closed' : loading ? 'Uploading & Submitting...' : 'Confirm Submission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* MODAL: Manager Create / Edit Homework                                      */
/* ========================================================================= */
function HomeworkFormModal({
  courseId,
  courseColor,
  initialData,
  onClose,
  onSuccess
}: {
  courseId: string
  courseColor: string
  initialData?: HomeworkItem | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEditing = !!initialData
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [days, setDays] = useState<number>(() => {
    if (initialData?.dueAt) {
      const diffMs = new Date(initialData.dueAt).getTime() - Date.now()
      const d = Math.round(diffMs / (1000 * 60 * 60 * 24))
      return Math.min(7, Math.max(1, d))
    }
    return 2 // default 2 days
  })
  const [dueTime, setDueTime] = useState<string>(() => {
    if (initialData?.dueAt) {
      const d = new Date(initialData.dueAt)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return '23:59' // default 11:59 PM
  })
  const [isOpen, setIsOpen] = useState<boolean>(initialData?.isOpen ?? true)

  const computedDueAt = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + Number(days))
    const [hh, mm] = (dueTime || '23:59').split(':').map(Number)
    d.setHours(hh || 23, mm || 59, 0, 0)
    return d
  }, [days, dueTime])

  const [existingFileUrls, setExistingFileUrls] = useState<string[]>(initialData?.fileUrls || [])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const files = Array.from(e.target.files)
    setUploadingFiles(true)
    setError(null)

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'homework')

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to upload attachment')
        }
        if (data.url) {
          setExistingFileUrls(prev => [...prev, data.url])
        }
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploadingFiles(false)
    }
  }

  const removeUrl = (idx: number) => {
    setExistingFileUrls(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please provide a homework title.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const endpoint = isEditing ? `/api/homework/${initialData.id}` : '/api/homework'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          title: title.trim(),
          description: description.trim() || null,
          fileUrls: existingFileUrls,
          dueAt: computedDueAt.toISOString(),
          isOpen
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save homework')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Error saving homework')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '18px',
        width: '100%',
        maxWidth: '980px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '86vh'
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {isEditing ? 'Edit Homework' : 'Create New Homework'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 24px 16px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px 22px', alignItems: 'start' }}>
            <div>
              {/* Title */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Homework Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Chapter 3 Practice Problems"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Days and Time Selection */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Set Deadline (Days & Time) *
                </label>

                {/* Quick preset buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {[1, 2, 3, 5, 7].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: days === d ? `1.5px solid ${courseColor}` : '1px solid var(--border)',
                        background: days === d ? courseColor : 'var(--surface-2)',
                        color: days === d ? '#fff' : 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {d} {d === 1 ? 'Day' : 'Days'}
                    </button>
                  ))}
                </div>

                {/* Manual Days input and Time selector */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Days (1 to max 7)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      required
                      value={days}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10)
                        if (!isNaN(val)) {
                          setDays(Math.min(7, Math.max(1, val)))
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-2)',
                        color: 'var(--text-primary)',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Submission Time
                    </label>
                    <input
                      type="time"
                      required
                      value={dueTime}
                      onChange={e => setDueTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-2)',
                        color: 'var(--text-primary)',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Computed deadline display */}
                <div style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Due on: <strong style={{ color: 'var(--text-primary)' }}>
                      {computedDueAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {computedDueAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </strong>
                  </span>
                  <span style={{ fontSize: '11px', color: courseColor, fontWeight: 800 }}>
                    ({days} {days === 1 ? 'day' : 'days'} from now)
                  </span>
                </div>

              </div>

              {/* Submission control */}
              <div style={{
                marginBottom: '0',
                padding: '12px 14px',
                borderRadius: '14px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Submission Control
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    {isOpen ? 'Students can submit homework.' : 'Students can view homework but cannot submit.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(prev => !prev)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '999px',
                    border: `1px solid ${isOpen ? 'rgba(34, 197, 94, 0.28)' : 'rgba(239, 68, 68, 0.24)'}`,
                    background: isOpen ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                    color: isOpen ? '#10b981' : '#ef4444',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {isOpen ? <Unlock size={14} /> : <Lock size={14} />}
                  {isOpen ? 'Submission On' : 'Submission Off'}
                </button>
              </div>
            </div>

            <div>
              {/* Description */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Description or Instructions
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Write questions, instructions, or reading requirements..."
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    minHeight: '150px'
                  }}
                />
              </div>

              {/* Attachments */}
              <div style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Attach Question Papers / Photos / PDFs
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFiles}
                style={{
                  background: 'none',
                  border: 'none',
                  color: courseColor,
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={14} /> {uploadingFiles ? 'Uploading...' : 'Add File'}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            {existingFileUrls.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '1.5px dashed var(--border)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--surface-2)'
                }}
              >
                <Upload size={20} style={{ color: courseColor, margin: '0 auto 6px' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>
                  Upload photos, question sheet or PDF
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {existingFileUrls.map((url, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--surface-2)',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      fontSize: '12.5px'
                    }}
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: courseColor,
                        textDecoration: 'none',
                        maxWidth: '360px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 600
                      }}
                    >
                      {getFileName(url)}
                    </a>
                    <button
                      type="button"
                      onClick={() => removeUrl(i)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '50px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploadingFiles}
              style={{
                flex: 1.5,
                padding: '12px',
                borderRadius: '50px',
                border: 'none',
                background: courseColor,
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Homework'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* MODAL: Manager View Submissions                                            */
/* ========================================================================= */
function SubmissionsViewerModal({
  homework,
  courseColor,
  onClose,
  onSubmissionDeleted
}: {
  homework: HomeworkItem
  courseColor: string
  onClose: () => void
  onSubmissionDeleted: () => void
}) {
  const [data, setData] = useState<{
    stats: { totalStudents: number; submittedCount: number; pendingCount: number }
    students: StudentSubmissionRecord[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewingSubmissionId, setViewingSubmissionId] = useState<string | null>(null)

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch(`/api/homework/${homework.id}/submissions`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      console.error('Error fetching submissions:', e)
    } finally {
      setLoading(false)
    }
  }, [homework.id])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  const handleDeleteSubmission = async (subId: string, studentName: string) => {
    const firstConfirm = confirm(`Delete submission for ${studentName}?`)
    if (!firstConfirm) return

    const secondConfirm = confirm('Final confirmation: this will permanently delete this student submission record. Continue?')
    if (!secondConfirm) return

    try {
      const res = await fetch(`/api/homework/${homework.id}/submissions/${subId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setViewingSubmissionId(null)
        fetchSubmissions()
        onSubmissionDeleted()
      } else {
        alert('Failed to delete submission')
      }
    } catch {
      alert('Error deleting submission')
    }
  }

  const students = data?.students || []

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '720px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Submissions Tracker
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {homework.title}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Student list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0' }}>
              Loading submissions...
            </p>
          ) : students.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '13px' }}>
              No students found.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {students.map(student => (
                <div
                  key={student.studentId}
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {student.name}
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Security ID: {student.securityNumber || 'Not assigned'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {student.submission && (
                        <button
                          onClick={() => setViewingSubmissionId(prev => prev === student.submission!.id ? null : student.submission!.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '999px',
                            border: '1px solid rgba(34, 197, 94, 0.28)',
                            background: 'rgba(34, 197, 94, 0.12)',
                            color: '#10b981',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 800
                          }}
                        >
                          <CheckCircle2 size={12} /> View Submission
                        </button>
                      )}
                    </div>
                  </div>

                  {student.submission && viewingSubmissionId === student.submission.id && (
                    <div style={{
                      background: 'var(--surface)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Submitted at: {formatDate(student.submission.submittedAt)}
                      </div>

                      {student.submission.note && (
                        <p style={{
                          fontSize: '12.5px',
                          color: 'var(--text-primary)',
                          margin: '0 0 8px',
                          background: 'var(--surface-2)',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontStyle: 'italic'
                        }}>
                          &quot;{student.submission.note}&quot;
                        </p>
                      )}

                      {student.submission.fileUrls && student.submission.fileUrls.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {student.submission.fileUrls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border)',
                                color: courseColor,
                                fontSize: '11.5px',
                                fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              <Download size={11} /> File {i + 1}
                              <ExternalLink size={10} style={{ opacity: 0.6 }} />
                            </a>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                        <button
                          onClick={() => handleDeleteSubmission(student.submission!.id, student.name)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '11.5px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 800
                          }}
                          title="Delete this student's submission"
                        >
                          <Trash2 size={12} /> Delete Submission
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '50px',
              border: 'none',
              background: courseColor,
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
