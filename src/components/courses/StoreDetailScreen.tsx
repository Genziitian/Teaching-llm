'use client'

import { ReactNode, useEffect, useState } from 'react'
import ChampionPolicy from './ChampionPolicy'

export type DetailCta = { label: string; onClick: () => void; tone?: 'primary' | 'secondary' | 'success'; disabled?: boolean; sub?: string }

export const COMMON_POINTS = [
  'Full access to recorded lectures',
  'Course materials and notes included',
  'Learn on the website and the app with one login',
  'Access till the end of the term',
  'Support from the GenZ IITian team',
]

const COMPARE_ROWS = [
  { f: 'Recorded lectures', rec: 'Full access', live: 'Full access', champ: 'Full access' },
  { f: 'Course materials', rec: 'Full access', live: 'Full access', champ: 'Full access' },
  { f: 'Class recordings', rec: 'Available', live: 'Available', champ: 'Available' },
  { f: 'Live classes', rec: 'Not included', live: 'Direct entry', champ: 'Direct entry' },
  { f: 'Direct Q&A with teacher', rec: 'Not included', live: 'Yes, live', champ: 'Yes, live' },
  { f: 'Priority support', rec: 'Standard', live: '24/7 priority', champ: '24/7 priority' },
  { f: 'Weekly tests and evaluation', rec: 'Not included', live: 'Not included', champ: 'Included' },
  { f: '1-to-1 mentorship', rec: 'Not included', live: 'Not included', champ: 'Included' },
  { f: 'Full refund or free reattempt*', rec: 'Not included', live: 'Not included', champ: 'If conditions met' },
  { f: 'Duration', rec: 'Till end of term', live: 'Till end of term', champ: 'Till end of term' },
]

export function splitPoints(v?: string | null): string[] {
  return (v || '').split('\n').map(s => s.trim()).filter(Boolean)
}

