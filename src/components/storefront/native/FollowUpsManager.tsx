'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, Download, Flame, IndianRupee, Info, Loader2, PhoneCall, RefreshCw, Search, X } from 'lucide-react'
import PageShell from '../PageShell'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import {
  buildLeads,
  computeStats,
  sortLeads,
  phoneDigits,
  COOL_OFF_MS,
  DAY,
  INTERESTED_FOLLOWUP_MS,
  LEAD_LIFETIME_DAYS,
  MAX_NO_ANSWER,
  MINUTE,
  OUTCOME_LABELS,
  type CallLog,
  type CallOutcome,
  type Lead,
  type OrderRow,
  type ProfileRow,
} from './FollowUpsLogic'
import { deleteFollowUpCall, insertFollowUpCall, loadFollowUps, makeCourseNamer, type FollowUpsCatalogRow } from './FollowUpsData'
import { FollowUpsRule, FollowUpsStatCard, fmtMoney } from './FollowUpsUi'
import FollowUpsLeadRow, { type FollowUpsView } from './FollowUpsLeadRow'
import FollowUpsLogCallModal from './FollowUpsLogCallModal'

const spin: React.CSSProperties = { animation: 'spin 1s linear infinite' }
const notice: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', borderRadius: 12, padding: '12px 14px', fontSize: 13 }

