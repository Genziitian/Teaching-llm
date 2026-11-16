'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { sfManagerFetch, sfWrite } from './DiscountsStorefrontApi'

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.04em' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, fontWeight: 600, boxSizing: 'border-box', outline: 'none' }

type Form = {
  id?: string
  code: string
  valueType: 'percentage' | 'amount'
  value: string
  maxDiscount: string
  appliesTo: string
  forWhom: 'all' | 'specific'
  emails: string
  startDate: string
  expiresAt: string
  maxUses: string
  minOrder: string
  firstPurchaseOnly: boolean
  singleUsePerUser: boolean
  hidden: boolean
  active: boolean
}

const emptyForm: Form = {
  code: '', valueType: 'percentage', value: '', maxDiscount: '', appliesTo: 'ALL', forWhom: 'all', emails: '',
  startDate: '', expiresAt: '', maxUses: '', minOrder: '', firstPurchaseOnly: false, singleUsePerUser: true, hidden: false, active: true,
}

const toLocal = (v?: string | null) => {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const formFromDiscount = (d: any): Form => ({
  id: d.id,
  code: d.code || '',
  valueType: d.discount_amount ? 'amount' : 'percentage',
  value: String(d.discount_amount || d.discount_percentage || ''),
  maxDiscount: String(d.max_discount_amount || d.max_discount || ''),
  appliesTo: d.applies_to || 'ALL',
  forWhom: Array.isArray(d.allowed_emails) && d.allowed_emails.length > 0 ? 'specific' : 'all',
  emails: Array.isArray(d.allowed_emails) ? d.allowed_emails.join(', ') : '',
  startDate: toLocal(d.start_date),
  expiresAt: toLocal(d.expires_at),
  maxUses: String(d.max_uses || ''),
  minOrder: String(d.min_order_value || ''),
  firstPurchaseOnly: Boolean(d.first_purchase_only),
  singleUsePerUser: d.single_use_per_user !== false,
  hidden: Boolean(d.hidden),
  active: d.active !== false,
})

const pill = (bg: string, color: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: bg, color })

