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
  useEffect(() => { loadOpen() }, [])

  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setSelected(null) }}>
      {label}{count ? <i>{count}</i> : null}
    </button>
  )
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const meta = (u: UserHit) => [u.email, u.mobileNumber, u.securityNumber && `Sec ${u.securityNumber}`, u.notificationGroupSerial && `#${u.notificationGroupSerial}`].filter(Boolean).join(' · ')
  const q = query.trim()

  return (
    <div className="page-container gz-sp cc" style={{ padding: '8px 4px 40px' }}>
      <style>{`
        .cc-top{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
        .cc-title{font-size:26px;font-weight:600;letter-spacing:-.02em;margin:4px 0 0}
        .cc-search{position:relative;display:flex;align-items:center}
        .cc-search svg{position:absolute;left:16px;color:var(--gz-ink-3);pointer-events:none}
        .cc-search input{width:100%;height:52px;padding:0 16px 0 46px;font-size:16px;border-radius:12px;border:1px solid var(--gz-line);background:var(--gz-card);color:var(--gz-ink);outline:none}
        .cc-search input:focus{border-color:var(--gz-ink);box-shadow:0 0 0 3px color-mix(in srgb,var(--gz-ink) 10%,transparent)}
        .cc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-top:16px}
        .cc-card{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--gz-line);border-radius:12px;background:var(--gz-card);cursor:pointer;transition:border-color .15s,transform .15s}
        .cc-card:hover,.cc-card:focus-visible{border-color:var(--gz-line-hover);transform:translateY(-1px);outline:none}
        .cc-av{flex-shrink:0;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:600;background:var(--gz-panel);border:1px solid var(--gz-line);color:var(--gz-ink)}
        .cc-av--lg{width:56px;height:56px;font-size:18px}
        .cc-name{font-size:14px;font-weight:600;color:var(--gz-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cc-meta{font-size:12px;color:var(--gz-ink-3);overflow-wrap:anywhere;margin-top:2px}
        .cc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:64px 16px;color:var(--gz-ink-3)}
        .cc-empty-ico{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;background:var(--gz-card);border:1px solid var(--gz-line);color:var(--gz-ink-2)}
        .cc-empty b{color:var(--gz-ink);font-size:15px;font-weight:600}
        .cc-split{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start}
        .cc-side{position:sticky;top:16px;display:flex;flex-direction:column;gap:16px}
        @media (max-width:1100px){.cc-split{grid-template-columns:1fr}.cc-side{position:static;order:-1}}
        @media (max-width:640px){.cc-grid{grid-template-columns:1fr}.cc-top .gz-seg{width:100%}.cc-top .gz-seg button{flex:1}}
      `}</style>

      <div className="cc-top">
        <div>
          <a href="/support" className="gz-sp-link">← Support</a>
          <h1 className="cc-title">Call center</h1>
        </div>
        <div role="tablist" className="gz-seg">
          {tabBtn('directory', 'Directory')}
          {tabBtn('history', 'Call history')}
          {tabBtn('scheduled', 'Scheduled', open.length)}
        </div>
      </div>

      {tab === 'directory' && !selected && (
        <div className="gz-sp-box">
          <label htmlFor="cc-search" className="gz-sp-eyebrow">Find a student</label>
          <div className="cc-search" style={{ marginTop: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              id="cc-search" type="search" autoComplete="off" autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Name, email, mobile, security number or #serial"
            />
          </div>

          {q.length < 2 ? (
            <div className="cc-empty">
              <div className="cc-empty-ico">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
              </div>
              <b>Search for a student to call</b>
              <span style={{ fontSize: 13 }}>Type at least 2 characters.</span>
            </div>
          ) : searching ? (
            <div className="cc-empty"><span>Searching…</span></div>
          ) : hits.length === 0 ? (
            <div className="cc-empty"><b>No students found</b><span style={{ fontSize: 13 }}>Try a different name, email or number.</span></div>
          ) : (
            <div className="cc-grid">
              {hits.map(u => (
                <div key={u.id} className="cc-card" onClick={() => setSelected(u)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(u)}>
                  <div className="cc-av">{initials(u.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cc-name">{u.name}</div>
                    <div className="cc-meta">{meta(u)}</div>
                  </div>
                  <button className="gz-btn gz-ed-sm" onClick={e => { e.stopPropagation(); startSupportCall(u.id, u.name) }}>Call</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'directory' && selected && (
        <div className="cc-split">
          <div style={{ minWidth: 0 }}>
            <ManagerUserModal userId={selected.id} mode="page" />
          </div>
          <div className="cc-side">
            <div className="gz-sp-box" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <button className="gz-sp-link" style={{ alignSelf: 'flex-start' }} onClick={() => setSelected(null)}>← Results</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="cc-av cc-av--lg">{initials(selected.name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="cc-name" style={{ fontSize: 17 }}>{selected.name}</div>
                  <div className="cc-meta">{meta(selected)}</div>
                </div>
              </div>
              <button className="gz-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => startSupportCall(selected.id, selected.name)}>Call {selected.name.split(' ')[0]}</button>
            </div>
            <div className="gz-sp-box">
              <div className="gz-sp-eyebrow" style={{ marginBottom: 10 }}>Call history</div>
              <CallHistoryList rows={userCalls} />
            </div>
          </div>
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
          {open.length === 0
            ? <div className="cc-empty"><b>No scheduled call requests</b><span style={{ fontSize: 13 }}>Requests students schedule will show up here.</span></div>
            : open.map(r => <CallActionRow key={r.id} row={r} onChange={loadOpen} />)}
        </div>
      )}
    </div>
  )
}
