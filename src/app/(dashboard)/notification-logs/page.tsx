'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatIST } from '@/lib/date-utils'

interface NotificationLogItem {
  id: string
  category: string
  title: string
  body: string
  courseId: string | null
  courseName: string | null
  recipientCount: number
  channel: string
  topicName: string | null
  status: string
  metadata: string | null
  createdAt: string
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'CLASS_START', label: 'Class Starting Now' },
  { value: 'CLASS_STARTING_15M', label: 'Class Starting (15m)' },
  { value: 'LECTURE_ADDED', label: 'Lecture Added' },
  { value: 'LIVE_CLASS', label: 'Live Class' },
  { value: 'ANNOUNCEMENT', label: 'Announcement' },
  { value: 'DAILY_DIGEST', label: 'Daily Digest' },
]

function getCategoryBadge(category: string) {
  switch (category) {
    case 'CLASS_START':
      return { label: 'Class Starting Now', bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }
    case 'CLASS_STARTING_15M':
      return { label: 'Class 15m Warning', bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }
    case 'LECTURE_ADDED':
      return { label: 'New Lecture', bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }
    case 'LIVE_CLASS':
      return { label: 'Live Session', bg: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }
    case 'ANNOUNCEMENT':
      return { label: 'Announcement', bg: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9' }
    case 'DAILY_DIGEST':
      return { label: 'Daily Schedule', bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }
    default:
      return { label: category.replace(/_/g, ' '), bg: 'rgba(107, 114, 128, 0.12)', color: '#6b7280' }
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return formatIST(dateStr, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function NotificationLogsPage() {
  const [logs, setLogs] = useState<NotificationLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      query.set('page', page.toString())
      query.set('limit', '25')
      if (category) query.set('category', category)

      const res = await fetch(`/api/notification-logs?${query.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
      }
    } catch (err) {
      console.error('Failed to fetch notification logs:', err)
    } finally {
      setLoading(false)
    }
  }, [page, category])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const filteredLogs = logs.filter((item) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      item.title.toLowerCase().includes(term) ||
      item.body.toLowerCase().includes(term) ||
      (item.courseName && item.courseName.toLowerCase().includes(term))
    )
  })

  return (
    <div className="dashboard-inner-page" style={{ padding: '24px', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: 'var(--text-primary, #111827)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🔔 Notification Delivery Logs</span>
            <span style={{ fontSize: '13px', fontWeight: '600', padding: '2px 10px', borderRadius: '12px', background: 'var(--primary-light, rgba(7F, 88, 246, 0.1))', color: 'var(--accent, var(--primary))' }}>
              {total} Total Sent
            </span>
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary, #6B7280)', margin: '4px 0 0 0' }}>
            Manager audit history for automated class start sound alerts, lecture updates, and system pushes.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border-color, #E5E7EB)',
            background: 'var(--card-bg, #FFFFFF)',
            color: 'var(--text-primary, #374151)',
            fontWeight: '500',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          🔄 {loading ? 'Refreshing...' : 'Refresh Logs'}
        </button>
      </div>

      {/* Filters */}
      <div
        style={{
          background: 'var(--card-bg, #FFFFFF)',
          border: '1px solid var(--border-color, #E5E7EB)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: '1', minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Search by title, body, or course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #D1D5DB)',
              background: 'var(--bg, #F9FAFB)',
              color: 'var(--text-primary, #111827)',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ minWidth: '180px' }}>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(1)
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #D1D5DB)',
              background: 'var(--bg, #F9FAFB)',
              color: 'var(--text-primary, #111827)',
              fontSize: '14px',
            }}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table / List */}
      <div
        style={{
          background: 'var(--card-bg, #FFFFFF)',
          border: '1px solid var(--border-color, #E5E7EB)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary, #6B7280)' }}>
            Loading notification audit history...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary, #111827)' }}>No notification logs found</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-secondary, #6B7280)' }}>
              Automated notifications will appear here once triggered by background schedules or live sessions.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'var(--bg, #F9FAFB)', borderBottom: '1px solid var(--border-color, #E5E7EB)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary, #4B5563)' }}>Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary, #4B5563)' }}>Notification</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary, #4B5563)' }}>Course</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary, #4B5563)' }}>Recipients</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary, #4B5563)' }}>Channel</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary, #4B5563)' }}>Sent At</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const badge = getCategoryBadge(log.category)
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color, #F3F4F6)' }}>
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top', maxWidth: '380px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary, #111827)', marginBottom: '2px' }}>
                          {log.title}
                        </div>
                        <div style={{ color: 'var(--text-secondary, #4B5563)', fontSize: '13px', lineHeight: '1.4' }}>
                          {log.body}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary, #374151)', fontWeight: '500' }}>
                          {log.courseName || 'All Enrolled Users'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: 'var(--bg, #F3F4F6)',
                            color: 'var(--text-primary, #374151)',
                            fontSize: '12px',
                            fontWeight: '600',
                          }}
                        >
                          👥 {log.recipientCount} users
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary, #6B7280)' }}>
                          {log.channel}
                        </div>
                        {log.topicName && (
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary, #9CA3AF)', marginTop: '2px' }}>
                            Topic: {log.topicName}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary, #111827)' }}>
                          {relativeTime(log.createdAt)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary, #9CA3AF)', marginTop: '2px' }}>
                          {formatIST(log.createdAt, { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border-color, #E5E7EB)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg, #F9FAFB)',
            }}
          >
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #D1D5DB)',
                background: 'var(--card-bg, #FFFFFF)',
                fontSize: '13px',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary, #4B5563)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #D1D5DB)',
                background: 'var(--card-bg, #FFFFFF)',
                fontSize: '13px',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
