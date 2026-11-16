'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface TimelineEvent {
  id: string
  eventType: string
  actorType: string
  actorName: string | null
  note: string | null
  createdAt: string
}

interface DeletionRequestItem {
  id: string
  userId: string
  userEmail: string
  userName: string
  reasonCode: string
  reasonLabel: string
  userComment: string | null
  status: string
  requestedAt: string
  cancelUntil: string
  cancelledAt: string | null
  deletedAt: string | null
  createdAt: string
  events: TimelineEvent[]
  user?: {
    id: string
    name: string
    email: string
    role: string
    createdAt: string
    securityNumber?: string
    phone?: string
  }
}

export default function DeletionRequestsPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'CANCELLED' | 'DELETED'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelNote, setCancelNote] = useState('')
  const [acceptNote, setAcceptNote] = useState('')
  const [showCancelPrompt, setShowCancelPrompt] = useState(false)
  const [showAcceptPrompt, setShowAcceptPrompt] = useState(false)
  const [showDeletePrompt, setShowDeletePrompt] = useState(false)

  const apiUrl = `/api/admin/deletion-requests?status=${statusFilter}${
    searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''
  }`

  const { data, error, isLoading, mutate } = useSWR(apiUrl, fetcher)
  const requests: DeletionRequestItem[] = data?.requests || []
  const counts = data?.counts || { all: 0, pending: 0, approved: 0, cancelled: 0, deleted: 0 }

  const { data: detailData, mutate: mutateDetail } = useSWR(
    selectedRequestId ? `/api/admin/deletion-requests/${selectedRequestId}` : null,
    fetcher
  )
  const selectedRequest: DeletionRequestItem | null = detailData || null

  const handleAcceptRequest = async () => {
    if (!selectedRequestId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/deletion-requests/${selectedRequestId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: acceptNote }),
      })
      const result = await res.json()
      if (res.ok) {
        setShowAcceptPrompt(false)
        setAcceptNote('')
        mutate()
        mutateDetail()
      } else {
        alert(result.error || 'Failed to accept request')
      }
    } catch {
      alert('An error occurred while accepting the request.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleManagerCancel = async () => {
    if (!selectedRequestId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/deletion-requests/${selectedRequestId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: cancelNote }),
      })
      const result = await res.json()
      if (res.ok) {
        setShowCancelPrompt(false)
        setCancelNote('')
        mutate()
        mutateDetail()
      } else {
        alert(result.error || 'Failed to cancel request')
      }
    } catch {
      alert('An error occurred while cancelling the request.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleProcessDelete = async () => {
    if (!selectedRequestId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/deletion-requests/${selectedRequestId}/process-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Manual deletion processed by manager' }),
      })
      const result = await res.json()
      if (res.ok) {
        setShowDeletePrompt(false)
        mutate()
        mutateDetail()
      } else {
        alert(result.error || 'Failed to process deletion')
      }
    } catch {
      alert('An error occurred while processing deletion.')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '14px',
              fontSize: '11.5px',
              fontWeight: 600,
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#ef4444',
              }}
            />
            PENDING
          </span>
        )
      case 'APPROVED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '14px',
              fontSize: '11.5px',
              fontWeight: 600,
              background: 'rgba(59, 130, 246, 0.14)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#3b82f6',
              }}
            />
            ACCEPTED (SCHEDULED)
          </span>
        )
      case 'CANCELLED_BY_USER':
        return (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '14px',
              fontSize: '11.5px',
              fontWeight: 600,
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            CANCELLED BY USER
          </span>
        )
      case 'CANCELLED_BY_MANAGER':
        return (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '14px',
              fontSize: '11.5px',
              fontWeight: 600,
              background: 'rgba(128, 128, 128, 0.1)',
              color: 'var(--primary)',
              border: '1px solid rgba(128, 128, 128, 0.25)',
            }}
          >
            CANCELLED BY MANAGER
          </span>
        )
      case 'DELETED':
        return (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '14px',
              fontSize: '11.5px',
              fontWeight: 600,
              background: 'rgba(100, 116, 139, 0.15)',
              color: '#64748b',
              border: '1px solid rgba(100, 116, 139, 0.25)',
            }}
          >
            DELETED
          </span>
        )
      default:
        return (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '14px',
              fontSize: '11.5px',
              fontWeight: 600,
              background: 'var(--surface-2)',
              color: 'var(--text-secondary)',
            }}
          >
            {status}
          </span>
        )
    }
  }

  return (
    <div className="page-container fade-in" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => router.push('/admin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            title="Back to User Management"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Account Deletion Requests
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Historical audit records, user reasons, and cancellation controls
            </p>
          </div>
        </div>

        <Link
          href="/admin"
          className="btn btn-ghost"
          style={{ borderRadius: '50px', fontSize: '13px', padding: '8px 20px' }}
        >
          User Management →
        </Link>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { key: 'ALL', label: 'All Requests', count: counts.all },
          { key: 'PENDING', label: 'Pending', count: counts.pending, color: '#ef4444' },
          { key: 'APPROVED', label: 'Accepted / Scheduled', count: counts.approved, color: '#3b82f6' },
          { key: 'CANCELLED', label: 'Cancelled', count: counts.cancelled, color: '#a855f7' },
          { key: 'DELETED', label: 'Deleted', count: counts.deleted, color: '#64748b' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key as any)}
            style={{
              padding: '10px 18px',
              borderRadius: '50px',
              fontSize: '13.5px',
              fontWeight: statusFilter === tab.key ? '700' : '500',
              background: statusFilter === tab.key ? 'var(--primary)' : 'var(--surface-2)',
              color: statusFilter === tab.key ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{tab.label}</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                background: statusFilter === tab.key ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
                color: statusFilter === tab.key ? '#fff' : tab.color || 'var(--text-muted)',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 20px',
          borderRadius: '50px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          marginBottom: '24px',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" color="var(--text-muted)">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search by User Name, Email, Reason or Comments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: 'none',
            border: 'none',
            width: '100%',
            outline: 'none',
            fontSize: '14px',
            color: 'var(--text-primary)',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Request List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Loading deletion requests...
        </div>
      ) : requests.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--surface-2)',
            borderRadius: '14px',
            border: '1px dashed var(--border)',
          }}
        >
          <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px' }}>
            No account deletion requests found
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            {statusFilter === 'ALL'
              ? 'No users have requested account deletion.'
              : `No requests found matching status "${statusFilter}".`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {requests.map((item) => {
            const requestedDate = new Date(item.requestedAt).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
            const requestedTime = new Date(item.requestedAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
            const isPending = item.status === 'PENDING'
            const isCancellationWindowOpen = isPending && new Date().getTime() < new Date(item.cancelUntil).getTime()

            return (
              <div
                key={item.id}
                onClick={() => setSelectedRequestId(item.id)}
                style={{
                  padding: '18px 22px',
                  borderRadius: '12px',
                  background: 'var(--surface-2)',
                  border: isPending ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '260px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: isPending ? 'rgba(239, 68, 68, 0.15)' : 'var(--surface-2)',
                      color: isPending ? '#ef4444' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '15px',
                    }}
                  >
                    {item.userName ? item.userName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                        {item.userName}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {item.userEmail}
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>REASON FOR LEAVING</div>
                  <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: '600', marginTop: '2px' }}>
                    {item.reasonLabel}
                  </div>
                  {item.userComment && (
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                        marginTop: '2px',
                        maxWidth: '400px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      "{item.userComment}"
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', minWidth: '160px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Requested: {requestedDate} · {requestedTime}
                  </div>
                  {isCancellationWindowOpen && (
                    <div style={{ fontSize: '11.5px', color: '#f59e0b', fontWeight: '600', marginTop: '3px' }}>
                      ⏳ 24h User Cancel Active
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedRequestId(item.id)
                  }}
                  className="btn btn-ghost"
                  style={{ borderRadius: '50px', fontSize: '12.5px', padding: '6px 16px' }}
                >
                  View Details →
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Request Details & Timeline Modal */}
      {selectedRequestId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setSelectedRequestId(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              padding: '28px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {!selectedRequest ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Loading details...</div>
            ) : (
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                        Deletion Request Details
                      </h2>
                      {getStatusBadge(selectedRequest.status)}
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Request ID: {selectedRequest.id}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedRequestId(null)}
                    style={{
                      background: 'var(--surface-2)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* User Info Card */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    background: 'var(--surface-2)',
                    marginBottom: '20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      User Name
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {selectedRequest.userName}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      User Email
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {selectedRequest.userEmail}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      User ID
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                      {selectedRequest.userId}
                    </div>
                  </div>
                </div>

                {/* Reason & Feedback */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    background: 'var(--surface-2)',
                    marginBottom: '24px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Reason For Leaving
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedRequest.reasonLabel}
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Additional Feedback / Comment
                    </div>
                    <div
                      style={{
                        fontSize: '13.5px',
                        color: selectedRequest.userComment ? 'var(--text-primary)' : 'var(--text-muted)',
                        marginTop: '4px',
                        lineHeight: '1.5',
                        background: 'var(--surface)',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {selectedRequest.userComment || 'No additional feedback provided.'}
                    </div>
                  </div>
                </div>

                {/* REAL AUDIT TIMELINE */}
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                    Deletion Event Timeline
                  </h3>

                  <div style={{ position: 'relative', paddingLeft: '28px' }}>
                    {/* Vertical connecting line */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '9px',
                        top: '8px',
                        bottom: '8px',
                        width: '2px',
                        background: 'var(--border)',
                      }}
                    />

                    {selectedRequest.events.map((ev, index) => {
                      const evDate = new Date(ev.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                      const evTime = new Date(ev.createdAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })

                      const isRequested = ev.eventType === 'ACCOUNT_DELETION_REQUESTED'
                      const isCancelled = ev.eventType.includes('CANCELLED')
                      const isDeleted = ev.eventType === 'ACCOUNT_DELETED'

                      const dotColor = isCancelled ? '#3b82f6' : isDeleted ? '#64748b' : '#ef4444'

                      return (
                        <div key={ev.id} style={{ position: 'relative', marginBottom: index === selectedRequest.events.length - 1 ? 0 : '20px' }}>
                          {/* Dot */}
                          <div
                            style={{
                              position: 'absolute',
                              left: '-28px',
                              top: '2px',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: 'var(--surface)',
                              border: `3px solid ${dotColor}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          />

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                                {ev.eventType === 'ACCOUNT_DELETION_REQUESTED'
                                  ? 'Account Deletion Requested'
                                  : ev.eventType === 'ACCOUNT_DELETION_CANCELLED_BY_USER'
                                  ? 'Deletion Cancelled by User'
                                  : ev.eventType === 'ACCOUNT_DELETION_CANCELLED_BY_MANAGER'
                                  ? 'Deletion Cancelled by Manager'
                                  : ev.eventType === 'ACCOUNT_DELETED'
                                  ? 'Account Deleted'
                                  : ev.eventType}
                              </span>
                              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                {evDate} · {evTime}
                              </span>
                            </div>

                            {ev.note && (
                              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {ev.note}
                              </div>
                            )}

                            {ev.actorName && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Actor: {ev.actorName} ({ev.actorType})
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Actions */}
                {(selectedRequest.status === 'PENDING' || selectedRequest.status === 'APPROVED') && (
                  <div
                    style={{
                      paddingTop: '20px',
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    {selectedRequest.status === 'APPROVED' && (
                      <div style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        fontSize: '13px',
                        color: '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span style={{ fontSize: '16px' }}>✓</span>
                        <div>
                          <strong>Request Accepted by Manager.</strong> Scheduled for final deletion after the 24h cancellation window. You can still cancel or execute manual deletion anytime below.
                        </div>
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      justifyContent: 'flex-end',
                      flexWrap: 'wrap',
                    }}>
                      {!showCancelPrompt && !showAcceptPrompt && !showDeletePrompt && (
                        <>
                          {selectedRequest.status === 'PENDING' && (
                            <button
                              onClick={() => setShowAcceptPrompt(true)}
                              className="btn btn-primary"
                              style={{
                                borderRadius: '50px',
                                fontSize: '13px',
                                padding: '8px 20px',
                                background: '#10b981',
                                border: 'none',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Accept Request
                            </button>
                          )}
                          <button
                            onClick={() => setShowCancelPrompt(true)}
                            className="btn btn-ghost"
                            style={{ borderRadius: '50px', fontSize: '13px', color: 'var(--primary)' }}
                          >
                            Cancel Deletion Request
                          </button>
                          <button
                            onClick={() => setShowDeletePrompt(true)}
                            className="btn btn-danger"
                            style={{ borderRadius: '50px', fontSize: '13px', padding: '8px 22px' }}
                          >
                            Execute Manual Deletion
                          </button>
                        </>
                      )}

                      {showAcceptPrompt && (
                        <div style={{ width: '100%', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '16px', borderRadius: '14px' }}>
                          <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 6px', color: '#10b981' }}>
                            Accept deletion request & notify user?
                          </p>
                          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                            This marks the request as Accepted and notifies the user via email. Account deletion will proceed after the 24-hour cancellation period ends.
                          </p>
                          <input
                            type="text"
                            placeholder="Optional manager note..."
                            value={acceptNote}
                            onChange={(e) => setAcceptNote(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              marginBottom: '12px',
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setShowAcceptPrompt(false)}
                              className="btn btn-ghost"
                              style={{ borderRadius: '50px', fontSize: '12px' }}
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={handleAcceptRequest}
                              disabled={actionLoading}
                              className="btn btn-primary"
                              style={{ borderRadius: '50px', fontSize: '12px', padding: '6px 20px', background: '#10b981', border: 'none' }}
                            >
                              {actionLoading ? 'Accepting...' : 'Confirm Accept & Notify User'}
                            </button>
                          </div>
                        </div>
                      )}

                      {showCancelPrompt && (
                        <div style={{ width: '100%', background: 'var(--surface-2)', padding: '16px', borderRadius: '14px' }}>
                          <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                            Cancel deletion and restore user account?
                          </p>
                          <input
                            type="text"
                            placeholder="Optional manager note/reason..."
                            value={cancelNote}
                            onChange={(e) => setCancelNote(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              marginBottom: '12px',
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setShowCancelPrompt(false)}
                              className="btn btn-ghost"
                              style={{ borderRadius: '50px', fontSize: '12px' }}
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={handleManagerCancel}
                              disabled={actionLoading}
                              className="btn btn-primary"
                              style={{ borderRadius: '50px', fontSize: '12px', padding: '6px 18px' }}
                            >
                              {actionLoading ? 'Cancelling...' : 'Confirm Manager Cancellation'}
                            </button>
                          </div>
                        </div>
                      )}

                      {showDeletePrompt && (
                        <div style={{ width: '100%', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '14px' }}>
                          <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 6px', color: '#ef4444' }}>
                            Confirm manual account deletion
                          </p>
                          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                            This will deactivate the user account, send a final confirmation email, and detach enrollments. The historical deletion request and timeline will remain preserved for audit records.
                          </p>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setShowDeletePrompt(false)}
                              className="btn btn-ghost"
                              style={{ borderRadius: '50px', fontSize: '12px' }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleProcessDelete}
                              disabled={actionLoading}
                              className="btn btn-danger"
                              style={{ borderRadius: '50px', fontSize: '12px', padding: '6px 20px' }}
                            >
                              {actionLoading ? 'Processing...' : 'Confirm & Delete Account'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
