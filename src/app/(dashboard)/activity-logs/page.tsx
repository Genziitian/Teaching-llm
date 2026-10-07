'use client'

import { useState, useEffect, useCallback } from 'react'
import ManagerUserModal from '@/components/ManagerUserModal'
import { formatIST } from '@/lib/date-utils'

interface ActivityLog {
  id: string
  userId: string
  userName: string
  userRole: string
  securityNumber: string | null
  actionType: string
  actionDescription: string
  moduleName: string
  targetId: string | null
  metadata: string | null
  timestamp: string
}

const MODULE_OPTIONS = [
  'Authentication', 'User Management', 'Classes', 'Topics', 'Content',
  'Lectures', 'Materials', 'Live Sessions', 'Calendar', 'Announcements',
  'Community', 'Support', 'Profile', 'FAQ',
]

const ACTION_OPTIONS = [
  'USER_LOGIN', 'USER_LOGOUT', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
  'PASSWORD_CHANGED', 'PROFILE_UPDATED', 'AVATAR_UPLOADED',
  'CLASS_CREATED', 'CLASS_UPDATED', 'CLASS_DELETED',
  'TOPIC_CREATED', 'TOPIC_UPDATED', 'TOPIC_DELETED',
  'CONTENT_CREATED', 'CONTENT_UPDATED', 'CONTENT_DELETED',
  'LECTURE_CREATED', 'LECTURE_UPDATED', 'LECTURE_DELETED',
  'MATERIAL_CREATED', 'MATERIAL_UPDATED', 'MATERIAL_DELETED',
  'SESSION_CREATED', 'SESSION_UPDATED', 'SESSION_DELETED',
  'EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_DELETED',
  'ANNOUNCEMENT_CREATED',
  'MESSAGE_SENT', 'MESSAGE_DELETED', 'TRANSCRIPT_EXPORTED',
  'TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_DELETED', 'TICKET_REPLY_SENT',
  'CHAT_STARTED', 'CHAT_JOINED', 'CHAT_CLOSED', 'CHAT_HISTORY_DELETED',
  'FAQ_CREATED', 'FAQ_UPDATED', 'FAQ_DELETED',
]

function formatActionType(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bFaq\b/g, 'FAQ')
}

