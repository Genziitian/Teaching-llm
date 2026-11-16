'use client'

import { useCallback, useEffect, useState } from 'react'
import { APPLICATION_STATUSES } from './CareersTypes'

const ghost: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border, #d1d5db)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }
const sel: React.CSSProperties = { padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border, #d1d5db)', background: 'var(--bg-card, #fff)', color: 'var(--text-primary)', fontSize: 13 }

type App = Record<string, any>

export default function CareersApplicationsAdmin() {
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [open, setOpen] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/storefront/job-applications')
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to load')
      setApps(d.applications || [])
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const post = (path: string, body: object) =>
    fetch(`/api/storefront/job-applications/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const setStatus = async (id: string, status: string) => {
    const res = await post('update-status', { id, status })
    if (res.ok) setApps((p) => p.map((a) => (a.id === id ? { ...a, status } : a))); else setErr('Update failed')
  }
  const saveNotes = async (id: string, manager_notes: string) => {
    const res = await post('update-status', { id, manager_notes })
    if (!res.ok) setErr('Saving notes failed')
  }
  const remove = async (id: string) => {
    if (!confirm('Delete this application permanently?')) return
    const res = await post('delete', { id })
    if (res.ok) setApps((p) => p.filter((a) => a.id !== id)); else setErr('Delete failed')
  }

  const shown = apps.filter((a) => filter === 'ALL' || (a.status || 'PENDING') === filter)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={sel} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">All ({apps.length})</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s} ({apps.filter((a) => (a.status || 'PENDING') === s).length})</option>)}
        </select>
        <button style={ghost} onClick={load}>Refresh</button>
        {err && <span style={{ color: '#b91c1c', fontSize: 13 }}>{err}</span>}
      </div>
      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      {!loading && shown.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No applications.</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {shown.map((a) => (
          <div key={a.id} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: 12, background: 'var(--bg-card, #fff)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ cursor: 'pointer' }} onClick={() => setOpen(open === a.id ? null : a.id)}>
                <strong style={{ color: 'var(--text-primary)' }}>{a.full_name}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> · {a.role_title} · {a.email} · {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select style={sel} value={a.status || 'PENDING'} onChange={(e) => setStatus(a.id, e.target.value)}>
                  {APPLICATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button style={ghost} onClick={() => remove(a.id)}>Delete</button>
              </div>
            </div>
            {open === a.id && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)', display: 'grid', gap: 4 }}>
                {a.phone && <div>Phone: {a.phone}</div>}
                {a.age && <div>Age: {a.age}</div>}
                {a.subject && <div>Subject: {a.subject}</div>}
                {a.cgpa && <div>CGPA: {a.cgpa}</div>}
                {a.resume_link && <div>Resume: <a href={a.resume_link} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{a.resume_link}</a></div>}
                {a.group_link && <div>Group: {a.group_link}</div>}
                {a.experience_and_why && <div style={{ whiteSpace: 'pre-wrap' }}>{a.experience_and_why}</div>}
                <textarea
                  defaultValue={a.manager_notes || ''}
                  placeholder="Manager notes (saved on blur)"
                  onBlur={(e) => saveNotes(a.id, e.target.value)}
                  style={{ ...sel, minHeight: 60, width: '100%' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
