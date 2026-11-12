'use client';
import { Share, ChevronRight, ChevronDown, X, ClipboardList, FileText, Calculator, TrendingUp, BookOpen } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from '@/landing/shims/router';
import { staticNotes } from '@/landing/data/staticNotes';
import BookletShelf from '@/landing/components/booklet/BookletShelf';

const levels = ["Qualifier", "Foundation", "Diploma"] as const;

const levelSubjects: Record<string, string[]> = {
  Qualifier: ["Maths 1", "Stats 1", "CT", "English 1"],
  Foundation: ["Maths 1", "Stats 1", "Maths 2", "Stats 2", "English 1", "English 2", "Python", "CT"],
  Diploma: ["MLF", "BDM", "MLT", "MLP", "TDS", "DBMS", "Java", "PDSA", "MAD 1", "MAD 2", "BA", "Deep Learning & Gen AI", "System Commands"],
};

const allSubjects = Array.from(new Set(Object.values(levelSubjects).flat())).filter(Boolean);

type TabKey = 'notes' | 'pyqs' | 'booklet' | 'tools' | 'dates' | 'updates';

interface PYQResource {
  id: number | string;
  level: string;
  subject: string;
  resource_type: string;
  sub_type: string;
  title: string;
  description: string;
  url: string;
}

