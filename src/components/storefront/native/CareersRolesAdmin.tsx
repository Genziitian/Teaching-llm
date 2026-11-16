'use client'

import { useCallback, useEffect, useState } from 'react'
import { CAREERS_ROLES_KEY, DEFAULT_CAREERS_ROLES, parseCareersRoles, type CareersRole } from './CareersTypes'

const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border, #d1d5db)', background: 'var(--bg-card, #fff)', color: 'var(--text-primary)', fontSize: 14 }
const btn: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const ghost: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, #d1d5db)' }

const blank = (): CareersRole => ({ id: '', title: '', summary: '', tags: [], comp: '', open: true })
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default function CareersRolesAdmin() {
  const [roles, setRoles] = useState<CareersRole[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<(CareersRole & { isNew?: boolean; tagsText?: string }) | null>(null)
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
    const { isNew, tagsText, ...r } = edit
    const role: CareersRole = { ...r, id: r.id || slug(r.title), tags: (tagsText ?? r.tags.join(', ')).split(',').map((t) => t.trim()).filter(Boolean) }
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
          <div key={r.id} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: 14, background: 'var(--bg-card, #fff)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>{r.title}</strong>{' '}
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: r.open ? '#dcfce7' : '#e5e7eb', color: r.open ? '#166534' : '#4b5563' }}>{r.open ? 'Open' : 'Closed'}</span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{r.summary}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{r.tags.join(' · ')} {r.comp && `· ${r.comp}`}</p>
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
        <form onSubmit={submit} style={{ marginTop: 16, display: 'grid', gap: 10, border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: 14, background: 'var(--bg-card, #fff)' }}>
          <input style={inp} placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          {edit.isNew && <input style={inp} placeholder="Id (optional, e.g. tutor)" value={edit.id} onChange={(e) => setEdit({ ...edit, id: slug(e.target.value) })} />}
          <textarea style={{ ...inp, minHeight: 70 }} placeholder="Summary" value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} />
          <input style={inp} placeholder="Tags, comma separated" value={edit.tagsText ?? edit.tags.join(', ')} onChange={(e) => setEdit({ ...edit, tagsText: e.target.value })} />
          <input style={inp} placeholder="Compensation" value={edit.comp} onChange={(e) => setEdit({ ...edit, comp: e.target.value })} />
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}><input type="checkbox" checked={edit.open} onChange={(e) => setEdit({ ...edit, open: e.target.checked })} /> Open for applications</label>
          <div style={{ display: 'flex', gap: 8 }}><button style={btn}>Save role</button><button type="button" style={ghost} onClick={() => setEdit(null)}>Cancel</button></div>
        </form>
      )}
    </div>
  )
}
