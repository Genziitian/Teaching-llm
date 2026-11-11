import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Save, Star, Trash2 } from 'lucide-react';
import { DEFAULT_COURSE_REVIEWS, fetchCourseReviews, saveCourseReviews, type CourseReview } from '../../lib/courseReviews';

const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100';

export default function ReviewsManager() {
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchCourseReviews().then((r) => { setReviews(r); setLoading(false); });
  }, []);

  const update = (next: CourseReview[]) => { setReviews(next); setDirty(true); setStatus(null); };
  const edit = (i: number, patch: Partial<CourseReview>) => update(reviews.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= reviews.length) return;
    const next = [...reviews];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const remove = (i: number) => {
    if (!window.confirm('Delete this review?')) return;
    update(reviews.filter((_, idx) => idx !== i));
  };
  const add = () => update([...reviews, { id: `rev-${Date.now()}`, name: '', term: '', stars: 5, comment: '' }]);
  const reset = () => {
    if (!window.confirm('Replace all reviews with the defaults? (Not saved until you press Save)')) return;
    update(DEFAULT_COURSE_REVIEWS);
  };

  const save = async () => {
    const cleaned = reviews
      .map((r) => ({ ...r, name: r.name.trim(), term: r.term.trim(), comment: r.comment.trim() }))
      .filter((r) => r.name && r.comment);
    setSaving(true);
    const { error } = await saveCourseReviews(cleaned);
    setSaving(false);
    if (error) {
      setStatus({ ok: false, text: error.message || 'Could not save. Please try again.' });
      return;
    }
    setReviews(cleaned);
    setDirty(false);
    setStatus({ ok: true, text: cleaned.length ? 'Saved. These reviews now show on every course page.' : 'Saved. The reviews section is hidden because the list is empty.' });
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Course reviews</h2>
          <p className="text-sm text-slate-500">Float across every course page, above the FAQs. Rows without a name or comment are skipped when saving.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
            <RotateCcw className="h-3.5 w-3.5" /> Defaults
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
        </div>
      </div>

      {status && (
        <div className={`rounded-xl px-4 py-2.5 text-sm ${status.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{status.text}</div>
      )}

      <div className="space-y-3">
        {reviews.map((r, i) => (
          <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Review {i + 1}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"><ArrowUp className="h-4 w-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === reviews.length - 1} title="Move down" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"><ArrowDown className="h-4 w-4" /></button>
                <button onClick={() => remove(i)} title="Delete" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <input className={input} placeholder="Student name" value={r.name} onChange={(e) => edit(i, { name: e.target.value })} />
                <input className={input} placeholder="Term (e.g. Qualifier, Foundation)" value={r.term} onChange={(e) => edit(i, { term: e.target.value })} />
              </div>
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => edit(i, { stars: n })} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="cursor-pointer p-0.5">
                    <Star className={`h-5 w-5 ${n <= r.stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                  </button>
                ))}
              </div>
              <textarea className={`${input} min-h-[84px] resize-y`} placeholder="Comment" value={r.comment} onChange={(e) => edit(i, { comment: e.target.value })} />
            </div>
          </div>
        ))}
      </div>

      <button onClick={add} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
        <Plus className="h-4 w-4" /> Add review
      </button>
    </div>
  );
}
