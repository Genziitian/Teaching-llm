'use client'

import { useState } from 'react'
import useSWR from 'swr'
import JobsThread, { fmt, jobsCard as card, jobsInput as inp } from './JobsThread'

const fetcher = (u: string) => fetch(u).then((r) => r.json())
const post = (body: object) => fetch('/api/jobs/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/** Does this person have any application (so "My work" is worth showing)? */
export function useHasWork() {
  const { data } = useSWR('/api/jobs/workspace', fetcher, { revalidateOnFocus: false })
  return Array.isArray(data?.applications) && data.applications.length > 0
}

function TaskCard({ t, onDone }: { t: any; onDone: () => void }) {
  const [text, setText] = useState(t.submission?.text || '')
  const [link, setLink] = useState(t.submission?.link || '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const s = t.submission
  const overdue = t.deadline && !s && new Date(t.deadline + 'T23:59:59') < new Date()
  const locked = s?.status === 'APPROVED'
  const submit = async () => {
    setBusy(true); setErr('')
    const r = await post({ action: 'submit', taskId: t.id, text, link })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) setErr(d.error || 'Could not submit'); else onDone()
  }
  const badge = s ? (s.status === 'APPROVED' ? 'Approved' : s.status === 'CHANGES' ? 'Changes requested' : 'Submitted') : overdue ? 'Overdue' : 'To do'
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ color: 'var(--text-primary)' }}>{t.title}</b>
        <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border)', color: overdue || s?.status === 'CHANGES' ? 'var(--danger)' : 'var(--text-secondary)' }}>{badge}</span>
      </div>
      {t.deadline && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Due {t.deadline}</div>}
      {t.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0', whiteSpace: 'pre-wrap' }}>{t.description}</p>}
      {s?.review_note && <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '6px 0' }}>Manager: {s.review_note}</p>}
      {!locked && (
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <textarea style={{ ...inp, minHeight: 70 }} placeholder="Your work or notes" value={text} onChange={(e) => setText(e.target.value)} />
          <input style={inp} placeholder="Link (Drive, Docs, GitHub ...)" value={link} onChange={(e) => setLink(e.target.value)} />
          {err && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</span>}
          <div><button className="btn btn-primary" onClick={submit} disabled={busy}>{s ? 'Update submission' : 'Submit'}</button></div>
        </div>
      )}
    </div>
  )
}

export default function JobsWorkspace() {
  const { data, mutate } = useSWR('/api/jobs/workspace', fetcher, { revalidateOnFocus: false })
  if (!data) return <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
  if (data.error) return <p style={{ color: 'var(--danger)' }}>{data.error}</p>
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{(data.applications || []).map((a: any) => `${a.role_title || a.role} (${a.status || 'PENDING'}, applied ${fmt(a.created_at)})`).join(' · ')}</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {data.tasks.length === 0 && <div style={card}><span style={{ color: 'var(--text-muted)', fontSize: 14 }}>No tasks assigned yet.</span></div>}
        {data.tasks.map((t: any) => <TaskCard key={t.id} t={t} onDone={() => mutate()} />)}
      </div>
      <JobsThread
        me="APPLICANT"
        messages={data.messages}
        timeline={data.timeline}
        onSend={async (text) => { await post({ action: 'message', text }); await mutate() }}
      />
    </div>
  )
}
