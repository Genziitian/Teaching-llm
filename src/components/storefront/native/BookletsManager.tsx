'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { supabase } from './storefrontDb'
import {
  BINDINGS, BOOKLET_LEVELS, COVERS, discountPercent, fetchBooklets, newBooklet, saveBooklets,
  type Booklet, type BookletAction, type BookletBinding, type BookletCover,
} from './BookletsData'

const row = { display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }
const muted = { fontSize: 12, color: 'var(--text-muted)' }

function Field({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{title}</label>
      {children}
      {hint && <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)' }}>{title}</div>
      {children}
    </div>
  )
}

const grid = (cols: string) => ({ display: 'grid', gap: 12, gridTemplateColumns: cols })

export default function BookletsManager() {
  const [items, setItems] = useState<Booklet[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [courses, setCourses] = useState<{ id: string; name: string; price: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetchBooklets().then((b) => { setItems(b); setSelectedId(b[0]?.id ?? null); setLoading(false) })
    supabase.from('courses').select('id, name, price').order('name').then(({ data }: any) => setCourses((data as any[]) || []))
  }, [])

  const selected = items.find((b) => b.id === selectedId) || null
  const update = (next: Booklet[]) => { setItems(next); setDirty(true); setStatus(null) }
  const edit = (patch: Partial<Booklet>) => selected && update(items.map((b) => (b.id === selected.id ? { ...b, ...patch } : b)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    update(next)
  }
  const add = (kind: 'single' | 'bundle') => {
    const b = newBooklet(kind)
    update([...items, b])
    setSelectedId(b.id)
  }
  const duplicate = (b: Booklet) => {
    const copy = { ...b, id: `bk-${Date.now().toString(36)}`, title: `${b.title} (copy)`, active: false }
    update([...items, copy])
    setSelectedId(copy.id)
  }
  const remove = (b: Booklet) => {
    if (!window.confirm(`Delete "${b.title}"? (Not saved until you press Save)`)) return
    const next = items.filter((x) => x.id !== b.id)
    update(next)
    if (selectedId === b.id) setSelectedId(next[0]?.id ?? null)
  }

  const save = async () => {
    const cleaned = items.map((b) => ({ ...b, title: b.title.trim(), contents: b.contents.map((c) => c.trim()).filter(Boolean) }))
    if (cleaned.find((b) => !b.title)) { setStatus({ ok: false, text: 'Every booklet needs a name.' }); return }
    setSaving(true)
    const { error } = await saveBooklets(cleaned)
    setSaving(false)
    if (error) { setStatus({ ok: false, text: error.message || 'Could not save. Please try again.' }); return }
    setItems(cleaned)
    setDirty(false)
    setStatus({ ok: true, text: 'Saved. Booklets are live on the storefront.' })
  }

  const linkedCourse = useMemo(() => courses.find((c) => String(c.id) === selected?.courseId), [courses, selected?.courseId])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 className="animate-spin" size={24} /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Booklets</h2>
          <p style={{ ...muted, fontSize: 13, margin: '2px 0 0' }}>Storefront booklets. Bundles appear above single booklets, in this order.</p>
        </div>
        <div style={row}>
          <button className="btn btn-secondary btn-sm" onClick={() => add('single')}><Plus size={14} /> Single booklet</button>
          <button className="btn btn-secondary btn-sm" onClick={() => add('bundle')}><Plus size={14} /> Bundle</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
        </div>
      </div>

      {status && <div className={`badge ${status.ok ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 12px', fontSize: 13 }}>{status.text}</div>}
      {dirty && !status && <div className="badge badge-warning" style={{ padding: '8px 12px', fontSize: 13 }}>You have unsaved changes.</div>}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.length === 0 && <div className="card" style={{ padding: 24, textAlign: 'center', ...muted }}>No booklets yet.</div>}
          {items.map((b, i) => (
            <div
              key={b.id}
              className="card"
              onClick={() => setSelectedId(b.id)}
              style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', outline: selectedId === b.id ? '2px solid var(--primary, #6366f1)' : 'none' }}
            >
              <span style={{ width: 28, height: 38, borderRadius: 6, border: '2px solid #0b1120', background: COVERS[b.cover].bg, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: b.active ? 'var(--text-primary)' : 'var(--text-muted)', textDecoration: b.active ? 'none' : 'line-through' }}>{b.title || 'Untitled'}</div>
                <div style={muted}>{b.kind === 'bundle' ? 'Bundle' : b.subject || 'Single'} · {b.level} · {b.price <= 0 ? 'Free' : `₹${b.price}`}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button className="btn-icon" title="Move up" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(i, -1) }}><ArrowUp size={14} /></button>
                <button className="btn-icon" title="Move down" disabled={i === items.length - 1} onClick={(e) => { e.stopPropagation(); move(i, 1) }}><ArrowDown size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, gridColumn: 'span 2', minWidth: 0 }}>
            <div style={row}>
              <button className={`btn btn-sm ${selected.active ? 'btn-success' : 'btn-secondary'}`} onClick={() => edit({ active: !selected.active })}>
                {selected.active ? <Eye size={14} /> : <EyeOff size={14} />} {selected.active ? 'Visible on site' : 'Hidden'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => duplicate(selected)}><Copy size={14} /> Duplicate</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(selected)}><Trash2 size={14} /> Delete</button>
            </div>

            <Section title="Name & details">
              <div style={grid('repeat(auto-fit, minmax(180px, 1fr))')}>
                <Field title="Type">
                  <select className="form-input" value={selected.kind} onChange={(e) => edit({ kind: e.target.value as Booklet['kind'] })}>
                    <option value="single">Single booklet</option>
                    <option value="bundle">Bundle (several booklets)</option>
                  </select>
                </Field>
                <Field title="Level">
                  <select className="form-input" value={selected.level} onChange={(e) => edit({ level: e.target.value })}>
                    {BOOKLET_LEVELS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </Field>
              </div>
              <Field title="Name (shown on the cover)">
                <input className="form-input" value={selected.title} onChange={(e) => edit({ title: e.target.value })} placeholder="Maths 1 Quiz 1 Booklet" />
              </Field>
              <div style={grid('repeat(auto-fit, minmax(140px, 1fr))')}>
                <Field title="Subject" hint={selected.kind === 'single' ? 'Used for the subject filter' : undefined}>
                  <input className="form-input" value={selected.subject} onChange={(e) => edit({ subject: e.target.value })} placeholder="Maths 1" />
                </Field>
                <Field title="Term"><input className="form-input" value={selected.term} onChange={(e) => edit({ term: e.target.value })} placeholder="Term 1" /></Field>
                <Field title="Exam"><input className="form-input" value={selected.exam} onChange={(e) => edit({ exam: e.target.value })} placeholder="Quiz 1" /></Field>
              </div>
              <Field title="Description">
                <textarea className="form-input" style={{ minHeight: 72, resize: 'vertical' }} value={selected.description} onChange={(e) => edit({ description: e.target.value })} />
              </Field>
              <div style={grid('repeat(auto-fit, minmax(180px, 1fr))')}>
                <Field title="Badge on cover" hint="Optional, e.g. New, Free, Bestseller"><input className="form-input" value={selected.badge} onChange={(e) => edit({ badge: e.target.value })} /></Field>
                <Field title="Pages" hint="0 hides it"><input type="number" min={0} className="form-input" value={selected.pages} onChange={(e) => edit({ pages: Math.max(0, Number(e.target.value) || 0) })} /></Field>
              </div>
            </Section>

            <Section title={selected.kind === 'bundle' ? 'Booklets in this bundle' : 'What it contains'}>
              <Field title="One item per line" hint="The first 3 show on the front cover; all of them show when the cover opens.">
                <textarea
                  className="form-input"
                  style={{ minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
                  value={selected.contents.join('\n')}
                  onChange={(e) => edit({ contents: e.target.value.split('\n') })}
                  placeholder={selected.kind === 'bundle' ? 'Maths 1 Quiz 1 Booklet\nStats 1 Quiz 1 Booklet' : 'Week 1 · Set Theory\nWeek 2 · Coordinate Geometry'}
                />
              </Field>
            </Section>

            <Section title="Price">
              <div style={grid('repeat(auto-fit, minmax(180px, 1fr))')}>
                <Field title="Price (₹)" hint="0 = Free"><input type="number" min={0} className="form-input" value={selected.price} onChange={(e) => edit({ price: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                <Field title="Original price / MRP (₹)" hint="Shown struck through. 0 hides it"><input type="number" min={0} className="form-input" value={selected.mrp} onChange={(e) => edit({ mrp: Math.max(0, Number(e.target.value) || 0) })} /></Field>
              </div>
              <div style={muted}>
                {selected.price <= 0 ? 'Shows as Free with a "FREE" stamp.' : discountPercent(selected) > 0 ? `Shows a ${discountPercent(selected)}% OFF stamp.` : 'No discount stamp.'}
              </div>
            </Section>

            <Section title="Button">
              <Field title="When someone clicks the button">
                <select className="form-input" value={selected.action} onChange={(e) => edit({ action: e.target.value as BookletAction })}>
                  <option value="pdf">Open a PDF link (free download)</option>
                  <option value="checkout">Go to checkout for a course / bundle</option>
                  <option value="link">Open another link (payment page etc.)</option>
                </select>
              </Field>
              {selected.action === 'pdf' && (
                <Field title="PDF link" hint="Google Drive: set sharing to 'Anyone with the link'.">
                  <input className="form-input" value={selected.pdfUrl} onChange={(e) => edit({ pdfUrl: e.target.value })} placeholder="https://drive.google.com/file/d/…/view" />
                </Field>
              )}
              {selected.action === 'checkout' && (
                <Field title="Course / bundle to sell" hint="Checkout charges that course's price.">
                  <select className="form-input" value={selected.courseId} onChange={(e) => edit({ courseId: e.target.value })}>
                    <option value="">— Pick a course —</option>
                    {courses.map((c) => <option key={c.id} value={String(c.id)}>{c.name} (₹{c.price})</option>)}
                  </select>
                  {linkedCourse && Number(linkedCourse.price) !== selected.price && (
                    <div className="badge badge-warning" style={{ marginTop: 8, padding: '6px 10px', fontSize: 12 }}>
                      Checkout charges ₹{linkedCourse.price}, but this booklet shows ₹{selected.price}.{' '}
                      <button className="btn btn-ghost btn-sm" onClick={() => edit({ price: Number(linkedCourse.price) || 0 })}>Use ₹{linkedCourse.price}</button>
                    </div>
                  )}
                </Field>
              )}
              {selected.action === 'link' && (
                <Field title="Link"><input className="form-input" value={selected.buyUrl} onChange={(e) => edit({ buyUrl: e.target.value })} placeholder="https://…" /></Field>
              )}
              <Field title="Button text" hint="Leave blank for automatic: “Get for Free” or “Get for ₹price”">
                <input className="form-input" value={selected.buttonLabel} onChange={(e) => edit({ buttonLabel: e.target.value })} />
              </Field>
            </Section>

            <Section title="Design">
              <Field title="Cover colour">
                <div style={row}>
                  {(Object.keys(COVERS) as BookletCover[]).map((k) => (
                    <button
                      key={k}
                      title={COVERS[k].label}
                      onClick={() => edit({ cover: k })}
                      style={{ width: 36, height: 36, borderRadius: 8, cursor: 'pointer', background: COVERS[k].bg, border: selected.cover === k ? '3px solid var(--text-primary)' : '2px solid var(--border)' }}
                    />
                  ))}
                </div>
              </Field>
              <Field title="Binding">
                <select className="form-input" value={selected.binding} onChange={(e) => edit({ binding: e.target.value as BookletBinding })}>
                  {(Object.keys(BINDINGS) as BookletBinding[]).map((k) => <option key={k} value={k}>{BINDINGS[k]}</option>)}
                </select>
              </Field>
            </Section>
          </div>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center', gridColumn: 'span 2', ...muted }}>Pick a booklet on the left, or add one.</div>
        )}
      </div>
    </div>
  )
}
