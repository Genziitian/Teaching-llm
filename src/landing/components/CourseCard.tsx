'use client';
import { useState } from 'react';
import { Check, Share2, Star } from 'lucide-react';
import { Link, useNavigate } from '@/landing/shims/router';

export type CourseCardData = {
  id: string;
  name: string;
  description?: string;
  subject?: string;
  price: number;
  discountPrice?: number | null;
  isPinned?: boolean;
  isBundle?: boolean;
  bundleCourses?: { courseId: string; courseName: string }[];
  tags?: string[];
  startDate?: string;
  courseCategory?: 'QUALIFIER' | 'LIVE' | 'RECORDED' | 'NONE';
  term?: 'Re-attempt' | 'Foundation' | 'DIPLOMA' | 'Qualifier' | null;
  exam_stages?: string[];
};

type CourseCardProps = {
  course: CourseCardData;
  className?: string;
};

const TERM_STYLE: Record<string, { label: string; cls: string }> = {
  Qualifier: { label: 'Qualifier', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  Foundation: { label: 'Foundation', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  DIPLOMA: { label: 'Diploma', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Re-attempt': { label: 'Qualifier Re-attempt', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const TAG_STYLE = (tag: string) => {
  switch (tag.toUpperCase()) {
    case 'SALE': return 'bg-red-500';
    case 'NEW': return 'bg-green-500';
    case 'BESTSELLER': return 'bg-amber-500';
    case 'TRENDING': return 'bg-blue-600';
    case 'HOT': return 'bg-orange-500';
    case 'LIMITED': return 'bg-pink-600';
    default: return 'bg-purple-500';
  }
};

const MAX_CHIPS = 4;

export default function CourseCard({ course, className = '' }: CourseCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const shareCourse = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const url = `${window.location.origin}/courses/${course.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: course.name, text: `Check out ${course.name} on GenZ IITian`, url });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  const displayPrice = course.discountPrice || course.price;
  const termInfo = course.term ? TERM_STYLE[course.term] : null;
  // "Category" is what the manager types in the course editor (stored in `subject`)
  const category = course.subject?.trim();
  const chips: string[] = course.isBundle
    ? (course.bundleCourses || []).map(b => b.courseName).filter(Boolean)
    : [];
  const shownChips = chips.slice(0, MAX_CHIPS);
  const extraChips = chips.length - shownChips.length;

  return (
    <div
      onClick={() => navigate(`/explore/courses/${course.id}`)}
      className={`group relative bg-white border border-slate-200 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 hover:border-slate-300 transition-all duration-300 flex flex-col cursor-pointer ${
        course.isPinned ? 'ring-2 ring-blue-500/30' : ''
      } ${className}`}
    >
      <div className="p-5 md:p-6 flex-grow flex flex-col">
        {/* Meta row: term + category on the left, small marketing tags on the right */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {termInfo && (
              <span className={`px-2.5 py-1 rounded-md border text-[11px] font-bold uppercase tracking-wide ${termInfo.cls}`}>
                {termInfo.label}
              </span>
            )}
            {category && (
              <span className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                {category}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
          {course.tags && course.tags.length > 0 && (
            <div className="flex gap-1">
              {course.tags.slice(0, 2).map((tag, idx) => (
                <span
                  key={`${tag}-${idx}`}
                  className={`${TAG_STYLE(tag)} text-white font-bold px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase leading-none`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
            <button
              type="button"
              onClick={shareCourse}
              aria-label={copied ? 'Link copied' : `Share ${course.name}`}
              title={copied ? 'Link copied' : 'Share'}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 active:scale-90 transition-all cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <h3 className="text-xl font-extrabold text-[#0b1120] mb-2 leading-snug group-hover:text-blue-600 transition-colors">
          {course.name}
        </h3>

        {course.description && (
          <p className="text-slate-500 font-medium text-sm mb-4 line-clamp-2">{course.description}</p>
        )}

        {shownChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {shownChips.map((name, idx) => (
              <span key={`${name}-${idx}`} className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                {name}
              </span>
            ))}
            {extraChips > 0 && (
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[11px] font-bold text-slate-500">
                +{extraChips} more
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-slate-100">
          <div className="flex items-end justify-between gap-3 mb-4">
            <div className="flex flex-col gap-1 min-w-0">
              {course.startDate && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Starts {new Date(course.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Language: Hinglish</div>
              <div className="flex items-center gap-1">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, idx) => (
                    <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <span className="text-slate-500 font-semibold text-xs ml-0.5">(4.9)</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">From</div>
              <div className="flex flex-col items-end leading-none">
                <span className="text-2xl font-black text-[#0b1120]">₹{displayPrice}</span>
                {course.discountPrice && (
                  <span className="text-xs font-bold text-slate-400 line-through mt-1">₹{course.price}</span>
                )}
              </div>
            </div>
          </div>

          {/* One row: small Details, bigger Enroll Now */}
          <div className="flex items-center gap-2">
            <Link
              to={`/explore/courses/${course.id}`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 px-4 py-2.5 bg-white text-slate-700 rounded-xl font-bold text-center text-sm border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              Details
            </Link>
            <Link
              to={`/checkout/${course.id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 py-3 bg-[#0b1120] text-white rounded-xl hover:bg-blue-600 transition-colors font-extrabold text-sm md:text-base active:scale-[0.98] flex items-center justify-center"
            >
              Enroll Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