export default function StoreDetailScreen(props: {
  eyebrow?: string
  title: string
  description?: string | null
  price?: ReactNode
  status?: ReactNode
  compare?: { hasRecorded: boolean; hasLive: boolean; hasChampion?: boolean; championPrice?: number; livePrice?: number } | null
  commonPoints?: string[] | null
  sections?: { title: string; items: string[] }[]
  points?: { value: string | null | undefined; canEdit: boolean; onSave: (v: string) => Promise<void> } | null
  children?: ReactNode
  ctas?: DetailCta[]
  onClose: () => void
}) {
  const { eyebrow, title, description, price, status, compare, sections = [], points, children, ctas = [], onClose } = props
  const common = props.commonPoints === undefined ? COMMON_POINTS : props.commonPoints
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const managerList = splitPoints(points?.value)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const h3: React.CSSProperties = { fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', margin: '0 0 12px', color: 'var(--text-primary)' }
  const card: React.CSSProperties = { background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 22, padding: '22px 22px' }

  const check = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success, #10b981)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  )
  const list = (items: string[]) => (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((t, i) => (
        <li key={i} style={{ display: 'flex', gap: 12, fontSize: 15, lineHeight: 1.5, color: 'var(--text-primary)' }}>{check}<span>{t}</span></li>
      ))}
    </ul>
  )

  const ctaBtn = (c: DetailCta, i: number) => {
    const bg = c.tone === 'secondary' ? 'var(--surface-hover)' : c.tone === 'success' ? '#10b981' : 'var(--accent)'
    const fg = c.tone === 'secondary' ? 'var(--text-primary)' : c.tone === 'success' ? '#fff' : 'var(--button-text, #fff)'
    return (
      <button key={i} disabled={c.disabled} onClick={c.onClick} className="sds-cta"
        style={{ width: '100%', padding: '15px 18px', borderRadius: 16, border: 'none', background: bg, color: fg, fontWeight: 700, fontSize: 16, cursor: c.disabled ? 'not-allowed' : 'pointer', opacity: c.disabled ? 0.5 : 1 }}>
        {c.label}{c.sub && <span style={{ display: 'block', fontSize: 12, fontWeight: 500, opacity: 0.8, marginTop: 2 }}>{c.sub}</span>}
      </button>
    )
  }

  return (
    <div className="sds-root" style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'var(--background, var(--surface-2))', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        @keyframes sdsIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .sds-wrap{animation:sdsIn .38s cubic-bezier(.16,1,.3,1) both}
        .sds-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}
        .sds-side{position:sticky;top:84px}
        .sds-cta{transition:transform .15s ease,opacity .15s ease}
        .sds-cta:active{transform:scale(.98)}
        .sds-table td,.sds-table th{padding:14px 16px;font-size:14px;text-align:center}
        .sds-table td:first-child,.sds-table th:first-child{text-align:left}
        @media(max-width:860px){.sds-grid{grid-template-columns:1fr}.sds-side{position:static}}
        @media(prefers-reduced-motion:reduce){.sds-wrap{animation:none}}
      `}</style>

      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'color-mix(in srgb, var(--background, var(--surface-2)) 82%, transparent)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', borderBottom: '0.5px solid var(--border)' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center' }}>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 16, fontWeight: 600, cursor: 'pointer', padding: '6px 4px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>Back
          </button>
        </div>
      </div>

      <div className="sds-wrap" style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 20px 120px' }}>
        {eyebrow && <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{eyebrow}</div>}
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 800, letterSpacing: '-0.8px', lineHeight: 1.1, margin: '8px 0 10px', color: 'var(--text-primary)' }}>{title}</h1>
        {description && <p style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--text-secondary)', margin: '0 0 24px', whiteSpace: 'pre-wrap', maxWidth: 680 }}>{description}</p>}
        {status}

        <div className="sds-grid" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            {(managerList.length > 0 || points?.canEdit) && (
              <section style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ ...h3, margin: 0 }}>What you get</h3>
                  {points?.canEdit && !editing && (
                    <button onClick={() => { setDraft(managerList.join('\n')); setEditing(true) }} style={{ background: 'var(--surface-hover)', border: 'none', borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>Edit points</button>
                  )}
                </div>
                {editing ? (
                  <>
                    <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={7} placeholder={'One point per line\nLive doubt sessions every week\nPrevious year question practice'}
                      style={{ width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 14, border: '0.5px solid var(--border)', background: 'var(--surface-hover)', color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <button disabled={saving} onClick={async () => { setSaving(true); try { await points!.onSave(draft); setEditing(false) } finally { setSaving(false) } }}
                        style={{ padding: '11px 20px', borderRadius: 999, border: 'none', background: 'var(--accent)', color: 'var(--button-text, #fff)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button onClick={() => setEditing(false)} style={{ padding: '11px 20px', borderRadius: 999, border: 'none', background: 'var(--surface-hover)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </>
                ) : managerList.length > 0 ? list(managerList) : (
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No points added yet. Tap Edit points to add what students get.</div>
                )}
              </section>
            )}

            {compare && (compare.hasRecorded || compare.hasLive || compare.hasChampion) && (
              <section style={{ ...card, padding: '22px 6px 8px' }}>
                <h3 style={{ ...h3, padding: '0 16px' }}>{compare.hasChampion ? 'Compare plans' : compare.hasLive && compare.hasRecorded ? 'Live Pro vs Recorded' : compare.hasLive ? 'Live Pro' : 'Recorded batch'}</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="sds-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <th style={{ fontWeight: 700 }}>Feature</th>
                        {compare.hasRecorded && <th style={{ fontWeight: 700 }}>Recorded</th>}
                        {compare.hasLive && <th style={{ fontWeight: 700, color: 'var(--accent)' }}>Live Pro</th>}
                        {compare.hasChampion && <th style={{ fontWeight: 700, color: '#ef4444' }}>Champion</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARE_ROWS.map((r, i) => (
                        <tr key={i} style={{ borderTop: '0.5px solid var(--border)' }}>
                          <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{r.f}</td>
                          {compare.hasRecorded && <td style={{ color: r.rec === 'Not included' || r.rec === 'Standard' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{r.rec}</td>}
                          {compare.hasLive && <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.live}</td>}
                          {compare.hasChampion && <td style={{ fontWeight: 700, color: r.champ === 'Not included' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{r.champ}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {compare?.hasChampion && (
              <section style={card}><h3 style={h3}>Champion batch terms</h3><ChampionPolicy championPrice={compare.championPrice} livePrice={compare.livePrice} /></section>
            )}

            {common && common.length > 0 && (
              <section style={card}><h3 style={h3}>Included with every purchase</h3>{list(common)}</section>
            )}

            {sections.filter(s => s.items.length > 0).map((s, i) => (
              <section key={i} style={card}><h3 style={h3}>{s.title}</h3>{list(s.items)}</section>
            ))}

            {children}
          </div>

          <aside className="sds-side">
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {price}
              {ctas.map(ctaBtn)}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
