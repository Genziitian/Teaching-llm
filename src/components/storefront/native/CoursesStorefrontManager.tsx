'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import PageShell, { LoadNotice } from '@/components/storefront/PageShell'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { DEFAULT_BOX_CONFIG, TERM_OPTIONS, loadBoxConfig, sanitizeCourseId, sfDb, type CourseTerm } from './CoursesDb'
import {
  EMPTY_FAQ_DRAFT, EMPTY_PAGE_DRAFT, cleanFaqs, getYouTubeId, loadCourseFaqDraft, loadCoursePageDraft,
  removeCoursePageContent, saveCourseFaqsFor, saveCoursePageDraft, type CourseFaqDraft, type CoursePageDraft,
} from './CoursesPageContent'
import { CoursesFaqEditor, CoursesReviewVideoEditor } from './CoursesPageContentEditor'

type BundleCourse = { courseId: string; courseId2?: string; courseId3?: string; courseName: string; price: number; [k: string]: any }
type PricingOption = { name: string; price: number; type: 'live' | 'recorded'; tag?: string; description?: string; banner_text?: string }

type Form = {
  id: string; name: string; description: string; cohortContent: string
  price: string; discountPrice: string; subject: string
  class_type: string; active: boolean; isPinned: boolean
  courseCategory: string; term: CourseTerm | 'NONE'; foundationTerm: 'Term 1' | 'Term 2' | 'BOTH'
  exam_stages: string[]; startDate: string; endDate: string; tags: string[]
  isBundle: boolean; isFixedBundle: boolean; bundleCourses: BundleCourse[]
  bundleDiscountPrice: string; bundleDiscountCode: string; bundleDiscountMode: 'all' | 'any'; bundleDiscountMinCourses: number
  pricing_options: PricingOption[]
  who: string
}

const TERM_TAGS = ['Term 1', 'Term 2', 'TERM 1', 'TERM 2', 'Both Terms', 'BOTH']
const day = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : '')

function formFrom(c: any | null): Form {
  const first = c?.bundleCourses?.[0] || {}
  const tags: string[] = c?.tags || []
  return {
    id: c?.id || '', name: c?.name || '', description: c?.description || '', cohortContent: c?.cohortContent || '',
    price: c?.price != null ? String(c.price) : '', discountPrice: c?.discountPrice != null ? String(c.discountPrice) : '',
    subject: c?.subject || '', class_type: c?.class_type || 'recorded', active: c?.active !== false, isPinned: !!c?.isPinned,
    courseCategory: c?.courseCategory || 'NONE', term: c?.term || 'NONE',
    foundationTerm: tags.includes('Term 1') && tags.includes('Term 2') ? 'BOTH' : tags.includes('Term 2') ? 'Term 2' : 'Term 1',
    exam_stages: c?.exam_stages || [], startDate: day(c?.startDate), endDate: day(c?.endDate),
    tags: tags.filter(t => !TERM_TAGS.includes(t)),
    isBundle: !!c?.isBundle, isFixedBundle: !!c?.isFixedBundle,
    bundleCourses: c?.bundleCourses?.length ? c.bundleCourses : [],
    bundleDiscountPrice: String(c?.bundleDiscountAmount || c?.bundleDiscountPrice || first._bundleDiscountAmount || ''),
    bundleDiscountCode: c?.bundleDiscountCode || '',
    bundleDiscountMode: (c?.bundleDiscountMode || first._bundleDiscountMode) === 'any' ? 'any' : 'all',
    bundleDiscountMinCourses: Number(c?.bundleDiscountMinCourses || first._bundleDiscountMinCourses) || 3,
    pricing_options: c?.pricing_options || [],
    who: typeof c?.who === 'string' ? c.who : '',
  }
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14 }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>
}

