'use client';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import BookletCard from '@/landing/components/booklet/BookletCard';
import { BOOKLET_LEVELS, fetchBooklets, type Booklet } from '@/landing/lib/booklets';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border-2 px-4 py-1.5 text-xs font-black transition-all ${
        active ? 'border-[#0b1120] bg-[#0b1120] text-white shadow-[3px_3px_0px_#8b5cf6]' : 'border-gray-200 bg-white text-gray-600 hover:border-[#0b1120] hover:text-[#0b1120]'
      }`}
    >
      {children}
    </button>
  );
}

function SectionHead({ title, note, count }: { title: string; note?: string; count: number }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-2 border-b-[3px] border-dashed border-gray-200 pb-3">
      <div>
        <h2 className="text-2xl font-black text-[#0b1120] lg:text-3xl">{title}</h2>
        {note && <p className="text-sm font-medium text-gray-500">{note}</p>}
      </div>
      <span className="rounded-full border-2 border-[#0b1120] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#0b1120]">
        {count} {count === 1 ? 'item' : 'items'}
      </span>
    </div>
  );
}

export default function BookletShelf() {
  const [booklets, setBooklets] = useState<Booklet[] | null>(null);
  const [level, setLevel] = useState<string>('All');
  const [subject, setSubject] = useState<string>('All');

  useEffect(() => {
    fetchBooklets().then((b) => setBooklets(b.filter((x) => x.active)));
  }, []);

  const levels = useMemo(() => {
    const present = new Set((booklets || []).map((b) => b.level));
    return BOOKLET_LEVELS.filter((l) => present.has(l));
  }, [booklets]);

  const byLevel = useMemo(() => (booklets || []).filter((b) => level === 'All' || b.level === level), [booklets, level]);
  const subjects = useMemo(
    () => Array.from(new Set(byLevel.filter((b) => b.kind === 'single' && b.subject).map((b) => b.subject))).sort(),
    [byLevel]
  );
  useEffect(() => { if (subject !== 'All' && !subjects.includes(subject)) setSubject('All'); }, [subjects, subject]);

  if (!booklets) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  const bundles = byLevel.filter((b) => b.kind === 'bundle');
  const singles = byLevel.filter((b) => b.kind === 'single' && (subject === 'All' || b.subject === subject));
  const grid = 'grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] sm:gap-x-10 sm:gap-y-12';

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 pb-24">
      {levels.length > 1 && (
        <div className="hide-scrollbar mb-10 flex gap-2 overflow-x-auto pb-1">
          <Chip active={level === 'All'} onClick={() => setLevel('All')}>All levels</Chip>
          {levels.map((l) => <Chip key={l} active={level === l} onClick={() => setLevel(l)}>{l}</Chip>)}
        </div>
      )}

      {booklets.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-[3px] border-[#0b1120] bg-white p-10 text-center shadow-[4px_4px_0px_#0b1120]">
          <BookOpen className="h-6 w-6 text-violet-600" />
          <h3 className="text-lg font-black text-[#0b1120]">Booklets coming soon</h3>
        </div>
      )}

      {bundles.length > 0 && (
        <section className="mb-20">
          <SectionHead title="Bundles" note="Several booklets in one pack, for less." count={bundles.length} />
          <div className={grid}>
            {bundles.map((b, i) => <BookletCard key={b.id} booklet={b} index={i} />)}
          </div>
        </section>
      )}

      {byLevel.some((b) => b.kind === 'single') && (
        <section>
          <SectionHead title="Single booklets"count={singles.length} />
          {subjects.length > 1 && (
            <div className="hide-scrollbar -mt-3 mb-10 flex gap-2 overflow-x-auto pb-1">
              <Chip active={subject === 'All'} onClick={() => setSubject('All')}>All subjects</Chip>
              {subjects.map((s) => <Chip key={s} active={subject === s} onClick={() => setSubject(s)}>{s}</Chip>)}
            </div>
          )}
          <div className={grid}>
            {singles.map((b, i) => <BookletCard key={b.id} booklet={b} index={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}
