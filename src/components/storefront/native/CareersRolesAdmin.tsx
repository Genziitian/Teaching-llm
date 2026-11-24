'use client'

import { useCallback, useEffect, useState } from 'react'
import { CAREERS_ROLES_KEY, DEFAULT_CAREERS_ROLES, ROLE_MODES, ROLE_PAY, ROLE_TYPES, parseCareersRoles, type CareersRole } from './CareersTypes'

const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border, #d1d5db)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14 }
const btn: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--button-text, #000)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const ghost: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, #d1d5db)' }

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }
const blank = (): CareersRole => ({ id: '', title: '', summary: '', tags: [], comp: '', open: true })
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default function CareersRolesAdmin() {
  const [roles, setRoles] = useState<CareersRole[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<(CareersRole & { isNew?: boolean; tagsText?: string; skillsText?: string }) | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = btoa(JSON.stringify({ table: 'settings', calls: [{ m: 'select', a: ['value'] }, { m: 'eq', a: ['key', CAREERS_ROLES_KEY] }, { m: 'maybeSingle', a: [] }] }))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const res = await fetch(`/api/storefront/db?q=${q}`)
      const d = await res.json()
      setRoles(d?.data?.value ? parseCareersRoles(d.data.value) : DEFAULT_CAREERS_ROLES)
    } catch { setRoles(DEFAULT_CAREERS_ROLES) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (next: CareersRole[]) => {
    setMsg('')
    const res = await fetch('/api/storefront/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'settings', calls: [{ m: 'upsert', a: [{ key: CAREERS_ROLES_KEY, value: JSON.stringify(next) }] }] }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || d?.error) { setMsg(d?.error?.message || d?.error || 'Save failed'); return false }
    setRoles(next); setMsg('Saved'); return true
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    const { isNew, tagsText, skillsText, ...r } = edit
    const role: CareersRole = { ...r, id: r.id || slug(r.title), skills: (skillsText ?? (r.skills || []).join(', ')).split(',').map((t) => t.trim()).filter(Boolean), tags: (tagsText ?? r.tags.join(', ')).split(',').map((t) => t.trim()).filter(Boolean) }
    if (!role.id || !role.title) { setMsg('Title is required'); return }
    if (isNew && roles.some((x) => x.id === role.id)) { setMsg('A role with this id exists'); return }
    const next = isNew ? [...roles, role] : roles.map((x) => (x.id === role.id ? role : x))
    if (await save(next)) setEdit(null)
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{msg}</span>
        <button style={btn} onClick={() => setEdit({ ...blank(), isNew: true })}>Add role</button>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {roles.map((r) => (
          <div key={r.id} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: 14, background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>{r.title}</strong>{' '}
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: r.open ? 'var(--success-light)' : 'var(--surface-2)', color: r.open ? 'var(--success)' : 'var(--text-muted)' }}>{r.open ? 'Open' : 'Closed'}</span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{r.summary}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{[r.type, r.mode, r.pay, ...r.tags, r.location, r.comp].filter(Boolean).join(' · ')}</p>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <button style={ghost} onClick={() => setEdit({ ...r })}>Edit</button>
              <button style={ghost} onClick={() => save(roles.map((x) => (x.id === r.id ? { ...x, open: !x.open } : x)))}>{r.open ? 'Close' : 'Reopen'}</button>
              <button style={ghost} onClick={() => confirm(`Remove "${r.title}"?`) && save(roles.filter((x) => x.id !== r.id))}>Remove</button>
            </div>
          </div>
        ))}
        {roles.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No roles yet.</p>}
      </div>
      {edit && (
        <form onSubmit={submit} style={{ marginTop: 16, display: 'grid', gap: 14, border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, padding: 18, background: 'var(--surface)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div><label style={lbl}>Role title *</label><input style={inp} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
            {edit.isNew && <div><label style={lbl}>Role ID (optional)</label><input style={inp} placeholder="e.g. tutor" value={edit.id} onChange={(e) => setEdit({ ...edit, id: slug(e.target.value) })} /></div>}
            <div><label style={lbl}>Job type</label><select style={inp} value={edit.type || ''} onChange={(e) => setEdit({ ...edit, type: e.target.value })}><option value="">Not set</option>{ROLE_TYPES.map((o) => <option key={o}>{o}</option>)}</select></div>
            <div><label style={lbl}>Work mode</label><select style={inp} value={edit.mode || ''} onChange={(e) => setEdit({ ...edit, mode: e.target.value })}><option value="">Not set</option>{ROLE_MODES.map((o) => <option key={o}>{o}</option>)}</select></div>
            <div><label style={lbl}>Pay</label><select style={inp} value={edit.pay || ''} onChange={(e) => setEdit({ ...edit, pay: e.target.value })}><option value="">Not set</option>{ROLE_PAY.map((o) => <option key={o}>{o}</option>)}</select></div>
            <div><label style={lbl}>Compensation</label><input style={inp} placeholder="e.g. ₹5,000 – ₹10,000 / month" value={edit.comp} onChange={(e) => setEdit({ ...edit, comp: e.target.value })} /></div>
            <div><label style={lbl}>Location</label><input style={inp} placeholder="e.g. India, Chennai" value={edit.location || ''} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></div>
            <div><label style={lbl}>Experience needed</label><input style={inp} placeholder="e.g. Fresher, 1+ year" value={edit.experience || ''} onChange={(e) => setEdit({ ...edit, experience: e.target.value })} /></div>
            <div><label style={lbl}>Openings</label><input style={inp} type="number" min={1} value={edit.openings || ''} onChange={(e) => setEdit({ ...edit, openings: Number(e.target.value) || undefined })} /></div>
            <div><label style={lbl}>Apply by</label><input style={inp} type="date" value={edit.deadline || ''} onChange={(e) => setEdit({ ...edit, deadline: e.target.value })} /></div>
          </div>
          <div><label style={lbl}>Full job description (shown on the Details page)</label><textarea style={{ ...inp, minHeight: 140 }} placeholder={'Responsibilities, requirements, what a week looks like...'} value={edit.details || ''} onChange={(e) => setEdit({ ...edit, details: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div><label style={lbl}>Contact person</label><input style={inp} value={edit.contactName || ''} onChange={(e) => setEdit({ ...edit, contactName: e.target.value })} /></div>
            <div><label style={lbl}>Contact email</label><input style={inp} type="email" value={edit.contactEmail || ''} onChange={(e) => setEdit({ ...edit, contactEmail: e.target.value })} /></div>
            <div><label style={lbl}>Contact phone / WhatsApp</label><input style={inp} value={edit.contactPhone || ''} onChange={(e) => setEdit({ ...edit, contactPhone: e.target.value })} /></div>
          </div>
          <div><label style={lbl}>About the role</label><textarea style={{ ...inp, minHeight: 90 }} value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div><label style={lbl}>Skills (comma separated)</label><input style={inp} placeholder="Maths, Python, Hindi" value={edit.skillsText ?? (edit.skills || []).join(', ')} onChange={(e) => setEdit({ ...edit, skillsText: e.target.value })} /></div>
            <div><label style={lbl}>Extra tags (comma separated)</label><input style={inp} value={edit.tagsText ?? edit.tags.join(', ')} onChange={(e) => setEdit({ ...edit, tagsText: e.target.value })} /></div>
          </div>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={edit.open} onChange={(e) => setEdit({ ...edit, open: e.target.checked })} /> Open for applications</label>
          <div style={{ display: 'flex', gap: 8 }}><button style={btn}>Save role</button><button type="button" style={ghost} onClick={() => setEdit(null)}>Cancel</button></div>
        </form>
      )}
    </div>
  )
}
