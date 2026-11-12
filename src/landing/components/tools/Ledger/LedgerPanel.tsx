'use client';
import { useRef, useState } from 'react';
import { Download, Plus, RotateCcw, Upload } from 'lucide-react';
import TermCard, { LedgerTerm } from '@/landing/components/tools/Ledger/TermCard';
import CgpaStrip from '@/landing/components/tools/Ledger/CgpaStrip';
import { LedgerCourse } from '@/landing/components/tools/Ledger/CourseRow';
import { useLocalStorageState } from '@/landing/hooks/useLocalStorage';
import { cgpa, percentageFromCgpa } from '@/landing/lib/grading';
import { FOUNDATION_COURSES } from '@/landing/lib/foundationCourses';

const STORAGE_KEY = 'gz-cgpa-ledger-v1';

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeEmptyCourse(): LedgerCourse {
  return { id: makeId(), name: '', credits: 4, grade: 'S' };
}

function makeEmptyTerm(name: string): LedgerTerm {
  return { id: makeId(), name, courses: [makeEmptyCourse()] };
}

function makeFoundationTerm(): LedgerTerm {
  return {
    id: makeId(),
    name: 'Foundation Level',
    courses: FOUNDATION_COURSES.map((c) => ({ id: makeId(), name: c.name, credits: c.credits, grade: 'S' as const })),
  };
}

const toolBtnClass =
  'flex items-center gap-1.5 px-3.5 py-2 bg-white border-[2px] border-[#0b1120] rounded-xl text-xs font-black hover:-translate-y-0.5 shadow-[2px_2px_0px_#0b1120] hover:shadow-[4px_4px_0px_#0b1120] transition-all';

export default function LedgerPanel() {
  const [terms, setTerms] = useLocalStorageState<LedgerTerm[]>(STORAGE_KEY, () => [makeEmptyTerm('Term 1')]);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const overallCgpa = cgpa(terms.map((t) => t.courses.map((c) => ({ credits: c.credits, grade: c.grade }))));
  const totalCredits = terms.reduce((s, t) => s + t.courses.reduce((s2, c) => s2 + c.credits, 0), 0);

  const addTerm = () => setTerms((prev) => [...prev, makeEmptyTerm(`Term ${prev.length + 1}`)]);

  const addFoundationTerm = () => setTerms((prev) => [...prev, makeFoundationTerm()]);

  const removeTerm = (termId: string) => setTerms((prev) => (prev.length > 1 ? prev.filter((t) => t.id !== termId) : prev));

  const duplicateTerm = (termId: string) =>
    setTerms((prev) => {
      const idx = prev.findIndex((t) => t.id === termId);
      if (idx === -1) return prev;
      const source = prev[idx];
      const copy: LedgerTerm = {
        id: makeId(),
        name: `${source.name} (copy)`,
        courses: source.courses.map((c) => ({ ...c, id: makeId() })),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });

  const renameTerm = (termId: string, name: string) =>
    setTerms((prev) => prev.map((t) => (t.id === termId ? { ...t, name } : t)));

  const addCourse = (termId: string) =>
    setTerms((prev) => prev.map((t) => (t.id === termId ? { ...t, courses: [...t.courses, makeEmptyCourse()] } : t)));

  const updateCourse = (termId: string, courseId: string, patch: Partial<LedgerCourse>) =>
    setTerms((prev) =>
      prev.map((t) =>
        t.id === termId
          ? { ...t, courses: t.courses.map((c) => (c.id === courseId ? { ...c, ...patch } : c)) }
          : t
      )
    );

  const removeCourse = (termId: string, courseId: string) =>
    setTerms((prev) => prev.map((t) => (t.id === termId ? { ...t, courses: t.courses.filter((c) => c.id !== courseId) } : t)));

  const resetLedger = () => {
    setTerms([makeEmptyTerm('Term 1')]);
    setConfirmingReset(false);
  };

  const exportLedger = () => {
    const blob = new Blob([JSON.stringify(terms, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gz-cgpa-ledger.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importLedger = (file: File) => {
    setImportError(null);
    file
      .text()
      .then((text) => {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('Expected a list of terms');
        setTerms(parsed);
      })
      .catch(() => setImportError('Could not read that file — expected a ledger export from this app.'));
  };

  return (
    <div>
      <CgpaStrip cgpaValue={overallCgpa} percentage={percentageFromCgpa(overallCgpa)} totalCredits={totalCredits} />

      <div className="space-y-6">
        {terms.map((term) => (
          <TermCard
            key={term.id}
            term={term}
            onRename={(name) => renameTerm(term.id, name)}
            onAddCourse={() => addCourse(term.id)}
            onUpdateCourse={(courseId, patch) => updateCourse(term.id, courseId, patch)}
            onRemoveCourse={(courseId) => removeCourse(term.id, courseId)}
            onRemoveTerm={() => removeTerm(term.id)}
            onDuplicateTerm={() => duplicateTerm(term.id)}
            canRemoveTerm={terms.length > 1}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t-2 border-gray-100">
        <button type="button" onClick={addTerm} className={toolBtnClass}>
          <Plus className="w-3.5 h-3.5" /> Add term
        </button>
        <button
          type="button"
          onClick={addFoundationTerm}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#10b981] text-white border-[2px] border-[#0b1120] rounded-xl text-xs font-black hover:-translate-y-0.5 shadow-[2px_2px_0px_#0b1120] hover:shadow-[4px_4px_0px_#0b1120] transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Add foundation-level courses
        </button>
        <button type="button" onClick={exportLedger} className={toolBtnClass}>
          <Download className="w-3.5 h-3.5" /> Export JSON
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} className={toolBtnClass}>
          <Upload className="w-3.5 h-3.5" /> Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importLedger(file);
            e.target.value = '';
          }}
        />

        <div className="ml-auto">
          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 border-[2px] border-red-300 rounded-xl text-xs font-black text-red-600 hover:bg-red-100 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset ledger
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 font-bold text-xs">Erase all terms?</span>
              <button
                type="button"
                onClick={resetLedger}
                className="px-3 py-1.5 bg-red-500 text-white border-[2px] border-[#0b1120] rounded-xl text-xs font-black hover:bg-red-600 transition-colors"
              >
                Yes, reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="px-3 py-1.5 bg-white border-[2px] border-[#0b1120] rounded-xl text-xs font-black hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {importError && <p className="text-sm text-red-600 font-bold mt-3">{importError}</p>}
    </div>
  );
}
