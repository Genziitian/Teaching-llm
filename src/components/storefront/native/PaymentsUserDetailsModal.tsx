'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './storefrontDb'

export type PaymentsBuyer = {
  email: string
  name?: string | null
  phone?: string | null
  created_at?: string | null
}

type Props = {
  buyer: PaymentsBuyer | null
  courseName: (id: string) => string
  onClose: () => void
}

const digits = (s?: string | null) => String(s || '').replace(/\D/g, '')

/** WhatsApp number in international format (defaults to +91 for 10-digit numbers). */
export const paymentsWaNumber = (phone?: string | null) => {
  const d = digits(phone)
  if (d.length === 10) return `91${d}`
  if (d.length === 12 && d.startsWith('91')) return d
  return d.length >= 10 ? d : ''
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }
const section: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }
const sectionHead: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }
const copyBtn: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '2px 4px', flexShrink: 0 }
const actionBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }

/** Buyer details (profile, orders, referrals, coin wallet) opened from a storefront payment row. */
export default function PaymentsUserDetailsModal({ buyer, courseName, onClose }: Props) {
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [referrals, setReferrals] = useState<any[]>([])
  const [wallet, setWallet] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [mounted, setMounted] = useState(false)
  const seq = useRef(0)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!buyer) return
    const mine = ++seq.current
    setProfile(null)
    setOrders([])
    setReferrals([])
    setWallet(null)
    setError('')
    if (!buyer.email) { setLoading(false); return }
    setLoading(true)
    const email = buyer.email
    Promise.all([
      supabase.from('website_orders').select('*').eq('user_email', email).order('created_at', { ascending: false }),
      supabase.from('referral_transactions').select('*').eq('referrer_email', email).order('created_at', { ascending: false }),
      supabase.from('referral_profiles').select('*').eq('email', email).limit(1),
      supabase.from('profiles').select('*').eq('email', email).limit(1),
    ])
      .then(([o, r, w, p]: any[]) => {
        if (mine !== seq.current) return
        const firstErr = [o, r, w, p].find((x) => x?.error)?.error
        if (firstErr) setError(firstErr.message || 'Some user details could not be loaded.')
        setOrders(Array.isArray(o?.data) ? o.data : [])
        setReferrals(Array.isArray(r?.data) ? r.data : [])
        setWallet(Array.isArray(w?.data) ? w.data[0] || null : null)
        setProfile(Array.isArray(p?.data) ? p.data[0] || null : null)
      })
      .catch((e: any) => { if (mine === seq.current) setError(e?.message || 'Could not load user details.') })
      .finally(() => { if (mine === seq.current) setLoading(false) })
  }, [buyer])

  useEffect(() => {
    if (!buyer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [buyer, onClose])

  if (!buyer || !mounted) return null

  const name = buyer.name || profile?.name || buyer.email || 'Anonymous user'
  const email = buyer.email || profile?.email || ''
  const phone = buyer.phone || profile?.phone || ''
  const joined = buyer.created_at || profile?.created_at || null
  const wa = paymentsWaNumber(phone)
  const paid = orders.filter((o) => o.status === 'PAID')
  const totalSpent = paid.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
  const earned = referrals.reduce((s, r) => s + (Number(r.referrer_reward) || 0), 0)

  const copy = (key: string, value: string) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1200)
    }).catch(() => {})
  }

  const stats: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['Orders', orders.length, `${paid.length} paid`],
    ['Total spent', `₹${totalSpent.toLocaleString('en-IN')}`, 'Paid orders'],
    ['Referrals', referrals.length, wallet?.referral_code ? <>Code <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{wallet.referral_code}</span></> : 'No code'],
    ['Coin wallet', `${Number(wallet?.wallet_balance) || 0} coins`, `Earned ${earned}`],
  ]

  const modal = (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`User details: ${name}`} style={{ maxWidth: 'min(1000px, calc(100vw - 32px))' }}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{[email, phone].filter(Boolean).join(' · ')}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ padding: '56px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>Loading user data…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: 16 }}>
                {error && (
                  <div style={{ border: '1px solid var(--border)', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{error}</div>
                )}
                <div style={{ ...section, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                      {(name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{joined ? `Joined ${fmtDate(joined)}` : 'Join date unknown'}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, display: 'grid', gap: 12, fontSize: 14 }}>
                    <div>
                      <div style={label}>Email</div>
                      <div style={{ marginTop: 2, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{email || '—'}</span>
                        {email && <button type="button" style={copyBtn} onClick={() => copy('email', email)}>{copied === 'email' ? 'Copied' : 'Copy'}</button>}
                      </div>
                    </div>
                    <div>
                      <div style={label}>Phone</div>
                      <div style={{ marginTop: 2, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 13 }}>{phone || '—'}</span>
                        {phone && <button type="button" style={copyBtn} onClick={() => copy('phone', phone)}>{copied === 'phone' ? 'Copied' : 'Copy'}</button>}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {wa ? (
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" style={{ ...actionBtn, background: 'var(--success)', color: '#fff' }}>WhatsApp</a>
                    ) : (
                      <span style={{ ...actionBtn, background: 'var(--bg, transparent)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>No number</span>
                    )}
                    {email ? (
                      <a href={`mailto:${email}`} style={{ ...actionBtn, background: 'var(--primary)', color: '#fff' }}>Email</a>
                    ) : (
                      <span style={{ ...actionBtn, background: 'var(--bg, transparent)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>No email</span>
                    )}
                  </div>
                </div>

                <div style={{ ...section, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  {stats.map(([k, v, hint], i) => (
                    <div key={k} style={{ padding: 14, borderLeft: i % 2 ? '1px solid var(--border)' : undefined, borderTop: i > 1 ? '1px solid var(--border)' : undefined }}>
                      <div style={label}>{k}</div>
                      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
                <div style={section}>
                  <div style={sectionHead}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Order history</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{orders.length} total</span>
                  </div>
                  {orders.length === 0 ? (
                    <p style={{ margin: 0, padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No orders found.</p>
                  ) : orders.map((o, i) => (
                    <div key={o.order_id || o.id || i} style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : undefined, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 120, flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtDate(o.created_at)}</div>
                        <div title={o.order_id} style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.order_id}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 140, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {Array.isArray(o.course_ids) && o.course_ids.some(Boolean) ? o.course_ids.filter(Boolean).map((cid: any, k: number) => (
                          <span key={k} style={{ padding: '2px 8px', background: 'var(--info-light)', color: 'var(--info)', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{courseName(String(cid))}</span>
                        )) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>₹{o.total_amount ?? 0}</div>
                        <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: o.status === 'PAID' ? 'var(--success-light)' : 'var(--warning-light)', color: o.status === 'PAID' ? 'var(--success)' : 'var(--warning)' }}>
                          {typeof o.status === 'string' ? o.status.replace('_', ' ') : 'PENDING'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={section}>
                  <div style={sectionHead}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Referral activity</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{referrals.length} total</span>
                  </div>
                  {referrals.length === 0 ? (
                    <p style={{ margin: 0, padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No referrals yet.</p>
                  ) : referrals.map((r, i) => (
                    <div key={r.id || i} style={{ padding: '10px 16px', borderTop: i ? '1px solid var(--border)' : undefined, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{r.buyer_email || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</div>
                      <div style={{ width: 56, textAlign: 'right', fontSize: 13, fontWeight: 800, color: 'var(--warning)' }}>+{Number(r.referrer_reward) || 0}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
