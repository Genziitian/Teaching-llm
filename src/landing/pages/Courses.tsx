'use client';
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Loader2, RefreshCcw, BookOpen, GraduationCap } from 'lucide-react';
import CourseCard, { CourseCardData } from '@/landing/components/CourseCard';
import MobileCourses from '@/landing/components/mobile/MobileCourses';
import OneOnOnePromoBanner from '@/landing/components/OneOnOnePromoBanner';
import { useSearchParams } from '@/landing/shims/router';
import { DEFAULT_EXAM_VISIBILITY, getCachedCoursesCatalog, loadCoursesCatalog } from '@/landing/lib/coursesList';

const DEFAULT_BOX_CONFIG = DEFAULT_EXAM_VISIBILITY;

export const FOUNDATION_SUB_TERMS = [
  {
    id: 'Term 1',
    name: 'TERM 1',
    subjects: ['MATH 1', 'ENG 1', 'STATS 1', 'CT'],
    subjectNames: ['Mathematics 1', 'English 1', 'Statistics 1', 'Computational Thinking'],
    desc: 'Foundational courses: Mathematics 1, English 1, Statistics 1, and Computational Thinking.'
  },
  {
    id: 'Term 2',
    name: 'TERM 2',
    subjects: ['MATH 2', 'ENG 2', 'STATS 2', 'PYTHON'],
    subjectNames: ['Mathematics 2', 'English 2', 'Statistics 2', 'Programming in Python'],
    desc: 'Foundational courses: Mathematics 2, English 2, Statistics 2, and Python Programming.'
  }
];

export const TERM_OPTIONS = [
  {
    id: 'Qualifier',
    name: 'Qualifier',
    icon: BookOpen,
    color: 'border-[#0b1120] hover:shadow-[8px_8px_0px_#eab308]',
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-300',
    iconColor: 'text-yellow-600',
    desc: 'Crack the qualifier with study plans, live classes and mock papers.'
  },
  {
    id: 'Re-attempt',
    name: 'Re-attempt',
    icon: RefreshCcw,
    color: 'border-[#0b1120] hover:shadow-[8px_8px_0px_#ef4444]',
    textColor: 'text-red-600',
    bgColor: 'bg-red-50 border-red-300',
    iconColor: 'text-red-600',
    desc: 'Retaking it? Get targeted prep and intensive practice to ace your next attempt.'
  },
  {
    id: 'Foundation',
    name: 'Foundation',
    icon: BookOpen,
    color: 'border-[#0b1120] hover:shadow-[8px_8px_0px_#3b82f6]',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-300',
    iconColor: 'text-blue-600',
    desc: 'Build a strong base with live concept sessions by senior IITM BS students.'
  },
  {
    id: 'DIPLOMA',
    name: 'DIPLOMA',
    icon: GraduationCap,
    color: 'border-[#0b1120] hover:shadow-[8px_8px_0px_#10b981]',
    textColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50 border-emerald-300',
    iconColor: 'text-emerald-600',
    desc: 'Go deep into advanced subjects, project labs and coding assignments.'
  }
];

export function isCourseInSubTerm(course: CourseCardData, subTerm: string): boolean {
  if (!subTerm) return true;
  
  const tags = course.tags || [];
  const hasBothTags = tags.some(t => t.toLowerCase() === 'both' || t.toLowerCase() === 'both terms' || t.toLowerCase() === 'both') ||
    (tags.some(t => t.toLowerCase() === 'term 1') && tags.some(t => t.toLowerCase() === 'term 2'));
    
  if (hasBothTags) return true;

  const textToScan = [
    course.name || '',
    course.subject || '',
    course.description || '',
    ...tags,
  ].join(' ').toLowerCase();

  const isTerm1Only = textToScan.includes('term 1') || textToScan.includes('term1') || textToScan.includes('t1');
  const isTerm2Only = textToScan.includes('term 2') || textToScan.includes('term2') || textToScan.includes('t2');

  if (isTerm1Only && !isTerm2Only) {
    return subTerm === 'Term 1';
  }
  if (isTerm2Only && !isTerm1Only) {
    return subTerm === 'Term 2';
  }

  return true;
}

