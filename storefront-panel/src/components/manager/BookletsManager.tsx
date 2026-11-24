import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BookletVisual } from '../booklet/BookletCard';
import {
  BINDINGS, BOOKLET_LEVELS, COVERS, discountPercent, fetchBooklets, newBooklet, saveBooklets,
  type Booklet, type BookletAction, type BookletBinding, type BookletCover,
} from '../../lib/booklets';

const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100';
const label = 'mb-1 block text-xs font-semibold text-slate-600';

function Field({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default function BookletsManager() {
  const [items, setItems] = useState<Booklet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [courses, setCourses] = useState<{ id: string; name: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    fetchBooklets().then((b) => { setItems(b); setSelectedId(b[0]?.id ?? null); setLoading(false); });
    supabase.from('courses').select('id, name, price').order('name').then(({ data }) => setCourses((data as any[]) || []));
  }, []);

  const selected = items.find((b) => b.id === selectedId) || null;
  const update = (next: Booklet[]) => { setItems(next); setDirty(true); setStatus(null); };
  const edit = (patch: Partial<Booklet>) => selected && update(items.map((b) => (b.id === selected.id ? { ...b, ...patch } : b)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const add = (kind: 'single' | 'bundle') => {
    const b = newBooklet(kind);
    update([...items, b]);
    setSelectedId(b.id);
  };
  const duplicate = (b: Booklet) => {
    const copy = { ...b, id: `bk-${Date.now().toString(36)}`, title: `${b.title} (copy)`, active: false };
    update([...items, copy]);
    setSelectedId(copy.id);
  };
  const remove = (b: Booklet) => {
    if (!window.confirm(`Delete "${b.title}"? (Not saved until you press Save)`)) return;
    const next = items.filter((x) => x.id !== b.id);
    update(next);
    if (selectedId === b.id) setSelectedId(next[0]?.id ?? null);
  };

  const save = async () => {
    const cleaned = items.map((b) => ({ ...b, title: b.title.trim(), contents: b.contents.map((c) => c.trim()).filter(Boolean) }));
    const missing = cleaned.find((b) => !b.title);
    if (missing) { setStatus({ ok: false, text: 'Every booklet needs a name.' }); return; }
    setSaving(true);
    const { error } = await saveBooklets(cleaned);
    setSaving(false);
    if (error) { setStatus({ ok: false, text: error.message || 'Could not save. Please try again.' }); return; }
    setItems(cleaned);
    setDirty(false);
    setStatus({ ok: true, text: 'Saved. Booklets are live on Resources → Booklet.' });
  };

  const linkedCourse = useMemo(() => courses.find((c) => String(c.id) === selected?.courseId), [courses, selected?.courseId]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Booklets</h2>
          <p className="text-sm text-slate-500">Shown on Resources → Booklet. Bundles appear above single booklets, in this order.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => add('single')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Plus className="h-3.5 w-3.5" /> Single booklet
          </button>
          <button onClick={() => add('bundle')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Plus className="h-3.5 w-3.5" /> Bundle
          </button>
          <button onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
        </div>
      </div>

      {status && <div className={`rounded-xl px-4 py-2.5 text-sm ${status.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{status.text}</div>}
      {dirty && !status && <div className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">You have unsaved changes.</div>}

      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        {/* List */}
        <div className="space-y-2">
          {items.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No booklets yet.</p>}
          {items.map((b, i) => (
            <div
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-3 transition ${selectedId === b.id ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <span className="h-10 w-8 shrink-0 rounded-md border-2 border-slate-900" style={{ background: COVERS[b.cover].bg }} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${b.active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{b.title || 'Untitled'}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {b.kind === 'bundle' ? 'Bundle' : b.subject || 'Single'} · {b.level} · {b.price <= 0 ? 'Free' : `₹${b.price}`}
                </p>
              </div>
              <div className="flex flex-col">
                <button onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0} title="Move up" className="rounded p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === items.length - 1} title="Move down" className="rounded p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Editor + preview */}
        {selected ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => edit({ active: !selected.active })} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer ${selected.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {selected.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {selected.active ? 'Visible on site' : 'Hidden'}
                </button>
                <button onClick={() => duplicate(selected)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
                <button onClick={() => remove(selected)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </div>

              <Card title="Name & details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field title="Type">
                    <select className={input} value={selected.kind} onChange={(e) => edit({ kind: e.target.value as Booklet['kind'] })}>
                      <option value="single">Single booklet</option>
                      <option value="bundle">Bundle (several booklets)</option>
                    </select>
                  </Field>
                  <Field title="Level">
                    <select className={input} value={selected.level} onChange={(e) => edit({ level: e.target.value })}>
                      {BOOKLET_LEVELS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </Field>
                </div>
                <Field title="Name (shown on the cover)">
                  <input className={input} value={selected.title} onChange={(e) => edit({ title: e.target.value })} placeholder="Maths 1 Quiz 1 Booklet" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field title="Subject" hint={selected.kind === 'single' ? 'Used for the subject filter' : undefined}>
                    <input className={input} value={selected.subject} onChange={(e) => edit({ subject: e.target.value })} placeholder="Maths 1" />
                  </Field>
                  <Field title="Term"><input className={input} value={selected.term} onChange={(e) => edit({ term: e.target.value })} placeholder="Term 1" /></Field>
                  <Field title="Exam"><input className={input} value={selected.exam} onChange={(e) => edit({ exam: e.target.value })} placeholder="Quiz 1" /></Field>
                </div>
                <Field title="Description">
                  <textarea className={`${input} min-h-[72px] resize-y`} value={selected.description} onChange={(e) => edit({ description: e.target.value })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field title="Badge on cover" hint="Optional, e.g. New, Free, Bestseller"><input className={input} value={selected.badge} onChange={(e) => edit({ badge: e.target.value })} /></Field>
                  <Field title="Pages" hint="0 hides it"><input type="number" min={0} className={input} value={selected.pages} onChange={(e) => edit({ pages: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                </div>
              </Card>

              <Card title={selected.kind === 'bundle' ? 'Booklets in this bundle' : 'What it contains'}>
                <Field title="One item per line" hint="The first 3 show on the front cover; all of them show when the cover opens.">
                  <textarea
                    className={`${input} min-h-[120px] resize-y font-mono text-[13px]`}
                    value={selected.contents.join('\n')}
                    onChange={(e) => edit({ contents: e.target.value.split('\n') })}
                    placeholder={selected.kind === 'bundle' ? 'Maths 1 Quiz 1 Booklet\nStats 1 Quiz 1 Booklet' : 'Week 1 · Set Theory\nWeek 2 · Coordinate Geometry'}
                  />
                </Field>
              </Card>

              <Card title="Price">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field title="Price (₹)" hint="0 = Free"><input type="number" min={0} className={input} value={selected.price} onChange={(e) => edit({ price: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                  <Field title="Original price / MRP (₹)" hint="Shown struck through on the button. 0 hides it"><input type="number" min={0} className={input} value={selected.mrp} onChange={(e) => edit({ mrp: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                </div>
                <p className="text-xs text-slate-500">
                  {selected.price <= 0 ? 'Shows as Free with a "FREE" stamp.' : discountPercent(selected) > 0 ? `Shows a ${discountPercent(selected)}% OFF stamp.` : 'No discount stamp.'}
                </p>
              </Card>

              <Card title="Button">
                <Field title="When someone clicks the button">
                  <select className={input} value={selected.action} onChange={(e) => edit({ action: e.target.value as BookletAction })}>
                    <option value="pdf">Open a PDF link (free download)</option>
                    <option value="checkout">Go to checkout for a course / bundle</option>
                    <option value="link">Open another link (payment page etc.)</option>
                  </select>
                </Field>
                {selected.action === 'pdf' && (
                  <Field title="PDF link" hint="Google Drive: set sharing to 'Anyone with the link'.">
                    <input className={input} value={selected.pdfUrl} onChange={(e) => edit({ pdfUrl: e.target.value })} placeholder="https://drive.google.com/file/d/…/view" />
                  </Field>
                )}
                {selected.action === 'checkout' && (
                  <Field title="Course / bundle to sell" hint="Create the product under Courses first. Checkout charges that course's price.">
                    <select className={input} value={selected.courseId} onChange={(e) => edit({ courseId: e.target.value })}>
                      <option value="">— Pick a course —</option>
                      {courses.map((c) => <option key={c.id} value={String(c.id)}>{c.name} (₹{c.price})</option>)}
                    </select>
                    {linkedCourse && Number(linkedCourse.price) !== selected.price && (
                      <span className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Checkout charges ₹{linkedCourse.price}, but this booklet shows ₹{selected.price}.
                        <button onClick={() => edit({ price: Number(linkedCourse.price) || 0 })} className="font-semibold underline cursor-pointer">Use ₹{linkedCourse.price}</button>
                      </span>
                    )}
                  </Field>
                )}
                {selected.action === 'link' && (
                  <Field title="Link"><input className={input} value={selected.buyUrl} onChange={(e) => edit({ buyUrl: e.target.value })} placeholder="https://…" /></Field>
                )}
                <Field title="Button text" hint="Leave blank for automatic: “Get for Free” or “Get for ₹price”">
                  <input className={input} value={selected.buttonLabel} onChange={(e) => edit({ buttonLabel: e.target.value })} />
                </Field>
              </Card>

              <Card title="Design">
                <div>
                  <span className={label}>Cover colour</span>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(COVERS) as BookletCover[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => edit({ cover: k })}
                        title={COVERS[k].label}
                        className={`h-9 w-9 rounded-lg border-2 cursor-pointer ${selected.cover === k ? 'border-slate-900 ring-2 ring-slate-900 ring-offset-2' : 'border-slate-300'}`}
                        style={{ background: COVERS[k].bg }}
                      />
                    ))}
                  </div>
                </div>
                <Field title="Binding">
                  <select className={input} value={selected.binding} onChange={(e) => edit({ binding: e.target.value as BookletBinding })}>
                    {(Object.keys(BINDINGS) as BookletBinding[]).map((k) => <option key={k} value={k}>{BINDINGS[k]}</option>)}
                  </select>
                </Field>
              </Card>
            </div>

            <div className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live preview</span>
                  <button onClick={() => setPreviewKey((k) => k + 1)} className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer">Replay animation</button>
                </div>
                <div className="px-3 pb-2">
                  <BookletVisual key={previewKey} booklet={selected} />
                </div>
                <p className="mt-5 text-center text-[11px] text-slate-400">Hover or click the booklet to open it.</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Pick a booklet on the left, or add one.</p>
        )}
      </div>
    </div>
  );
}
