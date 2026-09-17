'use client'

import { useState, useRef } from 'react'
import useSWR, { mutate } from 'swr'
import ImageCropper from '@/components/ui/ImageCropper'
import DOMPurify from 'dompurify'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type UpdateType = 'WELCOME' | 'CUSTOM'
type Frequency = 'ONCE' | 'RECURRING'

interface SystemUpdate {
  id: string
  title: string
  content: string
  type: UpdateType
  imageUrl: string | null
  isActive: boolean
  priority: number
  showDelay: number
  frequency: Frequency
  intervalDays: number
  courseIds: string
  ctaText: string | null
  ctaLink: string | null
  startDate: string | null
  endDate: string | null
  animation: string | null
  createdAt: string
  _count: { views: number }
  createdBy: { name: string }
}

interface Settings {
  welcomeEnabled: boolean
  customEnabled: boolean
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────────
function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      style={{
        width: '50px', height: '26px', borderRadius: '13px', border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: value ? 'var(--success)' : 'var(--border)',
        position: 'relative', transition: 'all 0.25s',
        opacity: disabled ? 0.5 : 1,
        boxShadow: value ? '0 4px 12px rgba(16,185,129,0.25)' : 'none',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%', background: 'var(--surface)',
        position: 'absolute', top: '3px',
        left: value ? '27px' : '3px',
        transition: 'left 0.25s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      }} />
    </button>
  )
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, enabled, onToggle }: { title: string; subtitle: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{subtitle}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: enabled ? 'var(--success)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
          {enabled ? 'System ON' : 'System OFF'}
        </span>
        <Toggle value={enabled} onChange={onToggle} />
      </div>
    </div>
  )
}

