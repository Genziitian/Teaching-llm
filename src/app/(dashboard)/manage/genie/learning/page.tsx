'use client'

import { useState } from 'react'
import useSWR from 'swr'
import PageShell from '@/components/storefront/PageShell'

type Item = {
  id: string; question: string; answer: string; status: string; source: string
  courseName: string | null; askedBy: string | null; answeredBy: string | null; createdAt: string
}
type Data = { pending: number; items: Item[] }

const fetcher = async (url: string) => {
  const r = await fetch(url)
  const d = await r.json()
  if (!r.ok) throw new Error(d.error || 'Failed to load')
  return d
}
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
const btn = (bg: string, fg = '#fff') => ({ padding: '7px 14px', borderRadius: 8, border: 'none', background: bg, color: fg, fontSize: 13, fontWeight: 600, cursor: 'pointer' })
const field = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg-card, #fff)', color: 'var(--text-primary)' }

export default function GenieLearningPage() {
  const { data: me, isLoading: meLoading } = useSWR('/api/auth/me', fetcher)
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('PENDING')
  const isManager = me?.user?.role === 'MANAGER'
  const { data, error, mutate } = useSWR<Data>(isManager ? `/api/genie/learned?status=${status}` : null, fetcher)

  if (meLoading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
  if (!isManager) {
    return <p style={{ maxWidth: 560, margin: '48px auto', textAlign: 'center', color: 'var(--text-muted)' }}>Manager access required.</p>
  }

  return (
    <PageShell title="GenZie learning" description="Answers GenZie picked up from community chats.">
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-secondary)' }}>
        When staff answer a student&apos;s question in a course chat, GenZie saves the pair here. Approved answers are used for GenZie&apos;s auto-replies in community chats. Nothing is used until you approve it.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)} style={btn(status === s ? 'var(--primary)' : 'transparent', status === s ? '#fff' : 'var(--text-secondary)')}>
            {s[0] + s.slice(1).toLowerCase()}{s === 'PENDING' && data?.pending ? ` (${data.pending})` : ''}
          </button>
        ))}
      </div>
      {error && <p style={{ color: '#dc2626' }}>{error.message}</p>}
      {!data && !error && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      {data?.items.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nothing here.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {data?.items.map(item => <Row key={item.id} item={item} onDone={() => mutate()} />)}
      </div>
    </PageShell>
  )
}

function Row({ item, onDone }: { item: Item; onDone: () => void }) {
  const [editing, setEditing] = useState(false)
  const [question, setQuestion] = useState(item.question)
  const [answer, setAnswer] = useState(item.answer)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function review(action: 'approve' | 'reject') {
    setBusy(true); setErr('')
    const r = await fetch(`/api/genie/learned/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action === 'approve' && editing ? { action, question, answer } : { action }),
    })
    setBusy(false)
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || 'Failed'); return }
    onDone()
  }

  const meta = [item.courseName, item.askedBy && `asked by ${item.askedBy}`, item.answeredBy && `answered by ${item.answeredBy}`,
    item.source === 'UNANSWERED' ? 'GenZie had no answer' : 'GenZie also replied', new Date(item.createdAt).toLocaleString()].filter(Boolean).join(' · ')

  return (
    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border, #e5e7eb)', background: 'var(--bg-card, #fff)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{meta}</div>
      {editing ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Question<textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2} style={field} /></label>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Answer<textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={4} style={field} /></label>
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 600, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>Q: {item.question}</div>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>A: {item.answer}</div>
        </>
      )}
      {err && <p style={{ color: '#dc2626', fontSize: 13 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {item.status !== 'APPROVED' || editing ? (
          <button disabled={busy} onClick={() => review('approve')} style={btn('#16a34a')}>{editing ? 'Save & approve' : 'Approve'}</button>
        ) : null}
        <button disabled={busy} onClick={() => setEditing(!editing)} style={btn('transparent', 'var(--text-secondary)')}>{editing ? 'Cancel edit' : 'Edit'}</button>
        {item.status !== 'REJECTED' && <button disabled={busy} onClick={() => review('reject')} style={btn('#dc2626')}>Reject</button>}
      </div>
    </div>
  )
}
