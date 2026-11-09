'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { DEFAULT_MEMBERS_PER_GROUP } from '@/lib/notification-group-pool'

type PoolEmail = {
  id: string
  groupEmail: string
  maxCapacity: number
  currentCount: number
  isActive: boolean
  percentage?: number
  isFull?: boolean
}

type PoolCategory = {
  id: string
  name: string
  description?: string | null
  isDefault?: boolean
  emails: PoolEmail[]
  totalCapacity?: number
  totalAssigned?: number
}

type LiveLogLine = { t: number; text: string }

type LiveProgress = {
  open: boolean
  title: string
  phase: string
  detail: string
  percent: number
  processed: number
  total: number
  addJobsQueued: number
  lines: LiveLogLine[]
  done: boolean
  error?: string
}

type AssignResult = {
  message?: string
  totalUsers?: number
  assignedCount?: number
  addJobsQueued?: number
  unchangedCount?: number
  alreadyHadAssignment?: number
  membersPerGroup?: number
  poolsUsed?: number
  clearedUsers?: number
  removeJobsQueued?: number
  distribution?: Array<{
    groupEmail: string
    groupNumber?: number
    serialFrom: number | null
    serialTo: number | null
    memberCount: number
    maxCapacity: number
  }>
  serialPreview?: Array<{ serial: number; email: string; groupEmail: string }>
  recent?: Array<{ serial: number; email: string; groupEmail: string; action: string }>
}

const fetcher = (url: string) => fetch(url).then(r => r.json())
const MEMBERS_PER_GROUP = DEFAULT_MEMBERS_PER_GROUP

const fieldStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid var(--border, rgba(255,255,255,0.1))',
  background: 'var(--bg-secondary, rgba(0,0,0,0.25))',
  color: 'var(--text-primary)',
  fontSize: 14,
}

