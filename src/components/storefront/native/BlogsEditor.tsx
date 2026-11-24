'use client'

import { useState, type ReactNode } from 'react'
import { ArrowLeft, Code, Eye, EyeOff, Loader2, Save } from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { blogsSlugify, saveBlog, type BlogRow } from './BlogsData'

const muted = { fontSize: 12, color: 'var(--text-muted)' }
const grid = (cols: string) => ({ display: 'grid', gap: 12, gridTemplateColumns: cols })

function Field({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{title}</label>
      {children}
      {hint && <div style={{ ...muted, fontSize: 11, marginTop: 2 }}>{hint}</div>}
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

// Rendered in a sandboxed iframe with no script permission, so pasted HTML cannot run code here.
function previewDoc(html: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;line-height:1.7;padding:16px 20px;margin:0;font-size:15px}
h1,h2,h3{color:#0f172a;line-height:1.3;margin:1.4em 0 .5em}h2{font-size:1.4em}h3{font-size:1.15em}
a{color:#2563eb}img{max-width:100%;height:auto;border-radius:8px}table{border-collapse:collapse}td,th{border:1px solid #e2e8f0;padding:6px 10px}
blockquote{border-left:3px solid #cbd5e1;margin:1em 0;padding-left:12px;color:#475569}pre,code{background:#f1f5f9;border-radius:4px;padding:2px 4px}
</style></head><body>${html || '<p style="color:#94a3b8">Nothing to preview yet.</p>'}</body></html>`
}

export default function BlogsEditor({ initial, onClose, onSaved }: { initial: BlogRow; onClose: () => void; onSaved: () => void }) {
  const [blog, setBlog] = useState<BlogRow>(initial)
  // Never auto-overwrite the slug of an existing post.
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [preview, setPreview] = useState(false)
  const { confirm, confirmDialog } = useConfirmDialog()

  const setField = <K extends keyof BlogRow>(key: K, value: BlogRow[K]) => {
    setBlog((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const onTitleChange = (value: string) => {
    setBlog((prev) => ({ ...prev, title: value, slug: slugTouched ? prev.slug : blogsSlugify(value) }))
    setDirty(true)
  }

  const close = async () => {
    if (dirty) {
      const ok = await confirm({ title: 'Discard changes?', message: 'Your unsaved changes to this post will be lost.', confirmLabel: 'Discard', tone: 'danger' })
      if (!ok) return
    }
    onClose()
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    const err = await saveBlog(blog)
    setSaving(false)
    if (err) { setError(err); return }
    setDirty(false)
    onSaved()
  }

  const published = Boolean(Number(blog.published))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {confirmDialog}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={close} title="Back to all posts"><ArrowLeft size={14} /> All posts</button>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{blog.id ? 'Edit blog' : 'Create blog'}</h2>
            <div style={{ ...muted, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blog.title || 'Write and publish a post'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={close} disabled={saving}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {blog.id ? 'Save changes' : 'Publish blog'}
          </button>
        </div>
      </div>

      {error && <div className="badge badge-danger" style={{ padding: '8px 12px', fontSize: 13, whiteSpace: 'normal' }}>{error}</div>}

      <Section title="Post">
        <Field title="Title">
          <input className="form-input" value={blog.title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Eye-catching blog title" />
        </Field>
        <div style={grid('repeat(auto-fit, minmax(220px, 1fr))')}>
          <Field title="Slug (URL)" hint={blog.slug ? `/blog/${blog.slug}` : 'Generated from the title'}>
            <input
              className="form-input"
              value={blog.slug}
              onChange={(e) => { setSlugTouched(true); setField('slug', blogsSlugify(e.target.value)) }}
              placeholder="auto-generated-from-title"
            />
          </Field>
          <Field title="Category">
            <input className="form-input" value={blog.category} onChange={(e) => setField('category', e.target.value)} placeholder="e.g. IIT Madras BS Degree" />
          </Field>
        </div>
        <Field title="Thumbnail Image URL">
          <input className="form-input" value={blog.image} onChange={(e) => setField('image', e.target.value)} placeholder="/Image/your-thumbnail.png or https://..." />
        </Field>
        {/^https?:\/\//i.test(blog.image.trim()) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={blog.image.trim()} alt="Thumbnail preview" style={{ maxWidth: 260, maxHeight: 150, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
        )}
        <div style={grid('repeat(auto-fit, minmax(170px, 1fr))')}>
          <Field title="Display Date">
            <input className="form-input" value={blog.date} onChange={(e) => setField('date', e.target.value)} placeholder="May 15, 2026" />
          </Field>
          <Field title="Read Time">
            <input className="form-input" value={blog.read_time} onChange={(e) => setField('read_time', e.target.value)} placeholder="7 min read" />
          </Field>
          <Field title="Status">
            <button
              type="button"
              className={`btn btn-sm ${published ? 'btn-success' : 'btn-secondary'}`}
              style={{ justifyContent: 'center', padding: '10px 14px' }}
              onClick={() => setField('published', published ? 0 : 1)}
            >
              {published ? <><Eye size={14} /> Published</> : <><EyeOff size={14} /> Draft</>}
            </button>
          </Field>
        </div>
      </Section>

      <Section title="Content (HTML)">
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn btn-sm ${!preview ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPreview(false)}><Code size={14} /> HTML</button>
          <button className={`btn btn-sm ${preview ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPreview(true)}><Eye size={14} /> Preview</button>
        </div>
        {preview ? (
          <iframe
            title="Post preview"
            sandbox="allow-popups"
            srcDoc={previewDoc(blog.content)}
            style={{ width: '100%', minHeight: 420, border: '1px solid var(--border)', borderRadius: 12, background: '#fff' }}
          />
        ) : (
          <textarea
            className="form-input"
            value={blog.content}
            onChange={(e) => setField('content', e.target.value)}
            rows={16}
            placeholder="<p>Write your post using HTML. Use <h2> for sections, <a href> for links, <strong> for emphasis.</p>"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6, resize: 'vertical', minHeight: 280 }}
          />
        )}
        <div style={{ ...muted, fontSize: 11 }}>
          Tip: paste HTML. <code>&lt;h2&gt;</code> headings, <code>&lt;p&gt;</code> paragraphs and <code>&lt;a&gt;</code> links are styled automatically on the live post.
        </div>
      </Section>

      <Section title="SEO (optional)">
        <Field title="SEO Title">
          <input className="form-input" value={blog.seo_title || ''} onChange={(e) => setField('seo_title', e.target.value)} />
        </Field>
        <Field title="SEO Description">
          <textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={blog.seo_description || ''} onChange={(e) => setField('seo_description', e.target.value)} />
        </Field>
        <Field title="SEO Keywords (comma separated)">
          <input className="form-input" value={blog.seo_keywords || ''} onChange={(e) => setField('seo_keywords', e.target.value)} />
        </Field>
      </Section>
    </div>
  )
}
