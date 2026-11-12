import { supabase } from '@/landing/lib/supabase';

export interface CourseFaq {
  id: string;
  question: string;
  answer: string;
}

/** Key in the `settings` table (value is a JSON array of CourseFaq). */
export const COURSE_FAQS_KEY = 'course_faqs';

export const DEFAULT_COURSE_FAQS: CourseFaq[] = [
  {
    id: 'faq-access',
    question: 'How long do I get access to the course?',
    answer: 'Your access is valid until the end of the term, which is typically around 3 months if you join at the start of the term.',
  },
  {
    id: 'faq-live-recorded',
    question: 'Are the classes live or recorded?',
    answer: 'It depends on the batch you pick. Live batches have daily live classes with all lecture recordings available later, and recorded batches let you learn at your own pace.',
  },
  {
    id: 'faq-language',
    question: 'In which language are the classes taught?',
    answer: 'All classes are taught in Hinglish, so concepts are easy to follow.',
  },
  {
    id: 'faq-start',
    question: 'How do I start learning after I enroll?',
    answer: 'Right after your payment is verified, your course is unlocked on the student dashboard. Sign in with the same email you used at checkout.',
  },
  {
    id: 'faq-doubts',
    question: 'Who teaches the course and how do I clear doubts?',
    answer: 'Courses are taught by seniors from the IIT Madras BS degree. You can clear doubts in the weekly live doubt sessions and through our community.',
  },
];

export function parseCourseFaqs(raw: unknown): CourseFaq[] | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((f) => f && typeof f.question === 'string' && typeof f.answer === 'string')
      .map((f, i) => ({ id: String(f.id || `faq-${i}`), question: f.question, answer: f.answer }));
  } catch {
    return null;
  }
}

/** Returns the manager-edited FAQs, or the defaults if none were saved yet. */
export async function fetchCourseFaqs(): Promise<CourseFaq[]> {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', COURSE_FAQS_KEY).maybeSingle();
    return parseCourseFaqs(data?.value) ?? DEFAULT_COURSE_FAQS;
  } catch {
    return DEFAULT_COURSE_FAQS;
  }
}

export async function saveCourseFaqs(faqs: CourseFaq[]) {
  return supabase.from('settings').upsert({ key: COURSE_FAQS_KEY, value: JSON.stringify(faqs) });
}

/** Key in the `settings` table for the "how to use" video shown beside the FAQs (YouTube link). */
export const HOWTO_VIDEO_KEY = 'course_howto_video_url';

export async function fetchHowToVideoUrl(): Promise<string> {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', HOWTO_VIDEO_KEY).maybeSingle();
    return typeof data?.value === 'string' ? data.value.trim() : '';
  } catch {
    return '';
  }
}