/** Full-page Mail Assigner (notification Google Groups only — not course mails). */
export default function MailAssignerPageContent() {
  const { data, error, isLoading, mutate } = useSWR('/api/admin/notification-groups', fetcher)

  const categories: PoolCategory[] = data?.categories || []
  const totalUsersCount: number = data?.totalUsersCount ?? 0
  const totalAssignedUsersCount: number = data?.totalAssignedUsersCount ?? 0
  const defaultCategory = categories.find(c => c.isDefault) || categories[0] || null

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [newGroupEmail, setNewGroupEmail] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [live, setLive] = useState<LiveProgress | null>(null)

  const categoryId = selectedCategoryId || defaultCategory?.id || ''
  const activeCategory = categories.find(c => c.id === categoryId) || defaultCategory

  const allPoolEmails = activeCategory?.emails || []
  const activePoolEmails = allPoolEmails.filter(e => e.isActive)
  const activePoolCount = activePoolEmails.length
  const poolsNeeded = Math.max(
    1,
    Math.ceil(Math.max(totalUsersCount, 1) / MEMBERS_PER_GROUP)
  )
  const poolsShortBy = Math.max(0, poolsNeeded - activePoolCount)
  const canRunAssigner = !!categoryId && activePoolCount >= poolsNeeded && totalUsersCount > 0
  const waitingUsers: number = Math.max(
    0,
    data?.totalUnassignedUsersCount ?? totalUsersCount - totalAssignedUsersCount
  )
  const assignedPct = totalUsersCount > 0 ? Math.round((totalAssignedUsersCount / totalUsersCount) * 100) : 0
  const freeSlots = activePoolEmails.reduce((n, e) => n + Math.max(0, e.maxCapacity - e.currentCount), 0)
  const hasRoom = freeSlots >= waitingUsers

  const postJson = async (action: string, body: Record<string, unknown> = {}) => {
    const res = await fetch('/api/admin/notification-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error || 'Request failed')
    }
    return json
  }

  const pushLiveLine = (text: string) => {
    setLive(prev => {
      if (!prev) return prev
      const lines = [...prev.lines, { t: Date.now(), text }].slice(-40)
      return { ...prev, lines, detail: text }
    })
  }

  const postAction = async (action: string, body: Record<string, unknown> = {}) => {
    setBusyAction(action)
    setStatus(null)
    try {
      const json = await postJson(action, body)
      setStatus({ type: 'success', text: json.message || 'Done' })
      await mutate()
      return json
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Request failed'
      setStatus({ type: 'error', text })
      return null
    } finally {
      setBusyAction(null)
    }
  }

  const handleAddPoolEmail = async () => {
    if (!categoryId || !newGroupEmail.trim()) {
      setStatus({ type: 'error', text: 'Pick a pool and enter a Google Group email.' })
      return
    }
    const result = await postAction('ADD_EMAIL_TO_CATEGORY', {
      categoryId,
      groupEmail: newGroupEmail.trim(),
      maxCapacity: MEMBERS_PER_GROUP,
    })
    if (result) setNewGroupEmail('')
  }

  const handleToggleActive = async (email: PoolEmail) => {
    await postAction('TOGGLE_EMAIL_STATUS', {
      emailId: email.id,
      isActive: !email.isActive,
    })
  }

  const handleRemoveAll = async () => {
    if (!categoryId) {
      setStatus({ type: 'error', text: 'No pool category available.' })
      return
    }
    const ok = window.confirm(
      `Step 1 — Remove ALL members from notification pool groups?\n\n` +
        `• Clears group mail assignments in the database\n` +
        `• Queues REMOVE jobs for Google Sync (one-by-one)\n` +
        `• Course Google Groups are NOT touched\n\n` +
        `After jobs finish, run Step 2 to add everyone back by serial.`
    )
    if (!ok) return
    await postAction('REMOVE_ALL_POOL_MEMBERS', { categoryId })
  }

  const handleRunAssigner = async () => {
    if (!categoryId) {
      setStatus({ type: 'error', text: 'No pool category available.' })
      return
    }
    if (!canRunAssigner) {
      setStatus({
        type: 'error',
        text:
          poolsShortBy > 0
            ? `Waiting — need ${poolsShortBy} more active group mail(s) (${activePoolCount}/${poolsNeeded}).`
            : 'Cannot run yet — add or activate pool emails first.',
      })
      return
    }
    const ok = window.confirm(
      `Step 2 — Pack users into groups by serial?\n\n` +
        `• Runs in live batches (you’ll see progress)\n` +
        `• Group 1 = serials 1–${MEMBERS_PER_GROUP}\n` +
        `• Group 2 = serials ${MEMBERS_PER_GROUP + 1}–${MEMBERS_PER_GROUP * 2}\n` +
        `• Queues ADD jobs for Google Sync\n\n` +
        `Tip: run Step 1 (Remove all) first if groups still have old members.\n` +
        `Course Google Groups are NOT touched.`
    )
    if (!ok) return

    setBusyAction('SERIAL_RESET_ASSIGN')
    setStatus(null)
    setLive({
      open: true,
      title: 'Mail Assigner — live progress',
      phase: 'Preparing',
      detail: 'Starting…',
      percent: 0,
      processed: 0,
      total: totalUsersCount,
      addJobsQueued: 0,
      lines: [{ t: Date.now(), text: 'Started Step 2' }],
      done: false,
    })

    let totalAdd = 0
    try {
      // Phase 1: ensure serials in chunks
      setLive(prev => prev && { ...prev, phase: 'Assigning missing serials' })
      pushLiveLine('Phase 1: backfill unique serials…')
      let serialGuard = 0
      while (serialGuard < 200) {
        const ens = await postJson('ENSURE_SERIALS', { limit: 150 })
        const withSerial = ens.withSerial ?? 0
        const remaining = ens.remaining ?? 0
        const total = ens.totalUsers ?? totalUsersCount
        setLive(prev =>
          prev
            ? {
                ...prev,
                phase: 'Assigning missing serials',
                processed: withSerial,
                total,
                percent: total > 0 ? Math.round((withSerial / total) * 100) : 0,
                detail: ens.message || `Serials ${withSerial}/${total}`,
                lines: [
                  ...prev.lines,
                  {
                    t: Date.now(),
                    text: ens.message || `Serials batch +${ens.backfilled}, remaining ${remaining}`,
                  },
                ].slice(-40),
              }
            : prev
        )
        if (ens.done) break
        serialGuard++
      }

      // Phase 2: pack by serial in chunks
      setLive(prev => prev && { ...prev, phase: 'Packing users into pool groups' })
      pushLiveLine('Phase 2: packing by serial into Google Group pools…')
      let offset = 0
      let guard = 0
      while (guard < 500) {
        const json = await postJson('SERIAL_RESET_ASSIGN', {
          categoryId,
          offset,
          limit: 75,
        })
        totalAdd += json.addJobsQueued || 0
        offset = json.nextOffset ?? offset + (json.processed || 0)
        const recentLines = (json.recent || []).map(
          (r: { serial: number; email: string; groupEmail: string; action: string }) =>
            `#${r.serial} ${r.email} → ${r.groupEmail} (${r.action})`
        )
        setLive(prev =>
          prev
            ? {
                ...prev,
                phase: 'Packing users into pool groups',
                processed: offset,
                total: json.totalUsers ?? prev.total,
                percent: json.percent ?? 0,
                addJobsQueued: totalAdd,
                detail: json.message || `Packed ${offset}/${json.totalUsers}`,
                lines: [
                  ...prev.lines,
                  { t: Date.now(), text: json.message || `Batch @ offset ${json.offset}` },
                  ...recentLines.map((text: string) => ({ t: Date.now(), text })),
                ].slice(-40),
              }
            : prev
        )
        if (json.done) break
        guard++
      }

      setStatus({
        type: 'success',
        text: `Finished packing. Queued ${totalAdd} ADD jobs — open Google Sync to process.`,
      })
      setLive(prev =>
        prev
          ? {
              ...prev,
              done: true,
              phase: 'Complete',
              percent: 100,
              detail: `Done. ${totalAdd} ADD jobs queued for Google Sync.`,
              lines: [...prev.lines, { t: Date.now(), text: 'Complete.' }].slice(-40),
            }
          : prev
      )
      await mutate()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Request failed'
      setStatus({ type: 'error', text })
      setLive(prev =>
        prev
          ? {
              ...prev,
              error: text,
              detail: text,
              lines: [...prev.lines, { t: Date.now(), text: `ERROR: ${text}` }].slice(-40),
            }
          : prev
      )
    } finally {
      setBusyAction(null)
    }
  }

  const handleReconcile = async () => {
    const ok = window.confirm(
      'Reconcile Google with DB?\n\nCompares live Google members to notificationGroupEmails in the database. Removes extras / queues missing ADDs. Course groups are not included.'
    )
    if (!ok) return
    await postAction('RECONCILE_GOOGLE')
  }

  /** Add only the users who have no group mail yet. Nobody already assigned is touched. */
  const handleAssignNew = async () => {
    if (!categoryId || waitingUsers === 0) return
    const json = await postAction('ASSIGN_ALL_CATEGORY', { categoryId })
    if (json) {
      setStatus({
        type: 'success',
        text: `${json.count ?? 0} users added. Google membership updates in the background.`,
      })
    }
  }

  const pill: CSSProperties = { padding: '7px 14px', borderRadius: 999, fontWeight: 700, fontSize: 13 }

  return (
    <div className="ma-wrap">
      <style>{`
        .ma-wrap{max-width:960px;margin:0 auto;padding:20px 16px 60px}
        .ma-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px}
        .ma-top-actions{display:flex;gap:8px;flex-shrink:0}
        .ma-hero{padding:22px;border-radius:20px;margin-bottom:16px;display:grid;gap:16px}
        .ma-hero-row{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
        .ma-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
        .ma-pools{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:14px}
        .ma-add{display:flex;gap:8px}
        .ma-add input{flex:1;min-width:0}
        @media (max-width:640px){
          .ma-wrap{padding:14px 12px 48px}
          .ma-hero{padding:16px}
          .ma-hero-row{flex-direction:column;align-items:stretch}
          .ma-hero-row .btn{width:100%;justify-content:center}
          .ma-stats{gap:8px}
          .ma-pools{grid-template-columns:1fr}
          .ma-add{flex-direction:column}
          .ma-add .btn{width:100%}
        }
      `}</style>

      <div className="ma-top">
        <div style={{ minWidth: 0 }}>
          <Link
            href="/manage"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}
          >
            ← Back
          </Link>
          <h1
            style={{
              margin: '8px 0 4px',
              fontSize: 'clamp(22px, 5vw, 28px)',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Mail Assigner
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>
            New users are added to a notification group automatically.
          </p>
        </div>
        <div className="ma-top-actions">
          <Link href="/google-sync" className="btn btn-secondary" style={{ ...pill, textDecoration: 'none' }}>
            Google Sync
          </Link>
          <button type="button" onClick={() => mutate()} className="btn btn-secondary" style={pill} aria-label="Refresh">
            ↻
          </button>
        </div>
      </div>

      {status && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: '11px 14px',
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 600,
            background: status.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${status.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: status.type === 'success' ? '#10B981' : '#EF4444',
          }}
        >
          {status.text}
        </div>
      )}

      {error && <p style={{ color: '#EF4444', fontSize: 13 }}>Could not load. Tap refresh.</p>}

      <div className="card ma-hero">
        <div className="ma-hero-row">
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
              {waitingUsers === 0 ? 'Everyone is assigned' : 'Waiting for a group'}
            </div>
            <div style={{ fontSize: 'clamp(28px, 8vw, 38px)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {isLoading ? '…' : waitingUsers === 0 ? '✓' : waitingUsers.toLocaleString()}
              {waitingUsers > 0 && (
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}> users</span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!busyAction || waitingUsers === 0 || !hasRoom || !categoryId}
            onClick={handleAssignNew}
            style={{
              padding: '13px 22px',
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #0EA5E9, #2563EB)',
              opacity: waitingUsers === 0 || !hasRoom ? 0.5 : 1,
            }}
          >
            {busyAction === 'ASSIGN_ALL_CATEGORY'
              ? 'Assigning…'
              : waitingUsers === 0
                ? 'Nothing to assign'
                : `Assign ${waitingUsers.toLocaleString()} now`}
          </button>
        </div>

        <div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${assignedPct}%`,
                background: 'linear-gradient(90deg, #0EA5E9, #2563EB)',
                transition: 'width .3s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
            {totalAssignedUsersCount.toLocaleString()} of {totalUsersCount.toLocaleString()} assigned
          </div>
        </div>

        {!isLoading && waitingUsers > 0 && !hasRoom && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.35)',
              color: '#F59E0B',
            }}
          >
            Groups are full. Add {Math.max(1, Math.ceil((waitingUsers - freeSlots) / MEMBERS_PER_GROUP))} more group mail below.
          </div>
        )}
      </div>

      <div className="ma-stats">
        {[
          { label: 'Users', value: totalUsersCount.toLocaleString() },
          { label: 'Groups', value: `${activePoolCount}` },
          { label: 'Free slots', value: freeSlots.toLocaleString() },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: '12px 14px', borderRadius: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 'clamp(17px, 4.5vw, 22px)', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
              {isLoading ? '…' : stat.value}
            </div>
          </div>
        ))}
      </div>

      {categories.length > 1 && (
        <select
          value={categoryId}
          onChange={e => setSelectedCategoryId(e.target.value)}
          disabled={isLoading}
          style={{ ...fieldStyle, width: '100%', marginBottom: 14 }}
          aria-label="Pool category"
        >
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.isDefault ? ' (default)' : ''}
            </option>
          ))}
        </select>
      )}

      <div className="ma-pools">
        {allPoolEmails.length === 0 && !isLoading && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No group mails yet. Add one below.</p>
        )}
        {allPoolEmails.map((email, idx) => {
          const pct = Math.min(100, email.percentage ?? Math.round((email.currentCount / Math.max(1, email.maxCapacity)) * 100))
          const full = pct >= 100
          return (
            <div
              key={email.id}
              className="card"
              style={{
                padding: '14px 16px',
                borderRadius: 16,
                display: 'grid',
                gap: 10,
                opacity: email.isActive ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Group {idx + 1}</div>
                  <div
                    style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={email.groupEmail}
                  >
                    {email.groupEmail.split('@')[0]}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={email.isActive}
                  aria-label={email.isActive ? 'Deactivate group' : 'Activate group'}
                  disabled={!!busyAction}
                  onClick={() => handleToggleActive(email)}
                  style={{
                    width: 40,
                    height: 24,
                    borderRadius: 999,
                    border: 'none',
                    padding: 2,
                    cursor: 'pointer',
                    flexShrink: 0,
                    background: email.isActive ? '#4f46e5' : 'var(--toggle-off, rgba(120,120,140,0.4))',
                    display: 'flex',
                    justifyContent: email.isActive ? 'flex-end' : 'flex-start',
                    transition: 'background .2s',
                  }}
                >
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
                </button>
              </div>
              <div>
                <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: full ? '#F59E0B' : '#10B981' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginTop: 6, gap: 8 }}>
                  <span>{email.currentCount}/{MEMBERS_PER_GROUP}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="ma-add" style={{ marginBottom: 22 }}>
        <input
          type="email"
          placeholder="new-group@genziitian.org"
          value={newGroupEmail}
          onChange={e => setNewGroupEmail(e.target.value)}
          style={{ ...fieldStyle, fontSize: 13.5 }}
        />
        <button type="button" className="btn btn-secondary" disabled={!!busyAction} onClick={handleAddPoolEmail} style={pill}>
          {busyAction === 'ADD_EMAIL_TO_CATEGORY' ? 'Adding…' : '+ Add group'}
        </button>
      </div>

      <details className="card" style={{ padding: '12px 16px', borderRadius: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13.5, color: 'var(--text-muted)' }}>
          Advanced
        </summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-secondary" disabled={!!busyAction} onClick={handleReconcile} style={pill}>
            {busyAction === 'RECONCILE_GOOGLE' ? 'Checking…' : 'Fix Google mismatch'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!!busyAction || !categoryId}
            onClick={handleRemoveAll}
            style={{ ...pill, border: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5' }}
          >
            {busyAction === 'REMOVE_ALL_POOL_MEMBERS' ? 'Removing…' : 'Remove everyone'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!!busyAction || !canRunAssigner}
            onClick={handleRunAssigner}
            style={pill}
          >
            {busyAction === 'SERIAL_RESET_ASSIGN' && live?.phase ? `${live.percent}%` : 'Rebuild all groups'}
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
          Rebuild is for a full reset only: remove everyone first, then rebuild.
        </p>
      </details>

      {live?.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => {
            if (live.done || live.error) setLive(null)
          }}
        >
          <div
            className="card"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 560,
              borderRadius: 18,
              padding: '20px 22px',
              background: 'var(--bg-card, #12141c)',
              border: '1px solid rgba(255,255,255,0.1)',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Live activity
                </div>
                <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {live.title}
                </h2>
              </div>
              {(live.done || live.error) && (
                <button
                  type="button"
                  onClick={() => setLive(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: 16,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ fontSize: 13.5, fontWeight: 700, color: live.error ? '#EF4444' : '#7DD3FC' }}>
              {live.phase}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{live.detail}</div>

            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(2, live.percent)}%`,
                  background: live.error
                    ? '#EF4444'
                    : 'linear-gradient(90deg, #0EA5E9, #2563EB)',
                  transition: 'width 0.25s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12.5, color: 'var(--text-muted)' }}>
              <span>
                Progress: <strong style={{ color: 'var(--text-primary)' }}>{live.processed}/{live.total}</strong>
              </span>
              <span>
                Percent: <strong style={{ color: 'var(--text-primary)' }}>{live.percent}%</strong>
              </span>
              {live.addJobsQueued > 0 && (
                <span>
                  ADD jobs queued: <strong style={{ color: 'var(--text-primary)' }}>{live.addJobsQueued}</strong>
                </span>
              )}
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 160,
                maxHeight: 280,
                overflowY: 'auto',
                borderRadius: 12,
                background: 'rgba(0,0,0,0.28)',
                padding: '10px 12px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11.5,
                lineHeight: 1.45,
                color: 'var(--text-muted)',
              }}
            >
              {live.lines.map((line, i) => (
                <div key={`${line.t}-${i}`} style={{ marginBottom: 4 }}>
                  {line.text}
                </div>
              ))}
              {!live.done && !live.error && (
                <div style={{ color: '#7DD3FC', marginTop: 6 }}>Working… keep this tab open.</div>
              )}
            </div>

            {(live.done || live.error) && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setLive(null)}
                style={{ padding: '10px 14px', borderRadius: 999, fontWeight: 700 }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
