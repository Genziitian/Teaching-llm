'use client'

import type { ReactNode } from 'react'
import { CalendarClock, Clock, UserX } from 'lucide-react'
import { DAY, HOUR, MINUTE, phoneDigits, type CallOutcome, type Lead } from './FollowUpsLogic'

export const fmtMoney = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`

export function fmtSpan(ms: number) {
  const abs = Math.abs(ms)
  if (abs < HOUR) return `${Math.max(1, Math.round(abs / MINUTE))}m`
  if (abs < DAY) return `${Math.round(abs / HOUR)}h`
  return `${Math.round(abs / DAY)}d`
}

export const ago = (t: number, now: number) => `${fmtSpan(now - t)} ago`

export const fmtDateTime = (t: number) =>
  new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export const waLink = (lead: Lead, courseNames: string) => {
  const d = phoneDigits(lead.phone)
  const first = (lead.name || '').split(' ')[0] || 'there'
  const msg = `Hi ${first}, this is GenZ IITian. We saw you were enrolling in ${courseNames || 'our course'} but the payment didn't go through. Can we help you complete it?`
  return `https://wa.me/91${d}?text=${encodeURIComponent(msg)}`
}

export const HEAT_BADGE: Record<Lead['heat'], string> = {
  HOT: 'badge badge-danger',
  WARM: 'badge badge-warning',
  COOL: 'badge badge-gray',
}

export const OUTCOME_BADGE: Record<CallOutcome, string> = {
  NO_ANSWER: 'badge badge-gray',
  CALLBACK: 'badge badge-info',
  INTERESTED: 'badge badge-success',
  NOT_INTERESTED: 'badge badge-danger',
  WRONG_NUMBER: 'badge badge-danger',
  ALREADY_BOUGHT: 'badge badge-primary',
  NOTE: 'badge badge-gray',
}

export type StatTone = 'danger' | 'warning' | 'success' | 'info'

export function FollowUpsStatCard({ tone, label, icon, value, sub }: { tone: StatTone; label: string; icon: ReactNode; value: string; sub: string }) {
  return (
    <div className="card" style={{ padding: 18, borderLeft: `4px solid var(--${tone})`, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: `var(--${tone})` }}>{label}</span>
        <span style={{ width: 30, height: 30, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `var(--${tone}-light)`, color: `var(--${tone})`, flexShrink: 0 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{sub}</div>
    </div>
  )
}

export function FollowUpsRule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{title}: </span>
      {children}
    </div>
  )
}

const line: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }

export function FollowUpsTiming({ lead, now }: { lead: Lead; now: number }) {
  if (lead.stage === 'RECOVERED' && lead.recoveredOrder) {
    return (
      <span style={{ fontWeight: 600, color: lead.recoveredAfterCall ? 'var(--success)' : 'var(--text-secondary)' }}>
        {lead.recoveredAfterCall ? 'After our call' : 'On their own'} · {ago(lead.recoveredOrder.at, now)}
      </span>
    )
  }
  if (lead.stage === 'DROPPED') {
    return <span style={{ ...line, fontWeight: 500, color: 'var(--text-secondary)' }}><UserX size={12} />{lead.dropReason}</span>
  }
  const daysLeft = Math.max(0, Math.ceil((lead.expiresAt - now) / DAY))
  const expiry = <span style={{ color: 'var(--text-muted)' }}>drops in {daysLeft}d</span>
  if (lead.stage === 'DUE') {
    const late = lead.dueAt ? now - lead.dueAt : 0
    return (
      <>
        <span style={{ ...line, color: 'var(--danger)' }}>
          <Clock size={12} />
          {late > 2 * HOUR ? `Waiting ${fmtSpan(late)}` : 'Due now'}
        </span>
        {expiry}
      </>
    )
  }
  return (
    <>
      <span style={{ ...line, color: 'var(--info)' }}>
        <CalendarClock size={12} />
        {lead.stage === 'COOLING' ? `Ready in ${fmtSpan((lead.dueAt || now) - now)}` : `Next call ${fmtDateTime(lead.dueAt || now)}`}
      </span>
      {expiry}
    </>
  )
}
