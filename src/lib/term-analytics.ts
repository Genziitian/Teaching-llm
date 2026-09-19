/**
 * Term Analytics Engine
 *
 * Server-side computation for term-level revenue, enrollment, and retention metrics.
 * READS from: Course, Enrollment, Order, OrderItem, UpgradeTransaction.
 * WRITES to: nothing — returns computed data for the summary endpoint.
 */

import { prisma } from '@/lib/db'
import {
  type TermKey,
  type ExamCycle,
  type AcademicTerm,
  buildTermId,
  buildTermName,
  buildAcademicTerm,
  getDefaultTermForDate,
  isValidTermKey,
  isValidExamCycle,
  TERM_LABELS,
  EXAM_CYCLE_LABELS,
} from '@/lib/academic-terms'
import { getAcademicTerms } from '@/lib/academic-terms-config'

// ─── Result Types ────────────────────────────────────────────────────────────

export interface TermSummary {
  termId: string
  termName: string
  termKey: TermKey
  year: number
  revenue: number
  enrollmentCount: number
  newStudents: number
  returningStudents: number
  retentionRate: number // percentage
}

export interface CourseTermEntry {
  courseId: string
  courseName: string
  termId: string
  termName: string
  examCycle: string
  examCycleLabel: string
  revenue: number
  enrollmentCount: number
  returningStudents: number
}

export interface ExamCycleStats {
  cycle: ExamCycle
  label: string
  revenue: number
  enrollmentCount: number
}

export interface RetentionData {
  termId: string
  termName: string
  totalStudents: number
  newStudents: number
  returningStudents: number
  retentionRate: number
}

export interface TermAnalyticsResult {
  availableTerms: Array<{ id: string; name: string; termKey: TermKey; year: number }>
  termSummaries: TermSummary[]
  courseBreakdown: CourseTermEntry[]
  examCycleStats: ExamCycleStats[]
  retention: RetentionData[]
  kpis: {
    bestTermId: string | null
    bestTermName: string | null
    bestTermRevenue: number
    cumulativeRevenue: number
    topRevenueCourse: string | null
    topRevenueAmount: number
    topEnrollmentCourse: string | null
    topEnrollmentCount: number
    averageRevenuePerStudent: number
    overallRetentionRate: number
    multiCoursePurchaseRate: number
  }
}

// ─── Successful order statuses ───────────────────────────────────────────────

const SUCCESS_STATUSES = ['SUCCESS', 'PAID', 'COMPLETED', 'VERIFIED']

// ─── Main computation ────────────────────────────────────────────────────────

