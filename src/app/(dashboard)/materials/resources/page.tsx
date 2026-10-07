'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface MaterialItem {
  id: string
  title: string
  description?: string
  fileUrl: string
  fileType: string
  fileSize?: string
  isGlobal: boolean
  createdAt: string
  courseId: string | null
  course?: { id: string; name: string; color: string }
}

interface CourseItem {
  id: string
  name: string
  color: string
}

const FILE_STYLES: Record<string, { color: string }> = {
  PDF:  { color: 'var(--danger)' },
  PPTX: { color: 'var(--warning)' },
  PPT:  { color: 'var(--warning)' },
  DOC:  { color: 'var(--info)' },
  DOCX: { color: 'var(--info)' },
  XLS:  { color: 'var(--success)' },
  XLSX: { color: 'var(--success)' },
  ZIP:  { color: 'var(--accent)' },
  PNG:  { color: '#EC4899' },
  JPG:  { color: '#EC4899' },
  LINK: { color: 'var(--info)' },
}

function getFileType(url: string, explicitType?: string): string {
  if (explicitType) return explicitType.toUpperCase()
  const ext = url?.split('.').pop()?.split('?')[0]?.toUpperCase() || ''
  return Object.keys(FILE_STYLES).includes(ext) ? ext : 'FILE'
}