export default function Resources() {
  const [copied, setCopied] = useState(false);
  // Active tab lives in the URL (?tab=booklet) so the navbar can link straight to a tab
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabKey = (['notes', 'pyqs', 'booklet', 'tools'] as const).includes(tabParam as any) ? (tabParam as TabKey) : 'notes';
  const setActiveTab = (tab: TabKey) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'notes') next.delete('tab'); else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // PYQ state
  const [pyqLevel, setPyqLevel] = useState<string>("Foundation");
  const [pyqSubject, setPyqSubject] = useState<string | null>(null);
  const [pyqExam, setPyqExam] = useState<string | null>(null);
  const [pyqResources, setPyqResources] = useState<PYQResource[]>([]);
  const [pyqLoading, setPyqLoading] = useState(false);
  const [availableExamTypes, setAvailableExamTypes] = useState<string[]>([]);

  // Gate popup state
  const [showGate, setShowGate] = useState(false);
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check localStorage for access on mount
  useEffect(() => {
    // Temporarily disabled for now based on user request
    // const access = localStorage.getItem('resource_access');
    // if (access) {
    //   setHasAccess(true);
    // } else {
    //   setShowGate(true);
    // }
    setHasAccess(true);
    setShowGate(false);
  }, []);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hold the full set of PYQs (API + static merged) for the current level+subject.
  // Exam-type filtering happens in render so changing pyqExam doesn't refetch.
  const [allPyqResources, setAllPyqResources] = useState<PYQResource[]>([]);

  // Fetch + merge PYQ resources when level+subject change
  useEffect(() => {
    if (activeTab !== 'pyqs' || !pyqSubject) {
      setAllPyqResources([]);
      setAvailableExamTypes([]);
      return;
    }

    const staticPyqs = staticNotes.filter(
      n => n.level === pyqLevel && n.subject === pyqSubject && n.resource_type === 'pyq'
    ) as PYQResource[];

    setPyqLoading(true);
    fetch(`/api/resources?level=${encodeURIComponent(pyqLevel)}&subject=${encodeURIComponent(pyqSubject)}&type=pyq`)
      .then(r => r.json())
      .then(data => {
        const apiData: PYQResource[] = Array.isArray(data) ? data : [];
        const apiUrls = new Set(apiData.map(r => r.url));
        const merged = [...apiData, ...staticPyqs.filter(s => !apiUrls.has(s.url))];
        setAllPyqResources(merged);

        const order = ["Qualifier Exam", "Quiz 1", "Quiz 2", "End Term", "OPPE 1", "OPPE 2"];
        const types = Array.from(new Set(merged.map(r => r.sub_type).filter(Boolean)));
        types.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        setAvailableExamTypes(types);

        // Reset exam filter if it's no longer valid for this subject
        if (pyqExam && !types.includes(pyqExam)) setPyqExam(null);
        setPyqLoading(false);
      })
      .catch(() => {
        // API failed - still show static PYQs so users see something
        setAllPyqResources(staticPyqs);
        const order = ["Qualifier Exam", "Quiz 1", "Quiz 2", "End Term", "OPPE 1", "OPPE 2"];
        const types = Array.from(new Set(staticPyqs.map(r => r.sub_type).filter(Boolean)));
        types.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        setAvailableExamTypes(types);
        if (pyqExam && !types.includes(pyqExam)) setPyqExam(null);
        setPyqLoading(false);
      });
  }, [activeTab, pyqLevel, pyqSubject]);

  // Apply exam-type filter client-side
  useEffect(() => {
    setPyqResources(pyqExam ? allPyqResources.filter(r => r.sub_type === pyqExam) : allPyqResources);
  }, [pyqExam, allPyqResources]);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const handleLevelSelect = (level: string) => {
    setSelectedLevel(level);
    setSelectedSubject(null);
    setOpenDropdown(null);
  };

  const handleSubjectSelect = (subject: string) => {
    setSelectedSubject(subject);
    setOpenDropdown(null);
  };

  const clearFilters = () => { setSelectedLevel(null); setSelectedSubject(null); };

  const availableSubjects = selectedLevel ? levelSubjects[selectedLevel] : allSubjects;
  const filteredLevels = selectedLevel ? (["Qualifier", "Foundation", "Diploma"] as const).filter((l) => l === selectedLevel) : (["Qualifier", "Foundation", "Diploma"] as const);

  const pyqSubjects = levelSubjects[pyqLevel] || [];

  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateSubmitting(true);
    const supabaseUrl = process.env.NEXT_PUBLIC_STOREFRONT_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_STOREFRONT_SUPABASE_ANON_KEY || '';
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const params = new URLSearchParams(window.location.search);

    const payload = new URLSearchParams();
    payload.append('form_type', 'Resource Gate');
    payload.append('name', formData.get('entry.name') as string);
    payload.append('email', formData.get('entry.email') as string);
    payload.append('phone', formData.get('entry.phone') as string);
    payload.append('level', formData.get('entry.level') as string);
    payload.append('utm_source', params.get('utm_source') || 'direct');
    payload.append('utm_medium', params.get('utm_medium') || 'organic');
    payload.append('utm_campaign', params.get('utm_campaign') || 'none');

    try {
      // Replace YOUR_SCRIPT_URL with your Google Apps Script Web App URL
      await fetch('https://script.google.com/macros/s/AKfycbysGFbxo9r41D5kMnKmO90rr9u_mzn5aBuhZG6AFvRZOhDtFJ9dclTHgJJqdcBNS-Ny/exec', {
        method: 'POST',
        mode: 'no-cors',
        body: payload
      });
    } catch { /* no-cors ignores response */ }

    localStorage.setItem('resource_access', JSON.stringify({
      razorpay_key: process.env.NEXT_PUBLIC_STOREFRONT_RAZORPAY_KEY_ID,
      email: formData.get('entry.email'),
      phone: formData.get('entry.phone'),
      level: formData.get('entry.level'),
      timestamp: new Date().toISOString()
    }));
    setGateSubmitting(false);
    setHasAccess(true);
    setShowGate(false);
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-100">

      {/* ====== GATE POPUP ====== */}
      {showGate && !hasAccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-[3px] border-[#0b1120] rounded-xl p-6 lg:p-8 max-w-lg w-full shadow-[10px_10px_0px_#10b981] relative animate-[fadeIn_0.3s_ease-out]">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#eef2ff] border-[3px] border-[#0b1120] mb-3 shadow-[3px_3px_0px_#0b1120]">
                <span className="text-2xl">📚</span>
              </div>
              <h2 className="text-xl lg:text-2xl font-black text-[#0b1120] mb-1.5">Access Free Resources</h2>
              <p className="text-gray-500 font-medium text-xs">Please fill this form to continue to the resource page</p>
            </div>

            <form onSubmit={handleGateSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-[#0b1120] text-xs">Full Name *</label>
                <input
                  name="entry.name"
                  type="text"
                  placeholder="Your full name"
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 border-[3px] border-[#0b1120] text-[#0b1120] placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#10b981] transition-colors font-medium text-sm"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-[#0b1120] text-xs">Email Address *</label>
                <input
                  name="entry.email"
                  type="email"
                  placeholder="your@email.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 border-[3px] border-[#0b1120] text-[#0b1120] placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#10b981] transition-colors font-medium text-sm"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-[#0b1120] text-xs">WhatsApp / Phone Number *</label>
                <div className="flex gap-3">
                  <div className="w-14 px-2 py-2 rounded-xl bg-gray-100 border-[3px] border-[#0b1120] text-[#0b1120] font-bold flex items-center justify-center shrink-0 text-xs">
                    +91
                  </div>
                  <input
                    name="entry.phone"
                    type="tel"
                    placeholder="98765 43210"
                    className="w-full px-3.5 py-2 rounded-xl bg-gray-50 border-[3px] border-[#0b1120] text-[#0b1120] placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#10b981] transition-colors font-medium text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-[#0b1120] text-xs">Your Level *</label>
                <select
                  name="entry.level"
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 border-[3px] border-[#0b1120] text-[#0b1120] focus:outline-none focus:bg-white focus:border-[#10b981] transition-colors font-medium appearance-none cursor-pointer text-sm"
                  required
                >
                  <option value="">Select your level</option>
                  <option value="Qualifier">Qualifier</option>
                  <option value="Foundation">Foundation</option>
                  <option value="Diploma">Diploma</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={gateSubmitting}
                className="w-full py-2.5 bg-[#10b981] text-white rounded-xl font-black text-sm border-[3px] border-[#0b1120] shadow-[4px_4px_0px_#0b1120] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_#0b1120] transition-all mt-1 disabled:opacity-60"
              >
                {gateSubmitting ? '⏳ Submitting...' : '🚀 Continue to Resources'}
              </button>
              <p className="text-center text-xs font-medium text-gray-400 mt-1">
                Your data is safe with us. We only use it to send you relevant updates.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl md:text-4xl font-black text-[#0b1120] tracking-tight">
            IITM BS DEGREE RESOURCES
          </h1>
          <button onClick={handleShare} className="flex items-center gap-2 px-5 py-2.5 bg-white border-[3px] border-[#0b1120] rounded-xl text-xs font-bold text-[#0b1120] hover:-translate-y-1 hover:-translate-x-1 shadow-[3px_3px_0px_#0b1120] hover:shadow-[5px_5px_0px_#0b1120] transition-all w-fit shrink-0">
            <Share className="w-3 h-3" /> {copied ? "Copied!" : "Share"}
          </button>
        </div>

        <div className="mt-6 bg-[#fff7ed] border-[3px] border-[#0b1120] rounded-2xl p-4 shadow-[4px_4px_0px_#f59e0b]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-1">New Section</p>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#0b1120]">Graded Assignment</h2>
              <p className="text-gray-600 font-medium mt-0.5 text-sm">
                Open the dedicated page, choose your level and subject, then browse Week 1 to Week 12.
              </p>
            </div>
            <Link
              to="/graded-assignment"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0b1120] text-white border-[3px] border-[#0b1120] rounded-xl font-black text-xs hover:-translate-y-1 hover:-translate-x-1 shadow-[3px_3px_0px_#10b981] transition-all"
            >
              Open Graded Assignment <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full bg-white border-y-2 border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-8 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-2 py-3 text-xs font-black whitespace-nowrap border-b-[3px] transition-colors ${activeTab === 'notes' ? 'border-[#10b981] text-[#0b1120]' : 'border-transparent text-gray-500 hover:text-[#0b1120]'}`}
            >
              <FileText className="w-3.5 h-3.5" /> Study Notes
            </button>
            <button
              onClick={() => setActiveTab('pyqs')}
              className={`flex items-center gap-2 py-3 text-xs font-black whitespace-nowrap border-b-[3px] transition-colors ${activeTab === 'pyqs' ? 'border-[#f59e0b] text-[#0b1120]' : 'border-transparent text-gray-500 hover:text-[#0b1120]'}`}
            >
              <ClipboardList className="w-3.5 h-3.5" /> PYQs
            </button>
            <button
              onClick={() => setActiveTab('booklet')}
              className={`flex items-center gap-2 py-3 text-xs font-black whitespace-nowrap border-b-[3px] transition-colors ${activeTab === 'booklet' ? 'border-[#8b5cf6] text-[#0b1120]' : 'border-transparent text-gray-500 hover:text-[#0b1120]'}`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Booklet
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`flex items-center gap-2 py-3 text-xs font-black whitespace-nowrap border-b-[3px] transition-colors ${activeTab === 'tools' ? 'border-[#10b981] text-[#0b1120]' : 'border-transparent text-gray-500 hover:text-[#0b1120]'}`}
            >
              <Calculator className="w-3.5 h-3.5" /> Tools
            </button>
          </div>
        </div>
      </div>

      {/* ====== BOOKLET TAB ====== */}
      {activeTab === 'booklet' && <BookletShelf />}

      {/* ====== TOOLS TAB ====== */}
      {activeTab === 'tools' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-gray-500 font-medium mb-8 max-w-2xl">
            Calculate your CGPA/SGPA and predict a course grade before the Final — everything runs in your browser.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-24">
            <Link
              to="/tools/cgpa-calculator"
              className="group flex flex-col gap-3 p-6 bg-white border-[3px] border-[#0b1120] rounded-2xl hover:-translate-y-1 hover:-translate-x-1 shadow-[4px_4px_0px_#0b1120] hover:shadow-[8px_8px_0px_#0b1120] transition-all"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50">
                <Calculator className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-black text-lg text-[#0b1120] group-hover:text-[#10b981] transition-colors">CGPA / SGPA Ledger</h3>
              <p className="text-sm text-gray-500 font-medium">
                Log every term's grades and see your running CGPA and equivalent percentage update live. Sign-in required to save your ledger.
              </p>
              <div className="mt-auto flex items-center gap-2 text-xs text-gray-600 font-bold">
                Open Ledger <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
            <Link
              to="/tools/grade-predictor"
              className="group flex flex-col gap-3 p-6 bg-white border-[3px] border-[#0b1120] rounded-2xl hover:-translate-y-1 hover:-translate-x-1 shadow-[4px_4px_0px_#0b1120] hover:shadow-[8px_8px_0px_#0b1120] transition-all"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-50">
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="font-black text-lg text-[#0b1120] group-hover:text-[#10b981] transition-colors">Grade Predictor</h3>
              <p className="text-sm text-gray-500 font-medium">
                Enter your quiz/PE marks and see the exact minimum Final-exam score you need for each grade band.
              </p>
              <div className="mt-auto flex items-center gap-2 text-xs text-gray-600 font-bold">
                Open Predictor <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* ====== NOTES TAB ====== */}
      {activeTab === 'notes' && (
        <div className="max-w-7xl mx-auto px-6 py-8">

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-8" ref={dropdownRef}>
            <div className="relative">
              <button onClick={() => toggleDropdown('level')} className={`flex items-center gap-2 px-4 py-2 border-[3px] border-[#0b1120] rounded-xl text-xs font-bold hover:-translate-y-1 hover:-translate-x-1 shadow-[3px_3px_0px_#0b1120] hover:shadow-[5px_5px_0px_#0b1120] transition-all ${selectedLevel ? 'bg-[#10b981] text-white' : 'bg-white text-[#0b1120]'}`}>
                {selectedLevel || "Level"} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'level' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'level' && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white border-[3px] border-[#0b1120] rounded-xl shadow-[4px_4px_0px_#0b1120] z-50 overflow-hidden">
                  {levels.map((item, i) => (
                    <button key={i} onClick={() => handleLevelSelect(item)} className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${selectedLevel === item ? 'bg-[#10b981] text-white' : 'text-[#0b1120] hover:bg-gray-100'}`}>
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button onClick={() => toggleDropdown('subjects')} className={`flex items-center gap-2 px-4 py-2 border-[3px] border-[#0b1120] rounded-xl text-xs font-bold hover:-translate-y-1 hover:-translate-x-1 shadow-[3px_3px_0px_#0b1120] hover:shadow-[5px_5px_0px_#0b1120] transition-all ${selectedSubject ? 'bg-[#10b981] text-white' : 'bg-white text-[#0b1120]'}`}>
                {selectedSubject || "Subjects"} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'subjects' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'subjects' && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white border-[3px] border-[#0b1120] rounded-xl shadow-[4px_4px_0px_#0b1120] z-50 overflow-hidden max-h-64 overflow-y-auto">
                  {availableSubjects.map((item, i) => (
                    <button key={i} onClick={() => handleSubjectSelect(item)} className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${selectedSubject === item ? 'bg-[#10b981] text-white' : 'text-[#0b1120] hover:bg-gray-100'}`}>{item}</button>
                  ))}
                </div>
              )}
            </div>

            {(selectedLevel || selectedSubject) && (
              <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 bg-red-50 border-[3px] border-red-400 rounded-xl text-xs font-bold text-red-600 hover:bg-red-100 transition-all">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Subject Cards */}
          <div className="space-y-16 pb-24">
            {filteredLevels.map((level) => {
              const subjects = levelSubjects[level];
              const filteredSubjects = selectedSubject ? subjects.filter((s) => s === selectedSubject) : subjects;
              if (filteredSubjects.length === 0) return null;
              return (
                <section key={level}>
                  <h2 className="text-3xl font-black text-[#0b1120] mb-6 border-b-4 border-gray-100 pb-3">{level} Level</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredSubjects.map((subj, i) => (
                      <Link key={i} to={`/resources/${encodeURIComponent(level)}/${encodeURIComponent(subj)}`} className="p-4 bg-white border-[3px] border-[#0b1120] rounded-xl hover:-translate-y-1 hover:-translate-x-1 shadow-[3px_3px_0px_#0b1120] hover:shadow-[6px_6px_0px_#0b1120] transition-all cursor-pointer group flex flex-col h-full">
                        <div className="font-black text-[#0b1120] text-lg mb-3 group-hover:text-[#10b981] transition-colors">{subj}</div>
                        <div className="mt-auto flex items-center gap-2 text-xs text-gray-600 font-bold">
                          View Resources <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* ====== PYQs TAB ====== */}
      {activeTab === 'pyqs' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-gray-500 font-medium mb-8 max-w-2xl">
            Select your level, subject, and exam type to find previous year question papers.
          </p>

          {/* Step 1: Level Selection */}
          <div className="mb-8">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3">Step 1 — Select Level</h3>
            <div className="flex flex-wrap gap-2">
              {(["Qualifier", "Foundation", "Diploma"] as const).map((lv) => (
                <button
                  key={lv}
                  onClick={() => { setPyqLevel(lv); setPyqSubject(null); setPyqExam(null); }}
                  className={`px-4 py-2 border-[3px] border-[#0b1120] rounded-xl text-xs font-black transition-all hover:-translate-y-0.5 ${pyqLevel === lv ? 'bg-[#f59e0b] text-white shadow-[3px_3px_0px_#0b1120]' : 'bg-white text-[#0b1120] shadow-[2px_2px_0px_#0b1120]'}`}
                >
                  {lv}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Subject Selection */}
          <div className="mb-8">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3">Step 2 — Select Subject</h3>
            <div className="flex flex-wrap gap-2">
              {pyqSubjects.map((subj) => (
                <button
                  key={subj}
                  onClick={() => { setPyqSubject(subj); setPyqExam(null); }}
                  className={`px-4 py-2 border-[3px] border-[#0b1120] rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 ${pyqSubject === subj ? 'bg-[#0b1120] text-white shadow-[3px_3px_0px_#f59e0b]' : 'bg-white text-[#0b1120] shadow-[2px_2px_0px_#0b1120]'}`}
                >
                  {subj}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Exam Type Selection (only show when multiple types) */}
          {pyqSubject && availableExamTypes.length > 1 && (
            <div className="mb-10">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3">Step 3 — Select Exam Type</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPyqExam(null)}
                  className={`px-4 py-2 border-[3px] border-[#0b1120] rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 ${pyqExam === null ? 'bg-[#10b981] text-white shadow-[3px_3px_0px_#0b1120]' : 'bg-white text-[#0b1120] shadow-[2px_2px_0px_#0b1120]'}`}
                >
                  All
                </button>
                {availableExamTypes.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setPyqExam(ex)}
                    className={`px-4 py-2 border-[3px] border-[#0b1120] rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 ${pyqExam === ex ? 'bg-[#10b981] text-white shadow-[3px_3px_0px_#0b1120]' : 'bg-white text-[#0b1120] shadow-[2px_2px_0px_#0b1120]'}`}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {pyqSubject && (
            <div className="pb-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-8 rounded-full bg-[#f59e0b]" />
                <h2 className="text-2xl font-black text-[#0b1120]">
                  {pyqSubject} {pyqExam ? `— ${pyqExam}` : '— All PYQs'}
                </h2>
                <span className="px-3 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full border border-amber-200">
                  {pyqLevel}
                </span>
              </div>

              {pyqLoading ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 border-4 border-[#f59e0b] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-gray-500 font-bold text-sm">Loading PYQs...</p>
                </div>
              ) : pyqResources.length === 0 ? (
                <div className="text-center py-16 px-6 bg-gray-50 border-[3px] border-dashed border-gray-200 rounded-2xl">
                  <div className="text-4xl mb-3">📭</div>
                  <h3 className="text-lg font-black text-[#0b1120] mb-2">No PYQs Found</h3>
                  <p className="text-gray-500 font-medium text-sm">
                    No previous year questions available for {pyqSubject} {pyqExam ? `— ${pyqExam}` : ''} ({pyqLevel}) yet. Check back later!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pyqResources.map((res) => (
                    <a
                      key={res.id}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-4 p-5 bg-white border-[3px] border-[#0b1120] rounded-2xl hover:-translate-y-1 hover:-translate-x-1 shadow-[4px_4px_0px_#0b1120] hover:shadow-[8px_8px_0px_#0b1120] transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-amber-50">
                        <ClipboardList className="w-5 h-5 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-[#0b1120] mb-1 group-hover:text-[#10b981] transition-colors">{res.title}</h3>
                        {res.description && <p className="text-sm text-gray-500 font-medium">{res.description}</p>}
                        {!pyqExam && res.sub_type && (
                          <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-600 text-xs font-bold rounded-full border border-amber-200">{res.sub_type}</span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#10b981] transition-colors shrink-0 mt-1" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Placeholder when nothing selected */}
          {!pyqSubject && (
            <div className="text-center py-20 px-6">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-xl font-black text-[#0b1120] mb-2">Select a Subject</h3>
              <p className="text-gray-500 font-medium text-sm max-w-md mx-auto">
                Choose your level and subject above to browse previous year question papers.
              </p>
            </div>
          )}

          {pyqSubject && !pyqLoading && pyqResources.length > 0 && !pyqExam && availableExamTypes.length > 0 && (
            <div className="text-center pt-2 pb-4">
              <p className="text-gray-400 font-medium text-sm">
                Filter by exam type above, or browse all PYQs below.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
