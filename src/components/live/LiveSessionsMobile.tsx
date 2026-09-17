'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatIST, getEventStatus } from '@/lib/date-utils'
import { normalizeMeetLink } from '@/lib/meet-link'
import { useRouter } from 'next/navigation'

interface CourseEvent {
  id: string
  title: string
  description: string
  startTime: string
  endTime: string
  meetLink: string | null
  type: string
  status: string
  manualStatus: string
  courseId: string | null
  course: { id: string; name: string; color: string; teacherName?: string | null; liveUpgradePrice?: number | null } | null
  instructor: { id: string; name: string } | null
  isRecordedOnly?: boolean
}

interface Props {
  sessions: CourseEvent[]
  onUpgradeClick?: (courseId: string, courseName: string, price: number) => void
  isManager?: boolean
  onSync?: () => Promise<void> | void
  syncing?: boolean
}

const TIME_SLOT_COLORS: { bg: string; fg: string }[] = [
  { bg: 'var(--primary-light)', fg: 'var(--accent)' }, // lavender
  { bg: 'var(--success-light)', fg: 'var(--success)' }, // green
  { bg: 'var(--warning-light)', fg: 'var(--warning)' }, // amber
  { bg: 'var(--danger-light)', fg: 'var(--danger)' }, // red
  { bg: 'var(--info-light)', fg: 'var(--info)' }, // blue
]

