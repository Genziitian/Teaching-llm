'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView, animate } from 'motion/react';
import { ChevronRight, ChevronLeft, Award, CheckCircle2, X as XIcon, Star } from 'lucide-react';
import { Link } from '@/landing/shims/router';
import CourseCard, { CourseCardData } from '@/landing/components/CourseCard';
import HeroAnimation from '@/landing/components/HeroAnimation';
import HiringSection from '@/landing/components/HiringSection';
import MobileHome from '@/landing/components/mobile/MobileHome';
import OneOnOnePromoBanner from '@/landing/components/OneOnOnePromoBanner';
import QuizLabLaunch from '@/landing/components/QuizLabLaunch';
import { useAuth } from '@/landing/context/AuthContext';
import { supabase } from '@/landing/lib/supabase';
import { BlogPost, fallbackBlogs } from '@/landing/data/blogsData';
import { getYouTubeId } from '@/landing/utils/youtube';

function AnimatedNumber({ value, decimals = 0, suffix = "" }: { value: number, decimals?: number, suffix?: string }) {
  const [displayValue, setDisplayValue] = useState("0");
  const nodeRef = useRef(null);
  const isInView = useInView(nodeRef, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      const controls = animate(0, value, {
        duration: 2,
        ease: "easeOut",
        onUpdate(value) {
          setDisplayValue(value.toFixed(decimals));
        }
      });
      return () => controls.stop();
    }
  }, [value, decimals, isInView]);

  return <span ref={nodeRef}>{displayValue}{suffix}</span>;
}

// GenZ IITian is always ✓; YT / Others have a realistic mix of ✓ and ✗.
const COMPARISON_FEATURES: { feature: string; yt: boolean; others: boolean }[] = [
  { feature: "Affordable", yt: true, others: false },
  { feature: "Live Lec + Recordings", yt: false, others: true },
  { feature: "Premium Notes", yt: false, others: true },
  { feature: "Live Doubt Session", yt: false, others: false },
  { feature: "Revision Session", yt: false, others: true },
  { feature: "Mentorship Session", yt: false, others: false },
  { feature: "Resume + LinkedIn Workshops", yt: false, others: false },
  { feature: "Short Notes", yt: true, others: false },
  { feature: "Subject wise blueprint", yt: false, others: true },
];

const REVIEWS = [
              {
                text: "The reattempt batch was a game changer. The mock tests were exactly like the real exam pattern and helped me clear comfortably!",
                initial: "A",
                name: "Aryan Sharma",
                role: "Qualifier Student",
                color: "bg-blue-100 text-blue-700"
              },
              {
                text: "Maths 2 concepts were tough, but the Foundation course simplified everything. The doubt sessions helped a lot.",
                initial: "P",
                name: "Priya Patel",
                role: "Maths 2 Student",
                color: "bg-green-100 text-green-700"
              },
              {
                text: "I am pursuing the Diploma now, and Gen-z IITian has been with me since day 1. Best notes and community.",
                initial: "R",
                name: "Rohan Das",
                role: "Diploma Student",
                color: "bg-purple-100 text-purple-700"
              },
              {
                text: "Affordable and high quality. The structure of the Foundation course is perfect for beginners like me.",
                initial: "S",
                name: "Sanya Verma",
                role: "Foundation Student",
                color: "bg-pink-100 text-pink-700"
              },
              {
                text: "The instructors explain everything so clearly. My GPA improved significantly after joining.",
                initial: "V",
                name: "Vikram Singh",
                role: "Maths 2 Student",
                color: "bg-orange-100 text-orange-700"
              },
              {
                text: "Highly recommended for anyone looking for serious prep. The community is very supportive.",
                initial: "M",
                name: "Meera Iyer",
                role: "Diploma Student",
                color: "bg-teal-100 text-teal-700"
              }
            ];