export default function StudyResourcesPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const { data: userData } = useSWR('/api/auth/me', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const userRole = userData?.user?.role || ''
  const isManager = userRole === 'MANAGER' || (userRole === 'ADMIN' || userRole === 'MODERATOR')

  const { data: materials, isLoading, mutate } = useSWR('/api/materials', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
  const loadingFact = useLoadingFact(isLoading)

  const { data: courses } = useSWR<CourseItem[]>('/api/courses', fetcher)
  
  const [search, setSearch] = useState('')
  const [selectedCourse, setSelectedCourse] = useState('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<'FILE' | 'LINK'>('FILE')

  // Form states
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [fileType, setFileType] = useState('')
  const [fileSize, setFileSize] = useState('')
  const [isGlobal, setIsGlobal] = useState(true)
  const [courseId, setCourseId] = useState('')

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setFileUrl('')
    setFileType('')
    setFileSize('')
    setIsGlobal(true)
    setCourseId('')
    setSourceType('FILE')
    setIsEditing(false)
    setCurrentId(null)
  }

  const handleEdit = (mat: MaterialItem) => {
    setTitle(mat.title)
    setDescription(mat.description || '')
    setFileUrl(mat.fileUrl)
    setFileType(mat.fileType)
    setFileSize(mat.fileSize || '')
    setIsGlobal(mat.isGlobal)
    setCourseId(mat.courseId || '')
    setSourceType((mat as any).sourceType === 'LINK' ? 'LINK' : 'FILE')
    setIsEditing(true)
    setCurrentId(mat.id)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string, name: string) => {
    const allowed = await confirm({
      title: 'Delete Material?',
      message: `Are you sure you want to delete "${name}"?`,
      confirmLabel: 'Delete Material',
      tone: 'danger',
    })
    if (!allowed) return
    try {
      const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' })
      if (res.ok) {
        mutate()
      } else {
        alert('Failed to delete material')
      }
    } catch (err) {
      alert('Error deleting material')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'materials')

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.url) {
        setFileUrl(data.url)
        setFileType(file.name.split('.').pop()?.toUpperCase() || 'FILE')
        setFileSize(`${(file.size / 1024 / 1024).toFixed(2)} MB`)
      } else {
        alert(data.error || 'Upload failed')
      }
    } catch (err) {
      alert('Upload error')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !fileUrl) {
      alert('Title and file/link are required')
      return
    }
    if (!isGlobal && !courseId) {
      alert('Please assign to a course or mark as global')
      return
    }

    // Validate URL format
    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
      alert('Please enter a valid URL starting with http:// or https://')
      return
    }

    setIsSaving(true)
    const body = {
      title,
      description,
      fileUrl,
      fileType: sourceType === 'LINK' ? 'link' : fileType,
      fileSize,
      isGlobal,
      courseId: isGlobal ? null : courseId,
      sourceType,
    }

    try {
      const res = await fetch(isEditing ? `/api/materials/${currentId}` : '/api/materials', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        mutate()
        setIsModalOpen(false)
        resetForm()
      } else {
        const data = await res.json()
        alert(data.error || 'Operation failed')
      }
    } catch (err) {
      alert('Server error')
    } finally {
      setIsSaving(false)
    }
  }

  const filteredData = (materials || []).filter((m: MaterialItem) => {
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase()) ||
                         m.course?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesCourse = selectedCourse === 'ALL' || m.courseId === selectedCourse || (selectedCourse === 'GLOBAL' && m.isGlobal)
    return matchesSearch && matchesCourse
  })

  if (isLoading) {
    return (
      <div className="page-container">
        {loadingFact && (
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <LoadingFactCard fact={loadingFact} />
          </div>
        )}
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton" style={{ height: '72px', borderRadius: '50px', marginBottom: '10px' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="page-container fade-in">
      {confirmDialog}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {isManager && (
            <button 
              onClick={() => {
                resetForm()
                setIsModalOpen(true)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '11px 20px', borderRadius: '50px',
                background: 'var(--primary)', color: '#ffffff',
                boxShadow: '4px 4px 10px rgba(54,54,232,0.35)',
                border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Material
            </button>
          )}
          
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <select
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value)}
              style={{
                width: '100%', padding: '11px 18px',
                border: 'none', borderRadius: '50px',
                background: 'var(--surface-2)',
                boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                appearance: 'none', cursor: 'pointer'
              }}
            >
              <option value="ALL">All Courses</option>
              <option value="GLOBAL">Global Only</option>
              {courses?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9999b0" strokeWidth="2.5"
              style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          
          <div style={{ position: 'relative', flex: 2, minWidth: '260px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9999b0" strokeWidth="2"
              style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search resource name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '11px 18px 11px 42px',
                border: 'none', borderRadius: '50px',
                background: 'var(--surface-2)',
                boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Materials list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--neu-dark)" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <p style={{ fontWeight: '500' }}>No materials found</p>
          </div>
        ) : (
          filteredData.map((mat: MaterialItem) => {
            const ft    = getFileType(mat.fileUrl, mat.fileType)
            const style = FILE_STYLES[ft] || { color: 'var(--text-secondary)' }
            const dateObj = mat.createdAt ? new Date(mat.createdAt) : null
            const dateStr = (dateObj && !isNaN(dateObj.getTime())) 
              ? dateObj.toLocaleDateString('en-GB', { month: '2-digit', day: '2-digit', year: 'numeric' }) 
              : null

            return (
              <div key={mat.id} style={{
                display: 'flex', alignItems: 'center', gap: '18px',
                padding: '16px 24px', borderRadius: '50px',
                background: 'var(--surface-2)',
                boxShadow: '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(6px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateX(0)')}
              >
                {/* File type badge */}
                <div style={{
                  width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
                  background: 'var(--surface-2)', boxShadow: '3px 3px 7px var(--neu-dark), -3px -3px 7px var(--neu-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: '800', color: style.color, letterSpacing: '0.03em',
                }}>
                  {ft.slice(0, 4)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.title}</span>
                    {mat.createdAt && new Date().getTime() - new Date(mat.createdAt).getTime() < 24 * 60 * 60 * 1000 && (
                      <span style={{
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: 'white', padding: '2px 6px', borderRadius: '4px',
                        fontSize: '9px', fontWeight: '800', textTransform: 'uppercase',
                        letterSpacing: '0.05em', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
                        flexShrink: 0
                      }}>
                        New
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {mat.isGlobal ? (
                      <span style={{
                        padding: '1px 8px', borderRadius: '50px',
                        background: 'var(--primary-light)', color: 'var(--accent)',
                        fontWeight: '700', fontSize: '10px', textTransform: 'uppercase'
                      }}>
                        Global
                      </span>
                    ) : mat.course && (
                      <span style={{
                        padding: '1px 8px', borderRadius: '50px',
                        background: (mat.course.color || 'var(--accent)') + '18',
                        color: mat.course.color || 'var(--accent)',
                        fontWeight: '700', fontSize: '10px',
                      }}>
                        {mat.course.name}
                      </span>
                    )}
                    {mat.description && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.description}</span>}
                    {dateStr && <span>&bull; {dateStr}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isManager && (
                    <>
                      <button
                        onClick={() => handleEdit(mat)}
                        style={{
                          width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                          background: 'var(--surface-2)', boxShadow: '3px 3px 7px var(--neu-dark), -3px -3px 7px var(--neu-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: 'var(--accent)', flexShrink: 0,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        onClick={() => handleDelete(mat.id, mat.title)}
                        style={{
                          width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                          background: 'var(--surface-2)', boxShadow: '3px 3px 7px var(--neu-dark), -3px -3px 7px var(--neu-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: 'var(--danger)', flexShrink: 0,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </>
                  )}
                  <a
                    href={mat.fileUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: '42px', height: '42px', borderRadius: '50%', border: 'none',
                      background: 'var(--primary)', color: '#ffffff',
                      boxShadow: '4px 4px 10px rgba(54,54,232,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </a>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal" style={{ maxWidth: '500px', borderRadius: '32px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 800 }}>{isEditing ? 'Edit Material' : 'Add New Material'}</h3>
              <button onClick={() => setIsModalOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '12px', opacity: 0.6, fontWeight: 700 }}>TITLE</label>
                  <input 
                    className="form-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g., Quantum Mechanics Notes"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '12px', opacity: 0.6, fontWeight: 700 }}>DESCRIPTION (OPTIONAL)</label>
                  <textarea 
                    className="form-input"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief summary of the material..."
                    style={{ minHeight: '80px', borderRadius: '18px', padding: '12px 16px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '12px', opacity: 0.6, fontWeight: 700 }}>SOURCE TYPE *</label>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${sourceType === 'FILE' ? 'var(--accent)' : 'var(--surface-2)'}`, background: sourceType === 'FILE' ? 'var(--primary-light)' : 'transparent' }}>
                      <input
                        type="radio"
                        name="sourceType"
                        checked={sourceType === 'FILE'}
                        onChange={() => setSourceType('FILE')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: sourceType === 'FILE' ? '600' : '500', color: 'var(--text-primary)' }}>📄 Upload File</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${sourceType === 'LINK' ? 'var(--accent)' : 'var(--surface-2)'}`, background: sourceType === 'LINK' ? 'var(--primary-light)' : 'transparent' }}>
                      <input
                        type="radio"
                        name="sourceType"
                        checked={sourceType === 'LINK'}
                        onChange={() => setSourceType('LINK')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: sourceType === 'LINK' ? '600' : '500', color: 'var(--text-primary)' }}>🔗 External Link</span>
                    </label>
                  </div>
                </div>

                {sourceType === 'FILE' ? (
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px', opacity: 0.6, fontWeight: 700 }}>FILE SOURCE *</label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="file"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                          id="mat-file-upload"
                        />
                        <label
                          htmlFor="mat-file-upload"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '12px 20px', borderRadius: '14px',
                            background: 'var(--surface-2)', boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
                            cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)'
                          }}
                        >
                          {isUploading ? 'Uploading...' : fileUrl ? 'File selected' : 'Choose file...'}
                        </label>
                      </div>
                      {fileUrl && (
                        <div style={{
                          padding: '12px 16px', borderRadius: '14px',
                          background: 'var(--primary-light)', color: 'var(--accent)',
                          fontSize: '11px', fontWeight: '800'
                        }}>
                          {fileType}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px', opacity: 0.6, fontWeight: 700 }}>EXTERNAL LINK URL *</label>
                    <input
                      className="form-input"
                      value={fileUrl}
                      onChange={e => setFileUrl(e.target.value)}
                      placeholder="https://example.com/resource"
                      style={{ borderRadius: '16px' }}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '12px', opacity: 0.6, fontWeight: 700 }}>ASSIGNMENT</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        checked={isGlobal} 
                        onChange={() => setIsGlobal(true)} 
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Global (All Users)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        checked={!isGlobal} 
                        onChange={() => setIsGlobal(false)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Specific Course</span>
                    </label>
                    
                    {!isGlobal && (
                      <select
                        className="form-input"
                        value={courseId}
                        onChange={e => setCourseId(e.target.value)}
                        style={{ borderRadius: '16px' }}
                        required={!isGlobal}
                      >
                        <option value="">Select Course...</option>
                        {courses?.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: 'none', padding: '0 32px 32px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isUploading || isSaving}
                  style={{ minWidth: '120px' }}
                >
                  {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Save Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
