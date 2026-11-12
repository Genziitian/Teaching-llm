'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Link } from '@/landing/shims/router';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import type { Variants } from 'motion/react';
import {
  X,
  Sparkles,
  Rocket,
  User,
  Phone,
  GraduationCap,
  Award,
  Link as LinkIcon,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Lock,
  Tablet,
  Check,
  Calendar,
  Briefcase,
  Laptop,
  Wallet,
  Gift,
  Users,
  Mail,
  AlertCircle,
  MessageSquare,
  Languages,
  Home
} from 'lucide-react';
import { useAuth } from '@/landing/context/AuthContext';
import { supabase } from '@/landing/lib/supabase';

/* =====================================================================
 * PRESENTATION LAYER (UI only — no form logic lives here)
 * Rendered as a full page via src/pages/CareerApply.tsx
 * ===================================================================== */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type RoleMeta = {
  badge: string;
  title: string;
  blurb: string;
  tags: string[];
  accent: string;
  accentText: string;
  perks: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }[];
};

type JourneyStep = {
  label: string;
  desc: string;
  state: 'current' | 'done' | 'upcoming';
  onClick?: () => void;
};

const ROLE_META: Record<'tutor' | 'campus-leader', RoleMeta> = {
  tutor: {
    badge: '',
    title: 'Subject Tutor',
    blurb: 'Teach the IITM BS courses you have aced, guide your peers, and earn while you learn.',
    tags: ['Part-time · Paid', 'Remote'],
    accent: '#10b981',
    accentText: '#34d399',
    perks: [
      { icon: Wallet, title: '₹5,000 – ₹10,000 / month', desc: 'Stipend based on interview & merit' },
      { icon: Briefcase, title: 'Teaching internship', desc: 'A highly valued line on your CV' },
      { icon: Laptop, title: 'Fully remote', desc: 'Flexible hours around your studies' }
    ]
  },
  'campus-leader': {
    badge: 'Campus ambassador',
    title: 'Campus Leader',
    blurb: 'Own or manage an IITM BS student community? Grow it alongside GenZ IITian.',
    tags: ['Part-time · Performance-based', 'Remote'],
    accent: '#3b82f6',
    accentText: '#60a5fa',
    perks: [
      { icon: Wallet, title: 'Up to ₹5,000 / month', desc: 'Performance-based stipend' },
      { icon: Gift, title: 'Your own referral code', desc: 'Your members get 5% off courses' },
      { icon: Award, title: 'Official recognition', desc: 'GenZ IITian Campus Leader title' }
    ]
  }
};

const formVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.2, ease: 'easeIn' } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } }
};

const fieldBase =
  'w-full rounded-2xl border-2 border-slate-200 bg-slate-50/70 text-base text-slate-900 placeholder:text-slate-400 placeholder:font-medium transition-all duration-200 hover:border-slate-300 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10';
const inputCls = `${fieldBase} peer h-14 pl-12 pr-4 font-semibold`;
const iconCls =
  'w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors peer-focus:text-blue-600';

function Field({
  label,
  hint,
  required,
  optional,
  side,
  htmlFor,
  children
}: {
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  side?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <label htmlFor={htmlFor} className="text-[15px] sm:text-base font-bold text-slate-900">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
          {optional && <span className="ml-2 text-sm font-semibold text-slate-400">Optional</span>}
        </label>
        {side}
      </div>
      {hint && <p className="text-sm text-slate-500 font-medium mb-2.5 leading-snug">{hint}</p>}
      {!hint && <div className="h-1.5" />}
      {children}
    </div>
  );
}

function Section({
  index,
  title,
  subtitle,
  children
}: {
  index: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={itemVariants}
      className="bg-white rounded-[28px] border-2 border-slate-200/80 shadow-[0_1px_0_rgba(15,23,42,0.03),0_18px_40px_-24px_rgba(15,23,42,0.18)] p-5 sm:p-8 lg:p-9"
    >
      <header className="flex items-start gap-4 mb-7">
        <span
          className="shrink-0 w-11 h-11 rounded-2xl bg-[#0b1120] text-white flex items-center justify-center font-black text-sm"
          style={{ boxShadow: '3px 3px 0 var(--accent)' }}
        >
          {String(index).padStart(2, '0')}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-xl sm:text-2xl font-black text-[#0b1120] tracking-tight leading-tight">{title}</h3>
          {subtitle && <p className="text-sm sm:text-[15px] text-slate-500 font-medium mt-1 leading-snug">{subtitle}</p>}
        </div>
      </header>
      <div className="space-y-7">{children}</div>
    </motion.section>
  );
}

function RadioDot({ active }: { active: boolean }) {
  return (
    <span
      className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${
        active ? 'border-transparent' : 'border-slate-300 bg-white'
      }`}
      style={active ? { background: 'var(--accent-text)' } : undefined}
    >
      <AnimatePresence initial={false}>
        {active && (
          <motion.span
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          >
            <Check className="w-3.5 h-3.5 text-[#0b1120] stroke-[3.5]" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function Choice({
  active,
  onClick,
  className = '',
  children
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileTap={{ scale: 0.97 }}
      className={`relative rounded-2xl border-2 text-left transition-[background-color,border-color,box-shadow,color] duration-200 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/20 ${
        active
          ? 'bg-[#0b1120] border-[#0b1120] text-white shadow-[4px_4px_0_var(--accent)]'
          : 'bg-slate-50/70 border-slate-200 text-slate-800 hover:bg-white hover:border-slate-300'
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}

interface CareerApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'tutor' | 'campus-leader';
}

const CONFETTI_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0b1120'];
const CONFETTI_PARTICLES = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  x: (i % 2 === 0 ? -1 : 1) * (25 + (i % 8) * 14 + (i % 3) * 8),
  y: -70 - (i % 5) * 22 - (i % 4) * 12,
  rotate: (i % 2 === 0 ? 1 : -1) * (140 + i * 20),
  size: 5 + (i % 4) * 2,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: (i % 8) * 0.035,
  isCircle: i % 3 === 0
}));

