'use client';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@/landing/shims/router';
import { RefreshCcw, GraduationCap, Star, Loader2, ChevronRight, BookOpen, Minus } from 'lucide-react';
import { supabase } from '@/landing/lib/supabase';
import { CourseCardData } from '@/landing/components/CourseCard';
import { FOUNDATION_SUB_TERMS, isCourseInSubTerm } from '@/landing/pages/Courses';

const DEFAULT_BOX_CONFIG: Record<string, string[]> = {
  Qualifier: ['Qualifier'],
  'Re-attempt': ['Re-attempt'],
  Foundation: ['Quiz 1', 'Quiz 2', 'End Term', 'Full Term'],
  DIPLOMA: ['Quiz 1', 'Quiz 2', 'End Term', 'Full Term']
};

const BADGE_COLORS: Record<string, string> = {
  SALE: '#FF2424', NEW: '#15B981', BESTSELLER: '#F6A623', TRENDING: '#2563EB',
  HOT: '#FF7A00', LIMITED: '#EC1E79',
};

function badgeColor(tag: string) {
  return BADGE_COLORS[tag.toUpperCase()] ?? '#7C3AED';
}

function CohortCard({ course, accent }: { course: CourseCardData; accent?: boolean }) {
  const navigate = useNavigate();
  const displayPrice = course.discountPrice || course.price;
  const tags = course.isBundle
    ? (course.bundleCourses?.map((b) => b.courseName) ?? [])
    : (course.subject ? [course.subject] : []);

  return (
    <div
      onClick={() => navigate(`/explore/courses/${course.id}`)}
      className={`bg-white border-[2.5px] border-[#0b1120] rounded-[20px] p-[18px] mb-[22px] cursor-pointer ${accent ? 'shadow-[5px_5px_0px_#FF2424]' : 'shadow-[4px_4px_0px_#0b1120]'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-11 h-11 rounded-xl bg-[#FBE3EE] border-2 border-[#0b1120] flex items-center justify-center text-[#0b1120]">
          {course.isBundle ? <RefreshCcw className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
        </div>
        {course.tags && course.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            {course.tags.slice(0, 2).map((b, i) => (
              <span
                key={b}
                className={`text-white font-black text-[11px] tracking-wide px-2.5 py-1 rounded-[9px] border-2 border-[#0b1120] shadow-[2px_2px_0px_#0b1120] whitespace-nowrap ${i % 2 ? 'rotate-[4deg]' : '-rotate-[4deg]'}`}
                style={{ background: badgeColor(b) }}
              >
                {b.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      <h3 className="mt-4 font-black text-[21px] leading-snug text-[#0b1120]">{course.name}</h3>
      {course.description && <p className="mt-2.5 text-[13px] leading-relaxed text-gray-500 font-semibold">{course.description}</p>}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 my-3.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center border-[1.5px] border-gray-200 rounded-full px-2.5 py-1 text-[11px] font-black text-[#0b1120] bg-white">{t}</span>
          ))}
        </div>
      )}

      <div className="border-t-[1.5px] border-gray-100 pt-3.5 flex items-end justify-between">
        <div>
          {course.startDate && (
            <div className="text-[9.5px] font-black tracking-wide text-gray-500">
              CLASS STARTS: {new Date(course.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
            </div>
          )}
          <div className="text-[11px] font-black text-blue-600 my-1.5">LANGUAGE: HINGLISH</div>
          <div className="flex items-center gap-1 text-amber-400">
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-3 h-3 fill-current" />)}
            <span className="text-[11px] font-bold text-gray-500 ml-0.5">(4.9)</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-black tracking-wide text-gray-500">STARTS FROM</div>
          <div className="text-[26px] font-black text-[#0b1120] leading-none">₹{displayPrice}</div>
          {course.discountPrice && <div className="text-xs font-bold text-gray-400 line-through">₹{course.price}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <Link
          to={`/explore/courses/${course.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-center py-[13px] rounded-xl border-[2.5px] border-[#0b1120] bg-white text-[#0b1120] font-black text-[13px]"
        >
          View Details ›
        </Link>
        <Link
          to={`/checkout/${course.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-center py-[13px] rounded-xl border-[2.5px] border-[#0b1120] bg-[#0b1120] text-white font-black text-[13px]"
        >
          Enroll Now
        </Link>
      </div>
    </div>
  );
}

interface MobileCoursesProps {
  selectedTerm: string | null;
  selectedSubTerm?: string | null;
  selectedExamStage?: string | null;
  onClearTerm: () => void;
  onClearSubTerm?: () => void;
  onClearExam?: () => void;
  onSelectSubTerm?: (subTerm: string) => void;
  onSelectExamStage?: (stage: string) => void;
}

/** Mobile-only Courses screen — featured cohort cards on a navy background. */
export default function MobileCourses({
  selectedTerm,
  selectedSubTerm = null,
  selectedExamStage = null,
  onClearTerm,
  onClearSubTerm,
  onClearExam,
  onSelectSubTerm,
  onSelectExamStage
}: MobileCoursesProps) {
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [loading, setLoading] = useState(true);

  // Boxes configured in Manager > Boxes
  const [examVisibility, setExamVisibility] = useState<Record<string, string[]>>(DEFAULT_BOX_CONFIG);

  useEffect(() => {
    supabase
      .from('courses')
      .select('*')
      .order('isPinned', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCourses((data || []).filter((course: any) => course.active !== false));
        setLoading(false);
      });

    supabase
      .from('settings')
      .select('*')
      .eq('key', 'exam_visibility')
      .maybeSingle()
      .then(({ data }) => {
        if (data) setExamVisibility({ ...DEFAULT_BOX_CONFIG, ...JSON.parse(data.value) });
      });
  }, []);

  const filteredCourses = courses.filter((course) => {
    const matchesTerm = !selectedTerm || course.term === selectedTerm;
    
    const matchesSubTerm = !selectedSubTerm || selectedTerm !== 'Foundation' || isCourseInSubTerm(course, selectedSubTerm);

    // Filter by stage if stage is selected
    const matchesStage = !selectedExamStage || 
      (Array.isArray(course.exam_stages) && course.exam_stages.includes(selectedExamStage));

    return matchesTerm && matchesSubTerm && matchesStage;
  });

  const activeBoxes = selectedTerm ? (examVisibility[selectedTerm] || DEFAULT_BOX_CONFIG[selectedTerm] || []) : [];

  const activeFoundationSubTerms = FOUNDATION_SUB_TERMS.filter(sub =>
    courses.some(c => c.term === 'Foundation' && isCourseInSubTerm(c, sub.id))
  );

  const displaySubTerms = activeFoundationSubTerms.length > 0 
    ? activeFoundationSubTerms 
    : FOUNDATION_SUB_TERMS.filter(sub => courses.some(c => c.term === 'Foundation' && isCourseInSubTerm(c, sub.id)));

  // Step 2: Foundation Term Selection (TERM 1 / TERM 2) on Mobile
  if (selectedTerm === 'Foundation' && !selectedSubTerm) {
    return (
      <div className="md:hidden bg-[#0b1120] min-h-screen">
        <div className="px-4 py-5">
          <div className="flex items-center justify-between bg-[#111827] border-[2px] border-white/10 rounded-2xl px-3.5 py-2.5 mb-5 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active:</span>
              <div className="inline-flex items-center gap-1.5 bg-blue-600 text-white pl-2.5 pr-1 py-1 rounded-xl border border-blue-400 text-xs font-black uppercase shadow-[2px_2px_0px_#0b1120]">
                <span>{selectedTerm}</span>
                <button 
                  type="button"
                  onClick={onClearTerm}
                  title="Remove Level Filter"
                  className="w-5 h-5 rounded-lg bg-red-500 hover:bg-red-600 active:bg-red-700 text-white flex items-center justify-center border border-red-700 shadow-sm transition-colors cursor-pointer"
                >
                  <Minus className="w-3 h-3 stroke-[3]" />
                </button>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <h2 className="font-black text-2xl leading-tight text-white">Select Foundation Term</h2>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {displaySubTerms.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectSubTerm?.(sub.id)}
                className="w-full text-left bg-white border-[2.5px] border-[#0b1120] rounded-[18px] p-3.5 shadow-[4px_4px_0px_#2563eb] active:translate-y-0.5 active:shadow-none transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border-2 border-[#0b1120] flex items-center justify-center text-blue-600">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  </div>
                  
                  <h3 className="font-black text-base text-[#0b1120] uppercase mb-2">{sub.name}</h3>

                  <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                    Subjects:
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {sub.subjects.map((subj) => (
                      <span
                        key={subj}
                        className="px-1.5 py-0.5 bg-gray-50 border border-gray-300 rounded-md text-[10px] font-black text-[#0b1120]"
                      >
                        {subj}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-black text-blue-600 uppercase">
                  <span>Select ›</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Choose Exam Stage on Mobile (only if 2 or more exams available)
  if (selectedTerm && (selectedTerm !== 'Foundation' || selectedSubTerm) && !selectedExamStage && activeBoxes.length > 1) {
    return (
      <div className="md:hidden bg-[#0b1120] min-h-screen">
        <div className="px-4 py-5">
          <div className="flex items-center justify-between bg-[#111827] border-[2px] border-white/10 rounded-2xl px-3.5 py-2.5 mb-5 shadow-lg">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active:</span>
              <div className="inline-flex items-center gap-1.5 bg-blue-600 text-white pl-2.5 pr-1 py-1 rounded-xl border border-blue-400 text-xs font-black uppercase shadow-[2px_2px_0px_#0b1120]">
                <span>{selectedTerm}</span>
                <button 
                  type="button"
                  onClick={onClearTerm}
                  title="Remove Level Filter"
                  className="w-5 h-5 rounded-lg bg-red-500 hover:bg-red-600 active:bg-red-700 text-white flex items-center justify-center border border-red-700 shadow-sm transition-colors cursor-pointer"
                >
                  <Minus className="w-3 h-3 stroke-[3]" />
                </button>
              </div>
              {selectedSubTerm && (
                <div className="inline-flex items-center gap-1.5 bg-blue-500 text-white pl-2.5 pr-1 py-1 rounded-xl border border-blue-300 text-xs font-black uppercase shadow-[2px_2px_0px_#0b1120]">
                  <span>{selectedSubTerm}</span>
                  <button 
                    type="button"
                    onClick={onClearSubTerm}
                    title="Remove Term Filter"
                    className="w-5 h-5 rounded-lg bg-red-500 hover:bg-red-600 active:bg-red-700 text-white flex items-center justify-center border border-red-700 shadow-sm transition-colors cursor-pointer"
                  >
                    <Minus className="w-3 h-3 stroke-[3]" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mb-5">
            <h2 className="font-black text-2xl leading-tight text-white">Choose Exam</h2>
            <p className="text-white/50 text-xs font-bold mt-1">Pick the exam box you want to prepare for.</p>
          </div>

          <div className={`grid ${activeBoxes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
            {activeBoxes.map((box) => (
              <button
                key={box}
                type="button"
                onClick={() => onSelectExamStage?.(box)}
                className="w-full text-center bg-white border-[2.5px] border-[#0b1120] rounded-[18px] px-4 py-4 text-[#0b1120] font-black text-base shadow-[4px_4px_0px_#2563eb] active:translate-y-0.5 active:shadow-none transition-all"
              >
                {box}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If no exams available on Mobile
  if (selectedTerm && (selectedTerm !== 'Foundation' || selectedSubTerm) && !selectedExamStage && activeBoxes.length === 0) {
    return (
      <div className="md:hidden bg-[#0b1120] min-h-screen">
        <div className="px-4 py-5">
          <div className="bg-[#111827] border-[2px] border-white/10 rounded-[20px] p-6 text-center mt-10">
            <p className="text-white/50 font-black text-sm mb-4">No exams are available for this term yet.</p>
            <button
              onClick={selectedSubTerm ? onClearSubTerm : onClearTerm}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs border-2 border-blue-400 uppercase"
            >
              Change {selectedSubTerm ? 'Term' : 'Level'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="md:hidden bg-[#0b1120] min-h-screen pb-44">
      <div className="px-4 py-5">
        {/* Mobile Stage Selector (Horizontal Scroll with smooth padding) - only if multiple exams exist */}
        {selectedTerm && !loading && activeBoxes.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4 scrollbar-none snap-x touch-pan-x">
            {activeBoxes.map((stage) => (
              <button
                key={stage}
                onClick={() => onSelectExamStage?.(stage)}
                className={`px-4 py-2.5 shrink-0 whitespace-nowrap rounded-xl font-black text-xs border-[2.5px] transition-all cursor-pointer ${
                  selectedExamStage === stage
                    ? 'bg-blue-600 text-white border-blue-500 shadow-[3px_3px_0px_#ffffff]'
                    : 'bg-[#111827] text-gray-300 hover:text-white border-white/10'
                }`}
              >
                {stage}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end justify-between gap-3 mb-4">
          <h2 className="font-black text-[25px] leading-tight text-white">Featured Cohorts</h2>
          <Link to="/explore/courses" className="shrink-0 inline-flex items-center gap-1 bg-white text-[#0b1120] border-[2.5px] border-[#0b1120] rounded-[10px] px-3 py-2 text-xs font-black shadow-[2px_2px_0px_#0b1120]">
            See All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-9 h-9 animate-spin text-white" />
            <span className="font-black text-white/60 text-sm">Loading courses...</span>
          </div>
        ) : (
          <>
            {filteredCourses.length === 0 ? (
              <div className="bg-white border-[2.5px] border-[#0b1120] rounded-2xl p-6 text-center shadow-[4px_4px_0px_#FF2424]">
                <h3 className="text-lg font-black text-[#0b1120] mb-1">No courses found</h3>
                <p className="text-xs font-bold text-gray-500">No cohorts found matching your selected stage.</p>
              </div>
            ) : (
              filteredCourses.map((course, i) => <CohortCard key={course.id} course={course} accent={i === 0} />)
            )}
          </>
        )}
      </div>

      {/* Sticky Active Filters Bar above Bottom Navigation and elevated center icon */}
      {selectedTerm && (
        <div 
          className="fixed inset-x-0 z-[80] bg-[#0b1120]/95 backdrop-blur-md border-t border-b border-white/10 px-3 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.6)]"
          style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 68px)' }}
        >
          <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">
              Active:
            </span>
            
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap shrink min-w-0">
              {/* Level / Term badge with red minus button */}
              <div className="inline-flex items-center gap-1 bg-blue-600 text-white pl-2 pr-1 py-0.5 rounded-lg border border-blue-400 text-[10px] font-black uppercase shrink-0 shadow-[1px_1px_0px_#0b1120]">
                <span>{selectedTerm}</span>
                <button
                  type="button"
                  onClick={onClearTerm}
                  title="Remove Level Filter"
                  className="w-4 h-4 rounded bg-red-500 hover:bg-red-600 active:bg-red-700 text-white flex items-center justify-center border border-red-700 transition-colors cursor-pointer shrink-0"
                >
                  <Minus className="w-2.5 h-2.5 stroke-[3]" />
                </button>
              </div>

              {/* Sub-term badge with red minus button */}
              {selectedSubTerm && (
                <div className="inline-flex items-center gap-1 bg-blue-500 text-white pl-2 pr-1 py-0.5 rounded-lg border border-blue-300 text-[10px] font-black uppercase shrink-0 shadow-[1px_1px_0px_#0b1120]">
                  <span>{selectedSubTerm}</span>
                  <button
                    type="button"
                    onClick={onClearSubTerm}
                    title="Remove Term Filter"
                    className="w-4 h-4 rounded bg-red-500 hover:bg-red-600 active:bg-red-700 text-white flex items-center justify-center border border-red-700 transition-colors cursor-pointer shrink-0"
                  >
                    <Minus className="w-2.5 h-2.5 stroke-[3]" />
                  </button>
                </div>
              )}

              {/* Exam Stage badge with red minus button */}
              {selectedExamStage && (
                <div className="inline-flex items-center gap-1 bg-emerald-500 text-white pl-2 pr-1 py-0.5 rounded-lg border border-emerald-300 text-[10px] font-black uppercase shrink-0 shadow-[1px_1px_0px_#0b1120]">
                  <span>{selectedExamStage}</span>
                  {activeBoxes.length > 1 && onClearExam && (
                    <button
                      type="button"
                      onClick={onClearExam}
                      title="Remove Exam Filter"
                      className="w-4 h-4 rounded bg-red-500 hover:bg-red-600 active:bg-red-700 text-white flex items-center justify-center border border-red-700 transition-colors cursor-pointer shrink-0"
                    >
                      <Minus className="w-2.5 h-2.5 stroke-[3]" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
