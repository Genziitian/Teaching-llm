'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

interface ContentItem {
  id: string
  title: string
  description?: string
  videoUrl: string
  videoSource?: string
  pptUrl?: string
  createdAt: string
  isRecordingOnly?: boolean
  topicId: string
  topic: {
    id: string
    title: string
    courseId: string
    course: { id: string; name: string; color: string }
  }
}

export default function RecordingsPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [lectures, setLectures] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const loadingFact = useLoadingFact(loading)
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [courses, setCourses] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [videoModal, setVideoModal] = useState<{ url: string; title: string } | null>(null)
  const [role, setRole] = useState('')
  const [editingLecture, setEditingLecture] = useState<ContentItem | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', videoUrl: '', pptUrl: '' })
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [contentData, courseData, meData] = await Promise.all([
        fetch('/api/content?hasVideo=true').then(r => r.json()),
        fetch('/api/courses').then(r => r.json()),
        fetch('/api/auth/me').then(r => r.json()),
      ])
      setLectures(contentData.content || [])
      setCourses((courseData.courses || courseData || []).map((c: { id: string; name: string; color: string }) => ({ id: c.id, name: c.name, color: c.color })))
      setRole(meData.user?.role || '')
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openEdit(lecture: ContentItem) {
    setEditingLecture(lecture)
    setEditForm({
      title: lecture.title || '',
      description: lecture.description || '',
      videoUrl: lecture.videoUrl || '',
      pptUrl: lecture.pptUrl || '',
    })
  }

  async function saveEdit() {
    if (!editingLecture) return
    setSaving(true)
    try {
      const res = await fetch(`/api/content/${editingLecture.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update recording')
      }
      setEditingLecture(null)
      await loadData()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update recording')
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecording(lecture: ContentItem) {
    const allowed = await confirm({
      title: 'Delete Recording?',
      message: `This will permanently remove "${lecture.title}" from recordings and every course where it is used.`,
      confirmLabel: 'Delete Recording',
      tone: 'danger',
    })
    if (!allowed) return

    const res = await fetch(`/api/content/${lecture.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceDelete: true }),
    })

    if (!res.ok) {
      const data = await res.json()
      alert(data.error || 'Failed to delete recording')
      return
    }

    await loadData()
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/content?hasVideo=true').then(r => r.json()),
      fetch('/api/courses').then(r => r.json()),
    ]).then(([contentData, courseData]) => {
      setLectures(contentData.content || [])
      setCourses((courseData.courses || courseData || []).map((c: { id: string; name: string; color: string }) => ({ id: c.id, name: c.name, color: c.color })))
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = lectures.filter(l => {
    const matchSearch =
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.topic?.course?.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.topic?.title?.toLowerCase().includes(search.toLowerCase())
    const matchCourse = courseFilter === 'all' || l.topic?.course?.id === courseFilter
    return matchSearch && matchCourse
  })

  const getEmbedUrl = (url: string) => {
    if (!url) return url
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\s]+)/)
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`
    return url
  }

  if (loading) {
    return (
      <div className="page-container">
        {loadingFact && (
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <LoadingFactCard fact={loadingFact} />
          </div>
        )}
        <div className="grid-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card skeleton" style={{ height: '200px' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container fade-in">
      {confirmDialog}

      {editingLecture && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
          onClick={() => setEditingLecture(null)}
        >
          <div
            style={{
              background: 'var(--surface-2)', borderRadius: '18px', width: '100%', maxWidth: '560px',
              padding: '22px', boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>Edit Recording</h3>
              <button onClick={() => setEditingLecture(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text-secondary)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input className="form-input" value={editForm.title} onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Lecture title" />
              <input className="form-input" value={editForm.videoUrl} onChange={e => setEditForm(prev => ({ ...prev, videoUrl: e.target.value }))} placeholder="Video URL" />
              <input className="form-input" value={editForm.pptUrl} onChange={e => setEditForm(prev => ({ ...prev, pptUrl: e.target.value }))} placeholder="Material link" />
              <textarea className="form-input" rows={4} value={editForm.description} onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Description" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingLecture(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={saveEdit}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {videoModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}
        onClick={() => setVideoModal(null)}
        >
          <div style={{
            background: 'var(--surface-2)', borderRadius: '16px', overflow: 'hidden',
            width: '100%', maxWidth: '880px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}
          onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', borderBottom: '1px solid #d0d2d9',
            }}>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>{videoModal.title}</span>
              <button onClick={() => setVideoModal(null)} style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--surface-2)', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)',
                boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>
            <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
              <iframe
                src={getEmbedUrl(videoModal.url)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div style={{ marginBottom: '16px', position: 'relative', maxWidth: '420px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
          style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search recordings…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '11px 16px 11px 44px',
            borderRadius: '50px',
            border: 'none', outline: 'none',
            background: 'var(--surface-2)',
            boxShadow: 'inset 4px 4px 8px var(--neu-dark), inset -4px -4px 8px var(--neu-light)',
            fontSize: '14.5px', color: 'var(--text-primary)', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Subject filter chips */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setCourseFilter('all')}
          style={{
            padding: '8px 20px', borderRadius: '50px', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '13.5px', fontWeight: '700', transition: 'all 0.2s ease',
            background: courseFilter === 'all' ? 'var(--primary)' : 'var(--surface-2)',
            color:      courseFilter === 'all' ? '#ffffff'  : 'var(--text-secondary)',
            boxShadow:  courseFilter === 'all'
              ? '4px 4px 10px rgba(54,54,232,0.35), -2px -2px 6px var(--neu-glow)'
              : '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
          }}
        >
          All Courses
        </button>
        {courses.map(cls => (
          <button
            key={cls.id}
            onClick={() => setCourseFilter(cls.id)}
            style={{
              padding: '8px 20px', borderRadius: '50px', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '13.5px', fontWeight: '700', transition: 'all 0.2s ease',
              background: courseFilter === cls.id ? cls.color : 'var(--surface-2)',
              color:      courseFilter === cls.id ? '#ffffff' : 'var(--text-secondary)',
              boxShadow:  courseFilter === cls.id
                ? `4px 4px 10px ${cls.color}55, -2px -2px 6px var(--neu-glow)`
                : '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
            }}
          >
            {cls.name}
          </button>
        ))}
      </div>

      {/* Recordings list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map((lec) => {
          const course = lec.topic?.course
          return (
            <div key={lec.id} style={{
              display: 'flex', alignItems: 'center', gap: '18px',
              padding: '16px 24px', borderRadius: '50px',
              background: 'var(--surface-2)',
              boxShadow: '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)',
              transition: 'box-shadow 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '8px 8px 16px var(--neu-dark), -8px -8px 16px var(--neu-light)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)')}
            >
              {/* Play badge */}
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                background: 'var(--surface-2)', boxShadow: '3px 3px 7px var(--neu-dark), -3px -3px 7px var(--neu-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={course?.color || 'var(--accent)'} stroke="none">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lec.title}</span>
                  {lec.createdAt && new Date().getTime() - new Date(lec.createdAt).getTime() < 24 * 60 * 60 * 1000 && (
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
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {course && (
                    <span style={{
                      padding: '2px 10px', borderRadius: '50px',
                      background: (course.color || 'var(--accent)') + '18',
                      color: course.color || 'var(--accent)',
                      fontWeight: '700', fontSize: '12px',
                    }}>
                      {course.name}
                    </span>
                  )}
                  {lec.topic?.title && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {lec.topic.title}
                    </span>
                  )}
                  {lec.isRecordingOnly && (
                    <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '700' }}>
                      Recording only
                    </span>
                  )}
                  <span>&bull; {new Date(lec.createdAt).toLocaleDateString('en-GB', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {lec.pptUrl && (
                  <a
                    href={lec.pptUrl.startsWith('/api/files/materials/') ? lec.pptUrl : `/api/drive-doc/${lec.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download Notes
                  </a>
                )}
                <Link
                  href={`/courses/${lec.topic?.course?.id}/lectures/${lec.id}`}
                  className="btn btn-primary btn-sm"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Watch
                </Link>
                {role === 'MANAGER' && (
                  <>
                    <button type="button" onClick={() => openEdit(lec)} className="btn btn-ghost btn-sm">
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteRecording(lec)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
          </svg>
          <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>No recordings found</p>
          <p style={{ fontSize: '13px' }}>Try adjusting your search or course filter</p>
        </div>
      )}
    </div>
  )
}
