'use client'

import { useState } from 'react'
import { getYouTubeId, type CourseFaq, type CourseFaqDraft, type CoursePageDraft, type FeedbackNote } from './CoursesPageContent'

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14 }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }
const hintStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', margin: 0 }
const sectionStyle: React.CSSProperties = { borderTop: '1px solid var(--border)', paddingTop: 16, display: 'grid', gap: 12 }
const grid = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' } as const

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>
}

function SectionHead({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <b style={{ fontSize: 15, color: 'var(--text-primary)' }}>{title}</b>
        {hint && <p style={{ ...hintStyle, marginTop: 2 }}>{hint}</p>}
      </div>
      {action}
    </div>
  )
}

function Stars({ n }: { n?: number }) {
  const v = Math.max(0, Math.min(5, Math.round(n ?? 5)))
  return <span aria-label={`${v} out of 5 stars`} style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 1 }}>{'★'.repeat(v)}<span style={{ color: 'var(--border)' }}>{'★'.repeat(5 - v)}</span></span>
}

/* -------------------------------------------------------------- FAQs */

export function CoursesFaqEditor({
  draft, onChange, who, onWhoChange, loading,
}: {
  draft: CourseFaqDraft
  onChange: (next: CourseFaqDraft) => void
  who: string
  onWhoChange: (v: string) => void
  loading: boolean
}) {
  const list = draft.custom
  const setList = (custom: CourseFaq[]) => onChange({ ...draft, custom })
  const edit = (i: number, patch: Partial<CourseFaq>) => setList(list.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    setList(next)
  }
  const switchMode = (useCustom: boolean) => {
    // Start a new custom list from the shared FAQs so the manager edits rather than retypes.
    if (useCustom && list.length === 0) onChange({ ...draft, useCustom, custom: draft.shared.map((f, i) => ({ ...f, id: `faq-${Date.now()}-${i}` })) })
    else onChange({ ...draft, useCustom })
  }

  return (
    <div style={sectionStyle}>
      <SectionHead title="FAQs" hint="Questions shown at the bottom of this course's page." />

      <Field label='"Why join this batch?" answer (new page design)'>
        <textarea style={{ ...inputStyle, minHeight: 70 }} value={who} placeholder="Leave empty to use the standard answer for this course." onChange={e => onWhoChange(e.target.value)} />
      </Field>

      {loading ? <p style={hintStyle}>Loading FAQs…</p> : (
        <>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-primary)' }}>
              <input type="radio" name="course-faq-mode" checked={!draft.useCustom} onChange={() => switchMode(false)} /> Use the shared FAQs ({draft.shared.length})
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-primary)' }}>
              <input type="radio" name="course-faq-mode" checked={draft.useCustom} onChange={() => switchMode(true)} /> Custom FAQs for this course
            </label>
          </div>

          {!draft.useCustom ? (
            <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
              <p style={hintStyle}>These come from the FAQs page and are shared by every course. Pick &ldquo;Custom&rdquo; to give this course its own list.</p>
              {draft.shared.length === 0 && <p style={hintStyle}>No shared FAQs are set.</p>}
              {draft.shared.map((f, i) => (
                <div key={f.id}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{i + 1}. {f.question}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{f.answer}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <p style={hintStyle}>Empty rows are skipped when saving. Saving an empty list shows no FAQs for this course.</p>
              {list.map((f, i) => (
                <div key={f.id} className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>FAQ {i + 1}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" className="btn btn-ghost" disabled={i === 0} onClick={() => move(i, -1)} title="Move up" aria-label="Move up">↑</button>
                      <button type="button" className="btn btn-ghost" disabled={i === list.length - 1} onClick={() => move(i, 1)} title="Move down" aria-label="Move down">↓</button>
                      <button type="button" className="btn btn-danger" onClick={() => setList(list.filter((_, j) => j !== i))}>Remove</button>
                    </div>
                  </div>
                  <input style={inputStyle} placeholder="Question" value={f.question} onChange={e => edit(i, { question: e.target.value })} />
                  <textarea style={{ ...inputStyle, minHeight: 72 }} placeholder="Answer" value={f.answer} onChange={e => edit(i, { answer: e.target.value })} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setList([...list, { id: `faq-${Date.now()}`, question: '', answer: '' }])}>+ Add FAQ</button>
                <button type="button" className="btn btn-ghost" onClick={() => setList(draft.shared.map((f, i) => ({ ...f, id: `faq-${Date.now()}-${i}` })))}>Copy shared FAQs</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------ Reviews / video / theme */

export function CoursesReviewVideoEditor({
  draft, onChange, loading, themeLockedTo,
}: {
  draft: CoursePageDraft
  onChange: (next: CoursePageDraft) => void
  loading: boolean
  /** Set when the course row itself forces a design (design_theme / theme column). */
  themeLockedTo?: 'old' | 'new' | null
}) {
  const [note, setNote] = useState({ name: '', role: '', text: '', rating: 5 })
  const [noteError, setNoteError] = useState('')
  const set = <K extends keyof CoursePageDraft>(k: K, v: CoursePageDraft[K]) => onChange({ ...draft, [k]: v })

  if (loading) {
    return <div style={sectionStyle}><SectionHead title="Course page: design, video and reviews" /><p style={hintStyle}>Loading page settings…</p></div>
  }

  const videoId = getYouTubeId(draft.videoUrl)
  const selected = draft.reviewIds
    .map(id => draft.bank.find(n => n.id === id))
    .filter((n): n is FeedbackNote => !!n)
  const toggle = (id: string) => set('reviewIds', draft.reviewIds.includes(id) ? draft.reviewIds.filter(x => x !== id) : [...draft.reviewIds, id])
  const move = (id: string, dir: -1 | 1) => {
    const ids = selected.map(n => n.id)
    const i = ids.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    set('reviewIds', ids)
  }
  const addNote = () => {
    const name = note.name.trim(), role = note.role.trim(), text = note.text.trim()
    if (!name || !role || !text) { setNoteError('Add a name, the batch they were in, and the feedback.'); return }
    const n: FeedbackNote = { id: `note-${Date.now()}`, name, role, text, rating: note.rating }
    onChange({ ...draft, bank: [...draft.bank, n], reviewIds: [...draft.reviewIds, n.id] })
    setNote({ name: '', role: '', text: '', rating: 5 })
    setNoteError('')
  }

  return (
    <div style={sectionStyle}>
      <SectionHead title="Course page: design, video and reviews" hint="The video and selected reviews appear on the new page design." />

      <div style={grid}>
        <Field label="Page design">
          <select style={inputStyle} value={draft.theme} onChange={e => set('theme', e.target.value === 'new' ? 'new' : 'old')}>
            <option value="old">Classic</option>
            <option value="new">New</option>
          </select>
        </Field>
      </div>
      {themeLockedTo && themeLockedTo !== draft.theme && (
        <p style={{ ...hintStyle, color: 'var(--text-secondary)' }}>
          This course&apos;s record forces the {themeLockedTo === 'new' ? 'new' : 'classic'} design, so the site keeps showing that one.
        </p>
      )}

      <Field label="How-to-access video (YouTube link)">
        <input style={inputStyle} value={draft.videoUrl} placeholder="https://www.youtube.com/watch?v=…" onChange={e => set('videoUrl', e.target.value)} />
      </Field>
      {draft.defaultVideoUrl && <p style={hintStyle}>Default for courses without their own video: {draft.defaultVideoUrl}. Saving a video here also makes it the default.</p>}
      {videoId ? (
        <div style={{ maxWidth: 420, aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
          <iframe src={`https://www.youtube.com/embed/${videoId}`} title="Video preview" style={{ width: '100%', height: '100%', border: 0 }} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      ) : draft.videoUrl.trim() ? (
        <p style={{ ...hintStyle, color: 'var(--danger, #dc2626)' }}>That is not a valid YouTube link. Fix it or clear the field before saving.</p>
      ) : null}

      <div style={{ display: 'grid', gap: 8 }}>
        <label style={labelStyle}>Reviews shown on this course ({selected.length} selected)</label>
        {selected.length === 0 && <p style={hintStyle}>No reviews selected. The reviews block is hidden on this course&apos;s page.</p>}
        {selected.map((n, i) => (
          <div key={n.id} className="card" style={{ padding: 10, display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{i + 1}. {n.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {n.role}</span> <Stars n={n.rating} /></div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{n.text}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button type="button" className="btn btn-ghost" disabled={i === 0} onClick={() => move(n.id, -1)} aria-label="Move up">↑</button>
              <button type="button" className="btn btn-ghost" disabled={i === selected.length - 1} onClick={() => move(n.id, 1)} aria-label="Move down">↓</button>
              <button type="button" className="btn btn-secondary" onClick={() => toggle(n.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {draft.bank.some(n => !draft.reviewIds.includes(n.id)) && (
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={labelStyle}>Other reviews you can add</label>
          {draft.bank.filter(n => !draft.reviewIds.includes(n.id)).map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', padding: '8px 10px', border: '1px dashed var(--border)', borderRadius: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{n.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {n.role}</span> <Stars n={n.rating} /></div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{n.text}</div>
              </div>
              <button type="button" className="btn btn-secondary" style={{ flexShrink: 0 }} onClick={() => toggle(n.id)}>Add</button>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <b style={{ fontSize: 13, color: 'var(--text-primary)' }}>Write a new review</b>
        <p style={hintStyle}>New reviews are added to the shared list (available to every course) and selected here. Saved with the course.</p>
        {noteError && <p style={{ ...hintStyle, color: 'var(--danger, #dc2626)' }}>{noteError}</p>}
        <div style={grid}>
          <Field label="Student name"><input style={inputStyle} value={note.name} onChange={e => setNote({ ...note, name: e.target.value })} /></Field>
          <Field label="Batch / programme"><input style={inputStyle} value={note.role} placeholder="e.g. Foundation" onChange={e => setNote({ ...note, role: e.target.value })} /></Field>
          <Field label="Rating">
            <select style={inputStyle} value={note.rating} onChange={e => setNote({ ...note, rating: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} star{r > 1 ? 's' : ''}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Feedback"><textarea style={{ ...inputStyle, minHeight: 70 }} value={note.text} onChange={e => setNote({ ...note, text: e.target.value })} /></Field>
        <div><button type="button" className="btn btn-secondary" onClick={addNote}>+ Add review</button></div>
      </div>
    </div>
  )
}