export async function computeTermAnalytics(
  filterTermId?: string | null,
): Promise<TermAnalyticsResult> {
  // 1. Fetch all courses with their term/exam tags and dates
  const courses = await (prisma.course as any).findMany({
    select: {
      id: true,
      name: true,
      academicTerm: true,
      academicYear: true,
      examCycle: true,
      startDate: true,
      endDate: true,
      isDemo: true,
      isFree: true,
      isGlobal: true,
    },
  })

  // 2. Build a map of courseId → term info (only courses with tags)
  const courseTermMap = new Map<string, {
    termId: string
    termKey: TermKey
    year: number
    termName: string
    examCycle: ExamCycle
    courseName: string
    startDate: Date | null
    endDate: Date | null
  }>()

  const availableTermsSet = new Map<string, { id: string; name: string; termKey: TermKey; year: number }>()

  // Pre-populate with all manager-configured terms (DB-backed)
  try {
    const configured = await getAcademicTerms()
    for (const t of configured) {
      availableTermsSet.set(t.id, { id: t.id, name: t.name, termKey: t.termKey, year: Number(t.year) })
    }
  } catch (e) {
    console.error('[term-analytics] Failed to load terms config:', e)
  }

  for (const c of courses) {
    // Skip demo, free, and global (general) courses
    if (c.isDemo || c.isFree || c.isGlobal) continue

    const termKey = c.academicTerm as TermKey | null
    const year = c.academicYear as number | null
    const cycle = c.examCycle as ExamCycle | null

    if (!isValidTermKey(termKey) || !year) continue

    const termId = buildTermId(termKey, year)
    const termName = buildTermName(termKey, year)
    const examCycle = isValidExamCycle(cycle) ? cycle : 'FULL_TERM'

    courseTermMap.set(c.id, {
      termId,
      termKey,
      year,
      termName,
      examCycle,
      courseName: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
    })

    if (!availableTermsSet.has(termId)) {
      availableTermsSet.set(termId, { id: termId, name: termName, termKey, year })
    }
  }

  const availableTerms = Array.from(availableTermsSet.values())
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      const order: TermKey[] = ['JAN', 'MAY', 'SEP']
      return order.indexOf(a.termKey) - order.indexOf(b.termKey)
    })

  // 3. Fetch all successful orders + items
  const orders = await (prisma.order as any).findMany({
    where: { status: { in: SUCCESS_STATUSES } },
    select: {
      id: true,
      userId: true,
      amount: true,
      createdAt: true,
      items: {
        select: {
          courseId: true,
          price: true,
        },
      },
    },
  })

  // 4. Fetch all successful upgrade transactions
  const upgrades = await (prisma.upgradeTransaction as any).findMany({
    where: { status: 'SUCCESS' },
    select: {
      userId: true,
      courseId: true,
      amount: true,
      createdAt: true,
    },
  })

  // 5. Fetch all enrollments
  const enrollments = await (prisma.enrollment as any).findMany({
    where: {
      user: { role: 'STUDENT', isTerminated: false },
    },
    select: {
      userId: true,
      courseId: true,
      createdAt: true,
      type: true,
    },
  })

  // 6. Aggregate revenue by term and course
  // Map: termId → { revenue, courseRevenues, userIds }
  const termAgg = new Map<string, {
    termKey: TermKey
    year: number
    termName: string
    revenue: number
    courseRevenues: Map<string, { revenue: number; courseName: string; examCycle: ExamCycle }>
    userIds: Set<string>
  }>()

  function ensureTerm(termId: string, termKey: TermKey, year: number, termName: string) {
    if (!termAgg.has(termId)) {
      termAgg.set(termId, {
        termKey,
        year,
        termName,
        revenue: 0,
        courseRevenues: new Map(),
        userIds: new Set(),
      })
    }
    return termAgg.get(termId)!
  }

  function ensureTermCourse(agg: ReturnType<typeof ensureTerm>, courseId: string, courseName: string, examCycle: ExamCycle) {
    if (!agg.courseRevenues.has(courseId)) {
      agg.courseRevenues.set(courseId, { revenue: 0, courseName, examCycle })
    }
    return agg.courseRevenues.get(courseId)!
  }

  // Process order items
  for (const order of orders) {
    for (const item of order.items) {
      const termInfo = courseTermMap.get(item.courseId)
      if (!termInfo) continue

      // Apply filter
      if (filterTermId && termInfo.termId !== filterTermId) continue

      const agg = ensureTerm(termInfo.termId, termInfo.termKey, termInfo.year, termInfo.termName)
      const courseAgg = ensureTermCourse(agg, item.courseId, termInfo.courseName, termInfo.examCycle)

      const itemRevenue = item.price || 0
      agg.revenue += itemRevenue
      courseAgg.revenue += itemRevenue
      agg.userIds.add(order.userId)
    }
  }

  // Process upgrade transactions
  for (const upg of upgrades) {
    const termInfo = courseTermMap.get(upg.courseId)
    if (!termInfo) continue

    if (filterTermId && termInfo.termId !== filterTermId) continue

    const agg = ensureTerm(termInfo.termId, termInfo.termKey, termInfo.year, termInfo.termName)
    const courseAgg = ensureTermCourse(agg, upg.courseId, termInfo.courseName, termInfo.examCycle)

    const upgRevenue = upg.amount || 0
    agg.revenue += upgRevenue
    courseAgg.revenue += upgRevenue
    agg.userIds.add(upg.userId)
  }

  // 7. Aggregate enrollments by term
  // Map: termId → Set of all userIds enrolled in that term
  const termEnrollments = new Map<string, Set<string>>()
  // Map: courseId → Set of enrolled userIds
  const courseEnrollments = new Map<string, Set<string>>()

  for (const enr of enrollments) {
    const termInfo = courseTermMap.get(enr.courseId)
    if (!termInfo) continue

    if (filterTermId && termInfo.termId !== filterTermId) continue

    if (!termEnrollments.has(termInfo.termId)) {
      termEnrollments.set(termInfo.termId, new Set())
    }
    termEnrollments.get(termInfo.termId)!.add(enr.userId)

    if (!courseEnrollments.has(enr.courseId)) {
      courseEnrollments.set(enr.courseId, new Set())
    }
    courseEnrollments.get(enr.courseId)!.add(enr.userId)
  }

  // 8. Compute retention: for each term, how many students were also in the previous term?
  const sortedTermIds = availableTerms.map(t => t.id)

  const retentionData: RetentionData[] = []
  const termSummaries: TermSummary[] = []

  for (let i = 0; i < sortedTermIds.length; i++) {
    const termId = sortedTermIds[i]
    const termMeta = availableTermsSet.get(termId)!
    const currentStudents = termEnrollments.get(termId) || new Set<string>()
    const totalStudents = currentStudents.size

    let returningStudents = 0
    let newStudents = totalStudents

    // Compare with previous term
    if (i > 0) {
      const prevTermId = sortedTermIds[i - 1]
      const previousStudents = termEnrollments.get(prevTermId) || new Set<string>()

      Array.from(currentStudents).forEach(userId => {
        if (previousStudents.has(userId)) {
          returningStudents++
        }
      })
      newStudents = totalStudents - returningStudents
    }

    const previousTermStudents = i > 0
      ? (termEnrollments.get(sortedTermIds[i - 1]) || new Set<string>()).size
      : 0
    const retentionRate = previousTermStudents > 0
      ? Math.round((returningStudents / previousTermStudents) * 1000) / 10
      : 0

    const agg = termAgg.get(termId)
    const revenue = agg?.revenue || 0

    if (filterTermId && termId !== filterTermId) continue

    retentionData.push({
      termId,
      termName: termMeta.name,
      totalStudents,
      newStudents,
      returningStudents,
      retentionRate,
    })

    termSummaries.push({
      termId,
      termName: termMeta.name,
      termKey: termMeta.termKey,
      year: termMeta.year,
      revenue,
      enrollmentCount: totalStudents,
      newStudents,
      returningStudents,
      retentionRate,
    })
  }

  // 9. Build course breakdown
  const courseBreakdown: CourseTermEntry[] = []
  Array.from(termAgg.entries()).forEach(([termId, agg]) => {
    Array.from(agg.courseRevenues.entries()).forEach(([courseId, courseAgg]) => {
      const enrolledSet = courseEnrollments.get(courseId) || new Set<string>()

      // Returning students for this specific course: enrolled in this course AND
      // also enrolled in any course from the previous term
      let returningInCourse = 0
      const termIndex = sortedTermIds.indexOf(termId)
      if (termIndex > 0) {
        const prevTermStudents = termEnrollments.get(sortedTermIds[termIndex - 1]) || new Set<string>()
        Array.from(enrolledSet).forEach(userId => {
          if (prevTermStudents.has(userId)) returningInCourse++
        })
      }

      courseBreakdown.push({
        courseId,
        courseName: courseAgg.courseName,
        termId,
        termName: agg.termName,
        examCycle: courseAgg.examCycle,
        examCycleLabel: EXAM_CYCLE_LABELS[courseAgg.examCycle] || courseAgg.examCycle,
        revenue: courseAgg.revenue,
        enrollmentCount: enrolledSet.size,
        returningStudents: returningInCourse,
      })
    })
  })

  // Sort by revenue descending
  courseBreakdown.sort((a, b) => b.revenue - a.revenue)

  // 10. Exam cycle stats
  const examCycleMap = new Map<ExamCycle, { revenue: number; enrollmentCount: number }>()
  for (const cb of courseBreakdown) {
    const cycle = cb.examCycle as ExamCycle
    if (!examCycleMap.has(cycle)) {
      examCycleMap.set(cycle, { revenue: 0, enrollmentCount: 0 })
    }
    const e = examCycleMap.get(cycle)!
    e.revenue += cb.revenue
    e.enrollmentCount += cb.enrollmentCount
  }

  const examCycleStats: ExamCycleStats[] = (['QUIZ_1', 'QUIZ_2', 'END_TERM', 'FULL_TERM'] as ExamCycle[])
    .filter(c => examCycleMap.has(c))
    .map(c => ({
      cycle: c,
      label: EXAM_CYCLE_LABELS[c],
      revenue: examCycleMap.get(c)!.revenue,
      enrollmentCount: examCycleMap.get(c)!.enrollmentCount,
    }))

  // 11. KPIs
  let bestTerm: TermSummary | null = null
  let cumulativeRevenue = 0
  for (const ts of termSummaries) {
    cumulativeRevenue += ts.revenue
    if (!bestTerm || ts.revenue > bestTerm.revenue) {
      bestTerm = ts
    }
  }

  let topRevenueCourse: CourseTermEntry | null = null
  let topEnrollmentCourse: CourseTermEntry | null = null
  for (const cb of courseBreakdown) {
    if (!topRevenueCourse || cb.revenue > topRevenueCourse.revenue) topRevenueCourse = cb
    if (!topEnrollmentCourse || cb.enrollmentCount > topEnrollmentCourse.enrollmentCount) topEnrollmentCourse = cb
  }

  // All unique students across all filtered terms
  const allStudents = new Set<string>()
  Array.from(termEnrollments).forEach(([_, students]) => {
    Array.from(students).forEach(userId => allStudents.add(userId))
  })
  const averageRevenuePerStudent = allStudents.size > 0
    ? Math.round((cumulativeRevenue / allStudents.size) * 100) / 100
    : 0

  // Overall retention across all terms
  let totalReturning = 0
  let totalPrevious = 0
  for (let i = 1; i < sortedTermIds.length; i++) {
    const prevStudents = termEnrollments.get(sortedTermIds[i - 1]) || new Set<string>()
    const currStudents = termEnrollments.get(sortedTermIds[i]) || new Set<string>()
    let returning = 0
    Array.from(currStudents).forEach(userId => {
      if (prevStudents.has(userId)) returning++
    })
    totalReturning += returning
    totalPrevious += prevStudents.size
  }
  const overallRetentionRate = totalPrevious > 0
    ? Math.round((totalReturning / totalPrevious) * 1000) / 10
    : 0

  // Multi-course purchase rate: students enrolled in 2+ courses in the same term
  let multiCourseStudents = 0
  let totalTermStudents = 0
  Array.from(termEnrollments).forEach(([termId, students]) => {
    Array.from(students).forEach(userId => {
      totalTermStudents++
      // Count how many courses this user has in this term
      let courseCount = 0
      Array.from(courseEnrollments).forEach(([courseId, enrolledUsers]) => {
        const termInfo = courseTermMap.get(courseId)
        if (termInfo && termInfo.termId === termId && enrolledUsers.has(userId)) {
          courseCount++
        }
      })
      if (courseCount >= 2) multiCourseStudents++
    })
  })
  const multiCoursePurchaseRate = totalTermStudents > 0
    ? Math.round((multiCourseStudents / totalTermStudents) * 1000) / 10
    : 0

  return {
    availableTerms,
    termSummaries,
    courseBreakdown,
    examCycleStats,
    retention: retentionData,
    kpis: {
      bestTermId: bestTerm?.termId || null,
      bestTermName: bestTerm?.termName || null,
      bestTermRevenue: bestTerm?.revenue || 0,
      cumulativeRevenue,
      topRevenueCourse: topRevenueCourse?.courseName || null,
      topRevenueAmount: topRevenueCourse?.revenue || 0,
      topEnrollmentCourse: topEnrollmentCourse?.courseName || null,
      topEnrollmentCount: topEnrollmentCourse?.enrollmentCount || 0,
      averageRevenuePerStudent,
      overallRetentionRate,
      multiCoursePurchaseRate,
    },
  }
}