const COURSES_DATA = {
  foundation: [
    { id: 'maths-1', name: 'Mathematics for Data Science I', short: 'Maths 1' },
    { id: 'maths-2', name: 'Mathematics for Data Science II', short: 'Maths 2' },
    { id: 'stats-1', name: 'Statistics for Data Science I', short: 'Stats 1' },
    { id: 'stats-2', name: 'Statistics for Data Science II', short: 'Stats 2' },
    { id: 'ct', name: 'Computational Thinking', short: 'CT' },
    { id: 'python', name: 'Programming in Python', short: 'Python' },
    { id: 'eng-1', name: 'English I', short: 'English 1' },
    { id: 'eng-2', name: 'English II', short: 'English 2' }
  ],
  diploma: [
    { id: 'pdsa', name: 'PDSA (using Python)', short: 'PDSA' },
    { id: 'java', name: 'Programming Concepts using Java', short: 'Java' },
    { id: 'dbms', name: 'Database Management Systems', short: 'DBMS' },
    { id: 'mad-1', name: 'Modern Application Development 1 (MAD 1)', short: 'MAD 1' },
    { id: 'mad-2', name: 'Modern Application Development 2 (MAD 2)', short: 'MAD 2' },
    { id: 'mlf', name: 'Machine Learning Foundations (MLF)', short: 'MLF' },
    { id: 'mlt', name: 'Machine Learning Techniques (MLT)', short: 'MLT' },
    { id: 'mlp', name: 'Machine Learning Practice (MLP)', short: 'MLP' },
    { id: 'dl-genai', name: 'Deep Learning & Gen AI', short: 'DL & Gen AI' },
    { id: 'bdm', name: 'Business Data Management', short: 'BDM' },
    { id: 'ba', name: 'Business Analytics', short: 'BA' },
    { id: 'sys-cmds', name: 'System Commands', short: 'System Cmds' }
  ]
};

const MEMBER_RANGES = ['1-10', '11-50', '51-100', '100-500', '500+', '1000+'];
const STORAGE_KEY = 'gzi_applicant_personal_profile_v3';

