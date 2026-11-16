'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { sfManagerFetch, sfWrite } from './DiscountsStorefrontApi'

const FILTERS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'custom', label: 'Custom' },
  { id: 'not-purchased', label: 'Just Created' },
  { id: 'abandoned', label: 'Abandoned' },
]

const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-primary)' }

const statusColors: Record<string, [string, string]> = {
  PAID: ['var(--success-light)', 'var(--success)'],
  FAILED: ['var(--danger-light)', 'var(--danger)'],
  NOT_PURCHASED: ['var(--surface)', 'var(--text-muted)'],
}

const emptyStats = { totalEarned: 0, totalUsers: 0, abandonedCount: 0, potentialMoney: 0 }

/** Storefront website_orders payments, shown natively inside class genz (manager only). */
export default function PaymentsStorefrontPanel() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [orders, setOrders] = useState<any[]>([])
  const [stats, setStats] = useState(emptyStats)
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showAmounts, setShowAmounts] = useState(true)
  const seq = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    sfManagerFetch<any[]>({ tab: 'courses' }).then(c => setCourses(Array.isArray(c) ? c : [])).catch(() => {})
  }, [])

  const rangeReady = filter !== 'custom' || (!!from && !!to)

  const load = useCallback(async () => {
    const mine = ++seq.current
    setLoading(true)
    setError('')
    try {
      if (!rangeReady) {
        setOrders([])
        setStats(emptyStats)
        return
      }
      const range: Record<string, string> = filter === 'custom' ? { from, to } : {}
      const statsFilter = ['today', 'yesterday', 'custom', 'all'].includes(filter) ? filter : 'all'
      const [list, statSrc] = await Promise.all([
        sfManagerFetch<any[]>({ tab: 'payments', filter, search, ...range }),
        sfManagerFetch<any[]>({ tab: 'payments', filter: statsFilter, ...range }).catch(() => [] as any[]),
      ])
      if (mine !== seq.current) return
      setOrders(Array.isArray(list) ? list : [])
      const src = Array.isArray(statSrc) ? statSrc : []
      const paid = src.filter(o => o.status === 'PAID')
      const created = src.filter(o => o.status === 'CREATED')
      setStats({
        totalEarned: paid.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
        totalUsers: new Set(src.map(o => String(o.user_email || '').toLowerCase()).filter(Boolean)).size,
        abandonedCount: created.length,
        potentialMoney: created.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
      })
    } catch (e: any) {
      if (mine !== seq.current) return
      setError(e?.message || 'Could not load storefront payments.')
      setOrders([])
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [filter, search, from, to, rangeReady])

  useEffect(() => { load() }, [load])

  const courseName = useMemo(() => {
    const m = new Map<string, string>(courses.map((c: any) => [c.id, c.name]))
    return (id: string) => m.get(id) || (/[-_]/.test(id) ? id.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : id)
  }, [courses])

  const exportCsv = () => {
    const headers = ['Order ID', 'Name', 'Email', 'Phone', 'Courses', 'Amount', 'Status', 'Date']
    const rows = orders.map(o => [
      o?.order_id || '', o?.user_name || '', o?.user_email || '', o?.user_phone || '',
      Array.isArray(o?.course_ids) ? o.course_ids.filter(Boolean).map((id: any) => courseName(String(id))).join('; ') : '',
      o?.total_amount || 0, o?.status || '', o?.created_at ? new Date(o.created_at).toISOString() : '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `storefront_payments_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const remove = async (o: any) => {
    const ok = await confirm({
      title: 'Delete this payment record?',
      message: `Order ${o.order_id} will be permanently removed from the storefront. This can't be undone.`,
      confirmLabel: 'Delete record',
      tone: 'danger',
    })
    if (!ok) return
    const res = await sfWrite('website_orders', [{ m: 'delete', a: [] }, { m: 'eq', a: ['order_id', o.order_id] }])
    if (res.error) alert(res.error.message)
    load()
  }

  const money = (n: number) => (showAmounts ? `₹${n.toLocaleString('en-IN')}` : '₹ ••••••')
  const cards: Array<[string, string, string, string]> = [
    ['Total Earned', money(stats.totalEarned), 'Paid orders only', 'var(--success)'],
    ['Total Users', stats.totalUsers.toLocaleString('en-IN'), 'Unique emails in range', 'var(--info)'],
    ['Abandoned', stats.abandonedCount.toLocaleString('en-IN'), 'Created checkouts', 'var(--warning)'],
    ['Potential Money', money(stats.potentialMoney), 'From created (unpaid)', 'var(--danger)'],
  ]
  const th: React.CSSProperties = { padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'left', letterSpacing: '0.04em' }
  const td: React.CSSProperties = { padding: '14px 16px', fontSize: 13, color: 'var(--text-primary)', verticalAlign: 'top' }
  const btn: React.CSSProperties = { ...inputStyle, cursor: 'pointer', fontSize: 13 }

  return (
    <div>
      {confirmDialog}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16, marginBottom: 20 }}>
        {cards.map(([label, value, hint, color]) => (
          <div key={label} className="card" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search by name, email, phone, or order ID…" style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
        <button onClick={() => setShowAmounts(v => !v)} style={btn}>{showAmounts ? 'Hide amounts' : 'Show amounts'}</button>
        <button onClick={load} style={btn}>{loading ? 'Syncing…' : 'Sync'}</button>
        <button onClick={exportCsv} disabled={!orders.length} style={{ ...btn, background: 'var(--primary)', color: '#fff', border: 'none', opacity: orders.length ? 1 : 0.6 }}>Export CSV</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, background: filter === f.id ? 'var(--primary)' : 'transparent', color: filter === f.id ? '#fff' : 'var(--text-primary)' }}>{f.label}</button>
        ))}
      </div>

      {filter === 'custom' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>From <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} style={inputStyle} /></label>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>To <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} style={inputStyle} /></label>
          {!rangeReady && <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>Select both dates to load stats & orders.</span>}
        </div>
      )}

      {error ? (
        <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: 16, fontSize: 14, color: 'var(--text-secondary)' }}>{error}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
              <thead style={{ borderBottom: '1px solid var(--border)' }}>
                <tr>{['Order', 'Courses', 'Amount', 'Status', 'Date', 'Actions'].map(h => <th key={h} style={h === 'Actions' ? { ...th, textAlign: 'right' } : th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ ...td, textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading storefront payments...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...td, textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>{!rangeReady ? 'Pick a from and to date to see payments' : 'No payments found'}</td></tr>
                ) : orders.map((o, i) => {
                  const [bg, fg] = statusColors[o?.status] || ['var(--warning-light)', 'var(--warning)']
                  return (
                    <tr key={o?.order_id || o?.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={td}>
                        <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{o?.user_name || o?.user_email || 'Unknown User'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{o?.user_email || 'No email'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o?.user_phone || 'No phone'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{o?.order_id || ''}</div>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {Array.isArray(o?.course_ids) && o.course_ids.some(Boolean) ? o.course_ids.filter(Boolean).map((cid: any, k: number) => (
                            <span key={k} style={{ padding: '2px 8px', background: 'var(--info-light)', color: 'var(--info)', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{courseName(String(cid))}</span>
                          )) : <span style={{ color: 'var(--text-muted)' }}>No courses</span>}
                        </div>
                      </td>
                      <td style={{ ...td, fontWeight: 800, color: 'var(--success)' }}>₹{o?.total_amount ?? 0}</td>
                      <td style={td}>
                        <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {typeof o?.status === 'string' ? o.status.replace('_', ' ') : 'PENDING'}
                        </span>
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {o?.created_at ? new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {o?.order_id && !String(o.order_id).startsWith('LEAD_') && (
                          <button onClick={() => remove(o)} title="Delete payment record" aria-label="Delete payment record" style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--danger-light)', border: '1px solid var(--border)', color: 'var(--danger)', cursor: 'pointer' }}>🗑️</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
