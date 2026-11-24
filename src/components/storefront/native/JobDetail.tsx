'use client'

import type { CareersRole } from './CareersTypes'

const SUPPORT_WHATSAPP = '917254926179' // same support number GenZie uses when nobody is listed for a role
const card: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, padding: 20 }
const chip: React.CSSProperties = { fontSize: 12, padding: '4px 12px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }

/** Full page for one role: everything about it, who to contact, and Apply. */
export default function JobDetail({ role: r, onBack, onApply }: { role: CareersRole; onBack: () => void; onApply: () => void }) {
  const chips = [r.type, r.mode, r.pay, ...r.tags].filter(Boolean) as string[]
  const facts: [string, string][] = [
    ['Pay', r.comp],
    ['Location', r.location || ''],
    ['Experience', r.experience || ''],
    ['Openings', r.openings ? String(r.openings) : ''],
    ['Apply by', r.deadline ? new Date(r.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''],
  ].filter(([, v]) => v) as [string, string][]
  const phone = (r.contactPhone || '').replace(/\D/g, '')
  const wa = phone || SUPPORT_WHATSAPP
  const hasContact = !!(r.contactName || r.contactEmail || r.contactPhone)

  return (
    <div style={{ width: '100%', padding: '4px 0 48px', display: 'grid', gap: 16 }}>
      <button type="button" onClick={onBack} style={{ justifySelf: 'start', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', boxShadow: 'none' }}>← All jobs</button>

      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</h2>
          <p style={{ margin: '8px 0 12px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)', maxWidth: 720 }}>{r.summary}</p>
          {chips.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{chips.map((t) => <span key={t} style={chip}>{t}</span>)}</div>}
        </div>
        <button type="button" onClick={onApply} style={{ padding: '11px 28px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'var(--button-text, #000)', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: 'none' }}>Apply now</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          {r.details && (
            <div style={card}>
              <h3 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--text-primary)' }}>About this role</h3>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{r.details}</div>
            </div>
          )}
          {r.skills && r.skills.length > 0 && (
            <div style={card}>
              <h3 style={{ margin: '0 0 10px', fontSize: 15, color: 'var(--text-primary)' }}>Skills</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{r.skills.map((t) => <span key={t} style={chip}>{t}</span>)}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {facts.length > 0 && (
            <div style={card}>
              <h3 style={{ margin: '0 0 10px', fontSize: 15, color: 'var(--text-primary)' }}>At a glance</h3>
              {facts.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span><span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <div style={card}>
            <h3 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--text-primary)' }}>Who to contact</h3>
            {r.contactName && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{r.contactName}</div>}
            {!hasContact && <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-muted)' }}>Questions about this role? Message our team.</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {r.contactEmail && <a href={`mailto:${r.contactEmail}`} style={{ ...chip, textDecoration: 'none', color: 'var(--text-primary)' }}>Email {r.contactEmail}</a>}
              {phone && <a href={`tel:+${phone.length === 10 ? '91' + phone : phone}`} style={{ ...chip, textDecoration: 'none', color: 'var(--text-primary)' }}>Call {r.contactPhone}</a>}
              <a href={`https://wa.me/${wa.length === 10 ? '91' + wa : wa}`} target="_blank" rel="noreferrer" style={{ ...chip, textDecoration: 'none', color: 'var(--text-primary)' }}>WhatsApp</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
