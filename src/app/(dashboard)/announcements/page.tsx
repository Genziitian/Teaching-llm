'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import UserAvatar from '@/components/UserAvatar'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

interface AnnouncementClass {
  id: string
  name: string
  color: string
}

interface AnnouncementAuthor {
  id: string
  name: string
  role: string
  avatar: string | null
  gender?: string | null
}

interface Announcement {
  id: string
  title: string
  content: string
  type: string
  classId: string | null
  createdAt: string
  createdBy: AnnouncementAuthor
  class: AnnouncementClass | null
  imageUrl?: string | null
}

interface ClassOption {
  id: string
  name: string
}

type FilterTab = 'all' | 'updates' | 'class'

const TYPE_OPTIONS = [
  { value: 'info',    label: 'Info',    color: 'var(--info)' },
  { value: 'success', label: 'Success', color: 'var(--success)' },
  { value: 'warning', label: 'Warning', color: 'var(--warning)' },
  { value: 'error',   label: 'Urgent',  color: 'var(--danger)' },
]

const TYPE_COLORS: Record<string, string> = {
  info: 'var(--info)', success: 'var(--success)', warning: 'var(--warning)', error: 'var(--danger)',
  INFO: 'var(--info)', SUCCESS: 'var(--success)', WARNING: 'var(--warning)', ERROR: 'var(--danger)',
}

const TYPE_BG: Record<string, string> = {
  info:    'rgba(59,130,246,0.10)',
  success: 'rgba(16,185,129,0.10)',
  warning: 'rgba(245,158,11,0.10)',
  error:   'rgba(239,68,68,0.10)',
  INFO:    'rgba(59,130,246,0.10)',
  SUCCESS: 'rgba(16,185,129,0.10)',
  WARNING: 'rgba(245,158,11,0.10)',
  ERROR:   'rgba(239,68,68,0.10)',
}

