// Per-course page content for the Storefront Courses manager: FAQs and the review/video
// settings of the course detail page. Reads/writes the storefront `settings` table through
// /api/storefront/db (sfDb). Formats match src/landing/lib/courseFaqs.ts and
// src/landing/data/coursePage.ts, which the public course page reads.
import { sfDb } from './CoursesDb'

/* ------------------------------------------------------------------ FAQs */

export interface CourseFaq {
  id: string
  question: string
  answer: string
}

/** Shared FAQs shown on every course page (managed on the FAQs tab). */
export const COURSE_FAQS_KEY = 'course_faqs'

/** Settings key holding one course's own FAQ list (same JSON format as COURSE_FAQS_KEY). */
export function courseFaqsKey(courseId: string) {
  return `${COURSE_FAQS_KEY}:${courseId}`
}

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
]

export function parseCourseFaqs(raw: unknown): CourseFaq[] | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed
      .filter((f: any) => f && typeof f.question === 'string' && typeof f.answer === 'string')
      .map((f: any, i: number) => ({ id: String(f.id || `faq-${i}`), question: f.question, answer: f.answer }))
  } catch {
    return null
  }
}

export type CourseFaqDraft = {
  /** FAQs from the FAQs tab (or the defaults when none were saved). */
  shared: CourseFaq[]
  /** true when this course has its own list instead of the shared one. */
  useCustom: boolean
  custom: CourseFaq[]
}

export const EMPTY_FAQ_DRAFT: CourseFaqDraft = { shared: DEFAULT_COURSE_FAQS, useCustom: false, custom: [] }

export async function loadCourseFaqDraft(courseId: string | null): Promise<{ draft: CourseFaqDraft; error: string | null }> {
  const keys = courseId ? [COURSE_FAQS_KEY, courseFaqsKey(courseId)] : [COURSE_FAQS_KEY]
  const { data, error } = await sfDb('settings', [{ m: 'select', a: ['key, value'] }, { m: 'in', a: ['key', keys] }])
  if (error) return { draft: EMPTY_FAQ_DRAFT, error: error.message }
  const rows: { key: string; value: string }[] = Array.isArray(data) ? data : []
  const shared = parseCourseFaqs(rows.find(r => r.key === COURSE_FAQS_KEY)?.value) ?? DEFAULT_COURSE_FAQS
  const custom = courseId ? parseCourseFaqs(rows.find(r => r.key === courseFaqsKey(courseId))?.value) : null
  return { draft: { shared, useCustom: custom !== null, custom: custom ?? [] }, error: null }
}

/** Trims rows and drops fully empty ones. Returns an error message for half-filled rows. */
export function cleanFaqs(faqs: CourseFaq[]): { faqs: CourseFaq[]; error: string | null } {
  const out: CourseFaq[] = []
  for (let i = 0; i < faqs.length; i++) {
    const question = faqs[i].question.trim()
    const answer = faqs[i].answer.trim()
    if (!question && !answer) continue
    if (!question || !answer) return { faqs: [], error: `FAQ ${i + 1} needs both a question and an answer.` }
    out.push({ id: faqs[i].id || `faq-${Date.now()}-${i}`, question, answer })
  }
  return { faqs: out, error: null }
}

/**
 * Saves (custom !== null) or clears (custom === null) a course's own FAQ list.
 * When the course ID changed, the list under the previous ID is removed.
 */
export async function saveCourseFaqsFor(courseId: string, custom: CourseFaq[] | null, prevId?: string | null): Promise<string | null> {
  if (custom) {
    const { error } = await sfDb('settings', [{ m: 'upsert', a: [{ key: courseFaqsKey(courseId), value: JSON.stringify(custom) }] }])
    if (error) return error.message
  } else {
    const { error } = await sfDb('settings', [{ m: 'delete', a: [] }, { m: 'eq', a: ['key', courseFaqsKey(courseId)] }])
    if (error) return error.message
  }
  if (prevId && prevId !== courseId) {
    const { error } = await sfDb('settings', [{ m: 'delete', a: [] }, { m: 'eq', a: ['key', courseFaqsKey(prevId)] }])
    if (error) return error.message
  }
  return null
}

