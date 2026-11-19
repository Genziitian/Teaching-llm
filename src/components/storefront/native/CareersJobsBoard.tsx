'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CareersRole } from './CareersTypes'

const btn: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--button-text, #000)', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: 'none' }

export default function CareersJobsBoard() {
  const [roles, setRoles] = useState<CareersRole[] | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/site/careers-roles').then((r) => r.json()).then((d) => setRoles(d.roles || [])).catch(() => setRoles([]))
  }, [])

  return (
    <div style={{ width: '100%', padding: '8px 0 48px' }}>
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
              <button style={{ ...btn, alignSelf: 'flex-start' }} onClick={() => router.push(`/careers/apply/${encodeURIComponent(r.id)}?from=jobs`)}>Apply</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
