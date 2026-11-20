'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import PageShell from '../PageShell'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { DEFAULT_COURSE_FAQS, fetchCourseFaqs, saveCourseFaqs, type CourseFaq } from './FaqsData'

const muted = { fontSize: 12, color: 'var(--text-muted)' }

/** Course FAQs shown at the bottom of every storefront course page (settings key `course_faqs`). */
export default function FaqsManager() {
  const [faqs, setFaqs] = useState<CourseFaq[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const { confirm, confirmDialog } = useConfirmDialog()

  useEffect(() => {
    let alive = true
    fetchCourseFaqs().then(({ faqs: f, error }) => {
      if (!alive) return
      setFaqs(f)
      setLoadError(error)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const update = (next: CourseFaq[]) => { setFaqs(next); setDirty(true); setStatus(null) }
  const edit = (i: number, patch: Partial<CourseFaq>) => update(faqs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= faqs.length) return
    const next = [...faqs]
    ;[next[i], next[j]] = [next[j], next[i]]
    update(next)
  }
  const remove = async (i: number) => {
    const ok = await confirm({ title: 'Delete this FAQ?', message: 'It is removed when you press Save.', confirmLabel: 'Delete', tone: 'danger' })
    if (ok) update(faqs.filter((_, idx) => idx !== i))
  }
  const add = () => update([...faqs, { id: `faq-${Date.now()}`, question: '', answer: '' }])
  const reset = async () => {
    const ok = await confirm({
      title: 'Restore default FAQs?',
      message: `Replace all FAQs with the ${DEFAULT_COURSE_FAQS.length} defaults? (Not saved until you press Save)`,
      confirmLabel: 'Use defaults',
      tone: 'default',
    })
    if (ok) update(DEFAULT_COURSE_FAQS.map((f) => ({ ...f })))
  }

  const save = async () => {
    const cleaned = faqs
      .map((f) => ({ ...f, question: f.question.trim(), answer: f.answer.trim() }))
      .filter((f) => f.question && f.answer)
    setSaving(true)
    const error = await saveCourseFaqs(cleaned)
    setSaving(false)
    if (error) { setStatus({ ok: false, text: error }); return }
    setFaqs(cleaned)
    setDirty(false)
    setLoadError(null)
    setStatus({ ok: true, text: 'Saved. These FAQs now show on every course page.' })
  }

  return (
    <PageShell
      title="Course FAQs"
      description="Shown at the bottom of every course page. Empty rows are skipped when saving."
      actions={
        <>
          <button className="btn btn-secondary btn-sm" onClick={() => void reset()} disabled={loading}><RotateCcw size={14} /> Defaults</button>
          <button className="btn btn-primary btn-sm" onClick={() => void save()} disabled={loading || saving || !dirty}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
        </>
      }
    >
      {confirmDialog}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 className="animate-spin" size={24} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loadError && (
            <div className="badge badge-danger" style={{ padding: '8px 12px', fontSize: 13, whiteSpace: 'normal' }}>
              Could not load the saved FAQs ({loadError}). Showing the defaults; saving will replace what is stored.
            </div>
          )}
          {status && <div className={`badge ${status.ok ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 12px', fontSize: 13, whiteSpace: 'normal' }}>{status.text}</div>}
          {dirty && !status && <div className="badge badge-warning" style={{ padding: '8px 12px', fontSize: 13 }}>You have unsaved changes.</div>}

          {faqs.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center', ...muted }}>No FAQs. Add one, or restore the defaults.</div>
          )}

          {faqs.map((f, i) => (
            <div key={f.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)' }}>FAQ {i + 1}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0} title="Move up"><ArrowUp size={14} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === faqs.length - 1} title="Move down"><ArrowDown size={14} /></button>
                  <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => void remove(i)} title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
              <input className="form-input" placeholder="Question" value={f.question} onChange={(e) => edit(i, { question: e.target.value })} />
              <textarea
                className="form-input"
                placeholder="Answer"
                style={{ minHeight: 84, resize: 'vertical' }}
                value={f.answer}
                onChange={(e) => edit(i, { answer: e.target.value })}
              />
            </div>
          ))}

          <div>
            <button className="btn btn-secondary btn-sm" onClick={add} style={{ borderStyle: 'dashed' }}><Plus size={14} /> Add FAQ</button>
          </div>
        </div>
      )}
    </PageShell>
  )
}
