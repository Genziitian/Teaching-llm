'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { DEFAULT_COURSE_FAQS, fetchCourseFaqs, fetchHowToVideoUrl, type CourseFaq } from '@/landing/lib/courseFaqs';
import { getYouTubeId } from '@/landing/utils/youtube';

/**
 * Common FAQs shown at the bottom of every course page, with a "how to use" video beside them.
 * FAQs: manager panel > FAQs tab. Video link: manager panel > Settings.
 */
export default function CourseFaqSection() {
  const [faqs, setFaqs] = useState<CourseFaq[]>(DEFAULT_COURSE_FAQS);
  const [videoUrl, setVideoUrl] = useState('');
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    let alive = true;
    fetchCourseFaqs().then((f) => { if (alive) setFaqs(f); });
    fetchHowToVideoUrl().then((u) => { if (alive) setVideoUrl(u); });
    return () => { alive = false; };
  }, []);

  const videoId = getYouTubeId(videoUrl);

  if (faqs.length === 0 && !videoId) return null;

  return (
    <section className="bg-white px-4 pb-28 pt-4 md:pb-24">
      <div className={`mx-auto ${videoId && faqs.length > 0 ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <div className={videoId && faqs.length > 0 ? 'grid items-start gap-8 lg:grid-cols-2 lg:gap-12' : ''}>
          {faqs.length > 0 && (
            <div>
              <h2 className={`text-xl md:text-2xl font-semibold tracking-tight text-[#0b1120] ${videoId ? 'text-left' : 'text-center'}`}>Frequently asked questions</h2>
              <p className={`mt-1.5 mb-6 text-sm text-gray-500 ${videoId ? 'text-left' : 'text-center'}`}>Quick answers about our courses.</p>
              <div className="flex flex-col gap-2.5">
                {faqs.map((f, i) => {
                  const isOpen = open === i;
                  return (
                    <div key={f.id} className={`rounded-2xl border bg-white transition-colors ${isOpen ? 'border-gray-300' : 'border-gray-200'}`}>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left cursor-pointer"
                      >
                        <span className="text-[15px] font-medium text-[#0b1120]">{f.question}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                            className="overflow-hidden"
                          >
                            <p className="px-4 pb-4 text-sm leading-relaxed text-gray-500">{f.answer}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {videoId && (
            <div className={faqs.length > 0 ? 'lg:sticky lg:top-24' : ''}>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-[#0b1120]">How to use GenZ IITian</h2>
              <p className="mt-1.5 mb-6 text-sm text-gray-500">A quick walkthrough of your learning dashboard.</p>
              <div className="aspect-video overflow-hidden rounded-2xl border border-gray-200 bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                  title="How to use GenZ IITian"
                  loading="lazy"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