/* ------------------------------------------------- Reviews / video / theme */

/** Settings key read by the course detail page (src/landing/data/coursePage.ts). */
export const COURSE_PAGE_SETTINGS_KEY = 'course_page_content'

export type CoursePageTheme = 'old' | 'new'

export type FeedbackNote = { id: string; name: string; role: string; text: string; rating?: number }

export const DEFAULT_FEEDBACK_BANK: FeedbackNote[] = [
  { id: 'aryan-sharma', name: 'Aryan Sharma', role: 'Qualifier batch', text: 'The mock pattern finally matched the real paper. I stopped guessing what to revise and just followed the weekly plan.', rating: 5 },
  { id: 'priya-patel', name: 'Priya Patel', role: 'Mathematics 2', text: 'Maths 2 used to feel scattered. The class order and the doubt hour after each topic made the hard weeks manageable.', rating: 5 },
  { id: 'rohan-das', name: 'Rohan Das', role: 'Diploma', text: 'I have stayed with Gen-Z IITian since the start of diploma. The notes are the part I actually reopen before a quiz.', rating: 5 },
  { id: 'sanya-verma', name: 'Sanya Verma', role: 'Foundation', text: 'I joined with almost no background. The batch is paced for beginners, and the practice sets tell you if you actually understood the class.', rating: 4 },
  { id: 'vikram-singh', name: 'Vikram Singh', role: 'Mathematics 2', text: 'The explanations stay on the concept, not on tricks. My quiz scores moved once I stopped skipping the practice discussion.', rating: 5 },
  { id: 'meera-iyer', name: 'Meera Iyer', role: 'Diploma', text: 'What helped was having one place for the recording, the notes, and someone to ask when a graded question did not match the lecture.', rating: 5 },
]

const DEFAULT_IDS = new Set(DEFAULT_FEEDBACK_BANK.map(n => n.id))
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)

function isFeedbackNote(v: unknown): v is FeedbackNote {
  return isObj(v) && !!v.id && !!v.name && !!v.role && !!v.text
}

