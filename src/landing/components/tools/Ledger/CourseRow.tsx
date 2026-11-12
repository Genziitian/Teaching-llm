'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { FOUNDATION_COURSE_NAMES } from '@/landing/lib/foundationCourses';
import type { LetterGrade } from '@/landing/lib/grading';

export interface LedgerCourse {
  id: string;
  name: string;
  credits: number;
  grade: LetterGrade;
}

const GRADE_OPTIONS: LetterGrade[] = ['S', 'A', 'B', 'C', 'D', 'E', 'U', 'W'];

const inputClass =
  'px-3 py-2 rounded-xl bg-gray-50 border-2 border-gray-200 text-[#0b1120] placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#10b981] transition-colors font-bold text-sm';

interface CourseRowProps {
  course: LedgerCourse;
  onChange: (patch: Partial<LedgerCourse>) => void;
  onRemove: () => void;
}

export default function CourseRow({ course, onChange, onRemove }: CourseRowProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions =
    course.name.trim().length > 0
      ? FOUNDATION_COURSE_NAMES.filter((n) => n.toLowerCase().includes(course.name.trim().toLowerCase())).slice(0, 5)
      : [];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-dashed border-gray-200 last:border-b-0">
      <div className="relative w-full sm:flex-1 sm:min-w-0">
        <input
          type="text"
          value={course.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          placeholder="Course name"
          className={`${inputClass} w-full`}
          aria-label="Course name"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-y-auto bg-white border-[3px] border-[#0b1120] rounded-xl shadow-[4px_4px_0px_#0b1120] text-sm">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left font-bold text-gray-700 hover:bg-gray-50 hover:text-[#10b981] transition-colors"
                  onMouseDown={() => onChange({ name: s })}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <input
          type="text" inputMode="decimal"
          min={1}
          max={20}
          value={course.credits}
          onChange={(e) => onChange({ credits: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
          placeholder="Credits"
          aria-label="Credits"
          className={`${inputClass} w-16 text-center shrink-0`}
        />

        <select
          value={course.grade}
          onChange={(e) => onChange({ grade: e.target.value as LetterGrade })}
          aria-label="Grade"
          className={`${inputClass} w-16 appearance-none cursor-pointer shrink-0`}
        >
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove course"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 border-2 border-red-200 text-red-500 hover:bg-red-100 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
