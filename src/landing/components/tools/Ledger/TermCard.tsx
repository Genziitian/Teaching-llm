import { Copy, Plus, Trash2 } from 'lucide-react';
import CourseRow, { LedgerCourse } from '@/landing/components/tools/Ledger/CourseRow';
import { sgpa } from '@/landing/lib/grading';

export interface LedgerTerm {
  id: string;
  name: string;
  courses: LedgerCourse[];
}

interface TermCardProps {
  term: LedgerTerm;
  onRename: (name: string) => void;
  onAddCourse: () => void;
  onUpdateCourse: (courseId: string, patch: Partial<LedgerCourse>) => void;
  onRemoveCourse: (courseId: string) => void;
  onRemoveTerm: () => void;
  onDuplicateTerm: () => void;
  canRemoveTerm: boolean;
}

export default function TermCard({
  term,
  onRename,
  onAddCourse,
  onUpdateCourse,
  onRemoveCourse,
  onRemoveTerm,
  onDuplicateTerm,
  canRemoveTerm,
}: TermCardProps) {
  const termSgpa = sgpa(term.courses.map((c) => ({ credits: c.credits, grade: c.grade })));
  const totalCredits = term.courses.reduce((s, c) => s + c.credits, 0);

  return (
    <div className="bg-white border-[3px] border-[#0b1120] rounded-2xl shadow-[4px_4px_0px_#0b1120] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <input
          type="text"
          value={term.name}
          onChange={(e) => onRename(e.target.value)}
          className="px-3 py-2 rounded-xl bg-gray-50 border-2 border-gray-200 text-[#0b1120] font-black text-lg flex-1 min-w-[140px] focus:outline-none focus:bg-white focus:border-[#10b981] transition-colors"
          aria-label="Term name"
        />
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs font-bold text-gray-500">
            {totalCredits} credits
          </span>
          <span className="font-bold text-gray-500">
            SGPA <strong className="text-lg font-black text-[#0b1120]">{termSgpa.toFixed(2)}</strong>
          </span>
        </div>
      </div>

      <div>
        {term.courses.length === 0 && (
          <p className="text-sm text-gray-400 font-medium py-3">No courses yet — add one below.</p>
        )}
        {term.courses.map((course) => (
          <CourseRow
            key={course.id}
            course={course}
            onChange={(patch) => onUpdateCourse(course.id, patch)}
            onRemove={() => onRemoveCourse(course.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-1">
        <button
          type="button"
          onClick={onAddCourse}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-[2px] border-[#0b1120] rounded-xl text-xs font-black hover:-translate-y-0.5 shadow-[2px_2px_0px_#0b1120] hover:shadow-[4px_4px_0px_#0b1120] transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Add course
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDuplicateTerm}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-[2px] border-[#0b1120] rounded-xl text-xs font-black hover:-translate-y-0.5 shadow-[2px_2px_0px_#0b1120] hover:shadow-[4px_4px_0px_#0b1120] transition-all"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          {canRemoveTerm && (
            <button
              type="button"
              onClick={onRemoveTerm}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 border-[2px] border-red-300 rounded-xl text-xs font-black text-red-600 hover:bg-red-100 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove term
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
