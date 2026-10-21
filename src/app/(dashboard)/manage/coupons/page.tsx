'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function CouponManagementPage() {
  const { data: coupons, isLoading } = useSWR('/api/manage/coupons?includeHidden=true', fetcher, { revalidateOnFocus: false })
  const { confirm, confirmDialog } = useConfirmDialog()
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<any>(null)
  const [form, setForm] = useState<any>({
    code: '', discountType: 'PERCENTAGE', discountValue: '', applicability: 'GLOBAL',
    targetBundleIds: '', targetUserEmails: '', targetSubjects: '',
    minOrderValue: '', maxDiscount: '', isFirstPurchaseOnly: false, isSingleUsePerUser: false,
    isHidden: false, startDate: '', expiresAt: '', maxUses: '', isActive: true
  })

  const resetForm = () => {
    setForm({
      code: '', discountType: 'PERCENTAGE', discountValue: '', applicability: 'GLOBAL',
      targetBundleIds: '', targetUserEmails: '', targetSubjects: '',
      minOrderValue: '', maxDiscount: '', isFirstPurchaseOnly: false, isSingleUsePerUser: false,
      isHidden: false, startDate: '', expiresAt: '', maxUses: '', isActive: true
    })
  }

  const handleSave = async () => {
    if (!form.code || !form.discountValue) { alert('Code and value are required'); return }
    setSaving(true)
    try {
      const url = editingCoupon ? `/api/manage/coupons/${editingCoupon.id}` : '/api/manage/coupons'
      const method = editingCoupon ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) {
        setShowCreate(false); setEditingCoupon(null); resetForm()
        mutate('/api/manage/coupons?includeHidden=true')
      } else {
        const d = await res.json(); alert(d.error || 'Failed to save')
      }
    } catch { alert('Failed to save coupon') }
    finally { setSaving(false) }
  }

  const handleDelete = async (coupon: any) => {
    const allowed = await confirm({
      title: 'Delete Discount',
      message: 'This will permanently delete the discount code. Existing orders using this code will not be affected, but new orders will not be able to use it.',
      confirmLabel: 'Delete Discount',
      tone: 'danger',
      strictDelete: true,
      entityType: 'Discount',
      entityName: coupon.code,
      confirmationPhrase: 'DELETE MY DISCOUNT',
    })
    if (!allowed) return
    try {
      const res = await fetch(`/api/manage/coupons/${coupon.id}`, { method: 'DELETE' })
      if (res.ok) mutate('/api/manage/coupons?includeHidden=true')
      else alert('Failed to delete')
    } catch { alert('Failed to delete') }
  }

  const toggleActive = async (coupon: any) => {
    try {
      await fetch(`/api/manage/coupons/${coupon.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !coupon.isActive })
      })
      mutate('/api/manage/coupons?includeHidden=true')
    } catch { alert('Failed to update') }
  }

  const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px', letterSpacing: '0.04em' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '14px', fontWeight: '600', boxSizing: 'border-box', outline: 'none', transition: 'border 0.2s' }

  return (
    <div className="dashboard-inner-page" style={{ padding: '24px 32px' }}>
      {confirmDialog}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={() => { resetForm(); setEditingCoupon(null); setShowCreate(true) }} style={{ padding: '10px 20px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: '700', fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
          + Create Coupon
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading coupons...</div>
      ) : !coupons?.length ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'var(--surface)', borderRadius: '20px', border: '2px dashed var(--border)' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏷️</div>
          <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-secondary)' }}>No coupons yet</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Create your first coupon to start offering discounts</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {coupons.map((c: any) => (
            <div key={c.id} style={{ background: 'var(--surface)', borderRadius: '16px', padding: '18px 22px', boxShadow: '0 2px 12px rgba(15,23,42,0.06)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Code badge */}
              <div style={{ minWidth: '120px' }}>
                <div style={{ background: c.isActive ? 'var(--info-light)' : 'var(--surface)', border: c.isActive ? '1.5px solid var(--border)' : '1.5px solid var(--border)', borderRadius: '10px', padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: '900', color: c.isActive ? 'var(--info)' : 'var(--text-muted)', letterSpacing: '0.06em', fontFamily: 'monospace' }}>{c.code}</div>
                </div>
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: c.applicability === 'GLOBAL' ? 'var(--success-light)' : c.applicability === 'BUNDLE' ? 'var(--warning-light)' : '#f3e8ff', color: c.applicability === 'GLOBAL' ? 'var(--success)' : c.applicability === 'BUNDLE' ? 'var(--warning)' : 'var(--accent)' }}>
                    {c.applicability}
                  </span>
                  {c.isHidden && <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-secondary)' }}>HIDDEN</span>}
                  {c.isFirstPurchaseOnly && <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: 'var(--danger-light)', color: 'var(--danger)' }}>1ST BUY</span>}
                  {c.isSingleUsePerUser && <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: 'var(--warning-light)', color: 'var(--warning)' }}>1x/USER</span>}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <span>Uses: {c.currentUses}{c.maxUses ? `/${c.maxUses}` : ''}</span>
                  <span>Revenue: ₹{c.totalRevenueGenerated || 0}</span>
                  {c.expiresAt && <span>Expires: {new Date(c.expiresAt).toLocaleDateString()}</span>}
                  {c.minOrderValue && <span>Min: ₹{c.minOrderValue}</span>}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={() => toggleActive(c)} style={{ padding: '6px 14px', borderRadius: '8px', background: c.isActive ? 'var(--success-light)' : 'var(--danger-light)', border: c.isActive ? '1px solid #86efac' : '1px solid var(--border)', color: c.isActive ? 'var(--success)' : 'var(--danger)', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                  {c.isActive ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => { setEditingCoupon(c); setForm({ code: c.code, discountType: c.discountType, discountValue: c.discountValue, applicability: c.applicability, targetBundleIds: c.targetBundleIds || '', targetUserEmails: c.targetUserEmails || '', targetSubjects: c.targetSubjects || '', minOrderValue: c.minOrderValue || '', maxDiscount: c.maxDiscount || '', isFirstPurchaseOnly: c.isFirstPurchaseOnly, isSingleUsePerUser: c.isSingleUsePerUser, isHidden: c.isHidden, startDate: c.startDate ? new Date(c.startDate).toISOString().slice(0, 16) : '', expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 16) : '', maxUses: c.maxUses || '', isActive: c.isActive }); setShowCreate(true) }} style={{ padding: '6px 14px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(c)} style={{ padding: '6px 10px', borderRadius: '8px', background: 'var(--danger-light)', border: '1px solid var(--border)', color: 'var(--danger)', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '20px' }} onClick={() => { setShowCreate(false); setEditingCoupon(null) }}>
          <div style={{ background: 'var(--surface)', borderRadius: '24px', width: '100%', maxWidth: '640px', padding: '32px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '4px' }}>{editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Configure discount code settings</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Coupon Code</label>
                <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="e.g. SAVE20" style={{ ...inputStyle, letterSpacing: '0.08em', fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={labelStyle}>Applicability</label>
                <select value={form.applicability} onChange={e => setForm({ ...form, applicability: e.target.value })} style={inputStyle}>
                  <option value="GLOBAL">Global (everything)</option>
                  <option value="BUNDLE">Bundle-specific</option>
                  <option value="SUBJECT">Subject/Category</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Discount Type</label>
                <select value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value })} style={inputStyle}>
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount (₹)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Discount Value</label>
                <input type="number" min={0} value={form.discountValue} onChange={e => setForm({ ...form, discountValue: e.target.value })} placeholder={form.discountType === 'FIXED' ? '₹ Amount' : '% Off'} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Start Date (optional)</label>
                <input type="datetime-local" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Expiry Date (optional)</label>
                <input type="datetime-local" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Max Uses (optional)</label>
                <input type="number" min={0} value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} placeholder="Unlimited" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Min Order Value (optional)</label>
                <input type="number" min={0} value={form.minOrderValue} onChange={e => setForm({ ...form, minOrderValue: e.target.value })} placeholder="₹ No minimum" style={inputStyle} />
              </div>
            </div>

            {form.applicability === 'BUNDLE' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Target Bundle IDs (JSON array)</label>
                <input type="text" value={form.targetBundleIds} onChange={e => setForm({ ...form, targetBundleIds: e.target.value })} placeholder='["bundleId1","bundleId2"]' style={inputStyle} />
              </div>
            )}

            {form.applicability === 'SUBJECT' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Target Courses / Subjects (course names, subjects or IDs, comma-separated or JSON array)</label>
                <input type="text" value={form.targetSubjects} onChange={e => setForm({ ...form, targetSubjects: e.target.value })} placeholder='Physics, Chemistry  or  ["courseId1"]' style={inputStyle} />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Max Discount (optional)</label>
              <input type="number" min={0} value={form.maxDiscount} onChange={e => setForm({ ...form, maxDiscount: e.target.value })} placeholder="₹ No cap — most a student can save with this coupon" style={inputStyle} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>User Email Restrictions (JSON array, optional)</label>
              <input type="text" value={form.targetUserEmails} onChange={e => setForm({ ...form, targetUserEmails: e.target.value })} placeholder='["user@email.com"] or leave empty for all' style={inputStyle} />
            </div>

            {/* Toggle options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {[
                { key: 'isFirstPurchaseOnly', label: 'First Purchase Only', desc: 'Only for users with no prior orders' },
                { key: 'isSingleUsePerUser', label: 'Single Use per User', desc: 'Each user can use only once' },
                { key: 'isHidden', label: 'Hidden/Private', desc: 'Not visible publicly' },
                { key: 'isActive', label: 'Active', desc: 'Coupon is usable' },
              ].map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form[opt.key]} onChange={e => setForm({ ...form, [opt.key]: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowCreate(false); setEditingCoupon(null) }} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button disabled={saving} onClick={handleSave} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: saving ? 'var(--text-muted)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