export default function Home() {
  const { isManager } = useAuth();
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(fallbackBlogs);
  
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState('');

  useEffect(() => {
    async function checkVideoModal() {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'homepage_video_url')
          .maybeSingle();

        if (error) throw error;
        if (data && data.value && data.value.trim() !== '') {
          const urlVal = data.value.trim();
          setVideoModalUrl(urlVal);

          const lastDismissed = localStorage.getItem('last_dismissed_video_modal');
          const now = Date.now();
          const oneDay = 24 * 60 * 60 * 1000; // 24 hours

          if (!lastDismissed || now - parseInt(lastDismissed, 10) > oneDay) {
            const timer = setTimeout(() => {
              setShowVideoModal(true);
            }, 1500);
            return () => clearTimeout(timer);
          }
        }
      } catch (err) {
        console.error('Failed to load video modal settings:', err);
      }
    }
    checkVideoModal();
  }, []);

  const dismissVideoModal = () => {
    localStorage.setItem('last_dismissed_video_modal', Date.now().toString());
    setShowVideoModal(false);
  };

  useEffect(() => {
    fetchCourses();
    // Blogs now come from Supabase (managed in Manager → Blogs).
    supabase
      .from('blogs')
      .select('*')
      .eq('published', 1)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (Array.isArray(data) && data.length > 0) setBlogPosts(data as BlogPost[]); });
  }, []);

  const fetchCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .order('isPinned', { ascending: false })
      .order('created_at', { ascending: false });
    setCourses((data || []).filter((course: any) => course.active !== false));
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-blue-100 overflow-hidden">
      {/* Quiz Lab launch: full-screen surprise on first visit, corner box after */}
      <QuizLabLaunch />


      {/* Mobile hero/stats/ecosystem (md:hidden) — matches the Gen-Z IITian mobile design */}
      <MobileHome />

      {/* Hero Section (desktop) */}
      <section className="hidden md:block relative pt-12 pb-16 sm:pt-16 sm:pb-24 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 items-center">
          {/* Text Content */}
          <div className="relative z-10 flex flex-col items-start">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-4 sm:mb-6 text-[#0b1120]">
              Welcome to <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                Gen-Z IITian
              </span>
            </h1>

            <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 font-medium mb-6 sm:mb-8 max-w-2xl leading-relaxed">
              We help online and hybrid degree students master IIT-level courses with smart notes, quizzes, PYQs, and expert-led lectures.
            </p>

            <div className="flex flex-col items-start gap-5">
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Link to="/explore/courses" className="px-6 py-3 sm:px-8 sm:py-4 lg:text-lg bg-blue-600 text-white rounded-xl font-black tracking-wide text-base border-[3px] border-[#0b1120] shadow-[4px_4px_0px_#0b1120] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_#2563eb] transition-all flex items-center gap-2 relative overflow-hidden group">
                  <span className="relative z-10 flex items-center gap-2">Enroll for Sept Term <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform" /></span>
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] skew-x-[-15deg] animate-[shine_3s_ease-out_infinite]"></div>
                </Link>
              </motion.div>
              <div className="flex items-center gap-4">
              <a aria-label="WhatsApp Community" title="WhatsApp Community" href="https://chat.whatsapp.com/Gi4D9yAd99p7q1XeVh0J1e" target="_blank" rel="noopener noreferrer" className="p-3 sm:p-3.5 bg-white text-[#0b1120] rounded-xl font-bold text-base border-[3px] border-[#0b1120] shadow-[4px_4px_0px_#0b1120] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_#10b981] transition-all flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white" className="sm:w-3 sm:h-3"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                </div>
              </a>
              <a aria-label="YouTube" title="YouTube" href="https://youtube.com/@Gen-ZIITian/" target="_blank" rel="noopener noreferrer" className="p-3 sm:p-3.5 bg-white text-[#0b1120] rounded-xl font-bold text-base border-[3px] border-[#0b1120] shadow-[4px_4px_0px_#0b1120] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_#10b981] transition-all flex items-center gap-2">
                <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden="true"><rect width="30" height="22" rx="6" fill="#FF0000" /><path d="M12 6.5v9l8-4.5z" fill="#fff" /></svg>
              </a>
              </div>
            </div>

            {/* 1:1 Personalised Teaching Promotion Button */}
            <div className="mt-6">
              <Link 
                to="/one-to-one"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-emerald-900 hover:bg-emerald-100 font-black text-xs sm:text-sm shadow-[3px_3px_0px_#059669] active:translate-y-0.5 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Need personalised attention?</span>
                <ChevronRight className="w-4 h-4 text-emerald-600" />
              </Link>
            </div>
          </div>

          {/* Graphic/Animation Area */}
          <HeroAnimation />
        </div>
      </section>

      {/* Featured Courses Section */}
      <section className="bg-[#0b1120] py-12 border-t-[3px] border-b-[3px] border-[#0b1120] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <h2 className="text-2xl lg:text-3xl font-black text-white">Featured Cohorts</h2>
            <Link
              to="/explore/courses"
              className="inline-flex items-center gap-2 text-sm font-black text-[#0b1120] bg-white border-[3px] border-[#0b1120] rounded-xl px-5 py-3 shadow-[4px_4px_0px_#10b981] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_#10b981] transition-all"
            >
              See All Courses <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin w-8 h-8 border-[3px] border-[#10b981] border-t-white rounded-full"></div>
            </div>
          ) : courses.length === 0 ? (
            <div className="bg-white border-[3px] border-[#0b1120] rounded-2xl p-8 text-center shadow-[8px_8px_0px_#10b981]">
              <h3 className="text-2xl font-black text-[#0b1120] mb-2">No courses published yet</h3>
              <p className="text-sm font-bold text-gray-500">Add courses from the manager panel and they will appear here automatically.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {courses.slice(0, 3).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stats & Ecosystem Section (desktop — mobile equivalent lives in MobileHome) */}
      <section className="hidden md:block max-w-7xl mx-auto px-6 py-12 space-y-16">
        {/* New Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {[
            { value: 15.4, suffix: "K+", label: "YouTube Subscribers", bgColor: "bg-[#f1f5f9]" },
            { value: 3439, suffix: "+", label: "Students Learning", bgColor: "bg-[#10b981]", textColor: "text-white" },
            { value: 43, suffix: "", label: "IIT-Level Courses", bgColor: "bg-white" }
          ].map((stat, i) => (
            <div key={i} className={`${stat.bgColor} border-[3px] border-[#0b1120] rounded-3xl p-8 shadow-[6px_6px_0px_#0b1120] text-center hover:translate-y-[-4px] transition-transform`}>
              <div className={`text-4xl lg:text-5xl font-black ${stat.textColor || 'text-[#0b1120]'} mb-2`}>
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className={`text-sm lg:text-base font-black ${stat.textColor || 'text-[#0b1120]'} uppercase tracking-tight`}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Ecosystem Triple Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Left Card: Ecosystem Features */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
            className="bg-[#10b981] border-[4px] border-[#0b1120] rounded-[2.5rem] p-8 lg:p-12 shadow-[10px_10px_0px_#0b1120] relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full border-l-4 border-b-4 border-[#0b1120]/20 pointer-events-none transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-5xl font-black text-white leading-[1.1] mb-6">
                Experience the Powerful and Best Ecosystem
              </h2>
              <p className="text-white/90 font-bold text-lg mb-10 max-w-lg">
                See how our platform simplifies complex concepts and helps you ace your exams with ease.
              </p>
              
              <div className="flex flex-wrap gap-3">
                {[
                  "Daily Live", "Recorded classes", "Weekly Mock Test", 
                  "Live Doubts", "Graded Practice", "Assignments", 
                  "Imp Ques & Blueprint", "Curated"
                ].map((tag, i) => (
                  <motion.span 
                    key={i} 
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + (i * 0.05) }}
                    whileHover={{ scale: 1.1, backgroundColor: "#0b1120", color: "#ffffff" }}
                    className="px-5 py-2.5 bg-white border-[3px] border-[#0b1120] rounded-full text-sm font-black text-[#0b1120] shadow-[3px_3px_0px_#0b1120] whitespace-nowrap cursor-default"
                  >
                    {tag}
                  </motion.span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Card: Mentoring */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
            className="bg-[#0b1120] border-[4px] border-[#0b1120] rounded-[2.5rem] p-8 lg:p-12 shadow-[10px_10px_0px_#10b981] relative overflow-hidden flex flex-col justify-center min-h-[400px]"
          >
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
            
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-5xl font-black text-white leading-[1.1] mb-6">
                Personally mentoring India's next top engineers
              </h2>
              <p className="text-gray-400 font-bold text-lg leading-relaxed max-w-lg">
                Taking you from basics to advanced through practical learning and real-world problem solving.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-12 md:py-20 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10 md:mb-16">
            <div className="inline-block px-4 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-full font-semibold text-xs tracking-wide mb-4">
              The Clear Choice
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-[-0.025em] text-[#0b1120] mb-3">Why Gen-Z IITian?</h2>
            <p className="text-gray-500 font-medium text-base md:text-lg">Compare and see the difference for yourself.</p>
          </div>

          <div className="hidden md:block relative max-w-5xl mx-auto pb-8">
            <div className="grid grid-cols-[1.6fr_1.1fr_1fr_1fr] items-stretch rounded-[2rem] border border-black/10 bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.18)] overflow-hidden">
              {/* Header */}
              <div className="px-8 py-6 flex items-end text-sm font-semibold text-gray-500 uppercase tracking-wider bg-slate-50 border-b border-black/5">Features</div>
              <div className="relative bg-gradient-to-b from-emerald-500 to-emerald-600 text-white px-4 pt-8 pb-6 text-center">
                <span className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">Your Best Bet</span>
                <div className="mt-2 text-xl font-bold tracking-tight">GenZ IITian</div>
              </div>
              <div className="px-4 py-6 flex items-end justify-center text-center text-sm font-semibold text-gray-700 bg-slate-50 border-b border-black/5">YouTube Lectures</div>
              <div className="px-4 py-6 flex items-end justify-center text-center text-sm font-semibold text-gray-700 bg-slate-50 border-b border-black/5">Other Courses</div>

              {/* Rows */}
              {COMPARISON_FEATURES.map((row, i) => {
                const last = i === COMPARISON_FEATURES.length - 1;
                const line = last ? '' : 'border-b border-gray-100';
                const zebra = i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white';
                return (
                  <motion.div
                    key={i}
                    className="contents"
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.6, delay: i * 0.05 }}
                  >
                    <div className={`pr-6 py-5 pl-8 text-base font-semibold text-[#0b1120] flex items-center gap-3 ${zebra} ${line}`}>{row.feature}</div>
                    <div className={`flex items-center justify-center py-5 bg-emerald-50 ${last ? '' : 'border-b border-emerald-100'}`}>
                      <span className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30">
                        <CheckCircle2 className="w-5 h-5" />
                      </span>
                    </div>
                    <div className={`flex items-center justify-center py-5 ${zebra} ${line}`}>
                      {row.yt ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <XIcon className="w-6 h-6 text-gray-300" />}
                    </div>
                    <div className={`flex items-center justify-center py-5 ${zebra} ${line}`}>
                      {row.others ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <XIcon className="w-6 h-6 text-gray-300" />}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Mobile comparison — compact, no horizontal scroll */}
          <div className="md:hidden border-[3px] border-[#0b1120] rounded-2xl bg-white shadow-[6px_6px_0px_#0b1120] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0b1120] text-white">
                  <th className="py-3 px-3 text-xs font-black">Features</th>
                  <th className="py-3 px-1 w-[52px] text-[10px] font-black text-center bg-[#dcfce7] text-[#0b1120]">GenZ</th>
                  <th className="py-3 px-1 w-[42px] text-[10px] font-black text-center">YT</th>
                  <th className="py-3 px-1 w-[52px] text-[10px] font-black text-center leading-tight">Others</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#0b1120]/10">
                {COMPARISON_FEATURES.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2.5 px-3 font-black text-[#0b1120] text-[11.5px] leading-tight">{row.feature}</td>
                    <td className="py-2.5 px-1 text-center bg-[#f0fdf4] border-x-2 border-[#0b1120]/10">
                      <CheckCircle2 className="w-5 h-5 text-[#10b981] mx-auto" />
                    </td>
                    <td className="py-2.5 px-1 text-center">
                      {row.yt
                        ? <CheckCircle2 className="w-5 h-5 text-[#10b981] mx-auto" />
                        : <XIcon className="w-4 h-4 text-red-300 mx-auto" />}
                    </td>
                    <td className="py-2.5 px-1 text-center">
                      {row.others
                        ? <CheckCircle2 className="w-5 h-5 text-[#10b981] mx-auto" />
                        : <XIcon className="w-4 h-4 text-red-300 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-[#10b981] text-white text-center py-2 text-[10px] font-black uppercase tracking-wider border-t-2 border-[#0b1120]">
              GenZ IITian — Your Best Bet
            </div>
          </div>
        </div>
      </section>



      {/* Testimonials Section */}
      <section className="bg-[#f8fafc] py-16 border-t-[3px] border-[#0b1120]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="text-center sm:text-left">
              <h2 className="text-2xl lg:text-3xl font-black text-[#0b1120] mb-2 max-w-[18rem] sm:max-w-none mx-auto sm:mx-0 leading-tight">Student Reviews &amp; Shared Experiences</h2>
            </div>
          </div>

          <div className="overflow-hidden pb-4 -mx-6 px-0 reviews-marquee-wrap">
          <div className="reviews-marquee flex gap-6 w-max">
            {[...REVIEWS, ...REVIEWS].map((review, i) => (
              <div key={i} className="shrink-0 w-[300px] md:w-[360px] bg-white border-[3px] border-[#0b1120] rounded-2xl p-6 shadow-[4px_4px_0px_#0b1120] flex flex-col hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_#0b1120] transition-all">
                <p className="text-gray-700 font-bold text-base mb-6 flex-grow">"{review.text}"</p>

                <div className="flex items-center justify-between mt-auto pt-6 border-t-2 border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full ${review.color} border-2 border-[#0b1120] flex items-center justify-center font-black text-xl`}>
                      {review.initial}
                    </div>
                    <div>
                      <div className="font-black text-[#0b1120]">{review.name}</div>
                      <div className="text-sm font-bold text-gray-500">{review.role}</div>
                    </div>
                  </div>
                  <div className="flex text-yellow-400 gap-0.5">{[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-current" />)}</div>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      </section>

        {/* Left Side: Stats/Callout */}
      <section hidden aria-hidden="true" className="hidden bg-white py-16 border-t-[3px] border-[#0b1120] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl lg:text-4xl font-black text-[#0b1120] mb-2">Explore Blogs</h2>
              <p className="text-gray-500 font-bold text-lg">Insights, tips, and strategies for your journey.</p>
            </div>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-sm font-black text-[#0b1120] bg-white border-[3px] border-[#0b1120] rounded-xl px-5 py-3 shadow-[4px_4px_0px_#10b981] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_#10b981] transition-all"
            >
              View All Blogs <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="relative">
            <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-thin snap-x snap-mandatory" style={{ scrollbarWidth: 'thin' }}>
              {blogPosts.map(post => (
                <Link key={post.id} to={`/blog/${post.slug || post.id}`} className="snap-start shrink-0 w-[300px] md:w-[350px] group cursor-pointer block">
                  <div className="relative aspect-video rounded-3xl overflow-hidden border-[3px] border-[#0b1120] mb-4 bg-[#0b1120] shadow-[6px_6px_0px_#0b1120] group-hover:-translate-y-1 group-hover:-translate-x-1 group-hover:shadow-[10px_10px_0px_#0b1120] transition-all">
                    <img src={post.image} alt={post.title} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-4 left-4 px-4 py-1.5 bg-white text-[#0b1120] font-bold text-sm rounded-full border-2 border-[#0b1120]">
                      {post.category}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-bold text-gray-500 mb-2">
                    <span>{post.date}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                    <span>{post.read_time}</span>
                  </div>
                  <h3 className="text-lg font-black text-[#0b1120] leading-tight group-hover:text-[#10b981] transition-colors">
                    {post.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* YouTube Section */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-[#10b981] border-[3px] border-[#0b1120] rounded-[2rem] p-8 lg:p-12 shadow-[8px_8px_0px_#0b1620] relative overflow-hidden">
          {/* Grid background pattern mimicking Image 2 */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          
          <div className="relative z-10 mb-10">
            <h2 className="text-3xl lg:text-5xl font-black text-white mb-4 drop-shadow-md">Explore Gen-Z IITian ON Youtube :</h2>
            <p className="text-white font-bold text-lg max-w-2xl drop-shadow-sm">
              Unfiltered discussions on engineering, startups, and career growth with industry experts and successful developers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            {/* Video 1 */}
            <div className="bg-white rounded-2xl p-4 border-[3px] border-[#0b1120] shadow-[8px_8px_0px_#1e1e1e] hover:-translate-y-1 hover:shadow-[12px_12px_0px_#1e1e1e] transition-all">
              <div className="aspect-video rounded-xl overflow-hidden border-2 border-[#0b1120] mb-4 bg-gray-100 relative">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/yZ2RjBIXkpM"
                  title="Latest Placement Report"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <h3 className="font-black text-[#0b1120] text-lg leading-tight">Latest Placement Report</h3>
            </div>

            {/* Video 2 */}
            <div className="bg-white rounded-2xl p-4 border-[3px] border-[#0b1120] shadow-[8px_8px_0px_#1e1e1e] hover:-translate-y-1 hover:shadow-[12px_12px_0px_#1e1e1e] transition-all">
              <div className="aspect-video rounded-xl overflow-hidden border-2 border-[#0b1120] mb-4 bg-gray-100 relative">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/3pTJspN0RYA"
                  title="Paradox 2026 ULTIMATE Guide"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <h3 className="font-black text-[#0b1120] text-lg leading-tight">Paradox 2026 ULTIMATE Guide</h3>
            </div>

            {/* Video 3 */}
            <div className="bg-white rounded-2xl p-4 border-[3px] border-[#0b1120] shadow-[8px_8px_0px_#1e1e1e] hover:-translate-y-1 hover:shadow-[12px_12px_0px_#1e1e1e] transition-all">
              <div className="aspect-video rounded-xl overflow-hidden border-2 border-[#0b1120] mb-4 bg-gray-100 relative">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/V9C5mRyygcI"
                  title="Why Everyone is Doing BS Degree"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <h3 className="font-black text-[#0b1120] text-lg leading-tight">Why Everyone is Doing BS Degree</h3>
            </div>
          </div>
        </div>
      </section>

      {/* Become Instructor Section */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-[#eef2ff] border-[3px] border-[#0b1120] rounded-2xl p-5 lg:p-8 shadow-[6px_6px_0px_#0b1120] relative overflow-hidden flex flex-col lg:flex-row gap-10 items-center">

          {/* Left Side: Stats/Callout */}
          <div className="w-full lg:w-1/3 flex flex-col gap-6 relative z-10">
            <div className="bg-white border-[3px] border-[#0b1120] rounded-2xl p-6 shadow-[4px_4px_0px_#0b1120]">
              <div className="w-12 h-12 rounded-full bg-[#ecfdf5] border-[3px] border-[#0b1120] flex items-center justify-center mb-3">
                <Award className="w-6 h-6 text-[#10b981]" />
              </div>
              <h3 className="text-xl font-black text-[#0b1120] mb-3">Revenue Share: <span className="text-[#10b981]">60% from Batches</span></h3>
              <p className="text-gray-600 font-bold mb-4 text-sm">
                Do you know our tutor earns 60% of direct revenue from Batches? Start earning today.
              </p>
              <Link
                to="/careers"
                className="w-full py-3 bg-[#0b1120] text-white whitespace-nowrap rounded-xl font-bold text-base border-2 border-[#0b1120] hover:bg-gray-800 transition-colors block text-center"
              >
                Become Instructor
              </Link>
            </div>
          </div>

          {/* Right Side: Content */}
          <div className="w-full lg:w-2/3 relative z-10 lg:pl-8">
            <h2 className="text-3xl lg:text-4xl font-black text-[#0b1120] mb-4 leading-tight">
              Start Sharing Skills, Build Courses, Earn Revenue.
            </h2>
            <p className="text-gray-600 text-base font-bold mb-8 max-w-xl">
              Join our platform, share your expertise, reach thousands of learners, and earn income effortlessly online today.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
              {[
                "Flexible Teaching Schedule",
                "Global Student Reach",
                "Earn Extra Income",
                "Build Personal Brand"
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#10b981] border-2 border-[#0b1120] flex items-center justify-center text-white shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <span className="font-bold text-[#0b1120]">{benefit}</span>
                </div>
              ))}
            </div>

            <a 
              href="https://genziitian.in/careers" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-8 py-4 bg-[#10b981] text-white rounded-xl font-bold text-lg border-[3px] border-[#0b1120] shadow-[4px_4px_0px_#0b1120] whitespace-nowrap hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_#0b1120] transition-all inline-block"
            >
              Become Instructor
            </a>
          </div>
        </div>
      </section>

      {/* Video Modal Popup */}
      <AnimatePresence>
        {showVideoModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 md:p-6 text-[#0b1120]">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={dismissVideoModal}
              className="absolute inset-0 bg-[#0b1120]/70 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              transition={{ type: 'spring', bounce: 0.12, duration: 0.5 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-3xl p-3 sm:p-4 relative shadow-[0_30px_80px_rgba(0,0,0,0.45)] z-10 max-h-[92vh] overflow-y-auto"
            >
              {/* Close button, inside the card so it never clips off small screens */}
              <button
                onClick={dismissVideoModal}
                className="absolute top-5 right-5 sm:top-6 sm:right-6 w-9 h-9 flex items-center justify-center bg-black/55 hover:bg-black/80 text-white rounded-full backdrop-blur transition-all active:scale-90 z-20 cursor-pointer"
                title="Close"
                aria-label="Close video"
              >
                <XIcon className="w-4 h-4" />
              </button>

              {getYouTubeId(videoModalUrl) ? (
                <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black relative">
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeId(videoModalUrl)}?autoplay=1&mute=1&playsinline=1&rel=0`}
                    title="YouTube Video Player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  ></iframe>
                </div>
              ) : (
                <div className="w-full aspect-video rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-medium text-center p-4">
                  Failed to load video player. Invalid YouTube link.
                </div>
              )}

              {getYouTubeId(videoModalUrl) && (
                <div className="flex items-center justify-between gap-3 px-1 pt-3 pb-1">
                  <p className="hidden sm:block text-sm text-gray-500">Prefer the full player? Open it on YouTube.</p>
                  <a
                    href={`https://www.youtube.com/watch?v=${getYouTubeId(videoModalUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={dismissVideoModal}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0b1120] text-white rounded-full font-semibold text-sm hover:bg-gray-800 active:scale-[0.97] transition-all"
                  >
                    <svg width="22" height="16" viewBox="0 0 30 22" aria-hidden="true"><rect width="30" height="22" rx="6" fill="#FF0000" /><path d="M12 6.5v9l8-4.5z" fill="#fff" /></svg>
                    Watch Now
                  </a>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating 1:1 Personalised Teaching Notification Pill */}
      <OneOnOnePromoBanner variant="floating" />

    </div>
  );
}
