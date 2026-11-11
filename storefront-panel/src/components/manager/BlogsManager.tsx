import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, Edit, Trash2, Save, X, Loader2, Eye, EyeOff, ExternalLink, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BlogPost } from '../../data/blogsData';
import { ConfirmDialog, BusyModal, type ConfirmOptions } from './ConfirmDialog';
import ManagerFullPageSheet, { managerFieldLabel, managerInputCls } from './ManagerFullPageSheet';

type BlogRow = Partial<BlogPost> & { id?: number };

function slugify(value: string) {
  if (!value || typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const emptyBlog: BlogRow = {
  title: '',
  slug: '',
  category: 'General',
  content: '',
  image: '',
  date: '',
  read_time: '5 min read',
  published: 1,
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
};

const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Blogs admin — lives inside the Manager panel. Full CRUD against the
 * Supabase `blogs` table (see blogs-schema.sql). Resources/Notes stay on the
 * server admin; this only manages blog posts.
 */
export default function BlogsManager() {
  const [blogs, setBlogs] = useState<BlogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<BlogRow | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBlogs = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('blogs')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) console.error('Failed to load blogs:', err.message);
    setBlogs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const openCreate = () => {
    setError(null);
    setSlugTouched(false);
    setEditing({ ...emptyBlog, date: todayLabel() });
  };

  const openEdit = (blog: BlogRow) => {
    setError(null);
    setSlugTouched(true); // never auto-overwrite an existing slug
    setEditing({ ...blog });
  };

  const setField = (key: keyof BlogRow, value: string | number) => {
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const onTitleChange = (value: string) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const next = { ...prev, title: value };
      if (!slugTouched) next.slug = slugify(value);
      return next;
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title?.trim()) { setError('Title is required.'); return; }
    const slug = (editing.slug?.trim() || slugify(editing.title)).trim();
    if (!slug) { setError('A valid slug is required.'); return; }

    setSaving(true);
    setError(null);

    const payload = {
      title: editing.title.trim(),
      slug,
      category: editing.category?.trim() || 'General',
      content: editing.content || '',
      image: editing.image?.trim() || '',
      date: editing.date?.trim() || todayLabel(),
      read_time: editing.read_time?.trim() || '5 min read',
      published: Number(editing.published) ? 1 : 0,
      seo_title: editing.seo_title?.trim() || null,
      seo_description: editing.seo_description?.trim() || null,
      seo_keywords: editing.seo_keywords?.trim() || null,
    };

    let err;
    if (editing.id) {
      ({ error: err } = await supabase.from('blogs').update(payload).eq('id', editing.id));
    } else {
      ({ error: err } = await supabase.from('blogs').insert(payload));
    }

    setSaving(false);

    if (err) {
      setError(
        err.code === '23505'
          ? 'That slug is already used by another post. Pick a unique slug.'
          : err.message,
      );
      return;
    }

    setEditing(null);
    fetchBlogs();
  };

  const [confirmDialog, setConfirmDialog] = useState<ConfirmOptions | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);

  const handleDelete = (blog: BlogRow) => {
    if (!blog.id) return;
    setConfirmDialog({
      title: 'Delete this post?',
      message: `“${blog.title || 'Untitled'}” will be permanently deleted. This can’t be undone.`,
      confirmLabel: 'Delete post',
      onConfirm: async () => {
        setBusyMessage('Deleting post…');
        try { await performDelete(blog); } finally { setBusyMessage(null); }
      },
    });
  };

  const performDelete = async (blog: BlogRow) => {
    const { error: err } = await supabase.from('blogs').delete().eq('id', blog.id);
    if (err) {
      alert('Failed to delete blog: ' + err.message);
    }
    fetchBlogs();
  };

  const filtered = blogs.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (b.title || '').toLowerCase().includes(q) || (b.category || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <ConfirmDialog options={confirmDialog} onClose={() => setConfirmDialog(null)} />
      <BusyModal message={busyMessage} />
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex gap-3 items-center flex-grow">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search blogs by title or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full outline-none text-sm text-slate-800 placeholder:text-slate-400"
          />
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Create Blog
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-16 text-slate-400 text-sm font-medium">
          Loading blogs…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">No blogs yet</h3>
          <p className="text-slate-500 text-sm">Click Create Blog to publish your first post.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 sm:px-5 py-3">Title</th>
                  <th className="px-4 sm:px-5 py-3">Category</th>
                  <th className="px-4 sm:px-5 py-3">Status</th>
                  <th className="px-4 sm:px-5 py-3">Date</th>
                  <th className="px-4 sm:px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((blog) => (
                  <tr key={blog.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 sm:px-5 py-3.5">
                      <div className="font-medium text-slate-900 line-clamp-1">{blog.title}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{blog.slug}</div>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-medium">{blog.category}</span>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                        Number(blog.published) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {Number(blog.published) ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {Number(blog.published) ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {blog.date || '—'} · {blog.read_time || ''}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(blog)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </button>
                        <a
                          href={`/blog/${blog.slug || blog.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View post"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDelete(blog)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete post"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Blog editor — full page */}
      <ManagerFullPageSheet
        open={!!editing}
        title={editing?.id ? 'Edit blog' : 'Create blog'}
        subtitle={editing?.title || 'Write and publish a post'}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        saveLabel={editing?.id ? 'Save changes' : 'Publish blog'}
        saving={saving}
        maxWidthClass="max-w-3xl"
      >
              <div className="space-y-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-semibold text-sm">{error}</div>
                )}

                <Field label="Title">
                  <input
                    value={editing?.title || ''}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder="Eye-catching blog title"
                    className={managerInputCls}
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="Slug (URL)">
                    <input
                      value={editing?.slug || ''}
                      onChange={(e) => { setSlugTouched(true); setField('slug', slugify(e.target.value)); }}
                      placeholder="auto-generated-from-title"
                      className={managerInputCls}
                    />
                  </Field>
                  <Field label="Category">
                    <input
                      value={editing?.category || ''}
                      onChange={(e) => setField('category', e.target.value)}
                      placeholder="e.g. IIT Madras BS Degree"
                      className={managerInputCls}
                    />
                  </Field>
                </div>

                <Field label="Thumbnail Image URL">
                  <input
                    value={editing?.image || ''}
                    onChange={(e) => setField('image', e.target.value)}
                    placeholder="/Image/your-thumbnail.png or https://..."
                    className={managerInputCls}
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <Field label="Display Date">
                    <input value={editing?.date || ''} onChange={(e) => setField('date', e.target.value)} placeholder="May 15, 2026" className={managerInputCls} />
                  </Field>
                  <Field label="Read Time">
                    <input value={editing?.read_time || ''} onChange={(e) => setField('read_time', e.target.value)} placeholder="7 min read" className={managerInputCls} />
                  </Field>
                  <Field label="Status">
                    <button
                      type="button"
                      onClick={() => setField('published', Number(editing?.published) ? 0 : 1)}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-semibold text-sm ${
                        Number(editing?.published) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-amber-100 text-amber-900 border-amber-200'
                      }`}
                    >
                      {Number(editing?.published) ? <><Eye className="w-4 h-4" /> Published</> : <><EyeOff className="w-4 h-4" /> Draft</>}
                    </button>
                  </Field>
                </div>

                <Field label="Content (HTML)">
                  <textarea
                    value={editing?.content || ''}
                    onChange={(e) => setField('content', e.target.value)}
                    rows={12}
                    placeholder="<p>Write your post using HTML. Use <h2> for sections, <a href> for links, <strong> for emphasis.</p>"
                    className={`${managerInputCls} font-mono text-sm leading-relaxed resize-y`}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Tip: paste HTML. <code>&lt;h2&gt;</code> headings, <code>&lt;p&gt;</code> paragraphs and <code>&lt;a&gt;</code> links are styled automatically on the live post.
                  </p>
                </Field>

                <div className="border-t border-slate-100 pt-5 space-y-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">SEO (optional)</h3>
                  <Field label="SEO Title">
                    <input value={editing?.seo_title || ''} onChange={(e) => setField('seo_title', e.target.value)} className={managerInputCls} />
                  </Field>
                  <Field label="SEO Description">
                    <textarea value={editing?.seo_description || ''} onChange={(e) => setField('seo_description', e.target.value)} rows={2} className={`${managerInputCls} resize-y`} />
                  </Field>
                  <Field label="SEO Keywords (comma separated)">
                    <input value={editing?.seo_keywords || ''} onChange={(e) => setField('seo_keywords', e.target.value)} className={managerInputCls} />
                  </Field>
                </div>
              </div>
      </ManagerFullPageSheet>
    </div>
  );
}

const inputCls = managerInputCls;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={managerFieldLabel}>{label}</span>
      {children}
    </label>
  );
}