export default function CoursesStorefrontManager() {
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [boxConfig, setBoxConfig] = useState(DEFAULT_BOX_CONFIG)
  const [editing, setEditing] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Form>(formFrom(null))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const { confirm, confirmDialog } = useConfirmDialog()
  const [faqDraft, setFaqDraft] = useState<CourseFaqDraft>(EMPTY_FAQ_DRAFT)
  const [pageDraft, setPageDraft] = useState<CoursePageDraft>(EMPTY_PAGE_DRAFT)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState('')
  const contentToken = useRef(0)

  const loadContent = useCallback(async (courseId: string | null) => {
    const token = ++contentToken.current
    setContentLoading(true)
    setContentError('')
    setFaqDraft(EMPTY_FAQ_DRAFT)
    setPageDraft(EMPTY_PAGE_DRAFT)
    const [faqs, page] = await Promise.all([loadCourseFaqDraft(courseId), loadCoursePageDraft(courseId)])
    if (token !== contentToken.current) return
    setFaqDraft(faqs.draft)
    setPageDraft(page.draft)
    const err = faqs.error || page.error
    setContentError(err ? `Could not load FAQs / page settings: ${err}` : '')
    setContentLoading(false)
  }, [])

  const load = useCallback(async () => {
    const { data, error: err } = await sfDb('courses', [{ m: 'select', a: ['*'] }, { m: 'order', a: ['name'] }])
    if (err) setError(err.message)
    else { setError(''); setCourses(Array.isArray(data) ? data : []) }
    setLoading(false)
  }, [])

  useEffect(() => { load(); loadBoxConfig().then(r => setBoxConfig(r.config)) }, [load])

  const open = (c: any | null) => { setEditing(c); setCreating(!c); setForm(formFrom(c)); setFormError(''); void loadContent(c?.id ?? null) }
  const close = () => { contentToken.current++; setEditing(null); setCreating(false) }
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))

  const remove = async (c: any) => {
    if (!(await confirm({ title: 'Delete this course?', message: `"${c.name}" will be permanently deleted from the storefront. This can't be undone.`, confirmLabel: 'Delete course', tone: 'danger' }))) return
    const { error: err } = await sfDb('courses', [{ m: 'delete', a: [] }, { m: 'eq', a: ['id', c.id] }])
    if (err) alert(err.message)
    else {
      const cleanupErr = await removeCoursePageContent(c.id)
      if (cleanupErr) console.error('Failed to remove course FAQs / page settings:', cleanupErr)
    }
    load()
  }

  const save = async () => {
    const f = form
    const id = sanitizeCourseId(f.id || (editing?.id ?? ''))
    let price = f.price
    let discountPrice = f.discountPrice
    if (!f.isBundle && f.bundleCourses.length > 0) {
      const main = f.bundleCourses[0].price || 0
      if (discountPrice) discountPrice = String(main); else price = String(main)
    }
    const err =
      !id ? 'Please enter a valid database ID.'
      : !f.name.trim() ? 'Please enter a course name.'
      : f.bundleCourses.length === 0 || f.bundleCourses.some(b => !b.courseId || !b.courseName) ? 'Please fill course ID and name for at least one entry.'
      : !price || isNaN(parseInt(price)) ? 'Please enter a price.'
      : discountPrice && parseInt(discountPrice) >= parseInt(price) ? 'Discount price must be less than the original price.'
      : f.isBundle && f.isFixedBundle && f.pricing_options.length === 1 ? 'Multi-pricing requires at least 2 tiers.'
      : f.isBundle && f.bundleDiscountMode === 'any' && f.bundleDiscountMinCourses > f.bundleCourses.length ? `This bundle has only ${f.bundleCourses.length} course rows. Choose a smaller Any count.`
      : f.term !== 'NONE' && (boxConfig[f.term] || []).length > 0 && f.exam_stages.length === 0 ? 'Please choose at least one box for this course.'
      : contentLoading ? 'FAQs and page settings are still loading. Try again in a moment.'
      : !contentError && pageDraft.videoUrl.trim() && !getYouTubeId(pageDraft.videoUrl) ? 'The course page video must be a valid YouTube link (or empty).'
      : ''
    if (err) { setFormError(err); return }
    const cleanedFaqs = faqDraft.useCustom ? cleanFaqs(faqDraft.custom) : { faqs: [], error: null }
    if (!contentError && cleanedFaqs.error) { setFormError(cleanedFaqs.error); return }

    const bundleDiscount = f.isBundle && f.bundleDiscountPrice ? Number(f.bundleDiscountPrice) : null
    const bundleCourses = f.bundleCourses.map((bc, idx) => {
      const { _bundleDiscountMode, _bundleDiscountMinCourses, _bundleDiscountAmount, ...rest } = bc as any
      if (idx !== 0) return rest
      return {
        ...rest,
        _bundleDiscountAmount: bundleDiscount ?? undefined,
        _bundleDiscountMode: f.isBundle ? f.bundleDiscountMode : undefined,
        _bundleDiscountMinCourses: f.isBundle && f.bundleDiscountMode === 'any' ? f.bundleDiscountMinCourses : undefined,
      }
    })
    const tags = [...f.tags]
    if (f.term === 'Foundation') { if (f.foundationTerm === 'BOTH') tags.push('Term 1', 'Term 2'); else tags.push(f.foundationTerm) }

    const row: any = {
      id, name: f.name, description: f.description, price: parseInt(price),
      isPinned: f.isPinned, active: f.active, class_type: f.class_type || 'recorded',
      learn: Array.isArray(editing?.learn) ? editing.learn : [],
      who: f.who.trim(),
      outcomes: typeof editing?.outcomes === 'string' ? editing.outcomes : '',
      cohortContent: f.cohortContent || null,
      discountPrice: discountPrice ? parseInt(discountPrice) : null,
      isBundle: f.isBundle, bundleCourses,
      bundleDiscountPrice: bundleDiscount, bundleDiscountAmount: bundleDiscount,
      bundleDiscountCode: f.isBundle && f.bundleDiscountCode ? f.bundleDiscountCode : null,
      bundleDiscountMode: f.isBundle ? f.bundleDiscountMode : null,
      bundleDiscountMinCourses: f.isBundle && f.bundleDiscountMode === 'any' ? f.bundleDiscountMinCourses : null,
      isFixedBundle: f.isBundle && f.isFixedBundle,
      pricing_options: f.isBundle && f.isFixedBundle ? f.pricing_options : [],
      subject: f.subject || null, tags, courseCategory: f.courseCategory || 'NONE',
      term: f.term === 'NONE' ? null : f.term,
      startDate: f.startDate ? new Date(f.startDate).toISOString() : null,
      endDate: f.endDate ? new Date(f.endDate).toISOString() : null,
      exam_stages: f.exam_stages,
    }
    const withFallback = async (run: (r: any) => Promise<any>) => {
      let res = await run(row)
      if (res.error && res.error.message?.includes('bundleDiscountAmount')) {
        const { bundleDiscountAmount, ...fallback } = row
        res = await run(fallback)
      }
      return res
    }

    setSaving(true)
    try {
      const prev: string | null = editing?.id || null
      let saveErr: any = null
      if (prev && prev !== id) {
        const ex = await sfDb('courses', [{ m: 'select', a: ['id'] }, { m: 'eq', a: ['id', id] }, { m: 'maybeSingle', a: [] }])
        if (ex.data) { setFormError('That database ID is already in use. Please choose a unique one.'); return }
        const all = await sfDb('courses', [{ m: 'select', a: ['*'] }])
        if (all.error) { setFormError(all.error.message); return }
        const refs = (all.data || [])
          .filter((c: any) => c.id !== prev && c.bundleCourses?.some((b: any) => b.courseId === prev))
          .map((c: any) => ({ ...c, bundleCourses: c.bundleCourses.map((b: any) => (b.courseId === prev ? { ...b, courseId: id } : b)) }))
        const ins = await withFallback(r => sfDb('courses', [{ m: 'insert', a: [r] }]))
        if (ins.error) { setFormError(ins.error.message); return }
        if (refs.length) {
          const u = await sfDb('courses', [{ m: 'upsert', a: [refs] }])
          if (u.error) { setFormError(u.error.message); return }
        }
        const disc = await sfDb('discount_coupons', [{ m: 'select', a: ['*'] }, { m: 'eq', a: ['applies_to', prev] }])
        if (disc.error) { setFormError(disc.error.message); return }
        if ((disc.data || []).length) {
          const u = await sfDb('discount_coupons', [{ m: 'upsert', a: [disc.data.map((d: any) => ({ ...d, applies_to: id }))] }])
          if (u.error) { setFormError(u.error.message); return }
        }
        saveErr = (await sfDb('courses', [{ m: 'delete', a: [] }, { m: 'eq', a: ['id', prev] }])).error
      } else {
        saveErr = (await withFallback(r => sfDb('courses', [{ m: 'upsert', a: [r] }]))).error
      }
      if (saveErr) { setFormError(saveErr.message); return }

      const catalog = [{ id, name: f.name }]
      if (f.isBundle) bundleCourses.forEach((bc: any) => {
        if (!bc.courseName) return
        ;[bc.courseId, bc.courseId2, bc.courseId3].filter(Boolean).forEach((cid: string) => catalog.push({ id: cid, name: bc.courseName }))
      })
      const cat = await sfDb('course_catalog', [{ m: 'upsert', a: [catalog, { onConflict: 'id' }] }])
      if (cat.error) console.error('Failed to sync course catalog:', cat.error.message)

      // FAQs and course page settings are keyed by course ID, so they are written after the course row.
      if (!contentError) {
        const faqErr = await saveCourseFaqsFor(id, faqDraft.useCustom ? cleanedFaqs.faqs : null, prev)
        const pageErr = await saveCoursePageDraft(id, pageDraft, prev)
        if (faqErr || pageErr) {
          // The course row is saved under `id` now: a retry must update it, not rename again.
          setEditing({ ...(editing || {}), ...row })
          setCreating(false)
          setFormError(`Course saved, but ${faqErr ? `FAQs (${faqErr})` : ''}${faqErr && pageErr ? ' and ' : ''}${pageErr ? `page settings (${pageErr})` : ''} could not be saved. Press Save again to retry.`)
          load()
          return
        }
        if (faqDraft.useCustom) setFaqDraft(d => ({ ...d, custom: cleanedFaqs.faqs }))
      }
      close()
      load()
    } finally {
      setSaving(false)
    }
  }

  const boxes = form.term === 'NONE' ? [] : boxConfig[form.term] || []
  const updBundle = (i: number, patch: Partial<BundleCourse>) => set('bundleCourses', form.bundleCourses.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const updTier = (i: number, patch: Partial<PricingOption>) => set('pricing_options', form.pricing_options.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  const check = (label: string, v: boolean, on: (b: boolean) => void) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-primary)' }}>
      <input type="checkbox" checked={v} onChange={e => on(e.target.checked)} /> {label}
    </label>
  )
  const grid = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' } as const
  const badge = (t: string, key?: string) => <span key={key || t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-secondary)', marginRight: 4 }}>{t}</span>

  const showForm = creating || !!editing

  return (
    <PageShell
      title="Storefront Courses"
      description="Courses listed on the website: price, term, boxes, bundles and listing details."
      backHref="/manage"
      backLabel="Manage"
      actions={!showForm ? <button className="btn btn-primary" onClick={() => open(null)}>+ New listing</button> : undefined}
    >
      {confirmDialog}
      {error && <LoadNotice error={error} />}

      {!showForm && !error && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, fontSize: 14, borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                {['Course', 'ID', 'Price', 'Term / Boxes', 'Status', ''].map(h => <th key={h} style={{ padding: '10px 16px', fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
              {!loading && courses.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No courses yet</td></tr>}
              {courses.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-light)', opacity: c.active === false ? 0.6 : 1 }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '10px 16px' }}><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.id}</code></td>
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    {c.discountPrice ? <><s style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 6 }}>₹{c.price}</s><b>₹{c.discountPrice}</b></> : <b>₹{c.price}</b>}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    {badge(c.term || 'No term')}
                    {Array.isArray(c.exam_stages) && c.exam_stages.length > 0 ? c.exam_stages.map((b: string) => badge(b)) : badge('No boxes')}
                  </td>
                  <td style={{ padding: '10px 16px' }}>{c.active === false ? 'Disabled' : 'Active'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-secondary" onClick={() => open(c)}>Edit</button>{' '}
                    <button className="btn btn-danger" onClick={() => remove(c)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ padding: 20, display: 'grid', gap: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{editing ? `Edit: ${editing.name}` : 'New storefront course'}</h2>
          {formError && <LoadNotice error={formError} />}
          <div style={grid}>
            <Field label="Course name"><input style={inputStyle} value={form.name} onChange={e => { set('name', e.target.value); if (!editing) set('id', sanitizeCourseId(e.target.value)) }} /></Field>
            <Field label="URL ID (unique)"><input style={inputStyle} value={form.id} placeholder="python-basics" onChange={e => set('id', e.target.value)} /></Field>
            <Field label="Subject / category"><input style={inputStyle} value={form.subject} placeholder="e.g. Data Science" onChange={e => set('subject', e.target.value)} /></Field>
          </div>
          <Field label="Subtitle / description"><textarea style={{ ...inputStyle, minHeight: 90 }} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
          <Field label="What this cohort includes (one per line)"><textarea style={{ ...inputStyle, minHeight: 120 }} value={form.cohortContent} onChange={e => set('cohortContent', e.target.value)} /></Field>
          <div style={grid}>
            <Field label="Price (₹)"><input style={inputStyle} inputMode="numeric" value={form.price} onChange={e => set('price', e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Discount price (₹, optional)"><input style={inputStyle} inputMode="numeric" value={form.discountPrice} onChange={e => set('discountPrice', e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Class type">
              <select style={inputStyle} value={form.class_type} onChange={e => set('class_type', e.target.value)}><option value="recorded">Recorded</option><option value="live">Live</option></select>
            </Field>
            <Field label="Marketing tag">
              <select style={inputStyle} value={form.courseCategory} onChange={e => set('courseCategory', e.target.value)}>
                <option value="NONE">None</option><option value="QUALIFIER">Qualifier</option><option value="LIVE">Live</option><option value="RECORDED">Recorded</option>
              </select>
            </Field>
            <Field label="Start date"><input type="date" style={inputStyle} value={form.startDate} onChange={e => set('startDate', e.target.value)} /></Field>
            <Field label="End date"><input type="date" style={inputStyle} value={form.endDate} onChange={e => set('endDate', e.target.value)} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {check('Visible to users', form.active, v => set('active', v))}
            {check('Pinned', form.isPinned, v => set('isPinned', v))}
          </div>

          <div style={grid}>
            <Field label="Term">
              <select style={inputStyle} value={form.term} onChange={e => {
                const t = e.target.value as CourseTerm | 'NONE'
                const avail = t === 'NONE' ? [] : boxConfig[t] || []
                setForm(f => ({ ...f, term: t, exam_stages: f.exam_stages.filter(s => avail.includes(s)) }))
              }}>
                <option value="NONE">None</option>
                {TERM_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            {form.term === 'Foundation' && (
              <Field label="Foundation term">
                <select style={inputStyle} value={form.foundationTerm} onChange={e => set('foundationTerm', e.target.value as Form['foundationTerm'])}>
                  <option value="Term 1">Term 1</option><option value="Term 2">Term 2</option><option value="BOTH">Both terms</option>
                </select>
              </Field>
            )}
          </div>
          {form.term !== 'NONE' && (
            <Field label="Boxes">
              {boxes.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No boxes for this term. Add some on the Boxes page.</p> : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {boxes.map(b => {
                    const on = form.exam_stages.includes(b)
                    return <button key={b} type="button" className={on ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => set('exam_stages', on ? form.exam_stages.filter(s => s !== b) : [...form.exam_stages, b])}>{b}</button>
                  })}
                </div>
              )}
            </Field>
          )}

          <Field label="Course tags (max 2, shown on cards)">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {form.tags.map(t => <button key={t} type="button" className="btn btn-secondary" onClick={() => set('tags', form.tags.filter(x => x !== t))}>{t} ×</button>)}
              {form.tags.length < 2 && <button type="button" className="btn btn-ghost" onClick={() => {
                const t = prompt('Enter custom tag text (max 10 chars):')?.trim().substring(0, 10).toUpperCase()
                if (t && !form.tags.includes(t)) set('tags', [...form.tags, t])
              }}>+ Add tag</button>}
            </div>
          </Field>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {check('Bundle (multiple sub-courses)', form.isBundle, v => set('isBundle', v))}
              {form.isBundle && check('Fixed bundle (students cannot unselect)', form.isFixedBundle, v => set('isFixedBundle', v))}
            </div>

            {form.isBundle && (
              <div style={grid}>
                <Field label="Bundle discount (₹)"><input style={inputStyle} inputMode="numeric" value={form.bundleDiscountPrice} onChange={e => set('bundleDiscountPrice', e.target.value.replace(/\D/g, ''))} /></Field>
                <Field label="Discount code"><input style={inputStyle} value={form.bundleDiscountCode} onChange={e => set('bundleDiscountCode', e.target.value)} /></Field>
                <Field label="Discount applies when">
                  <select style={inputStyle} value={form.bundleDiscountMode} onChange={e => set('bundleDiscountMode', e.target.value as 'all' | 'any')}><option value="all">All courses chosen</option><option value="any">Any count chosen</option></select>
                </Field>
                {form.bundleDiscountMode === 'any' && (
                  <Field label="Minimum courses">
                    <select style={inputStyle} value={form.bundleDiscountMinCourses} onChange={e => set('bundleDiscountMinCourses', Number(e.target.value))}>{[1, 2, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}</select>
                  </Field>
                )}
              </div>
            )}

            {form.isBundle && form.isFixedBundle && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 14, color: 'var(--text-primary)' }}>Multi-pricing tiers (2 or 3)</b>
                  {form.pricing_options.length < 3 && <button type="button" className="btn btn-secondary" onClick={() => set('pricing_options', [...form.pricing_options, { name: '', price: 0, type: 'recorded' }])}>+ Add tier</button>}
                </div>
                {form.pricing_options.map((t, i) => (
                  <div key={i} className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
                    <div style={grid}>
                      <Field label="Tier name"><input style={inputStyle} value={t.name} onChange={e => updTier(i, { name: e.target.value })} /></Field>
                      <Field label="Price (₹)"><input style={inputStyle} inputMode="numeric" value={t.price} onChange={e => updTier(i, { price: parseInt(e.target.value) || 0 })} /></Field>
                      <Field label="Class type"><select style={inputStyle} value={t.type} onChange={e => updTier(i, { type: e.target.value as 'live' | 'recorded' })}><option value="recorded">Recorded</option><option value="live">Live</option></select></Field>
                      <Field label="Tag"><select style={inputStyle} value={t.tag || ''} onChange={e => updTier(i, { tag: e.target.value || undefined })}><option value="">None</option><option value="bestseller">Bestseller</option><option value="new">New</option><option value="popular">Popular</option><option value="limited">Limited</option></select></Field>
                    </div>
                    <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 60 }} value={t.description || ''} onChange={e => updTier(i, { description: e.target.value })} /></Field>
                    <Field label="Custom banner text"><input style={inputStyle} value={t.banner_text || ''} onChange={e => updTier(i, { banner_text: e.target.value })} /></Field>
                    <div><button type="button" className="btn btn-danger" onClick={() => set('pricing_options', form.pricing_options.filter((_, j) => j !== i))}>Remove tier</button></div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: 14, color: 'var(--text-primary)' }}>{form.isBundle ? `Included courses (${form.bundleCourses.length}/10)` : 'Main enrollment'}</b>
              {(form.isBundle ? form.bundleCourses.length < 10 : form.bundleCourses.length === 0) && (
                <button type="button" className="btn btn-secondary" onClick={() => set('bundleCourses', [...form.bundleCourses, { courseId: '', courseName: '', price: 0 }])}>+ Add course</button>
              )}
            </div>
            {form.bundleCourses.map((bc, i) => (
              <div key={i} className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
                <div style={grid}>
                  <Field label="Course ID"><input style={inputStyle} value={bc.courseId} onChange={e => updBundle(i, { courseId: e.target.value })} /></Field>
                  {bc.courseId2 !== undefined && <Field label="Extra ID 2"><input style={inputStyle} value={bc.courseId2} onChange={e => updBundle(i, { courseId2: e.target.value })} /></Field>}
                  {bc.courseId3 !== undefined && <Field label="Extra ID 3"><input style={inputStyle} value={bc.courseId3} onChange={e => updBundle(i, { courseId3: e.target.value })} /></Field>}
                  <Field label="Course title"><input style={inputStyle} value={bc.courseName} onChange={e => updBundle(i, { courseName: e.target.value })} /></Field>
                  <Field label="Price (₹)"><input style={inputStyle} inputMode="numeric" value={bc.price} onChange={e => updBundle(i, { price: parseInt(e.target.value) || 0 })} /></Field>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {bc.courseId3 === undefined && <button type="button" className="btn btn-ghost" onClick={() => updBundle(i, bc.courseId2 === undefined ? { courseId2: '' } : { courseId3: '' })}>+ Add extra ID</button>}
                  {form.isBundle && <button type="button" className="btn btn-danger" onClick={() => set('bundleCourses', form.bundleCourses.filter((_, j) => j !== i))}>Remove course</button>}
                </div>
              </div>
            ))}
          </div>

          {contentError && (
            <div style={{ display: 'grid', gap: 8 }}>
              <LoadNotice error={`${contentError}. Saving now updates the course only; FAQs and page settings are left unchanged.`} />
              <div><button type="button" className="btn btn-secondary" onClick={() => loadContent(editing?.id ?? null)}>Retry loading</button></div>
            </div>
          )}
          {!contentError && (
            <>
              <CoursesFaqEditor draft={faqDraft} onChange={setFaqDraft} who={form.who} onWhoChange={v => set('who', v)} loading={contentLoading} />
              <CoursesReviewVideoEditor
                draft={pageDraft}
                onChange={setPageDraft}
                loading={contentLoading}
                themeLockedTo={editing?.design_theme === 'new' || editing?.theme === 'new' ? 'new' : editing?.design_theme === 'old' || editing?.theme === 'old' ? 'old' : null}
              />
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={saving || contentLoading} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>
            <button className="btn btn-secondary" disabled={saving} onClick={close}>Cancel</button>
          </div>
        </div>
      )}
    </PageShell>
  )
}
