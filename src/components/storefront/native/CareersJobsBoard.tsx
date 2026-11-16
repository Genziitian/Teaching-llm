'use client'

import { useEffect, useState } from 'react'
import type { CareersRole } from './CareersTypes'

const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border, #d1d5db)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14 }
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }
const btn: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--button-text, #000)', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: 'none' }

export default function CareersJobsBoard() {
  const [roles, setRoles] = useState<CareersRole[] | null>(null)
  const [active, setActive] = useState<CareersRole | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', age: '', experience_and_why: '', resume_link: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    fetch('/api/site/careers-roles').then((r) => r.json()).then((d) => setRoles(d.roles || [])).catch(() => setRoles([]))
  }, [])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!active) return
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/site/job-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: active.id, role_title: active.title }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not submit application')
      setDone(active.title); setActive(null)
      setForm({ full_name: '', email: '', phone: '', age: '', experience_and_why: '', resume_link: '' })
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div style={{ width: '100%', padding: '8px 0 48px' }}>
      {done && <div style={{ padding: 12, borderRadius: 8, background: 'var(--success-light)', color: 'var(--success)', marginBottom: 16, fontSize: 14 }}>Application for {done} submitted. We will contact you if shortlisted.</div>}
      {roles === null && <p style={{ color: 'var(--text-muted)' }}>Loading roles…</p>}
      {roles?.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No open roles right now. Check back soon.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {roles?.map((r) => (
          <div key={r.id} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, padding: 16, background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, color: 'var(--text-primary)' }}>{r.title}</h3>
                <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--text-secondary)' }}>{r.summary}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[r.type, r.mode, r.pay, ...r.tags].filter(Boolean).map((t) => <span key={t} style={{ fontSize: 11, padding: '2px 10px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{t}</span>)}
                  {r.comp && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.comp}</span>}
                </div>
                {(r.location || r.experience || r.openings || r.deadline || (r.skills && r.skills.length > 0)) && (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    {[r.location, r.experience, r.openings ? `${r.openings} opening${r.openings > 1 ? 's' : ''}` : '', r.deadline ? `Apply by ${new Date(r.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : '', r.skills && r.skills.length ? `Skills: ${r.skills.join(', ')}` : ''].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button style={{ ...btn, alignSelf: 'flex-start' }} onClick={() => { setActive(r); setErr(''); setDone('') }}>Apply</button>
            </div>
            {active?.id === r.id && (
              <form onSubmit={submit} style={{ marginTop: 16, display: 'grid', gap: 12, borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: 16 }}>
                <div><label style={lbl}>Full name *</label><input style={inp} required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} /></div>
                <div><label style={lbl}>Email *</label><input style={inp} type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
                <div><label style={lbl}>Phone (10 digits) *</label><input style={inp} required value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
                <div><label style={lbl}>Age</label><input style={inp} type="number" value={form.age} onChange={(e) => set('age', e.target.value)} /></div>
                <div><label style={lbl}>Resume link</label><input style={inp} value={form.resume_link} onChange={(e) => set('resume_link', e.target.value)} /></div>
                <div><label style={lbl}>Experience and why you want this role</label><textarea style={{ ...inp, minHeight: 90 }} value={form.experience_and_why} onChange={(e) => set('experience_and_why', e.target.value)} /></div>
                {err && <div style={{ color: '#b91c1c', fontSize: 13 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btn} disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>
                  <button type="button" style={{ ...btn, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, #d1d5db)' }} onClick={() => setActive(null)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
