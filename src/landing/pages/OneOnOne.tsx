'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, 
  X as XIcon, 
  Plus, 
  Minus, 
  ChevronRight, 
  ArrowRight, 
  Calendar, 
  Clock, 
  Users, 
  Sparkles, 
  ShieldCheck, 
  Video, 
  FileText, 
  MessageCircle, 
  TrendingUp, 
  HelpCircle,
  CheckCircle2,
  GraduationCap
} from 'lucide-react';
import { Link } from '@/landing/shims/router';
import BookingModal1on1 from '@/landing/components/BookingModal1on1';
import OneOnOneScheduleCard from '@/landing/components/OneOnOneScheduleCard';
import { useAuth } from '@/landing/context/AuthContext';

export default function OneOnOne() {
  const { user, profile, openLoginModal } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('1:1 Personalised Teaching');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  const openBooking = (planName?: string) => {
    const targetPlan = planName || '1:1 Personalised Teaching';
    if (!user) {
      setPendingPlan(targetPlan);
      openLoginModal();
      return;
    }
    setSelectedPlan(targetPlan);
    setModalOpen(true);
  };

  // If user logs in after attempting to book, automatically open the booking modal
  React.useEffect(() => {
    if (user && pendingPlan) {
      setSelectedPlan(pendingPlan);
      setPendingPlan(null);
      setModalOpen(true);
    }
  }, [user, pendingPlan]);

  const faqs = [
    {
      q: "Who actually takes the class?",
      a: "A teacher from the same pool that runs our course batches — someone who has mastered and taught the subject before, not a junior reading slides. If the match does not feel 100% right after the first class, support changes the teacher immediately with zero hassle."
    },
    {
      q: "How are the timings decided?",
      a: "You choose your own slots each week based on your college, office, or personal schedule. Early mornings, late evenings, or weekends — you coordinate directly with your dedicated tutor."
    },
    {
      q: "What does it cost?",
      a: "Because each student has different subject needs and target goals (e.g. 2 classes a week vs crash prep), support shares a clear, personalized quote right after your free 15-minute consultation. No upfront payment to get started."
    },
    {
      q: "Can I take only one subject?",
      a: "Yes, absolutely! The majority of our 1:1 students take just one tough subject (like Maths 2, Stats 2, or Python) where they need intensive guidance and live doubt clearing."
    },
    {
      q: "How does the refund plan work?",
      a: "With our Qualify-or-Refund tier, if you attend the scheduled sessions, complete the assigned practice, and still do not qualify or clear your subject, you get 100% of your fee refunded in writing."
    }
  ];

  return (
    <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* 1. HERO SECTION */}
      <section className="relative bg-[#070d19] text-white pt-16 pb-24 lg:pt-20 lg:pb-32 px-6 overflow-hidden border-b-[3px] border-[#0b1120]">
        {/* Subtle grid background */}
        <div 
          className="absolute inset-0 opacity-[0.07] pointer-events-none" 
          style={{
            backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(to right, #ffffff 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Ambient radial glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Headline & Value Proposition */}
            <div className="lg:col-span-7 space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-wider shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                PERSONAL TEACHER
              </div>

              {/* Main Headline with Highlighted Circle around "One student" */}
              <h1 className="text-5xl sm:text-6xl xl:text-7xl font-black tracking-tight leading-[1.08] text-white">
                <span className="relative inline-block">
                  <span className="relative z-10 text-white">One student.</span>
                  {/* Stylized Hand-Drawn SVG Circle Highlight in Yellow */}
                  <svg 
                    className="absolute -inset-x-3 sm:-inset-x-5 -inset-y-2 sm:-inset-y-3 w-[calc(100%+24px)] sm:w-[calc(100%+40px)] h-[calc(100%+16px)] sm:h-[calc(100%+24px)] z-0 pointer-events-none text-yellow-400"
                    viewBox="0 0 260 90" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                  >
                    <motion.path 
                      d="M18 48 C 22 20, 95 8, 175 14 C 235 18, 252 38, 245 56 C 235 76, 150 86, 75 82 C 25 78, 6 62, 14 42 C 18 32, 45 22, 92 18" 
                      stroke="currentColor" 
                      strokeWidth="3.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ 
                        pathLength: [0, 1, 1, 1],
                        opacity: [0.3, 1, 1, 0.95]
                      }}
                      transition={{ 
                        duration: 2.2, 
                        repeat: Infinity,
                        repeatDelay: 3,
                        ease: "easeInOut" 
                      }}
                    />
                  </svg>
                </span>
                <br />
                <span>One teacher.</span>
                <br />
                <span className="text-gray-400">Your syllabus.</span>
              </h1>

              {/* Clean, punchy subtitle per user instructions */}
              <p className="text-lg sm:text-xl text-gray-300 font-medium leading-relaxed max-w-xl">
                Zero distraction, zero shared focus. Complete accountability — just like your dedicated personal home tutor.
              </p>

              {/* CTA Buttons - Free slot, ₹99 removed */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <motion.button
                  animate={{
                    x: [0, -4, 4, -4, 4, -2, 2, 0],
                    scale: [1, 1.025, 1, 1.025, 1]
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    repeatDelay: 2.5,
                    ease: "easeInOut"
                  }}
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.98, y: 1 }}
                  onClick={() => openBooking('1:1 Personalised Teaching')}
                  className="relative px-8 py-4 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl font-black text-base border-2 border-[#0b1120] shadow-[4px_4px_0px_#ffffff] transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span>Book a Free 15-min Slot</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                  </span>
                </motion.button>

                <button
                  onClick={() => openBooking('Request a call from support')}
                  className="px-8 py-4 bg-white/10 hover:bg-white/15 text-white border-2 border-white/20 hover:border-white/40 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Request a call from support</span>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                </button>
              </div>

              {/* Sub-text note */}
              <p className="text-xs text-gray-400 font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Fees depend on your subjects and class count. Support shares a plan and quote after one short call.
              </p>
            </div>

            {/* Right Column: Interactive Schedule Card (Photo 1) */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <OneOnOneScheduleCard />
            </div>

          </div>
        </div>
      </section>

      {/* 2. STAT HIGHLIGHT STRIP (Below Hero) */}
      <section className="bg-gray-50 border-b-[3px] border-[#0b1120] py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div className="p-5 sm:p-6 bg-white border-2 border-[#0b1120] rounded-2xl shadow-[4px_4px_0px_#0b1120]">
              <div className="text-3xl sm:text-4xl font-black text-[#0b1120]">1:1</div>
              <div className="text-xs sm:text-sm font-bold text-gray-600 mt-1">Class size, always</div>
            </div>

            <div className="p-5 sm:p-6 bg-white border-2 border-[#0b1120] rounded-2xl shadow-[4px_4px_0px_#0b1120]">
              <div className="text-2xl sm:text-3xl font-black text-[#0b1120]">Your slots</div>
              <div className="text-xs sm:text-sm font-bold text-gray-600 mt-1">Rescheduled week to week</div>
            </div>

            <div className="p-5 sm:p-6 bg-white border-2 border-[#0b1120] rounded-2xl shadow-[4px_4px_0px_#0b1120]">
              <div className="text-2xl sm:text-3xl font-black text-[#0b1120]">Unlimited</div>
              <div className="text-xs sm:text-sm font-bold text-gray-600 mt-1">Re-teaching until you understand</div>
            </div>

            <div className="p-5 sm:p-6 bg-white border-2 border-[#0b1120] rounded-2xl shadow-[4px_4px_0px_#0b1120]">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">100% Focus</div>
              <div className="text-xs sm:text-sm font-bold text-gray-600 mt-1">Dedicated home tutor</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS SECTION */}
      <section className="py-20 lg:py-28 px-6 bg-white border-b-[3px] border-[#0b1120]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14">
            <h2 className="text-4xl sm:text-5xl font-black text-[#0b1120] tracking-tight">
              How it works
            </h2>
            <p className="text-lg text-gray-600 font-bold mt-3">
              Four steps from the first message to a class that is already on your calendar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 01 */}
            <div className="p-7 bg-[#f8fafc] hover:bg-[#ecfdf5] border-[3px] border-[#0b1120] hover:border-[#10b981] rounded-3xl shadow-[6px_6px_0px_#0b1120] hover:shadow-[6px_6px_0px_#10b981] flex flex-col justify-between hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group">
              <div>
                <span className="text-4xl sm:text-5xl font-black text-[#0b1120] group-hover:text-emerald-600 transition-colors block mb-6">
                  01
                </span>
                <h3 className="text-xl font-black text-[#0b1120] mb-3 leading-snug">
                  Tell us the subjects
                </h3>
                <p className="text-sm font-medium text-gray-600 group-hover:text-gray-700 leading-relaxed transition-colors">
                  Your level, your subjects and what is going wrong right now.
                </p>
              </div>
            </div>

            {/* Step 02 */}
            <div className="p-7 bg-[#f8fafc] hover:bg-[#ecfdf5] border-[3px] border-[#0b1120] hover:border-[#10b981] rounded-3xl shadow-[6px_6px_0px_#0b1120] hover:shadow-[6px_6px_0px_#10b981] flex flex-col justify-between hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group">
              <div>
                <span className="text-4xl sm:text-5xl font-black text-[#0b1120] group-hover:text-emerald-600 transition-colors block mb-6">
                  02
                </span>
                <h3 className="text-xl font-black text-[#0b1120] mb-3 leading-snug">
                  Get a teacher match
                </h3>
                <p className="text-sm font-medium text-gray-600 group-hover:text-gray-700 leading-relaxed transition-colors">
                  Support calls back with a teacher, a schedule and the fee for that plan.
                </p>
              </div>
            </div>

            {/* Step 03 */}
            <div className="p-7 bg-[#f8fafc] hover:bg-[#ecfdf5] border-[3px] border-[#0b1120] hover:border-[#10b981] rounded-3xl shadow-[6px_6px_0px_#0b1120] hover:shadow-[6px_6px_0px_#10b981] flex flex-col justify-between hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group">
              <div>
                <span className="text-4xl sm:text-5xl font-black text-[#0b1120] group-hover:text-emerald-600 transition-colors block mb-6">
                  03
                </span>
                <h3 className="text-xl font-black text-[#0b1120] mb-3 leading-snug">
                  Sit the first class
                </h3>
                <p className="text-sm font-medium text-gray-600 group-hover:text-gray-700 leading-relaxed transition-colors">
                  A real class on a real topic — not a sales demo. Change teacher if it does not fit.
                </p>
              </div>
            </div>

            {/* Step 04 */}
            <div className="p-7 bg-[#f8fafc] hover:bg-[#ecfdf5] border-[3px] border-[#0b1120] hover:border-[#10b981] rounded-3xl shadow-[6px_6px_0px_#0b1120] hover:shadow-[6px_6px_0px_#10b981] flex flex-col justify-between hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group">
              <div>
                <span className="text-4xl sm:text-5xl font-black text-[#0b1120] group-hover:text-emerald-600 transition-colors block mb-6">
                  04
                </span>
                <h3 className="text-xl font-black text-[#0b1120] mb-3 leading-snug">
                  Run it weekly
                </h3>
                <p className="text-sm font-medium text-gray-600 group-hover:text-gray-700 leading-relaxed transition-colors">
                  You set slots each week, the teacher tracks the syllabus and the practice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PLANS SECTION */}
      <section className="py-20 lg:py-28 px-6 bg-[#f8fafc] border-b-[3px] border-[#0b1120]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
              Plans
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-[#0b1120] tracking-tight mt-3">
              Pick how close you want the teaching
            </h2>
            <p className="text-lg text-gray-600 font-bold mt-2">
              Every plan is live teaching by a person, not a recording with a doubt box.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            
            {/* PLAN 1: SMALL BATCH */}
            <motion.div
              whileHover={{ y: -8, scale: 1.015 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className="bg-white border-[3px] border-[#0b1120] rounded-3xl p-8 shadow-[6px_6px_0px_#0b1120] hover:shadow-[10px_10px_0px_#0b1120] flex flex-col justify-between transition-shadow duration-200"
            >
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                  SMALL BATCH
                </div>
                <h3 className="text-2xl font-black text-[#0b1120] mb-6">
                  1:5 Teaching
                </h3>

                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-700">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Five students, one teacher, live</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-700">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Every doubt answered in the class</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-700">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Shared plan and practice board</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-700">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Lowest fee of the three plans</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => openBooking('1:5 Small Batch Teaching')}
                className="w-full py-4 bg-white hover:bg-gray-50 text-[#0b1120] font-black text-sm border-2 border-[#0b1120] rounded-xl shadow-[3px_3px_0px_#0b1120] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                Contact support
              </button>
            </motion.div>

            {/* PLAN 2: ONE TO ONE (FEATURED / MOST ASKED FOR) */}
            <motion.div
              whileHover={{ y: -12, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className="bg-[#0b1120] text-white border-[3.5px] border-[#0b1120] rounded-3xl p-8 shadow-[10px_10px_0px_#10b981] hover:shadow-[14px_14px_0px_#10b981] flex flex-col justify-between relative transform lg:-translate-y-2 transition-shadow duration-200"
            >
              {/* Badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1.5 bg-[#10b981] text-white text-xs font-black uppercase tracking-wider rounded-full border-2 border-[#0b1120] shadow-sm">
                  MOST ASKED FOR
                </span>
              </div>

              <div>
                <div className="text-xs font-black uppercase tracking-wider text-emerald-400 mb-2 mt-2">
                  ONE TO ONE
                </div>
                <h3 className="text-3xl font-black text-white mb-6">
                  1:1 Personalised Teaching
                </h3>

                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-200">
                    <Check className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
                    <span>A teacher who teaches only you</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-200">
                    <Check className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
                    <span>Class timings you choose each week</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-200">
                    <Check className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
                    <span>Topics re-taught until they land</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-200">
                    <Check className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
                    <span>Notes and practice set after each class</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => openBooking('1:1 Personalised Teaching')}
                className="w-full py-4 bg-[#10b981] hover:bg-[#059669] text-white font-black text-sm border-2 border-[#0b1120] rounded-xl shadow-[3px_3px_0px_#ffffff] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                Book 1:1 Free Slot
              </button>
            </motion.div>

            {/* PLAN 3: QUALIFY OR REFUND */}
            <motion.div
              whileHover={{ y: -8, scale: 1.015 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className="bg-white border-[3px] border-[#0b1120] rounded-3xl p-8 shadow-[6px_6px_0px_#0b1120] hover:shadow-[10px_10px_0px_#ef4444] flex flex-col justify-between transition-shadow duration-200"
            >
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-red-600 mb-2">
                  QUALIFY OR REFUND
                </div>
                <h3 className="text-2xl font-black text-[#0b1120] mb-6">
                  1:1 + Full Refund
                </h3>

                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-700">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Everything in 1:1 Personalised</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-700">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Full fee back if you do not qualify</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-700">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Attendance and practice conditions apply</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-bold text-gray-700">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Terms shared in writing before you pay</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => openBooking('Qualify or Refund Plan')}
                className="w-full py-4 bg-white hover:bg-gray-50 text-[#0b1120] font-black text-sm border-2 border-[#0b1120] rounded-xl shadow-[3px_3px_0px_#0b1120] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                Contact support
              </button>
            </motion.div>

          </div>

          {/* Footnote */}
          <div className="mt-8 text-center text-xs sm:text-sm text-gray-500 font-bold max-w-2xl mx-auto">
            Fees depend on the subjects and the number of classes you need. Support shares a plan and a quote after one short call.
          </div>
        </div>
      </section>

      {/* 5. WHO THIS IS FOR vs WHAT A CLASS INCLUDES */}
      <section className="py-20 lg:py-28 px-6 bg-white border-b-[3px] border-[#0b1120]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            
            {/* Left: Who this is for */}
            <div className="bg-[#f8fafc] border-[3px] border-[#0b1120] rounded-3xl p-8 sm:p-10 shadow-[8px_8px_0px_#0b1120] flex flex-col justify-between">
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-[#0b1120] mb-8">
                  Who this is for
                </h3>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 border-2 border-[#0b1120] flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                    <p className="text-sm sm:text-base font-bold text-gray-800">
                      Students who fall behind in a recorded batch and stop asking questions
                    </p>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 border-2 border-[#0b1120] flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                    <p className="text-sm sm:text-base font-bold text-gray-800">
                      Anyone carrying one or two subjects that keep going wrong at the quiz
                    </p>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 border-2 border-[#0b1120] flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                    <p className="text-sm sm:text-base font-bold text-gray-800">
                      Working students whose only free hours move around every week
                    </p>
                  </div>

                  <div className="flex items-start gap-4 pt-4 border-t-2 border-gray-200">
                    <div className="w-7 h-7 rounded-full bg-red-100 border-2 border-[#0b1120] flex items-center justify-center text-red-600 shrink-0 mt-0.5">
                      <XIcon className="w-4 h-4 stroke-[3]" />
                    </div>
                    <p className="text-sm sm:text-base font-bold text-gray-700">
                      Not for anyone who wants marks without attending class or doing practice
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: What a class includes */}
            <div className="bg-white border-[3px] border-[#0b1120] rounded-3xl p-8 sm:p-10 shadow-[8px_8px_0px_#0b1120] flex flex-col justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                  WHAT A CLASS INCLUDES
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-[#0b1120] mb-8">
                  Everything you need to master each topic
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="text-base sm:text-lg font-black text-[#0b1120]">Live teaching</div>
                    <span className="text-sm font-bold text-gray-700 text-right">
                      on your topic, not a playlist
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="text-base sm:text-lg font-black text-[#0b1120]">Class recording</div>
                    <span className="text-sm font-bold text-gray-700 text-right">
                      yours to revise from
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="text-base sm:text-lg font-black text-[#0b1120]">Notes and practice set</div>
                    <span className="text-sm font-bold text-gray-700 text-right">
                      after every class
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="text-base sm:text-lg font-black text-[#0b1120]">Doubts between classes</div>
                    <span className="text-sm font-bold text-gray-700 text-right">
                      on WhatsApp, same teacher
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="text-base sm:text-lg font-black text-[#0b1120]">Progress check</div>
                    <span className="text-sm font-bold text-gray-700 text-right">
                      before each quiz
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 6. MID-PAGE CALLOUT BANNER (No ₹99) */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 border-b-[3px] border-[#0b1120]">
        <div className="max-w-7xl mx-auto">
          <div className="p-8 sm:p-10 lg:p-12 bg-white border-[3px] border-[#0b1120] rounded-3xl shadow-[8px_8px_0px_#0b1120] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 border-[2.5px] border-[#0b1120] flex items-center justify-center text-emerald-600 shrink-0 shadow-[3px_3px_0px_#0b1120]">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-[#0b1120]">
                  Not sure yet? Talk for 15 minutes.
                </h3>
                <p className="text-sm sm:text-base text-gray-600 font-bold mt-1 max-w-2xl">
                  A focused call — course choice, a stuck concept, or what to do about a bad quiz. Book your own slot.
                </p>
              </div>
            </div>

            <button
              onClick={() => openBooking('15-Min Quick Consultation')}
              className="w-full md:w-auto px-8 py-4 bg-[#10b981] hover:bg-[#059669] text-white font-black text-base border-2 border-[#0b1120] rounded-xl shadow-[4px_4px_0px_#0b1120] active:translate-x-0.5 active:translate-y-0.5 transition-all whitespace-nowrap cursor-pointer shrink-0"
            >
              Book Free Slot &gt;
            </button>
          </div>
        </div>
      </section>

      {/* 7. FAQ SECTION ("Questions students ask first") */}
      <section className="py-20 lg:py-28 px-6 bg-white border-b-[3px] border-[#0b1120]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-black text-[#0b1120] tracking-tight mb-12">
            Questions students ask first
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className={`border-[2.5px] border-[#0b1120] rounded-2xl overflow-hidden transition-all duration-200 ${
                    isOpen ? 'bg-[#f8fafc] shadow-[4px_4px_0px_#0b1120]' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left gap-4 cursor-pointer"
                  >
                    <span className="text-lg font-black text-[#0b1120]">
                      {faq.q}
                    </span>
                    <span className="w-8 h-8 rounded-full border-2 border-[#0b1120] flex items-center justify-center text-[#0b1120] shrink-0 font-black">
                      {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-6 pb-6 pt-1 text-sm sm:text-base font-medium text-gray-700 leading-relaxed border-t border-gray-200 mt-1">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. BOTTOM FINAL CTA BANNER */}
      <section className="py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-[#0e271f] text-white border-b-[3px] border-[#0b1120] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 w-full">
          <div className="space-y-4 text-center lg:text-left max-w-2xl">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.08]">
              Stop rewatching.<br className="hidden sm:inline" /> Get taught.
            </h2>
            <p className="text-gray-200 font-medium text-base sm:text-lg lg:text-xl max-w-xl leading-relaxed">
              One call is enough to know whether 1:1 is worth it for your subjects. No payment to find out.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-5 w-full lg:w-auto shrink-0">
            <button
              onClick={() => openBooking('1:1 Personalised Teaching')}
              className="px-8 py-4 sm:py-5 bg-[#10b981] hover:bg-[#059669] text-white rounded-2xl font-black text-base sm:text-lg border-[2.5px] border-[#0b1120] shadow-[4px_4px_0px_#ffffff] hover:shadow-[6px_6px_0px_#ffffff] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Book a 15-min call</span>
              <span className="text-xl font-black leading-none">&gt;</span>
            </button>

            <button
              onClick={() => openBooking('Request Support Call')}
              className="px-8 py-4 sm:py-5 bg-white hover:bg-gray-100 text-[#0b1120] rounded-2xl font-black text-base sm:text-lg border-[2.5px] border-[#0b1120] shadow-[4px_4px_0px_rgba(0,0,0,0.4)] hover:shadow-[6px_6px_0px_rgba(0,0,0,0.4)] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Request a call from support</span>
              <span className="text-xl font-black leading-none">&gt;</span>
            </button>
          </div>
        </div>
      </section>

      {/* 9. TAILORED 1:1 FOOTER */}
      <footer className="bg-[#0b1120] text-white pt-16 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            
            {/* Column 1: Brand & Tagline */}
            <div className="space-y-4">
              <Link to="/" className="flex items-center gap-1">
                <span className="font-black text-2xl tracking-tight text-white">GEN-Z</span>
                <span className="font-black text-2xl tracking-tight text-red-500">IITian</span>
              </Link>
              <p className="text-gray-400 font-medium text-sm leading-relaxed max-w-xs">
                1:1 teaching is the personalised arm of Gen-Z IITian — the same teachers, taking class for one student at a time.
              </p>
              <button
                onClick={() => openBooking('Footer Quick Call')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#0b1120] hover:bg-gray-100 rounded-xl font-black text-xs border-2 border-white transition-colors cursor-pointer"
              >
                Request a call &gt;
              </button>
            </div>

            {/* Column 2: Teaching Links */}
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-4">
                Teaching
              </h4>
              <ul className="space-y-2.5 text-sm font-bold text-gray-300">
                <li>
                  <button onClick={() => openBooking('1:1 Personalised Teaching')} className="hover:text-emerald-400 transition-colors text-left">
                    1:1 Personalised Teaching
                  </button>
                </li>
                <li>
                  <button onClick={() => openBooking('1:5 Small Batch Teaching')} className="hover:text-emerald-400 transition-colors text-left">
                    1:5 Small Batch Teaching
                  </button>
                </li>
                <li>
                  <button onClick={() => openBooking('Qualify-or-Refund Plan')} className="hover:text-emerald-400 transition-colors text-left">
                    Qualify-or-Refund Plan
                  </button>
                </li>
                <li>
                  <button onClick={() => openBooking('15-min Session')} className="hover:text-emerald-400 transition-colors text-left">
                    15-min Session
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Back to Campus */}
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-4">
                Back to campus
              </h4>
              <ul className="space-y-2.5 text-sm font-bold text-gray-300">
                <li>
                  <Link to="/" className="hover:text-emerald-400 transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/explore/courses" className="hover:text-emerald-400 transition-colors">
                    Courses
                  </Link>
                </li>
                <li>
                  <Link to="/tools/cgpa-calculator" className="hover:text-emerald-400 transition-colors">
                    Academic Tools
                  </Link>
                </li>
                <li>
                  <Link to="/refer" className="hover:text-emerald-400 transition-colors">
                    EarnLab ↗
                  </Link>
                </li>
              </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between text-xs font-bold text-gray-500 gap-4">
            <div className="flex items-center gap-6">
              <Link to="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            </div>
            <div>
              © 2026 GEN-Z IITIAN. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      {/* Interactive Booking Modal */}
      <BookingModal1on1
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultPlan={selectedPlan}
      />
    </div>
  );
}