const TYPE_LABELS: Record<string, string> = {
  info: 'Info', success: 'Success', warning: 'Warning', error: 'Urgent',
  INFO: 'Info', SUCCESS: 'Success', WARNING: 'Warning', ERROR: 'Urgent',
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'Just now'
  if (mins  < 60) return `${mins} minute${mins  !== 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  if (days  === 1) return 'Yesterday'
  if (days  < 7)  return `${days} days ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

interface AnnouncementMetadata {
  ctaText?: string
  ctaLink?: string
  importance?: 'high' | 'default'
  sound?: 'default' | 'none'
}

function parseAnnouncementContent(content: string): { body: string; metadata: AnnouncementMetadata } {
  const metaRegex = /<!-- fcm_meta:({.*?}) -->$/
  const match = content.match(metaRegex)
  if (match) {
    try {
      const metadata = JSON.parse(match[1])
      const body = content.replace(metaRegex, '').trim()
      return { body, metadata }
    } catch {
      // Ignore
    }
  }
  return { body: content, metadata: {} }
}


function TypeIcon({ type }: { type: string }) {
  const color = TYPE_COLORS[type] || 'var(--info)'
  const bg    = TYPE_BG[type]    || TYPE_BG.info
  const icon  = (() => {
    const t = type.toLowerCase()
    if (t === 'success') return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    )
    if (t === 'warning') return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    )
    if (t === 'error') return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    )
    // info / default: megaphone
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
      </svg>
    )
  })()

  return (
    <div style={{
      width: '52px', height: '52px', borderRadius: '16px',
      background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {icon}
    </div>
  )
}

export default function AnnouncementsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightId  = searchParams.get('id')
  const cardRefs     = useRef<Record<string, HTMLDivElement | null>>({})
  const { confirm, confirmDialog } = useConfirmDialog()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [classes,       setClasses]       = useState<ClassOption[]>([])
  const [loading,       setLoading]       = useState(true)
  const loadingFact = useLoadingFact(loading)
  const [userRole,      setUserRole]      = useState('')
  const [showForm,      setShowForm]      = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [expandedId,    setExpandedId]    = useState<string | null>(highlightId)
  const [activeTab,     setActiveTab]     = useState<FilterTab>('all')

  // Form state
  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [type,    setType]    = useState('info')
  const [classId, setClassId] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [ctaText,  setCtaText]  = useState('')
  const [ctaLink,  setCtaLink]  = useState('')
  const [importance, setImportance] = useState<'high' | 'default'>('high')
  const [sound, setSound] = useState<'default' | 'none'>('default')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [imagePage, setImagePage] = useState(0)

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!loading && highlightId && cardRefs.current[highlightId]) {
      cardRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [loading, highlightId])

  async function loadData() {
    try {
      const [annRes, meRes, classRes] = await Promise.all([
        fetch('/api/announcements'),
        fetch('/api/auth/me'),
        fetch('/api/classes'),
      ])
      const annData   = await annRes.json()
      const meData    = await meRes.json()
      const classData = await classRes.json()
      setAnnouncements(Array.isArray(annData)   ? annData   : [])
      setUserRole(meData.user?.role || meData.role || '')
      setClasses(Array.isArray(classData) ? classData : [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  // Extract up to 100 recently used unique images
  const recentImages = Array.from(
    new Set(
      announcements
        .map(a => a.imageUrl)
        .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    )
  ).slice(0, 100)

  function handleSelectTemplate(templateId: string) {
    setSelectedTemplateId(templateId)
    if (!templateId) return
    const template = announcements.find(a => a.id === templateId)
    if (!template) return

    const { body, metadata } = parseAnnouncementContent(template.content)
    setTitle(template.title)
    setContent(body)
    setType(template.type)
    setClassId(template.classId || '')
    setImageUrl(template.imageUrl || '')
    setCtaText(metadata.ctaText || '')
    setCtaLink(metadata.ctaLink || '')
    setImportance(metadata.importance || 'high')
    setSound(metadata.sound || 'default')
  }

  // Quick fill helper
  function quickReuse(ann: Announcement) {
    const { body, metadata } = parseAnnouncementContent(ann.content)
    setTitle(ann.title)
    setContent(body)
    setType(ann.type)
    setClassId(ann.classId || '')
    setImageUrl(ann.imageUrl || '')
    setCtaText(metadata.ctaText || '')
    setCtaLink(metadata.ctaLink || '')
    setImportance(metadata.importance || 'high')
    setSound(metadata.sound || 'default')
    setShowForm(true)
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSubmitting(true)

    const meta = {
      ctaText: ctaText.trim(),
      ctaLink: ctaLink.trim(),
      importance,
      sound,
    }
    const finalContent = `${content.trim()}\n\n<!-- fcm_meta:${JSON.stringify(meta)} -->`

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: finalContent,
          type,
          classId: classId || undefined,
          imageUrl: imageUrl.trim() || undefined,
        }),
      })
      if (res.ok) {
        const newAnn = await res.json()
        setAnnouncements(prev => [newAnn, ...prev])
        setTitle(''); setContent(''); setType('info'); setClassId(''); setImageUrl(''); setCtaText(''); setCtaLink(''); setImportance('high'); setSound('default'); setSelectedTemplateId(''); setShowForm(false)
      }
    } catch { /* ignore */ } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const allowed = await confirm({
      title: 'Delete Announcement?',
      message: 'Are you sure you want to delete this announcement? This action cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!allowed) return

    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setAnnouncements(prev => prev.filter(a => a.id !== id))
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete announcement')
      }
    } catch {
      alert('Something went wrong. Please try again.')
    }
  }

  const isPowerUser = userRole === 'MANAGER' || (userRole === 'ADMIN' || userRole === 'MODERATOR')
  const canCreate = userRole === 'MANAGER' || userRole === 'MODERATOR'

  const filtered = announcements.filter(a => {
    if (activeTab === 'updates') return !a.classId
    if (activeTab === 'class')   return !!a.classId
    return true
  })

  // ── Shared styles ──────────────────────────────────────────────────────────
  const neuCard: React.CSSProperties = {
    borderRadius: '20px', background: 'var(--surface-2)',
    boxShadow: '6px 6px 14px var(--neu-dark), -6px -6px 14px var(--neu-light)',
    padding: '24px',
  }
  const neuInput: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: '14px', border: 'none',
    background: 'var(--surface-2)', boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
    fontSize: '14px', fontFamily: 'inherit', color: 'var(--text-primary)', outline: 'none',
  }
  const neuButton: React.CSSProperties = {
    padding: '12px 28px', borderRadius: '50px', border: 'none',
    background: 'var(--primary)', color: '#fff', fontSize: '14px', fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer',
    boxShadow: '4px 4px 10px rgba(54,54,232,0.35), -2px -2px 6px var(--neu-glow)',
    transition: 'all 0.2s ease',
  }

  if (loading) {
    return (
      <div className="announcements-page-container" style={{ padding: '24px 32px 48px' }}>
        {loadingFact && (
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <LoadingFactCard fact={loadingFact} />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div className="skeleton" style={{ height: '32px', width: '250px', borderRadius: '6px' }} />
          <div className="skeleton" style={{ height: '40px', width: '150px', borderRadius: '50px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ borderRadius: '24px', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton" style={{ height: '20px', width: '40%', borderRadius: '4px' }} />
                <div className="skeleton" style={{ height: '14px', width: '80px', borderRadius: '4px' }} />
              </div>
              <div className="skeleton" style={{ height: '12px', width: '90%', borderRadius: '3px' }} />
              <div className="skeleton" style={{ height: '12px', width: '75%', borderRadius: '3px' }} />
              <div className="skeleton" style={{ height: '12px', width: '50%', borderRadius: '3px' }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="announcements-page-container" style={{ padding: '24px 32px 48px' }}>
      <style>{`
        .mobile-back-header {
          display: none !important;
        }
        @media (max-width: 767px) {
          .mobile-back-header {
            display: flex !important;
          }
        }
      `}</style>
      {/* Premium Neumorphic Page Header */}
      <div className="mobile-back-header" style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        justifyContent: 'flex-start'
      }}>
        <button
          onClick={() => router.back()}
          aria-label="Go Back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--surface)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 900,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            fontFamily: "'Outfit', 'Nunito', sans-serif"
          }}>
            Announcements
          </h1>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            margin: '3px 0 0',
            fontFamily: "'Outfit', sans-serif"
          }}>
            Latest news &amp; updates
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .announcements-page-container {
            padding: 14px 12px 24px !important;
          }
          .announcement-card {
            padding: 16px 12px !important;
            border-radius: 16px !important;
          }
          .announcement-card-body {
            display: grid !important;
            grid-template-columns: auto 1fr !important;
            grid-template-rows: auto auto !important;
            gap: 12px !important;
          }
          .announcement-card-body > div:first-child {
            grid-column: 1 !important;
            grid-row: 1 !important;
          }
          .announcement-card-content {
            grid-column: 2 !important;
            grid-row: 1 !important;
          }
          .announcement-card-button {
            grid-column: 1 / span 2 !important;
            grid-row: 2 !important;
            width: 100% !important;
            margin-top: 4px !important;
          }
        }
      `}</style>

      {/* ── Top bar: filter tabs + create button ────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>

        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: '6px', padding: '6px',
          borderRadius: '50px', background: 'var(--surface-2)',
          boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
        }}>
          {(['all', 'updates', 'class'] as FilterTab[]).map(tab => {
            const labels: Record<FilterTab, string> = { all: 'All', updates: 'Updates', class: 'Class' }
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 20px', borderRadius: '50px', border: 'none',
                  fontSize: '13px', fontWeight: isActive ? 700 : 500,
                  fontFamily: 'inherit', cursor: 'pointer',
                  background:  isActive ? 'var(--primary)' : 'transparent',
                  color:       isActive ? '#fff'    : 'var(--text-secondary)',
                  boxShadow:   isActive ? '3px 3px 8px rgba(54,54,232,0.35), -2px -2px 6px var(--neu-glow)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {labels[tab]}
                {tab === 'all' && announcements.length > 0 && (
                  <span style={{
                    marginLeft: '6px', padding: '1px 7px', borderRadius: '50px',
                    background: isActive ? 'rgba(255,255,255,0.22)' : 'rgba(54,54,232,0.1)',
                    color:      isActive ? '#fff' : 'var(--primary)',
                    fontSize: '11px', fontWeight: 700,
                  }}>
                    {announcements.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* New Announcement button (admin/manager only) */}
        {canCreate && (
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              ...neuButton,
              background: showForm ? 'var(--text-secondary)' : 'var(--primary)',
              boxShadow: showForm
                ? '4px 4px 10px rgba(107,107,138,0.35), -2px -2px 6px var(--neu-glow)'
                : '4px 4px 10px rgba(54,54,232,0.35), -2px -2px 6px var(--neu-glow)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {showForm
                ? (<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>)
                : (<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>)}
            </svg>
            {showForm ? 'Cancel' : 'New Announcement'}
          </button>
        )}
      </div>

      {/* ── Create form ─────────────────────────────────────────────────── */}
      {canCreate && showForm && (
        <div style={{ ...neuCard, marginBottom: '28px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '20px' }}>
            Create Announcement
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {announcements.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Reuse Previous Announcement (Template)
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={e => handleSelectTemplate(e.target.value)}
                    style={{ ...neuInput, cursor: 'pointer', appearance: 'none', background: 'rgba(54, 54, 232, 0.06)', border: '1px solid rgba(54, 54, 232, 0.15)', fontWeight: 600, color: 'var(--primary)' }}
                  >
                    <option value="" style={{ color: 'var(--text-secondary)' }}>-- Choose a previous announcement to autofill fields --</option>
                    {announcements.slice(0, 10).map(a => (
                      <option key={a.id} value={a.id} style={{ color: 'var(--text-primary)' }}>
                        {a.title} ({new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Announcement title..." style={neuInput} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>Content</label>
                <textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Write your announcement details here..." rows={4}
                  style={{ ...neuInput, resize: 'vertical', minHeight: '100px' }} required />
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>Type</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {TYPE_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => setType(opt.value)}
                        style={{
                          padding: '8px 16px', borderRadius: '50px', border: 'none',
                          fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                          background: type === opt.value ? opt.color : 'var(--surface-2)',
                          color:      type === opt.value ? '#fff'    : 'var(--text-secondary)',
                          boxShadow:  type === opt.value
                            ? `3px 3px 8px ${opt.color}40, -2px -2px 6px var(--neu-glow)`
                            : '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                          transition: 'all 0.2s',
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Target Class (optional)
                  </label>
                  <select value={classId} onChange={e => setClassId(e.target.value)}
                    style={{ ...neuInput, cursor: 'pointer', appearance: 'none' }}>
                    <option value="">{userRole === 'MODERATOR' ? 'Select course...' : 'All Students (Global)'}</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Advanced push options section */}
              <div style={{
                marginTop: '8px',
                padding: '20px',
                borderRadius: '18px',
                background: 'var(--surface-2)',
                boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  </svg>
                  Advanced Push Delivery Customization
                </div>

                {/* Delivery Mode & Sound Switchers */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Delivery Urgency Mode
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setImportance('high')}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: '12px', border: 'none',
                          fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                          background: importance === 'high' ? 'var(--primary)' : 'var(--surface-2)',
                          color: importance === 'high' ? '#fff' : 'var(--text-secondary)',
                          boxShadow: importance === 'high'
                            ? '3px 3px 8px rgba(54,54,232,0.3), -2px -2px 6px var(--neu-light)'
                            : '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        🔔 Heads-Up Alert (High)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportance('default')}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: '12px', border: 'none',
                          fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                          background: importance === 'default' ? 'var(--text-secondary)' : 'var(--surface-2)',
                          color: importance === 'default' ? '#fff' : 'var(--text-secondary)',
                          boxShadow: importance === 'default'
                            ? '3px 3px 8px rgba(107,107,138,0.3), -2px -2px 6px var(--neu-light)'
                            : '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        📳 Silent Tray (Normal)
                      </button>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Notification Sound
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSound('default')}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: '12px', border: 'none',
                          fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                          background: sound === 'default' ? 'var(--primary)' : 'var(--surface-2)',
                          color: sound === 'default' ? '#fff' : 'var(--text-secondary)',
                          boxShadow: sound === 'default'
                            ? '3px 3px 8px rgba(54,54,232,0.3), -2px -2px 6px var(--neu-light)'
                            : '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        🔊 Standard Sound
                      </button>
                      <button
                        type="button"
                        onClick={() => setSound('none')}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: '12px', border: 'none',
                          fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                          background: sound === 'none' ? 'var(--danger)' : 'var(--surface-2)',
                          color: sound === 'none' ? '#fff' : 'var(--text-secondary)',
                          boxShadow: sound === 'none'
                            ? '3px 3px 8px rgba(239,68,68,0.25), -2px -2px 6px var(--neu-light)'
                            : '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        🔇 Mute Sound
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Banner Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    style={neuInput}
                  />
                </div>

                {/* Recent Media Bank (Last 100 images — Paginated to 5 items) */}
                {recentImages.length > 0 && (() => {
                  const itemsPerPage = 5
                  const totalPages = Math.ceil(recentImages.length / itemsPerPage)
                  const currentPageItems = recentImages.slice(imagePage * itemsPerPage, (imagePage + 1) * itemsPerPage)
                  
                  return (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.3px', margin: 0 }}>
                          🖼️ Recent Media Bank ({imagePage * itemsPerPage + 1}–{Math.min((imagePage + 1) * itemsPerPage, recentImages.length)} of {recentImages.length})
                        </label>
                        
                        {totalPages > 1 && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              type="button"
                              disabled={imagePage === 0}
                              onClick={() => setImagePage(p => Math.max(0, p - 1))}
                              style={{
                                padding: '4px 10px', borderRadius: '8px', border: 'none',
                                fontSize: '11px', fontWeight: 700, cursor: imagePage === 0 ? 'not-allowed' : 'pointer',
                                background: 'var(--surface-2)', color: imagePage === 0 ? 'var(--text-muted)' : 'var(--primary)',
                                boxShadow: imagePage === 0 ? 'none' : '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)',
                                transition: 'all 0.1s ease',
                              }}
                            >
                              ← Prev
                            </button>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              Page {imagePage + 1} of {totalPages}
                            </span>
                            <button
                              type="button"
                              disabled={imagePage >= totalPages - 1}
                              onClick={() => setImagePage(p => Math.min(totalPages - 1, p + 1))}
                              style={{
                                padding: '4px 10px', borderRadius: '8px', border: 'none',
                                fontSize: '11px', fontWeight: 700, cursor: imagePage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                                background: 'var(--surface-2)', color: imagePage >= totalPages - 1 ? 'var(--text-muted)' : 'var(--primary)',
                                boxShadow: imagePage >= totalPages - 1 ? 'none' : '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)',
                                transition: 'all 0.1s ease',
                              }}
                            >
                              Next →
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        padding: '4px 2px 8px',
                      }}>
                        {currentPageItems.map((url, index) => {
                          const isSelected = imageUrl === url
                          return (
                            <div
                              key={index}
                              onClick={() => setImageUrl(url)}
                              style={{
                                position: 'relative',
                                width: '64px',
                                height: '64px',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                flexShrink: 0,
                                background: '#f2f3f7',
                                border: isSelected ? '2px solid #3636e8' : '1px solid rgba(0,0,0,0.1)',
                                boxShadow: isSelected
                                  ? '0 0 8px rgba(54,54,232,0.4)'
                                  : '2px 2px 5px rgba(0,0,0,0.06)',
                                transition: 'transform 0.15s ease, border-color 0.15s ease',
                              }}
                            >
                              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              {isSelected && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: '2px',
                                  right: '2px',
                                  background: 'var(--primary)',
                                  borderRadius: '50%',
                                  width: '14px',
                                  height: '14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#fff',
                                  fontSize: '8px',
                                }}>
                                  ✓
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      CTA Button Text (Optional — e.g. "Join Class", "Start Quiz")
                    </label>
                    <input
                      type="text"
                      value={ctaText}
                      onChange={e => setCtaText(e.target.value)}
                      placeholder="e.g. Open Notes"
                      style={neuInput}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      CTA Button Redirect Path (Optional — relative or full link)
                    </label>
                    <input
                      type="text"
                      value={ctaLink}
                      onChange={e => setCtaLink(e.target.value)}
                      placeholder="e.g. /materials or https://zoom.us/..."
                      style={neuInput}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="submit" disabled={submitting || !title.trim() || !content.trim()}
                  style={{
                    ...neuButton,
                    opacity: submitting || !title.trim() || !content.trim() ? 0.6 : 1,
                    cursor:  submitting ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  {submitting ? 'Publishing...' : 'Publish Announcement'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Announcement list ────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ ...neuCard, textAlign: 'center', padding: '60px 24px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--neu-dark)" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 16px' }}>
            <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
          </svg>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {activeTab === 'all' ? 'No announcements yet' : `No ${activeTab} announcements`}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {canCreate ? 'Create your first announcement using the button above.' : 'Check back later for updates.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map(a => {
            const isExpanded  = expandedId === a.id
            const isHighlight = highlightId === a.id
            const isNew       = Date.now() - new Date(a.createdAt).getTime() < 24 * 60 * 60 * 1000
            const typeColor   = TYPE_COLORS[a.type] || 'var(--info)'
            const typeBg      = TYPE_BG[a.type]    || TYPE_BG.info
            const typeLabel   = TYPE_LABELS[a.type] || 'Info'
            const tagLabel    = a.classId ? 'Class Announcement' : 'System Update'
            const { body: parsedBody, metadata } = parseAnnouncementContent(a.content)

            return (
              <div
                key={a.id}
                ref={el => { cardRefs.current[a.id] = el }}
                className="announcement-card"
                style={{
                  ...neuCard,
                  padding: '20px 24px',
                  transition: 'box-shadow 0.2s',
                  ...(isHighlight ? { boxShadow: `6px 6px 14px var(--neu-dark), -6px -6px 14px var(--neu-light), 0 0 0 2px ${typeColor}50` } : {}),
                }}
              >
                <div className="announcement-card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: '18px' }}>

                  {/* Type icon */}
                  <TypeIcon type={a.type} />

                  {/* Content */}
                  <div className="announcement-card-content" style={{ flex: 1, minWidth: 0 }}>
                    {/* Tag row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '50px',
                        background: typeBg, color: typeColor,
                        fontSize: '11px', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                       }}>
                        {tagLabel}
                      </span>

                      {/* Class badge */}
                      {a.class && (
                        <span style={{
                          padding: '3px 10px', borderRadius: '50px',
                          background: `${a.class.color}18`, color: a.class.color,
                          fontSize: '11px', fontWeight: 700,
                        }}>
                          {a.class.name}
                        </span>
                      )}

                      {/* NEW badge */}
                      {isNew && (
                        <span style={{
                          padding: '3px 9px', borderRadius: '50px',
                          background: 'rgba(54,54,232,0.12)', color: 'var(--primary)',
                          fontSize: '11px', fontWeight: 800,
                        }}>
                          NEW
                        </span>
                      )}

                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {relativeTime(a.createdAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: '1.35', marginBottom: '6px' }}>
                      {a.title}
                    </h3>

                    {/* Preview */}
                    <p style={{
                      fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0,
                      wordBreak: 'break-word' as const,
                      ...(!isExpanded ? {
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                        overflow: 'hidden',
                      } : {
                        whiteSpace: 'pre-wrap' as const,
                      }),
                    }}>
                      {parsedBody}
                    </p>

                    {/* Rich Banner Image (Expanded mode) */}
                    {isExpanded && a.imageUrl && (
                      <div style={{
                        marginTop: '14px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '4px 4px 10px rgba(0,0,0,0.05)',
                        border: '1px solid rgba(0,0,0,0.08)',
                        maxWidth: '100%',
                        maxHeight: '260px',
                        background: '#f2f3f7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <img
                          src={a.imageUrl}
                          alt="Announcement Visual"
                          style={{ width: '100%', height: '100%', maxHeight: '260px', objectFit: 'contain' }}
                        />
                      </div>
                    )}

                    {/* Custom Action Call-To-Action Button (Expanded mode) */}
                    {isExpanded && metadata.ctaText && metadata.ctaLink && (
                      <div style={{ marginTop: '16px' }}>
                        <a
                          href={metadata.ctaLink}
                          target={metadata.ctaLink.startsWith('http') ? '_blank' : '_self'}
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 22px',
                            borderRadius: '50px',
                            background: 'linear-gradient(135deg, #3636e8, #6366f1)',
                            color: '#fff',
                            fontSize: '13.5px',
                            fontWeight: 700,
                            textDecoration: 'none',
                            boxShadow: '0 4px 12px rgba(54,54,232,0.25), inset 1px 1px 0 var(--neu-glow)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{metadata.ctaText}</span>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                          </svg>
                        </a>
                      </div>
                    )}

                    {/* Expanded extra: author */}
                    {isExpanded && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                        <UserAvatar user={a.createdBy} size={24} />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{a.createdBy.name}</span>
                        <span style={{ fontSize: '12px', color: '#c0c2ca', marginLeft: '4px' }}>
                          {new Date(a.createdAt).toLocaleDateString('en-GB', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        {/* Delete button (Manager only) */}
                        {canCreate && (
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); quickReuse(a) }}
                              style={{
                                background: 'var(--surface-2)', border: 'none',
                                color: 'var(--primary)', cursor: 'pointer', padding: '6px 12px',
                                borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '11px', fontWeight: 800,
                                boxShadow: '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)',
                                transition: 'all 0.2s',
                              }}
                              title="Reuse this notification settings"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                              </svg>
                              Reuse Settings
                            </button>

                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }}
                              style={{
                                background: 'none', border: 'none',
                                color: 'var(--danger)', cursor: 'pointer', padding: '6px',
                                borderRadius: '50%', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', transition: 'background 0.2s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              title="Delete Announcement"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Read More / Show Less button */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    className="announcement-card-button"
                    style={{
                      flexShrink: 0, alignSelf: 'center',
                      padding: '9px 20px', borderRadius: '50px', border: 'none',
                      background: isExpanded ? 'var(--surface-2)' : typeBg,
                      color: isExpanded ? 'var(--text-secondary)' : typeColor,
                      fontSize: '13px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                      boxShadow: isExpanded
                        ? '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)'
                        : `3px 3px 8px ${typeColor}30, -2px -2px 6px var(--neu-glow)`,
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    {isExpanded ? 'Show Less' : 'Read More'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Showing {filtered.length} announcement{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      {confirmDialog}
    </div>
  )
}
