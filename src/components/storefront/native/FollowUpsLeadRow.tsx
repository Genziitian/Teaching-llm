'use client'

import { Check, ChevronDown, Copy, Mail, MessageCircle, PhoneCall, Trash2 } from 'lucide-react'
import { OUTCOME_LABELS, phoneDigits, type Lead } from './FollowUpsLogic'
import { HEAT_BADGE, OUTCOME_BADGE, FollowUpsTiming, ago, fmtDateTime, fmtMoney, waLink } from './FollowUpsUi'

export type FollowUpsView = 'DUE' | 'SCHEDULED' | 'RECOVERED' | 'DROPPED'

const muted: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)' }
const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)',
  textDecoration: 'none', flexShrink: 0,
}
const panel: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, minWidth: 0 }
const panelTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }

export default function FollowUpsLeadRow({
  lead,
  view,
  now,
  open,
  copied,
  canLog,
  courseList,
  onToggle,
  onCopy,
  onLog,
  onDeleteCall,
}: {
  lead: Lead
  view: FollowUpsView
  now: number
  open: boolean
  copied: boolean
  canLog: boolean
  courseList: (ids: string[]) => string[]
  onToggle: () => void
  onCopy: () => void
  onLog: () => void
  onDeleteCall: (id: string) => void
}) {
  const names = courseList(lead.courseIds)
  const showHeat = view === 'DUE' || view === 'SCHEDULED'
  const actionable = view !== 'RECOVERED'

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        {/* Who */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          style={{ textAlign: 'left', minWidth: 0, flex: '1 1 220px', maxWidth: 300, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {showHeat && <span className={HEAT_BADGE[lead.heat]} style={{ fontWeight: 800, letterSpacing: 0.4 }}>{lead.heat}</span>}
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name || lead.email}</span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
          </div>
          <div style={{ ...muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email}</div>
          <div style={{ ...muted, fontFamily: 'monospace' }}>{lead.phone || 'No phone'}</div>
        </button>

        {/* What */}
        <div style={{ flex: '2 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {names.map((nm) => (
              <span key={nm} className="badge badge-info" style={{ borderRadius: 6 }}>{nm}</span>
            ))}
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {lead.reasons.map((r) => (
              <span key={r} className="badge badge-gray" style={{ borderRadius: 6, fontSize: 10 }}>{r}</span>
            ))}
            {lead.lastCall && (
              <span className={OUTCOME_BADGE[lead.lastCall.outcome]} style={{ borderRadius: 6, fontSize: 10 }}>
                Last: {OUTCOME_LABELS[lead.lastCall.outcome]} · {ago(new Date(lead.lastCall.created_at).getTime(), now)}
              </span>
            )}
          </div>
        </div>

        {/* Money + timing */}
        <div style={{ flex: '0 0 auto', minWidth: 150, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontSize: 12, textAlign: 'right' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--success)' }}>
            {fmtMoney(view === 'RECOVERED' ? lead.recoveredOrder?.amount || 0 : lead.cartValue)}
          </span>
          <FollowUpsTiming lead={lead} now={now} />
        </div>

        {/* Actions */}
        {actionable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
            {lead.hasPhone ? (
              <>
                <a href={`tel:+91${phoneDigits(lead.phone)}`} style={iconBtn} title="Call" aria-label="Call"><PhoneCall size={16} /></a>
                <a href={waLink(lead, names.join(', '))} target="_blank" rel="noreferrer" style={{ ...iconBtn, color: 'var(--success)' }} title="WhatsApp" aria-label="WhatsApp">
                  <MessageCircle size={16} />
                </a>
                <button type="button" onClick={onCopy} style={iconBtn} title="Copy number" aria-label="Copy number">
                  {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
                </button>
              </>
            ) : (
              <a href={`mailto:${lead.email}`} style={iconBtn} title="Email" aria-label="Email"><Mail size={16} /></a>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onLog}
              disabled={!canLog}
              title={canLog ? undefined : 'Call logging needs the one-time database setup'}
              style={{ whiteSpace: 'nowrap', opacity: canLog ? 1 : 0.45, cursor: canLog ? 'pointer' : 'not-allowed' }}
            >
              Log call
            </button>
          </div>
        )}
      </div>

      {open && (
        <div style={{ padding: '0 18px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 12, fontSize: 12 }}>
          <div style={panel}>
            <div style={panelTitle}>Checkout attempts ({lead.attempts.length})</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lead.attempts.slice().reverse().map((a) => (
                <li key={a.orderId} style={{ display: 'flex', flexWrap: 'wrap', columnGap: 8, color: 'var(--text-secondary)' }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDateTime(a.at)}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtMoney(a.amount)}</span>
                  <span>{courseList(a.courseIds).join(', ')}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{a.orderId}</span>
                </li>
              ))}
            </ul>
            {lead.recoveredOrder && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', color: 'var(--success)', fontWeight: 600 }}>
                Paid {fmtMoney(lead.recoveredOrder.amount)} on {fmtDateTime(lead.recoveredOrder.at)} for {courseList(lead.recoveredOrder.courseIds).join(', ')}
              </div>
            )}
          </div>

          <div style={panel}>
            <div style={panelTitle}>Call history</div>
            {lead.calls.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Not called yet</div>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lead.calls.slice().reverse().map((c) => (
                <li key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span className={OUTCOME_BADGE[c.outcome]} style={{ borderRadius: 6, fontSize: 10, flexShrink: 0 }}>{OUTCOME_LABELS[c.outcome]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {fmtDateTime(new Date(c.created_at).getTime())}
                      {c.called_by ? ` · ${c.called_by.split('@')[0]}` : ''}
                      {c.callback_at ? ` · call back ${fmtDateTime(new Date(c.callback_at).getTime())}` : ''}
                    </div>
                    {c.note && <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.note}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteCall(c.id)}
                    title="Remove this entry"
                    aria-label="Remove this entry"
                    style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