/** Native Follow-ups: people who started checkout but didn't pay, in the order customer service should call them. */
export default function FollowUpsManager({ userEmail }: { userEmail: string | null }) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableMissing, setTableMissing] = useState(false)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [calls, setCalls] = useState<CallLog[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [catalog, setCatalog] = useState<FollowUpsCatalogRow[]>([])
  const [now, setNow] = useState(Date.now())
  const [view, setView] = useState<FollowUpsView>('DUE')
  const [search, setSearch] = useState('')
  const [showNoPhone, setShowNoPhone] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [logFor, setLogFor] = useState<Lead | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Keep "due now / in 3h" labels moving without refetching.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), MINUTE)
    return () => window.clearInterval(t)
  }, [])

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const snap = await loadFollowUps()
      setOrders(snap.orders)
      setProfiles(snap.profiles)
      setCalls(snap.calls)
      setCatalog(snap.catalog)
      setTableMissing(snap.tableMissing)
      setNow(Date.now())
    } catch (err: any) {
      console.error('Follow-ups load failed:', err?.message || err)
      setError(err?.message || 'Could not load follow-ups')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(true)
  }, [load])

  const courseName = useMemo(() => makeCourseNamer(catalog), [catalog])
  const courseList = useCallback((ids: string[]) => Array.from(new Set(ids.map(courseName))), [courseName])

  const leads = useMemo(() => buildLeads({ orders, calls, profiles, now }), [orders, calls, profiles, now])
  const stats = useMemo(() => computeStats(leads), [leads])

  const counts = useMemo(
    () => ({
      DUE: leads.filter((l) => l.stage === 'DUE' && l.hasPhone).length,
      SCHEDULED: leads.filter((l) => l.stage === 'SCHEDULED' || l.stage === 'COOLING').length,
      RECOVERED: leads.filter((l) => l.stage === 'RECOVERED').length,
      DROPPED: leads.filter((l) => l.stage === 'DROPPED').length,
    }),
    [leads]
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = leads.filter((l) => {
      if (view === 'DUE') return l.stage === 'DUE' && (showNoPhone ? !l.hasPhone : l.hasPhone)
      if (view === 'SCHEDULED') return l.stage === 'SCHEDULED' || l.stage === 'COOLING'
      return l.stage === view
    })
    if (q) {
      const digits = q.replace(/\D/g, '')
      list = list.filter(
        (l) =>
          l.email.includes(q) ||
          (l.name || '').toLowerCase().includes(q) ||
          (!!digits && phoneDigits(l.phone).includes(digits)) ||
          l.attempts.some((a) => a.orderId.toLowerCase().includes(q))
      )
    }
    return sortLeads(list, view)
  }, [leads, view, search, showNoPhone])

  const saveCall = async (lead: Lead, outcome: CallOutcome, note: string, callbackAt: string | null) => {
    const saved = await insertFollowUpCall({
      lead_key: lead.key,
      user_email: lead.email,
      outcome,
      note: note.trim() || null,
      callback_at: callbackAt,
      called_by: userEmail || null,
    })
    setCalls((prev) => [...prev, saved])
    setNow(Date.now())
  }

  const deleteCall = async (id: string) => {
    const ok = await confirm({
      title: 'Remove call entry?',
      message: 'This removes the entry from the call history and recalculates when this person should be called next.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteFollowUpCall(id)
      setCalls((prev) => prev.filter((c) => c.id !== id))
    } catch (err: any) {
      setError(err?.message || 'Could not remove the entry')
    }
  }

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  const exportCsv = () => {
    const headers = ['Priority', 'Name', 'Phone', 'Email', 'Courses', 'Cart value', 'Checkout attempts', 'Last tried', 'Next call', 'Last outcome', 'Last note', 'Drops on', 'Why']
    const rows = visible.map((l) => [
      l.heat,
      l.name || '',
      l.phone || '',
      l.email,
      courseList(l.courseIds).join(' | '),
      l.cartValue,
      l.attempts.length,
      new Date(l.lastAttemptAt).toLocaleString('en-IN'),
      l.dueAt ? new Date(l.dueAt).toLocaleString('en-IN') : '',
      l.lastCall ? OUTCOME_LABELS[l.lastCall.outcome] : '',
      l.lastCall?.note || '',
      new Date(l.expiresAt).toLocaleDateString('en-IN'),
      l.reasons.join('; '),
    ])
    const csv = [headers, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `call_list_${view.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const closeLog = useCallback(() => setLogFor(null), [])

  const tabs: { id: FollowUpsView; label: string; count: number }[] = [
    { id: 'DUE', label: 'To call now', count: counts.DUE },
    { id: 'SCHEDULED', label: 'Scheduled', count: counts.SCHEDULED },
    { id: 'RECOVERED', label: 'Recovered', count: counts.RECOVERED },
    { id: 'DROPPED', label: 'Dropped', count: counts.DROPPED },
  ]

  const actions = (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => load()} disabled={loading || refreshing} title="Reload from database">
        <RefreshCw size={14} style={refreshing ? spin : undefined} /> Sync
      </button>
      <button className="btn btn-primary btn-sm" onClick={exportCsv} disabled={loading || visible.length === 0}>
        <Download size={14} /> Export list
      </button>
    </>
  )

  return (
    <PageShell title="Follow-ups" description="People who started checkout but didn’t pay — who to call, in order." actions={actions}>
      {confirmDialog}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 64, color: 'var(--text-muted)', fontSize: 14 }}>
          <Loader2 size={18} style={spin} /> Building call list…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tableMissing && (
            <div style={{ ...notice, background: 'var(--warning-light)', color: 'var(--text-primary)', border: '1px solid var(--warning)' }}>
              <AlertCircle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <b>One-time setup needed:</b> run <code>cart-followups-schema.sql</code> in the storefront Supabase SQL editor so call outcomes can be saved. The list below still works.
              </div>
            </div>
          )}
          {error && (
            <div style={{ ...notice, alignItems: 'center', background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{error}</span>
              <button onClick={() => setError(null)} aria-label="Dismiss" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}><X size={16} /></button>
            </div>
          )}

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12 }}>
            <FollowUpsStatCard tone="danger" label="Call now" icon={<PhoneCall size={15} />} value={stats.dueNow.toLocaleString('en-IN')}
              sub={stats.dueNoPhone ? `+${stats.dueNoPhone} without phone (email only)` : 'Ready for customer service'} />
            <FollowUpsStatCard tone="warning" label="Open leads" icon={<IndianRupee size={15} />} value={stats.open.toLocaleString('en-IN')}
              sub={`${fmtMoney(stats.openValue)} still on the table`} />
            <FollowUpsStatCard tone="success" label="Recovered · 30 days" icon={<CheckCircle2 size={15} />} value={fmtMoney(stats.recoveredValue)}
              sub={`${stats.recovered} paid later · ${stats.recoveredAfterCall} after our call`} />
            <FollowUpsStatCard tone="info" label="Call conversion" icon={<Flame size={15} />} value={`${stats.callConversion}%`}
              sub={`${stats.recoveredAfterCall} of ${stats.calledLeads} called leads bought`} />
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <div className="card" style={{ flex: '1 1 280px', display: 'flex', alignItems: 'center', gap: 10, padding: '4px 14px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone, or order ID…"
                aria-label="Search leads"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, padding: '8px 0' }}
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><X size={14} /></button>
              )}
            </div>
            <div role="tablist" aria-label="Lead stage" className="card" style={{ display: 'flex', gap: 4, padding: 4, overflowX: 'auto', maxWidth: '100%' }}>
              {tabs.map((t) => {
                const on = view === t.id
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={on}
                    onClick={() => { setView(t.id); setShowNoPhone(false); setExpanded(null) }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
                      background: on ? 'var(--primary)' : 'transparent', color: on ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {t.label}
                    <span style={{ padding: '0 6px', borderRadius: 6, fontSize: 10.5, fontVariantNumeric: 'tabular-nums', background: on ? 'rgba(255,255,255,0.22)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--text-secondary)' }}>{t.count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sub-filter + rules */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 12 }}>
            {view === 'DUE' && stats.dueNoPhone > 0 && (
              <button
                onClick={() => setShowNoPhone((v) => !v)}
                className={showNoPhone ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              >
                {showNoPhone ? '← Back to callable leads' : `${stats.dueNoPhone} leads have no phone — email them`}
              </button>
            )}
            <button
              onClick={() => setShowRules((v) => !v)}
              aria-expanded={showRules}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12 }}
            >
              <Info size={14} /> How this list works
              <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: showRules ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>

          {showRules && (
            <div className="card" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', columnGap: 28, rowGap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              <FollowUpsRule title="Who gets added">Anyone who started checkout but didn&apos;t pay. Retries close together count as one person. Checkouts for courses they already own are ignored.</FollowUpsRule>
              <FollowUpsRule title="When they show up">{Math.round(COOL_OFF_MS / MINUTE)} minutes after their last checkout, in case they&apos;re still paying.</FollowUpsRule>
              <FollowUpsRule title="Who's first">Hot leads first: tried recently, tried several times, bigger cart, asked for a callback or said they&apos;d buy.</FollowUpsRule>
              <FollowUpsRule title="If they pay later">They move to <b>Recovered</b> automatically. If we called them before they paid, it counts as recovered after our call.</FollowUpsRule>
              <FollowUpsRule title="No answer">Retry after 4 hours, then 1 day, then 2 days. Dropped after {MAX_NO_ANSWER} unanswered calls in a row.</FollowUpsRule>
              <FollowUpsRule title="Said they'd buy">Check back after {Math.round(INTERESTED_FOLLOWUP_MS / DAY)} days if they still haven&apos;t paid.</FollowUpsRule>
              <FollowUpsRule title="When they're dropped">{LEAD_LIFETIME_DAYS} days after their last checkout attempt, or when they say they&apos;re not interested, the number is wrong or they already bought.</FollowUpsRule>
              <FollowUpsRule title="If they try again">Within {LEAD_LIFETIME_DAYS} days, the same lead reopens with its call history. After that, they come back as a new lead with a clean slate.</FollowUpsRule>
            </div>
          )}

          {/* List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {visible.length === 0 ? (
              <div style={{ padding: '56px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                {search.trim() ? 'No leads match your search' : view === 'DUE' ? 'Nobody to call right now 🎉' : 'Nothing here yet'}
              </div>
            ) : (
              visible.map((lead) => (
                <FollowUpsLeadRow
                  key={lead.key}
                  lead={lead}
                  view={view}
                  now={now}
                  open={expanded === lead.key}
                  copied={copied === lead.key}
                  canLog={!tableMissing}
                  courseList={courseList}
                  onToggle={() => setExpanded(expanded === lead.key ? null : lead.key)}
                  onCopy={() => copy(phoneDigits(lead.phone), lead.key)}
                  onLog={() => setLogFor(lead)}
                  onDeleteCall={deleteCall}
                />
              ))
            )}
          </div>
          {visible.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
              {visible.length.toLocaleString('en-IN')} {visible.length === 1 ? 'lead' : 'leads'}
            </div>
          )}
        </div>
      )}

      <FollowUpsLogCallModal
        lead={logFor}
        courseNames={logFor ? courseList(logFor.courseIds).join(', ') : ''}
        onClose={closeLog}
        onSave={async (outcome, note, cb) => {
          if (!logFor) return
          await saveCall(logFor, outcome, note, cb)
          setLogFor(null)
        }}
      />
    </PageShell>
  )
}
