'use client';
import React, { useRef, useState } from 'react';
import ShareCourseButton from '@/landing/components/course/ShareCourseButton';
import { Link, useNavigate } from '@/landing/shims/router';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, 
  BookOpen, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  Star, 
  ArrowLeft, 
  Calendar, 
  Layers, 
  Languages, 
  MessageCircle, 
  X 
} from 'lucide-react';
import { getCheckoutPath } from '@/landing/utils/courseRouting';
import StickyEnrollBanner from '@/landing/components/StickyEnrollBanner';

function formatCourseDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export interface CourseDetailClassicProps {
  course: any;
}

export default function CourseDetailClassic({ course }: CourseDetailClassicProps) {
  const navigate = useNavigate();
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [cohortExpanded, setCohortExpanded] = useState(false);
  const enrollRef = useRef<HTMLAnchorElement>(null);

  const salePrice = Number(course.discountPrice || course.price || 0);
  const listPrice = Number(course.price || 0);
  const hasDiscount = Boolean(course.discountPrice) && listPrice > salePrice;
  const checkoutPath = getCheckoutPath({ id: String(course.id), name: course.name });

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-24">
      {/* Hero Header */}
      <div className="bg-[#0b1120] text-white pt-20 pb-8 px-4 md:pt-24 md:pb-12 md:px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2"></div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-16 items-center relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm md:text-base text-gray-400 hover:text-white font-medium mb-5 md:mb-8 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Courses
            </button>
            
            <div className="flex gap-2 mb-4 md:mb-6">
              {course.subject && (
                <span className="px-4 py-1 bg-yellow-400/20 text-yellow-400 border border-yellow-400/50 rounded-full text-xs font-semibold uppercase tracking-wider">
                  {course.subject}
                </span>
              )}
              {course.isBundle && (
                <span className="px-4 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/50 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-3 h-3" /> Bundle
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-3 md:mb-4 leading-tight">
              {course.name}
            </h1>
            
            <p className="text-sm md:text-base text-gray-400 font-medium mb-5 md:mb-8 leading-relaxed">
              {course.description}
            </p>

            <div className="flex flex-wrap gap-4 sm:gap-5 md:gap-12">
              <div className="flex items-center gap-2 md:gap-3">
                <Users className="w-5 h-5 md:w-7 md:h-7 text-[#10b981]" />
                <div className="leading-none">
                  <div className="text-lg md:text-xl font-semibold text-white">500+</div>
                  <div className="text-[10px] md:text-xs text-gray-400 font-semibold uppercase tracking-wide mt-1 md:mt-2">Students</div>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <Star className="w-5 h-5 md:w-7 md:h-7 text-yellow-400 fill-yellow-400" />
                <div className="leading-none">
                  <div className="text-lg md:text-xl font-semibold text-white">4.9</div>
                  <div className="text-[10px] md:text-xs text-gray-400 font-semibold uppercase tracking-wide mt-1 md:mt-2">Rating</div>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <Award className="w-5 h-5 md:w-7 md:h-7 text-blue-400" />
                <div className="leading-none">
                  <div className="text-lg md:text-xl font-semibold text-white">95%</div>
                  <div className="text-[10px] md:text-xs text-gray-400 font-semibold uppercase tracking-wide mt-1 md:mt-2">Success</div>
                </div>
              </div>
            </div>

            <div className="mt-6 md:mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#0b1120] rounded-xl font-semibold text-sm hover:bg-gray-100 transition-all shadow-sm"
              >
                <MessageCircle className="w-4 h-4" /> Contact Us
              </Link>
              <ShareCourseButton
                courseId={course.id}
                courseName={course.name}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl font-semibold text-sm hover:bg-white/20 transition-all cursor-pointer"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative lg:block"
          >
            <div className="bg-white border-[3px] md:border border-gray-200 rounded-2xl md:rounded-2xl p-4 md:p-6 shadow-sm  text-[#0b1120] relative">
              <div className="absolute -top-4 right-4 bg-red-500 text-white font-semibold px-3 py-1 rounded-lg text-xs tracking-wide uppercase z-10">
                SALE IS LIVE!
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                Special Offer Price
              </div>
              <div className="flex items-baseline gap-3 md:gap-4 mb-4 md:mb-6">
                <div className="text-2xl md:text-3xl font-semibold">₹{course.discountPrice || course.price}</div>
                {course.discountPrice && (
                  <div className="text-base md:text-lg font-semibold text-gray-400 line-through">₹{course.price}</div>
                )}
              </div>
              
              <div className="space-y-2.5 mb-5 md:mb-8">
                <div className="font-semibold text-gray-400 text-sm uppercase tracking-wide border-b-2 border-gray-100 pb-2">Includes</div>
                <div className="flex items-center gap-3 font-medium text-gray-600 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-green-500" /> Access till End Term
                </div>
                <div className="flex items-center gap-3 font-medium text-gray-600 text-sm">
                  <Languages className="w-5 h-5 text-purple-500" /> Language: Hinglish
                </div>
                {(() => {
                  const raw = String(course.class_type || (['LIVE', 'RECORDED'].includes(course.courseCategory) ? course.courseCategory : '')).toLowerCase();
                  const classType = raw === 'live' ? 'Live' : raw === 'recorded' ? 'Recorded' : '';
                  const hasCategory = course.courseCategory && course.courseCategory !== 'NONE';
                  if (!classType && !hasCategory) return null;
                  return (
                    <div className="flex items-center gap-3 font-medium text-gray-600 text-sm">
                      <Layers className="w-5 h-5 text-blue-500" />
                      {classType ? <span>Class type: <span className="font-semibold">{classType}</span></span> : <span className="font-semibold">{course.courseCategory}</span>}
                    </div>
                  );
                })()}
                {course.startDate && (
                  <div className="flex items-center gap-3 font-medium text-gray-600 text-sm">
                    <Calendar className="w-5 h-5 text-blue-500" /> Class starting from: {formatCourseDate(course.startDate)}
                  </div>
                )}
                {course.endDate && (
                  <div className="flex items-center gap-3 font-medium text-gray-600 text-sm">
                    <Calendar className="w-5 h-5 text-red-500" /> Class ends on: {formatCourseDate(course.endDate)}
                  </div>
                )}
              </div>

              <div>
                <Link
                  ref={enrollRef}
                  to={checkoutPath}
                  className="w-full py-3 md:py-3.5 bg-[#0b1120] text-white rounded-2xl font-semibold text-sm md:text-base hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-sm active:translate-y-1 text-center"
                >
                  Enroll Now <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Course Content */}
      <section className="py-6 px-4 md:py-16 md:px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-12">
        <div className="lg:col-span-2 space-y-6 md:space-y-12">
          {/* Bundle Content */}
          {course.isBundle && course.bundleCourses?.length > 0 && (
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-[#0b1120] mb-5 md:mb-8 flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 border border-gray-200">
                  <Layers className="w-6 h-6" />
                </div>
                Included in this Bundle
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {course.bundleCourses.map((bc: any, idx: number) => (
                  <div key={idx} className="p-3 bg-white border border-gray-200 rounded-xl font-medium flex items-center gap-2 shadow-sm text-sm">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="line-clamp-2">{bc.courseName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Who is this for? */}
          {course.who && (
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-[#0b1120] mb-4 md:mb-6 flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 border border-gray-200">
                  <Users className="w-6 h-6" />
                </div>
                Who is this for?
              </h2>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 md:p-5 md:p-5 text-sm md:text-base font-medium text-gray-600 leading-relaxed shadow-sm">
                {course.who}
              </div>
            </div>
          )}

          {/* What you'll learn */}
          {course.learn?.length > 0 && (
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-[#0b1120] mb-5 md:mb-8 flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 border border-gray-200">
                  <BookOpen className="w-6 h-6" />
                </div>
                What you'll learn
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-4">
                {course.learn.map((item: string) => (
                  <div key={item} className="p-3 md:p-5 bg-white border border-gray-200 rounded-2xl text-[13px] md:text-base font-medium flex items-start gap-3 md:gap-4 shadow-sm">
                    <CheckCircle2 className="w-6 h-6 text-blue-600 mt-0.5 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {course.cohortContent && (
            <div>
              <div className="text-center mb-5 md:mb-8">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-[#0b1120] mb-2 md:mb-3 leading-tight">What You Get in the Cohort</h2>
                <p className="text-sm md:text-base font-medium text-gray-500 max-w-3xl mx-auto">
                  Everything you need to master {course.name} with confidence.
                </p>
              </div>

              {(() => { const long = String(course.cohortContent).length > 350; return (
              <div className="relative bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 font-medium text-[#0b1120] leading-relaxed shadow-sm text-sm md:text-base">
                <div className={`whitespace-pre-wrap overflow-hidden transition-[max-height] duration-500 ease-in-out ${cohortExpanded || !long ? 'max-h-[3000px]' : 'max-h-64'}`}>
                  {course.cohortContent}
                </div>
                {long && !cohortExpanded && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-[3.75rem] h-20 bg-gradient-to-t from-white to-transparent" />
                )}
                {long && <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setCohortExpanded((v) => !v)}
                    aria-expanded={cohortExpanded}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full border border-gray-300 bg-white text-sm font-semibold text-[#0b1120] hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
                  >
                    {cohortExpanded ? 'Show less' : 'Show more'}
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${cohortExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>}
              </div>
              ); })()}
            </div>
          )}

          {/* Comparison Cards Section */}
          <div className="mt-8 md:mt-12 space-y-5 md:space-y-8">
            <div className="text-center">
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-[#0b1120] mb-2 md:mb-3">Compare Our Batches</h2>
              <p className="text-sm md:text-base font-medium text-gray-500 max-w-2xl mx-auto">
                Choose the perfect format that fits your learning style, schedule, and goals.
              </p>
            </div>

            <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-6 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pt-3 pb-3 md:pb-0 items-stretch [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Live Batch Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col justify-between relative group md:hover:-translate-y-1 transition-transform duration-200 snap-center shrink-0 w-[84%] sm:w-[58%] md:w-auto">
                <div>
                  <div className="inline-block px-3 py-1 bg-purple-100 text-purple-700 border border-gray-200 rounded-full text-xs font-semibold uppercase tracking-wider mb-3 md:mb-4">
                    Live Batch
                  </div>
                  <h3 className="text-base font-semibold text-[#0b1120] mb-4">Interactive Learning</h3>
                  
                  <ul className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <span>Daily live classes</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <span>Access to all lecture recordings</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <span>PYQ & GA live-solving sessions</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <span>Weekly live doubt-solving sessions</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <span>Live mentorship sessions</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <span>Full syllabus-focused preparation</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <span>Practice test discussions</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <span>Study anytime, anywhere</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-auto pt-4 border-t-2 border-dashed border-gray-100">
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3 text-center">
                    <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider block">
                      BEST FOR STANDALONE STUDENTS
                    </span>
                  </div>
                </div>
              </div>

              {/* Recorded Batch Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col justify-between relative group md:hover:-translate-y-1 transition-transform duration-200 snap-center shrink-0 w-[84%] sm:w-[58%] md:w-auto">
                <div>
                  <div className="inline-block px-3 py-1 bg-orange-100 text-orange-700 border border-gray-200 rounded-full text-xs font-semibold uppercase tracking-wider mb-4">
                    Recorded Batch
                  </div>
                  <h3 className="text-base font-semibold text-[#0b1120] mb-4">Self-Paced Study</h3>
                  
                  <ul className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <span>Access to all lecture recordings</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <span>PYQ & GA Recorded sessions</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <span>Weekly live doubt-solving sessions</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <span>Full syllabus-focused preparation</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <span>Practice test discussions</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <span>Study anytime, anywhere</span>
                    </li>
                  </ul>
                </div>
                
                <div className="mt-auto pt-4 border-t-2 border-dashed border-gray-100">
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-3 text-center">
                    <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wider block">
                      BEST FOR DUAL DEGREE & WORKING PROFESSIONALS
                    </span>
                  </div>
                </div>
              </div>

              {/* Qualifier Batch Card */}
              <div className="bg-[#f0fdfa] border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col justify-between relative group md:hover:-translate-y-1 transition-transform duration-200 snap-center shrink-0 w-[84%] sm:w-[58%] md:w-auto">
                <div className="absolute -top-3 right-4 bg-emerald-500 text-white font-semibold px-3 py-1 rounded-lg border border-gray-200 text-[10px] tracking-wide uppercase rotate-3 shadow-sm">
                  Risk Free
                </div>

                <div>
                  <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 border border-gray-200 rounded-full text-xs font-semibold uppercase tracking-wider mb-4">
                    CHAMPION Batch
                  </div>
                  <h3 className="text-base font-semibold text-[#0b1120] mb-2">Only for Qualifiers</h3>
                  <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide mb-4">Guaranteed Success</p>
                  
                  <ul className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Daily live classes</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Access to all lecture recordings</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>PYQ & GA live-solving sessions</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Weekly live doubt-solving sessions</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Full syllabus-focused preparation</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Practice test discussions & solutions</span>
                    </li>
                    <li className="flex items-start gap-2 text-[13px] md:text-sm font-medium text-gray-600 leading-snug">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Study anytime, anywhere</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm font-semibold text-blue-600">
                      <Star className="w-4 h-4 text-blue-500 fill-blue-500 shrink-0 mt-0.5" />
                      <span>Best Test series for free</span>
                    </li>
                  </ul>
                </div>
                
                <div className="mt-auto pt-4 border-t-2 border-dashed border-emerald-200">
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3 text-center mb-2">
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                      FULL REFUND IF NOT QUALIFIED
                    </span>
                  </div>
                  <button 
                    onClick={() => setIsTermsModalOpen(true)}
                    className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-800 underline decoration-2 cursor-pointer transition-colors block"
                  >
                    *Terms and conditions apply
                  </button>
                </div>
              </div>
            </div>
            <p className="md:hidden -mt-2 text-center text-xs text-gray-400">Swipe to compare batches</p>

            <div className="text-center">
              <Link to="/contact" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#0b1120] rounded-xl text-sm font-semibold border border-gray-300 hover:bg-gray-50 transition-colors">
                <MessageCircle className="w-4 h-4" /> Need help choosing? Contact Us
              </Link>
            </div>
          </div>

          {/* Learning Outcomes */}
          {course.outcomes && (
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-[#0b1120] mb-4 md:mb-6 flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 border border-gray-200">
                  <Award className="w-6 h-6" />
                </div>
                Outcomes
              </h2>
              <div className="bg-[#0b1120] text-white rounded-2xl p-4 md:p-5 md:p-5 lg:p-8 text-sm md:text-base font-medium leading-relaxed shadow-sm ">
                {course.outcomes}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar instructor info */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 space-y-4 md:space-y-6">
            {/* Dynamic Content Cards Based on Course Category */}
            {course.courseCategory === 'QUALIFIER' && (
              <>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-base font-semibold text-[#0b1120]">Qualifier Prep</h3>
                  </div>
                  <p className="text-sm font-medium text-gray-600 leading-relaxed">
                    Master the fundamentals with intensive qualifier-focused Content . Comprehensive coverage of all major topics with practice tests and doubt resolution.
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-base font-semibold text-[#0b1120]">What You Get</h3>
                  </div>
                  <ul className="text-sm font-medium text-gray-600 space-y-2">
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Complete qualifier Week 1- 4 syllabus coverage</span></li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Topic-wise mock tests and test series</span></li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>1-on-1 GUIDANCE</span></li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Daily live classes</span></li>
                  </ul>
                </div>
              </>
            )}
            
            {course.courseCategory === 'LIVE' && (
              <>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-base font-semibold text-[#0b1120]">Live Sessions</h3>
                  </div>
                  <p className="text-sm font-medium text-gray-600 leading-relaxed">
                    Interactive daily live classes with real-time Q&A. Connect directly with instructors and peers. Ask doubts instantly and get clarifications on the spot.
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-base font-semibold text-[#0b1120]">Live Features</h3>
                  </div>
                  <ul className="text-sm font-medium text-gray-600 space-y-2">
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Instant doubt solving in live class</span></li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>all lectures recordings available</span></li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>and more..</span></li>
                  </ul>
                </div>
              </>
            )}
            
            {course.courseCategory === 'RECORDED' && (
              <>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-base font-semibold text-[#0b1120]">Self-Paced Learning</h3>
                  </div>
                  <p className="text-sm font-medium text-gray-600 leading-relaxed">
                    Learn at your own pace with pre recorded video lessons. Rewatch, pause, and learn every concept without time pressure.
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-base font-semibold text-[#0b1120]">Recorded Benefits</h3>
                  </div>
                  <ul className="text-sm font-medium text-gray-600 space-y-2">
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>No time bound</span></li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Watch anytime, anywhere</span></li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>HD quality videos</span></li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Weekly live doubt session</span></li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Downloadable resources</span></li>
                  </ul>
                </div>
              </>
            )}

            <div className="bg-[#0b1120] text-white rounded-2xl p-5">
              <h3 className="text-base font-semibold mb-1">Have questions?</h3>
              <p className="text-sm text-gray-300 leading-relaxed mb-4">Not sure which batch fits you? Talk to our team and we will help you choose.</p>
              <Link to="/contact" className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-white text-[#0b1120] rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors">
                <MessageCircle className="w-4 h-4" /> Contact Us
              </Link>
            </div>

            {/* GENz IITian Card - Always Visible */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
              <h3 className="text-base font-semibold text-[#0b1120] mb-4 border-b border-gray-100 pb-3">GENz IITian</h3>
              <div className="mb-6">
                <div>
                  <div className="font-semibold text-[#0b1120]">Learn from IITM BS Seniors</div>
                  <div className="text-xs font-medium text-blue-600 uppercase">Real Guidance</div>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-500 leading-relaxed">
                No boring lectures - just real guidance from seniors who&apos;ve been through it. Understand concepts deeply, avoid common mistakes, and level up your prep the right way.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Terms & Conditions Modal */}
      <AnimatePresence>
        {isTermsModalOpen && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-6 text-[#0b1120]">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTermsModalOpen(false)}
              className="absolute inset-0 bg-[#0b1120]/70 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl p-6 md:p-5 relative shadow-sm overflow-hidden max-h-[85vh] flex flex-col z-10"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsTermsModalOpen(false)}
                className="absolute top-6 right-6 p-2 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all border border-gray-200 shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] z-20 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="border-b-4 border-[#0b1120] pb-4 mb-6 pr-12 text-left">
                <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 border border-gray-200 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
                  Official Policy
                </span>
                <h2 className="text-xl md:text-2xl font-semibold leading-tight text-[#0b1120]">
                  Qualifier Champion Batch <br />
                  <span className="text-[#3b82f6]">Terms & Conditions</span>
                </h2>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto space-y-4 pr-2 font-medium text-gray-700 leading-relaxed text-sm scrollbar-thin text-left">
                <p>
                  Students who enroll in the Qualifier Champion Batch and fulfil all the conditions below are eligible for a refund of the price difference between the Champion and Live batch, or free reattempt support.
                </p>

                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">Refund amount</div>
                  <div className="font-semibold text-[#0b1120]">Champion price − Live price</div>
                  <div className="mt-1 text-gray-600">Example: ₹1299 − ₹999 = <span className="font-semibold text-emerald-700">₹300 refunded</span></div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-[#0b1120] mt-4 mb-2">Eligibility Criteria</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>You must attend at least 75% of live classes.</li>
                    <li>You must attend the Qualifier exam, no matter what.</li>
                    <li>Weekly tests will be conducted based on the topics taught in class. You must score the minimum required marks in these tests.</li>
                    <li>You must regularly share your GA marks/progress with the team. and Be eligible for GIVING QUALIFIER exam offline</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-[#0b1120] mt-4 mb-2">What We Provide</h3>
                  <p className="mb-2">We are committed to giving you:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Complete academic support</li>
                    <li>Live classes and study resources</li>
                    <li>Weekly practice and evaluation</li>
                    <li>Premium guidance and mentorship</li>
                    <li>1-to-1 mentorship to help you choose the best strategy and action plan for your preparation</li>
                  </ul>
                </div>

                <p className="mt-4">
                  We will provide everything needed from our side. In return, we expect dedication, discipline, and focus from yours.
                </p>

                <p className="mt-4">
                  That’s all — maintain:
                </p>
                
                <ul className="list-disc pl-5 space-y-2">
                  <li>75% attendance</li>
                  <li>Attending the Qualifier exam</li>
                  <li>Weekly test qualification</li>
                  <li>Active participation and seriousness toward studies</li>
                </ul>

                <p className="mt-4 font-semibold text-[#0b1120]">
                  Thank you.
                </p>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 mt-6 border-t-2 border-gray-100 flex justify-end">
                <button
                  onClick={() => setIsTermsModalOpen(false)}
                  className="px-6 py-3 bg-[#0b1120] text-white rounded-xl font-semibold text-sm border border-gray-200 hover:bg-[#10b981] hover:border-[#10b981] transition-all shadow-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <StickyEnrollBanner
        courseName={course.name}
        price={salePrice}
        originalPrice={hasDiscount ? listPrice : null}
        href={checkoutPath}
        watchRef={enrollRef}
        watchKey={course.id}
        aboveMobileNav
      />
    </div>
  );
}
