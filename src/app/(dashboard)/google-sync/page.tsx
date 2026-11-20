'use client'

import { useState } from 'react'
import useSWR from 'swr'

export default function GoogleSyncPage() {
  const [filters, setFilters] = useState({ status: '', action: '', page: 1 })
  const [refreshKey, setRefreshKey] = useState(0)

  const fetcher = (url: string) => fetch(url).then(r => r.json())
  const { data: authData } = useSWR('/api/auth/me', fetcher)
  const userRole = authData?.user?.role || ''

  // Sync Jobs Data
  const syncUrl = `/api/group-sync-jobs?status=${filters.status}&action=${filters.action}&page=${filters.page}&limit=50&_refresh=${refreshKey}`
  const { data: syncData, error: syncError } = useSWR(syncUrl, fetcher, {
    refreshInterval: 10000,
  })

  const [isResetting, setIsResetting] = useState(false)
  const [isRetryingFailed, setIsRetryingFailed] = useState(false)
  const [isClearingQueue, setIsClearingQueue] = useState(false)
  const [isProcessingSync, setIsProcessingSync] = useState(false)

  async function handleResetLock() {
    if (!confirm('Are you sure you want to reset the sync engine lock? Only do this if jobs have been stuck.')) return

    setIsResetting(true)
    try {
      const res = await fetch('/api/google-sync/reset-lock', { method: 'POST' })
      const text = await res.text()
      let data: any = {}
      try {
        data = JSON.parse(text)
      } catch (e) {
        throw new Error('Server operation timed out or returned an error.')
      }

      if (!res.ok) throw new Error(data.error || 'Failed to reset lock')

      setRefreshKey(prev => prev + 1)
      alert(data.message || 'Sync engine reset successfully.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsResetting(false)
    }
  }

  async function handleRetryFailed() {
    if (!confirm('Are you sure you want to reset and retry all FAILED sync jobs?')) return

    setIsRetryingFailed(true)
    try {
      const res = await fetch('/api/google-sync/retry-failed', { method: 'POST' })
      const text = await res.text()
      let data: any = {}
      try {
        data = JSON.parse(text)
      } catch (e) {
        throw new Error('Server operation timed out or returned an error.')
      }

      if (!res.ok) throw new Error(data.error || 'Failed to retry failed jobs')

      setRefreshKey(prev => prev + 1)
      alert(data.message || 'Failed sync jobs successfully re-queued!')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsRetryingFailed(false)
    }
  }

  async function handleClearQueue() {
    if (!confirm('Are you sure you want to CLEAR all sync jobs from the queue? This will remove all pending/failed jobs without running sync.')) return

    setIsClearingQueue(true)
    try {
      const res = await fetch('/api/google-sync/clear-queue', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clear queue')

      setRefreshKey(prev => prev + 1)
      alert(data.message || 'Sync queue cleared successfully!')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsClearingQueue(false)
    }
  }

  async function handleForceRunSyncEngine() {
    setIsProcessingSync(true)
    try {
      const res = await fetch('/api/google-sync/process?force=true', { method: 'POST' })
      const text = await res.text()
      let data: any = {}
      try {
        data = JSON.parse(text)
      } catch (e) {
        throw new Error('Server operation timed out or returned an error.')
      }

      if (!res.ok) throw new Error(data.error || 'Failed to process sync batch')

      setRefreshKey(prev => prev + 1)
      const errDetail = data.sampleError || data.error || ''
      alert(`Batch Processed! Processed ${data.processed || 0} jobs (${data.succeeded || 0} succeeded, ${data.failed || 0} failed).${errDetail ? `\n\nGoogle API Error: ${errDetail}` : ''}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsProcessingSync(false)
    }
  }

  function getErrorLabel(lastError?: string | null) {
    if (!lastError) return ''
    const normalized = lastError.toLowerCase()
    if (normalized.includes('resource not found') || normalized.includes('group not found') || normalized.includes('invalid input')) {
      return 'Google group not found or misconfigured'
    }
    if (normalized.includes('not authorized') || normalized.includes('insufficient permissions')) {
      return 'Google sync permissions are misconfigured'
    }
    return ''
  }

  if (authData && userRole !== 'MANAGER') {
    return (
      <div className="page-container fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ padding: '40px', textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Access Denied</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Only managers can access Google Sync monitoring.</div>
        </div>
      </div>
    )
  }

  const jobs = syncData?.jobs || []
  const pagination = syncData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 }

  const syncJobsPendingCount = syncData?.pendingCount || 0
  const syncJobsProcessingCount = syncData?.processingCount || 0
  const syncJobsFailedCount = syncData?.failedCount || 0
  const totalActiveQueueJobs = syncJobsPendingCount + syncJobsProcessingCount

  // ETA Calculation: ~1.5 sec rate-limited per Google Workspace API job
  const etaTotalSeconds = totalActiveQueueJobs * 1.5
  let formattedSyncETA = '0 sec (Queue clear)'
  if (totalActiveQueueJobs > 0) {
    if (etaTotalSeconds < 60) {
      formattedSyncETA = `~${Math.round(etaTotalSeconds)} sec`
    } else if (etaTotalSeconds < 3600) {
      formattedSyncETA = `~${Math.ceil(etaTotalSeconds / 60)} min(s)`
    } else {
      const hrs = Math.floor(etaTotalSeconds / 3600)
      const mins = Math.ceil((etaTotalSeconds % 3600) / 60)
      formattedSyncETA = `~${hrs} hr ${mins} min`
    }
  }

  return (
    <div className="page-container fade-in" style={{ paddingBottom: '40px' }}>
      {/* Sync Jobs Monitor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Stats Banner */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '11px', color: totalActiveQueueJobs > 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⏳ Pending Jobs in Queue
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: totalActiveQueueJobs > 0 ? '#f59e0b' : 'var(--text-primary)', marginTop: '4px' }}>
              {totalActiveQueueJobs.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '600' }}>jobs</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {totalActiveQueueJobs > 0 ? 'Queued background sync jobs' : 'Queue clear — all syncs complete!'}
            </div>
          </div>

          <div className="card" style={{ padding: '16px', background: 'var(--primary-light, #e0e7ff)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--primary, #4338ca)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⏱️ Estimated Time to Finish (ETA)
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--primary, #4338ca)', marginTop: '4px' }}>
              {formattedSyncETA}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--primary, #4338ca)', marginTop: '4px', opacity: 0.9 }}>
              Based on ~1.5s rate-limited processing per Google API quota
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '11px', color: syncJobsFailedCount > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ❌ Failed Jobs
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: syncJobsFailedCount > 0 ? 'var(--danger)' : 'var(--text-primary)', marginTop: '4px' }}>
              {syncJobsFailedCount.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '600' }}>jobs</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {syncJobsFailedCount > 0 ? 'Use "Retry All Failed Jobs" or "Clear Sync Queue"' : 'Zero errors'}
            </div>
          </div>
        </div>

        {/* Filter Controls & Action Buttons */}
        <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
              className="form-input"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
            </select>

            <select
              value={filters.action}
              onChange={e => setFilters(f => ({ ...f, action: e.target.value, page: 1 }))}
              className="form-input"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <option value="">All Actions</option>
              <option value="ADD">ADD (Add Member)</option>
              <option value="REMOVE">REMOVE (Remove Member)</option>
            </select>

            <button
              onClick={() => setRefreshKey(prev => prev + 1)}
              className="btn btn-sm btn-ghost"
              style={{ border: '1px solid var(--border)' }}
            >
              Refresh
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleForceRunSyncEngine}
              disabled={isProcessingSync}
              className="btn btn-sm"
              style={{ fontSize: '12px', background: 'var(--primary)', color: '#ffffff', border: 'none', fontWeight: 600 }}
            >
              {isProcessingSync ? 'Processing Batch...' : '▶️ Run 1 Batch Now'}
            </button>
            <button
              onClick={handleRetryFailed}
              disabled={isRetryingFailed}
              className="btn btn-sm"
              style={{ fontSize: '12px', background: 'var(--surface-3)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontWeight: '600' }}
            >
              {isRetryingFailed ? 'Re-queueing...' : '🔄 Retry Failed Jobs'}
            </button>
            <button
              onClick={handleClearQueue}
              disabled={isClearingQueue}
              className="btn btn-sm btn-outline-danger"
              style={{ fontSize: '12px' }}
            >
              {isClearingQueue ? 'Clearing...' : '🗑️ Clear Sync Queue'}
            </button>
            <button
              onClick={handleResetLock}
              disabled={isResetting}
              className="btn btn-sm btn-ghost"
              style={{ fontSize: '12px', border: '1px solid var(--border)' }}
            >
              {isResetting ? 'Resetting...' : '⚠️ Reset Lock'}
            </button>
          </div>
        </div>

        {/* Jobs Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {!syncData && !syncError ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading sync jobs...</div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No Sync Jobs In Queue</div>
              <div style={{ fontSize: '12px' }}>All background sync jobs have completed or queue is empty.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>User Email</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Group Email</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Action</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Attempts</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Last Error</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job: any) => {
                    const errLabel = getErrorLabel(job.lastError)
                    return (
                      <tr key={job.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '600' }}>{job.userEmail}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{job.groupEmail}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            fontWeight: 600,
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: job.action === 'ADD' ? 'var(--success-light)' : 'var(--danger-light)',
                            color: job.action === 'ADD' ? 'var(--success)' : 'var(--danger)',
                          }}>
                            {job.action}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            fontWeight: 600,
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: job.status === 'SUCCESS' ? 'var(--success-light)' : job.status === 'FAILED' ? 'var(--danger-light)' : 'var(--surface-3)',
                            color: job.status === 'SUCCESS' ? 'var(--success)' : job.status === 'FAILED' ? 'var(--danger)' : 'var(--text-secondary)',
                          }}>
                            {job.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{job.attemptCount} / 3</td>
                        <td style={{ padding: '12px 16px', color: 'var(--danger)', fontSize: '11px' }}>
                          {errLabel ? (
                            <div style={{ fontWeight: 600, color: 'var(--danger)' }}>{errLabel}</div>
                          ) : null}
                          {job.lastError || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11px' }}>
                          {new Date(job.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total jobs)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={filters.page <= 1}
                  onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                  className="btn btn-sm"
                  style={{ border: '1px solid var(--border)', fontSize: '12px' }}
                >
                  Previous
                </button>
                <button
                  disabled={filters.page >= pagination.totalPages}
                  onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                  className="btn btn-sm"
                  style={{ border: '1px solid var(--border)', fontSize: '12px' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