export default function Courses() {
  const cached = getCachedCoursesCatalog();
  const [courses, setCourses] = useState<CourseCardData[]>(cached?.courses ?? []);
  const [loading, setLoading] = useState(!cached);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // URL search params manage filter state for step-by-step browser back history and course navigation memory
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTerm = searchParams.get('level') || null;
  const selectedSubTerm = searchParams.get('term') || null;
  const selectedExamStage = searchParams.get('exam') || null;

  // Boxes configured in Manager > Boxes
  const [examVisibility, setExamVisibility] = useState<Record<string, string[]>>(cached?.examVisibility ?? DEFAULT_BOX_CONFIG);
  const [boxesLoaded, setBoxesLoaded] = useState(!!cached);

  useEffect(() => {
    fetchCourses();
  }, []);

  // Show a term if it has at least one course and at least one box configured
  const activeTerms = TERM_OPTIONS.filter(option => {
    const hasCourse = courses.some(course => course.term === option.id);
    if (!hasCourse) return false;
    const rawBoxes = examVisibility[option.id] || DEFAULT_BOX_CONFIG[option.id] || [];
    return rawBoxes.length > 0;
  });

  const displayTerms = activeTerms.length > 0 ? activeTerms : TERM_OPTIONS.filter(option => courses.some(c => c.term === option.id));

  const activeFoundationSubTerms = FOUNDATION_SUB_TERMS.filter(sub =>
    courses.some(c => c.term === 'Foundation' && isCourseInSubTerm(c, sub.id))
  );

  const displaySubTerms = activeFoundationSubTerms.length > 0 
    ? activeFoundationSubTerms 
    : FOUNDATION_SUB_TERMS.filter(sub => courses.some(c => c.term === 'Foundation' && isCourseInSubTerm(c, sub.id)));

  const activeBoxes = selectedTerm ? (examVisibility[selectedTerm] || DEFAULT_BOX_CONFIG[selectedTerm] || []) : [];

  // Clear any selection that is not fully setup anymore
  useEffect(() => {
    if (!boxesLoaded || loading) return;

    if (selectedTerm) {
      const isTermValid = activeTerms.some(t => t.id === selectedTerm);
      if (!isTermValid && courses.length > 0) {
        setSearchParams({});
        return;
      }
    }

    if (selectedTerm === 'Foundation' && selectedSubTerm) {
      const isSubTermValid = activeFoundationSubTerms.some(s => s.id === selectedSubTerm);
      if (!isSubTermValid && courses.length > 0) {
        setSearchParams({ level: 'Foundation' });
        return;
      }
    }

    if (selectedExamStage && !activeBoxes.includes(selectedExamStage)) {
      const next: Record<string, string> = {};
      if (selectedTerm) next.level = selectedTerm;
      if (selectedSubTerm) next.term = selectedSubTerm;
      setSearchParams(next);
    }
  }, [selectedTerm, selectedSubTerm, selectedExamStage, activeTerms, activeFoundationSubTerms, activeBoxes, boxesLoaded, loading, courses.length, setSearchParams]);

  const fetchCourses = async () => {
    try {
      if (!getCachedCoursesCatalog()) setLoading(true);
      setLoadError('');
      const catalog = await loadCoursesCatalog();
      setCourses(catalog.courses);
      setExamVisibility(catalog.examVisibility);
      setBoxesLoaded(true);
    } catch (err) {
      console.error('Failed to load courses & settings:', err);
      setLoadError('Could not load courses. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-select single exam when only 1 exam is configured for the active level / sub-term
  useEffect(() => {
    if (!boxesLoaded || loading || !selectedTerm) return;
    if (selectedTerm === 'Foundation' && !selectedSubTerm) return;

    if (activeBoxes.length === 1 && selectedExamStage !== activeBoxes[0]) {
      const next: Record<string, string> = {};
      if (selectedTerm) next.level = selectedTerm;
      if (selectedSubTerm) next.term = selectedSubTerm;
      next.exam = activeBoxes[0];
      setSearchParams(next, { replace: true });
    }
  }, [selectedTerm, selectedSubTerm, activeBoxes, selectedExamStage, boxesLoaded, loading, setSearchParams]);

  const handleSelectTerm = (term: string) => {
    if (term !== 'Foundation') {
      const boxes = examVisibility[term] || DEFAULT_BOX_CONFIG[term] || [];
      if (boxes.length === 1) {
        setSearchParams({ level: term, exam: boxes[0] });
        return;
      }
    }

    setSearchParams({ level: term });
  };

  const handleSelectSubTerm = (subTerm: string) => {
    const boxes = examVisibility['Foundation'] || DEFAULT_BOX_CONFIG['Foundation'] || [];

    if (boxes.length === 1) {
      setSearchParams({ level: 'Foundation', term: subTerm, exam: boxes[0] });
      return;
    }

    setSearchParams({ level: 'Foundation', term: subTerm });
  };

  const handleSelectExamStage = (stage: string) => {
    const next: Record<string, string> = {};
    if (selectedTerm) next.level = selectedTerm;
    if (selectedSubTerm) next.term = selectedSubTerm;
    next.exam = stage;
    setSearchParams(next);
  };

  const handleClearTerm = () => {
    setSearchParams({});
  };

  const handleClearSubTerm = () => {
    const next: Record<string, string> = {};
    if (selectedTerm) next.level = selectedTerm;
    setSearchParams(next);
  };

  const handleClearExam = () => {
    const next: Record<string, string> = {};
    if (selectedTerm) next.level = selectedTerm;
    if (selectedSubTerm) next.term = selectedSubTerm;
    setSearchParams(next);
  };

  // Filter courses by selected academic term, sub-term, and selected exam stage:
  const filteredCourses = courses.filter(course => {
    const matchesTerm = !selectedTerm || course.term === selectedTerm;
    
    const matchesSubTerm = !selectedSubTerm || selectedTerm !== 'Foundation' || isCourseInSubTerm(course, selectedSubTerm);

    // Only filter by stage if a stage is selected
    const matchesStage = !selectedExamStage || 
      (Array.isArray(course.exam_stages) && course.exam_stages.includes(selectedExamStage));

    const matchesSearch = course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
    return matchesTerm && matchesSubTerm && matchesStage && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-20 px-6">
        <Loader2 className="w-12 h-12 animate-spin text-[#0b1120] mb-4" />
        <span className="font-black text-gray-400">Loading courses...</span>
      </div>
    );
  }

  if (loadError && courses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-20 px-6 text-center">
        <p className="font-black text-[#0b1120] mb-4">{loadError}</p>
        <button
          type="button"
          onClick={fetchCourses}
          className="px-5 py-3 bg-[#0b1120] text-white rounded-xl font-black text-sm border-2 border-[#0b1120]"
        >
          Try again
        </button>
      </div>
    );
  }

  // Step 1: Select Academic Tier / Level
  if (!selectedTerm) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 md:py-20 px-4 md:px-6">

        <div className="max-w-6xl w-full text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-5 md:mb-12"
          >
            <h1 className="text-xl sm:text-3xl md:text-5xl font-black text-[#0b1120] leading-tight tracking-tight">
              Please Select Your <span className="text-blue-600">Term</span>
            </h1>
          </motion.div>

          {/* 1:1 Promo Banner */}
          <div className="max-w-5xl mx-auto mb-8 text-left">
            <OneOnOnePromoBanner variant="inline" />
          </div>

          {/* At least 2 boxes per row on mobile (grid-cols-2), responsive on desktop */}
          <div className={`grid grid-cols-2 ${displayTerms.length === 4 ? 'md:grid-cols-4' : displayTerms.length === 3 ? 'md:grid-cols-3' : displayTerms.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-3.5 md:gap-8 text-center md:text-left max-w-5xl mx-auto`}>
            {displayTerms.map((term, index) => {
              const IconComponent = term.icon;
              return (
                <motion.div
                  key={term.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.4 }}
                  whileHover={{ scale: 1.03, y: -4 }}
                  onClick={() => handleSelectTerm(term.id)}
                  className={`group bg-white border-[3px] md:border-[4px] rounded-[1.5rem] md:rounded-[2rem] p-4 sm:p-6 md:p-8 cursor-pointer transition-all flex flex-col justify-between items-center md:items-start shadow-[4px_4px_0px_#0b1120] md:shadow-[6px_6px_0px_#0b1120] hover:translate-y-0.5 active:translate-y-1 ${term.color}`}
                >
                  <div className="w-full flex flex-col items-center md:items-start">
                    <div className={`w-11 h-11 md:w-14 md:h-14 border-[2.5px] md:border-[3px] rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-6 ${term.bgColor}`}>
                      <IconComponent className={`w-5 h-5 md:w-6 md:h-6 ${term.iconColor}`} />
                    </div>
                    <h3 className="text-sm sm:text-base md:text-2xl font-black mb-1 md:mb-3 text-[#0b1120] tracking-tight uppercase">
                      {term.name}
                    </h3>
                    <p className="hidden md:block text-gray-500 font-bold text-sm leading-relaxed mb-6">
                      {term.desc}
                    </p>
                  </div>
                  <div className={`mt-2 md:mt-auto pt-0 md:pt-4 flex items-center justify-center md:justify-between text-[11px] md:text-xs font-black uppercase transition-transform group-hover:translate-x-1 ${term.textColor}`}>
                    <span className="md:inline">Select ›</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: If Foundation is selected, select Sub-Term (TERM 1 / TERM 2)
  if (selectedTerm === 'Foundation' && !selectedSubTerm) {
    return (
      <>
        <MobileCourses 
          selectedTerm={selectedTerm}
          selectedSubTerm={selectedSubTerm}
          selectedExamStage={selectedExamStage}
          onClearTerm={handleClearTerm}
          onClearSubTerm={handleClearSubTerm}
          onClearExam={handleClearExam}
          onSelectSubTerm={handleSelectSubTerm}
          onSelectExamStage={handleSelectExamStage}
        />

        <div className="hidden md:flex min-h-screen bg-gray-50 flex-col justify-center items-center py-20 px-6">
          <div className="max-w-5xl w-full text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-10"
            >
              <div className="mb-5 flex justify-center">
                <span className="px-4 py-1.5 bg-[#0b1120] text-white border-2 border-[#0b1120] shadow-[3px_3px_0px_#2563eb] rounded-xl text-xs font-black uppercase tracking-wider">
                  {selectedTerm} Level
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-[#0b1120] leading-tight tracking-tight">
                Select Your <span className="text-blue-600">Foundation Term</span>
              </h1>
            </motion.div>

            <div className={`grid grid-cols-1 ${displaySubTerms.length === 1 ? 'max-w-md' : 'md:grid-cols-2 max-w-4xl'} gap-8 text-left mx-auto`}>
              {displaySubTerms.map((sub, index) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  onClick={() => handleSelectSubTerm(sub.id)}
                  className="group bg-white border-[4px] border-[#0b1120] rounded-[2rem] p-8 cursor-pointer transition-all flex flex-col justify-between shadow-[8px_8px_0px_#0b1120] hover:shadow-[8px_8px_0px_#2563eb]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3.5 py-1.5 bg-blue-50 text-blue-700 border-2 border-blue-200 rounded-xl text-xs font-black uppercase tracking-wider">
                        Foundation
                      </span>
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    </div>

                    <h3 className="text-3xl font-black text-[#0b1120] tracking-tight mb-4">
                      {sub.name}
                    </h3>

                    {/* Subjects list underneath */}
                    <div className="mb-6">
                      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">
                        Included Subjects
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sub.subjects.map((subj) => (
                          <span
                            key={subj}
                            className="px-3 py-1.5 bg-gray-50 border-2 border-[#0b1120] text-[#0b1120] rounded-xl text-xs font-black shadow-[2px_2px_0px_#0b1120]"
                          >
                            {subj}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t-2 border-dashed border-gray-100 flex items-center justify-between text-xs font-black uppercase text-blue-600 group-hover:translate-x-1 transition-transform">
                    <span>Select {sub.name} ›</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <button
              onClick={handleClearTerm}
              className="mt-10 inline-flex items-center gap-2 px-5 py-3 border-[2.5px] border-[#0b1120] rounded-xl font-black text-xs bg-white hover:bg-gray-50 text-[#0b1120] shadow-[3px_3px_0px_#0b1120] active:translate-y-0.5 active:shadow-none transition-all"
            >
              <RefreshCcw className="w-4 h-4" />
              Change Level
            </button>
          </div>
        </div>
      </>
    );
  }

  // Step 3: Choose Exam Stage (only if there are 2 or more exams available)
  if (!selectedExamStage && activeBoxes.length > 1) {
    return (
      <>
        <MobileCourses 
          selectedTerm={selectedTerm}
          selectedSubTerm={selectedSubTerm}
          selectedExamStage={selectedExamStage}
          onClearTerm={handleClearTerm}
          onClearSubTerm={handleClearSubTerm}
          onClearExam={handleClearExam}
          onSelectSubTerm={handleSelectSubTerm}
          onSelectExamStage={handleSelectExamStage}
        />

        <div className="hidden md:flex min-h-screen bg-gray-50 flex-col justify-center items-center py-20 px-6">
          <div className="max-w-5xl w-full text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-10"
            >
              <div className="mb-5 flex justify-center items-center gap-2">
                <span className="px-4 py-1.5 bg-[#0b1120] text-white border-2 border-[#0b1120] shadow-[3px_3px_0px_#2563eb] rounded-xl text-xs font-black uppercase tracking-wider">
                  {selectedTerm}
                </span>
                {selectedSubTerm && (
                  <span className="px-4 py-1.5 bg-blue-600 text-white border-2 border-[#0b1120] shadow-[3px_3px_0px_#0b1120] rounded-xl text-xs font-black uppercase tracking-wider">
                    {selectedSubTerm}
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-[#0b1120] mb-4 leading-tight tracking-tight">
                Choose <span className="text-blue-600">Exam</span>
              </h1>
              <p className="text-gray-500 font-bold max-w-xl mx-auto text-sm md:text-base">
                Pick the exam box you want to prepare for.
              </p>
            </motion.div>

            <div className="flex flex-wrap justify-center gap-6">
              {activeBoxes.map((box, index) => (
                <motion.button
                  key={box}
                  type="button"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.35 }}
                  whileHover={{ scale: 1.04, y: -3 }}
                  onClick={() => handleSelectExamStage(box)}
                  className="min-w-[180px] px-8 py-6 bg-white border-[4px] border-[#0b1120] rounded-[1.5rem] text-[#0b1120] font-black text-xl shadow-[6px_6px_0px_#0b1120] hover:shadow-[6px_6px_0px_#2563eb] transition-all"
                >
                  {box}
                </motion.button>
              ))}
            </div>

            <div className="mt-10 flex items-center justify-center gap-3">
              {selectedSubTerm && (
                <button
                  onClick={handleClearSubTerm}
                  className="inline-flex items-center gap-2 px-5 py-3 border-[2.5px] border-[#0b1120] rounded-xl font-black text-xs bg-white hover:bg-gray-50 text-[#0b1120] shadow-[3px_3px_0px_#0b1120] active:translate-y-0.5 active:shadow-none transition-all"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Change Term
                </button>
              )}
              <button
                onClick={handleClearTerm}
                className="inline-flex items-center gap-2 px-5 py-3 border-[2.5px] border-[#0b1120] rounded-xl font-black text-xs bg-white hover:bg-gray-50 text-[#0b1120] shadow-[3px_3px_0px_#0b1120] active:translate-y-0.5 active:shadow-none transition-all"
              >
                <RefreshCcw className="w-4 h-4" />
                Change Level
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // If no exams are configured at all for this term/sub-term
  if (!selectedExamStage && activeBoxes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-20 px-6">
        <div className="bg-white border-[4px] border-[#0b1120] rounded-[2rem] p-10 max-w-lg text-center shadow-[8px_8px_0px_#0b1120]">
          <h3 className="text-2xl font-black text-gray-400 mb-6">No exams are available for this term yet.</h3>
          <button
            onClick={selectedSubTerm ? handleClearSubTerm : handleClearTerm}
            className="px-6 py-3 border-[3px] border-[#0b1120] rounded-xl font-black text-sm bg-white hover:bg-gray-50 text-[#0b1120] shadow-[4px_4px_0px_#0b1120] active:translate-y-1 active:shadow-none transition-all"
          >
            Change {selectedSubTerm ? 'Term' : 'Level'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* Mobile cohorts screen (md:hidden) — matches the Gen-Z IITian mobile design */}
    <MobileCourses 
      selectedTerm={selectedTerm}
      selectedSubTerm={selectedSubTerm}
      selectedExamStage={selectedExamStage}
      onClearTerm={handleClearTerm}
      onClearSubTerm={handleClearSubTerm}
      onClearExam={handleClearExam}
      onSelectSubTerm={handleSelectSubTerm}
      onSelectExamStage={handleSelectExamStage}
    />

    <div className="hidden md:block min-h-screen bg-white">
      {/* 1:1 Personalised Teaching Notification */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <OneOnOnePromoBanner variant="inline" />
      </div>

      {/* Exam Selector Tabs Header */}
      <div className="max-w-7xl mx-auto px-6 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b-2 border-gray-100 pb-6">
        {/* Exam Tabs directly on the left */}
        <div className="flex flex-wrap items-center gap-3">
          {selectedTerm && !loading && activeBoxes.length > 1 ? (
            activeBoxes.map((stage) => (
              <button
                key={stage}
                onClick={() => handleSelectExamStage(stage)}
                className={`px-6 py-2.5 rounded-2xl font-black text-sm border-[3px] border-[#0b1120] transition-all cursor-pointer ${
                  selectedExamStage === stage
                    ? 'bg-[#0b1120] text-white shadow-[4px_4px_0px_#2563eb]'
                    : 'bg-white text-[#0b1120] hover:bg-gray-50 shadow-[2px_2px_0px_#0b1120]'
                }`}
              >
                {stage}
              </button>
            ))
          ) : selectedExamStage ? (
            <span className="px-6 py-2.5 bg-[#0b1120] text-white border-[3px] border-[#0b1120] shadow-[4px_4px_0px_#2563eb] rounded-2xl text-sm font-black uppercase tracking-wider">
              {selectedExamStage}
            </span>
          ) : null}
        </div>

        {/* Change Level / Term actions on the right */}
        <div className="flex flex-wrap items-center gap-3">
          {selectedSubTerm && (
            <button 
              onClick={handleClearSubTerm}
              className="sm:self-center px-4 py-2.5 border-[2.5px] border-[#0b1120] rounded-xl font-black text-xs bg-white hover:bg-gray-50 text-[#0b1120] shadow-[3px_3px_0px_#0b1120] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 justify-center cursor-pointer"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Change Term
            </button>
          )}
          <button 
            onClick={handleClearTerm}
            className="sm:self-center px-4 py-2.5 border-[2.5px] border-[#0b1120] rounded-xl font-black text-xs bg-white hover:bg-gray-50 text-[#0b1120] shadow-[3px_3px_0px_#0b1120] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 justify-center cursor-pointer"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Change Level
          </button>
        </div>
      </div>

      {/* Courses Grid */}
      <section className="py-16 px-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-[#0b1120]" />
            <span className="font-black text-gray-400">Loading courses...</span>
          </div>
        ) : (
          <>
            {filteredCourses.length === 0 ? (
              <div className="text-center py-20">
                <h3 className="text-2xl font-black text-gray-400">No courses found for the selected stage.</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredCourses.map((course) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex"
                  >
                    <CourseCard course={course} className="w-full" />
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Start Early, Stay Strong Footer Banner */}
      <section className="bg-[#0b1120] py-14 px-6 relative overflow-hidden mt-12 border-t-[3px] border-[#0b1120]">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10 text-center flex flex-col items-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-5 leading-tight tracking-tight"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Start Early, Stay Strong</span>
          </motion.h2>
          
          <div className="max-w-3xl mx-auto">
            <p className="text-base md:text-lg text-gray-300 font-bold mb-3 leading-relaxed">
              Learn from <span className="text-white">IITM BS seniors</span> with a practical-first approach, clear concepts, real strategies, and zero unnecessary theory.
            </p>
            <p className="text-[10px] md:text-xs text-gray-500 font-black uppercase tracking-[0.2em] opacity-80 italic">
              Note: Access is granted immediately after successful payment verification
            </p>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