export default function ManageUpdatesPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const { data, isLoading } = useSWR('/api/updates', fetcher)
  const { data: coursesData } = useSWR('/api/courses', fetcher)

  const allUpdates: SystemUpdate[] = data?.updates || []
  const settings: Settings = data?.settings || { welcomeEnabled: true, customEnabled: true }
  const courses = coursesData?.courses || coursesData || []

  const welcomeUpdates = allUpdates.filter(u => u.type === 'WELCOME')
  const customUpdates = allUpdates.filter(u => u.type === 'CUSTOM')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editType, setEditType] = useState<UpdateType>('CUSTOM')

  // Form fields
  const [title, setTitle] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [priority, setPriority] = useState(0)
  const [showDelay, setShowDelay] = useState(0)
  const [frequency, setFrequency] = useState<Frequency>('ONCE')
  const [intervalDays, setIntervalDays] = useState(7)
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [ctaText, setCtaText] = useState('')
  const [ctaLink, setCtaLink] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [animation, setAnimation] = useState('NONE')
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [cropperImage, setCropperImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  // Recent photos picker states
  const [showRecentModal, setShowRecentModal] = useState(false)
  const [recentPhotos, setRecentPhotos] = useState<string[]>([])
  const [recentPhotosPage, setRecentPhotosPage] = useState(1)
  const [recentPhotosHasNext, setRecentPhotosHasNext] = useState(false)
  const [recentPhotosLoading, setRecentPhotosLoading] = useState(false)

  async function fetchRecentPhotos(pageNumber: number) {
    setRecentPhotosLoading(true)
    try {
      const res = await fetch(`/api/manage/recent-photos?page=${pageNumber}&limit=10`)
      const d = await res.json()
      if (d.photos) {
        setRecentPhotos(d.photos)
        setRecentPhotosHasNext(d.pagination.hasNext)
      }
    } catch (e) {
      console.error('Error fetching recent photos:', e)
    }
    setRecentPhotosLoading(false)
  }

  // ── Settings toggle ────────────────────────────────────────────────────────
  async function patchSettings(patch: Partial<Settings>) {
    await fetch('/api/updates/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    mutate('/api/updates')
  }

  // ── Form helpers ───────────────────────────────────────────────────────────
  function resetForm() {
    setEditId(null)
    setTitle('')
    setIsActive(true)
    setPriority(0)
    setShowDelay(0)
    setFrequency('ONCE')
    setIntervalDays(7)
    setSelectedCourses([])
    setCtaText('')
    setCtaLink('')
    setImageUrl('')
    setStartDate('')
    setEndDate('')
    setAnimation('NONE')
    if (editorRef.current) editorRef.current.innerHTML = ''
  }

  function openCreate(type: UpdateType) {
    resetForm()
    setEditType(type)
    setShowModal(true)
    setTimeout(() => editorRef.current?.focus(), 100)
  }

  function openEdit(u: SystemUpdate) {
    setEditId(u.id)
    setEditType(u.type)
    setTitle(u.title)
    setIsActive(u.isActive)
    setPriority(u.priority)
    setShowDelay(u.showDelay)
    setFrequency(u.frequency)
    setIntervalDays(u.intervalDays)
    setSelectedCourses(u.courseIds ? u.courseIds.split(',').filter(Boolean) : [])
    setCtaText(u.ctaText || '')
    setCtaLink(u.ctaLink || '')
    setImageUrl(u.imageUrl || '')
    setStartDate(u.startDate ? u.startDate.split('T')[0] : '')
    setEndDate(u.endDate ? u.endDate.split('T')[0] : '')
    setAnimation(u.animation || 'NONE')
    setShowModal(true)
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = u.content }, 50)
  }

  async function handleSave() {
    const content = editorRef.current?.innerHTML || ''
    if (!title.trim() || !content.trim()) return

    setSaving(true)
    try {
      const body: any = {
        title: title.trim(),
        content,
        type: editType,
        isActive,
        priority,
        showDelay,
        frequency: editType === 'WELCOME' ? 'ONCE' : frequency,
        intervalDays: frequency === 'RECURRING' ? intervalDays : 0,
        courseIds: editType === 'WELCOME' ? [] : selectedCourses,
        ctaText: ctaText || null,
        ctaLink: ctaLink || null,
        imageUrl: imageUrl || null,
        startDate: editType === 'CUSTOM' && startDate ? startDate : null,
        endDate: editType === 'CUSTOM' && endDate ? endDate : null,
        animation: animation === 'NONE' ? null : animation,
      }

      const url = editId ? `/api/updates/${editId}` : '/api/updates'
      await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      setShowModal(false)
      resetForm()
      mutate('/api/updates')
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const allowed = await confirm({
      title: 'Delete Update?',
      message: 'This update will be removed permanently.',
      confirmLabel: 'Delete Update',
      tone: 'danger',
    })
    if (!allowed) return
    await fetch(`/api/updates/${id}`, { method: 'DELETE' })
    mutate('/api/updates')
  }

  async function toggleActive(u: SystemUpdate) {
    if (togglingId) return
    setTogglingId(u.id)
    try {
      await fetch(`/api/updates/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
      })
      await mutate('/api/updates')
    } catch (e) { console.error(e) }
    finally { setTogglingId(null) }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropperImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleCropComplete(blob: Blob) {
    setCropperImage(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', blob, 'update-image.jpg')
      formData.append('type', 'updates')
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const d = await res.json()
      if (d.url) setImageUrl(d.url)
    } catch (e) { console.error(e) }
    setUploading(false)
  }

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
  }

  // ── Update card ─────────────────────────────────────────────────────────────
  function UpdateCard({ u }: { u: SystemUpdate }) {
    const isWelcome = u.type === 'WELCOME'
    const targetLabel = isWelcome
      ? 'New users only'
      : (u.courseIds
        ? `${u.courseIds.split(',').filter(Boolean).length} course(s)`
        : 'Global')
    const freqLabel = isWelcome
      ? 'Show once (lifetime)'
      : (u.frequency === 'RECURRING' ? `Every ${u.intervalDays}d` : 'Once only')

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '14px 20px', borderRadius: '50px',
        background: 'var(--surface-2)',
        boxShadow: '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)',
        opacity: u.isActive ? 1 : 0.55,
        transition: 'opacity 0.2s',
      }}>
        {/* Badge */}
        <div style={{
          padding: '4px 12px', borderRadius: '20px', fontSize: '10px',
          fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
          background: isWelcome ? 'var(--primary-light)' : 'var(--info-light)',
          color: isWelcome ? 'var(--accent)' : 'var(--info)',
        }}>
          {isWelcome ? 'Welcome' : 'Custom'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {u.title}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
            <span>🎯 {targetLabel}</span>
            <span>🔁 {freqLabel}</span>
            <span>👁 {u._count.views}</span>
          </div>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '10px', fontWeight: '700', color: u.isActive ? 'var(--success)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
            {u.isActive ? 'ON' : 'OFF'}
          </span>
          <Toggle value={u.isActive} onChange={() => toggleActive(u)} disabled={togglingId !== null} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => openEdit(u)} className="btn btn-ghost btn-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={() => handleDelete(u.id)} className="btn btn-sm" style={{ color: 'var(--danger)', border: '1px solid #fee2e2' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="page-container fade-in">
      {confirmDialog}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Welcome Msgs', value: welcomeUpdates.length, color: 'var(--accent)' },
          { label: 'Custom Msgs', value: customUpdates.length, color: 'var(--info)' },
          { label: 'Active Custom', value: customUpdates.filter(u => u.isActive).length, color: 'var(--success)' },
          { label: 'Total Views', value: allUpdates.reduce((s, u) => s + u._count.views, 0), color: 'var(--warning)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: s.color, marginTop: '4px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ─── Welcome Section ─────────────────────── */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <SectionHeader
          title="Welcome Message"
          subtitle="Shown once to new users when they first sign in — never again after it's been seen."
          enabled={settings.welcomeEnabled}
          onToggle={() => patchSettings({ welcomeEnabled: !settings.welcomeEnabled })}
        />

        {isLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : welcomeUpdates.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '2px dashed var(--border)', borderRadius: '12px' }}>
            No welcome message yet.<br />
            <button onClick={() => openCreate('WELCOME')} className="btn btn-primary" style={{ marginTop: '12px', padding: '8px 20px', fontSize: '13px' }}>
              + Create Welcome Message
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {welcomeUpdates.map(u => <UpdateCard key={u.id} u={u} />)}
            <button onClick={() => openCreate('WELCOME')} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
              + Add another welcome message
            </button>
          </div>
        )}
      </div>

      {/* ─── Custom Messages Section ──────────────── */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <SectionHeader
          title="Custom Messages"
          subtitle="Targeted messages for students — control frequency, targeting, and individual ON/OFF per card."
          enabled={settings.customEnabled}
          onToggle={() => patchSettings({ customEnabled: !settings.customEnabled })}
        />

        {isLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : customUpdates.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '2px dashed var(--border)', borderRadius: '12px' }}>
            No custom messages yet.
            <br />
            <button onClick={() => openCreate('CUSTOM')} className="btn btn-primary" style={{ marginTop: '12px', padding: '8px 20px', fontSize: '13px' }}>
              + Create Custom Message
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {customUpdates.map(u => <UpdateCard key={u.id} u={u} />)}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => openCreate('CUSTOM')} className="btn btn-primary" style={{ fontSize: '13px' }}>
                + New Custom Message
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Create / Edit Modal ──────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ zIndex: 100 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>
                {editId ? 'Edit' : 'Create'} {editType === 'WELCOME' ? 'Welcome Message' : 'Custom Message'}
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowPreview(true)} className="btn btn-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  👀 Preview
                </button>
                <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, padding: '24px' }}>

              {/* Type pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: editType === 'WELCOME' ? 'var(--primary-light)' : 'var(--info-light)', alignSelf: 'flex-start' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: editType === 'WELCOME' ? 'var(--accent)' : 'var(--info)', textTransform: 'uppercase' }}>
                  {editType === 'WELCOME' ? '👋 Welcome Message — shown once per user lifetime' : '📢 Custom Message'}
                </span>
              </div>

              {/* Title */}
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Message title" />
              </div>

              {/* Rich Text Editor */}
              <div className="form-group">
                <label className="form-label">Content *</label>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '6px 8px',
                  background: '#f1f3f9', borderRadius: '10px 10px 0 0', border: '1px solid #d0d2d9', borderBottom: 'none',
                }}>
                  {[
                    { cmd: 'bold', icon: 'B', style: { fontWeight: '800' } },
                    { cmd: 'italic', icon: 'I', style: { fontStyle: 'italic' } },
                    { cmd: 'underline', icon: 'U', style: { textDecoration: 'underline' } },
                    { cmd: 'strikeThrough', icon: 'S', style: { textDecoration: 'line-through' } },
                  ].map(b => (
                    <button key={b.cmd} type="button" onClick={() => execCmd(b.cmd)}
                      style={{ width: '30px', height: '28px', border: 'none', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...b.style }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >{b.icon}</button>
                  ))}
                  <div style={{ width: '1px', background: '#d0d2d9', margin: '2px 4px' }} />
                  <button type="button" onClick={() => execCmd('insertUnorderedList')} style={{ width: '30px', height: '28px', border: 'none', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '12px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >☰</button>
                  <button type="button" onClick={() => execCmd('insertOrderedList')} style={{ width: '30px', height: '28px', border: 'none', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '12px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >1.</button>
                  <div style={{ width: '1px', background: '#d0d2d9', margin: '2px 4px' }} />
                  <input type="color" defaultValue="#1e1e3a" onChange={e => execCmd('foreColor', e.target.value)}
                    style={{ width: '28px', height: '28px', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: '2px' }} title="Text Color"
                  />
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  style={{
                    minHeight: '140px', maxHeight: '260px', overflowY: 'auto',
                    padding: '14px', border: '1px solid #d0d2d9', borderRadius: '0 0 10px 10px',
                    fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)',
                    outline: 'none', background: 'var(--surface)',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = '#d0d2d9'}
                />
              </div>

              {/* Image */}
              <div className="form-group">
                <label className="form-label">Attached Image (Optional)</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--surface)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <input type="file" ref={fileInputRef} accept="image/png,image/jpeg" onChange={handleImageSelect} style={{ display: 'none' }} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-sm" style={{ background: 'var(--surface)', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                    {uploading ? 'Uploading…' : '📷 Choose Image'}
                  </button>
                  <button type="button" onClick={() => { setRecentPhotosPage(1); fetchRecentPhotos(1); setShowRecentModal(true); }} className="btn btn-sm" style={{ background: 'var(--surface)', border: '1.5px solid #6366f1', color: 'var(--accent)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    🕒 Choose from Recent
                  </button>
                  {imageUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={imageUrl} alt="" style={{ height: '36px', width: '36px', borderRadius: '6px', objectFit: 'cover' }} />
                      <button type="button" onClick={() => setImageUrl('')} style={{ color: 'var(--danger)', fontSize: '11px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No image selected</span>
                  )}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0, lineHeight: '1.4' }}>
                  💡 <strong>Recommended:</strong> 16:9 aspect ratio (e.g. <code>1200x675 px</code>). Compress under <code>100 KB</code> (WebP/JPG format) for blazing fast loading.
                </p>
              </div>

              {/* Animation */}
              <div className="form-group">
                <label className="form-label">Visual Effect (Optional)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { id: 'NONE', label: 'No Effect', icon: '🚫' },
                    { id: 'CONFETTI', label: 'Confetti', icon: 'confetti' },
                    { id: 'PARTY_POPS', label: 'Party Pops', icon: '🎉' },
                    { id: 'FESTIVAL', label: 'Festival', icon: '🏮' },
                  ].map(anim => (
                    <button
                      key={anim.id}
                      type="button"
                      onClick={() => setAnimation(anim.id)}
                      style={{
                        padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '600',
                        border: animation === anim.id ? '2px solid #6366f1' : '1px solid #cbd5e1',
                        background: animation === anim.id ? 'var(--primary-light)' : '#fff',
                        color: animation === anim.id ? 'var(--primary)' : 'var(--text-secondary)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                        transition: 'all 0.15s',
                      }}
                    >
                      {anim.id === 'CONFETTI' ? <span style={{ fontSize: '14px' }}>🎊</span> : <span style={{ fontSize: '14px' }}>{anim.icon}</span>}
                      {anim.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shared CTA - Now for both Welcome and Custom */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">CTA Button Text (Optional)</label>
                  <input type="text" className="form-input" value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="e.g. View Course" />
                </div>
                <div className="form-group">
                  <label className="form-label">CTA Button Link</label>
                  <input type="text" className="form-input" value={ctaLink} onChange={e => setCtaLink(e.target.value)} placeholder="e.g. /courses/123" />
                </div>
              </div>

              {/* CUSTOM-only fields */}
              {editType === 'CUSTOM' && (
                <>
                  {/* Scheduling */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Start Date (Optional)</label>
                      <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Message becomes active on this day</p>
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Date (Optional)</label>
                      <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Message expires at end of this day</p>
                    </div>
                  </div>

                  {/* Frequency */}
                  <div className="form-group">
                    <label className="form-label">Display Frequency</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['ONCE', 'RECURRING'] as Frequency[]).map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFrequency(f)}
                          style={{
                            padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                            border: frequency === f ? '2px solid #6366f1' : '1px solid #cbd5e1',
                            background: frequency === f ? 'var(--primary-light)' : '#fff',
                            color: frequency === f ? 'var(--primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          {f === 'ONCE' ? '⚡ Show Once' : '🔁 Recurring'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {frequency === 'RECURRING' && (
                    <div className="form-group">
                      <label className="form-label">Repeat Every (days)</label>
                      <input type="number" className="form-input" value={intervalDays} min={1}
                        onChange={e => setIntervalDays(Number(e.target.value))}
                        style={{ maxWidth: '180px' }}
                      />
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Message will re-appear this many days after it was last seen.
                      </p>
                    </div>
                  )}

                  {/* Targeting */}
                  <div className="form-group">
                    <label className="form-label">Targeting</label>
                    <div style={{
                      padding: '14px', borderRadius: '12px',
                      border: '1px solid var(--border)', background: 'var(--surface)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: selectedCourses.length === 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                          {selectedCourses.length === 0 ? '🌍 Global (all students)' : `📚 ${selectedCourses.length} course(s) selected`}
                        </span>
                        {selectedCourses.length > 0 && (
                          <button type="button" onClick={() => setSelectedCourses([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '12px', fontWeight: '600' }}>
                            Reset to Global
                          </button>
                        )}
                      </div>
                      {courses.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                          {courses.map((c: any) => {
                            const checked = selectedCourses.includes(c.id)
                            return (
                              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', background: checked ? 'var(--primary-light)' : 'transparent', transition: 'background 0.15s' }}>
                                <input type="checkbox" checked={checked} onChange={() => {
                                  setSelectedCourses(prev => checked ? prev.filter(id => id !== c.id) : [...prev, c.id])
                                }} style={{ width: '15px', height: '15px' }} />
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: checked ? '600' : '400' }}>{c.name}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        If a student is enrolled in multiple selected courses, they will see this message only once.
                      </p>
                    </div>
                  </div>

                  {/* Priority + delay */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <input type="number" className="form-input" value={priority} min={0} max={100} onChange={e => setPriority(Number(e.target.value))} />
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Higher = shown first</p>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Show Delay (seconds)</label>
                      <input type="number" className="form-input" value={showDelay} min={0} onChange={e => setShowDelay(Number(e.target.value))} />
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Delay before message appears</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: isActive ? 'var(--success)' : 'var(--text-secondary)' }}>
                  {isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
                <Toggle value={isActive} onChange={setIsActive} />
                <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Update Status</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  className="btn btn-primary"
                >
                  {saving ? 'Saving…' : (editId ? 'Update' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Preview Modal ──────────────────────────── */}
      {showPreview && (
        <div className="modal-overlay" style={{ zIndex: 10000, backdropFilter: 'blur(8px)', background: 'rgba(15,23,42,0.6)' }} onClick={() => setShowPreview(false)}>
          <div
            style={{
              maxWidth: '560px', width: '92%', borderRadius: '24px', overflow: 'hidden',
              background: 'var(--surface)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              animation: 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              background: editType === 'WELCOME'
                ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              padding: '36px 28px 24px', textAlign: 'center', position: 'relative', flexShrink: 0,
            }}>
              <button onClick={() => setShowPreview(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              {editType === 'WELCOME' && (
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--surface)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                  <span style={{ fontSize: '36px', lineHeight: '1' }}>👋</span>
                </div>
              )}
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#fff', margin: 0, lineHeight: '1.2' }}>
                {title || 'Message Title'}
              </h2>
              {animation !== 'NONE' && (
                <div style={{ marginTop: '10px', fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ✨ {animation.replace('_', ' ')} Effect Active
                </div>
              )}
            </div>
            {imageUrl && <img src={imageUrl} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', flexShrink: 0 }} />}
            <div style={{ padding: '28px', overflowY: 'auto', flex: 1, background: 'var(--surface)' }}>
              <div
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editorRef.current?.innerHTML || '<p style="color:#9999b0">Content goes here…</p>') }}
                style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.7', wordBreak: 'break-word' }}
              />
            </div>
            <div style={{ padding: '20px 28px', textAlign: 'center', flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {ctaText && ctaLink && (
                <button style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '50px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', flex: 1, maxWidth: '200px' }}>
                  {ctaText}
                </button>
              )}
              <button onClick={() => setShowPreview(false)} style={{ background: ctaText ? 'var(--surface)' : 'var(--text-primary)', color: ctaText ? 'var(--text-secondary)' : '#fff', border: 'none', padding: '14px 24px', borderRadius: '50px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', flex: 1, maxWidth: '200px' }}>
                {editType === 'WELCOME' && !ctaText ? "Let's Get Started" : (ctaText ? 'Close' : 'Got It')}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes bounceIn {
              0% { opacity: 0; transform: scale(0.85); }
              70% { opacity: 1; transform: scale(1.02); }
              100% { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}

      {/* Recently Used Photos Modal */}
      {showRecentModal && (
        <div className="modal-overlay" style={{ zIndex: 10001, backdropFilter: 'blur(8px)', background: 'rgba(15,23,42,0.6)' }} onClick={() => setShowRecentModal(false)}>
          <div
            style={{
              maxWidth: '560px', width: '92%', borderRadius: '24px', overflow: 'hidden',
              background: 'var(--surface)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              animation: 'bounceIn 0.3s ease-out',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              padding: '24px 28px', position: 'relative', flexShrink: 0,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: 0 }}>
                🕒 Choose from Recent Photos
              </h3>
              <button onClick={() => setShowRecentModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, background: 'var(--surface)' }}>
              {recentPhotosLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Loading recent photos…</span>
                </div>
              ) : recentPhotos.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', gap: '8px', border: '2px dashed #cbd5e1', borderRadius: '16px', padding: '20px' }}>
                  <span style={{ fontSize: '32px' }}>📷</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '700' }}>No recently uploaded photos</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Upload a new photo using the &quot;Choose Image&quot; button to get started.</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                  {recentPhotos.map((url, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setImageUrl(url)
                        setShowRecentModal(false)
                      }}
                      style={{
                        position: 'relative',
                        aspectRatio: '16/9',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s ease',
                        background: 'var(--surface-2)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.borderColor = 'var(--accent)'
                        e.currentTarget.style.boxShadow = '0 10px 15px rgba(99, 102, 241, 0.15)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.borderColor = 'transparent'
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)'
                      }}
                    >
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                Page {recentPhotosPage}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={recentPhotosPage === 1 || recentPhotosLoading}
                  onClick={() => {
                    const prevPage = recentPhotosPage - 1
                    setRecentPhotosPage(prevPage)
                    fetchRecentPhotos(prevPage)
                  }}
                  className="btn btn-sm"
                  style={{
                    background: recentPhotosPage === 1 ? 'var(--surface)' : '#fff',
                    color: recentPhotosPage === 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                    border: '1px solid #cbd5e1',
                    cursor: recentPhotosPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '8px'
                  }}
                >
                  ◀ Previous 10
                </button>
                <button
                  type="button"
                  disabled={!recentPhotosHasNext || recentPhotosLoading}
                  onClick={() => {
                    const nextPage = recentPhotosPage + 1
                    setRecentPhotosPage(nextPage)
                    fetchRecentPhotos(nextPage)
                  }}
                  className="btn btn-sm"
                  style={{
                    background: !recentPhotosHasNext ? 'var(--surface)' : '#fff',
                    color: !recentPhotosHasNext ? 'var(--text-muted)' : 'var(--text-secondary)',
                    border: '1px solid #cbd5e1',
                    cursor: !recentPhotosHasNext ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '8px'
                  }}
                >
                  Next 10 ▶
                </button>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Image Cropper */}
      {cropperImage && (
        <ImageCropper
          image={cropperImage}
          aspect={16 / 9}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropperImage(null)}
        />
      )}
    </div>
  )
}
