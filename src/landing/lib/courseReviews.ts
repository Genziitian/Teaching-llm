import { supabase } from '@/landing/lib/supabase';

export interface CourseReview {
  id: string;
  name: string;
  /** Term or programme, e.g. "Qualifier" or "Foundation" */
  term: string;
  stars: number;
  comment: string;
}

/** Key in the `settings` table (value is a JSON array of CourseReview). */
export const COURSE_REVIEWS_KEY = 'course_reviews';

/** Shown until the manager saves their own list (taken from the existing home page reviews). */
export const DEFAULT_COURSE_REVIEWS: CourseReview[] = [
  {
    "id": "rev-1",
    "name": "Aryan Sharma",
    "term": "Qualifier Student",
    "stars": 5,
    "comment": "The reattempt batch was a game changer. The mock tests were exactly like the real exam pattern and helped me clear comfortably!"
  },
  {
    "id": "rev-2",
    "name": "Priya Patel",
    "term": "Maths 2 Student",
    "stars": 5,
    "comment": "Maths 2 concepts were tough, but the Foundation course simplified everything. The doubt sessions helped a lot."
  },
  {
    "id": "rev-3",
    "name": "Rohan Das",
    "term": "Diploma Student",
    "stars": 5,
    "comment": "I am pursuing the Diploma now, and Gen-z IITian has been with me since day 1. Best notes and community."
  },
  {
    "id": "rev-4",
    "name": "Sanya Verma",
    "term": "Foundation Student",
    "stars": 5,
    "comment": "Affordable and high quality. The structure of the Foundation course is perfect for beginners like me."
  },
  {
    "id": "rev-5",
    "name": "Vikram Singh",
    "term": "Maths 2 Student",
    "stars": 5,
    "comment": "The instructors explain everything so clearly. My GPA improved significantly after joining."
  },
  {
    "id": "rev-6",
    "name": "Meera Iyer",
    "term": "Diploma Student",
    "stars": 5,
    "comment": "Highly recommended for anyone looking for serious prep. The community is very supportive."
  }
];

export function parseCourseReviews(raw: unknown): CourseReview[] | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((r) => r && typeof r.name === 'string' && typeof r.comment === 'string')
      .map((r, i) => ({
        id: String(r.id || `rev-${i}`),
        name: r.name,
        term: typeof r.term === 'string' ? r.term : '',
        stars: Math.min(5, Math.max(1, Math.round(Number(r.stars) || 5))),
        comment: r.comment,
      }));
  } catch {
    return null;
  }
}

/** Returns the manager-edited reviews, or the defaults if none were saved yet. */
export async function fetchCourseReviews(): Promise<CourseReview[]> {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', COURSE_REVIEWS_KEY).maybeSingle();
    return parseCourseReviews(data?.value) ?? DEFAULT_COURSE_REVIEWS;
  } catch {
    return DEFAULT_COURSE_REVIEWS;
  }
}

export async function saveCourseReviews(reviews: CourseReview[]) {
  return supabase.from('settings').upsert({ key: COURSE_REVIEWS_KEY, value: JSON.stringify(reviews) });
}
