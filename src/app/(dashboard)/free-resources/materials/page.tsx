'use client'

import { ReactNode, useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import {
  IITM_LEVELS,
  IITM_SUBJECTS_BY_LEVEL,
  IITM_ALL_SUBJECTS,
} from '@/lib/iitm-taxonomy'

const fetcher = (url: string) => fetch(url).then(r => r.json())

/**
 * Reusable label + select pair with a left-side SVG glyph. Used for both
 * the Level and Subject filters on the Free Materials page; kept as a small
 * component so the styling stays consistent and the page body stays readable.
 */
function FilterSelect({
  label, icon, value, onChange, options, placeholder,
}: {
  label: string
  icon: ReactNode
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <div className="form-group" style={{ margin: 0 }}>
      <label
        className="form-label"
        style={{
          fontSize: '11px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: '#6b6b8a',
        }}
      >
        <span style={{ color: '#4F46E5', display: 'inline-flex' }}>{icon}</span>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9999b0',
            pointerEvents: 'none',
            display: 'inline-flex',
          }}
        >
          {icon}
        </span>
        <select
          className="form-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ paddingLeft: '34px' }}
        >
          <option value="">{placeholder}</option>
          {options.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

type Category = 'ASSIGNMENT' | 'PYQ' | 'NOTE'
const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: 'ASSIGNMENT', label: 'Assignments', icon: '' },
  { value: 'PYQ',        label: 'PYQs',        icon: '' },
  { value: 'NOTE',       label: 'Notes',       icon: '' },
]

interface Material {
  id: string
  title: string
  description?: string | null
  fileUrl: string
  fileType: string
  fileSize?: string | null
  sourceType: string
  category: string
  level?: string | null
  subject?: string | null
  term?: string | null
  uploadedAt: string
}

interface OptionsResp {
  levels: string[]
  subjects: string[]
  bySubject: Record<string, string[]>
}

