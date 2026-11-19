'use client'

import { useEffect, useState } from 'react'
import ManagerUserModal from '@/components/ManagerUserModal'
import { api, CallActionRow, CallHistoryList, CallRow, startSupportCall } from './SupportCall'

interface UserHit {
  id: string
  name: string
  email: string
  role: string
  mobileNumber?: string | null
  securityNumber?: string | null
  notificationGroupSerial?: number | null
}

type Tab = 'directory' | 'history' | 'scheduled'

/** Manager call center: search any student, see their full profile + call log, call them; global log; scheduled requests. */
export default function CallCenter() {
  const [tab, setTab] = useState<Tab>('directory')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<UserHit | null>(null)
  const [userCalls, setUserCalls] = useState<CallRow[]>([])
  const [history, setHistory] = useState<CallRow[]>([])
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<CallRow[]>([])

  // Search name / email / mobile / security number / serial (same search as Manage → Users).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setHits([]); return }
    setSearching(true)
    const t = setTimeout(() => {
      api(`/api/users?search=${encodeURIComponent(q)}`)
        .then(d => setHits((d.users || []).filter((u: UserHit) => u.role === 'STUDENT').slice(0, 50)))
        .catch(() => setHits([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (selected) api(`/api/support/calls/history?userId=${selected.id}`).then(setUserCalls).catch(() => setUserCalls([]))
  }, [selected])

  const loadHistory = (p: number) => api(`/api/support/calls/history?page=${p}`).then((rows: CallRow[]) => setHistory(h => p === 0 ? rows : [...h, ...rows])).catch(() => {})
  const loadOpen = () => api('/api/support/calls').then((rows: CallRow[]) => setOpen(rows.filter(r => r.type === 'SCHEDULED'))).catch(() => {})
  useEffect(() => {
    if (tab === 'history') { setPage(0); loadHistory(0) }
    if (tab === 'scheduled') loadOpen()
  }, [tab])

  const tabBtn = (t: Tab, label: string) => (
    <button role="tab" aria-selected={tab === t} className={tab === t ? 'gz-btn' : 'gz-btn gz-btn--ghost'} onClick={() => { setTab(t); setSelected(null) }}>{label}</button>
  )

  return (
    <div className="page-container gz-sp" style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <a href="/support" className="gz-sp-link">← Support</a>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>Call center</h1>
        </div>
        <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabBtn('directory', 'Directory')}
          {tabBtn('history', 'Call history')}
          {tabBtn('scheduled', 'Scheduled')}
        </div>
      </div>

      {tab === 'directory' && !selected && (
        <div className="gz-sp-box">
          <label htmlFor="cc-search" className="gz-sp-eyebrow">Find a student</label>
          <input
            id="cc-search" className="gz-ed-input" type="search" autoComplete="off" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Name, email, mobile, security number or #serial" style={{ width: '100%', fontSize: 16, marginTop: 6 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {searching && <div className="gz-sp-sub">Searching…</div>}
            {!searching && query.trim().length >= 2 && hits.length === 0 && <div className="gz-sp-sub">No students found.</div>}
            {hits.map(u => (
              <div key={u.id} className="gz-sp-row" onClick={() => setSelected(u)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(u)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
                    {[u.email, u.mobileNumber, u.securityNumber && `Sec ${u.securityNumber}`, u.notificationGroupSerial && `#${u.notificationGroupSerial}`].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button className="gz-btn gz-ed-sm" onClick={e => { e.stopPropagation(); startSupportCall(u.id, u.name) }}>Call</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'directory' && selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="gz-sp-box" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="gz-sp-link" onClick={() => setSelected(null)}>← Results</button>
            <div style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 600 }}>{selected.name}</div>
            <button className="gz-btn" onClick={() => startSupportCall(selected.id, selected.name)}>Call {selected.name.split(' ')[0]}</button>
          </div>
          <div className="gz-sp-box">
            <div className="gz-sp-eyebrow" style={{ marginBottom: 10 }}>Call history</div>
            <CallHistoryList rows={userCalls} />
          </div>
          <ManagerUserModal userId={selected.id} mode="page" />
        </div>
      )}

      {tab === 'history' && (
        <div className="gz-sp-box">
          <CallHistoryList rows={history} />
          {history.length === (page + 1) * 50 && (
            <button className="gz-btn gz-btn--ghost" style={{ marginTop: 12 }} onClick={() => { setPage(page + 1); loadHistory(page + 1) }}>Load more</button>
          )}
        </div>
      )}

      {tab === 'scheduled' && (
        <div className="gz-sp-box" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {open.length === 0 ? <div className="gz-sp-sub">No scheduled call requests.</div> : open.map(r => <CallActionRow key={r.id} row={r} onChange={loadOpen} />)}
        </div>
      )}
    </div>
  )
}
