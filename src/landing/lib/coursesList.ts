import { supabase } from '@/landing/lib/supabase';
import type { CourseCardData } from '@/landing/components/CourseCard';

/** Card/list fields only — skip cohort text, learn, outcomes, pricing JSON. */
const COURSE_LIST_COLUMNS = [
  'id',
  'name',
  'description',
  'subject',
  'price',
  'discountPrice',
  'isPinned',
  'isBundle',
  'bundleCourses',
  'tags',
  'startDate',
  'courseCategory',
  'term',
  'exam_stages',
  'active',
].join(',');

export const DEFAULT_EXAM_VISIBILITY: Record<string, string[]> = {
  Qualifier: ['Qualifier'],
  'Re-attempt': ['Re-attempt'],
  Foundation: ['Quiz 1', 'Quiz 2', 'End Term', 'Full Term'],
  DIPLOMA: ['Quiz 1', 'Quiz 2', 'End Term', 'Full Term'],
};

export type CoursesCatalog = {
  courses: CourseCardData[];
  examVisibility: Record<string, string[]>;
};

type CachedCatalog = CoursesCatalog & { fetchedAt: number };

const CACHE_TTL_MS = 60_000;
let cache: CachedCatalog | null = null;
let inflight: Promise<CoursesCatalog> | null = null;

function parseExamVisibility(raw: unknown): Record<string, string[]> {
  if (!raw) return { ...DEFAULT_EXAM_VISIBILITY };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...DEFAULT_EXAM_VISIBILITY, ...(parsed || {}) };
  } catch {
    return { ...DEFAULT_EXAM_VISIBILITY };
  }
}

export function getCachedCoursesCatalog(): CoursesCatalog | null {
  if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null;
  return cache;
}

export async function loadCoursesCatalog(): Promise<CoursesCatalog> {
  const fresh = getCachedCoursesCatalog();
  if (fresh) return fresh;
  if (inflight) return inflight;

  inflight = (async () => {
    const [{ data: coursesData, error: coursesError }, { data: visData }] = await Promise.all([
      supabase
        .from('courses')
        .select(COURSE_LIST_COLUMNS)
        .or('active.is.null,active.eq.true')
        .order('isPinned', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('settings').select('value').eq('key', 'exam_visibility').maybeSingle(),
    ]);

    if (coursesError) throw coursesError;

    const catalog: CachedCatalog = {
      courses: (coursesData || []) as unknown as CourseCardData[],
      examVisibility: parseExamVisibility(visData?.value),
      fetchedAt: Date.now(),
    };
    cache = catalog;
    return catalog;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