export default function LiveSessionsMobile({ sessions, onUpgradeClick, isManager, onSync, syncing }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // Re-render every 30s so "started 18m ago" stays accurate
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 30000)
    return () => window.clearInterval(id)
  }, [])

  const withStatus = useMemo(() => sessions.map(s => ({
    ...s,
    derivedStatus: getEventStatus(s.startTime, s.endTime, s.manualStatus || s.status),
  })), [sessions])

  const buckets = useMemo(() => {
    const live = withStatus.filter(s => s.derivedStatus === 'live')
    const upcoming = withStatus.filter(s => s.derivedStatus === 'upcoming' || s.derivedStatus === 'rescheduled')
    const recorded = withStatus.filter(s => s.derivedStatus === 'completed')
    return { live, upcoming, recorded }
  }, [withStatus])

  const q = search.trim().toLowerCase()
  const filterByQuery = (s: CourseEvent) =>
    !q || s.title.toLowerCase().includes(q) || (s.course?.name || '').toLowerCase().includes(q) || (s.course?.teacherName || s.instructor?.name || '').toLowerCase().includes(q)

  const visibleLive = buckets.live.filter(filterByQuery)
  const visibleUpcoming = buckets.upcoming.filter(filterByQuery)
  const visibleRecorded = buckets.recorded.filter(filterByQuery)

  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

  const hasAnySessions = sessions.length > 0
  const hasSearchResults = visibleLive.length > 0 || visibleUpcoming.length > 0 || visibleRecorded.length > 0

  return (
    <div className="live-sessions-mobile" style={{
      background: 'transparent',
      padding: '16px 16px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      {/* Page Title Row (aligned with other premium sub-pages like Free Resources) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        justifyContent: 'flex-start',
        paddingBottom: '4px',
      }}>
        <button
          onClick={() => router.back()}
          aria-label="Go Back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--surface)',
            border: '1px solid rgba(15, 23, 42, 0.06)',
            cursor: 'pointer',
            boxShadow: '0 8px 20px -6px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.04)',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 14px -4px rgba(15, 23, 42, 0.15)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 20px -6px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.04)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 900,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            fontFamily: "'Outfit', 'Nunito', sans-serif"
          }}>
            Live Sessions
          </h1>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            margin: '3px 0 0',
            fontFamily: "'Outfit', sans-serif"
          }}>
            Join classes &amp; rewatch recordings
          </p>
        </div>

        {isManager && onSync && (
          <button
            onClick={() => onSync()}
            disabled={syncing}
            aria-label="Sync Live Sessions"
            title="Sync Live Sessions from Calendar"
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'var(--surface)',
              boxShadow: '0 8px 20px -6px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.04)',
              border: '1px solid rgba(15, 23, 42, 0.06)',
              cursor: syncing ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: 'var(--primary)',
              opacity: syncing ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M21.5 2v6h-6M2 22v-6h6M21.34 15.57a10 10 0 1 1-.92-10.45l3.08 2.88L2 22l-3.08-2.88a10 10 0 1 1 .92 10.45"/>
            </svg>
          </button>
        )}

        <button
          onClick={() => setShowSearch(s => !s)}
          aria-label="Search"
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: showSearch ? 'var(--primary)' : 'var(--surface)',
            boxShadow: showSearch
              ? '0 6px 14px rgba(54,54,232,0.30)'
              : '0 8px 20px -6px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.04)',
            border: showSearch ? 'none' : '1px solid rgba(15, 23, 42, 0.06)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'all 0.2s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={showSearch ? '#ffffff' : 'var(--text-secondary)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      {showSearch && (
        <div style={{ padding: '0 4px 4px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sessions, courses, instructors..."
            autoFocus
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: '16px',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              fontSize: '14px',
              fontFamily: 'inherit',
              outline: 'none',
              color: 'var(--text-primary)',
              background: 'var(--surface)',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
              transition: 'all 0.2s',
            }}
          />
        </div>
      )}

      {/* Unified Vertical Section List (Exactly like the website version) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* 1. Live now */}
        {visibleLive.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visibleLive.map(s => <LiveSessionCard key={s.id} session={s} onUpgradeClick={onUpgradeClick} />)}
          </div>
        )}

        {/* 2. Coming up today */}
        {visibleUpcoming.length > 0 && (
          <div>
            <SectionHeader title="Coming up today" subtitle={`${visibleUpcoming.length} session${visibleUpcoming.length === 1 ? '' : 's'} scheduled`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[...visibleUpcoming]
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .map((s, idx) => <UpcomingSessionRow key={s.id} session={s} slotIdx={idx} />)
              }
            </div>
          </div>
        )}

        {/* 3. Recorded Sessions */}
        {visibleRecorded.length > 0 && (
          <div>
            <SectionHeader title="Past sessions" subtitle={`${visibleRecorded.length} recording${visibleRecorded.length === 1 ? '' : 's'}`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visibleRecorded.map(s => <RecordedSessionRow key={s.id} session={s} />)}
            </div>
          </div>
        )}

        {/* Empty States */}
        {!hasAnySessions && (
          <EmptyState icon="live" title="No live sessions" subtitle="When a class starts, it will appear here." />
        )}

        {hasAnySessions && !hasSearchResults && (
          <div style={{
            padding: '48px 24px', textAlign: 'center',
            background: 'var(--surface)', borderRadius: '24px',
            border: '1px solid rgba(15, 23, 42, 0.05)',
            boxShadow: '0 10px 24px -14px rgba(15, 23, 42, 0.10)',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>No matches found</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Try searching for another topic or course.</div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ────────────────────── LIVE TAB ────────────────────── */
function LiveTab({ sessions, todayStr }: { sessions: (CourseEvent & { derivedStatus: string })[]; todayStr: string }) {
  if (sessions.length === 0) {
    return <EmptyState icon="live" title="No live sessions" subtitle="When a class starts, it will appear here." />
  }
  return (
    <>
      <SectionHeader title="Live now" subtitle={`${sessions.length} session${sessions.length === 1 ? '' : 's'} happening`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {sessions.map(s => <LiveSessionCard key={s.id} session={s} />)}
      </div>
      <div style={{ marginTop: '24px' }} />
    </>
  )
}

function LiveSessionCard({ session, onUpgradeClick }: { session: CourseEvent; onUpgradeClick?: (courseId: string, courseName: string, price: number) => void }) {
  const startedMin = Math.max(0, Math.floor((Date.now() - new Date(session.startTime).getTime()) / 60000))
  const startedLabel = startedMin === 0 ? 'just started' : `started ${formatRelativeMinutes(startedMin)} ago`
  const instructorName = session.course?.teacherName || session.instructor?.name || 'Faculty'
  const initial = instructorName.charAt(0).toUpperCase()
  const subject = session.course?.name || 'Live Class'

  return (
    <div style={{
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      borderRadius: '24px',
      padding: '18px 18px 16px',
      color: '#ffffff',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 14px 30px -10px rgba(220, 38, 38, 0.45), 0 4px 10px -2px rgba(220, 38, 38, 0.20)',
    }}>
      <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '50px',
            background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)',
            fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.08em',
            border: '1px solid rgba(255,255,255,0.30)',
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%', background: 'var(--surface)',
              boxShadow: '0 0 6px var(--neu-light)',
              animation: 'liveDotPulse 1.5s ease-in-out infinite',
            }} />
            LIVE
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.90)' }}>
            {startedLabel}
          </span>
        </div>
      </div>

      <div style={{ fontSize: '18px', fontWeight: 900, lineHeight: 1.25, marginBottom: '12px', letterSpacing: '-0.01em', position: 'relative' }}>
        {session.title}
      </div>



      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {normalizeMeetLink(session.meetLink) ? (
          <a
            href={normalizeMeetLink(session.meetLink)!}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '13px 16px', borderRadius: '50px',
              background: 'var(--surface)', color: 'var(--danger)',
              fontSize: '14px', fontWeight: 800, textDecoration: 'none',
              boxShadow: '0 6px 14px rgba(0,0,0,0.10)',
            }}
          >
            Join class
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        ) : session.isRecordedOnly ? (
          <button
            onClick={() => {
              if (onUpgradeClick && session.courseId && session.course?.liveUpgradePrice) {
                onUpgradeClick(session.courseId, session.course.name, session.course.liveUpgradePrice)
              }
            }}
            style={{
              flex: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '13px 16px', borderRadius: '50px',
              background: 'var(--surface)', color: 'var(--danger)',
              fontSize: '14px', fontWeight: 800, border: 'none', cursor: 'pointer',
              boxShadow: '0 6px 14px rgba(0,0,0,0.10)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 18px rgba(0,0,0,0.15)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 14px rgba(0,0,0,0.10)'
            }}
          >
            Unlock to Join
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </button>
        ) : (
          <span style={{
            flex: 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '13px 16px', borderRadius: '50px',
            background: 'rgba(255,255,255,0.20)', color: '#ffffff',
            fontSize: '13px', fontWeight: 700,
            border: '1px solid rgba(255,255,255,0.30)',
          }}>
            Meet link coming soon
          </span>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes liveDotPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.4); } }
      `}} />
    </div>
  )
}

/* ──────────────────── UPCOMING TAB ───────────────────── */
function UpcomingTab({ sessions }: { sessions: (CourseEvent & { derivedStatus: string })[] }) {
  if (sessions.length === 0) {
    return <EmptyState icon="upcoming" title="Nothing coming up" subtitle="Upcoming classes will be listed here." />
  }
  // Sort by start time ascending
  const sorted = [...sessions].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  return (
    <>
      <SectionHeader title="Coming up today" subtitle={`${sorted.length} session${sorted.length === 1 ? '' : 's'} scheduled`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sorted.map((s, idx) => <UpcomingSessionRow key={s.id} session={s} slotIdx={idx} />)}
      </div>
    </>
  )
}

function UpcomingSessionRow({ session, slotIdx }: { session: CourseEvent; slotIdx: number }) {
  const slot = TIME_SLOT_COLORS[slotIdx % TIME_SLOT_COLORS.length]
  const instructor = session.course?.teacherName || session.instructor?.name || 'Faculty'
  const subject = session.course?.name || 'Class'
  const start = formatIST(session.startTime, { hour: 'numeric', minute: '2-digit', hour12: true })
  const isToday = new Date(session.startTime).toDateString() === new Date().toDateString()

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '14px 16px 14px 12px',
      borderRadius: '20px',
      background: 'var(--surface)',
      boxShadow: '0 10px 24px -14px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.04)',
      border: '1px solid rgba(15, 23, 42, 0.05)',
      borderLeft: '4.5px solid ' + slot.fg,
    }}>
      <div style={{
        width: '68px', minHeight: '52px',
        borderRadius: '12px',
        background: slot.bg,
        color: slot.fg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '2px', flexShrink: 0,
      }}>
        <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '-0.02em' }}>{start}</div>
        {!isToday && (
          <div style={{ fontSize: '8.5px', fontWeight: 800, letterSpacing: '0.04em', opacity: 0.85 }}>
            {new Date(session.startTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingLeft: '2px' }}>
        <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
          {session.title}
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subject} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· {instructor}</span>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────── RECORDED TAB ───────────────────── */
function RecordedTab({ sessions }: { sessions: (CourseEvent & { derivedStatus: string })[] }) {
  if (sessions.length === 0) {
    return <EmptyState icon="recorded" title="No recordings yet" subtitle="Past classes will show up here once they end." />
  }
  return (
    <>
      <SectionHeader title="Past sessions" subtitle={`${sessions.length} recording${sessions.length === 1 ? '' : 's'}`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sessions.map(s => <RecordedSessionRow key={s.id} session={s} />)}
      </div>
    </>
  )
}

function RecordedSessionRow({ session }: { session: CourseEvent }) {
  const instructor = session.course?.teacherName || session.instructor?.name || 'Faculty'
  const subject = session.course?.name || 'Class'
  const date = new Date(session.startTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '14px 16px 14px 12px',
      borderRadius: '20px',
      background: 'var(--surface)',
      boxShadow: '0 10px 24px -14px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.04)',
      border: '1px solid rgba(15, 23, 42, 0.05)',
      borderLeft: '4.5px solid var(--accent)',
    }}>
      <div style={{
        width: '44px', height: '44px',
        borderRadius: '12px',
        background: 'var(--primary-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)', flexShrink: 0,
        boxShadow: '0 4px 10px rgba(99,102,241,0.15)',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingLeft: '2px' }}>
        <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
          {session.title}
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '4px' }}>
          {subject} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· {instructor} · {date}</span>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────── SHARED ───────────────────── */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: '14px', padding: '0 4px' }}>
      <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: 'live' | 'upcoming' | 'recorded'; title: string; subtitle: string }) {
  return (
    <div style={{
      padding: '48px 24px', textAlign: 'center',
      background: 'var(--surface)', borderRadius: '24px',
      border: '1px solid rgba(15, 23, 42, 0.05)',
      boxShadow: '0 10px 24px -14px rgba(15, 23, 42, 0.10)',
    }}>
      <div style={{
        width: '52px', height: '52px', margin: '0 auto 12px',
        borderRadius: '16px',
        background: icon === 'live' ? 'var(--danger-light)' : icon === 'upcoming' ? 'var(--primary-light)' : 'var(--primary-light)',
        color: icon === 'live' ? 'var(--danger)' : icon === 'upcoming' ? 'var(--accent)' : 'var(--primary-dark)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon === 'live' ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="9" strokeOpacity="0.4" />
          </svg>
        ) : icon === 'upcoming' ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        )}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{subtitle}</div>
    </div>
  )
}

function formatRelativeMinutes(min: number) {
  if (min < 60) return `${min}m`
  const hours = Math.floor(min / 60)
  const remaining = min % 60
  return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`
}
