'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Coins, Download, Gift, IndianRupee, Loader2, RefreshCw, Search, Tag, X } from 'lucide-react'
import PageShell from '../PageShell'
import { sfManagerFetch } from './DiscountsStorefrontApi'

export interface ReferralTransaction {
  id: string
  order_id?: string | null
  buyer_email?: string | null
  referrer_email?: string | null
  referral_code?: string | null
  original_price?: number | null
  buyer_discount?: number | null
  final_price?: number | null
  referrer_reward?: number | null
  created_at?: string | null
}

const spin: React.CSSProperties = { animation: 'spin 1s linear infinite' }
const th: React.CSSProperties = { padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'left', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '14px 16px', fontSize: 13, color: 'var(--text-primary)', verticalAlign: 'top' }

const num = (v: unknown) => Number(v) || 0
const rupees = (v: unknown) => `₹${num(v).toLocaleString('en-IN')}`
const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'

function exportCsv(rows: ReferralTransaction[]) {
  const headers = ['Order ID', 'Buyer Email', 'Referrer Code', 'Referrer Email', 'Original Price', 'Buyer Discount', 'Final Paid', 'Referrer Reward', 'Date']
  const body = rows.map((tx) => [
    tx.order_id || '',
    tx.buyer_email || '',
    tx.referral_code || '',
    tx.referrer_email || '',
    num(tx.original_price),
    num(tx.buyer_discount),
    num(tx.final_price),
    num(tx.referrer_reward),
    tx.created_at ? new Date(tx.created_at).toISOString() : '',
  ])
  const csv = [headers, ...body].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `referrals_export_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Native Referrals: storefront referral purchases (referral_transactions) and the rewards they earned. */
export default function ReferralsManager() {
  const [rows, setRows] = useState<ReferralTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const seq = useRef(0)
  const loaded = useRef(false)

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    const mine = ++seq.current
    if (loaded.current) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = { tab: 'referrals', filter: 'all' }
      if (search) params.search = search
      const data = await sfManagerFetch<ReferralTransaction[]>(params)
      if (mine !== seq.current) return
      setRows(Array.isArray(data) ? data : [])
      loaded.current = true
    } catch (e: any) {
      if (mine !== seq.current) return
      setError(e?.message || 'Could not load referrals')
    } finally {
      if (mine === seq.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => ({
    count: rows.length,
    codes: new Set(rows.map((r) => String(r.referral_code || '').toUpperCase()).filter(Boolean)).size,
    paid: rows.reduce((s, r) => s + num(r.final_price), 0),
    discount: rows.reduce((s, r) => s + num(r.buyer_discount), 0),
    rewards: rows.reduce((s, r) => s + num(r.referrer_reward), 0),
  }), [rows])

  const cards: Array<{ label: string; value: string; hint: string; tone: string; icon: React.ReactNode }> = [
    { label: 'Referral purchases', value: stats.count.toLocaleString('en-IN'), hint: `${stats.codes} referral ${stats.codes === 1 ? 'code' : 'codes'} used`, tone: 'primary', icon: <Gift size={15} /> },
    { label: 'Revenue', value: rupees(stats.paid), hint: 'Final amount paid by buyers', tone: 'success', icon: <IndianRupee size={15} /> },
    { label: 'Buyer discounts', value: rupees(stats.discount), hint: 'Given through referral codes', tone: 'info', icon: <Tag size={15} /> },
    { label: 'Rewards earned', value: `${stats.rewards.toLocaleString('en-IN')} coins`, hint: 'Credited to referrers', tone: 'warning', icon: <Coins size={15} /> },
  ]

  const actions = (
    <>
      <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading || refreshing} title="Reload from database">
        <RefreshCw size={14} style={refreshing ? spin : undefined} /> Sync
      </button>
      <button className="btn btn-primary btn-sm" onClick={() => exportCsv(rows)} disabled={loading || rows.length === 0}>
        <Download size={14} /> Export CSV
      </button>
    </>
  )

  return (
    <PageShell title="Referrals" description="Purchases made with a referral code, the buyer discount and the referrer’s reward." actions={actions}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: 12 }}>
          {cards.map((c) => (
            <div key={c.label} className="card" style={{ padding: 18, borderLeft: `4px solid var(--${c.tone})`, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: `var(--${c.tone})` }}>{c.label}</span>
                <span style={{ width: 30, height: 30, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `var(--${c.tone}-light)`, color: `var(--${c.tone})`, flexShrink: 0 }}>{c.icon}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{loading ? '—' : c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.hint}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 14px' }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by buyer email, referrer email or referral code…"
            aria-label="Search referrals"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, padding: '8px 0' }}
          />
          {refreshing && <Loader2 size={14} style={{ ...spin, color: 'var(--text-muted)' }} />}
          {searchInput && (
            <button onClick={() => setSearchInput('')} aria-label="Clear search" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><X size={14} /></button>
          )}
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderRadius: 12, padding: '12px 14px', fontSize: 13, background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={load} className="btn btn-secondary btn-sm">Retry</button>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead style={{ borderBottom: '1px solid var(--border)' }}>
                <tr>
                  {['Buyer', 'Referrer code', 'Original', 'Discount', 'Final paid', 'Reward', 'Date'].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading referrals…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>{search ? 'No referrals match your search' : 'No referral transactions yet'}</td></tr>
                ) : rows.map((tx, i) => (
                  <tr key={tx.id || tx.order_id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{tx.buyer_email || 'Unknown buyer'}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{tx.order_id || ''}</div>
                    </td>
                    <td style={td}>
                      {tx.referral_code ? (
                        <span className="badge badge-primary" style={{ borderRadius: 6, fontFamily: 'monospace' }}>{tx.referral_code}</span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      {tx.referrer_email && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, wordBreak: 'break-all' }}>{tx.referrer_email}</div>}
                    </td>
                    <td style={{ ...td, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{rupees(tx.original_price)}</td>
                    <td style={{ ...td, color: 'var(--success)', fontWeight: 600, whiteSpace: 'nowrap' }}>-{rupees(tx.buyer_discount)}</td>
                    <td style={{ ...td, fontWeight: 800, whiteSpace: 'nowrap' }}>{rupees(tx.final_price)}</td>
                    <td style={td}>
                      <span className="badge badge-warning" style={{ borderRadius: 6, whiteSpace: 'nowrap' }}>+{num(tx.referrer_reward).toLocaleString('en-IN')} Coins</span>
                    </td>
                    <td style={{ ...td, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {!loading && rows.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
            {rows.length.toLocaleString('en-IN')} {rows.length === 1 ? 'transaction' : 'transactions'}
          </div>
        )}
      </div>
    </PageShell>
  )
}
