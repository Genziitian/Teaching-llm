// The website reads its courses from the Store data (CourseOffering / BundleOffering): the same source the app uses.
// Each course keeps its platform course ID, so a website purchase enrols into the same course with the same type.
import { prisma } from '@/lib/db'
import { storefrontDb } from '@/lib/storefront/db'
import { queryRows } from './rows-query'

export type StoreCourseRow = Record<string, any> & { id: string; name: string }

const TERMS = ['Qualifier', 'Re-attempt', 'Foundation', 'DIPLOMA']
const termOf = (v?: string | null) => (v ? TERMS.find((t) => t.toLowerCase() === v.trim().toLowerCase()) ?? null : null)
const iso = (d?: Date | null) => (d ? d.toISOString() : null)

type Tier = { name: string; price: number; type: 'recorded' | 'live'; original: number | null }

function tiers(o: { hasRecorded?: boolean | null; hasLive?: boolean | null; recordedOriginalPrice?: number | null; recordedDiscountPrice?: number | null; liveOriginalPrice?: number | null; liveDiscountPrice?: number | null }): Tier[] {
  const out: Tier[] = []
  if (o.hasRecorded) out.push({ name: 'PLUS', type: 'recorded', original: o.recordedOriginalPrice ?? null, price: (o.recordedDiscountPrice ?? o.recordedOriginalPrice) || 0 })
  if (o.hasLive) out.push({ name: 'PRO', type: 'live', original: o.liveOriginalPrice ?? null, price: (o.liveDiscountPrice ?? o.liveOriginalPrice) || 0 })
  return out
}

/** Course offering -> the row shape the website pages and checkout already understand. */
export function offeringToRow(o: any): StoreCourseRow {
  const c = o.course || {}
  const w = (o.website as Record<string, any>) || {}
  const t = tiers(o)
  const cheapest = t.filter((x) => x.price > 0).sort((a, b) => a.price - b.price)[0]
  return {
    id: o.courseId,
    name: o.name,
    description: c.description || '',
    subject: c.subject ?? null,
    thumbnail: o.thumbnail ?? null,
    price: cheapest ? Math.round(cheapest.original ?? cheapest.price) : 0,
    discountPrice: cheapest && cheapest.original != null && cheapest.price < cheapest.original ? Math.round(cheapest.price) : null,
    class_type: o.hasRecorded || !o.hasLive ? 'recorded' : 'live',
    active: !c.isDisabled,
    isPinned: !!w.isPinned,
    courseCategory: o.category || 'NONE',
    term: termOf(c.academicTerm),
    exam_stages: [],
    tags: w.tags || [],
    marketingTag: w.marketingTag || '',
    subtitle: w.subtitle || '',
    boxes: w.boxes || [],
    startDate: iso(c.startDate),
    endDate: iso(c.endDate),
    isBundle: false,
    isFixedBundle: false,
    bundleCourses: [],
    pricing_options: t.map((x) => ({ name: x.name, price: x.price, type: x.type })),
    who: '',
    learn: [],
    outcomes: '',
    cohortContent: o.highlights || null,
    created_at: iso(o.createdAt),
  }
}

/** Bundle offering -> website bundle row. */
export function bundleToRow(b: any): StoreCourseRow {
  const t = tiers(b)
  const fixed = t.length > 0
  let perCourse: Record<string, number> = {}
  try { for (const x of JSON.parse(b.coursePrices || '[]')) if (x?.courseId) perCourse[x.courseId] = Number(x.price) || 0 } catch { /* ignore bad JSON */ }
  const members = (b.courses || []).map((m: any) => ({
    courseId: m.courseId,
    courseName: m.course?.name || m.courseId,
    price: perCourse[m.courseId] ?? 0,
  }))
  const first = t.filter((x) => x.price > 0).sort((a, z) => a.price - z.price)[0]
  return {
    id: b.id,
    name: b.name,
    description: b.description || '',
    subject: null,
    price: Math.round(first?.original ?? first?.price ?? b.startingPrice ?? 0),
    discountPrice: first && first.original != null && first.price < first.original ? Math.round(first.price) : null,
    class_type: b.forceClassType ? String(b.forceClassType).toLowerCase() : t[0]?.type || 'recorded',
    active: true,
    isPinned: false,
    courseCategory: 'NONE',
    term: null,
    exam_stages: [],
    tags: [],
    startDate: null,
    endDate: null,
    isBundle: true,
    isFixedBundle: fixed,
    bundleCourses: members,
    pricing_options: fixed ? t.map((x) => ({ name: x.name, price: x.price, type: x.type })) : [],
    bundleDiscountPrice: null,
    bundleDiscountAmount: null,
    who: '',
    cohortContent: null,
    created_at: iso(b.createdAt),
  }
}

export async function listStoreCourses(opts: { onlyActive?: boolean } = {}): Promise<StoreCourseRow[]> {
  const [offerings, bundles] = await Promise.all([
    prisma.courseOffering.findMany({ where: { courseId: { not: 'general-discussion' } }, include: { course: true }, orderBy: { createdAt: 'desc' } }),
    prisma.bundleOffering.findMany({ include: { courses: { include: { course: { select: { name: true, isDisabled: true } } } } }, orderBy: { createdAt: 'desc' } }),
  ])
  const rows = [...offerings.map(offeringToRow), ...bundles.map(bundleToRow)]
  return opts.onlyActive ? rows.filter((r) => r.active) : rows
}

/**
 * Drop-in for `storefrontDb()` in website server code: `courses` comes from the Store data, every other
 * table still goes to the website database (until those are moved too).
 */
export function siteDb(): any {
  return {
    from(table: string) {
      if (table !== 'courses') return storefrontDb().from(table)
      // Lazy: rows load when the query is awaited.
      let ready: Promise<StoreCourseRow[]> | null = null
      const rows = () => (ready ??= listStoreCourses())
      const calls: [string, any[]][] = []
      const chain: any = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === 'then') {
            return (resolve: any, reject: any) =>
              rows().then((r) => {
                const q: any = queryRows(r)
                for (const [m, a] of calls) q[m](...a)
                return q
              }).then(resolve, reject)
          }
          return (...a: any[]) => { calls.push([prop, a]); return chain }
        },
      })
      return chain
    },
  }
}
