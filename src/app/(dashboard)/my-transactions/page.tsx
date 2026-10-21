'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

interface Transaction {
  id: string
  orderId: string
  amount: number
  status: string
  type: string
  source?: 'GOOGLE_PLAY' | 'RAZORPAY'
  createdAt: string
  courses: { id: string; name: string; subject: string | null }[]
}

export default function MyTransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const loadingFact = useLoadingFact(loading)

  useEffect(() => {
    fetch('/api/my-transactions')
      .then(r => r.json())
      .then(d => { setTransactions(d.transactions || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      SUCCESS: { bg: 'var(--success-light)', text: 'var(--success)' },
      PENDING: { bg: '#fef9c3', text: '#ca8a04' },
      FAILED: { bg: 'var(--danger-light)', text: 'var(--danger)' },
      CANCELLED: { bg: '#fff1d6', text: '#c77700' },
      STARTED: { bg: '#fff1d6', text: '#c77700' },
      TIMED_OUT: { bg: 'var(--surface)', text: 'var(--text-secondary)' },
      PENDING_VERIFY: { bg: '#e0efff', text: '#0a64c8' },
    }
    const labels: Record<string, string> = { STARTED: 'Waiting for payment', TIMED_OUT: 'Timed out', CANCELLED: 'Cancelled', PENDING_VERIFY: 'Confirming' }
    const c = colors[status] || { bg: 'var(--surface)', text: 'var(--text-secondary)' }
    return (
      <span style={{
        background: c.bg, color: c.text, padding: '4px 12px',
        borderRadius: '20px', fontSize: '11px', fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: '0.05em'
      }}>
        {labels[status] || status}
      </span>
    )
  }

  const typeBadge = (type: string) => {
    const isUpgrade = type === 'UPGRADE'
    return (
      <span style={{
        background: isUpgrade ? 'var(--primary-light)' : 'var(--success-light)',
        color: isUpgrade ? 'var(--primary-dark)' : 'var(--success)',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '10px',
        fontWeight: '700',
        textTransform: 'uppercase',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        border: `1px solid ${isUpgrade ? 'var(--border)' : 'var(--success-light)'}`,
        marginBottom: '6px'
      }}>
        {isUpgrade ? (
          <>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            Upgraded
          </>
        ) : (
          <>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Purchased
          </>
        )}
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
          .desktop-tx-list {
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
          My Transactions
        </span>
      </div>

      {loading ? (
        <div>
          {loadingFact && (
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
              <LoadingFactCard fact={loadingFact} />
            </div>
          )}
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <div className="skeleton" style={{ height: '200px', borderRadius: '12px' }} />
          </div>
        </div>
      ) : !transactions.length ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>No transaction history yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>When you purchase a course or upgrade to PRO, your transaction will appear here.</p>
        </div>
      ) : (
        <>
          {/* Desktop Card List View */}
          <div className="desktop-tx-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {transactions.map(tx => (
              <div key={tx.id} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  {typeBadge(tx.type)}
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {tx.courses && tx.courses.length > 0 ? tx.courses.map(c => c.name).join(', ') : 'Unknown Course'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '700', fontFamily: 'monospace' }}>{tx.orderId}{tx.source === 'GOOGLE_PLAY' ? <span style={{ marginLeft: 8, fontFamily: 'inherit', fontSize: '10.5px', fontWeight: 800, color: '#3b82f6', background: 'rgba(59,130,246,0.12)', padding: '2px 8px', borderRadius: 12 }}>▶ Google Play</span> : <span style={{ marginLeft: 8, fontFamily: 'inherit', fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: 12 }}>Razorpay</span>}</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: '80px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>₹{tx.amount}</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: '100px' }}>
                  {statusBadge(tx.status)}
                </div>
                <div style={{ textAlign: 'right', minWidth: '120px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Card List View */}
          <div className="mobile-tx-list" style={{ flexDirection: 'column', gap: '14px' }}>
            {transactions.map(tx => (
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
                  {statusBadge(tx.status)}
                  <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{tx.amount}</div>
                </div>

                <div>
                  <div style={{ marginBottom: '4px' }}>
                    {typeBadge(tx.type)}
                  </div>
                  <div style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {tx.courses && tx.courses.length > 0 ? tx.courses.map(c => c.name).join(', ') : 'Unknown Course'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '700', fontFamily: 'monospace' }}>
                    {tx.orderId}
                    {tx.source === 'GOOGLE_PLAY' ? <span style={{ marginLeft: 8, fontFamily: 'inherit', fontSize: '10.5px', fontWeight: 800, color: '#3b82f6', background: 'rgba(59,130,246,0.12)', padding: '2px 8px', borderRadius: 12 }}>▶ Google Play</span> : <span style={{ marginLeft: 8, fontFamily: 'inherit', fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: 12 }}>Razorpay</span>}
                  </div>
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