function formatTimestamp(ts: string): string {
  return formatIST(ts, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function getRoleBadgeStyle(role: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string }> = {
    MANAGER: { bg: 'var(--primary-light)', color: 'var(--accent)' },
    ADMIN: { bg: 'var(--info-light)', color: 'var(--info)' },
    MODERATOR: { bg: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' },
    STUDENT: { bg: 'var(--success-light)', color: 'var(--success)' },
  }
  const c = colors[role] || { bg: 'var(--bg)', color: 'var(--text-secondary)' }
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '50px',
    fontSize: '11px',
    fontWeight: '700',
    background: c.bg,
    color: c.color,
    letterSpacing: '0.3px',
  }
}

function getModuleBadgeStyle(): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '50px',
    fontSize: '11px',
    fontWeight: '600',
    background: 'var(--surface-2)',
    color: '#4b4b7a',
    letterSpacing: '0.3px',
  }
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [todayCount, setTodayCount] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [userIdFilter, setUserIdFilter] = useState('')

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
    }, 500)
    return () => clearTimeout(handler)
  }, [search])

  const limit = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (roleFilter) params.set('role', roleFilter)
      if (moduleFilter) params.set('moduleName', moduleFilter)
      if (actionFilter) params.set('actionType', actionFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (userIdFilter) params.set('userId', userIdFilter)

      const res = await fetch(`/api/activity-logs?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      console.error('Error fetching logs:', err)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, roleFilter, moduleFilter, actionFilter, dateFrom, dateTo, userIdFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter, moduleFilter, actionFilter, dateFrom, dateTo, userIdFilter])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    fetch(`/api/activity-logs?dateFrom=${today}&dateTo=${today}&limit=1`)
      .then(r => r.json())
      .then(data => setTodayCount(data.total || 0))
      .catch(() => {})
  }, [logs])

  const handleDeleteLog = async (logId: string) => {
    if (!window.confirm('Are you sure you want to delete this activity log?')) return
    try {
      const res = await fetch('/api/activity-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId })
      })
      if (!res.ok) throw new Error('Failed to delete log')
      setLogs(logs.filter(l => l.id !== logId))
      setTotal(t => Math.max(0, t - 1))
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete log')
    }
  }

  const handleExportCsv = async () => {
    const params = new URLSearchParams()
    params.set('export', 'csv')
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (roleFilter) params.set('role', roleFilter)
    if (moduleFilter) params.set('moduleName', moduleFilter)
    if (actionFilter) params.set('actionType', actionFilter)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)

    try {
      const res = await fetch(`/api/activity-logs?${params.toString()}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('')
    setModuleFilter('')
    setActionFilter('')
    setDateFrom('')
    setDateTo('')
    setUserIdFilter('')
    setPage(1)
  }

  const hasFilters = !!(search || roleFilter || moduleFilter || actionFilter || dateFrom || dateTo || userIdFilter)

  return (
    <div className="dashboard-inner-page" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: 'calc(100vh - 104px)', 
      overflow: 'hidden',
      padding: '24px 32px' 
    }}>
      {/* Header & Stats (Fixed) */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button className="btn btn-primary btn-sm" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>

        <div className="grid-3" style={{ marginBottom: '20px', gap: '16px' }}>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)' }}>{total.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '2px' }}>Total Logs</div>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--success)' }}>{todayCount.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '2px' }}>Today&apos;s Actions</div>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent)' }}>{page}/{totalPages || 1}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '2px' }}>Current Page</div>
          </div>
        </div>

        {/* Filters (Fixed) */}
        <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6b8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Filters</span>
            {userIdFilter && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                Filtered by User ID
                <button onClick={() => setUserIdFilter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--primary)' }}>&times;</button>
              </span>
            )}
            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ marginLeft: 'auto', fontSize: '11px', height: '24px' }}>
                Clear All
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
            <input className="form-input" type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: '12px' }} />
            <select className="form-input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ fontSize: '12px' }}>
              <option value="">All Roles</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
              <option value="MODERATOR">Moderator</option>
              <option value="STUDENT">Student</option>
            </select>
            <select className="form-input" value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} style={{ fontSize: '12px' }}>
              <option value="">All Modules</option>
              {MODULE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="form-input" value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ fontSize: '12px' }}>
              <option value="">All Actions</option>
              {ACTION_OPTIONS.map(a => <option key={a} value={a}>{formatActionType(a)}</option>)}
            </select>
            <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: '12px' }} />
            <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: '12px' }} />
          </div>
        </div>
      </div>

      {/* Logs List (Scrollable) */}
      <div style={{ flex: 1, overflowY: 'auto', marginRight: '-12px', paddingRight: '12px' }} className="custom-scrollbar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading activity logs...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>No activity logs found</div>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  gap: '12px',
                  borderRadius: '12px',
                  background: 'var(--surface)',
                  border: '1px solid rgba(255,255,255,0.8)',
                  boxShadow: '2px 2px 5px var(--neu-dark), -1px -1px 3px var(--neu-light)',
                }}
              >
                <div style={{ minWidth: '150px', flexShrink: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>{formatTimestamp(log.timestamp)}</div>
                </div>

                <div style={{ minWidth: '120px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div onClick={() => setSelectedUserId(log.userId)} style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline' }}>
                      {log.userName}
                    </div>
                    <button onClick={() => setUserIdFilter(log.userId)} title="Filter logs for this user" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 4px', display: 'flex', alignItems: 'center' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                      </svg>
                    </button>
                  </div>
                  <span style={getRoleBadgeStyle(log.userRole)}>{log.userRole}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500', wordBreak: 'break-word' }}>
                    {log.actionDescription}
                  </div>
                </div>

                <div style={{ flexShrink: 0, minWidth: '100px', display: 'flex', justifyContent: 'center' }}>
                  <span style={getModuleBadgeStyle()}>{log.moduleName}</span>
                </div>

                <div style={{ minWidth: '120px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: '50px' }}>
                    {formatActionType(log.actionType)}
                  </span>
                  <button 
                    onClick={() => handleDeleteLog(log.id)} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--danger)', opacity: 0.7, display: 'flex', alignItems: 'center' }} 
                    title="Delete log" 
                    onMouseEnter={e => e.currentTarget.style.opacity='1'} 
                    onMouseLeave={e => e.currentTarget.style.opacity='0.7'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination (Fixed) */}
      {totalPages > 1 && (
        <div style={{ flexShrink: 0, padding: '16px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <button className="btn btn-ghost btn-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ opacity: page <= 1 ? 0.4 : 1 }}>Previous</button>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>Page {page} of {totalPages}</div>
          <button className="btn btn-ghost btn-xs" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
        </div>
      )}

      {selectedUserId && (
        <ManagerUserModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} onUpdate={fetchLogs} />
      )}
    </div>
  )
}
