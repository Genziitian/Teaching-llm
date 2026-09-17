'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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

interface RecordingItem {
  id: string
  title: string
  description?: string
  videoUrl?: string
  videoSource?: string
  pptUrl?: string
  createdAt?: string
  topic?: {
    id: string
    title: string
    course?: {
      id: string
      name: string
      color?: string
    }
  }
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
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [recordingsModalOpen, setRecordingsModalOpen] = useState(false)
  const [loadingRecordings, setLoadingRecordings] = useState(false)
  const [recordingSearch, setRecordingSearch] = useState('')
  const [recordingSort, setRecordingSort] = useState<'newest' | 'oldest'>('newest')
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

      if (role !== 'MANAGER') {
        router.replace(`/courses/${params.id}`)
        return
      }

      if (role === 'ADMIN' && !accessibleCourseIds.includes(params.id as string)) {
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

  const loadRecordings = useCallback(async () => {
    setLoadingRecordings(true)
    try {
      const res = await fetch('/api/content?hasVideo=true')
      const data = await res.json()
      setRecordings(data.content || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingRecordings(false)
    }
  }, [])

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
    setRecordingSearch('')
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
    setRecordingSearch('')
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

  const openRecordingsModal = async () => {
    setRecordingsModalOpen(true)
    setRecordingSearch('')
    await loadRecordings()
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
    <div className="page-container fade-in">
      {confirmDialog}
      {/* Content Form Modal */}
      {contentModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}
        onClick={() => setContentModal(null)}
        >
          <div style={{
            background: 'var(--surface-2)', borderRadius: '16px', width: '100%', maxWidth: '540px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          }}
          onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 20px', borderBottom: '1px solid #d0d2d9',
            }}>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '16px' }}>
                {contentModal.mode === 'add' ? 'Add Lecture' : 'Edit Lecture'}
              </span>
              <button onClick={() => setContentModal(null)} style={{
                width: '32px', height: '32px', borderRadius: '50%', background: 'var(--surface-2)',
                border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)',
                boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Lecture Title *
                </label>
                <input
                  value={contentForm.title}
                  onChange={e => setContentForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Introduction to Variables"
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 14px', borderRadius: '12px',
                background: 'var(--surface)', border: '1px solid var(--border)',
              }}>
                <input
                  type="checkbox"
                  id="isDemoInput"
                  checked={contentForm.isDemo}
                  onChange={e => setContentForm(f => ({ ...f, isDemo: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="isDemoInput" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', cursor: 'pointer' }}>
                   Mark as Demo Lecture (Sample access for non-enrolled students)
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    🎬 Google Drive URL
                  </label>
                  <input
                    value={contentForm.videoUrl}
                    onChange={e => setContentForm(f => ({ ...f, videoUrl: e.target.value }))}
                    placeholder="Google Drive video link"
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    ▶️ YouTube URL
                  </label>
                  <input
                    value={contentForm.youtubeUrl}
                    onChange={e => setContentForm(f => ({ ...f, youtubeUrl: e.target.value }))}
                    placeholder="YouTube video link"
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <button type="button" onClick={openRecordingsModal} className="btn btn-ghost">
                  Import From Recording
                </button>
              </div>

              {recordingsModalOpen && (
                <div style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1100,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                }}
                onClick={() => setRecordingsModalOpen(false)}
                >
                  <div
                    style={{ background: 'var(--surface-2)', borderRadius: '16px', width: '100%', maxWidth: '760px', maxHeight: '80vh', overflow: 'auto', padding: '20px' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Import From Recording</h3>
                      <button type="button" onClick={() => setRecordingsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '12px', marginBottom: '12px' }}>
                      <input
                        value={recordingSearch}
                        onChange={e => setRecordingSearch(e.target.value)}
                        placeholder="Search recordings by lecture, topic, or course..."
                        className="form-input"
                        style={{ width: '100%' }}
                      />
                      <select
                        value={recordingSort}
                        onChange={e => setRecordingSort(e.target.value as 'newest' | 'oldest')}
                        className="form-input"
                        style={{ width: '100%' }}
                      >
                        <option value="newest">Newest to Oldest</option>
                        <option value="oldest">Oldest to Newest</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                      {loadingRecordings ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading recordings...</div>
                      ) : recordings
                        .filter(recording => {
                          const query = recordingSearch.toLowerCase()
                          return (
                            recording.title.toLowerCase().includes(query) ||
                            (recording.description || '').toLowerCase().includes(query) ||
                            (recording.topic?.title || '').toLowerCase().includes(query) ||
                            (recording.topic?.course?.name || '').toLowerCase().includes(query)
                          )
                        })
                        .sort((a, b) => {
                          const aTime = new Date(a.createdAt || 0).getTime()
                          const bTime = new Date(b.createdAt || 0).getTime()
                          return recordingSort === 'newest' ? bTime - aTime : aTime - bTime
                        })
                        .map(recording => (
                          <button
                            key={recording.id}
                            type="button"
                            onClick={() => {
                              if (!contentModal) return
                              fetch(`/api/topics/${contentModal.topicId}/shared-content`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ contentId: recording.id }),
                              })
                                .then(async res => {
                                  const data = await res.json()
                                  if (!res.ok) {
                                    throw new Error(data.error || 'Failed to import recording')
                                  }
                                  setRecordingsModalOpen(false)
                                  setContentModal(null)
                                  await refreshTopics()
                                })
                                .catch(err => {
                                  alert(err instanceof Error ? err.message : 'Failed to import recording')
                                })
                            }}
                            style={{
                              textAlign: 'left', padding: '12px 14px', borderRadius: '12px', border: 'none',
                              background: 'var(--surface)', boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{recording.title}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {recording.topic?.course?.name || 'Unknown Course'} • {recording.topic?.title || 'No Topic'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {recording.createdAt ? new Date(recording.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No date'}
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Material Source Type
                </label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${materialSourceType === 'FILE' ? 'var(--accent)' : 'var(--surface-2)'}`, background: materialSourceType === 'FILE' ? 'var(--primary-light)' : 'transparent' }}>
                    <input
                      type="radio"
                      name="lectureMaterialSource"
                      checked={materialSourceType === 'FILE'}
                      onChange={() => {
                        setMaterialSourceType('FILE')
                        setMaterialLink('')
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: materialSourceType === 'FILE' ? '600' : '500', color: 'var(--text-primary)' }}>📄 Upload File</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${materialSourceType === 'LINK' ? 'var(--accent)' : 'var(--surface-2)'}`, background: materialSourceType === 'LINK' ? 'var(--primary-light)' : 'transparent' }}>
                    <input
                      type="radio"
                      name="lectureMaterialSource"
                      checked={materialSourceType === 'LINK'}
                      onChange={() => {
                        setMaterialSourceType('LINK')
                        setSelectedMaterial(null)
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: materialSourceType === 'LINK' ? '600' : '500', color: 'var(--text-primary)' }}>🔗 External Link</span>
                  </label>
                </div>
              </div>

              {materialSourceType === 'FILE' ? (
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Uploaded Material
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="file"
                        onChange={e => void handleMaterialFileChange(e.target.files?.[0] ?? null)}
                        style={{ display: 'none' }}
                        id="lecture-material-upload"
                      />
                      <label
                        htmlFor="lecture-material-upload"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '12px 20px', borderRadius: '14px',
                          background: 'var(--surface-2)', boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
                          cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)'
                        }}
                      >
                        {uploadingMaterial ? 'Uploading...' : selectedMaterial ? selectedMaterial.title : 'Choose file...'}
                      </label>
                    </div>
                    {selectedMaterial && (
                      <div style={{
                        padding: '12px 16px', borderRadius: '14px',
                        background: 'var(--primary-light)', color: 'var(--accent)',
                        fontSize: '11px', fontWeight: '800'
                      }}>
                        {selectedMaterial.fileType}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
                    Optional. Upload a file if this lecture should include downloadable material.
                  </span>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Material Link
                  </label>
                  <input
                    value={materialLink}
                    onChange={e => setMaterialLink(e.target.value)}
                    placeholder="https://... (external material link)"
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  value={contentForm.description}
                  onChange={e => setContentForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of what this lecture covers..."
                  rows={3}
                  className="form-input"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button onClick={() => setContentModal(null)} className="btn btn-ghost">Cancel</button>
                <button
                  onClick={saveContent}
                  disabled={saving || !contentForm.title.trim()}
                  className="btn btn-primary"
                >
                  {saving ? 'Saving...' : contentModal.mode === 'add' ? 'Add Lecture' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{
          background: getCourseBackground(course.color),
          padding: '24px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', width: '160px', height: '160px', borderRadius: '50%', background: getCourseDecorativeColor(course.color), top: '-50px', right: '30px' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            <div>
              <Link href={`/courses/${params.id}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                color: getCourseSecondaryTextColor(course.color), fontSize: '13px', marginBottom: '10px', textDecoration: 'none',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Course
              </Link>
              <h1 style={{ fontSize: '22px', fontWeight: '700', color: getCourseTextColor(course.color), marginBottom: '4px' }}>
                {course.name} — Manage Content
              </h1>
              <p style={{ color: getCourseSecondaryTextColor(course.color), fontSize: '13px' }}>
                {topics.length} topic{topics.length !== 1 ? 's' : ''} &middot; {topics.reduce((a, t) => a + t.content.length, 0)} lectures
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {orderDirty && (
                <button
                  onClick={saveOrder}
                  disabled={savingOrder}
                  style={{
                    background: 'var(--success)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '10px 20px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: savingOrder ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(34,197,94,0.4)',
                    animation: 'pulse 2s infinite',
                    opacity: savingOrder ? 0.7 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  {savingOrder ? 'Saving...' : 'Save'}
                </button>
              )}
              <div style={{
                background: getCourseBadgeBg(course.color), borderRadius: '12px', padding: '10px 16px',
                border: `1px solid ${getCourseBadgeBg(course.color)}`, color: getCourseBadgeText(course.color), fontSize: '12px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Admin / Manager View
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Topics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {topics.map((topic, topicIdx) => (
          <div key={topic.id} className="card" style={{ overflow: 'hidden' }}>
            {/* Topic Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 20px', borderBottom: expanded.has(topic.id) ? '1px solid var(--border)' : 'none',
              background: 'var(--surface-2)',
            }}>
              {/* Order controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                <button
                  onClick={() => moveTopic(topic.id, 'up')}
                  disabled={topicIdx === 0 || saving}
                  style={{
                    width: '20px', height: '20px', borderRadius: '4px', background: 'var(--surface-2)',
                    border: 'none', cursor: topicIdx === 0 ? 'not-allowed' : 'pointer',
                    opacity: topicIdx === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b6b8a" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button
                  onClick={() => moveTopic(topic.id, 'down')}
                  disabled={topicIdx === topics.length - 1 || saving}
                  style={{
                    width: '20px', height: '20px', borderRadius: '4px', background: 'var(--surface-2)',
                    border: 'none', cursor: topicIdx === topics.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: topicIdx === topics.length - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b6b8a" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>

              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: colorWithOpacity(course.color, '18'), color: extractHex(course.color),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: '700', flexShrink: 0,
              }}>
                {String(topicIdx + 1).padStart(2, '0')}
              </div>

              {editingTopicId === topic.id ? (
                <input
                  value={editingTopicTitle}
                  onChange={e => setEditingTopicTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') updateTopic(topic.id); if (e.key === 'Escape') setEditingTopicId(null) }}
                  autoFocus
                  className="form-input"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '14px' }}
                />
              ) : (
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{topic.title}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    {topic.content.length} lecture{topic.content.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {editingTopicId === topic.id ? (
                  <>
                    <button onClick={() => updateTopic(topic.id)} disabled={saving} className="btn btn-primary btn-sm">Save</button>
                    <button onClick={() => setEditingTopicId(null)} className="btn btn-ghost btn-sm">Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingTopicId(topic.id); setEditingTopicTitle(topic.title) }}
                      className="btn btn-ghost btn-sm"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Rename
                    </button>
                    <button onClick={() => openAddContent(topic.id)} className="btn btn-primary btn-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add Lecture
                    </button>
                    <button
                      onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(topic.id) ? n.delete(topic.id) : n.add(topic.id); return n })}
                      className="btn btn-ghost btn-sm"
                    >
                      {expanded.has(topic.id) ? 'Collapse' : 'Expand'}
                    </button>
                    <button onClick={() => deleteTopic(topic.id)} disabled={saving} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                      color: 'var(--danger)', borderRadius: '6px', display: 'flex', alignItems: 'center',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content list */}
            {expanded.has(topic.id) && (
              <div>
                {topic.content.length === 0 ? (
                  <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
                    No lectures yet.{' '}
                    <button onClick={() => openAddContent(topic.id)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                      Add the first one →
                    </button>
                  </div>
                ) : (
                  topic.content.map((item, itemIdx) => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '12px 20px',
                      borderBottom: itemIdx < topic.content.length - 1 ? '1px solid #ebebf0' : 'none',
                    }}>
                      {/* Lecture move buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                        <button
                          onClick={() => moveLecture(topic.id, item.id, 'up')}
                          disabled={itemIdx === 0}
                          style={{
                            width: '20px', height: '20px', borderRadius: '4px', background: 'var(--surface-2)',
                            border: 'none', cursor: itemIdx === 0 ? 'not-allowed' : 'pointer',
                            opacity: itemIdx === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)',
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b6b8a" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button
                          onClick={() => moveLecture(topic.id, item.id, 'down')}
                          disabled={itemIdx === topic.content.length - 1}
                          style={{
                            width: '20px', height: '20px', borderRadius: '4px', background: 'var(--surface-2)',
                            border: 'none', cursor: itemIdx === topic.content.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: itemIdx === topic.content.length - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)',
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b6b8a" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                      </div>

                      <div style={{
                        width: '30px', height: '30px', borderRadius: '8px',
                        background: (item.videoUrl || item.youtubeUrl) ? 'var(--primary-light)' : 'var(--surface-2)',
                        color: (item.videoUrl || item.youtubeUrl) ? 'var(--primary)' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {(item.videoUrl || item.youtubeUrl)
                          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{item.title}</span>
                          {(item as any).isDemo && (
                            <span style={{
                              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                              color: '#fff', padding: '2px 8px', borderRadius: '12px',
                              fontSize: '10px', fontWeight: '800', letterSpacing: '0.04em'
                            }}>
                              DEMO
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                            {item.description}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '3px' }}>
                          {(item.videoUrl || item.youtubeUrl) && <span style={{ fontSize: '11px', color: 'var(--primary)' }}>📹 Video linked</span>}
                          {item.pptUrl && <span style={{ fontSize: '11px', color: 'var(--success)' }}>📄 PPT linked</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginRight: '8px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px', fontStyle: 'italic' }}>
                            ID: {item.id}
                          </div>
                          {item.createdAt && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Added: {new Date(item.createdAt).toLocaleDateString('en-GB')}
                            </div>
                          )}
                        </div>
                        <button onClick={() => openEditContent(topic.id, item)} className="btn btn-ghost btn-sm">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Edit
                        </button>
                        <button onClick={() => deleteContent(item.id, topic.id)} disabled={saving} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                          color: 'var(--danger)', borderRadius: '6px', display: 'flex', alignItems: 'center',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                          </svg>
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
          <div className="card" style={{ padding: '16px 20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              value={newTopicTitle}
              onChange={e => setNewTopicTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createTopic(); if (e.key === 'Escape') { setAddingTopic(false); setNewTopicTitle('') } }}
              placeholder="Topic title (e.g. Chapter 1: Introduction)"
              autoFocus
              className="form-input"
              style={{ flex: 1 }}
            />
            <button onClick={createTopic} disabled={saving || !newTopicTitle.trim()} className="btn btn-primary">
              {saving ? 'Adding...' : 'Add Topic'}
            </button>
            <button onClick={() => { setAddingTopic(false); setNewTopicTitle('') }} className="btn btn-ghost">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingTopic(true)}
            style={{
              padding: '14px 20px', borderRadius: '12px',
              border: '2px dashed var(--neu-dark)', background: 'transparent',
              cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13.5px', fontWeight: '500',
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--neu-dark)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add New Topic
          </button>
        )}
      </div>
    </div>
  )
}
