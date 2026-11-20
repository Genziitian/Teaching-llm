'use client';
import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { DEFAULT_COURSE_REVIEWS, fetchCourseReviews, type CourseReview } from '@/landing/lib/courseReviews';

/** Student reviews that float left to right above the FAQs. Managed from the manager panel (Reviews tab). */
export default function CourseReviewsSection() {
  const [reviews, setReviews] = useState<CourseReview[]>(DEFAULT_COURSE_REVIEWS);

  useEffect(() => {
    let alive = true;
    fetchCourseReviews().then((r) => { if (alive) setReviews(r); });
    return () => { alive = false; };
  }, []);

  // Repeat short lists so the strip is always wider than the screen, then double it for a seamless loop
  const track = useMemo(() => {
    if (reviews.length === 0) return [];
    const base: CourseReview[] = [];
    while (base.length < 6) base.push(...reviews);
    return [...base, ...base];
  }, [reviews]);

  if (reviews.length === 0) return null;

  return (
    <section className="bg-white pt-14 pb-6 overflow-hidden">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-center text-xl md:text-2xl font-semibold tracking-tight text-[#0b1120]">What students say</h2>
        <p className="mt-1.5 mb-7 text-center text-sm text-gray-500">Real experiences from our learners.</p>
      </div>
      <div className="reviews-marquee-wrap overflow-hidden">
        <div className="reviews-marquee flex w-max gap-6">
          {track.map((r, i) => (
            <figure key={`${r.id}-${i}`} className="flex w-[280px] md:w-[320px] shrink-0 flex-col rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex gap-0.5 text-amber-400" aria-label={`${r.stars} out of 5 stars`}>
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className={`h-4 w-4 ${j < r.stars ? 'fill-current' : 'text-gray-200'}`} />
                ))}
              </div>
              <blockquote className="mt-3 flex-grow text-sm leading-relaxed text-gray-600">&ldquo;{r.comment}&rdquo;</blockquote>
              <figcaption className="mt-4 border-t border-gray-100 pt-3">
                <div className="text-sm font-semibold text-[#0b1120]">{r.name}</div>
                {r.term && <div className="text-xs text-gray-500">{r.term}</div>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
