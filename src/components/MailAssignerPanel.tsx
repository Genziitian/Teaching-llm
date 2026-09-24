'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { DEFAULT_MEMBERS_PER_GROUP } from '@/lib/notification-group-pool'
import { poolIndexToSerialRange } from '@/lib/notification-group-constants'

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
  const [lastResult, setLastResult] = useState<AssignResult | null>(null)
  const [lastRemoveResult, setLastRemoveResult] = useState<AssignResult | null>(null)
  const [live, setLive] = useState<LiveProgress | null>(null)

  const categoryId = selectedCategoryId || defaultCategory?.id || ''
  const activeCategory = categories.find(c => c.id === categoryId) || defaultCategory

  const allPoolEmails = activeCategory?.emails || []
  const activePoolEmails = allPoolEmails.filter(e => e.isActive)
  const activePoolCount = activePoolEmails.length
  const inactivePoolCount = allPoolEmails.filter(e => !e.isActive).length
  const poolsNeeded = Math.max(
    1,
    Math.ceil(Math.max(totalUsersCount, 1) / MEMBERS_PER_GROUP)
  )
  const poolsShortBy = Math.max(0, poolsNeeded - activePoolCount)
  const canRunAssigner = !!categoryId && activePoolCount >= poolsNeeded && totalUsersCount > 0
  const hasAssignedUsers = totalAssignedUsersCount > 0 || allPoolEmails.some(e => e.currentCount > 0)

  // Planned map: 1st active pool = serials 1–700, 2nd = 701–1400, …
  const serialPlan = activePoolEmails.map((email, poolIndex) => {
    const { serialFrom, serialTo } = poolIndexToSerialRange(poolIndex, totalUsersCount, MEMBERS_PER_GROUP)
    const coversUsers = totalUsersCount > 0 && serialFrom <= totalUsersCount
    return {
      ...email,
      poolIndex,
      groupNumber: poolIndex + 1,
      serialFrom: coversUsers ? serialFrom : null,
      serialTo: coversUsers ? serialTo : null,
    }
  })

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
      if (action === 'SERIAL_RESET_ASSIGN') setLastResult(json)
      if (action === 'REMOVE_ALL_POOL_MEMBERS') setLastRemoveResult(json)
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
      let lastJson: any = null
      while (guard < 500) {
        const json = await postJson('SERIAL_RESET_ASSIGN', {
          categoryId,
          offset,
          limit: 75,
        })
        lastJson = json
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

      setLastResult({
        ...lastJson,
        addJobsQueued: totalAdd,
        message: `Finished. Queued ${totalAdd} ADD jobs total. Process them on Google Sync.`,
      })
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

  const handleEnsureSerials = async () => {
    const ok = window.confirm(
      'Assign a unique serial number to every user who is missing one?\n\nExisting serials are never changed. Live progress will open.'
    )
    if (!ok) return

    setBusyAction('ENSURE_SERIALS')
    setStatus(null)
    setLive({
      open: true,
      title: 'Assign missing serials — live',
      phase: 'Assigning missing serials',
      detail: 'Starting…',
      percent: 0,
      processed: 0,
      total: totalUsersCount,
      addJobsQueued: 0,
      lines: [{ t: Date.now(), text: 'Started serial backfill' }],
      done: false,
    })

    try {
      let guard = 0
      while (guard < 200) {
        const ens = await postJson('ENSURE_SERIALS', { limit: 150 })
        const withSerial = ens.withSerial ?? 0
        const total = ens.totalUsers ?? totalUsersCount
        const last = (ens.lastAssigned || [])
          .map((r: { email: string; serial: number }) => `#${r.serial} ${r.email}`)
          .join(' · ')
        setLive(prev =>
          prev
            ? {
                ...prev,
                processed: withSerial,
                total,
                percent: total > 0 ? Math.round((withSerial / total) * 100) : 0,
                detail: ens.message || '',
                lines: [
                  ...prev.lines,
                  { t: Date.now(), text: ens.message || `Batch +${ens.backfilled}` },
                  ...(last ? [{ t: Date.now(), text: `Recent: ${last}` }] : []),
                ].slice(-40),
              }
            : prev
        )
        if (ens.done) break
        guard++
      }
      setStatus({ type: 'success', text: 'All users now have a unique serial.' })
      setLive(prev =>
        prev
          ? {
              ...prev,
              done: true,
              phase: 'Complete',
              percent: 100,
              detail: 'All missing serials assigned.',
            }
          : prev
      )
      await mutate()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Request failed'
      setStatus({ type: 'error', text })
      setLive(prev => (prev ? { ...prev, error: text, detail: text } : prev))
    } finally {
      setBusyAction(null)
    }
  }

  const waitingMessage = (() => {
    if (canRunAssigner) {
      return `Ready for Step 2 — ${activePoolCount}/${poolsNeeded} active pool emails for ${totalUsersCount.toLocaleString()} users at ${MEMBERS_PER_GROUP}/group.`
    }
    if (activePoolCount === 0 && inactivePoolCount > 0) {
      return `Waiting — ${inactivePoolCount} group mail(s) exist but are inactive. Activate them until you have ${poolsNeeded} active.`
    }
    if (activePoolCount === 0) {
      return `Waiting — no group mails yet. Add emails until you have ${poolsNeeded} active, then unlock Step 2.`
    }
    return `Waiting — ${activePoolCount} active / need ${poolsNeeded}. Add or activate ${poolsShortBy} more.`
  })()

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 60px' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <Link
            href="/manage/contacts"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}
          >
            ← Back to Synced Contacts
          </Link>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginTop: 10,
            }}
          >
            Notification Groups
          </div>
          <h1
            style={{
              margin: '4px 0 6px',
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Mail Assigner
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.45, maxWidth: 620 }}>
            Every user gets a serial (1, 2, 3…). Group 1 = serials 1–{MEMBERS_PER_GROUP}, Group 2 ={' '}
            {MEMBERS_PER_GROUP + 1}–{MEMBERS_PER_GROUP * 2}, and so on. Capacity is fixed at {MEMBERS_PER_GROUP}.
            Course mails are never touched.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            href="/google-sync"
            className="btn btn-secondary"
            style={{ padding: '9px 14px', borderRadius: 12, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
          >
            Google Sync →
          </Link>
          <button
            type="button"
            onClick={() => mutate()}
            className="btn btn-secondary"
            style={{ padding: '9px 14px', borderRadius: 12, fontWeight: 600, fontSize: 13 }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: '14px 16px',
          borderRadius: 14,
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: 'var(--text-primary)' }}>How serials tell you what&apos;s done:</strong> after Step 2,
        each user stores <code>notificationGroupSerial</code>. Serials{' '}
        <strong style={{ color: 'var(--text-primary)' }}>1–{MEMBERS_PER_GROUP}</strong> belong to the 1st pool email,{' '}
        <strong style={{ color: 'var(--text-primary)' }}>
          {MEMBERS_PER_GROUP + 1}–{MEMBERS_PER_GROUP * 2}
        </strong>{' '}
        to the 2nd, etc. That&apos;s how you know block 1 is filled and the next block starts at{' '}
        {MEMBERS_PER_GROUP + 1}. Google membership is synced via jobs; use Reconcile if Google drifts from DB.
      </div>

      {status && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 14,
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        {[
          { label: 'Total users', value: totalUsersCount.toLocaleString() },
          { label: 'Assigned in DB', value: totalAssignedUsersCount.toLocaleString() },
          { label: 'Active pool mails', value: `${activePoolCount}` },
          { label: 'Pools needed', value: `${poolsNeeded}` },
          { label: 'Per group', value: `${MEMBERS_PER_GROUP} (fixed)` },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: '16px 18px', borderRadius: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              {isLoading ? '…' : stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '20px 22px', borderRadius: 18, marginBottom: 18 }}>
        <label style={{ display: 'grid', gap: 6, marginBottom: 18, maxWidth: 420 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Pool category
          </span>
          <select
            value={categoryId}
            onChange={e => setSelectedCategoryId(e.target.value)}
            disabled={isLoading || categories.length === 0}
            style={fieldStyle}
          >
            {categories.length === 0 && <option value="">No pools yet</option>}
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 650,
            lineHeight: 1.45,
            background: canRunAssigner ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
            border: `1px solid ${canRunAssigner ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.35)'}`,
            color: canRunAssigner ? '#10B981' : '#F59E0B',
          }}
        >
          {isLoading ? 'Loading pool status…' : waitingMessage}
        </div>

        {error && (
          <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>Failed to load pools.</p>
        )}

        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
          Serial map · pool emails {activeCategory ? `· ${activeCategory.name}` : ''}
        </div>

        {serialPlan.length > 0 && (
          <div
            style={{
              marginBottom: 12,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(14,165,233,0.08)',
              border: '1px solid rgba(14,165,233,0.22)',
              display: 'grid',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Planned ranges (active pools, in order)
            </div>
            {serialPlan.map(row => (
              <div key={row.id} style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                <strong>Group {row.groupNumber}</strong>
                {' · '}
                {row.serialFrom != null ? (
                  <>
                    serials <strong>#{row.serialFrom}–#{row.serialTo}</strong>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>not needed for current user count</span>
                )}
                {' → '}
                <span style={{ color: 'var(--text-muted)' }}>{row.groupEmail}</span>
              </div>
            ))}
            {poolsShortBy > 0 && (
              <div style={{ fontSize: 12.5, color: '#F59E0B', marginTop: 4 }}>
                Need {poolsShortBy} more active pool mail(s) to cover serials up to #{totalUsersCount}.
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
          {allPoolEmails.length === 0 && !isLoading && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic', margin: 0 }}>
              No Group Mail in this pool yet.
            </p>
          )}
          {allPoolEmails.map(email => {
            const pct = email.percentage ?? Math.round((email.currentCount / Math.max(1, email.maxCapacity)) * 100)
            const planIdx = activePoolEmails.findIndex(e => e.id === email.id)
            const range =
              email.isActive && planIdx >= 0
                ? poolIndexToSerialRange(planIdx, totalUsersCount, MEMBERS_PER_GROUP)
                : null
            return (
              <div
                key={email.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--bg-secondary, rgba(0,0,0,0.22))',
                  border: email.isActive ? '1px solid transparent' : '1px solid rgba(245,158,11,0.25)',
                  fontSize: 13,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{email.groupEmail}</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    {email.currentCount}/{MEMBERS_PER_GROUP} in DB
                    {email.isActive ? ' · active' : ' · inactive'}
                    {range && range.serialFrom <= totalUsersCount && (
                      <>
                        {' · '}
                        <span style={{ color: '#7DD3FC' }}>
                          serials #{range.serialFrom}–#{range.serialTo}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: email.isFull ? '#F59E0B' : '#10B981', fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                    {pct}%
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!!busyAction}
                    onClick={() => handleToggleActive(email)}
                    style={{ padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}
                  >
                    {email.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="e.g. notifications-group-1@genziitian.org"
            value={newGroupEmail}
            onChange={e => setNewGroupEmail(e.target.value)}
            style={{ ...fieldStyle, flex: 1, minWidth: 220, fontSize: 13.5 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!!busyAction}
            onClick={handleAddPoolEmail}
            style={{ padding: '10px 14px', borderRadius: 999, fontWeight: 700, fontSize: 13 }}
          >
            {busyAction === 'ADD_EMAIL_TO_CATEGORY' ? 'Adding…' : '+ Add Group Mail'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 18 }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!!busyAction || !categoryId}
          onClick={handleRemoveAll}
          style={{
            padding: '12px 18px',
            borderRadius: 999,
            fontWeight: 800,
            fontSize: 13.5,
            border: '1px solid rgba(239,68,68,0.4)',
            color: '#FCA5A5',
          }}
        >
          {busyAction === 'REMOVE_ALL_POOL_MEMBERS'
            ? 'Removing…'
            : hasAssignedUsers
              ? 'Step 1 · Remove all members'
              : 'Step 1 · Remove all (DB already empty)'}
        </button>

        <button
          type="button"
          className="btn btn-primary"
          disabled={!!busyAction || !canRunAssigner}
          onClick={handleRunAssigner}
          style={{
            padding: '12px 20px',
            borderRadius: 999,
            fontWeight: 800,
            fontSize: 14,
            background: canRunAssigner
              ? 'linear-gradient(135deg, #0EA5E9, #2563EB)'
              : 'rgba(100,116,139,0.45)',
            border: 'none',
            boxShadow: canRunAssigner ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none',
            opacity: canRunAssigner ? 1 : 0.65,
            cursor: canRunAssigner && !busyAction ? 'pointer' : 'not-allowed',
          }}
        >
          {busyAction === 'SERIAL_RESET_ASSIGN'
            ? live?.phase
              ? `${live.phase}… ${live.percent}%`
              : 'Assigning…'
            : canRunAssigner
              ? 'Step 2 · Assign serials & ADD'
              : `Waiting — need ${poolsShortBy || poolsNeeded} active mail(s)`}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          disabled={!!busyAction}
          onClick={handleEnsureSerials}
          style={{ padding: '12px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13 }}
        >
          {busyAction === 'ENSURE_SERIALS' ? 'Assigning serials…' : 'Assign missing serials'}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          disabled={!!busyAction}
          onClick={handleReconcile}
          style={{ padding: '12px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13 }}
        >
          {busyAction === 'RECONCILE_GOOGLE' ? 'Reconciling…' : 'Reconcile Google vs DB'}
        </button>
      </div>

      {lastRemoveResult && (
        <div className="card" style={{ padding: '14px 16px', borderRadius: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Last remove</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Cleared {lastRemoveResult.clearedUsers} users · {lastRemoveResult.removeJobsQueued} REMOVE jobs queued
          </div>
        </div>
      )}

      {lastResult && (
        <div
          className="card"
          style={{
            padding: '16px 18px',
            borderRadius: 16,
            border: '1px solid rgba(14,165,233,0.25)',
            background: 'rgba(14,165,233,0.08)',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: 'var(--text-primary)' }}>
            Last serial assign
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Users: {lastResult.totalUsers} · ADD {lastResult.addJobsQueued} · already in correct group (DB){' '}
            {lastResult.unchangedCount}
          </div>
          {lastResult.distribution && lastResult.distribution.length > 0 && (
            <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
              {lastResult.distribution
                .filter(d => d.memberCount > 0)
                .map(d => (
                  <div key={d.groupEmail} style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    <strong>Group {d.groupNumber ?? '?'}</strong>
                    {' · '}
                    serials #{d.serialFrom}–#{d.serialTo}
                    {' · '}
                    {d.groupEmail} ({d.memberCount}/{d.maxCapacity})
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

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
