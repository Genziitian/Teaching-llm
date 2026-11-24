'use client'

import { useEffect, useState } from 'react'
import type { CareersRole } from './CareersTypes'
import JobApplicationForm from './JobApplicationForm'
import JobDetail from './JobDetail'

const btn: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--button-text, #000)', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: 'none' }

export default function CareersJobsBoard() {
  const [roles, setRoles] = useState<CareersRole[] | null>(null)
  const [active, setActive] = useState<CareersRole | null>(null)
  const [detail, setDetail] = useState<CareersRole | null>(null)

  useEffect(() => {
    fetch('/api/site/careers-roles').then((r) => r.json()).then((d) => setRoles(d.roles || [])).catch(() => setRoles([]))
  }, [])

  if (active) return <JobApplicationForm key={active.id} role={active} onBack={() => setActive(null)} />
  if (detail) return <JobDetail role={detail} onBack={() => setDetail(null)} onApply={() => { setActive(detail); setDetail(null) }} />

  return (
    <div style={{ width: '100%', padding: '8px 0 48px' }}>
      {roles === null && <p style={{ color: 'var(--text-muted)' }}>Loading roles…</p>}
      {roles?.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No open roles right now. Check back soon.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {roles?.map((r) => {
          const chips = [r.type, r.mode, r.pay, ...r.tags].filter(Boolean)
          const meta = [r.location, r.experience, r.openings ? `${r.openings} opening${r.openings > 1 ? 's' : ''}` : '', r.deadline ? `Apply by ${new Date(r.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''].filter(Boolean)
          return (
            <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 18, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                  {r.title.trim().charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</h3>
                  {r.comp && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginTop: 2 }}>{r.comp}</div>}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{r.summary}</p>
              {chips.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {chips.map((t) => <span key={t} style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{t}</span>)}
                </div>
              )}
              {(meta.length > 0 || (r.skills && r.skills.length > 0)) && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {meta.join(' · ')}
                  {r.skills && r.skills.length > 0 && <div>Skills: {r.skills.join(', ')}</div>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <button style={{ ...btn, flex: 1, padding: '10px 16px' }} onClick={() => setActive(r)}>Apply</button>
                <button style={{ ...btn, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '6px 14px', fontSize: 13, fontWeight: 500, alignSelf: 'center' }} onClick={() => setDetail(r)}>Details</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
