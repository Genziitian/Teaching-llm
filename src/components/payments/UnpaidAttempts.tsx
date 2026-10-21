'use client'

import { useState } from 'react'
import useSWR from 'swr'

type Attempt = {
  id: string
  kind: string
  itemName: string
  amount: number | null
  gateway: string
  platform: string
  status: string
  reason: string | null
  orderRef: string | null
  paymentRef: string | null
  followUpStatus: string
  followUpNote: string | null
  stopReasons: string | null
  stopNote: string | null
  followedUpAt: string | null
  createdAt: string
  user: { id: string; name: string; email: string; mobileNumber: string | null }
}

const STATUS: Record<string, { label: string; color: string }> = {
  STARTED: { label: 'Did not finish', color: '#8e8e93' },
  CANCELLED: { label: 'Cancelled', color: '#ff9f0a' },
  FAILED: { label: 'Failed', color: '#ff453a' },
  PENDING_VERIFY: { label: 'Paid, not confirmed', color: '#0a84ff' },
  SUCCESS: { label: 'Paid', color: '#30c46f' },
  TIMED_OUT: { label: 'Timed out (24h)', color: '#8e8e93' },
}
const WHY: Record<string, string> = {
  PRICE: 'Price is too high', ASK_FAMILY: 'Need to ask family', PAYMENT_PROBLEM: 'Payment problem', NOT_SURE_WHICH: 'Not sure which to pick',
  WANT_DISCOUNT: 'Wants a discount', JUST_LOOKING: 'Just looking', NEED_MORE_INFO: 'Needs more info', BUY_LATER: 'Will buy later', OTHER: 'Other',
}
const FOLLOW: Record<string, string> = { NEW: 'New', CONTACTED: 'Contacted', RESOLVED: 'Resolved', NO_RESPONSE: 'No response' }

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(r.status === 403 ? 'forbidden' : 'failed')
  return r.json()
}

export default function UnpaidAttempts() {
  const [status, setStatus] = useState('all')
  const [follow, setFollow] = useState('NEW')
  const { data, error, isLoading, mutate } = useSWR<{ attempts: Attempt[] }>(
    `/api/payment-attempts?all=1&status=${status}&followUp=${follow}`, fetcher, { refreshInterval: 60000 })
  const [busy, setBusy] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  async function save(a: Attempt, followUpStatus: string) {
    setBusy(a.id)
    try {
      await fetch('/api/payment-attempts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, followUpStatus, followUpNote: notes[a.id] ?? a.followUpNote ?? '' }),
      })
      await mutate()
    } finally { setBusy('') }
  }

  const wa = (n: string | null) => (n ? `https://wa.me/${n.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}` : '')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', flex: '1 1 240px' }}>Students who tried to pay but did not finish. Reach out to find out why. Checkouts expire after 24 hours.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="form-input" value={status} onChange={e => setStatus(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">All unpaid</option>
            {['FAILED', 'CANCELLED', 'STARTED', 'PENDING_VERIFY', 'TIMED_OUT'].map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </select>
          <select className="form-input" value={follow} onChange={e => setFollow(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Any follow-up</option>
            {Object.entries(FOLLOW).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {error ? <div className="card" style={{ padding: 20 }}>{error.message === 'forbidden' ? 'Only managers can see payment attempts.' : 'Could not load attempts. Try again.'}</div>
        : isLoading ? <div className="card" style={{ padding: 20 }}>Loading…</div>
        : !data?.attempts.length ? <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Nothing to follow up. 🎉</div>
        : <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,380px),1fr))' }}>
          {data.attempts.map(a => {
            const st = STATUS[a.status] || STATUS.STARTED
            return (
              <div key={a.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, borderLeft: `4px solid ${st.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5, wordBreak: 'break-word' }}>{a.itemName}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{a.kind} · {a.platform === 'APP' ? 'App' : 'Website'} · {a.gateway === 'PLAY' ? 'Google Play' : 'Razorpay'}</div>
                  </div>
                  <div style={{ textAlign: 'right', flex: 'none' }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{a.amount != null ? `₹${Math.round(a.amount)}` : '—'}</div>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: st.color, background: `color-mix(in srgb, ${st.color} 14%, transparent)`, padding: '3px 9px', borderRadius: 999 }}>{st.label}</span>
                  </div>
                </div>
                {a.reason && <div style={{ fontSize: 13, padding: '8px 10px', borderRadius: 10, background: 'color-mix(in srgb, var(--text-muted) 10%, transparent)' }}>Reason: {a.reason}</div>}
                {(a.stopReasons || a.stopNote) && (
                  <div style={{ fontSize: 13, padding: '8px 10px', borderRadius: 10, background: 'color-mix(in srgb, var(--primary) 10%, transparent)' }}>
                    <b>Student said:</b> {a.stopReasons?.split('|').map(r => WHY[r] || r).join(', ')}
                    {a.stopNote && <div style={{ marginTop: 2 }}>&ldquo;{a.stopNote}&rdquo;</div>}
                  </div>
                )}
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <b>{a.user.name}</b><br />
                  <a href={`mailto:${a.user.email}`} style={{ color: 'var(--primary)' }}>{a.user.email}</a>
                  {a.user.mobileNumber && <> · <a href={`tel:${a.user.mobileNumber}`} style={{ color: 'var(--primary)' }}>{a.user.mobileNumber}</a> · <a href={wa(a.user.mobileNumber)} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', fontWeight: 700 }}>WhatsApp</a></>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(a.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  {a.orderRef && <> · Order {a.orderRef}</>}{a.paymentRef && <> · Pay {a.paymentRef}</>}
                </div>
                <input className="form-input" placeholder="Note: what did the student say?" defaultValue={a.followUpNote ?? ''} onChange={e => setNotes(n => ({ ...n, [a.id]: e.target.value }))} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(FOLLOW).map(([k, v]) => (
                    <button key={k} disabled={busy === a.id} onClick={() => save(a, k)} className="btn btn-sm"
                      style={{ borderRadius: 999, fontWeight: 600, ...(a.followUpStatus === k ? { background: 'var(--primary)', color: '#fff' } : {}) }}>{v}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>}
    </div>
  )
}
