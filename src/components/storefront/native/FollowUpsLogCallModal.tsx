'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { HOUR, MINUTE, OUTCOME_LABELS, type CallOutcome, type Lead } from './FollowUpsLogic'
import { fmtMoney } from './FollowUpsUi'

const OUTCOME_OPTIONS: { id: CallOutcome; hint: string }[] = [
  { id: 'NO_ANSWER', hint: 'Retry automatically' },
  { id: 'CALLBACK', hint: 'Pick a time' },
  { id: 'INTERESTED', hint: 'Check again in 2 days' },
  { id: 'NOT_INTERESTED', hint: 'Drops the lead' },
  { id: 'WRONG_NUMBER', hint: 'Drops the lead' },
  { id: 'ALREADY_BOUGHT', hint: 'Drops the lead' },
  { id: 'NOTE', hint: 'Just add a note' },
]

const toLocalInput = (d: Date) => {
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

function presets() {
  const base = new Date()
  const in2h = new Date(base.getTime() + 2 * HOUR)
  const tonight = new Date(base)
  tonight.setHours(19, 0, 0, 0)
  const tomorrow = new Date(base)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(11, 0, 0, 0)
  const list = [{ label: 'In 2 hours', d: in2h }]
  if (tonight.getTime() > base.getTime() + 30 * MINUTE) list.push({ label: 'Today 7 PM', d: tonight })
  list.push({ label: 'Tomorrow 11 AM', d: tomorrow })
  return list
}

const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)' }

export default function FollowUpsLogCallModal({
  lead,
  courseNames,
  onClose,
  onSave,
}: {
  lead: Lead | null
  courseNames: string
  onClose: () => void
  onSave: (outcome: CallOutcome, note: string, callbackAt: string | null) => Promise<void>
}) {
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [note, setNote] = useState('')
  const [callback, setCallback] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setOutcome(null)
    setNote('')
    setCallback('')
    setErr(null)
  }, [lead?.key])

  useEffect(() => {
    if (!lead) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lead, saving, onClose])

  if (!lead) return null

  const submit = async () => {
    if (!outcome) return
    if (outcome === 'NOTE' && !note.trim()) {
      setErr('Write the note first')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const cb = outcome === 'CALLBACK' && callback ? new Date(callback).toISOString() : null
      await onSave(outcome, note, cb)
    } catch (e: any) {
      setErr(e?.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Log call" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.name || lead.email}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{lead.phone || 'No phone'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{courseNames} · {fmtMoney(lead.cartValue)}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" disabled={saving}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={sectionLabel}>What happened?</div>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: 8 }}>
              {OUTCOME_OPTIONS.map((o) => {
                const on = outcome === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOutcome(o.id)}
                    style={{
                      textAlign: 'left', padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                      border: on ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                      background: on ? 'var(--primary)' : 'var(--bg)', color: on ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{OUTCOME_LABELS[o.id]}</div>
                    <div style={{ fontSize: 11, opacity: on ? 0.8 : 1, color: on ? '#fff' : 'var(--text-muted)' }}>{o.hint}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {outcome === 'CALLBACK' && (
            <div>
              <div style={sectionLabel}>Call back at</div>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {presets().map((p) => (
                  <button key={p.label} type="button" className="btn btn-secondary btn-sm" onClick={() => setCallback(toLocalInput(p.d))}>{p.label}</button>
                ))}
              </div>
              <input type="datetime-local" className="form-input" value={callback} onChange={(e) => setCallback(e.target.value)} style={{ marginTop: 8, border: '1.5px solid var(--border)' }} />
              {!callback && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>Leave empty for tomorrow, same time.</div>}
            </div>
          )}

          <div>
            <div style={sectionLabel}>Note {outcome === 'NOTE' ? '' : '(optional)'}</div>
            <textarea
              className="form-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Payment failed on UPI, will try with card tonight. Wants Stats 1 only."
              style={{ marginTop: 8, resize: 'vertical', minHeight: 80, border: '1.5px solid var(--border)', fontFamily: 'inherit' }}
            />
          </div>

          {err && <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{err}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={!outcome || saving}>
            {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />} Save
          </button>
        </div>
      </div>
    </div>
  )
}
