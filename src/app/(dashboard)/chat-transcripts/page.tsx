'use client'

import { useEffect, useState } from 'react'
import UserAvatar from '@/components/UserAvatar'

interface ClassInfo {
  id: string
  name: string
  subject: string | null
  color: string
  totalMessages: number
  deletedMessages: number
}

interface TranscriptMsg {
  id: string
  content: string
  isDeleted: boolean
  deletedAt: string | null
  createdAt: string
  sender: {
    id: string
    name: string
    role: string
    securityNumber: string | null
    avatar?: string | null
    gender?: string | null
  }
  course: {
    name: string
    subject: string | null
  }
}

export default function ChatTranscriptsPage() {
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null)
  const [messages, setMessages] = useState<TranscriptMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [filter, setFilter] = useState<'all' | 'deleted'>('all')
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadClasses()
  }, [])

  async function loadClasses() {
    setLoading(true)
    try {
      const data = await fetch('/api/community/transcripts').then(r => r.json())
      setClasses(data.classes || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function selectClass(cls: ClassInfo) {
    setSelectedClass(cls)
    setLoadingMessages(true)
    setMessages([])
    try {
      const data = await fetch(`/api/community/transcripts?courseId=${cls.id}`).then(r => r.json())
      setMessages(data.messages || [])
    } catch (e) {
      console.error(e)
    }
    setLoadingMessages(false)
  }

  async function exportTranscript(format: 'csv' | 'json' | 'pdf') {
    if (!selectedClass) return
    setExporting(true)
    try {
      const res = await fetch(`/api/community/transcripts/export?courseId=${selectedClass.id}&format=${format}`)
      const blob = await res.blob()
      const ext = format === 'pdf' ? 'html' : format
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transcript-${selectedClass.name.replace(/\s+/g, '_')}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    }
    setExporting(false)
  }

  const filteredMessages = messages.filter(msg => {
    if (filter === 'deleted' && !msg.isDeleted) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        msg.content.toLowerCase().includes(q) ||
        msg.sender.name.toLowerCase().includes(q) ||
        (msg.sender.securityNumber || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const neu = { background: 'var(--surface-2)', boxShadow: '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)' }
  const neuInset = { background: 'var(--surface-2)', boxShadow: 'inset 4px 4px 8px var(--neu-dark), inset -4px -4px 8px var(--neu-light)' }
  const neuSmall = { background: 'var(--surface-2)', boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)' }

  return (
    <div className="page-container fade-in master-detail-layout" data-detail-open={selectedClass ? 'true' : 'false'} style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 152px)', overflow: 'hidden' }}>

      {/* Left: Class list */}
      <div className="master-detail-list" style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px', padding: '0 4px' }}>
          Community Transcripts
        </div>

        {loading && (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading...</div>
        )}

        {classes.map(cls => (
          <button
            key={cls.id}
            onClick={() => selectClass(cls)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', borderRadius: '12px', border: 'none',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              transition: 'all 0.2s',
              background: selectedClass?.id === cls.id ? cls.color : 'var(--surface-2)',
              color: selectedClass?.id === cls.id ? '#fff' : 'var(--text-primary)',
              boxShadow: selectedClass?.id === cls.id
                ? `5px 5px 12px ${cls.color}55, -3px -3px 8px var(--neu-glow)`
                : '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
            }}
          >
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
              background: selectedClass?.id === cls.id ? 'rgba(255,255,255,0.25)' : cls.color + '22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 600,
              color: selectedClass?.id === cls.id ? '#fff' : cls.color,
            }}>
              {cls.name.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cls.name}
              </div>
              <div style={{ fontSize: '11px', opacity: selectedClass?.id === cls.id ? 0.8 : 0.6, display: 'flex', gap: '8px' }}>
                <span>{cls.totalMessages} msg{cls.totalMessages !== 1 ? 's' : ''}</span>
                {cls.deletedMessages > 0 && (
                  <span style={{ color: selectedClass?.id === cls.id ? 'rgba(255,255,255,0.9)' : 'var(--danger)' }}>
                    {cls.deletedMessages} deleted
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}

        {!loading && classes.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 10px' }}>
            No communities found
          </div>
        )}
      </div>

      {/* Right: Transcript viewer */}
      <div className="master-detail-pane" style={{ flex: 1, borderRadius: '14px', ...neu, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!selectedClass ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <p style={{ fontWeight: 600 }}>Select a community to view transcript</p>
            <p style={{ fontSize: '13px' }}>Full chat history including deleted messages</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '16px 22px', borderBottom: '1.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="master-detail-back"
                onClick={() => setSelectedClass(null)}
                aria-label="Back to community list"
                style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  border: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--surface-2)', boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                  color: 'var(--text-primary)', flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: selectedClass.color + '22',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: 600, color: selectedClass.color,
              }}>
                {selectedClass.name.substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text-primary)' }}>{selectedClass.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {selectedClass.subject ? `${selectedClass.subject} · ` : ''}Full Transcript · {messages.length} messages
                  {messages.filter(m => m.isDeleted).length > 0 && (
                    <span style={{ color: 'var(--danger)' }}> · {messages.filter(m => m.isDeleted).length} deleted</span>
                  )}
                </div>
              </div>

              {/* Export buttons */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {(['csv', 'json', 'pdf'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => exportTranscript(fmt)}
                    disabled={exporting || messages.length === 0}
                    style={{
                      padding: '6px 14px', borderRadius: '50px', border: 'none',
                      cursor: exporting ? 'default' : 'pointer',
                      fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                      ...neuSmall,
                      color: exporting ? 'var(--text-muted)' : 'var(--primary)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {fmt === 'pdf' ? 'PDF' : fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div style={{ padding: '10px 22px', borderBottom: '1.5px solid rgba(0,0,0,0.06)', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search messages, users, security numbers..."
                style={{
                  flex: 1, padding: '9px 16px', borderRadius: '50px',
                  border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '13px',
                  ...neuInset, color: 'var(--text-primary)',
                }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'deleted'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '6px 14px', borderRadius: '50px', border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                      background: filter === f ? 'var(--primary)' : 'var(--surface-2)',
                      color: filter === f ? '#fff' : 'var(--text-secondary)',
                      boxShadow: filter === f
                        ? '4px 4px 10px rgba(128, 128, 128,0.25)'
                        : '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {f === 'all' ? 'All' : 'Deleted Only'}
                  </button>
                ))}
              </div>
            </div>

            {/* Transcript table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
              {loadingMessages ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontWeight: '600' }}>Loading transcript...</div>
              ) : filteredMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <p style={{ fontWeight: 600 }}>No messages found</p>
                  <p style={{ fontSize: '13px', marginTop: '4px' }}>
                    {filter === 'deleted' ? 'No deleted messages in this community' : search ? 'Try a different search term' : 'This community has no messages yet'}
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(0,0,0,0.08)' }}>User</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(0,0,0,0.08)' }}>Security #</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(0,0,0,0.08)' }}>Time</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(0,0,0,0.08)' }}>Message</th>
                      <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(0,0,0,0.08)' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid rgba(0,0,0,0.08)' }}>Deleted At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMessages.map(msg => (
                      <tr
                        key={msg.id}
                        style={{
                          background: msg.isDeleted ? 'var(--danger-light)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { if (!msg.isDeleted) e.currentTarget.style.background = '#f0f0f8' }}
                        onMouseLeave={e => { e.currentTarget.style.background = msg.isDeleted ? 'var(--danger-light)' : 'transparent' }}
                      >
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserAvatar user={msg.sender} size={28} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px' }}>{msg.sender.name}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{msg.sender.role}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>
                          {msg.sender.securityNumber || '-'}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {new Date(msg.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)', maxWidth: '400px', wordBreak: 'break-word' }}>
                          <span style={{ color: msg.isDeleted ? 'var(--danger)' : 'var(--text-primary)' }}>
                            {msg.content}
                          </span>
                          {msg.isDeleted && (
                            <span style={{
                              marginLeft: '8px', fontSize: '10px', fontWeight: 600,
                              background: 'var(--danger-light)', color: 'var(--danger)',
                              padding: '1px 8px', borderRadius: '50px',
                            }}>
                              DELETED
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)', textAlign: 'center' }}>
                          {msg.isDeleted ? (
                            <span style={{
                              padding: '3px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: 600,
                              background: 'var(--danger-light)', color: 'var(--danger)',
                            }}>Deleted</span>
                          ) : (
                            <span style={{
                              padding: '3px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: 600,
                              background: 'var(--success-light)', color: 'var(--success)',
                            }}>Active</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {msg.isDeleted && msg.deletedAt
                            ? new Date(msg.deletedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '-'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
