// Extra listing options sent with the Store create/edit form.
// Stored in existing fields where they exist (Course.description / isDisabled / dates, offering.highlights)
// and in CourseOffering.website for the rest (subtitle, tags, marketing tag, pinned, boxes).
import { prisma } from '@/lib/db'

const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : [])

/** Whitelist + trim the website extras from a request body. */
export function cleanWebsite(w: any) {
  if (!w || typeof w !== 'object') return undefined
  return {
    subtitle: String(w.subtitle || '').trim().slice(0, 200),
    tags: strs(w.tags, 2),
    marketingTag: String(w.marketingTag || '').trim().slice(0, 40),
    isPinned: !!w.isPinned,
    boxes: strs(w.boxes, 20),
  }
}

/** Course-level fields from the same form (description, visibility, dates). Only the ones that were sent. */
export async function applyCourseExtras(courseId: string, b: any) {
  const data: Record<string, any> = {}
  if (typeof b.description === 'string') data.description = b.description.trim() || null
  if (typeof b.isDisabled === 'boolean') data.isDisabled = b.isDisabled
  if (b.startDate !== undefined) data.startDate = b.startDate ? new Date(b.startDate) : null
  if (b.endDate !== undefined) data.endDate = b.endDate ? new Date(b.endDate) : null
  if (Object.keys(data).length) await prisma.course.update({ where: { id: courseId }, data })
}