export default function CareerApplicationModal({ isOpen, onClose, role }: CareerApplicationModalProps) {
  const { user, profile, openLoginModal } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Wizard Step for Tutor (1: Personal, 2: Teaching)
  const [step, setStep] = useState<1 | 2>(1);
  const [courseFilter, setCourseFilter] = useState<'all' | 'foundation' | 'diploma'>('all');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Tutor Form State
  const [tutorData, setTutorData] = useState({
    name: '',
    phone: '',
    age: '',
    gender: '',
    studentType: '', // Standalone, Dual Degree, Working Professional
    degreeLevel: '', // Foundation, Diploma, Degree
    selectedCourses: [] as string[],
    experienceAndWhy: '',
    hasTablet: '', // 'Yes' or 'No'
    language: 'Both (English + Hindi)',
    cgpa: '',
    resumeLink: ''
  });

  // Campus Leader Form State
  const [leaderData, setLeaderData] = useState({
    name: '',
    officialEmail: '',
    phone: '',
    isBSStudent: 'Yes',
    isGroupOwner: 'Yes',
    groupLink: '',
    groupMembers: '100-500',
    inquiries: ''
  });

  // Hydrate profile data & local storage memory (PERSONAL PROFILE ONLY)
  useEffect(() => {
    if (!isOpen) return;

    // Check auth
    if (!user) {
      openLoginModal();
      return;
    }

    // Try reading cached personal profile from localStorage
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      const saved = savedRaw ? JSON.parse(savedRaw) : {};

      setTutorData(prev => ({
        ...prev,
        // Only remember personal profile info
        name: saved.name || profile?.name || user.user_metadata?.full_name || '',
        phone: saved.phone || profile?.phone || user.user_metadata?.phone || '',
        age: saved.age || '',
        gender: saved.gender || '',
        studentType: saved.studentType || '',
        degreeLevel: saved.degreeLevel || '',
        // Teaching profile fields must be fresh and clean every time
        selectedCourses: [],
        experienceAndWhy: '',
        hasTablet: '',
        language: 'Both (English + Hindi)',
        cgpa: '',
        resumeLink: ''
      }));

      setLeaderData(prev => ({
        ...prev,
        name: saved.name || profile?.name || user.user_metadata?.full_name || '',
        phone: saved.phone || profile?.phone || user.user_metadata?.phone || '',
        officialEmail: saved.officialEmail || prev.officialEmail,
        isBSStudent: saved.isBSStudent || prev.isBSStudent,
        isGroupOwner: saved.isGroupOwner || prev.isGroupOwner,
        groupLink: '',
        groupMembers: '100-500',
        inquiries: ''
      }));
    } catch (e) {
      if (profile?.name || user.user_metadata?.full_name) {
        const defaultName = profile?.name || user.user_metadata?.full_name || '';
        setTutorData(prev => ({ ...prev, name: defaultName }));
        setLeaderData(prev => ({ ...prev, name: defaultName }));
      }
      if (profile?.phone || user.user_metadata?.phone) {
        const defaultPhone = profile?.phone || user.user_metadata?.phone || '';
        setTutorData(prev => ({ ...prev, phone: defaultPhone }));
        setLeaderData(prev => ({ ...prev, phone: defaultPhone }));
      }
    }
  }, [isOpen, user, profile]);

  // Persist ONLY personal profile to local storage (NEVER teaching profile)
  const savePersonalDraft = (updatedTutor?: Partial<typeof tutorData>, updatedLeader?: Partial<typeof leaderData>) => {
    try {
      const currentTutor = { ...tutorData, ...updatedTutor };
      const currentLeader = { ...leaderData, ...updatedLeader };
      const personalOnly = {
        name: currentTutor.name || currentLeader.name,
        phone: currentTutor.phone || currentLeader.phone,
        age: currentTutor.age,
        gender: currentTutor.gender,
        studentType: currentTutor.studentType,
        degreeLevel: currentTutor.degreeLevel,
        officialEmail: currentLeader.officialEmail,
        isBSStudent: currentLeader.isBSStudent,
        isGroupOwner: currentLeader.isGroupOwner
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(personalOnly));
    } catch (e) {}
  };

  const handleTutorChange = (name: keyof typeof tutorData, value: any) => {
    setTutorData(prev => {
      const next = { ...prev, [name]: value };
      // Only save personal fields to localStorage
      if (['name', 'phone', 'age', 'gender', 'studentType', 'degreeLevel'].includes(name)) {
        savePersonalDraft({ [name]: value });
      }
      return next;
    });
  };

  const toggleCourseSelection = (courseName: string) => {
    setTutorData(prev => {
      const exists = prev.selectedCourses.includes(courseName);
      const updated = exists 
        ? prev.selectedCourses.filter(c => c !== courseName)
        : [...prev.selectedCourses, courseName];
      return { ...prev, selectedCourses: updated };
    });
  };

  const handleLeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setLeaderData(prev => {
      const next = { ...prev, [name]: value };
      if (['name', 'phone', 'officialEmail', 'isBSStudent', 'isGroupOwner'].includes(name)) {
        savePersonalDraft(undefined, { [name]: value });
      }
      return next;
    });
  };

  // Step 1 Validation
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedName = tutorData.name.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    // Name can only be letters and spaces
    if (!/^[a-zA-Z\s.]+$/.test(trimmedName)) {
      setErrorMessage('Full name can only contain letters.');
      return;
    }

    // Phone must be 10 digits starting with 6-9
    const cleanPhone = tutorData.phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setErrorMessage('Phone number must be a valid 10-digit number starting with 6-9.');
      return;
    }

    // Age must be 15 to 100
    const ageNum = parseInt(tutorData.age.trim(), 10);
    if (isNaN(ageNum) || ageNum < 15 || ageNum > 100) {
      setErrorMessage('Age must be between 15 and 100.');
      return;
    }

    if (!tutorData.gender) {
      setErrorMessage('Please select your gender.');
      return;
    }
    if (!tutorData.studentType) {
      setErrorMessage('Please select your student status.');
      return;
    }
    if (!tutorData.degreeLevel) {
      setErrorMessage('Please select your degree level.');
      return;
    }

    setStep(2);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Final Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    const isTutor = role === 'tutor';

    if (isTutor) {
      if (!tutorData.selectedCourses || tutorData.selectedCourses.length === 0) {
        setErrorMessage('Please select which courses you can teach.');
        setSubmitting(false);
        return;
      }
      if (!tutorData.experienceAndWhy.trim()) {
        setErrorMessage('Please describe your teaching experience and why GenZ IITian.');
        setSubmitting(false);
        return;
      }
      if (!tutorData.hasTablet) {
        setErrorMessage('Please select whether you have a tablet or a tablet with stylus to write.');
        setSubmitting(false);
        return;
      }
      if (!tutorData.cgpa.trim()) {
        setErrorMessage('Please provide your CGPA or grade in the target subject(s).');
        setSubmitting(false);
        return;
      }
      if (!tutorData.resumeLink.trim()) {
        setErrorMessage('Please provide a link to your Resume / CV.');
        setSubmitting(false);
        return;
      }
    } else {
      const trimmedLeaderName = leaderData.name.trim();
      if (!trimmedLeaderName || !/^[a-zA-Z\s.]+$/.test(trimmedLeaderName)) {
        setErrorMessage('Full name can only contain letters.');
        setSubmitting(false);
        return;
      }
      const cleanLeaderPhone = leaderData.phone.replace(/\D/g, '').slice(-10);
      if (!/^[6-9]\d{9}$/.test(cleanLeaderPhone)) {
        setErrorMessage('Phone number must be a valid 10-digit number starting with 6-9.');
        setSubmitting(false);
        return;
      }
    }

    const payload = isTutor
      ? {
          role: 'tutor',
          role_title: 'Subject Tutor (Faculty)',
          full_name: tutorData.name.trim(),
          name: tutorData.name.trim(),
          email: (user?.email || '').trim().toLowerCase(),
          phone: tutorData.phone.trim(),
          age: tutorData.age.trim(),
          gender: tutorData.gender,
          student_type: tutorData.studentType,
          degree_level: tutorData.degreeLevel,
          courses: tutorData.selectedCourses,
          subject: tutorData.selectedCourses.join(', '),
          has_tablet: tutorData.hasTablet,
          experience_and_why: tutorData.experienceAndWhy.trim(),
          language: tutorData.language,
          cgpa: tutorData.cgpa.trim(),
          resume_link: tutorData.resumeLink.trim(),
          resumeLink: tutorData.resumeLink.trim(),
          is_iitm: 'Yes',
          isIITM: 'Yes',
          level: tutorData.degreeLevel,
          metadata: { ...tutorData, auth_email: user?.email }
        }
      : {
          role: 'campus-leader',
          role_title: 'Campus Leaders',
          full_name: leaderData.name.trim(),
          name: leaderData.name.trim(),
          email: (user?.email || '').trim().toLowerCase(),
          official_email: leaderData.officialEmail.trim(),
          phone: leaderData.phone.trim(),
          is_bs_student: leaderData.isBSStudent,
          isIITM: leaderData.isBSStudent,
          is_group_owner: leaderData.isGroupOwner,
          group_link: leaderData.groupLink.trim(),
          group_members: leaderData.groupMembers,
          inquiries: leaderData.inquiries.trim(),
          level: 'Campus Leader',
          subject: `Campus Leader (${leaderData.groupMembers} members)`,
          metadata: { ...leaderData, auth_email: user?.email }
        };

    try {
      // 1. Submit to platform API
      let apiSaved = false;
      try {
        const res = await fetch('/api/job-applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          apiSaved = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('[Careers] API error response:', errData);
        }
      } catch (err) {
        console.warn('[Careers] API network error:', err);
      }

      // 2. Direct Supabase insert fallback if API didn't succeed (e.g. static hosting)
      if (!apiSaved && supabase) {
        try {
          const appId = `app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          await supabase.from('job_applications').insert([{
            id: appId,
            role: payload.role,
            role_title: payload.role_title,
            full_name: payload.full_name,
            email: payload.email,
            phone: payload.phone,
            age: (payload as any).age || null,
            gender: (payload as any).gender || null,
            student_type: (payload as any).student_type || null,
            degree_level: (payload as any).degree_level || null,
            courses: (payload as any).courses || [],
            has_tablet: (payload as any).has_tablet || null,
            experience_and_why: (payload as any).experience_and_why || null,
            is_iitm: (payload as any).is_iitm || 'Yes',
            level: (payload as any).level || (payload as any).degree_level || null,
            subject: (payload as any).subject || null,
            language: (payload as any).language || null,
            cgpa: (payload as any).cgpa || null,
            resume_link: (payload as any).resume_link || null,
            official_email: (payload as any).official_email || null,
            is_bs_student: (payload as any).is_bs_student || null,
            is_group_owner: (payload as any).is_group_owner || null,
            group_link: (payload as any).group_link || null,
            group_members: (payload as any).group_members || null,
            inquiries: (payload as any).inquiries || null,
            metadata: payload.metadata || {},
            status: 'PENDING',
            manager_notes: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
        } catch (subErr) {
          console.warn('[Careers] Direct Supabase fallback warning:', subErr);
        }
      }

      // 3. Google Apps Script Webhook trigger (syncs to Google Sheet for both roles)
      const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_STOREFRONT_CAREERS_SCRIPT_URL;
      if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(err => console.warn('[Careers] Google script notice:', err));
      }

      // 4. Fallback cache in localStorage for safety
      try {
        const cached = localStorage.getItem('gzi_job_applications');
        const list = cached ? JSON.parse(cached) : [];
        list.unshift({
          ...payload,
          id: `local-${Date.now()}`,
          created_at: new Date().toISOString(),
          status: 'PENDING'
        });
        localStorage.setItem('gzi_job_applications', JSON.stringify(list));
      } catch (e) {}

      setSubmitted(true);
    } catch (err: any) {
      console.error('Job application submission error:', err);
      setErrorMessage(err.message || 'Something went wrong submitting your application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setErrorMessage('');
    setStep(1);
    onClose();
  };

  // ---------- UI-only helpers (no change to form logic) ----------
  const reduceMotion = useReducedMotion();

  // Full-page layout: bring the new step / success screen into view
  useEffect(() => {
    if (!isOpen) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, submitted]);

  if (!isOpen) return null;

  // Filter courses for tutor view
  const visibleCourses = courseFilter === 'all'
    ? [...COURSES_DATA.foundation, ...COURSES_DATA.diploma]
    : courseFilter === 'foundation'
      ? COURSES_DATA.foundation
      : COURSES_DATA.diploma;

  const isTutor = role === 'tutor';
  const meta = ROLE_META[role];
  const allCourses = [...COURSES_DATA.foundation, ...COURSES_DATA.diploma];
  const shortName = (name: string) => allCourses.find(c => c.name === name)?.short || name;

  // Routes button-style choices through the existing leader change handler
  const setLeaderField = (name: keyof typeof leaderData, value: string) =>
    handleLeaderChange({ target: { name, value } } as React.ChangeEvent<HTMLInputElement>);

  const journey: JourneyStep[] = isTutor
    ? [
        {
          label: 'Personal profile',
          desc: 'About you & your degree progress',
          state: step === 1 ? 'current' : 'done',
          onClick: () => setStep(1)
        },
        {
          label: 'Teaching setup',
          desc: 'Courses, experience & hardware',
          state: step === 2 ? 'current' : 'upcoming',
          onClick: () => {
            if (tutorData.name && tutorData.phone && tutorData.age) {
              setStep(2);
            }
          }
        },
        { label: 'We get in touch', desc: 'On WhatsApp & email', state: 'upcoming' }
      ]
    : [
        { label: 'Share your details', desc: 'About you & your community', state: 'current' },
        { label: 'We review', desc: 'Our team checks your community', state: 'upcoming' },
        { label: 'We get in touch', desc: 'On WhatsApp & email', state: 'upcoming' }
      ];

  const heading = isTutor
    ? step === 1
      ? { title: 'Tell us about yourself', sub: '' }
      : { title: 'Your teaching setup', sub: 'Pick the courses you can teach and tell us a little about how you teach.' }
    : { title: 'Tell us about your community', sub: 'A few details about you and the student group you run. Please answer as accurately as you can.' };

  const errorBanner = (
    <AnimatePresence initial={false}>
      {errorMessage && (
        <motion.div
          key={errorMessage}
          role="alert"
          initial={{ opacity: 0, y: 8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: 8, height: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="mb-3 flex items-start gap-3 rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3.5 text-[15px] font-bold text-rose-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const actionBarCls =
    'sticky bottom-0 z-20 -mx-4 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#f5f6fa] from-70% to-transparent sm:static sm:mx-0 sm:px-0 sm:pt-2 sm:pb-0 sm:bg-none';

  const primaryBtnCls =
    'group w-full sm:w-auto sm:min-w-[280px] h-14 px-7 rounded-2xl bg-[#0b1120] text-white font-black text-base border-2 border-[#0b1120] shadow-[5px_5px_0_var(--accent)] hover:shadow-[7px_7px_0_var(--accent)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[3px_3px_0_var(--accent)] transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2.5';

  const lockedEmail = (id: string) => (
    <Field
      label="Email address"
      htmlFor={id}
      hint="Linked to your GenZ IITian login, so it can't be changed here."
      required
      side={
        <span className="text-xs font-black text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 shrink-0">
          <Lock className="w-3 h-3" /> Account email
        </span>
      }
    >
      <div className="relative">
        <input
          id={id}
          readOnly
          disabled
          type="email"
          value={user?.email || ''}
          title="Email is fixed to your logged-in GenZ IITian account"
          className={`${inputCls} disabled:bg-slate-100 disabled:border-slate-200 disabled:hover:border-slate-200 text-slate-500 cursor-not-allowed select-none`}
        />
        <Lock className={iconCls} />
      </div>
    </Field>
  );

  return (
    <div
      className="relative isolate min-h-[calc(100dvh-5rem)] bg-[#f5f6fa] overflow-x-clip"
      style={{ ['--accent' as string]: meta.accent, ['--accent-text' as string]: meta.accentText } as React.CSSProperties}
    >
      {/* ---------- Decorative backdrop ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(#cfd6e4 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 75%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 75%)'
          }}
        />
        <motion.div
          className="absolute -top-40 -right-32 w-[520px] h-[520px] rounded-full blur-3xl opacity-[0.18]"
          style={{ background: meta.accent }}
          animate={reduceMotion ? undefined : { x: [0, -40, 0], y: [0, 40, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-[45%] -left-48 w-[460px] h-[460px] rounded-full blur-3xl opacity-[0.14] bg-indigo-500"
          animate={reduceMotion ? undefined : { x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 lg:pt-10 pb-6 sm:pb-16 lg:pb-24">
        {/* Back link */}
        <motion.button
          type="button"
          onClick={handleClose}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="group inline-flex items-center gap-2.5 text-sm sm:text-[15px] font-bold text-slate-600 hover:text-[#0b1120] transition-colors cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-white border-2 border-slate-200 group-hover:border-[#0b1120] flex items-center justify-center transition-colors">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          </span>
          Back to Careers
        </motion.button>

        {submitted ? (
          /* =================================================== */
          /* SUCCESS                                             */
          /* =================================================== */
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mt-6 sm:mt-10 max-w-3xl mx-auto"
          >
            <div
              className="relative overflow-hidden bg-white rounded-[32px] border-[3px] border-[#0b1120] px-5 py-12 sm:px-12 sm:py-16 text-center"
              style={{ boxShadow: `10px 10px 0 ${meta.accent}` }}
            >
              <div aria-hidden className="absolute inset-0 opacity-50 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

              {/* Confetti burst from the rocket */}
              <div className="absolute inset-x-0 top-[6.5rem] sm:top-[7.5rem] h-0 flex justify-center pointer-events-none">
                {CONFETTI_PARTICLES.map(p => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 0, rotate: 0 }}
                    animate={{ opacity: [1, 1, 0], x: p.x * 1.9, y: p.y * 1.5, scale: [0, 1.4, 0.8], rotate: p.rotate }}
                    transition={{ duration: 1.6, delay: 0.1 + p.delay, ease: [0.15, 0.8, 0.25, 1] }}
                    style={{
                      position: 'absolute',
                      width: `${p.size + 2}px`,
                      height: `${p.size + 2}px`,
                      backgroundColor: p.color,
                      borderRadius: p.isCircle ? '50%' : '3px'
                    }}
                  />
                ))}
              </div>

              <div className="relative">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
                  className="w-24 h-24 sm:w-28 sm:h-28 mx-auto bg-emerald-100 border-[3px] border-[#0b1120] rounded-3xl shadow-[6px_6px_0_#0b1120] flex items-center justify-center"
                >
                  <motion.span
                    animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Rocket className="w-12 h-12 sm:w-14 sm:h-14 text-emerald-700" />
                  </motion.span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="mt-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 border-2 border-amber-300 text-amber-900 text-xs sm:text-sm font-black uppercase tracking-[0.12em]"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Application received
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.45, ease: EASE }}
                  className="mt-5 text-3xl sm:text-5xl font-black text-[#0b1120] tracking-tight leading-[1.08] max-w-2xl mx-auto"
                >
                  Welcome to One Step Ahead of 99% of People 🚀
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.45, ease: EASE }}
                  className="mt-5 text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-xl mx-auto"
                >
                  We'll review your application and get back to you shortly on WhatsApp &amp; email.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  className="mt-9 bg-[#0b1120] text-white px-6 py-5 rounded-2xl border-[3px] border-[#0b1120] shadow-[6px_6px_0_#10b981] max-w-md mx-auto"
                >
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-400 mb-1.5">Our motto</p>
                  <p className="text-xl sm:text-2xl font-black tracking-tight">“Work with Best, and be best.”</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.75 }}
                  className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
                >
                  <button type="button" onClick={handleClose} className={primaryBtnCls}>
                    <span>Done, back to Careers</span>
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </button>
                  <Link
                    to="/"
                    className="w-full sm:w-auto h-14 px-6 rounded-2xl bg-white border-2 border-slate-200 hover:border-[#0b1120] text-[#0b1120] font-black text-base inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <Home className="w-5 h-5" /> Go to homepage
                  </Link>
                </motion.div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* =================================================== */
          /* APPLICATION                                         */
          /* =================================================== */
          <div className="mt-5 sm:mt-7 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] gap-6 sm:gap-8 lg:gap-10 xl:gap-14 items-start">
            {/* ---------- Role panel ---------- */}
            <motion.aside
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EASE }}
              className="lg:sticky lg:top-[6.5rem]"
            >
              <div
                className="relative overflow-hidden rounded-[28px] bg-[#0b1120] text-white border-[3px] border-[#0b1120] p-6 sm:p-8"
                style={{ boxShadow: `8px 8px 0 ${meta.accent}` }}
              >
                <div aria-hidden className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: meta.accent }} />
                <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '18px 18px' }} />

                <div className="relative">
                  {meta.badge && (
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-[0.14em] text-[#0b1120]"
                      style={{ background: meta.accentText }}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> {meta.badge}
                    </span>
                  )}

                  <h1 className={`${meta.badge ? 'mt-5' : 'mt-1'} text-[2rem] sm:text-4xl xl:text-[2.75rem] font-black tracking-tight leading-[1.05]`}>
                    Apply as
                    <br />
                    <span style={{ color: meta.accentText }}>{meta.title}</span>
                  </h1>
                  <p className="mt-4 text-[15px] sm:text-base text-slate-300 font-medium leading-relaxed max-w-md">
                    {meta.blurb}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {meta.tags.map(tag => (
                      <span key={tag} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs sm:text-sm font-bold text-slate-100">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Journey (desktop) */}
                  <div className="hidden lg:block mt-8 pt-7 border-t border-white/10">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 mb-3">Your progress</p>
                    <ol className="space-y-1">
                      {journey.map((s, i) => {
                        const clickable = !!s.onClick;
                        return (
                          <li key={s.label} className="relative">
                            {i < journey.length - 1 && (
                              <span className="absolute left-[18px] top-[50px] -bottom-[6px] w-0.5 bg-white/10 overflow-hidden rounded-full">
                                <motion.span
                                  className="absolute inset-0 origin-top rounded-full"
                                  style={{ background: meta.accentText }}
                                  initial={false}
                                  animate={{ scaleY: s.state === 'done' ? 1 : 0 }}
                                  transition={{ duration: 0.5, ease: EASE }}
                                />
                              </span>
                            )}
                            <button
                              type="button"
                              disabled={!clickable}
                              onClick={s.onClick}
                              className="w-full flex items-start gap-3.5 text-left rounded-2xl p-2.5 -mx-2.5 transition-colors enabled:hover:bg-white/5 enabled:cursor-pointer disabled:cursor-default"
                            >
                              <span className="relative shrink-0 w-9 h-9">
                                {s.state === 'current' && !reduceMotion && (
                                  <motion.span
                                    className="absolute inset-0 rounded-full"
                                    style={{ background: meta.accentText }}
                                    animate={{ scale: [1, 1.5], opacity: [0.35, 0] }}
                                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                                  />
                                )}
                                <span
                                  className={`relative w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all duration-300 ${
                                    s.state === 'current'
                                      ? 'bg-white text-[#0b1120] border-white'
                                      : s.state === 'done'
                                        ? 'text-[#0b1120] border-transparent'
                                        : 'bg-transparent text-slate-400 border-white/20'
                                  }`}
                                  style={s.state === 'done' ? { background: meta.accentText } : undefined}
                                >
                                  {s.state === 'done' ? <Check className="w-4 h-4 stroke-[3.5]" /> : i + 1}
                                </span>
                              </span>
                              <span className="pt-0.5 min-w-0">
                                <span className={`block text-[15px] font-bold ${s.state === 'upcoming' ? 'text-slate-400' : 'text-white'}`}>
                                  {s.label}
                                </span>
                                <span className="block text-sm text-slate-400 font-medium">{s.desc}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  {/* Perks */}
                  <div className="mt-7 pt-6 lg:pt-7 border-t border-white/10">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 mb-3">What you get</p>
                    <ul className="flex lg:flex-col gap-3 overflow-x-auto hide-scrollbar snap-x snap-mandatory -mx-6 px-6 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 lg:overflow-visible">
                      {meta.perks.map((perk, i) => {
                        const Icon = perk.icon;
                        return (
                          <motion.li
                            key={perk.title}
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.25 + i * 0.08, duration: 0.45, ease: EASE }}
                            className="snap-start shrink-0 w-[250px] lg:w-auto flex items-start gap-3 rounded-2xl bg-white/[0.06] border border-white/10 p-3.5"
                          >
                            <span
                              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: `${meta.accent}26`, color: meta.accentText }}
                            >
                              <Icon className="w-5 h-5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm sm:text-[15px] font-black text-white leading-tight">{perk.title}</span>
                              <span className="block mt-0.5 text-[13px] sm:text-sm text-slate-400 font-medium leading-snug">{perk.desc}</span>
                            </span>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.aside>

            {/* ---------- Form column ---------- */}
            <div ref={scrollContainerRef} className="min-w-0">
              {/* Heading */}
              <motion.div
                key={`heading-${step}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="mb-7 sm:mb-9"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-[0.16em] text-slate-500 shrink-0">
                    {isTutor ? `Step ${step} of 2` : 'Application form'}
                  </span>
                  {isTutor && (
                    <div className="flex-1 max-w-[260px] h-2 rounded-full bg-slate-200 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: meta.accent }}
                        initial={{ width: step === 1 ? '0%' : '50%' }}
                        animate={{ width: step === 1 ? '50%' : '100%' }}
                        transition={{ duration: 0.7, ease: EASE }}
                      />
                    </div>
                  )}
                </div>
                <h2 className="text-[2rem] sm:text-5xl lg:text-[3.25rem] font-black tracking-tight text-[#0b1120] leading-[1.04]">
                  {heading.title}
                </h2>
                {heading.sub && (
                  <p className="mt-3 sm:mt-4 text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-2xl">
                    {heading.sub}
                  </p>
                )}
              </motion.div>

              <AnimatePresence mode="wait">
                {/* ========================================================= */}
                {/* ROLE A — STEP 1: Personal & academic profile               */}
                {/* ========================================================= */}
                {isTutor && step === 1 && (
                  <motion.form
                    key="tutor-step-1"
                    onSubmit={handleProceedToStep2}
                    variants={formVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="space-y-5 sm:space-y-6"
                  >
                    <Section index={1} title="Basic details" subtitle="How we identify you and reach you.">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-7">
                        <Field label="Full name" htmlFor="tutor-name" required>
                          <div className="relative">
                            <input
                              id="tutor-name"
                              required
                              type="text"
                              autoComplete="name"
                              value={tutorData.name}
                              onChange={e => handleTutorChange('name', e.target.value)}
                              placeholder="e.g. Aryan Sharma"
                              className={inputCls}
                            />
                            <User className={iconCls} />
                          </div>
                        </Field>

                        <Field label="Phone / WhatsApp" htmlFor="tutor-phone" required>
                          <div className="relative">
                            <input
                              id="tutor-phone"
                              required
                              type="tel"
                              autoComplete="tel"
                              value={tutorData.phone}
                              onChange={e => handleTutorChange('phone', e.target.value)}
                              placeholder="+91 98765 43210"
                              className={inputCls}
                            />
                            <Phone className={iconCls} />
                          </div>
                        </Field>

                        <div className="md:col-span-2">{lockedEmail('tutor-email')}</div>

                        <Field label="Age" htmlFor="tutor-age" required>
                          <div className="relative">
                            <input
                              id="tutor-age"
                              required
                              type="number"
                              inputMode="numeric"
                              min={16}
                              max={80}
                              value={tutorData.age}
                              onChange={e => handleTutorChange('age', e.target.value)}
                              placeholder="e.g. 21"
                              className={inputCls}
                            />
                            <Calendar className={iconCls} />
                          </div>
                        </Field>
                      </div>
                    </Section>

                    <Section index={2} title="About you" subtitle="Helps us plan sessions around your schedule.">
                      <Field label="Gender" required>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {['Male', 'Female', 'Other', 'Prefer not to say'].map(gen => {
                            const active = tutorData.gender === gen;
                            return (
                              <Choice
                                key={gen}
                                active={active}
                                onClick={() => handleTutorChange('gender', gen)}
                                className="min-h-14 px-3 py-2 flex items-center justify-center gap-2 text-center text-[15px] font-bold"
                              >
                                {active && <Check className="w-4 h-4 shrink-0" style={{ color: meta.accentText }} />}
                                <span>{gen}</span>
                              </Choice>
                            );
                          })}
                        </div>
                      </Field>

                      <Field label="What best describes you right now?" required>
                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-3">
                          {[
                            { id: 'Standalone', label: 'Standalone BS', desc: 'Pursuing only the IITM BS degree' },
                            { id: 'Dual Degree', label: 'Dual degree', desc: 'Regular college + IITM BS' },
                            { id: 'Working Professional', label: 'Working professional', desc: 'Full/part-time job + IITM BS' }
                          ].map(item => {
                            const active = tutorData.studentType === item.id;
                            return (
                              <Choice
                                key={item.id}
                                active={active}
                                onClick={() => handleTutorChange('studentType', item.id)}
                                className="p-4 sm:p-5 flex flex-col gap-1.5"
                              >
                                <span className="flex items-center justify-between gap-3">
                                  <span className="text-base font-black">{item.label}</span>
                                  <RadioDot active={active} />
                                </span>
                                <span className={`text-sm font-medium leading-snug ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                                  {item.desc}
                                </span>
                              </Choice>
                            );
                          })}
                        </div>
                      </Field>
                    </Section>

                    <Section index={3} title="Degree progress" subtitle="Which level of the IITM BS programme are you currently in?">
                      <Field label="Your current level" required>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {['Foundation', 'Diploma', 'Degree'].map(lvl => {
                            const active = tutorData.degreeLevel === lvl;
                            return (
                              <Choice
                                key={lvl}
                                active={active}
                                onClick={() => handleTutorChange('degreeLevel', lvl)}
                                className="h-16 px-5 flex items-center justify-between sm:justify-center gap-3 text-base font-black"
                              >
                                <span className="flex items-center gap-2.5">
                                  <GraduationCap className="w-5 h-5 shrink-0" style={active ? { color: meta.accentText } : undefined} />
                                  {lvl}
                                </span>
                                <span className="sm:hidden"><RadioDot active={active} /></span>
                              </Choice>
                            );
                          })}
                        </div>
                      </Field>
                    </Section>

                    <motion.div variants={itemVariants} className={actionBarCls}>
                      {errorBanner}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="hidden sm:block text-sm font-medium text-slate-500">
                          Your personal details are saved on this device as you type.
                        </p>
                        <button type="submit" className={primaryBtnCls}>
                          <span>Continue to teaching setup</span>
                          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </button>
                      </div>
                    </motion.div>
                  </motion.form>
                )}

                {/* ========================================================= */}
                {/* ROLE A — STEP 2: Teaching & practical setup                */}
                {/* ========================================================= */}
                {isTutor && step === 2 && (
                  <motion.form
                    key="tutor-step-2"
                    onSubmit={handleSubmit}
                    variants={formVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="space-y-5 sm:space-y-6"
                  >
                    <Section index={1} title="Courses you can teach" subtitle="Choose every course you're confident teaching.">
                      <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="inline-flex w-fit p-1.5 rounded-2xl bg-slate-100 border border-slate-200">
                          {([
                            { id: 'all', label: 'All', count: COURSES_DATA.foundation.length + COURSES_DATA.diploma.length },
                            { id: 'foundation', label: 'Foundation', count: COURSES_DATA.foundation.length },
                            { id: 'diploma', label: 'Diploma', count: COURSES_DATA.diploma.length }
                          ] as const).map(tab => {
                            const active = courseFilter === tab.id;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setCourseFilter(tab.id)}
                                className="relative h-10 px-3.5 sm:px-5 rounded-xl text-sm font-black cursor-pointer"
                              >
                                {active && (
                                  <motion.span
                                    layoutId="course-filter-pill"
                                    className="absolute inset-0 rounded-xl bg-white border border-slate-200 shadow-sm"
                                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                  />
                                )}
                                <span className={`relative transition-colors ${active ? 'text-[#0b1120]' : 'text-slate-500 hover:text-slate-800'}`}>
                                  {tab.label} <span className="text-slate-400 font-bold">{tab.count}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <span className="inline-flex w-fit items-center gap-2 h-9 px-3.5 rounded-full bg-emerald-50 border border-emerald-200 text-sm font-black text-emerald-800">
                          <motion.span
                            key={tutorData.selectedCourses.length}
                            initial={{ y: -8, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="tabular-nums"
                          >
                            {tutorData.selectedCourses.length}
                          </motion.span>
                          selected
                        </span>
                      </div>

                      <AnimatePresence initial={false}>
                        {tutorData.selectedCourses.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: EASE }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-wrap gap-2 pt-4">
                              <AnimatePresence initial={false}>
                                {tutorData.selectedCourses.map(name => (
                                  <motion.button
                                    layout
                                    key={name}
                                    type="button"
                                    onClick={() => toggleCourseSelection(name)}
                                    initial={{ scale: 0.6, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.6, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    className="inline-flex items-center gap-1.5 h-9 pl-3.5 pr-2.5 rounded-full bg-[#0b1120] text-white text-sm font-bold cursor-pointer hover:bg-slate-800"
                                    title={`Remove ${name}`}
                                  >
                                    {shortName(name)}
                                    <X className="w-3.5 h-3.5 text-slate-400" />
                                  </motion.button>
                                ))}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                        <AnimatePresence mode="popLayout" initial={false}>
                          {visibleCourses.map(course => {
                            const isSelected = tutorData.selectedCourses.includes(course.name);
                            return (
                              <motion.button
                                layout
                                key={course.id}
                                type="button"
                                onClick={() => toggleCourseSelection(course.name)}
                                aria-pressed={isSelected}
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ duration: 0.2 }}
                                whileTap={{ scale: 0.98 }}
                                className={`flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/20 ${
                                  isSelected
                                    ? 'bg-[#0b1120] border-[#0b1120] text-white shadow-[4px_4px_0_var(--accent)]'
                                    : 'bg-slate-50/70 border-slate-200 text-slate-800 hover:bg-white hover:border-slate-300'
                                }`}
                              >
                                <span
                                  className={`shrink-0 min-w-[68px] h-9 px-2.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center justify-center transition-colors ${
                                    isSelected ? 'text-[#0b1120]' : 'bg-white border border-slate-200 text-slate-700'
                                  }`}
                                  style={isSelected ? { background: meta.accentText } : undefined}
                                >
                                  {course.short}
                                </span>
                                <span className="flex-1 min-w-0 text-sm sm:text-[15px] font-bold leading-snug">{course.name}</span>
                                <span
                                  className={`shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                    isSelected ? 'border-transparent' : 'border-slate-300 bg-white'
                                  }`}
                                  style={isSelected ? { background: meta.accentText } : undefined}
                                >
                                  {isSelected && (
                                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                                      <Check className="w-4 h-4 text-[#0b1120] stroke-[3.5]" />
                                    </motion.span>
                                  )}
                                </span>
                              </motion.button>
                            );
                          })}
                        </AnimatePresence>
                      </motion.div>
                      </div>
                    </Section>

                    <Section index={2} title="Experience & motivation" subtitle="There are no wrong answers. Tell us in your own words.">
                      <Field
                        label="Any teaching experience? And why GenZ IITian?"
                        htmlFor="tutor-experience"
                        required
                      >
                        <div className="relative">
                          <textarea
                            id="tutor-experience"
                            required
                            rows={6}
                            value={tutorData.experienceAndWhy}
                            onChange={e => handleTutorChange('experienceAndWhy', e.target.value)}
                            placeholder="e.g. I've been helping juniors with Maths 1 doubts on our WhatsApp group for a year…"
                            className={`${fieldBase} min-h-[170px] px-4 py-4 pb-9 font-medium leading-relaxed resize-y`}
                          />
                          <span className="absolute right-4 bottom-3 text-xs font-bold text-slate-400 tabular-nums pointer-events-none">
                            {tutorData.experienceAndWhy.length} characters
                          </span>
                        </div>
                      </Field>
                    </Section>

                    <Section index={3} title="Setup & academics">
                      <Field label="Do you have a tablet, or a pen tablet with stylus?" hint="We teach by writing on screen, so this matters." required>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { ans: 'Yes', title: 'Yes, I have one', desc: 'Tablet / pen tablet with stylus' },
                            { ans: 'No', title: "No, I don't", desc: "I don't have one right now" }
                          ].map(opt => {
                            const active = tutorData.hasTablet === opt.ans;
                            return (
                              <Choice
                                key={opt.ans}
                                active={active}
                                onClick={() => handleTutorChange('hasTablet', opt.ans)}
                                className="p-4 flex items-center gap-3.5"
                              >
                                <span
                                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                    active ? 'bg-white/10' : 'bg-white border border-slate-200'
                                  }`}
                                >
                                  <Tablet className="w-5 h-5" style={active ? { color: meta.accentText } : undefined} />
                                </span>
                                <span className="flex-1 min-w-0">
                                  <span className="block text-base font-black">{opt.title}</span>
                                  <span className={`block text-sm font-medium ${active ? 'text-slate-300' : 'text-slate-500'}`}>{opt.desc}</span>
                                </span>
                                <RadioDot active={active} />
                              </Choice>
                            );
                          })}
                        </div>
                      </Field>

                      <Field label="Teaching language" required>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { value: 'Both (English + Hindi)', label: 'Both', desc: 'English + Hindi' },
                            { value: 'English', label: 'English', desc: 'Only' },
                            { value: 'Hindi', label: 'Hindi', desc: 'Only' }
                          ].map(opt => {
                            const active = tutorData.language === opt.value;
                            return (
                              <Choice
                                key={opt.value}
                                active={active}
                                onClick={() => handleTutorChange('language', opt.value)}
                                className="min-h-[68px] px-3 py-2.5 flex flex-col items-center justify-center text-center"
                              >
                                <span className="flex items-center gap-1.5 text-[15px] font-black">
                                  <Languages className="w-4 h-4 hidden sm:block" style={active ? { color: meta.accentText } : undefined} />
                                  {opt.label}
                                </span>
                                <span className={`text-xs font-semibold ${active ? 'text-slate-300' : 'text-slate-500'}`}>{opt.desc}</span>
                              </Choice>
                            );
                          })}
                        </div>
                      </Field>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-7">
                        <Field label="CGPA / grade in the subject" htmlFor="tutor-cgpa" hint="For the subject(s) you want to teach." required>
                          <div className="relative">
                            <input
                              id="tutor-cgpa"
                              required
                              type="text"
                              value={tutorData.cgpa}
                              onChange={e => handleTutorChange('cgpa', e.target.value)}
                              placeholder="e.g. 8.5 or S grade"
                              className={inputCls}
                            />
                            <Award className={iconCls} />
                          </div>
                        </Field>

                        <Field label="Resume / CV link" htmlFor="tutor-resume" hint="Set sharing to “Anyone with the link can view”." required>
                          <div className="relative">
                            <input
                              id="tutor-resume"
                              required
                              type="url"
                              value={tutorData.resumeLink}
                              onChange={e => handleTutorChange('resumeLink', e.target.value)}
                              placeholder="https://drive.google.com/…"
                              className={inputCls}
                            />
                            <LinkIcon className={iconCls} />
                          </div>
                        </Field>
                      </div>
                    </Section>

                    <motion.div variants={itemVariants} className={actionBarCls}>
                      {errorBanner}
                      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="group w-full sm:w-auto h-14 px-6 rounded-2xl bg-white border-2 border-slate-200 hover:border-[#0b1120] text-[#0b1120] font-black text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                          <span>Back</span>
                        </button>

                        <button type="submit" disabled={submitting} className={primaryBtnCls}>
                          {submitting ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Submitting application…</span>
                            </>
                          ) : (
                            <>
                              <span>Submit tutor application</span>
                              <Rocket className="w-5 h-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  </motion.form>
                )}

                {/* ========================================================= */}
                {/* ROLE B: CAMPUS LEADER APPLICATION                          */}
                {/* ========================================================= */}
                {role === 'campus-leader' && (
                  <motion.form
                    key="campus-leader"
                    onSubmit={handleSubmit}
                    variants={formVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="space-y-5 sm:space-y-6"
                  >
                    <Section index={1} title="Your details" subtitle="How we identify you and reach you.">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-7">
                        <Field label="Full name" htmlFor="leader-name" required>
                          <div className="relative">
                            <input
                              id="leader-name"
                              required
                              type="text"
                              name="name"
                              autoComplete="name"
                              value={leaderData.name}
                              onChange={handleLeaderChange}
                              placeholder="e.g. Priyanshu Roy"
                              className={inputCls}
                            />
                            <User className={iconCls} />
                          </div>
                        </Field>

                        <Field label="Phone / WhatsApp" htmlFor="leader-phone" required>
                          <div className="relative">
                            <input
                              id="leader-phone"
                              required
                              type="tel"
                              name="phone"
                              autoComplete="tel"
                              value={leaderData.phone}
                              onChange={handleLeaderChange}
                              placeholder="+91 98765 43210"
                              className={inputCls}
                            />
                            <Phone className={iconCls} />
                          </div>
                        </Field>

                        <div className="md:col-span-2">{lockedEmail('leader-email')}</div>

                        <div className="md:col-span-2">
                          <Field label="Official IITM email address" htmlFor="leader-official-email" hint="Your student email ending in @ds.study.iitm.ac.in" required>
                            <div className="relative">
                              <input
                                id="leader-official-email"
                                required
                                type="email"
                                name="officialEmail"
                                value={leaderData.officialEmail}
                                onChange={handleLeaderChange}
                                placeholder="e.g. 21f1000000@ds.study.iitm.ac.in"
                                className={inputCls}
                              />
                              <GraduationCap className={iconCls} />
                            </div>
                          </Field>
                        </div>
                      </div>
                    </Section>

                    <Section index={2} title="Your community" subtitle="Tell us about the student group you run.">
                      <Field label="Are you a BS student?" required>
                        <div className="grid grid-cols-3 gap-3">
                          {['Yes', 'No', 'Prefer not to say'].map(opt => {
                            const active = leaderData.isBSStudent === opt;
                            return (
                              <Choice
                                key={opt}
                                active={active}
                                onClick={() => setLeaderField('isBSStudent', opt)}
                                className="min-h-14 px-2.5 py-2 flex items-center justify-center gap-2 text-center text-sm sm:text-[15px] font-bold leading-tight"
                              >
                                {active && <Check className="w-4 h-4 shrink-0 hidden sm:block" style={{ color: meta.accentText }} />}
                                <span>{opt}</span>
                              </Choice>
                            );
                          })}
                        </div>
                      </Field>

                      <Field label="Are you the owner of the student group?" required>
                        <div className="grid grid-cols-2 gap-3">
                          {['Yes', 'No'].map(opt => {
                            const active = leaderData.isGroupOwner === opt;
                            return (
                              <Choice
                                key={opt}
                                active={active}
                                onClick={() => setLeaderField('isGroupOwner', opt)}
                                className="min-h-14 px-3 py-2 flex items-center justify-center gap-2 text-[15px] font-bold"
                              >
                                {active && <Check className="w-4 h-4 shrink-0" style={{ color: meta.accentText }} />}
                                <span>{opt}</span>
                              </Choice>
                            );
                          })}
                        </div>
                      </Field>

                      <Field label="Group link" htmlFor="leader-group-link" hint="WhatsApp, Telegram, Discord or any other invite link." required>
                        <div className="relative">
                          <input
                            id="leader-group-link"
                            required
                            type="url"
                            name="groupLink"
                            value={leaderData.groupLink}
                            onChange={handleLeaderChange}
                            placeholder="https://chat.whatsapp.com/… or https://t.me/…"
                            className={inputCls}
                          />
                          <LinkIcon className={iconCls} />
                        </div>
                      </Field>

                      <Field label="Roughly how many members are in your group?" required>
                        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                          {MEMBER_RANGES.map(range => {
                            const active = leaderData.groupMembers === range;
                            return (
                              <Choice
                                key={range}
                                active={active}
                                onClick={() => setLeaderField('groupMembers', range)}
                                className="h-14 px-2 flex items-center justify-center gap-1.5 text-[15px] font-black tabular-nums"
                              >
                                <Users className="w-4 h-4 shrink-0 hidden sm:block lg:hidden xl:block" style={active ? { color: meta.accentText } : { opacity: 0.5 }} />
                                {range}
                              </Choice>
                            );
                          })}
                        </div>
                      </Field>
                    </Section>

                    <Section index={3} title="Anything else?" subtitle="Questions for us, or more about your community.">
                      <Field label="Questions / inquiries" htmlFor="leader-inquiries" optional>
                        <div className="relative">
                          <textarea
                            id="leader-inquiries"
                            rows={4}
                            name="inquiries"
                            value={leaderData.inquiries}
                            onChange={handleLeaderChange}
                            placeholder="Ask anything or tell us more about your community…"
                            className={`${fieldBase} min-h-[130px] pl-12 pr-4 py-4 font-medium leading-relaxed resize-y peer`}
                          />
                          <MessageSquare className="w-5 h-5 text-slate-400 absolute left-4 top-[1.15rem] pointer-events-none transition-colors peer-focus:text-blue-600" />
                        </div>
                      </Field>
                    </Section>

                    <motion.div variants={itemVariants} className={actionBarCls}>
                      {errorBanner}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500">
                          <Mail className="w-4 h-4 shrink-0" />
                          We reply on WhatsApp &amp; email.
                        </p>
                        <button type="submit" disabled={submitting} className={primaryBtnCls}>
                          {submitting ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Submitting application…</span>
                            </>
                          ) : (
                            <>
                              <span>Submit application</span>
                              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
