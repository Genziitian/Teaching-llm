'use client'

// Full detail view for one 1:1 booking: student profile, consultation info, student and manager
// notes, other bookings by the same student, and status / reschedule / cancel actions.
import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Calendar, CalendarClock, Check, CheckCircle2, Clock, Copy, Loader2, Mail, MessageCircle, Shield, Sparkles, User, XCircle } from 'lucide-react'
import {
  STATUS_CONFIG, TIME_SLOTS, bookingHistory, fmtDateTime, getStatusConfig, isIsoDate, mailLink, postBookingAction, splitSubjects, studentNote, tint, waLink,
  type Booking, type BookingStatus,
} from './OneOnOneTypes'

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }
const sectionTitle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }
const smallCaps: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }

export function StatusPill({ status, large }: { status: string; large?: boolean }) {
  const c = getStatusConfig(status)
  const Icon = c.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: large ? '5px 12px' : '3px 9px', borderRadius: 999, fontSize: large ? 12 : 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', color: c.color, background: tint(c.color), border: `1px solid ${tint(c.color, 30)}` }}>
      <Icon size={large ? 14 : 12} /> {c.label}
    </span>
  )
}

type Props = {
  booking: Booking
  allBookings: Booking[]
  onOpen: (b: Booking) => void
  onPatch: (id: string, patch: Partial<Booking>) => void
}

type Mode = 'none' | 'reschedule' | 'cancel'