/** Storefront discount coupons, shown natively inside class genz (manager only). */
export default function DiscountsStorefrontPanel() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [rows, setRows] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [d, c] = await Promise.all([
        sfManagerFetch<any[]>({ tab: 'discounts' }),
        sfManagerFetch<any[]>({ tab: 'courses' }).catch(() => [] as any[]),
      ])
      setRows(Array.isArray(d) ? d : [])
      setCourses(Array.isArray(c) ? c : [])
    } catch (e: any) {
      setError(e?.message || 'Could not load storefront discounts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const courseMap = useMemo(() => new Map<string, any>(courses.map((c: any) => [c.id, c])), [courses])
  const q = search.trim().toLowerCase()
  const shown = rows.filter(r => !q || String(r.code || '').toLowerCase().includes(q))

  const save = async () => {
    if (!form) return
    const value = Number(form.value)
    if (!form.code.trim()) return alert('Please enter a coupon code.')
    if (!form.value || !(value > 0)) return alert('Please specify a discount value greater than 0.')
    if (form.valueType === 'percentage' && value > 100) return alert('Percentage discount must be between 1 and 100.')
    if (form.startDate && form.expiresAt && new Date(form.startDate) >= new Date(form.expiresAt)) return alert('Expiry date must be after the start date.')

    const payload: Record<string, any> = {
      code: form.code.trim().toUpperCase(),
      discount_percentage: form.valueType === 'percentage' ? parseInt(form.value) : null,
      discount_amount: form.valueType === 'amount' ? parseInt(form.value) : null,
      max_discount_amount: form.maxDiscount ? parseInt(form.maxDiscount) : null,
      applies_to: form.appliesTo || 'ALL',
      allowed_emails: form.forWhom === 'specific'
        ? form.emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
        : null,
      start_date: form.startDate ? new Date(form.startDate).toISOString() : null,
      expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      max_uses: form.maxUses ? parseInt(form.maxUses) : null,
      min_order_value: form.minOrder ? parseInt(form.minOrder) : 0,
      first_purchase_only: form.firstPurchaseOnly,
      single_use_per_user: form.singleUsePerUser,
      hidden: form.hidden,
      active: form.active,
    }
    const id = form.id
    const run = (p: Record<string, any>) => id
      ? sfWrite('discount_coupons', [{ m: 'update', a: [p] }, { m: 'eq', a: ['id', id] }])
      : sfWrite('discount_coupons', [{ m: 'insert', a: [p] }])
    setSaving(true)
    let res = await run(payload)
    if (res.error?.message?.includes('max_discount_amount')) {
      delete payload.max_discount_amount
      res = await run(payload)
      if (!res.error) alert('Saved without Max Discount. To persist it, run in Supabase: ALTER TABLE discount_coupons ADD COLUMN IF NOT EXISTS max_discount_amount INTEGER;')
    }
    setSaving(false)
    if (res.error) return alert(res.error.message)
    setForm(null)
    load()
  }

  const toggleActive = async (d: any) => {
    const res = await sfWrite('discount_coupons', [{ m: 'update', a: [{ active: d.active === false }] }, { m: 'eq', a: ['id', d.id] }])
    if (res.error) alert(res.error.message)
    load()
  }

  const remove = async (d: any) => {
    const ok = await confirm({
      title: 'Delete Discount',
      message: `Coupon "${d.code}" will be permanently deleted from the storefront. This can't be undone.`,
      confirmLabel: 'Delete Discount',
      tone: 'danger',
    })
    if (!ok) return
    const res = await sfWrite('discount_coupons', [{ m: 'delete', a: [] }, { m: 'eq', a: ['id', d.id] }])
    if (res.error) alert(res.error.message)
    load()
  }

  const set = (patch: Partial<Form>) => setForm(f => (f ? { ...f, ...patch } : f))
  const totalUses = rows.reduce((s, r) => s + (Number(r.used_count) || 0), 0)
  const activeCount = rows.filter(r => r.active !== false).length

  return (
    <div>
      {confirmDialog}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code…" style={{ ...inputStyle, maxWidth: 280 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '10px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Refresh</button>
          <button onClick={() => setForm({ ...emptyForm })} style={{ padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), #8b5cf6)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
            + Create Discount
          </button>
        </div>
      </div>

      {!loading && !error && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, flexWrap: 'wrap' }}>
          <span>{rows.length} discounts</span>
          <span>{activeCount} active</span>
          <span>{totalUses} total uses</span>
        </div>
      )}

      {error ? (
        <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: 16, fontSize: 14, color: 'var(--text-secondary)' }}>{error}</div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading storefront discounts...</div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'var(--surface)', borderRadius: 20, border: '2px dashed var(--border)' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>{rows.length ? 'No discounts match your search' : 'No storefront discounts yet'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((d: any) => {
            const active = d.active !== false
            const global = !d.applies_to || d.applies_to === 'ALL'
            const course = global ? null : courseMap.get(d.applies_to)
            const used = Number(d.used_count) || 0
            const pct = d.max_uses ? Math.min(100, Math.round((used / Number(d.max_uses)) * 100)) : null
            return (
              <div key={d.id} style={{ background: 'var(--surface)', borderRadius: 16, padding: '18px 22px', boxShadow: '0 2px 12px rgba(15,23,42,0.06)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 120, background: active ? 'var(--info-light)' : 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: active ? 'var(--info)' : 'var(--text-muted)', letterSpacing: '0.06em', fontFamily: 'monospace' }}>{d.code}</div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {d.discount_percentage ? `${d.discount_percentage}% OFF` : d.discount_amount ? `₹${d.discount_amount} OFF` : 'Invalid'}
                    </span>
                    <span style={pill(global ? 'var(--success-light)' : 'var(--warning-light)', global ? 'var(--success)' : 'var(--warning)')}>
                      {global ? 'GLOBAL' : `${course?.name || d.applies_to}${course?.isBundle ? ' [Bundle]' : ''}`}
                    </span>
                    {d.hidden && <span style={pill('var(--surface)', 'var(--text-secondary)')}>HIDDEN</span>}
                    {d.first_purchase_only && <span style={pill('var(--danger-light)', 'var(--danger)')}>1ST BUY</span>}
                    {d.single_use_per_user && <span style={pill('var(--warning-light)', 'var(--warning)')}>1x/USER</span>}
                    {Array.isArray(d.allowed_emails) && d.allowed_emails.length > 0 && <span style={pill('#f3e8ff', 'var(--accent)')}>{d.allowed_emails.length} EMAILS</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>Uses: {used}{d.max_uses ? `/${d.max_uses}` : ''}</span>
                    {pct !== null && (
                      <span style={{ display: 'inline-block', width: 80, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: pct >= 100 ? 'var(--danger)' : 'var(--primary)' }} />
                      </span>
                    )}
                    {(d.max_discount_amount || d.max_discount) ? <span>Max: ₹{d.max_discount_amount || d.max_discount}</span> : null}
                    {d.min_order_value ? <span>Min: ₹{d.min_order_value}</span> : null}
                    {d.start_date && <span>Starts: {new Date(d.start_date).toLocaleDateString()}</span>}
                    {d.expires_at && <span>Expires: {new Date(d.expires_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => toggleActive(d)} style={{ padding: '6px 14px', borderRadius: 8, background: active ? 'var(--success-light)' : 'var(--danger-light)', border: '1px solid var(--border)', color: active ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {active ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => setForm(formFromDiscount(d))} style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => remove(d)} aria-label="Delete discount" style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--danger-light)', border: '1px solid var(--border)', color: 'var(--danger)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {form && <DiscountsEditorModal form={form} set={set} courses={courses} saving={saving} onCancel={() => setForm(null)} onSave={save} />}
    </div>
  )
}

function DiscountsEditorModal({ form, set, courses, saving, onCancel, onSave }: {
  form: Form
  set: (p: Partial<Form>) => void
  courses: any[]
  saving: boolean
  onCancel: () => void
  onSave: () => void
}) {
  const toggles = [
    ['firstPurchaseOnly', 'First Purchase Only', 'Only for users with no prior paid orders'],
    ['singleUsePerUser', 'Single Use per User', 'Each user can use only once'],
    ['hidden', 'Hidden/Private', 'Not shown in public listings'],
    ['active', 'Active', 'Coupon is usable'],
  ] as const
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 20 }} onClick={onCancel}>
      <div style={{ background: 'var(--surface)', borderRadius: 24, width: '100%', maxWidth: 640, padding: 32, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4 }}>{form.id ? 'Edit Storefront Discount' : 'Create Storefront Discount'}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>Applies to genziitian storefront checkout</p>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Coupon Code</label>
          <input value={form.code} onChange={e => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} placeholder="e.g. WELCOME100" style={{ ...inputStyle, letterSpacing: '0.08em', fontFamily: 'monospace' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Discount Type</label>
            <select value={form.valueType} onChange={e => set({ valueType: e.target.value as Form['valueType'] })} style={inputStyle}>
              <option value="percentage">Percentage (%)</option>
              <option value="amount">Fixed Amount (₹)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Discount Value</label>
            <input type="number" min={0} value={form.value} onChange={e => set({ value: e.target.value })} placeholder={form.valueType === 'amount' ? '₹ Off' : '% Off'} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Applies To</label>
            <select value={form.appliesTo} onChange={e => set({ appliesTo: e.target.value })} style={inputStyle}>
              <option value="ALL">All courses (global)</option>
              {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.isBundle ? '[Bundle]' : '[Course]'} ({c.id})</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>For Whom</label>
            <select value={form.forWhom} onChange={e => set({ forWhom: e.target.value as Form['forWhom'] })} style={inputStyle}>
              <option value="all">Everyone</option>
              <option value="specific">Specific emails</option>
            </select>
          </div>
        </div>
        {form.forWhom === 'specific' && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Allowed emails (comma separated)</label>
            <textarea rows={3} value={form.emails} onChange={e => set({ emails: e.target.value })} placeholder="student@example.com, parent@example.com" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div><label style={labelStyle}>Start Date (optional)</label><input type="datetime-local" value={form.startDate} onChange={e => set({ startDate: e.target.value })} style={inputStyle} /></div>
          <div><label style={labelStyle}>Expiry Date (optional)</label><input type="datetime-local" value={form.expiresAt} onChange={e => set({ expiresAt: e.target.value })} style={inputStyle} /></div>
          <div><label style={labelStyle}>Max Uses (optional)</label><input type="number" min={0} value={form.maxUses} onChange={e => set({ maxUses: e.target.value })} placeholder="Unlimited" style={inputStyle} /></div>
          <div><label style={labelStyle}>Min Order Value (optional)</label><input type="number" min={0} value={form.minOrder} onChange={e => set({ minOrder: e.target.value })} placeholder="₹ No minimum" style={inputStyle} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Max Discount (optional)</label><input type="number" min={0} value={form.maxDiscount} onChange={e => set({ maxDiscount: e.target.value })} placeholder="₹ Cap on savings" style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {toggles.map(([k, label, desc]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form[k]} onChange={e => set({ [k]: e.target.checked } as Partial<Form>)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 14, borderRadius: 12, border: '2px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button disabled={saving} onClick={onSave} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: saving ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--primary), #8b5cf6)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : form.id ? 'Update Discount' : 'Create Discount'}
          </button>
        </div>
      </div>
    </div>
  )
}
