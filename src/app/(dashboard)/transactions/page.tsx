'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

interface Transaction {
  id: string
  orderId: string
  razorpayOrderId: string
  razorpayPaymentId: string | null
  amount: number
  status: string
  createdAt: string
  isExternal?: boolean
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

export default function TransactionsPage() {
  const router = useRouter()
  const [data, setData] = useState<TransactionData | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingFact = useLoadingFact(loading)
  const [filter, setFilter] = useState('all')
  const [selectedTerm, setSelectedTerm] = useState('all')
  const [selectedExam, setSelectedExam] = useState('all')
  const [termsList, setTermsList] = useState<Array<{ id: string; name: string; termKey: string; year: number }>>([])

  const [searchTerm, setSearchTerm] = useState('')

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
    if (names.length <= 2) return names.join(', ') || 'Unknown'
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
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
    }
    const c = colors[status] || { bg: 'var(--surface)', text: 'var(--text-secondary)' }
    return (
      <span style={{
        background: c.bg, color: c.text, padding: '4px 12px',
        borderRadius: '20px', fontSize: '11px', fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: '0.05em'
      }}>
        {status}
      </span>
    )
  }

  const sourceBadge = (isExternal?: boolean) => {
    const isExt = Boolean(isExternal)
    return (
      <span style={{
        background: isExt ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
        color: isExt ? '#818cf8' : '#34d399',
        border: `1px solid ${isExt ? 'rgba(99, 102, 241, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
        padding: '3px 10px',
        borderRadius: '14px',
        fontSize: '10.5px',
        fontWeight: '800',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        letterSpacing: '0.04em',
      }}>
        {isExt ? '🌐 EXTERNAL WEB' : '📱 IN-APP'}
      </span>
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
        <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', 'Nunito', sans-serif", letterSpacing: '-0.3px' }}>
          Upgrade Transactions
        </span>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>Total Revenue</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--success)' }}>₹{data.summary.totalRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>Successful</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--accent)' }}>{data.summary.totalSuccessful}</div>
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>Total Records</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>{data.summary.totalRecords}</div>
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
                padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: '700',
                border: filter === f.key ? '2px solid #6366f1' : '2px solid var(--border)',
                background: filter === f.key ? 'var(--primary-light)' : 'white',
                color: filter === f.key ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: filter === f.key ? '0 4px 12px rgba(99,102,241,0.2)' : 'none'
              }}
            >
              {f.label}
            </button>
          ))}
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
        borderRadius: '16px',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Term Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              Academic Term:
            </span>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                background: 'var(--surface)',
                border: selectedTerm !== 'all' ? '1.5px solid #6366f1' : '1px solid var(--border)',
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
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              Exam Stage:
            </span>
            <select
              value={selectedExam}
              onChange={e => setSelectedExam(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                background: 'var(--surface)',
                border: selectedExam !== 'all' ? '1.5px solid #6366f1' : '1px solid var(--border)',
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
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>
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
                fontWeight: 700,
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
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Course</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                    <th style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx, i) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                      <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '700', color: 'var(--accent)', fontFamily: 'monospace' }}>{tx.orderId}</td>
                      <td style={{ padding: '14px 20px' }}>{sourceBadge(tx.isExternal)}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{tx.user.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tx.user.email}</div>
                      </td>
                      <td title={fullCourseList(tx)} style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCourseList(tx)}</td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>₹{tx.amount.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '14px 20px' }}>{statusBadge(tx.status)}</td>
                      <td style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <br />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
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
                borderRadius: '20px',
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
                    {sourceBadge(tx.isExternal)}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{tx.amount.toLocaleString('en-IN')}</div>
                </div>

                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {formatCourseList(tx)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '700', fontFamily: 'monospace' }}>
                    {tx.orderId}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Student</div>
                  <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>{tx.user.name}</div>
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
