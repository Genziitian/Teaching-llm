'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import CourseBannerEditor from '@/components/courses/CourseBannerEditor'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'
import { getCourseBackground, getCourseTextColor, getCourseSecondaryTextColor, getCourseDecorativeColor, getCourseBadgeBg, getCourseBadgeText, colorWithOpacity, extractHex } from '@/lib/color-utils'

interface ContentItem {
  id: string
  title: string
  description?: string
  videoUrl?: string
  youtubeUrl?: string
  videoSource: string
  pptUrl?: string
  order: number
  createdAt?: string
  isImported?: boolean
  importedIntoTopicId?: string
}

interface Topic {
  id: string
  title: string
  order: number
  content: ContentItem[]
}

interface CourseDetail {
  id: string
  name: string
  description: string
  subject: string
  color: string
}

interface ContentForm {
  title: string
  description: string
  videoUrl: string
  youtubeUrl: string
  videoSource: string
  isDemo: boolean
}

interface MaterialItem {
  id: string
  title: string
  description?: string
  fileUrl: string
  fileType: string
  fileSize?: string
}

const emptyForm: ContentForm = { title: '', description: '', videoUrl: '', youtubeUrl: '', videoSource: 'GOOGLE_DRIVE', isDemo: false }

export default function CourseEditPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const params = useParams()
  const router = useRouter()
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const loadingFact = useLoadingFact(loading)
  const [saving, setSaving] = useState(false)

  // Topic form
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)

  // Edit topic inline
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null)
  const [editingTopicTitle, setEditingTopicTitle] = useState('')

  // Content modals
  const [contentModal, setContentModal] = useState<{
    mode: 'add' | 'edit'
    topicId: string
    content?: ContentItem
  } | null>(null)
  const [contentForm, setContentForm] = useState<ContentForm>(emptyForm)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [materialSourceType, setMaterialSourceType] = useState<'FILE' | 'LINK'>('LINK')
  const [materialLink, setMaterialLink] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null)
  const [uploadingMaterial, setUploadingMaterial] = useState(false)
  const [orderDirty, setOrderDirty] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [courseRes, topicsRes, meRes] = await Promise.all([
        fetch(`/api/courses/${params.id}`),
        fetch(`/api/courses/${params.id}/topics`),
        fetch('/api/auth/me'),
      ])
      const courseData = await courseRes.json()
      const topicsData = await topicsRes.json()
      const meData = await meRes.json()

      const role = meData.user?.role
      const accessibleCourseIds = meData.user?.accessibleCourseIds || []

      if (role !== 'MANAGER' && role !== 'MODERATOR') {
        router.replace(`/courses/${params.id}`)
        return
      }

      if ((role === 'ADMIN' || role === 'MODERATOR') && !accessibleCourseIds.includes(params.id as string)) {
        router.replace('/dashboard')
        return
      }

      setCourse(courseData.course || courseData)
      setTopics(Array.isArray(topicsData) ? topicsData : [])
      if (Array.isArray(topicsData) && topicsData.length > 0) {
        setExpanded(new Set(topicsData.map((t: Topic) => t.id)))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => { fetchData() }, [fetchData])

  const refreshTopics = async () => {
    const res = await fetch(`/api/courses/${params.id}/topics`)
    const data = await res.json()
    setTopics(Array.isArray(data) ? data : [])
  }

  // ── Topic CRUD ───────────────────────────────────────────────────────────────
  const createTopic = async () => {
    if (!newTopicTitle.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/courses/${params.id}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTopicTitle.trim() }),
      })
      setNewTopicTitle('')
      setAddingTopic(false)
      await refreshTopics()
    } finally {
      setSaving(false)
    }
  }

  const updateTopic = async (id: string) => {
    if (!editingTopicTitle.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/topics/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTopicTitle.trim() }),
      })
      setEditingTopicId(null)
      await refreshTopics()
    } finally {
      setSaving(false)
    }
  }

  const deleteTopic = async (id: string) => {
    const allowed = await confirm({
      title: 'Delete Topic?',
      message: 'This will remove the topic and every lecture still attached to it from the course.',
      confirmLabel: 'Delete Topic',
      tone: 'danger',
    })
    if (!allowed) return
    setSaving(true)
    try {
      await fetch(`/api/topics/${id}`, { method: 'DELETE' })
      await refreshTopics()
    } finally {
      setSaving(false)
    }
  }

  const moveTopic = (id: string, direction: 'up' | 'down') => {
    const idx = topics.findIndex(t => t.id === id)
    if (idx < 0) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === topics.length - 1) return

    const newTopics = [...topics]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newTopics[idx], newTopics[swapIdx]] = [newTopics[swapIdx], newTopics[idx]]
    setTopics(newTopics.map((t, i) => ({ ...t, order: i })))
    setOrderDirty(true)
  }

  const moveLecture = (topicId: string, contentId: string, direction: 'up' | 'down') => {
    const topicIdx = topics.findIndex(t => t.id === topicId)
    if (topicIdx < 0) return
    const content = [...topics[topicIdx].content]
    const idx = content.findIndex(c => c.id === contentId)
    if (idx < 0) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === content.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[content[idx], content[swapIdx]] = [content[swapIdx], content[idx]]
    const newTopics = [...topics]
    newTopics[topicIdx] = { ...newTopics[topicIdx], content: content.map((c, i) => ({ ...c, order: i })) }
    setTopics(newTopics)
    setOrderDirty(true)
  }


  const saveOrder = async () => {
    setSavingOrder(true)
    try {
      // Save topic order
      const topicRes = await fetch('/api/topics/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: params.id,
          items: topics.map(t => ({ id: t.id, order: t.order }))
        })
      })
      if (!topicRes.ok) {
        const errorData = await topicRes.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save topic order')
      }

      // Save lecture order for each topic
      for (const topic of topics) {
        if (topic.content.length > 0) {
          const contentRes = await fetch('/api/content/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: topic.content.map(c => ({ 
                id: c.id, 
                order: c.order, 
                topicId: topic.id,
                isImported: Boolean(c.isImported)
              }))
            })
          })
          if (!contentRes.ok) {
            const errorData = await contentRes.json().catch(() => ({}))
            throw new Error(errorData.error || `Failed to save lecture order for topic ${topic.title}`)
          }
        }
      }
      setOrderDirty(false)
    } catch (e: any) {
      console.error('Failed to save order', e)
      alert(e.message || 'Failed to save order. Please try again.')
    } finally {
      setSavingOrder(false)
    }
  }

  // ── Content CRUD ─────────────────────────────────────────────────────────────
  const openAddContent = (topicId: string) => {
    setContentModal({ mode: 'add', topicId })
    setContentForm(emptyForm)
    setMaterialSourceType('LINK')
    setMaterialLink('')
    setSelectedMaterial(null)
  }

  const openEditContent = (topicId: string, item: ContentItem) => {
    const existingMaterialUrl = item.pptUrl || ''
    const hasUploadedMaterial = existingMaterialUrl.startsWith('/api/files/materials/')

    setContentModal({ mode: 'edit', topicId, content: item })
    setContentForm({
      title: item.title,
      description: item.description || '',
      videoUrl: item.videoUrl || '',
      youtubeUrl: item.youtubeUrl || '',
      videoSource: item.videoSource || 'GOOGLE_DRIVE',
      isDemo: !!(item as any).isDemo,
    })
    setMaterialSourceType(hasUploadedMaterial ? 'FILE' : 'LINK')
    setMaterialLink(hasUploadedMaterial ? '' : existingMaterialUrl)
    setSelectedMaterial(hasUploadedMaterial ? {
      id: item.id,
      title: item.title,
      fileUrl: existingMaterialUrl,
      fileType: existingMaterialUrl.split('.').pop()?.toUpperCase() || 'FILE',
    } : null)
  }

  const handleMaterialFileChange = async (file: File | null) => {
    if (!file) {
      return
    }

    setUploadingMaterial(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'materials')

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || 'Upload failed')
      }

      const title = file.name.replace(/\.[^.]+$/, '')
      const createRes = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: '',
          fileUrl: uploadData.url,
          fileType: file.name.split('.').pop()?.toUpperCase() || 'FILE',
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          isGlobal: false,
          courseId: params.id,
        }),
      })
      const createdMaterial = await createRes.json()
      if (!createRes.ok) {
        throw new Error(createdMaterial.error || 'Failed to save material')
      }

      setSelectedMaterial(createdMaterial)
      setMaterialLink('')
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to upload material')
    } finally {
      setUploadingMaterial(false)
    }
  }

  const saveContent = async () => {
    if (!contentModal) return
    if (!contentForm.title.trim()) {
      alert('Lecture Title is mandatory')
      return
    }

    setSaving(true)
    try {
      const trimmedMaterialLink = materialLink.trim()

      const payload = {
        ...contentForm,
        title: contentForm.title.trim(),
        videoUrl: contentForm.videoUrl.trim(),
        youtubeUrl: contentForm.youtubeUrl.trim(),
        pptUrl: materialSourceType === 'LINK'
          ? trimmedMaterialLink
          : selectedMaterial?.fileUrl || '',
      }

      let res
      if (contentModal.mode === 'add') {
        res = await fetch(`/api/topics/${contentModal.topicId}/content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else if (contentModal.content) {
        res = await fetch(`/api/content/${contentModal.content.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res && !res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save lecture')
      }

      setContentModal(null)
      await refreshTopics()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'An error occurred while saving the lecture')
    } finally {
      setSaving(false)
    }
  }

  const deleteContent = async (contentId: string, topicId: string) => {
    const allowed = await confirm({
      title: 'Remove Lecture?',
      message: 'This removes the lecture from this course/topic. Full recording deletion must be done from the Recordings section.',
      confirmLabel: 'Remove Lecture',
      tone: 'danger',
    })
    if (!allowed) return
    setSaving(true)
    try {
      await fetch(`/api/content/${contentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId }),
      })
      await refreshTopics()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container fade-in">
        {loadingFact && (
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <LoadingFactCard fact={loadingFact} />
          </div>
        )}
        <div className="skeleton" style={{ height: '120px', borderRadius: '12px', marginBottom: '20px' }} />
        <div className="skeleton" style={{ height: '300px', borderRadius: '12px' }} />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p style={{ fontSize: '16px', fontWeight: '500' }}>Course not found</p>
          <Link href="/courses" className="btn btn-primary" style={{ marginTop: '16px' }}>Back to Courses</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container gz-page gz-ed fade-in">
      {confirmDialog}
      {/* Content Form Modal */}
      {contentModal && (
        <div className="gz-modal-scrim gz-ed-scrim" onClick={() => setContentModal(null)}>
          <div className="gz-modal gz-ed-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="gz-ed-modal__head">
              <div>
                <h3>{contentModal.mode === 'add' ? 'Add Lecture' : 'Edit Lecture'}</h3>
                <p>{contentModal.mode === 'add' ? 'Link a recording and optional material.' : 'Update links, material and description.'}</p>
              </div>
              <button onClick={() => setContentModal(null)} className="gz-ed-x" aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="gz-ed-modal__body">
              <div className="gz-ed-field">
                <label>Lecture title <em>*</em></label>
                <input
                  value={contentForm.title}
                  onChange={e => setContentForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Introduction to Variables"
                  className="gz-ed-input"
                />
              </div>

              <div className="gz-ed-two">
                <div className="gz-ed-field">
                  <label>Google Drive URL</label>
                  <input
                    value={contentForm.videoUrl}
                    onChange={e => setContentForm(f => ({ ...f, videoUrl: e.target.value }))}
                    placeholder="Google Drive video link"
                    className="gz-ed-input"
                  />
                </div>
                <div className="gz-ed-field">
                  <label>YouTube URL</label>
                  <input
                    value={contentForm.youtubeUrl}
                    onChange={e => setContentForm(f => ({ ...f, youtubeUrl: e.target.value }))}
                    placeholder="YouTube video link"
                    className="gz-ed-input"
                  />
                </div>
              </div>

              <div className="gz-ed-field">
                <label>Material source</label>
                <div className="gz-ed-seg" role="radiogroup">
                  <button
                    type="button" role="radio" aria-checked={materialSourceType === 'FILE'}
                    className={`gz-ed-seg__btn ${materialSourceType === 'FILE' ? 'is-on' : ''}`}
                    onClick={() => { setMaterialSourceType('FILE'); setMaterialLink('') }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Upload file
                  </button>
                  <button
                    type="button" role="radio" aria-checked={materialSourceType === 'LINK'}
                    className={`gz-ed-seg__btn ${materialSourceType === 'LINK' ? 'is-on' : ''}`}
                    onClick={() => { setMaterialSourceType('LINK'); setSelectedMaterial(null) }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.5-1.5"/></svg>
                    External link
                  </button>
                </div>
              </div>

              {materialSourceType === 'FILE' ? (
                <div className="gz-ed-field">
                  <label>Uploaded material</label>
                  <div className="gz-ed-file">
                    <input
                      type="file"
                      onChange={e => void handleMaterialFileChange(e.target.files?.[0] ?? null)}
                      style={{ display: 'none' }}
                      id="lecture-material-upload"
                    />
                    <label htmlFor="lecture-material-upload" className="gz-ed-file__pick">
                      {uploadingMaterial ? 'Uploading...' : selectedMaterial ? selectedMaterial.title : 'Choose file...'}
                    </label>
                    {selectedMaterial && <span className="gz-ed-tag">{selectedMaterial.fileType}</span>}
                  </div>
                  <span className="gz-ed-hint">Optional. Upload a file if this lecture should include downloadable material.</span>
                </div>
              ) : (
                <div className="gz-ed-field">
                  <label>Material link</label>
                  <input
                    value={materialLink}
                    onChange={e => setMaterialLink(e.target.value)}
                    placeholder="https://... (external material link)"
                    className="gz-ed-input"
                  />
                </div>
              )}

              <div className="gz-ed-field">
                <label>Description</label>
                <textarea
                  value={contentForm.description}
                  onChange={e => setContentForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of what this lecture covers..."
                  rows={3}
                  className="gz-ed-input gz-ed-textarea"
                />
              </div>
            </div>

            <div className="gz-ed-modal__foot">
              <button onClick={() => setContentModal(null)} className="gz-btn gz-btn--ghost">Cancel</button>
              <button
                onClick={saveContent}
                disabled={saving || !contentForm.title.trim()}
                className="gz-btn"
              >
                {saving ? 'Saving...' : contentModal.mode === 'add' ? 'Add Lecture' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="gz-ed-head">
        <div className="gz-ed-head__main">
          <Link href={`/courses/${params.id}`} className="gz-ed-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Course
          </Link>
          <h1>{course.name} <span>— Manage Content</span></h1>
          <p className="gz-ed-meta">
            {topics.length} topic{topics.length !== 1 ? 's' : ''} &middot; {topics.reduce((a, t) => a + t.content.length, 0)} lectures
          </p>
        </div>
        <div className="gz-ed-head__actions">
          {orderDirty && (
            <button onClick={saveOrder} disabled={savingOrder} className="gz-btn gz-ed-save">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {savingOrder ? 'Saving...' : 'Save order'}
            </button>
          )}
          <CourseBannerEditor
            courseId={String(params.id)}
            currentUrl={(course as any).bannerUrl}
            fallbackUrl="/store-art/store-course.webp"
            onChange={(url) => setCourse(c => (c ? ({ ...c, bannerUrl: url } as any) : c))}
          />
          <span className="gz-ed-chip">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Admin / Manager view
          </span>
        </div>
      </div>

      {/* Topics */}
      <div className="gz-ed-list">
        {topics.map((topic, topicIdx) => (
          <div key={topic.id} className="gz-ed-topic">
            {/* Topic Header */}
            <div className={`gz-ed-topic__head ${expanded.has(topic.id) ? 'is-open' : ''}`}>
              <div className="gz-ed-mvs">
                <button onClick={() => moveTopic(topic.id, 'up')} disabled={topicIdx === 0 || saving} className="gz-ed-mv" aria-label="Move up">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button onClick={() => moveTopic(topic.id, 'down')} disabled={topicIdx === topics.length - 1 || saving} className="gz-ed-mv" aria-label="Move down">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>

              <div className="gz-ed-no">{String(topicIdx + 1).padStart(2, '0')}</div>

              {editingTopicId === topic.id ? (
                <input
                  value={editingTopicTitle}
                  onChange={e => setEditingTopicTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') updateTopic(topic.id); if (e.key === 'Escape') setEditingTopicId(null) }}
                  autoFocus
                  className="gz-ed-input gz-ed-input--sm"
                />
              ) : (
                <div className="gz-ed-topic__title">
                  <b>{topic.title}</b>
                  <span>{topic.content.length} lecture{topic.content.length !== 1 ? 's' : ''}</span>
                </div>
              )}

              <div className="gz-ed-acts">
                {editingTopicId === topic.id ? (
                  <>
                    <button onClick={() => updateTopic(topic.id)} disabled={saving} className="gz-btn gz-ed-sm">Save</button>
                    <button onClick={() => setEditingTopicId(null)} className="gz-btn gz-btn--ghost gz-ed-sm">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingTopicId(topic.id); setEditingTopicTitle(topic.title) }} className="gz-btn gz-btn--ghost gz-ed-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      <span className="gz-ed-lbl">Rename</span>
                    </button>
                    <button onClick={() => openAddContent(topic.id)} className="gz-btn gz-ed-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      <span className="gz-ed-lbl">Add lecture</span>
                    </button>
                    <button
                      onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(topic.id) ? n.delete(topic.id) : n.add(topic.id); return n })}
                      className="gz-btn gz-btn--ghost gz-ed-sm"
                    >
                      {expanded.has(topic.id) ? 'Collapse' : 'Expand'}
                    </button>
                    <button onClick={() => deleteTopic(topic.id)} disabled={saving} className="gz-ed-del" aria-label="Delete topic">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content list */}
            {expanded.has(topic.id) && (
              <div className="gz-ed-rows">
                {topic.content.length === 0 ? (
                  <div className="gz-ed-empty">
                    No lectures yet.{' '}
                    <button onClick={() => openAddContent(topic.id)}>Add the first one →</button>
                  </div>
                ) : (
                  topic.content.map((item, itemIdx) => (
                    <div key={item.id} className="gz-ed-row">
                      <div className="gz-ed-mvs">
                        <button onClick={() => moveLecture(topic.id, item.id, 'up')} disabled={itemIdx === 0} className="gz-ed-mv" aria-label="Move up">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                        <button onClick={() => moveLecture(topic.id, item.id, 'down')} disabled={itemIdx === topic.content.length - 1} className="gz-ed-mv" aria-label="Move down">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                      </div>

                      <div className={`gz-ed-ico ${(item.videoUrl || item.youtubeUrl) ? 'is-video' : ''}`}>
                        {(item.videoUrl || item.youtubeUrl)
                          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        }
                      </div>

                      <div className="gz-ed-row__main">
                        <div className="gz-ed-row__title">
                          <span>{item.title}</span>
                          {(item as any).isDemo && <span className="gz-ed-tag gz-ed-tag--demo">Demo</span>}
                        </div>
                        {item.description && <p className="gz-ed-row__desc">{item.description}</p>}
                        <div className="gz-ed-links">
                          {(item.videoUrl || item.youtubeUrl) && <span className="gz-ed-link gz-ed-link--video">Video linked</span>}
                          {item.pptUrl && <span className="gz-ed-link gz-ed-link--file">PPT linked</span>}
                        </div>
                      </div>

                      <div className="gz-ed-row__side">
                        <div className="gz-ed-id">
                          <span>ID: {item.id}</span>
                          {item.createdAt && <span>Added: {new Date(item.createdAt).toLocaleDateString('en-GB')}</span>}
                        </div>
                        <button onClick={() => openEditContent(topic.id, item)} className="gz-btn gz-btn--ghost gz-ed-sm">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          <span className="gz-ed-lbl">Edit</span>
                        </button>
                        <button onClick={() => deleteContent(item.id, topic.id)} disabled={saving} className="gz-ed-del" aria-label="Remove lecture">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add New Topic */}
        {addingTopic ? (
          <div className="gz-ed-topic gz-ed-newtopic">
            <input
              value={newTopicTitle}
              onChange={e => setNewTopicTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createTopic(); if (e.key === 'Escape') { setAddingTopic(false); setNewTopicTitle('') } }}
              placeholder="Topic title (e.g. Chapter 1: Introduction)"
              autoFocus
              className="gz-ed-input"
            />
            <button onClick={createTopic} disabled={saving || !newTopicTitle.trim()} className="gz-btn">
              {saving ? 'Adding...' : 'Add Topic'}
            </button>
            <button onClick={() => { setAddingTopic(false); setNewTopicTitle('') }} className="gz-btn gz-btn--ghost">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAddingTopic(true)} className="gz-ed-addtopic">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add New Topic
          </button>
        )}
      </div>
    </div>
  )
}
