'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  Search,
  Download,
  FileCheck,
  ChevronDown,
  ChevronUp
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
}

interface StudentSubmissionRecord {
  studentId: string
  name: string
  email: string
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

export default function HomeworkBanner({ courseId, isManager, courseColor = '#6366f1' }: HomeworkBannerProps) {
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({})

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingHomework, setEditingHomework] = useState<HomeworkItem | null>(null)
  const [submittingHomework, setSubmittingHomework] = useState<HomeworkItem | null>(null)
  const [viewingSubmissionsHw, setViewingSubmissionsHw] = useState<HomeworkItem | null>(null)

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

  if (loading) return null

  // If no homework and not a manager, render nothing
  if (homeworkList.length === 0 && !isManager) return null

  return (
    <div style={{ marginBottom: '20px', width: '100%' }}>
      {/* Manager "New Homework" trigger when no homework exists */}
      {isManager && homeworkList.length === 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1px dashed var(--border)',
          borderRadius: '16px',
          padding: '16px 20px',
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
                Create assignments with photos, PDFs, and a 7-day auto cleanup period.
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
      )}

      {/* Homework Banners */}
      {homeworkList.map(hw => {
        const isSubmitted = !!hw.isSubmitted
        const isPastDue = hw.isPastDue
        const isExpanded = !!expandedDesc[hw.id]

        return (
          <div
            key={hw.id}
            style={{
              background: 'var(--surface)',
              borderRadius: '18px',
              border: `1.5px solid ${isSubmitted ? 'rgba(34, 197, 94, 0.4)' : isPastDue ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
              overflow: 'hidden',
              marginBottom: '14px',
              position: 'relative'
            }}
          >
            {/* Top color ribbon */}
            <div style={{
              height: '4px',
              background: isSubmitted
                ? 'linear-gradient(90deg, #10b981, #059669)'
                : isPastDue
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : 'linear-gradient(90deg, #f59e0b, #d97706)'
            }} />

            <div style={{ padding: '16px 20px' }}>
              {/* Header row */}
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
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: isSubmitted
                      ? 'rgba(34, 197, 94, 0.15)'
                      : isPastDue
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                    color: isSubmitted ? '#10b981' : isPastDue ? '#ef4444' : '#d97706',
                    border: `1px solid ${isSubmitted ? 'rgba(34, 197, 94, 0.3)' : isPastDue ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                  }}>
                    {isSubmitted ? (
                      <>
                        <CheckCircle2 size={13} /> Submitted
                      </>
                    ) : isPastDue ? (
                      <>
                        <AlertCircle size={13} /> Past Deadline
                      </>
                    ) : (
                      <>
                        <Clock size={13} /> Homework Pending
                      </>
                    )}
                  </span>

                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600
                  }}>
                    <Calendar size={13} /> Due: {formatDate(hw.dueAt)}
                    <span style={{
                      fontWeight: 700,
                      color: isPastDue ? '#ef4444' : '#d97706',
                      marginLeft: '4px'
                    }}>
                      ({formatCountdown(hw.dueAt)})
                    </span>
                  </span>
                </div>

                {/* Manager controls */}
                {isManager && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                      style={{
                        padding: '5px 8px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-2)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                      title="Edit homework"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteHomework(hw.id, hw.title)}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '10px',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        cursor: 'pointer'
                      }}
                      title="Delete homework"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Title and description */}
              <div style={{ marginTop: '10px' }}>
                <h3 style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  margin: '0 0 4px',
                  color: 'var(--text-primary)'
                }}>
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
                        style={{
                          background: 'none',
                          border: 'none',
                          color: courseColor,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        {isExpanded ? <>Less <ChevronUp size={12} /></> : <>Read more <ChevronDown size={12} /></>}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Attached Files (Homework materials) */}
              {hw.fileUrls && hw.fileUrls.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    margin: '0 0 6px',
                    letterSpacing: '0.04em'
                  }}>
                    Attached Materials ({hw.fileUrls.length}):
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {hw.fileUrls.map((url, idx) => {
                      const isImg = /\.(jpg|jpeg|png|webp)($|\?)/i.test(url)
                      return (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            transition: 'all 0.15s'
                          }}
                        >
                          {isImg ? <Download size={13} style={{ color: courseColor }} /> : <FileText size={13} style={{ color: courseColor }} />}
                          <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getFileName(url)}
                          </span>
                          <ExternalLink size={11} style={{ opacity: 0.6 }} />
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Student status & submit action */}
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
                  {isSubmitted && hw.mySubmission && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCheck size={16} style={{ color: '#10b981' }} />
                      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        You submitted {hw.mySubmission.fileUrls.length} file(s) on {formatDate(hw.mySubmission.submittedAt)}
                      </span>
                    </div>
                  )}
                  {!isSubmitted && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Auto-cleanup deletes submissions 7 days after the deadline.
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setSubmittingHomework(hw)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      borderRadius: '50px',
                      border: 'none',
                      background: isSubmitted ? 'var(--surface-2)' : courseColor,
                      color: isSubmitted ? 'var(--text-primary)' : '#fff',
                      boxShadow: isSubmitted ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderWidth: isSubmitted ? '1px' : '0',
                      borderStyle: 'solid',
                      borderColor: 'var(--border)'
                    }}
                  >
                    <Upload size={14} />
                    {isSubmitted ? 'Update Submission' : 'Submit Homework'}
                  </button>

                  {isManager && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '8px 14px',
                        borderRadius: '50px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={14} /> Add Another
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}

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
              disabled={loading}
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
              {loading ? 'Uploading & Submitting...' : 'Confirm Submission'}
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
  const [dueAt, setDueAt] = useState(() => {
    if (initialData?.dueAt) {
      const d = new Date(initialData.dueAt)
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
      return d.toISOString().slice(0, 16)
    }
    const defaultDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    defaultDate.setMinutes(defaultDate.getMinutes() - defaultDate.getTimezoneOffset())
    return defaultDate.toISOString().slice(0, 16)
  })

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
    if (!dueAt) {
      setError('Please set a due date and time.')
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
          dueAt: new Date(dueAt).toISOString()
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
        borderRadius: '24px',
        width: '100%',
        maxWidth: '540px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '92vh'
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
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Set assignment details, attachments, and due date.
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

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
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

          {/* Title */}
          <div style={{ marginBottom: '16px' }}>
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

          {/* Due date & time */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Due Date & Time *
            </label>
            <input
              type="datetime-local"
              required
              value={dueAt}
              onChange={e => setDueAt(e.target.value)}
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
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Submissions and homework are auto-deleted 7 days after this deadline.
            </span>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Description or Instructions
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Write questions, instructions, or reading requirements..."
              rows={4}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Attachments */}
          <div style={{ marginBottom: '16px' }}>
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
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'submitted' | 'pending'>('all')

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
    if (!confirm(`Delete submission for ${studentName}?`)) return
    try {
      const res = await fetch(`/api/homework/${homework.id}/submissions/${subId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchSubmissions()
        onSubmissionDeleted()
      } else {
        alert('Failed to delete submission')
      }
    } catch {
      alert('Error deleting submission')
    }
  }

  const filteredStudents = (data?.students || []).filter(s => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
    if (filter === 'submitted') return matchSearch && s.isSubmitted
    if (filter === 'pending') return matchSearch && !s.isSubmitted
    return matchSearch
  })

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

        {/* Stats bar */}
        {data && (
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)'
          }}>
            <div style={{ flex: 1, padding: '12px 16px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Enrolled
              </span>
              <p style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
                {data.stats.totalStudents}
              </p>
            </div>
            <div style={{ flex: 1, padding: '12px 16px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                Submitted
              </span>
              <p style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: '#10b981' }}>
                {data.stats.submittedCount}
              </p>
            </div>
            <div style={{ flex: 1, padding: '12px 16px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
                Pending
              </span>
              <p style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: '#ef4444' }}>
                {data.stats.pendingCount}
              </p>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{
            flex: 1,
            minWidth: '200px',
            position: 'relative'
          }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search student by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '50px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', 'submitted', 'pending'] as const).map(tabKey => (
              <button
                key={tabKey}
                onClick={() => setFilter(tabKey)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: filter === tabKey ? `1px solid ${courseColor}` : '1px solid var(--border)',
                  background: filter === tabKey ? courseColor : 'var(--surface-2)',
                  color: filter === tabKey ? '#fff' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {tabKey}
              </button>
            ))}
          </div>
        </div>

        {/* Student list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0' }}>
              Loading submissions...
            </p>
          ) : filteredStudents.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '13px' }}>
              No students match the criteria.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredStudents.map(student => (
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
                        {student.email} {student.mobileNumber ? `• ${student.mobileNumber}` : ''}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: student.isSubmitted ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                        color: student.isSubmitted ? '#10b981' : '#ef4444'
                      }}>
                        {student.isSubmitted ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {student.isSubmitted ? 'Submitted' : 'Not Submitted'}
                      </span>

                      {student.submission && (
                        <button
                          onClick={() => handleDeleteSubmission(student.submission!.id, student.name)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 700
                          }}
                          title="Delete this student's submission"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {student.submission && (
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
