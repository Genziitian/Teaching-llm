'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Save, Star, Trash2 } from 'lucide-react'
import { DEFAULT_COURSE_REVIEWS, fetchCourseReviews, saveCourseReviews, type CourseReview } from './ReviewsData'

const muted = { fontSize: 13, color: 'var(--text-muted)' }

export default function ReviewsManager() {
  const [reviews, setReviews] = useState<CourseReview[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetchCourseReviews().then((r) => { setReviews(r); setLoading(false) })
  }, [])

  const update = (next: CourseReview[]) => { setReviews(next); setDirty(true); setStatus(null) }
  const edit = (i: number, patch: Partial<CourseReview>) => update(reviews.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= reviews.length) return
    const next = [...reviews]
    ;[next[i], next[j]] = [next[j], next[i]]
    update(next)
  }
  const remove = (i: number) => {
    if (!window.confirm('Delete this review?')) return
    update(reviews.filter((_, idx) => idx !== i))
  }
  const add = () => update([...reviews, { id: `rev-${Date.now()}`, name: '', term: '', stars: 5, comment: '' }])
  const reset = () => {
    if (!window.confirm('Replace all reviews with the defaults? (Not saved until you press Save)')) return
    update(DEFAULT_COURSE_REVIEWS)
  }

  const save = async () => {
    const cleaned = reviews
      .map((r) => ({ ...r, name: r.name.trim(), term: r.term.trim(), comment: r.comment.trim() }))
      .filter((r) => r.name && r.comment)
    setSaving(true)
    const { error } = await saveCourseReviews(cleaned)
    setSaving(false)
    if (error) { setStatus({ ok: false, text: error.message || 'Could not save. Please try again.' }); return }
    setReviews(cleaned)
    setDirty(false)
    setStatus({ ok: true, text: cleaned.length ? 'Saved. These reviews now show on every course page.' : 'Saved. The reviews section is hidden because the list is empty.' })
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 className="animate-spin" size={24} /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Course reviews</h2>
          <p style={{ ...muted, margin: '2px 0 0' }}>Shown on every storefront course page, above the FAQs. Rows without a name or comment are skipped when saving.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={reset}><RotateCcw size={14} /> Defaults</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
        </div>
      </div>

      {status && <div className={`badge ${status.ok ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 12px', fontSize: 13 }}>{status.text}</div>}

      {reviews.map((r, i) => (
        <div key={r.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)' }}>Review {i + 1}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-icon" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
              <button className="btn-icon" title="Move down" disabled={i === reviews.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
              <button className="btn-icon" title="Delete" onClick={() => remove(i)}><Trash2 size={16} /></button>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <input className="form-input" placeholder="Student name" value={r.name} onChange={(e) => edit(i, { name: e.target.value })} />
            <input className="form-input" placeholder="Term (e.g. Qualifier, Foundation)" value={r.term} onChange={(e) => edit(i, { term: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 2 }} role="radiogroup" aria-label="Stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => edit(i, { stars: n })} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}>
                <Star size={20} fill={n <= r.stars ? '#fbbf24' : 'none'} color={n <= r.stars ? '#fbbf24' : 'var(--text-muted)'} />
              </button>
            ))}
          </div>
          <textarea className="form-input" style={{ minHeight: 84, resize: 'vertical' }} placeholder="Comment" value={r.comment} onChange={(e) => edit(i, { comment: e.target.value })} />
        </div>
      ))}

      <div><button className="btn btn-secondary btn-sm" onClick={add}><Plus size={14} /> Add review</button></div>
    </div>
  )
}
