import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { DEFAULT_COURSE_FAQS, fetchCourseFaqs, saveCourseFaqs, type CourseFaq } from '../../lib/courseFaqs';

const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100';

export default function FaqsManager() {
  const [faqs, setFaqs] = useState<CourseFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchCourseFaqs().then((f) => { setFaqs(f); setLoading(false); });
  }, []);

  const update = (next: CourseFaq[]) => { setFaqs(next); setDirty(true); setStatus(null); };
  const edit = (i: number, patch: Partial<CourseFaq>) => update(faqs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= faqs.length) return;
    const next = [...faqs];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const remove = (i: number) => {
    if (!window.confirm('Delete this FAQ?')) return;
    update(faqs.filter((_, idx) => idx !== i));
  };
  const add = () => update([...faqs, { id: `faq-${Date.now()}`, question: '', answer: '' }]);
  const reset = () => {
    if (!window.confirm('Replace all FAQs with the 5 defaults? (Not saved until you press Save)')) return;
    update(DEFAULT_COURSE_FAQS);
  };

  const save = async () => {
    const cleaned = faqs.map((f) => ({ ...f, question: f.question.trim(), answer: f.answer.trim() })).filter((f) => f.question && f.answer);
    setSaving(true);
    const { error } = await saveCourseFaqs(cleaned);
    setSaving(false);
    if (error) {
      setStatus({ ok: false, text: error.message || 'Could not save. Please try again.' });
      return;
    }
    setFaqs(cleaned);
    setDirty(false);
    setStatus({ ok: true, text: 'Saved. These FAQs now show on every course page.' });
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Course FAQs</h2>
          <p className="text-sm text-slate-500">Shown at the bottom of every course page. Empty rows are skipped when saving.</p>
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
        {faqs.map((f, i) => (
          <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">FAQ {i + 1}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"><ArrowUp className="h-4 w-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === faqs.length - 1} title="Move down" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"><ArrowDown className="h-4 w-4" /></button>
                <button onClick={() => remove(i)} title="Delete" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="space-y-2.5">
              <input className={input} placeholder="Question" value={f.question} onChange={(e) => edit(i, { question: e.target.value })} />
              <textarea className={`${input} min-h-[84px] resize-y`} placeholder="Answer" value={f.answer} onChange={(e) => edit(i, { answer: e.target.value })} />
            </div>
          </div>
        ))}
      </div>

      <button onClick={add} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
        <Plus className="h-4 w-4" /> Add FAQ
      </button>
    </div>
  );
}
