'use client'

// Native class-genz 1:1 bookings manager (replaces the storefront-panel iframe "1on1" tab).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Clock, Eye, Mail, MessageCircle, RefreshCw, Search, Shield, User } from 'lucide-react'
import PageShell, { LoadNotice } from '@/components/storefront/PageShell'
import OneOnOneDetail, { StatusPill } from './OneOnOneDetail'
import {
  STATUS_CONFIG, STATUS_ORDER, fetchBookings, fmtBookedShort, mailLink, matchesBookingSearch, splitSubjects, studentNote, tint, waLink,
  type Booking,
} from './OneOnOneTypes'

const th: React.CSSProperties = { padding: '10px 16px', fontWeight: 600, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'top' }
const linkBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }

export default function OneOnOneManager() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [viewId, setViewId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetchBookings()
    if (r.error) setError(r.error)
    else {
      setError('')
      setBookings(r.bookings)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: bookings.length }
    for (const s of STATUS_ORDER) c[s] = 0
    for (const b of bookings) if (b.status in c) c[b.status] += 1
    return c
  }, [bookings])

  const filtered = useMemo(
    () => bookings.filter((b) => (statusFilter === 'ALL' || b.status === statusFilter) && matchesBookingSearch(b, search)),
    [bookings, statusFilter, search],
  )

  const viewBooking = viewId ? bookings.find((b) => b.id === viewId) || null : null
  const patch = useCallback((id: string, p: Partial<Booking>) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...p, updated_at: new Date().toISOString() } : b)))
  }, [])

  if (viewBooking) {
    return (
      <PageShell
        title={viewBooking.name || 'Booking'}
        description={`1:1 booking · ${viewBooking.slot_date} · ${viewBooking.slot_time}`}
        actions={<button type="button" className="btn btn-secondary" onClick={() => setViewId(null)}>← Back to bookings</button>}
      >
        <OneOnOneDetail key={viewBooking.id} booking={viewBooking} allBookings={bookings} onOpen={(b) => setViewId(b.id)} onPatch={patch} />
      </PageShell>
    )
  }

  const statCard = (id: string, label: string, color: string) => {
    const active = statusFilter === id
    return (
      <button
        key={id}
        type="button"
        onClick={() => setStatusFilter(id)}
        aria-pressed={active}
        style={{
          textAlign: 'left', padding: 12, borderRadius: 12, cursor: 'pointer',
          border: `1px solid ${active ? color : tint(color, 25)}`, background: active ? tint(color, 14) : tint(color, 6),
          boxShadow: active ? `0 0 0 2px ${tint(color, 35)}` : 'none',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{counts[id] ?? 0}</div>
      </button>
    )
  }

  return (
    <PageShell
      title="1:1 Bookings"
      description="Personal consultation bookings from the website: follow up, reschedule, cancel and track outcomes."
      backHref="/manage"
      backLabel="Manage"
      actions={
        <button type="button" className="btn btn-primary" onClick={() => { void load() }} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /> Refresh
        </button>
      }
    >
      {error && <div style={{ marginBottom: 12 }}><LoadNotice error={error} /></div>}

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', marginBottom: 16 }}>
        {statCard('ALL', 'Total', 'var(--text-secondary)')}
        {STATUS_ORDER.map((s) => statCard(s, STATUS_CONFIG[s].short, STATUS_CONFIG[s].color))}
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="search"
            aria-label="Search bookings"
            placeholder="Search student, email, phone, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: '1 1 auto', paddingBottom: 2 }}>
          {[{ id: 'ALL', label: 'All' }, ...STATUS_ORDER.map((s) => ({ id: s, label: STATUS_CONFIG[s].label }))].map((t) => (
            <button key={t.id} type="button" className={statusFilter === t.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setStatusFilter(t.id)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t.label}
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: statusFilter === t.id ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)' }}>{counts[t.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 900, fontSize: 14, borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
              {['Student', 'Contact', 'Subject(s) & level', 'Date & 15-min slot', 'Status', ''].map((h) => <th key={h || 'action'} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && bookings.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading 1:1 bookings…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No 1:1 bookings match your filter.</td></tr>}
            {filtered.map((b) => {
              const subs = splitSubjects(b.subjects)
              return (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Booked {fmtBookedShort(b.created_at)}</div>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {b.phone
                        ? <a className="btn btn-success btn-sm" href={waLink(b.phone, b.name)} target="_blank" rel="noreferrer" title="Chat on WhatsApp" style={linkBtn}><MessageCircle size={13} /> WhatsApp</a>
                        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No phone</span>}
                      {b.email && <a className="btn btn-secondary btn-sm" href={mailLink(b.email)} title="Send email" style={linkBtn}><Mail size={13} /> Mail</a>}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{subs[0] || 'General'}</span>
                      {subs.length > 1 && <span className="badge badge-gray" title={subs.join(', ')}>+{subs.length - 1} more</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{b.level}</div>
                    {(studentNote(b) || b.manager_notes) && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {studentNote(b) && <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={11} /> Student note</span>}
                        {b.manager_notes && <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Shield size={11} /> Manager note</span>}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}><Calendar size={14} color="var(--text-muted)" />{b.slot_date}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}><Clock size={14} color="var(--text-muted)" />{b.slot_time}</div>
                  </td>
                  <td style={td}><StatusPill status={b.status} /></td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setViewId(b.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Eye size={14} /> View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!loading && !error && <p style={{ margin: '10px 2px 0', fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} of {bookings.length} booking{bookings.length === 1 ? '' : 's'}</p>}
    </PageShell>
  )
}
