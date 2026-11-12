'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import ShareCourseButton from '@/landing/components/course/ShareCourseButton';
import { Link } from '@/landing/shims/router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Calendar,
  Languages,
  Share2,
  Star,
  X,
  LayoutDashboard,
  BookOpen,
  MessageCircle,
  ClipboardList,
  Video,
  LineChart,
} from 'lucide-react';
import { getCheckoutPath } from '@/landing/utils/courseRouting';
import { getYouTubeId } from '@/landing/utils/youtube';
import StickyEnrollBanner from '@/landing/components/StickyEnrollBanner';
import {
  batchFeaturesFor,
  faqFor,
  includedPointsFor,
  type FeedbackNote,
} from '@/landing/data/coursePage';

function formatCourseDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function textLines(value?: string | null) {
  if (!value) return [];
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function subjectsFor(course: any): string[] {
  if (course.isBundle && Array.isArray(course.bundleCourses) && course.bundleCourses.length > 0) {
    return course.bundleCourses
      .map((item: any) => item.courseName)
      .filter((name: string) => Boolean(name));
  }

  const tags: string[] = Array.isArray(course.tags) ? course.tags : [];
  const has = (label: string) => tags.some((tag) => tag.toLowerCase() === label);
  const term1 = has('term 1');
  const term2 = has('term 2');
  if (course.term === 'Foundation' || term1 || term2) {
    const first = ['Mathematics 1', 'Statistics 1', 'English 1', 'Computational Thinking'];
    const second = ['Mathematics 2', 'Statistics 2', 'English 2', 'Programming in Python'];
    if (term1 && term2) return [...first, ...second];
    if (term2) return second;
    if (term1) return first;
  }

  return course.subject ? [course.subject] : [];
}

const PORTAL = [
  {
    title: 'Class replays',
    detail: 'The session stays available so you can watch it again while revising.',
    icon: Video,
    tint: 'bg-sky-50 text-sky-700',
  },
  {
    title: 'Notes and sheets',
    detail: 'Class notes and practice files sit with the lesson, not in a separate drive.',
    icon: BookOpen,
    tint: 'bg-violet-50 text-violet-700',
  },
  {
    title: 'Your dashboard',
    detail: 'Timetable, class links, and the batch you bought are on one login.',
    icon: LayoutDashboard,
    tint: 'bg-emerald-50 text-emerald-700',
  },
  {
    title: 'What you finished',
    detail: 'See which classes and practice sets are still open.',
    icon: LineChart,
    tint: 'bg-amber-50 text-amber-700',
  },
  {
    title: 'Doubt desk',
    detail: 'Subject questions go to a mentor hour instead of a public comment pile.',
    icon: MessageCircle,
    tint: 'bg-rose-50 text-rose-700',
  },
  {
    title: 'Weekly tasks',
    detail: 'Track what needs to be solved before the next class.',
    icon: ClipboardList,
    tint: 'bg-indigo-50 text-indigo-700',
  },
];

export interface CourseDetailModernProps {
  course: any;
  reviews: FeedbackNote[];
  videoUrl: string;
}

export default function CourseDetailModern({
  course,
  reviews,
  videoUrl,
}: CourseDetailModernProps) {
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState('features');
  const [copied, setCopied] = useState(false);
  const enrollRef = useRef<HTMLAnchorElement>(null);

  const sectionIds = ['features', 'subjects', 'about', 'details', 'schedule', 'desk', 'access', 'notes', 'questions'];

  useEffect(() => {
    const nodes = sectionIds
      .map((sectionId) => document.getElementById(sectionId))
      .filter((node): node is HTMLElement => Boolean(node));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveTab(visible.target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.15, 0.4] }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [course]);

  const salePrice = Number(course.discountPrice || course.price || 0);
  const listPrice = Number(course.price || 0);
  const hasDiscount = Boolean(course.discountPrice) && listPrice > salePrice;
  const saved = hasDiscount ? listPrice - salePrice : 0;
  const offPercent = hasDiscount ? Math.round((saved / listPrice) * 100) : 0;
  const checkoutPath = getCheckoutPath({ id: String(course.id), name: course.name });
  const features = batchFeaturesFor(course);
  const subjects = subjectsFor(course);
  const customIncluded = textLines(course.cohortContent);
  const included = customIncluded.length > 0 ? customIncluded : includedPointsFor(course);
  const learn: string[] = Array.isArray(course.learn) ? course.learn.filter(Boolean) : [];
  const faqs = faqFor(course, formatCourseDate);
  const videoId = getYouTubeId(videoUrl);
  const tags: string[] = Array.isArray(course.tags) ? course.tags.filter((tag: string) => !['Term 1', 'Term 2', 'TERM 1', 'TERM 2'].includes(tag)) : [];
  const categoryLabel = course.courseCategory && course.courseCategory !== 'NONE'
    ? course.courseCategory.charAt(0) + course.courseCategory.slice(1).toLowerCase()
    : course.class_type === 'live' ? 'Live' : 'Recorded';

  const tabs = [
    { id: 'features', label: 'Features' },
    ...(subjects.length ? [{ id: 'subjects', label: 'Subjects' }] : []),
    { id: 'about', label: 'About' },
    { id: 'details', label: 'Details' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'desk', label: 'Dashboard' },
    { id: 'access', label: 'Class access' },
    ...(reviews.length ? [{ id: 'notes', label: 'Reviews' }] : []),
    { id: 'questions', label: 'FAQs' },
  ];

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: course.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* dismissed share sheet */
    }
  };

  const jump = (sectionId: string) => {
    setActiveTab(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-900 pb-28">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-3">
                <Link to="/explore/courses" className="hover:text-slate-900">Courses</Link>
                {course.subject && (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    <span>{course.subject}</span>
                  </>
                )}
                <ChevronRight className="w-3 h-3" />
                <span className="text-slate-700 truncate max-w-[14rem] sm:max-w-md">{course.name}</span>
              </nav>
              <h1 className="text-[1.65rem] sm:text-[2rem] leading-tight font-semibold tracking-tight text-slate-950">
                {course.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
                <span>For IIT Madras BS learners</span>
                {course.startDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Starts {formatCourseDate(course.startDate)}
                  </span>
                )}
                {course.endDate && (
                  <span>Ends {formatCourseDate(course.endDate)}</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  Rated 4.9/5
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                  <Languages className="w-3 h-3 text-slate-500" />
                  Hinglish
                </span>
                {tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded-full bg-amber-50 text-amber-800 px-2.5 py-1 text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={share}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
            >
              <Share2 className="w-3.5 h-3.5" />
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>
        <div className="sticky top-20 z-30 bg-white/95 backdrop-blur border-t border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-5 overflow-x-auto text-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => jump(tab.id)}
                className={`shrink-0 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-slate-900 text-slate-900 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <aside className="order-1 lg:order-2 lg:sticky lg:top-36">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {course.image && (
              <div className="aspect-[16/9] bg-slate-100">
                <img src={course.image} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[1.7rem] font-semibold tracking-tight">₹{salePrice}</span>
                    {hasDiscount && (
                      <span className="text-sm text-slate-400 line-through">₹{listPrice}</span>
                    )}
                  </div>
                  {hasDiscount && (
                    <p className="text-xs text-emerald-700 mt-0.5">You save ₹{saved}</p>
                  )}
                </div>
                {hasDiscount && (
                  <span className="rounded-md bg-emerald-600 text-white text-[11px] font-medium px-2 py-1">
                    {offPercent}% off
                  </span>
                )}
              </div>

              <dl className="mt-4 space-y-2.5 text-sm text-slate-600">
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-16 shrink-0">Batch</dt>
                  <dd>{categoryLabel}{course.subject ? ` · ${course.subject}` : ''}</dd>
                </div>
                {course.startDate && (
                  <div className="flex gap-2">
                    <dt className="text-slate-400 w-16 shrink-0">Starts</dt>
                    <dd>{formatCourseDate(course.startDate)}</dd>
                  </div>
                )}
                {course.endDate && (
                  <div className="flex gap-2">
                    <dt className="text-slate-400 w-16 shrink-0">Ends</dt>
                    <dd>{formatCourseDate(course.endDate)}</dd>
                  </div>
                )}
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-16 shrink-0">Language</dt>
                  <dd>Hinglish</dd>
                </div>
              </dl>

              <Link
                ref={enrollRef}
                to={checkoutPath}
                className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg bg-slate-950 text-white text-sm font-medium py-3 hover:bg-slate-800"
              >
                Continue enrollment <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to="/contact"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-medium py-2.5 hover:bg-slate-50"
              >
                <MessageCircle className="w-4 h-4" /> Contact Us
              </Link>
              <ShareCourseButton
                courseId={course.id}
                courseName={course.name}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-medium py-2.5 hover:bg-slate-50 cursor-pointer"
              />
              <p className="mt-2 text-center text-[11px] text-slate-400">
                Coupons are applied on the next step.
              </p>
            </div>
          </div>
        </aside>

        <div className="order-2 lg:order-1 space-y-4">
          <section id="features" className="scroll-mt-36 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-950">In this batch</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              {features.primary.map((feature) => (
                <div key={feature.title} className="rounded-xl border border-slate-200 px-3.5 py-3">
                  <div className="flex items-start gap-2.5">
                    <Star className="w-3.5 h-3.5 mt-0.5 text-amber-500 fill-amber-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{feature.title}</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{feature.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {moreOpen && (
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                {features.more.map((feature) => (
                  <div key={feature.title} className="rounded-xl border border-slate-200 px-3.5 py-3">
                    <p className="text-sm font-medium text-slate-900">{feature.title}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{feature.detail}</p>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              className="mt-3 w-full rounded-lg border border-slate-200 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              {moreOpen ? 'Show fewer' : 'More in this batch'}
            </button>
          </section>

          {subjects.length > 0 && (
            <section id="subjects" className="scroll-mt-36 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
              <h2 className="text-base font-semibold text-slate-950">Subjects in this batch</h2>
              <div className="mt-4 grid sm:grid-cols-2 gap-2.5">
                {subjects.map((subject) => (
                  <div key={subject} className="rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-800">
                    {subject}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section id="about" className="scroll-mt-36 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-950">About this batch</h2>
            {course.description && (
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{course.description}</p>
            )}
            <ul className="mt-4 space-y-2.5">
              {(course.startDate || course.endDate) && (
                <AboutRow>
                  Runs {course.startDate ? formatCourseDate(course.startDate) : 'on the posted timetable'}
                  {course.endDate ? ` to ${formatCourseDate(course.endDate)}` : ''}.
                </AboutRow>
              )}
              {course.startDate && <AboutRow>First class date: {formatCourseDate(course.startDate)}.</AboutRow>}
              <AboutRow>
                {course.endDate
                  ? `Dashboard access is listed through ${formatCourseDate(course.endDate)}.`
                  : 'Dashboard access stays with the batch through its exam window.'}
              </AboutRow>
              <AboutRow>
                {course.courseCategory === 'LIVE' || course.class_type === 'live'
                  ? 'Mode: online live classes, with the recording kept afterwards.'
                  : course.courseCategory === 'RECORDED' || course.class_type === 'recorded'
                    ? 'Mode: online recordings, plus a scheduled doubt hour.'
                    : 'Mode: online classes on the student dashboard.'}
              </AboutRow>
              <AboutRow>Language in class: Hinglish.</AboutRow>
              {course.who && <AboutRow>{course.who}</AboutRow>}
            </ul>
            {learn.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-900 mb-2">What the classes cover</p>
                <ul className="space-y-2">
                  {learn.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {course.courseCategory === 'QUALIFIER' && (
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(true)}
                className="mt-4 text-sm text-slate-900 underline underline-offset-4"
              >
                Offer terms for this qualifier batch
              </button>
            )}
          </section>

          <section id="details" className="scroll-mt-36 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-950">Included with enrollment</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {included.map((point) => (
                <li key={point} className="flex gap-2.5 py-3 text-sm text-slate-600 leading-relaxed">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{point.replace(/^[✅✓•\-]\s*/, '')}</span>
                </li>
              ))}
            </ul>
            {course.outcomes && (
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{course.outcomes}</p>
            )}
          </section>

          <section id="schedule" className="scroll-mt-36 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-950">Batch schedule</h2>
            {course.startDate || course.endDate ? (
              <dl className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                {course.startDate && (
                  <div className="rounded-xl bg-slate-50 px-3.5 py-3">
                    <dt className="text-xs text-slate-500">Starts</dt>
                    <dd className="mt-1 text-slate-900">{formatCourseDate(course.startDate)}</dd>
                  </div>
                )}
                {course.endDate && (
                  <div className="rounded-xl bg-slate-50 px-3.5 py-3">
                    <dt className="text-xs text-slate-500">Ends</dt>
                    <dd className="mt-1 text-slate-900">{formatCourseDate(course.endDate)}</dd>
                  </div>
                )}
              </dl>
            ) : null}
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              The day-wise class list is shared on the dashboard after enrollment.
            </p>
          </section>

          <section id="desk" className="scroll-mt-36 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-950">On your dashboard</h2>
            <p className="mt-1 text-sm text-slate-500">class.genziitian.in, after this batch is on your account.</p>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              {PORTAL.map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 p-3.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.tint}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <p className="mt-2.5 text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="access" className="scroll-mt-36 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-950">How to use this batch</h2>
            <p className="mt-1 text-sm text-slate-500">Join a class, open notes, and find the tools after you enroll.</p>
            {videoId ? (
              <div className="mt-4 aspect-video rounded-xl overflow-hidden bg-slate-950">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title="How to use your Gen-Z IITian batch"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <p className="text-sm text-slate-600">The walkthrough plays here once a YouTube link is added for this course.</p>
                <a
                  href="https://class.genziitian.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-sm text-slate-900 underline underline-offset-4"
                >
                  Open the class dashboard
                </a>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">
              If a class link does not open, write to{' '}
              <a href="mailto:help@genziitian.in" className="text-slate-800 underline underline-offset-2">help@genziitian.in</a>.
            </p>
          </section>

          {reviews.length > 0 && (
            <section id="notes" className="scroll-mt-36 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
              <h2 className="text-base font-semibold text-slate-950">From students in similar batches</h2>
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                {reviews.map((review) => (
                  <figure key={review.id} className="rounded-xl border border-slate-200 p-3.5">
                    <div className="flex gap-0.5 text-amber-400">
                      {Array.from({ length: review.rating || 5 }).map((_, index) => (
                        <Star key={index} className="w-3 h-3 fill-current" />
                      ))}
                    </div>
                    <blockquote className="mt-2 text-sm text-slate-700 leading-relaxed">“{review.text}”</blockquote>
                    <figcaption className="mt-3 text-xs text-slate-500">
                      <span className="text-slate-800 font-medium">{review.name}</span>
                      <span> · {review.role}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          <section id="questions" className="scroll-mt-36 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-950">Common questions</h2>
            <div className="mt-2 divide-y divide-slate-100">
              {faqs.map((item, index) => {
                const open = openFaq === index;
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : index)}
                      className="w-full flex items-center justify-between gap-4 py-3.5 text-left text-sm text-slate-800"
                    >
                      {item.q}
                      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && <p className="pb-3.5 text-sm text-slate-500 leading-relaxed">{item.a}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {isTermsModalOpen && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTermsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/50"
            />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="relative bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl"
            >
              <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
                <div>
                  <p className="text-xs text-slate-500">Qualifier batch</p>
                  <h2 className="text-lg font-semibold text-slate-950">Offer terms</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-4 space-y-3 text-sm text-slate-600 leading-relaxed">
                <p>
                  Students who enroll in the qualifier champion batch can be considered for a full refund or a free reattempt, if every condition below is met.
                </p>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-1">What you need to do</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Attend at least 80% of the live classes.</li>
                    <li>Score the minimum required marks in the weekly tests held on topics taught in class.</li>
                    <li>Share graded-assignment marks with the team, and be eligible to sit the qualifier exam offline.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-1">What the batch includes</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Subject support for the qualifier window</li>
                    <li>Live classes and the study files for those classes</li>
                    <li>Weekly practice and a look at how you did</li>
                    <li>Mentor time, including a 1:1 on how to plan the attempt</li>
                  </ul>
                </div>
                <p>The batch holds up its side when attendance, weekly tests, and steady work are in place.</p>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(false)}
                  className="rounded-lg bg-slate-950 text-white text-sm px-4 py-2"
                >
                  Close
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

function AboutRow({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm text-slate-600 leading-relaxed">
      <Star className="w-3.5 h-3.5 mt-0.5 text-amber-500 fill-amber-400 shrink-0" />
      <span>{children}</span>
    </li>
  );
}
