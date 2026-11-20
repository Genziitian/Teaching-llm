'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit, ExternalLink, Eye, EyeOff, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import PageShell from '../PageShell'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import BlogsEditor from './BlogsEditor'
import { BLOGS_SITE_ORIGIN, deleteBlog, emptyBlog, fetchBlogs, setBlogPublished, type BlogRow } from './BlogsData'

const muted = { fontSize: 12, color: 'var(--text-muted)' }

/**
 * Blogs admin: full CRUD on the storefront `blogs` table (native port of the
 * storefront panel's Blogs tab). Resources/Notes stay on the server admin.
 */
export default function BlogsManager() {
  const [blogs, setBlogs] = useState<BlogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<BlogRow | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const { confirm, confirmDialog } = useConfirmDialog()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchBlogs()
    setBlogs(data)
    setLoadError(error)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return blogs
    return blogs.filter((b) => (b.title || '').toLowerCase().includes(q) || (b.category || '').toLowerCase().includes(q))
  }, [blogs, search])

  const handleDelete = async (blog: BlogRow) => {
    if (!blog.id) return
    const ok = await confirm({
      title: 'Delete this post?',
      message: `“${blog.title || 'Untitled'}” will be permanently deleted. This can’t be undone.`,
      confirmLabel: 'Delete post',
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(blog.id)
    const err = await deleteBlog(blog.id)
    setBusyId(null)
    setNotice(err ? { ok: false, text: `Failed to delete blog: ${err}` } : { ok: true, text: 'Post deleted.' })
    void load()
  }

  const togglePublished = async (blog: BlogRow) => {
    if (!blog.id) return
    const next = !Number(blog.published)
    setBusyId(blog.id)
    const err = await setBlogPublished(blog.id, next)
    setBusyId(null)
    if (err) { setNotice({ ok: false, text: err }); return }
    setBlogs((prev) => prev.map((b) => (b.id === blog.id ? { ...b, published: next ? 1 : 0 } : b)))
    setNotice({ ok: true, text: next ? 'Post published.' : 'Post moved to drafts.' })
  }

  if (editing) {
    return (
      <PageShell title="Blogs" description="Write and publish posts on the genziitian.in blog.">
        <BlogsEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setNotice({ ok: true, text: editing.id ? 'Post saved.' : 'Post published.' })
            setEditing(null)
            void load()
          }}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Blogs"
      description="Write and publish posts on the genziitian.in blog."
      actions={
        <>
          <button className="btn btn-secondary btn-sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setNotice(null); setEditing(emptyBlog()) }}>
            <Plus size={14} /> Create Blog
          </button>
        </>
      }
    >
      {confirmDialog}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search blogs by title or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, padding: '6px 0' }}
          />
        </div>

        {notice && <div className={`badge ${notice.ok ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 12px', fontSize: 13, whiteSpace: 'normal' }}>{notice.text}</div>}
        {loadError && <div className="badge badge-danger" style={{ padding: '8px 12px', fontSize: 13, whiteSpace: 'normal' }}>Failed to load blogs: {loadError}</div>}

        {loading && blogs.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 className="animate-spin" size={24} /></div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{search.trim() ? 'No matching posts' : 'No blogs yet'}</div>
            <div style={muted}>{search.trim() ? 'Try a different search.' : 'Click Create Blog to publish your first post.'}</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table style={{ minWidth: 680 }}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((blog) => {
                    const published = Boolean(Number(blog.published))
                    const busy = busyId === blog.id
                    return (
                      <tr key={blog.id ?? blog.slug}>
                        <td style={{ maxWidth: 340 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blog.title || 'Untitled'}</div>
                          <div style={{ ...muted, fontSize: 11, fontFamily: 'ui-monospace, monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blog.slug}</div>
                        </td>
                        <td><span className="badge badge-gray">{blog.category || 'General'}</span></td>
                        <td>
                          <button
                            className={`badge ${published ? 'badge-success' : 'badge-warning'}`}
                            style={{ border: 'none', cursor: busy ? 'wait' : 'pointer', gap: 4 }}
                            title={published ? 'Click to move to drafts' : 'Click to publish'}
                            disabled={busy}
                            onClick={() => void togglePublished(blog)}
                          >
                            {published ? <Eye size={12} /> : <EyeOff size={12} />} {published ? 'Published' : 'Draft'}
                          </button>
                        </td>
                        <td style={{ ...muted, whiteSpace: 'nowrap' }}>{blog.date || '—'}{blog.read_time ? ` · ${blog.read_time}` : ''}</td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => { setNotice(null); setEditing({ ...blog }) }} disabled={busy}>
                              <Edit size={13} /> Edit
                            </button>
                            <a
                              className="btn btn-ghost btn-sm"
                              href={`${BLOGS_SITE_ORIGIN}/blog/${encodeURIComponent(blog.slug || String(blog.id ?? ''))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View post"
                            >
                              <ExternalLink size={14} />
                            </a>
                            <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => void handleDelete(blog)} disabled={busy} title="Delete post">
                              {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
