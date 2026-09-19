'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'

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

type AssignResult = {
  message?: string
  totalUsers?: number
  assignedCount?: number
  removeJobsQueued?: number
  addJobsQueued?: number
  unchangedCount?: number
  membersPerGroup?: number
  poolsUsed?: number
  distribution?: Array<{
    groupEmail: string
    serialFrom: number | null
    serialTo: number | null
    memberCount: number
    maxCapacity: number
  }>
  serialPreview?: Array<{ serial: number; email: string; groupEmail: string }>
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function MailAssignerPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data, error, isLoading, mutate } = useSWR(
    open ? '/api/admin/notification-groups' : null,
    fetcher
  )

  const categories: PoolCategory[] = data?.categories || []
  const totalUsersCount: number = data?.totalUsersCount ?? 0
  const defaultCategory = categories.find(c => c.isDefault) || categories[0] || null

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [newGroupEmail, setNewGroupEmail] = useState('')
  const [membersPerGroup, setMembersPerGroup] = useState(700)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [lastResult, setLastResult] = useState<AssignResult | null>(null)

  const categoryId = selectedCategoryId || defaultCategory?.id || ''
  const activeCategory = categories.find(c => c.id === categoryId) || defaultCategory

  const activePoolCount = (activeCategory?.emails || []).filter(e => e.isActive).length
  const poolsNeeded = Math.max(
    1,
    Math.ceil(Math.max(totalUsersCount, 1) / Math.max(1, membersPerGroup))
  )
  const poolsShortBy = Math.max(0, poolsNeeded - activePoolCount)
  const canRunAssigner = !!categoryId && activePoolCount >= poolsNeeded && totalUsersCount > 0

  if (!open) return null

  const postAction = async (action: string, body: Record<string, unknown> = {}) => {
    setBusyAction(action)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/notification-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Request failed')
      }
      setStatus({ type: 'success', text: json.message || 'Done' })
      if (action === 'SERIAL_RESET_ASSIGN') {
        setLastResult(json)
      }
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
      maxCapacity: membersPerGroup,
    })
    if (result) setNewGroupEmail('')
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
            ? `Waiting — add ${poolsShortBy} more active group mail(s) first (${activePoolCount}/${poolsNeeded}).`
            : 'Cannot run yet — add pool emails first.',
      })
      return
    }
    const ok = window.confirm(
      `Run Mail Assigner?\n\n` +
        `• Assign serial numbers starting at 1 (by user join order)\n` +
        `• Pack ${membersPerGroup} members per Google Group\n` +
        `• Remove users from old notification groups when they move\n` +
        `• Re-add them to the serialized pool groups\n\n` +
        `Course Google Groups are NOT touched.\n` +
        `Sync jobs will appear on Google Sync.`
    )
    if (!ok) return

    await postAction('SERIAL_RESET_ASSIGN', {
      categoryId,
      membersPerGroup,
    })
  }

  const handleReconcile = async () => {
    const ok = window.confirm(
      'Reconcile Google with DB?\n\nRemoves extras still in notification Google Groups that are not assigned in the database. Course groups are not included.'
    )
    if (!ok) return
    await postAction('RECONCILE_GOOGLE')
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          borderRadius: 18,
          padding: '22px 24px 28px',
          background: 'var(--bg-card, #12141c)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Notification Groups
            </div>
            <h2 style={{ margin: '4px 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
              Mail Assigner
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Serialise every user (1, 2, 3…) and pack them into Google Group pool emails
              at {membersPerGroup}/group. Separate from course mails.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 18,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {status && (
          <div
            style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              background: status.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${status.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: status.type === 'success' ? '#10B981' : '#EF4444',
            }}
          >
            {status.text}
          </div>
        )}

        <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pool category
            </span>
            <select
              value={categoryId}
              onChange={e => setSelectedCategoryId(e.target.value)}
              disabled={isLoading || categories.length === 0}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.25)',
                color: 'var(--text-primary)',
                fontSize: 14,
              }}
            >
              {categories.length === 0 && <option value="">No pools yet</option>}
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Members per group
            </span>
            <input
              type="number"
              min={1}
              max={5000}
              value={membersPerGroup}
              onChange={e => setMembersPerGroup(Math.max(1, Number(e.target.value) || 700))}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.25)',
                color: 'var(--text-primary)',
                fontSize: 14,
                width: 160,
              }}
            />
          </label>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Pool emails {activeCategory ? `· ${activeCategory.name}` : ''}
              </div>
              <button
                type="button"
                onClick={() => mutate()}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}
              >
                Refresh
              </button>
            </div>

            {error && (
              <p style={{ color: '#EF4444', fontSize: 13 }}>Failed to load pools.</p>
            )}
            {isLoading && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading pools…</p>
            )}
            {!isLoading && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 650,
                  lineHeight: 1.45,
                  background: canRunAssigner ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                  border: `1px solid ${canRunAssigner ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.35)'}`,
                  color: canRunAssigner ? '#10B981' : '#F59E0B',
                }}
              >
                {canRunAssigner ? (
                  <>Ready — {activePoolCount}/{poolsNeeded} pool emails for {totalUsersCount.toLocaleString()} users at {membersPerGroup}/group. You can run the assigner.</>
                ) : activePoolCount === 0 ? (
                  <>Waiting — no group mails in this pool yet. Add emails below (e.g. notifications-group-1@…) until you have {poolsNeeded} active mail(s), then Run unlocks.</>
                ) : (
                  <>Waiting — have {activePoolCount} active mail(s), need {poolsNeeded} for {totalUsersCount.toLocaleString()} users ({membersPerGroup}/group). Add {poolsShortBy} more, then Run unlocks.</>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gap: 8 }}>
              {(activeCategory?.emails || []).map(email => (
                <div
                  key={email.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(0,0,0,0.22)',
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{email.groupEmail}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                      {email.currentCount}/{email.maxCapacity}
                      {email.isActive ? '' : ' · inactive'}
                    </div>
                  </div>
                  <div style={{ color: email.isFull ? '#F59E0B' : '#10B981', fontWeight: 700 }}>
                    {email.percentage ?? Math.round((email.currentCount / Math.max(1, email.maxCapacity)) * 100)}%
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <input
                type="email"
                placeholder="e.g. notifications-group-1@genziitian.org"
                value={newGroupEmail}
                onChange={e => setNewGroupEmail(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 220,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.25)',
                  color: 'var(--text-primary)',
                  fontSize: 13.5,
                }}
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

            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Progress: {activePoolCount}/{poolsNeeded} pool emails · {totalUsersCount.toLocaleString()} users ·{' '}
              {membersPerGroup}/group. Run stays disabled until the pool is full enough.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!!busyAction || !canRunAssigner}
              onClick={handleRunAssigner}
              style={{
                padding: '11px 18px',
                borderRadius: 999,
                fontWeight: 800,
                fontSize: 13.5,
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
                ? 'Assigning…'
                : canRunAssigner
                  ? 'Run Mail Assigner (serial + sync)'
                  : poolsShortBy > 0
                    ? `Waiting — add ${poolsShortBy} more mail${poolsShortBy === 1 ? '' : 's'}`
                    : 'Waiting — add pool mails'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={!!busyAction}
              onClick={handleReconcile}
              style={{ padding: '11px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13 }}
            >
              {busyAction === 'RECONCILE_GOOGLE' ? 'Reconciling…' : 'Reconcile Google extras'}
            </button>

            <Link
              href="/google-sync"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '11px 16px',
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13,
                color: '#818CF8',
                textDecoration: 'none',
                border: '1px solid rgba(129,140,248,0.35)',
              }}
            >
              Google Sync jobs →
            </Link>
          </div>

          {lastResult && (
            <div
              style={{
                marginTop: 4,
                padding: '14px 16px',
                borderRadius: 14,
                border: '1px solid rgba(14,165,233,0.25)',
                background: 'rgba(14,165,233,0.08)',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: 'var(--text-primary)' }}>
                Last run
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Users: {lastResult.assignedCount}/{lastResult.totalUsers} · REMOVE {lastResult.removeJobsQueued} · ADD{' '}
                {lastResult.addJobsQueued} · unchanged {lastResult.unchangedCount} · {lastResult.membersPerGroup}/group
              </div>
              {lastResult.distribution && lastResult.distribution.length > 0 && (
                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  {lastResult.distribution
                    .filter(d => d.memberCount > 0)
                    .map(d => (
                      <div key={d.groupEmail} style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                        <strong>{d.groupEmail}</strong>
                        {' · '}
                        serials {d.serialFrom}–{d.serialTo} ({d.memberCount}/{d.maxCapacity})
                      </div>
                    ))}
                </div>
              )}
              {lastResult.serialPreview && lastResult.serialPreview.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                    Serial preview (first {lastResult.serialPreview.length})
                  </summary>
                  <div style={{ marginTop: 8, display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                    {lastResult.serialPreview.map(row => (
                      <div key={`${row.serial}-${row.email}`}>
                        #{row.serial} · {row.email} → {row.groupEmail}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
