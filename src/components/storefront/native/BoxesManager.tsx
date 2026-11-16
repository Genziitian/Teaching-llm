'use client'

import { useEffect, useState } from 'react'
import PageShell, { LoadNotice } from '@/components/storefront/PageShell'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { DEFAULT_BOX_CONFIG, TERM_OPTIONS, loadBoxConfig, sfDb, type CourseTerm } from './CoursesDb'

export default function BoxesManager() {
  const [config, setConfig] = useState<Record<CourseTerm, string[]>>(DEFAULT_BOX_CONFIG)
  const [loaded, setLoaded] = useState(false)
  const [term, setTerm] = useState<CourseTerm>('Foundation')
  const [newBox, setNewBox] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { confirm, confirmDialog } = useConfirmDialog()

  useEffect(() => {
    loadBoxConfig().then(r => {
      setConfig(r.config)
      if (r.error) setError(r.error)
      setLoaded(true)
    })
  }, [])

  const boxes = config[term] || []
  const setBoxes = (next: string[]) => setConfig({ ...config, [term]: next })

  const add = () => {
    const name = newBox.trim()
    if (!name) return
    if (boxes.some(b => b.toLowerCase() === name.toLowerCase())) {
      setError('That box already exists for this term.'); setSuccess(''); return
    }
    setBoxes([...boxes, name]); setNewBox(''); setError(''); setSuccess('')
  }

  const save = async () => {
    const cleaned = TERM_OPTIONS.reduce((acc, t) => {
      acc[t] = Array.from(new Set((config[t] || []).map(b => b.trim()).filter(Boolean)))
      return acc
    }, {} as Record<CourseTerm, string[]>)
    setSaving(true); setError(''); setSuccess('')
    const { error: err } = await sfDb('settings', [{ m: 'upsert', a: [{ key: 'exam_visibility', value: JSON.stringify(cleaned) }] }])
    if (err) setError(err.message || 'Failed to save boxes')
    else { setConfig(cleaned); setSuccess('Boxes saved successfully.') }
    setSaving(false)
  }

  return (
    <PageShell title="Boxes" description="Exam boxes students choose after selecting a term. Assign courses to boxes from Storefront Courses." backHref="/manage" backLabel="Manage">
      {confirmDialog}
      {error && <div style={{ marginBottom: 12 }}><LoadNotice error={error} /></div>}
      {success && <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-primary)', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: 12 }}>{success}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TERM_OPTIONS.map(t => (
          <button key={t} type="button" className={t === term ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => { setTerm(t); setError(''); setSuccess('') }}>{t}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: 'var(--text-primary)' }}>{term} boxes</h3>
          {!loaded ? <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading…</p> : boxes.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No boxes added</p>
          ) : boxes.map((box, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={box} onChange={e => { const n = [...boxes]; n[i] = e.target.value; setBoxes(n) }} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14 }} />
              <button type="button" className="btn btn-danger" onClick={async () => {
                if (await confirm({ title: 'Remove this box?', message: `"${box}" will be removed from the list.`, confirmLabel: 'Remove box', tone: 'danger' })) setBoxes(boxes.filter((_, j) => j !== i))
              }}>Remove</button>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 16, height: 'fit-content' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: 'var(--text-primary)' }}>Add box to {term}</h3>
          <input value={newBox} placeholder="e.g. Quiz 1, End Term" onChange={e => setNewBox(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14, marginBottom: 8 }} />
          <button type="button" className="btn btn-secondary" style={{ width: '100%', marginBottom: 8 }} onClick={add}>+ Add box</button>
          <button type="button" className="btn btn-primary" style={{ width: '100%' }} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save boxes'}</button>
        </div>
      </div>
    </PageShell>
  )
}