export default function OneOnOneDetail({ booking, allBookings, onOpen, onPatch }: Props) {
  const [notes, setNotes] = useState(booking.manager_notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>('none')
  const [newDate, setNewDate] = useState(isIsoDate(booking.slot_date) ? booking.slot_date : '')
  const [newSlot, setNewSlot] = useState(TIME_SLOTS.includes(booking.slot_time) ? booking.slot_time : TIME_SLOTS[0])
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [copied, setCopied] = useState('')
  const timers = useRef<number[]>([])

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)) }, [])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  const flash = (msg: string, ms = 2500) => { setToast(msg); later(() => setToast(''), ms) }

  const subs = splitSubjects(booking.subjects)
  const history = bookingHistory(allBookings, booking)
  const sNote = studentNote(booking)

  const copy = async (text: string, field: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(field)
      later(() => setCopied(''), 2000)
    } catch {
      setError('Copy failed. Select the text and copy it manually.')
    }
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    setError('')
    const r = await postBookingAction('update-notes', { id: booking.id, manager_notes: notes })
    if (r.ok) {
      onPatch(booking.id, { manager_notes: notes })
      setNotesSaved(true)
      later(() => setNotesSaved(false), 2500)
    } else setError(r.error || 'Failed to save notes')
    setSavingNotes(false)
  }

  const updateStatus = async (status: BookingStatus) => {
    setBusy(true)
    setError('')
    const r = await postBookingAction('update-status', { id: booking.id, status, manager_notes: notes })
    if (r.ok) {
      onPatch(booking.id, { status, manager_notes: notes })
      flash(`Status updated to ${getStatusConfig(status).label}`)
    } else setError(r.error || 'Failed to update status')
    setBusy(false)
  }

  const reschedule = async () => {
    if (!newDate || !newSlot) return
    setBusy(true)
    setError('')
    const r = await postBookingAction('reschedule', {
      id: booking.id,
      new_slot_date: newDate,
      new_slot_time: newSlot,
      reason: rescheduleReason.trim() || notes.trim() || 'Rescheduled by manager',
      manager_notes: notes,
    })
    if (r.ok) {
      onPatch(booking.id, { slot_date: newDate, slot_time: newSlot, status: 'RESCHEDULED', manager_notes: notes })
      setMode('none')
      setRescheduleReason('')
      flash('Slot rescheduled and student notified via email', 3000)
    } else setError(r.error || 'Failed to reschedule')
    setBusy(false)
  }

  const cancel = async () => {
    setBusy(true)
    setError('')
    const reason = cancelReason.trim() || notes.trim() || 'Cancelled by manager'
    const r = await postBookingAction('cancel', { id: booking.id, reason, manager_notes: reason })
    if (r.ok) {
      onPatch(booking.id, { status: 'CANCELLED', manager_notes: reason })
      setNotes(reason)
      setMode('none')
      setCancelReason('')
      flash('Booking cancelled and student notified via email', 3000)
    } else setError(r.error || 'Failed to cancel')
    setBusy(false)
  }

  const actionBtn = (key: string, color: string, Icon: typeof Clock, label: string, hint: string, active: boolean, disabled: boolean, onClick: () => void, wide = false) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      style={{
        gridColumn: wide ? '1 / -1' : undefined,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '10px 8px', borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled && !active ? 0.55 : 1,
        border: `1px solid ${active ? color : tint(color, 35)}`, background: active ? tint(color, 16) : 'var(--bg)', color,
        boxShadow: active ? `0 0 0 2px ${tint(color, 35)}` : 'none', fontSize: 13, fontWeight: 600,
      }}
    >
      <Icon size={16} />
      <span>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>{hint}</span>
    </button>
  )

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
      {/* LEFT: information */}
      <div style={{ flex: '1 1 540px', minWidth: 0, display: 'grid', gap: 16 }}>
        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>
                {(booking.name || 'B').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{booking.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Booked {fmtDateTime(booking.created_at)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {booking.phone && <a className="btn btn-success btn-sm" href={waLink(booking.phone, booking.name)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}><MessageCircle size={14} /> WhatsApp</a>}
              {booking.email && <a className="btn btn-secondary btn-sm" href={mailLink(booking.email)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}><Mail size={14} /> Email</a>}
            </div>
          </div>
          <dl style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', margin: '16px 0 0' }}>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface)' }}>
              <dt style={smallCaps}>Email address</dt>
              <dd style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-primary)', minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{booking.email || '—'}</span>
                {booking.email && <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(booking.email, 'email')} aria-label="Copy email">{copied === 'email' ? <Check size={14} /> : <Copy size={14} />}</button>}
              </dd>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface)' }}>
              <dt style={smallCaps}>WhatsApp / phone</dt>
              <dd style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-primary)' }}>
                <span style={{ flex: 1 }}>{booking.phone ? `+91 ${booking.phone}` : '—'}</span>
                {booking.phone && <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(booking.phone, 'phone')} aria-label="Copy number">{copied === 'phone' ? <Check size={14} /> : <Copy size={14} />}</button>}
              </dd>
            </div>
          </dl>
        </section>

        <section className="card" style={{ padding: 16 }}>
          <h3 style={sectionTitle}><Calendar size={16} /> Consultation information</h3>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface)' }}>
              <div style={smallCaps}>Date</div>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-primary)' }}><Calendar size={14} />{booking.slot_date}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface)' }}>
              <div style={smallCaps}>15-min slot</div>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-primary)' }}><Clock size={14} />{booking.slot_time}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface)' }}>
              <div style={smallCaps}>Level &amp; plan</div>
              <div style={{ marginTop: 4, fontWeight: 600, color: 'var(--text-primary)' }}>{booking.level || 'Foundation Level'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{booking.plan || '1:1 Personalised Teaching'}</div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={smallCaps}>Subjects requested ({subs.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {(subs.length ? subs : ['General']).map((s, i) => <span key={`${s}-${i}`} className="badge badge-primary">{s}</span>)}
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 12, color: 'var(--text-muted)' }}>
            <div>
              Booking ID <code style={{ color: 'var(--text-secondary)' }}>{booking.id}</code>{' '}
              <button type="button" onClick={() => copy(booking.id, 'id')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>{copied === 'id' ? 'Copied' : 'Copy'}</button>
            </div>
            <div>Last updated <span style={{ color: 'var(--text-secondary)' }}>{fmtDateTime(booking.updated_at || booking.created_at)}</span></div>
          </div>
        </section>

        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <h3 style={{ ...sectionTitle, margin: 0 }}><User size={16} /> Notes from student (query / blocker)</h3>
            <span className="badge badge-info">Student input</span>
          </div>
          {sNote
            ? <p style={{ margin: 0, padding: 12, borderRadius: 10, background: 'var(--surface)', fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{sNote}</p>
            : <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', color: 'var(--text-muted)' }}>No notes or blocker submitted by the student during booking.</p>}
        </section>

        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <h3 style={{ ...sectionTitle, margin: 0 }}><Shield size={16} /> Manager notes (internal follow-up)</h3>
            <span className="badge badge-warning">Manager only</span>
          </div>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add remarks, call outcome, student requirements, follow-up dates..."
            style={{ ...inputStyle, background: 'var(--surface)', resize: 'vertical', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ fontSize: 12, color: notesSaved ? 'var(--success)' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: notesSaved ? 600 : 400 }}>
              {notesSaved ? <><CheckCircle2 size={14} /> Note saved</> : 'Internal notes are never visible to students.'}
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={saveNotes} disabled={savingNotes || notes === (booking.manager_notes || '')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {savingNotes && <Loader2 size={14} className="animate-spin" />} Save note
            </button>
          </div>
        </section>

        {history.length > 0 && (
          <section className="card" style={{ padding: 16 }}>
            <h3 style={sectionTitle}>Other bookings by this student ({history.length})</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {history.map((h) => {
                const hs = splitSubjects(h.subjects)
                return (
                  <li key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 10, borderRadius: 10, background: 'var(--surface)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{h.slot_date} · {h.slot_time}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hs.slice(0, 2).join(', ') || 'General'}{hs.length > 2 ? ` +${hs.length - 2} more` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusPill status={h.status} />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpen(h)}>Open</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>

      {/* RIGHT: status + actions */}
      <aside style={{ flex: '1 1 300px', maxWidth: 420, minWidth: 0, display: 'grid', gap: 16, position: 'sticky', top: 16 }}>
        <section className="card" style={{ padding: 16 }}>
          <div style={smallCaps}>Current status</div>
          <div style={{ marginTop: 8 }}><StatusPill status={booking.status} large /></div>
          {toast && (
            <div role="status" style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'var(--success-light)', color: 'var(--success)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} /> {toast}
            </div>
          )}
          {error && (
            <div role="alert" style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </section>

        {mode === 'reschedule' && (
          <section className="card" style={{ padding: 16, border: `1px solid ${tint(STATUS_CONFIG.RESCHEDULED.color, 40)}` }}>
            <h3 style={{ ...sectionTitle, color: STATUS_CONFIG.RESCHEDULED.color }}><CalendarClock size={16} /> Reschedule session slot</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label htmlFor="oo-new-date" style={labelStyle}>New date</label>
                <input id="oo-new-date" type="date" style={inputStyle} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div>
                <label htmlFor="oo-new-slot" style={labelStyle}>New 15-min slot</label>
                <select id="oo-new-slot" style={inputStyle} value={newSlot} onChange={(e) => setNewSlot(e.target.value)}>
                  {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="oo-res-reason" style={labelStyle}>Reason (optional)</label>
                <input id="oo-res-reason" style={inputStyle} value={rescheduleReason} placeholder="e.g. Rescheduled after WhatsApp discussion" onChange={(e) => setRescheduleReason(e.target.value)} />
              </div>
              <p style={{ margin: 0, padding: 10, borderRadius: 8, background: 'var(--warning-light)', fontSize: 12, color: 'var(--text-secondary)' }}>
                Rescheduling sends a confirmation email to <strong>{booking.email || 'the student'}</strong>.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode('none')} disabled={busy}>Back</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={reschedule} disabled={busy || !newDate || !newSlot} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {busy && <Loader2 size={14} className="animate-spin" />} Confirm &amp; send email
                </button>
              </div>
            </div>
          </section>
        )}

        {mode === 'cancel' && (
          <section className="card" style={{ padding: 16, border: `1px solid ${tint(STATUS_CONFIG.CANCELLED.color, 40)}` }}>
            <h3 style={{ ...sectionTitle, color: STATUS_CONFIG.CANCELLED.color }}><XCircle size={16} /> Cancel 1:1 consultation</h3>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>Cancel the booking for <strong>{booking.name}</strong>?</p>
            <label htmlFor="oo-cancel-reason" style={labelStyle}>Reason for cancellation</label>
            <input id="oo-cancel-reason" style={inputStyle} value={cancelReason} placeholder="e.g. Student unable to attend / requested cancellation" onChange={(e) => setCancelReason(e.target.value)} />
            <p style={{ margin: '10px 0', padding: 10, borderRadius: 8, background: 'var(--danger-light)', fontSize: 12, color: 'var(--text-secondary)' }}>
              A cancellation email is sent to <strong>{booking.email || 'the student'}</strong>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode('none')} disabled={busy}>Keep booking</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={cancel} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {busy && <Loader2 size={14} className="animate-spin" />} Confirm cancellation
              </button>
            </div>
          </section>
        )}

        <section className="card" style={{ padding: 16 }}>
          <h3 style={{ ...sectionTitle, marginBottom: 4 }}><Sparkles size={16} /> Actions &amp; pipeline status</h3>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>Click an action to update the status immediately.</p>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
            {actionBtn('done', STATUS_CONFIG.COMPLETED.color, CheckCircle2, 'Mark done', 'Session conducted', booking.status === 'COMPLETED', busy || booking.status === 'COMPLETED', () => { void updateStatus('COMPLETED') })}
            {actionBtn('res', STATUS_CONFIG.RESCHEDULED.color, CalendarClock, 'Reschedule', 'Change slot', mode === 'reschedule', busy, () => setMode((m) => (m === 'reschedule' ? 'none' : 'reschedule')))}
            {actionBtn('later', STATUS_CONFIG.TRY_LATER.color, Clock, 'Try later', 'Postponed / follow-up', booking.status === 'TRY_LATER', busy || booking.status === 'TRY_LATER', () => { void updateStatus('TRY_LATER') })}
            {actionBtn('ghost', STATUS_CONFIG.GHOSTED.color, STATUS_CONFIG.GHOSTED.icon, 'Ghosted', 'No response / absent', booking.status === 'GHOSTED', busy || booking.status === 'GHOSTED', () => { void updateStatus('GHOSTED') })}
            {actionBtn('ni', STATUS_CONFIG.NOT_INTERESTED.color, STATUS_CONFIG.NOT_INTERESTED.icon, 'Not interested', 'Declined offer', booking.status === 'NOT_INTERESTED', busy || booking.status === 'NOT_INTERESTED', () => { void updateStatus('NOT_INTERESTED') })}
            {actionBtn('conf', STATUS_CONFIG.CONFIRMED.color, CheckCircle2, 'Confirmed', 'Active session', booking.status === 'CONFIRMED', busy || booking.status === 'CONFIRMED', () => { void updateStatus('CONFIRMED') })}
            {actionBtn('cancel', STATUS_CONFIG.CANCELLED.color, XCircle, 'Cancel booking', 'Notify student via email', mode === 'cancel' || booking.status === 'CANCELLED', busy, () => setMode((m) => (m === 'cancel' ? 'none' : 'cancel')), true)}
          </div>
        </section>
      </aside>
    </div>
  )
}
