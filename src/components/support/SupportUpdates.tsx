'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isSupportOpen, ticketNo } from '@/lib/support-limits'
import { api, CallRow, startSupportCall } from './SupportCall'

interface TicketLite {
  id: string
  ticketNumber?: number | null
  title: string
  status: string
  replies: { createdAt: string; sender: { role: string } }[]
}

type Item = { key: string; title: string; sub: string; action?: React.ReactNode; at: number }

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/**
 * Student dashboard card: what support needs you to see. Missed calls from support (call back),
 * your booked call back, and ticket replies waiting for you. Renders nothing when there's nothing.
 */
export default function SupportUpdates() {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    const openGenie = () => window.dispatchEvent(new Event('genie:open'))
    const load = async () => {
      const [calls, tickets] = await Promise.all([
        api('/api/support/calls').catch(() => []) as Promise<CallRow[]>,
        api('/api/support/tickets').catch(() => []) as Promise<TicketLite[]>,
      ])
      const out: Item[] = []
      const lastOwnCall = Math.max(0, ...calls.filter(c => c.type === 'CALL').map(c => +new Date(c.createdAt)))
      for (const c of calls) {
        const at = +new Date(c.createdAt)
        // Support tried to call in the last day and the student hasn't called since.
        if (c.type === 'CALL_OUT' && c.status === 'MISSED' && Date.now() - at < 86400000 && at > lastOwnCall) {
          out.push({
            key: c.id, at,
            title: `Missed call from ${c.manager?.name || 'Support'}`,
            sub: when(c.createdAt),
            action: isSupportOpen()
              ? <button className="gz-btn gz-ed-sm" onClick={() => startSupportCall()}>Call back</button>
              : <button className="gz-btn gz-ed-sm" onClick={openGenie}>Book a call back</button>,
          })
        }
        if (c.type === 'SCHEDULED' && (c.status === 'REQUESTED' || c.status === 'ACCEPTED')) {
          out.push({
            key: c.id, at,
            title: c.status === 'ACCEPTED' ? 'Your support call is confirmed' : 'Call back requested',
            sub: `${when(c.scheduledFor!)}${c.status === 'ACCEPTED' ? ' · we will call you in the app' : ' · waiting for the team to confirm'}`,
            action: <Link className="gz-btn gz-btn--ghost gz-ed-sm" href="/support">View</Link>,
          })
        }
      }
      for (const t of Array.isArray(tickets) ? tickets : []) {
        const last = t.replies?.[t.replies.length - 1]
        if (!last || last.sender.role === 'STUDENT' || t.status === 'CLOSED' || t.status === 'RESOLVED') continue
        out.push({
          key: t.id, at: +new Date(last.createdAt),
          title: `Support replied on ticket #${ticketNo(t)}`,
          sub: t.title,
          action: <Link className="gz-btn gz-ed-sm" href={`/support?ticket=${t.id}`}>Open</Link>,
        })
      }
      setItems(out.sort((a, b) => b.at - a.at))
    }
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 60000)
    window.addEventListener('support-call:check', load) // live push when a call rings / ends
    return () => { clearInterval(t); window.removeEventListener('support-call:check', load) }
  }, [])

  if (items.length === 0) return null
  return (
    <section className="gz-panel" aria-label="Support updates" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>From Support</h3>
        <Link href="/support" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Support →</Link>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.slice(0, 4).map(i => (
          <li key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{i.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{i.sub}</div>
            </div>
            {i.action}
          </li>
        ))}
      </ul>
    </section>
  )
}
