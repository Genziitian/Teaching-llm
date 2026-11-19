'use client'

import { useState, useEffect, type ReactNode } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'
import UnpaidAttempts from '@/components/payments/UnpaidAttempts'
import PaymentsStorefrontPanel from '@/components/storefront/native/PaymentsStorefrontPanel'
import DiscountsSourceSwitch from '@/components/storefront/native/DiscountsSourceSwitch'

interface Transaction {
  id: string
  orderId: string
  razorpayOrderId: string
  razorpayPaymentId: string | null
  amount: number
  status: string
  createdAt: string
  isExternal?: boolean
  source?: 'GOOGLE_PLAY' | 'RAZORPAY'
  type?: string
  user: { id: string; name: string; email: string; mobileNumber: string | null }
  course: { id: string; name: string; subject: string | null }
  courses?: Array<{ id: string; name: string; subject: string | null; accessType?: string | null; price?: number }>
}

interface TransactionData {
  transactions: Transaction[]
  summary: { totalRevenue: number; totalSuccessful: number; totalRecords: number }
}

const FILTERS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7days', label: 'Last 7 Days' },
  { key: 'last30days', label: 'Last 30 Days' },
  { key: 'last3months', label: 'Last 3 Months' },
]

function ClassTransactionsPage({ sourceSwitch }: { sourceSwitch?: ReactNode } = {}) {
  const router = useRouter()
  const [data, setData] = useState<TransactionData | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingFact = useLoadingFact(loading)
  const [filter, setFilter] = useState('all')
  const [selectedTerm, setSelectedTerm] = useState('all')
  const [selectedExam, setSelectedExam] = useState('all')
  const [termsList, setTermsList] = useState<Array<{ id: string; name: string; termKey: string; year: number }>>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [view, setView] = useState<'paid' | 'unpaid'>('paid')
  const [onlyRefunded, setOnlyRefunded] = useState(false)
  const [isManager, setIsManager] = useState(false)
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setIsManager(d?.user?.role === 'MANAGER')).catch(() => {})
  }, [])

  // Only platform purchases (Order rows) can be marked refunded.
  const canRefund = (tx: Transaction) => isManager && tx.type === 'PURCHASE' && (tx.status === 'SUCCESS' || tx.status === 'REFUNDED')
  const toggleRefund = async (tx: Transaction) => {
    const refunded = tx.status === 'SUCCESS'
    let removeAccess = false
    if (refunded) {
      if (!window.confirm(`Mark ₹${tx.amount} from ${tx.user.name} as refunded?\n\nThis only records it here. Send the money back from Razorpay.`)) return
      removeAccess = window.confirm('Also remove this student\'s access to the course(s) from this order?\n\nOK = remove access, Cancel = keep access.')
    } else if (!window.confirm('Mark this order as paid again?')) return
    const res = await fetch('/api/transactions/refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tx.id, refunded, removeAccess }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { alert(d.error || 'Could not update'); return }
    setData(prev => prev ? { ...prev, transactions: prev.transactions.map(t => t.id === tx.id ? { ...t, status: d.status === 'PAID' ? 'SUCCESS' : d.status } : t) } : prev)
  }

  useEffect(() => {
    fetch('/api/manage/academic-terms')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.terms)) {
          setTermsList(d.terms)
        }
      })
      .catch(() => {})
  }, [])

  const getTransactionCourses = (tx: Transaction) => {
    return tx.courses && tx.courses.length > 0 ? tx.courses : [tx.course]
  }

  const formatCourseList = (tx: Transaction) => {
    const courses = getTransactionCourses(tx)
    const names = courses.map(course => course.name).filter(Boolean)
    return names.join(', ') || 'Unknown'
  }

  const fullCourseList = (tx: Transaction) => {
    return getTransactionCourses(tx).map(course => course.name).filter(Boolean).join(', ')
  }

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter) params.set('filter', filter)
    if (selectedTerm !== 'all') params.set('termId', selectedTerm)
    if (selectedExam !== 'all') params.set('examCycle', selectedExam)

    fetch(`/api/transactions?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filter, selectedTerm, selectedExam])

  const filteredTransactions = data?.transactions.filter(tx => {
    if (onlyRefunded && tx.status !== 'REFUNDED') return false
    const s = searchTerm.toLowerCase()
    const courseNames = getTransactionCourses(tx).map(course => course.name.toLowerCase()).join(' ')
    return (
      tx.orderId.toLowerCase().includes(s) ||
      tx.user.name.toLowerCase().includes(s) ||
      tx.user.email.toLowerCase().includes(s) ||
      courseNames.includes(s)
    )
  }) || []

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      SUCCESS: { bg: 'var(--success-light)', text: 'var(--success)' },
      PENDING: { bg: 'var(--warning-light)', text: 'var(--warning)' },
      FAILED: { bg: 'var(--danger-light)', text: 'var(--danger)' },
      REFUNDED: { bg: 'var(--surface-2)', text: 'var(--text-secondary)' },
    }
    const c = colors[status] || { bg: 'var(--surface)', text: 'var(--text-secondary)' }
    return (
      <span style={{
        background: c.bg, color: c.text, padding: '4px 12px',
        borderRadius: '14px', fontSize: '11px', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em'
      }}>
        {status === 'SUCCESS' ? '✓ ' : ''}{status}
      </span>
    )
  }

  const sourceBadge = (isExternal?: boolean, source?: string) => {
    const isExt = Boolean(isExternal)
    if (source === 'GOOGLE_PLAY') {
      return (
        <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.35)', padding: '3px 10px', borderRadius: '14px', fontSize: '10.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', letterSpacing: '0.04em' }}>
          ▶ GOOGLE PLAY
        </span>
      )
    }
    return (
      <span style={{
        background: isExt ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'rgba(16, 185, 129, 0.15)',
        color: isExt ? 'var(--primary)' : '#34d399',
        border: `1px solid ${isExt ? 'rgba(128, 128, 128, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
        padding: '3px 10px',
        borderRadius: '14px',
        fontSize: '10.5px',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        letterSpacing: '0.04em',
      }}>
        {isExt ? '🌐 EXTERNAL WEB' : '📱 IN-APP'}
      </span>
    )
  }

  const tabs = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
      {([['paid', 'Transactions'], ['unpaid', 'Unpaid attempts']] as const).map(([k, label]) => (
        <button key={k} onClick={() => setView(k)} style={{
          padding: '9px 18px', borderRadius: 999, border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: 13.5,
          background: view === k ? 'var(--primary)' : 'transparent', color: view === k ? '#fff' : 'var(--text-primary)',
        }}>{label}</button>
      ))}
    </div>
  )

  if (view === 'unpaid') {
    return (
      <div className="page-container fade-in">
        <h1 style={{ margin: '0 0 14px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>Transactions</h1>
        {sourceSwitch && <div style={{ marginBottom: 14 }}>{sourceSwitch}</div>}
        {tabs}
        <UnpaidAttempts />
      </div>
    )
  }

  return (
    <div className="page-container fade-in">
      <style>{`
        .mobile-back-header {
          display: none !important;
        }
        .mobile-tx-list {
          display: none;
        }
        @media (max-width: 767px) {
          .desktop-tx-table {
            display: none !important;
          }
          .mobile-back-header {
            display: flex !important;
          }
          .mobile-tx-list {
            display: flex !important;
          }
          .page-container {
            padding: 16px 14px 24px !important;
          }
        }
      `}</style>

      {/* Mobile-only Header with Back Button */}
      <div className="mobile-back-header" style={{
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        padding: '8px 4px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'var(--surface-2)',
            boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
            border: 'none',
            borderRadius: '50%',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            transition: 'transform 0.15s ease',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Outfit', 'Nunito', sans-serif", letterSpacing: '-0.3px' }}>
          Transactions
        </span>
      </div>

      {sourceSwitch && <div style={{ marginBottom: 14 }}>{sourceSwitch}</div>}
      {tabs}

      {/* Summary Cards */}
      {data?.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Total Revenue</div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--success)' }}>₹{data.summary.totalRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Successful</div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--accent)' }}>{data.summary.totalSuccessful}</div>
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Total Records</div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)' }}>{data.summary.totalRecords}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '8px 18px', borderRadius: '14px', fontSize: '13px', fontWeight: 600,
                border: filter === f.key ? '2px solid var(--primary)' : '2px solid var(--border)',
                background: filter === f.key ? 'var(--primary-light)' : 'white',
                color: filter === f.key ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: filter === f.key ? '0 4px 12px color-mix(in srgb, var(--primary) 20%, transparent)' : 'none'
              }}
            >
              {f.label}
            </button>
          ))}
          {isManager && (
            <button
              onClick={() => setOnlyRefunded(v => !v)}
              style={{
                padding: '8px 18px', borderRadius: '14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                border: onlyRefunded ? '2px solid var(--primary)' : '2px solid var(--border)',
                background: onlyRefunded ? 'var(--primary-light)' : 'white',
                color: onlyRefunded ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              Refunded only
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', flex: '1', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Search Order ID, Name or Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 20px 12px 48px',
              borderRadius: '50px',
              border: '2px solid var(--border)',
              background: 'var(--surface)',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              outline: 'none',
              boxShadow: 'inset 2px 2px 5px var(--border)',
              transition: 'all 0.3s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--surface-2)'}
          />
          <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        </div>
      </div>

      {/* Academic Term & Exam Stage Selectors */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
        padding: '12px 18px',
        background: 'var(--surface-2)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Term Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              Academic Term:
            </span>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                background: 'var(--surface)',
                border: selectedTerm !== 'all' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">All Academic Terms</option>
              {termsList.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Exam Stage Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              Exam Stage:
            </span>
            <select
              value={selectedExam}
              onChange={e => setSelectedExam(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                background: 'var(--surface)',
                border: selectedExam !== 'all' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">All Exam Stages</option>
              <option value="QUIZ_1">Quiz 1</option>
              <option value="QUIZ_2">Quiz 2</option>
              <option value="END_TERM">End Term</option>
              <option value="FULL_TERM">Full Term</option>
            </select>
          </div>
        </div>

        {(selectedTerm !== 'all' || selectedExam !== 'all') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>
              Filtering revenue by selected term / exam
            </span>
            <button
              type="button"
              onClick={() => { setSelectedTerm('all'); setSelectedExam('all') }}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '5px 12px',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Table & Card List Views */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          {loadingFact && (
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
              <LoadingFactCard fact={loadingFact} />
            </div>
          )}
          <div className="skeleton" style={{ height: '300px', borderRadius: '12px' }} />
        </div>
      ) : !filteredTransactions.length ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <h3 style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>No matching transactions</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Try a different search term or filter.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="card desktop-tx-table" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Course</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                    {isManager && <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Refund</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx, i) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                      <td style={{ padding: '14px 20px', fontSize: '11px', fontWeight: 600, color: 'var(--accent)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{tx.orderId}</td>
                      <td style={{ padding: '14px 20px' }}>{sourceBadge(tx.isExternal, tx.source)}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{tx.user.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tx.user.email}</div>
                      </td>
                      <td title={fullCourseList(tx)} style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', minWidth: '360px', whiteSpace: 'normal', lineHeight: 1.45 }}>{formatCourseList(tx)}</td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>₹{tx.amount.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '14px 20px' }}>{statusBadge(tx.status)}</td>
                      <td style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <br />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      {isManager && <td style={{ padding: '14px 20px' }}>{canRefund(tx) ? <button
                        type="button"
                        onClick={() => void toggleRefund(tx)}
                        style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid var(--border)', background: 'transparent', color: tx.status === 'REFUNDED' ? 'var(--text-secondary)' : 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: 'none', whiteSpace: 'nowrap' }}
                      >{tx.status === 'REFUNDED' ? 'Undo refund' : 'Refunded'}</button> : null}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="mobile-tx-list" style={{ flexDirection: 'column', gap: '14px' }}>
            {filteredTransactions.map(tx => (
              <div key={tx.id} style={{
                padding: '18px',
                borderRadius: '14px',
                background: 'var(--surface)',
                boxShadow: '0 8px 24px rgba(149, 157, 165, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                border: '1px solid rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {statusBadge(tx.status)}
                    {sourceBadge(tx.isExternal, tx.source)}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>₹{tx.amount.toLocaleString('en-IN')}</div>
                </div>
                {canRefund(tx) && <div><button
                        type="button"
                        onClick={() => void toggleRefund(tx)}
                        style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid var(--border)', background: 'transparent', color: tx.status === 'REFUNDED' ? 'var(--text-secondary)' : 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: 'none', whiteSpace: 'nowrap' }}
                      >{tx.status === 'REFUNDED' ? 'Undo refund' : 'Refunded'}</button></div>}

                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {fullCourseList(tx) || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {tx.orderId}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Student</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{tx.user.name}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '500', marginTop: '1px' }}>{tx.user.email}</div>
                  {tx.user.mobileNumber && (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '500', marginTop: '1px' }}>📞 {tx.user.mobileNumber}</div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '8px' }}>
                  <span>Date: <strong>{new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                  <span>Time: <strong>{new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const authFetcher = (url: string) => fetch(url).then(r => r.json())

/** Managers get a 'Class | Storefront payments' switch; everyone else sees class transactions as before. */
export default function TransactionsPage() {
  const { data: authData } = useSWR('/api/auth/me', authFetcher, { revalidateOnFocus: false })
  const [source, setSource] = useState<'class' | 'storefront'>('class')
  const isManager = authData?.user?.role === 'MANAGER'

  if (!isManager) return <ClassTransactionsPage />

  const sourceSwitch = (
    <DiscountsSourceSwitch<'class' | 'storefront'>
      value={source}
      onChange={setSource}
      options={[['class', 'Class'], ['storefront', 'Storefront payments']]}
    />
  )

  if (source === 'class') return <ClassTransactionsPage sourceSwitch={sourceSwitch} />

  return (
    <div className="page-container fade-in">
      <h1 style={{ margin: '0 0 14px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>Transactions</h1>
      <div style={{ marginBottom: 20 }}>{sourceSwitch}</div>
      <PaymentsStorefrontPanel />
    </div>
  )
}