function parseRaw(raw: unknown): Record<string, any> {
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    return isObj(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** Same merge as parseCoursePageSettings on the site: defaults (overridable) first, then extra notes. */
function bankFrom(obj: Record<string, any>): FeedbackNote[] {
  const stored: FeedbackNote[] = Array.isArray(obj.bank) ? obj.bank.filter(isFeedbackNote) : []
  const byId = new Map(DEFAULT_FEEDBACK_BANK.map(n => [n.id, n]))
  stored.forEach(n => byId.set(n.id, n))
  return [...DEFAULT_FEEDBACK_BANK.map(n => byId.get(n.id) || n), ...stored.filter(n => !DEFAULT_IDS.has(n.id))]
}

export type CoursePageDraft = {
  bank: FeedbackNote[]
  defaultVideoUrl: string
  videoUrl: string
  reviewIds: string[]
  theme: CoursePageTheme
}

export const EMPTY_PAGE_DRAFT: CoursePageDraft = {
  bank: DEFAULT_FEEDBACK_BANK,
  defaultVideoUrl: '',
  videoUrl: '',
  reviewIds: DEFAULT_FEEDBACK_BANK.slice(0, 3).map(n => n.id),
  theme: 'old',
}

async function readPageSettings(): Promise<{ obj: Record<string, any>; error: string | null }> {
  const { data, error } = await sfDb('settings', [
    { m: 'select', a: ['value'] },
    { m: 'eq', a: ['key', COURSE_PAGE_SETTINGS_KEY] },
    { m: 'maybeSingle', a: [] },
  ])
  if (error) return { obj: {}, error: error.message }
  return { obj: parseRaw(data?.value), error: null }
}

export async function loadCoursePageDraft(courseId: string | null): Promise<{ draft: CoursePageDraft; error: string | null }> {
  const { obj, error } = await readPageSettings()
  if (error) return { draft: EMPTY_PAGE_DRAFT, error }
  const bank = bankFrom(obj)
  const defaultVideoUrl = typeof obj.defaultVideoUrl === 'string' ? obj.defaultVideoUrl : ''
  const saved = courseId && isObj(obj.courses) && isObj(obj.courses[courseId]) ? obj.courses[courseId] : null
  // Mirrors reviewsForCourse(): no saved entry -> first 3 notes; saved entry -> exactly its list.
  const reviewIds = saved
    ? (Array.isArray(saved.reviewIds) ? saved.reviewIds.filter((id: unknown): id is string => typeof id === 'string') : [])
    : bank.slice(0, 3).map(n => n.id)
  return {
    draft: {
      bank,
      defaultVideoUrl,
      videoUrl: (typeof saved?.videoUrl === 'string' && saved.videoUrl) || defaultVideoUrl,
      reviewIds,
      theme: saved?.theme === 'new' ? 'new' : 'old',
    },
    error: null,
  }
}

/**
 * Writes this course's review/video/theme choice into course_page_content, re-reading the latest
 * value first so other courses' entries and notes added elsewhere are kept. Notes added in this
 * editor are appended to the shared bank. Unknown fields are preserved.
 */
export async function saveCoursePageDraft(courseId: string, draft: CoursePageDraft, prevId?: string | null): Promise<string | null> {
  const { obj, error } = await readPageSettings()
  if (error) return error
  const latestBank = bankFrom(obj)
  const known = new Set(latestBank.map(n => n.id))
  const bank = [...latestBank, ...draft.bank.filter(n => !known.has(n.id))]
  const ids = new Set(bank.map(n => n.id))

  const courses: Record<string, any> = isObj(obj.courses) ? { ...obj.courses } : {}
  if (prevId && prevId !== courseId) delete courses[prevId]
  const videoUrl = draft.videoUrl.trim()
  courses[courseId] = {
    ...(isObj(courses[courseId]) ? courses[courseId] : {}),
    videoUrl,
    reviewIds: draft.reviewIds.filter(id => ids.has(id)),
    theme: draft.theme,
  }
  const next = {
    ...obj,
    bank,
    // Same rule as the original manager: a course's video also becomes the default for courses without one.
    defaultVideoUrl: videoUrl || (typeof obj.defaultVideoUrl === 'string' ? obj.defaultVideoUrl : ''),
    courses,
  }
  const res = await sfDb('settings', [{ m: 'upsert', a: [{ key: COURSE_PAGE_SETTINGS_KEY, value: JSON.stringify(next) }] }])
  return res.error ? res.error.message : null
}

/** Removes a deleted course's entry from course_page_content and its own FAQ list. */
export async function removeCoursePageContent(courseId: string): Promise<string | null> {
  const faqErr = (await sfDb('settings', [{ m: 'delete', a: [] }, { m: 'eq', a: ['key', courseFaqsKey(courseId)] }])).error
  const { obj, error } = await readPageSettings()
  if (error) return error
  if (isObj(obj.courses) && courseId in obj.courses) {
    const courses = { ...obj.courses }
    delete courses[courseId]
    const res = await sfDb('settings', [{ m: 'upsert', a: [{ key: COURSE_PAGE_SETTINGS_KEY, value: JSON.stringify({ ...obj, courses }) }] }])
    if (res.error) return res.error.message
  }
  return faqErr ? faqErr.message : null
}

/** Extracts the 11-character YouTube video ID (same rules as the site's getYouTubeId). */
export function getYouTubeId(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (trimmed.length === 11 && !trimmed.includes('/') && !trimmed.includes('.') && !trimmed.includes('?')) return trimmed
  const match = trimmed.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/)
  return match && match[2].length === 11 ? match[2] : null
}