export default function FreeMaterialsPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const { data: authData } = useSWR('/api/auth/me', fetcher)
  const userRole = authData?.user?.role || ''
  const canManage = userRole === 'MANAGER'

  // Filter state — drives the data fetch URL via SWR cache keys.
  const [level, setLevel] = useState<string>('')
  const [subject, setSubject] = useState<string>('')
  const [category, setCategory] = useState<Category>('ASSIGNMENT')

  const { data: options } = useSWR<OptionsResp>(
    '/api/free-resources/materials/options',
    fetcher,
  )

  // Build a stable query key — SWR will refetch when this changes.
  const listUrl = useMemo(() => {
    const q = new URLSearchParams({ category })
    if (level) q.set('level', level)
    if (subject) q.set('subject', subject)
    return `/api/free-resources/materials?${q.toString()}`
  }, [level, subject, category])

  const { data: materials, isLoading } = useSWR<Material[]>(listUrl, fetcher)

  // Narrow Subject options to subjects that actually exist for the chosen
  // Level — keeps the student from picking a combo with zero matches.
  const subjectsForLevel: string[] = level
    ? options?.bySubject?.[level] ?? []
    : options?.subjects ?? []

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [sourceType, setSourceType] = useState<'FILE' | 'LINK'>('FILE')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID')
  const [uploading, setUploading] = useState(false)

  const closeModal = () => {
    setShowModal(false)
    setEditId(null)
    setFormData({})
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const data = new FormData()
      data.append('file', file)
      data.append('type', 'materials')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: data,
      })

      if (res.ok) {
        const json = await res.json()
        set('fileUrl', json.url)
        
        const ext = file.name.split('.').pop() || ''
        set('fileType', ext.toLowerCase())
        
        const sizeKB = file.size / 1024
        const sizeStr = sizeKB > 1024 
          ? `${(sizeKB / 1024).toFixed(1)} MB` 
          : `${Math.round(sizeKB)} KB`
        set('fileSize', sizeStr)
        
        if (!formData.title) {
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
          set('title', nameWithoutExt)
        }
      } else {
        const err = await res.json()
        alert(err.error || 'Upload failed')
      }
    } catch (err) {
      console.error(err)
      alert('Error uploading file')
    }
    setUploading(false)
  }

  const set = (key: string, val: string) =>
    setFormData(prev => ({ ...prev, [key]: val }))

  async function handleSave() {
    if (!formData.title) {
      alert('Title is required')
      return
    }
    if (!formData.fileUrl) {
      alert(
        sourceType === 'FILE'
          ? 'Please provide a file URL'
          : 'Please provide a link URL',
      )
      return
    }
    if (
      !formData.fileUrl.startsWith('http://') &&
      !formData.fileUrl.startsWith('https://')
    ) {
      alert('Please enter a valid URL starting with http:// or https://')
      return
    }

    setSaving(true)
    try {
      const url = editId
        ? `/api/materials/${editId}`
        : '/api/free-resources/materials'
      const method = editId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          sourceType,
          category: formData.category || 'NOTE',
        }),
      })
      if (res.ok) {
        closeModal()
        // Refresh both the list AND the options endpoint so a freshly
        // introduced level/subject value populates the dropdown right away.
        mutate(listUrl)
        mutate('/api/free-resources/materials/options')
      } else {
        const data = await res.json()
        alert(data.error || `Failed to ${editId ? 'update' : 'create'} material`)
      }
    } catch (e) {
      console.error(e)
      alert(`Error ${editId ? 'updating' : 'creating'} material`)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const allowed = await confirm({
      title: 'Delete Material?',
      message: 'This free material will be permanently removed.',
      confirmLabel: 'Delete Material',
      tone: 'danger',
    })
    if (!allowed) return
    await fetch(`/api/materials/${id}`, { method: 'DELETE' })
    mutate(listUrl)
    mutate('/api/free-resources/materials/options')
  }

  function getFileIcon(fileType: string) {
    const type = (fileType || '').toLowerCase()
    if (type === 'link') return '🔗'
    if (type.includes('pdf')) return '📄'
    if (type.includes('doc') || type.includes('word')) return '📝'
    if (type.includes('ppt') || type.includes('presentation')) return '📊'
    if (type.includes('xls') || type.includes('sheet')) return '📈'
    if (type.includes('image') || type.includes('png') || type.includes('jpg')) return '🖼️'
    if (type.includes('video') || type.includes('mp4')) return '🎬'
    return '📎'
  }

  return (
    <div className="page-container fade-in">
      {confirmDialog}

      <div className="page-header">
        <div />
        {canManage && (
          <button
            onClick={() => {
              // Pre-fill new uploads with the currently selected filter so the
              // manager doesn't have to re-type the level/subject/category
              // they were already browsing.
              setFormData({
                level: level || '',
                subject: subject || '',
                category,
              })
              setSourceType('FILE')
              setShowModal(true)
            }}
            className="btn btn-primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Free Material
          </button>
        )}
      </div>

      {/* Filters: Level + Subject — stack on phones, side-by-side from
          480px up. Each select sits inside a relative-positioned wrapper
          so a small SVG glyph can be absolutely positioned on the left. */}
      <div
        className="card"
        style={{
          padding: '14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '14px',
        }}
      >
        <FilterSelect
          label="LEVEL"
          icon={
            // Stacked-bars "level" glyph — reads as a difficulty/level ramp.
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="4"  y1="20" x2="4"  y2="14" />
              <line x1="10" y1="20" x2="10" y2="10" />
              <line x1="16" y1="20" x2="16" y2="6"  />
            </svg>
          }
          value={level}
          onChange={v => { setLevel(v); setSubject('') }}
          options={options?.levels ?? []}
          placeholder="Any level"
        />
        <FilterSelect
          label="SUBJECT"
          icon={
            // Open-book glyph — matches the FlutterMaterialBrowsePage "Notes"
            // tab icon and reads as "subject / textbook".
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2 3h7a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-7a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h8z" />
            </svg>
          }
          value={subject}
          onChange={setSubject}
          options={subjectsForLevel}
          placeholder="Any subject"
        />
      </div>

      {/* Category tabs — labels shrink on narrow screens via CSS clamp(). */}
      <div
        className="card"
        style={{
          padding: '6px',
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
        }}
      >
        {CATEGORIES.map(c => {
          const active = c.value === category
          return (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              title={c.label}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '10px 8px',
                border: 'none',
                borderRadius: '10px',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#ffffff' : 'var(--text-secondary)',
                fontSize: 'clamp(11px, 2.6vw, 13.5px)',
                fontWeight: active ? 800 : 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span>{c.icon}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
            </button>
          )
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading…
        </div>
      ) : !materials || materials.length === 0 ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>
            {CATEGORIES.find(c => c.value === category)?.icon}
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>
            No {CATEGORIES.find(c => c.value === category)?.label.toLowerCase()} yet
          </div>
          <div style={{ marginTop: '4px', fontSize: '12.5px' }}>
            {level || subject
              ? 'Try a different level or subject above.'
              : canManage
                ? 'Click "Add Free Material" to upload the first one.'
                : 'Check back soon — the team uploads new resources regularly.'}
          </div>
        </div>
      ) : (
        <>
          {/* Layout selector and stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', padding: '0 4px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {materials.length} {materials.length === 1 ? 'item' : 'items'} found
            </span>
            <div style={{ display: 'flex', background: 'var(--surface-2)', padding: '2px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
              <button
                onClick={() => setViewMode('GRID')}
                title="Square View"
                style={{
                  background: viewMode === 'GRID' ? 'var(--accent)' : 'transparent',
                  color: viewMode === 'GRID' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s ease', fontWeight: 700
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span>Square</span>
              </button>
              <button
                onClick={() => setViewMode('LIST')}
                title="List View"
                style={{
                  background: viewMode === 'LIST' ? 'var(--accent)' : 'transparent',
                  color: viewMode === 'LIST' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s ease', fontWeight: 700
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span>List</span>
              </button>
            </div>
          </div>

          {viewMode === 'GRID' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '14px' }}>
              {materials.map(mat => (
                <div key={mat.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>{getFileIcon(mat.fileType)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {mat.title}
                      </div>
                      {mat.description && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {mat.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: mat.sourceType === 'LINK' ? 'var(--info-light)' : 'var(--success-light)', color: mat.sourceType === 'LINK' ? 'var(--info)' : 'var(--success)', fontWeight: '600' }}>
                      {mat.sourceType === 'LINK' ? 'LINK' : (mat.fileType || 'File').toUpperCase()}
                    </span>
                    {mat.subject && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--accent)', fontWeight: 600 }}>
                        {mat.subject}
                      </span>
                    )}
                    {mat.level && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--warning-light)', color: 'var(--warning)', fontWeight: 600 }}>
                        {mat.level}
                      </span>
                    )}
                    {mat.term && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--success-light)', color: 'var(--success)', fontWeight: 600 }}>
                        {mat.term}
                      </span>
                    )}
                    {mat.fileSize && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{mat.fileSize}</span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {new Date(mat.uploadedAt).toLocaleDateString('en-GB')}
                    </span>
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                    {(
                      (mat.fileType || '').toLowerCase().includes('pdf') ||
                      /\.pdf(\?|$)/i.test(mat.fileUrl)
                    ) ? (
                      <a
                        href={`/free-resources/materials/${mat.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{ flex: 1, textAlign: 'center', textDecoration: 'none', fontSize: '13px' }}
                      >
                        Download Notes
                      </a>
                    ) : (
                      <a
                        href={mat.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{ flex: 1, textAlign: 'center', textDecoration: 'none', fontSize: '13px' }}
                      >
                        {mat.sourceType === 'LINK' ? 'Open Link' : 'Download / View'}
                      </a>
                    )}
                    {canManage && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => {
                            setFormData({
                              title: mat.title || '',
                              description: mat.description || '',
                              category: mat.category || 'NOTE',
                              level: mat.level || '',
                              subject: mat.subject || '',
                              term: mat.term || '',
                              fileUrl: mat.fileUrl || '',
                              fileType: mat.fileType || '',
                            })
                            setSourceType((mat.sourceType || 'FILE') as 'FILE' | 'LINK')
                            setEditId(mat.id)
                            setShowModal(true)
                          }}
                          className="btn btn-ghost"
                          style={{ padding: '0 12px', color: 'var(--accent)', borderColor: 'var(--primary-light)' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(mat.id)} className="btn btn-ghost" style={{ padding: '0 12px', color: 'var(--danger)', borderColor: 'var(--danger-light)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {materials.map(mat => (
                <div
                  key={mat.id}
                  className="card"
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Left Column: Icon + Text Content */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
                    <span style={{ fontSize: '32px', flexShrink: 0 }}>{getFileIcon(mat.fileType)}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {mat.title}
                      </div>
                      {mat.description && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {mat.description}
                        </div>
                      )}
                      {/* Badges/Tags */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: mat.sourceType === 'LINK' ? 'var(--info-light)' : 'var(--success-light)', color: mat.sourceType === 'LINK' ? 'var(--info)' : 'var(--success)', fontWeight: '600' }}>
                          {mat.sourceType === 'LINK' ? 'LINK' : (mat.fileType || 'File').toUpperCase()}
                        </span>
                        {mat.subject && (
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--accent)', fontWeight: 600 }}>
                            {mat.subject}
                          </span>
                        )}
                        {mat.level && (
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: 'var(--warning-light)', color: 'var(--warning)', fontWeight: 600 }}>
                            {mat.level}
                          </span>
                        )}
                        {mat.term && (
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: 'var(--success-light)', color: 'var(--success)', fontWeight: 600 }}>
                            {mat.term}
                          </span>
                        )}
                        {mat.fileSize && (
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{mat.fileSize}</span>
                        )}
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          • Uploaded: {new Date(mat.uploadedAt).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
                    {(
                      (mat.fileType || '').toLowerCase().includes('pdf') ||
                      /\.pdf(\?|$)/i.test(mat.fileUrl)
                    ) ? (
                      <a
                        href={`/free-resources/materials/${mat.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{ textAlign: 'center', textDecoration: 'none', fontSize: '13px', padding: '8px 16px' }}
                      >
                        Download Notes
                      </a>
                    ) : (
                      <a
                        href={mat.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{ textAlign: 'center', textDecoration: 'none', fontSize: '13px', padding: '8px 16px' }}
                      >
                        {mat.sourceType === 'LINK' ? 'Open Link' : 'Download / View'}
                      </a>
                    )}
                    {canManage && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => {
                            setFormData({
                              title: mat.title || '',
                              description: mat.description || '',
                              category: mat.category || 'NOTE',
                              level: mat.level || '',
                              subject: mat.subject || '',
                              term: mat.term || '',
                              fileUrl: mat.fileUrl || '',
                              fileType: mat.fileType || '',
                            })
                            setSourceType((mat.sourceType || 'FILE') as 'FILE' | 'LINK')
                            setEditId(mat.id)
                            setShowModal(true)
                          }}
                          className="btn btn-ghost"
                          style={{ padding: '8px 12px', color: 'var(--accent)', borderColor: 'var(--primary-light)' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(mat.id)} className="btn btn-ghost" style={{ padding: '8px 12px', color: 'var(--danger)', borderColor: 'var(--danger-light)' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '16px',
          }}
          onClick={closeModal}
        >
          <div
            className="modal"
            style={{ width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px', color: 'var(--text-primary)' }}>
              {editId ? 'Edit Free Material' : 'Add Free Material'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  value={formData.title || ''}
                  onChange={e => set('title', e.target.value)}
                  placeholder="e.g. Math 1 Term-1 PYQ 2024"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  value={formData.description || ''}
                  onChange={e => set('description', e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical' }}
                  placeholder="Optional description"
                />
              </div>

              {/* Taxonomy row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Type *</label>
                  <select
                    className="form-input"
                    value={formData.category || 'NOTE'}
                    onChange={e => set('category', e.target.value)}
                  >
                    <option value="NOTE">Notes</option>
                    <option value="PYQ">PYQ</option>
                    <option value="ASSIGNMENT">Assignment</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Level</label>
                  <input
                    className="form-input"
                    value={formData.level || ''}
                    onChange={e => set('level', e.target.value)}
                    placeholder="Foundation / Diploma / Degree"
                    list="material-level-options"
                  />
                  <datalist id="material-level-options">
                    {IITM_LEVELS.map(l => (
                      <option key={l} value={l} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Subject</label>
                  <input
                    className="form-input"
                    value={formData.subject || ''}
                    onChange={e => set('subject', e.target.value)}
                    placeholder="e.g. Maths 1, Stats 1, MLF"
                    list="material-subject-options"
                  />
                  {/* Narrow the autocomplete list to the chosen Level when set,
                      otherwise show every curated IITM subject. Managers can
                      still type a custom subject the catalogue doesn't know. */}
                  <datalist id="material-subject-options">
                    {(formData.level && IITM_SUBJECTS_BY_LEVEL[formData.level as keyof typeof IITM_SUBJECTS_BY_LEVEL]
                      ? IITM_SUBJECTS_BY_LEVEL[formData.level as keyof typeof IITM_SUBJECTS_BY_LEVEL]
                      : IITM_ALL_SUBJECTS
                    ).map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Term</label>
                  <input
                    className="form-input"
                    value={formData.term || ''}
                    onChange={e => set('term', e.target.value)}
                    placeholder="e.g. Term 1 · 2024"
                  />
                </div>
              </div>

              {/* Source Type Toggle */}
              <div className="form-group">
                <label className="form-label">Source Type *</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${sourceType === 'FILE' ? 'var(--accent)' : 'var(--surface-2)'}`, background: sourceType === 'FILE' ? 'var(--primary-light)' : 'transparent' }}>
                    <input
                      type="radio"
                      name="sourceType"
                      value="FILE"
                      checked={sourceType === 'FILE'}
                      onChange={() => setSourceType('FILE')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: sourceType === 'FILE' ? '600' : '500', color: 'var(--text-primary)' }}>📄 Upload File</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${sourceType === 'LINK' ? 'var(--accent)' : 'var(--surface-2)'}`, background: sourceType === 'LINK' ? 'var(--primary-light)' : 'transparent' }}>
                    <input
                      type="radio"
                      name="sourceType"
                      value="LINK"
                      checked={sourceType === 'LINK'}
                      onChange={() => setSourceType('LINK')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: sourceType === 'LINK' ? '600' : '500', color: 'var(--text-primary)' }}>🔗 External Link</span>
                  </label>
                </div>
              </div>

              {sourceType === 'FILE' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Choose Local File</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        disabled={uploading}
                        style={{ display: 'none' }}
                        id="material-file-picker"
                      />
                      <label
                        htmlFor="material-file-picker"
                        className="btn btn-ghost"
                        style={{
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          cursor: uploading ? 'not-allowed' : 'pointer',
                          padding: '12px',
                          border: '2px dashed var(--accent)',
                          color: 'var(--accent)',
                          background: 'var(--primary-light)',
                          borderRadius: '8px',
                          fontWeight: 600,
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        {uploading ? 'Uploading File...' : 'Choose File to Upload'}
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">File URL *</label>
                    <input
                      className="form-input"
                      value={formData.fileUrl || ''}
                      onChange={e => set('fileUrl', e.target.value)}
                      placeholder="Upload a file above or paste a link (e.g. Google Drive)"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">File Type</label>
                      <input
                        className="form-input"
                        value={formData.fileType || ''}
                        onChange={e => set('fileType', e.target.value)}
                        placeholder="e.g. pdf, pptx, docx"
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">File Size</label>
                      <input
                        className="form-input"
                        value={formData.fileSize || ''}
                        onChange={e => set('fileSize', e.target.value)}
                        placeholder="e.g. 1.2 MB / 400 KB"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">External Link URL *</label>
                  <input
                    className="form-input"
                    value={formData.fileUrl || ''}
                    onChange={e => set('fileUrl', e.target.value)}
                    placeholder="https://example.com/resource"
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={closeModal} className="btn btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
