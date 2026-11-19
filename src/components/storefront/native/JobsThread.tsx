'use client'

import { useState } from 'react'

const card: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: 14 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14 }
export const jobsCard = card
export const jobsInput = inp
export const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')

/** Message thread with the manager + the full timeline. Used by both the applicant and the manager view. */
export default function JobsThread({ messages, timeline, me, onSend }: {
  messages: { id: string; sender: string; sender_name: string; text: string; created_at: string }[]
  timeline: { at: string; type: string; text: string }[]
  me: 'APPLICANT' | 'MANAGER'
  onSend: (text: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    try { await onSend(text); setText('') } finally { setBusy(false) }
  }
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={card}>
        <b style={{ color: 'var(--text-primary)' }}>Messages</b>
        <div style={{ display: 'grid', gap: 8, margin: '10px 0', maxHeight: 280, overflowY: 'auto' }}>
          {messages.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No messages yet.</span>}
          {messages.map((m) => {
            const mine = m.sender === me
            return (
              <div key={m.id} style={{ justifySelf: mine ? 'end' : 'start', maxWidth: '80%', padding: '8px 12px', borderRadius: 12, background: mine ? 'var(--primary)' : 'var(--surface-2)', color: mine ? 'var(--button-text, #000)' : 'var(--text-primary)', fontSize: 14 }}>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{mine ? 'You' : m.sender_name} · {fmt(m.created_at)}</div>
                {m.text}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={inp} value={text} placeholder="Write a message or add a point" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void send()} />
          <button className="btn btn-primary" onClick={send} disabled={busy}>Send</button>
        </div>
      </div>
      <div style={card}>
        <b style={{ color: 'var(--text-primary)' }}>Timeline</b>
        <div style={{ margin: '10px 0 0', borderLeft: '2px solid var(--border)', paddingLeft: 14, display: 'grid', gap: 10 }}>
          {timeline.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing yet.</span>}
          {timeline.map((e, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(e.at)}</div>
              {e.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
