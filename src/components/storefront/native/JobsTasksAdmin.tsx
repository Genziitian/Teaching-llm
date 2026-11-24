'use client'

import { useState } from 'react'
import useSWR from 'swr'
import JobsThread, { fmt, jobsCard as card, jobsInput as inp } from './JobsThread'

const fetcher = (u: string) => fetch(u).then((r) => r.json())
const api = '/api/manage/jobs/workspace'
const post = (body: object) => fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))

export default function JobsTasksAdmin() {
  const { data, mutate } = useSWR(api, fetcher, { revalidateOnFocus: false })
  const [form, setForm] = useState({ title: '', description: '', deadline: '', mode: 'ALL', role: '', emails: [] as string[] })
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | null>(null) // applicant whose thread is open
  const { data: ws, mutate: mutateWs } = useSWR(open ? `${api}?email=${encodeURIComponent(open)}` : null, fetcher)

  if (!data) return <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
  if (data.error) return <p style={{ color: 'var(--danger)' }}>{data.error}</p>

  const create = async () => {
    setErr('')
    const r = await post({ action: 'createTask', ...form })
    if (!r.ok) { setErr(r.d.error || 'Could not create'); return }
    setForm({ title: '', description: '', deadline: '', mode: 'ALL', role: '', emails: [] })
    await mutate()
  }
  const toggleEmail = (e: string) => setForm((f) => ({ ...f, emails: f.emails.includes(e) ? f.emails.filter((x) => x !== e) : [...f.emails, e] }))
  const waiting = (data.submissions || []).filter((s: any) => s.status === 'SUBMITTED').length
  const subsOf = (id: string) => (data.submissions || []).filter((s: any) => s.task_id === id)

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {waiting > 0 && <div style={{ ...card, color: 'var(--text-primary)', fontWeight: 600 }}>{waiting} submission{waiting > 1 ? 's' : ''} waiting for your review</div>}
      <div style={{ ...card, display: 'grid', gap: 10 }}>
        <b style={{ color: 'var(--text-primary)' }}>New task</b>
        <input style={inp} placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea style={{ ...inp, minHeight: 70 }} placeholder="What should they do?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <div><label style={{ fontSize: 12, fontWeight: 600 }}>Deadline</label><input style={inp} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Assign to</label>
            <select style={inp} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="ALL">Everyone who applied</option>
              <option value="ROLE">All applicants of one job</option>
              <option value="SELECTED">Selected people</option>
            </select>
          </div>
          {form.mode === 'ROLE' && (
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Job</label>
              <select style={inp} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="">Choose a job</option>
                {data.roles.map((r: any) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
          )}
        </div>
        {form.mode === 'SELECTED' && (
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, display: 'grid', gap: 4 }}>
            {data.applicants.map((a: any) => (
              <label key={a.email} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                <input type="checkbox" checked={form.emails.includes(a.email)} onChange={() => toggleEmail(a.email)} /> {a.name} <span style={{ color: 'var(--text-muted)' }}>{a.email} · {a.roles.join(', ')}</span>
              </label>
            ))}
          </div>
        )}
        {err && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</span>}
        <div><button className="btn btn-primary" onClick={create}>Assign task</button></div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {data.tasks.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No tasks yet.</p>}
        {data.tasks.map((t: any) => (
          <div key={t.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <b style={{ color: 'var(--text-primary)' }}>{t.title}</b>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {t.mode === 'ALL' ? 'Everyone' : t.mode === 'ROLE' ? `Job: ${data.roles.find((r: any) => r.id === t.role)?.title || t.role}` : `${(t.emails || []).length} selected`}
                  {t.deadline ? ` · due ${t.deadline}` : ''}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => window.confirm(`Delete "${t.title}" and its submissions?`) && post({ action: 'deleteTask', id: t.id }).then(() => mutate())}>Delete</button>
            </div>
            {subsOf(t.id).map((s: any) => (
              <div key={s.id} style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                <b style={{ color: 'var(--text-primary)' }}>{s.name}</b> · {s.status} · {fmt(s.updated_at || s.created_at)}
                {s.text && <div style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{s.text}</div>}
                {s.link && <a href={s.link} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>{s.link}</a>}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => post({ action: 'review', id: s.id, status: 'APPROVED' }).then(() => mutate())}>Approve</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { const note = window.prompt('What should they change?') ; if (note != null) post({ action: 'review', id: s.id, status: 'CHANGES', note }).then(() => mutate()) }}>Ask for changes</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setOpen(s.email)}>Open thread</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={card}>
        <b style={{ color: 'var(--text-primary)' }}>People</b>
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {data.applicants.map((a: any) => (
            <button key={a.email} onClick={() => setOpen(open === a.email ? null : a.email)} className="btn btn-ghost" style={{ justifyContent: 'space-between', display: 'flex', textAlign: 'left' }}>
              <span>{a.name} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{a.email}</span></span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.roles.join(', ')}</span>
            </button>
          ))}
        </div>
      </div>

      {open && ws && !ws.error && (
        <div>
          <b style={{ color: 'var(--text-primary)' }}>Thread with {open}</b>
          <div style={{ marginTop: 8 }}>
            <JobsThread me="MANAGER" messages={ws.messages} timeline={ws.timeline} onSend={async (text) => { await post({ action: 'message', email: open, text }); await mutateWs() }} />
          </div>
        </div>
      )}
    </div>
  )
}
