'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Download, Loader2, Mail, MessageCircle, RefreshCw, Search } from 'lucide-react'
import { supabase } from './storefrontDb'
import { LoadNotice } from '../PageShell'

type User = Record<string, any> & { _roles: string[]; _search: string }

const PAGE = 1000
const SHOW_STEP = 100
const fold = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '')
const waNumber = (phone?: string | null) => {
  const d = digits(phone)
  if (d.length === 10) return `91${d}`
  return d.length >= 10 ? d : ''
}
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

async function fetchAll(table: string, select: string, order?: string) {
  const rows: any[] = []
  for (let from = 0; ; from += PAGE) {
    let q: any = supabase.from(table).select(select).range(from, from + PAGE - 1)
    if (order) q = q.order(order, { ascending: false })
    const { data, error } = await q
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

const pill = (on: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
  border: '1px solid var(--border)', boxShadow: 'none',
  background: on ? 'var(--gz-ink, var(--primary))' : 'transparent', color: on ? 'var(--gz-ink-inv, #000)' : 'var(--text-secondary)',
})
const th: React.CSSProperties = { padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'left', letterSpacing: '0.05em' }
const td: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', verticalAlign: 'middle' }
const sel: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13 }

type Role = 'all' | 'employee' | 'applicant' | 'referrer'
const DAY = 86400000

export default function UsersManager() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const [role, setRole] = useState<Role>('all')
  const [phone, setPhone] = useState<'all' | 'has' | 'none'>('all')
  const [joined, setJoined] = useState<'all' | '7d' | '30d'>('all')
  const [limit, setLimit] = useState(SHOW_STEP)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [profiles, refs, emps, apps] = await Promise.all([
        fetchAll('profiles', '*', 'created_at'),
        fetchAll('referral_profiles', 'email, referral_code').catch(() => []),
        fetchAll('employees', 'email, employee_id, role, department').catch(() => []),
        fetchAll('job_applications', 'email, role_title').catch(() => []),
      ])
      const set = (rows: any[]) => new Set(rows.map(r => fold(r.email).trim()).filter(Boolean))
      const refSet = set(refs), empSet = set(emps), appSet = set(apps)
      setUsers(profiles.map((p: any) => {
        const k = fold(p.email).trim()
        const _roles = [String(p.role || 'STUDENT').toUpperCase(), empSet.has(k) && 'EMPLOYEE', appSet.has(k) && 'APPLICANT', refSet.has(k) && 'REFERRER'].filter(Boolean) as string[]
        return { ...p, _roles, _search: [p.name, p.email, digits(p.phone), p.phone, ..._roles].map(fold).join(' ') }
      }))
    } catch (e: any) {
      setError(e?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const tokens = fold(q).split(/\s+/).filter(Boolean)
    const now = Date.now()
    return users.filter(u => {
      if (tokens.some(t => !u._search.includes(t))) return false
      if (role !== 'all' && !u._roles.includes(role.toUpperCase())) return false
      if (phone === 'has' && !digits(u.phone)) return false
      if (phone === 'none' && digits(u.phone)) return false
      if (joined !== 'all') {
        const t = u.created_at ? new Date(u.created_at).getTime() : 0
        if (now - t > (joined === '7d' ? 7 : 30) * DAY) return false
      }
      return true
    })
  }, [users, q, role, phone, joined])

  const stats = useMemo(() => {
    const now = Date.now()
    return [
      ['Total', users.length],
      ['New · 7 days', users.filter(u => u.created_at && now - new Date(u.created_at).getTime() <= 7 * DAY).length],
      ['With phone', users.filter(u => digits(u.phone)).length],
      ['No number', users.filter(u => !digits(u.phone)).length],
    ] as [string, number][]
  }, [users])

  const exportCsv = () => {
    const rows = [['Name', 'Email', 'Phone', 'Gender', 'Joined'], ...filtered.map(u => [u.name, u.email, u.phone, u.gender, u.created_at ? new Date(u.created_at).toLocaleString() : ''])]
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div style={{ width: '100%', display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-secondary" onClick={load} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Refresh
        </button>
        <button className="btn btn-primary" onClick={exportCsv} disabled={!filtered.length} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {error && <LoadNotice error={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {stats.map(([label, n]) => (
          <div key={label} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{n}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setLimit(SHOW_STEP) }}
          placeholder="Search name, email, phone"
          style={{ width: '100%', padding: '11px 14px 11px 40px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'employee', 'applicant', 'referrer'] as Role[]).map(r => (
          <button key={r} style={pill(role === r)} onClick={() => { setRole(r); setLimit(SHOW_STEP) }}>
            {r === 'all' ? 'All' : r[0].toUpperCase() + r.slice(1) + 's'}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <select style={sel} value={phone} onChange={e => setPhone(e.target.value as any)}>
          <option value="all">Phone: any</option><option value="has">Has phone</option><option value="none">No phone</option>
        </select>
        <select style={sel} value={joined} onChange={e => setJoined(e.target.value as any)}>
          <option value="all">Joined: any time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} / {users.length}</span>
      </div>

      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={th}>Name</th><th style={th}>Email</th><th style={th}>Phone</th><th style={th}>Joined</th><th style={th} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...td, textAlign: 'center', padding: 40 }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ ...td, textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No users match</td></tr>
            ) : filtered.slice(0, limit).map((u, i) => (
              <tr key={u.id || u.email || i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{u.name || '-'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u._roles.join(' · ')}</div>
                </td>
                <td style={td}>{u.email}</td>
                <td style={td}>{u.phone || '-'}</td>
                <td style={{ ...td, color: 'var(--text-muted)' }}>{fmtDate(u.created_at)}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {waNumber(u.phone) && <a href={`https://wa.me/${waNumber(u.phone)}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ color: 'var(--text-secondary)', marginRight: 10 }}><MessageCircle size={16} /></a>}
                  {u.email && <a href={`mailto:${u.email}`} title="Email" style={{ color: 'var(--text-secondary)' }}><Mail size={16} /></a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > limit && (
        <button className="btn btn-secondary" onClick={() => setLimit(l => l + SHOW_STEP)} style={{ justifySelf: 'center' }}>Show more</button>
      )}
    </div>
  )
}
