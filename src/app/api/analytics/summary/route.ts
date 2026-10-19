import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { computeTermAnalytics } from '@/lib/term-analytics'

/**
 * GET /api/analytics/summary?range=7d
 *
 * Read-only endpoint that returns precomputed analytics.
 * No heavy queries — reads directly from AnalyticsSnapshot & AnalyticsCourseDaily.
 * Auth: Manager/Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['MANAGER', 'ADMIN', 'MODERATOR'].includes(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '7d'
    const courseId = searchParams.get('courseId') || 'all'

    // ─── Calculate date range ────────────────────────────────────────
    const now = new Date()
    const today = new Date(now)
    today.setUTCHours(23, 59, 59, 999)

    let startDate: Date

    switch (range) {
      case 'today': {
        startDate = new Date(now)
        startDate.setUTCHours(0, 0, 0, 0)
        break
      }
      case 'yesterday': {
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 1)
        startDate.setUTCHours(0, 0, 0, 0)
        // For yesterday, also cap the end
        today.setDate(now.getDate() - 1)
        today.setUTCHours(23, 59, 59, 999)
        break
      }
      case '7d': {
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 6)
        startDate.setUTCHours(0, 0, 0, 0)
        break
      }
      case '30d': {
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 29)
        startDate.setUTCHours(0, 0, 0, 0)
        break
      }
      case '3m': {
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 3)
        startDate.setUTCHours(0, 0, 0, 0)
        break
      }
      default: {
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 6)
        startDate.setUTCHours(0, 0, 0, 0)
      }
    }

    // ─── Fetch snapshots for range ───────────────────────────────────
    const snapshots = await (prisma.analyticsSnapshot as any).findMany({
      where: { date: { gte: startDate, lte: today } },
      orderBy: { date: 'asc' },
    })

    // ─── Fetch course daily stats for range ──────────────────────────
    const courseDaily = await (prisma.analyticsCourseDaily as any).findMany({
      where: { date: { gte: startDate, lte: today } },
      orderBy: { date: 'asc' },
    })

    // ─── Fetch analytics config for timer ────────────────────────────
    let config = await (prisma.analyticsConfig as any).findUnique({
      where: { id: 'singleton' },
    })
    if (!config) {
      config = { lastUpdatedAt: null, cronIntervalHours: 24 }
    }

    // ─── Aggregate across the range ──────────────────────────────────
    let totalNewUsers = 0
    let totalReturningUsers = 0
    let totalActiveUsers = 0
    let totalEnrollments = 0

    // Merge hourly activity across all days in range
    const mergedHourly: Record<string, number> = {}
    for (let h = 0; h < 24; h++) mergedHourly[String(h)] = 0

    if (courseId && courseId !== 'all') {
      // Aggregate activity in Postgres rather than materializing every matching
      // ActivityLog row in this long-lived web process.
      const hourlyActivity = await prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
        SELECT EXTRACT(HOUR FROM a."timestamp")::int AS hour, COUNT(*)::bigint AS count
        FROM "ActivityLog" a
        JOIN "User" u ON u."id" = a."userId"
        WHERE a."timestamp" >= ${startDate} AND a."timestamp" <= ${today}
          AND u."role" = 'STUDENT' AND u."isTerminated" = false
          AND EXISTS (
            SELECT 1 FROM "Enrollment" e
            WHERE e."userId" = a."userId" AND e."classId" = ${courseId}
          )
        GROUP BY 1
      `

      for (const row of hourlyActivity) {
        const hour = row.hour
        // Convert UTC to IST (+5:30)
        const istHour = (hour + 5 + Math.floor((30) / 60)) % 24
        mergedHourly[String(istHour)] = Number(row.count)
      }

      const totalEnrolledInCourse = await prisma.enrollment.count({
        where: {
          courseId,
          user: { role: 'STUDENT', isTerminated: false }
        }
      })

      const newEnrollmentsInCourse = await prisma.enrollment.count({
        where: {
          courseId,
          createdAt: { gte: startDate, lte: today },
          user: { role: 'STUDENT', isTerminated: false }
        }
      })

      const activeUsers = await prisma.$queryRaw<Array<{ activeUsers: bigint; returningUsers: bigint }>>`
        SELECT
          COUNT(DISTINCT a."userId")::bigint AS "activeUsers",
          (COUNT(DISTINCT a."userId") FILTER (WHERE u."createdAt" < ${startDate}))::bigint AS "returningUsers"
        FROM "ActivityLog" a
        JOIN "User" u ON u."id" = a."userId"
        WHERE a."timestamp" >= ${startDate} AND a."timestamp" <= ${today}
          AND u."role" = 'STUDENT' AND u."isTerminated" = false
          AND EXISTS (
            SELECT 1 FROM "Enrollment" e
            WHERE e."userId" = a."userId" AND e."classId" = ${courseId}
          )
      `
      const activeUsersCount = Number(activeUsers[0]?.activeUsers || 0)
      const returningUsersCount = Number(activeUsers[0]?.returningUsers || 0)

      totalNewUsers = newEnrollmentsInCourse
      totalReturningUsers = returningUsersCount
      totalActiveUsers = activeUsersCount
      totalEnrollments = totalEnrolledInCourse
    } else {
      for (const snap of snapshots) {
        totalNewUsers += snap.newUsers
        totalReturningUsers += snap.returningUsers
        totalActiveUsers += snap.activeUsers
        totalEnrollments += snap.totalEnrollments

        if (snap.hourlyActivity) {
          try {
            const hourly = JSON.parse(snap.hourlyActivity)
            for (const [hour, count] of Object.entries(hourly)) {
              mergedHourly[hour] = (mergedHourly[hour] || 0) + (count as number)
            }
          } catch {}
        }
      }
    }

    // Use the latest snapshot for current totals
    let latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null

    // Fallback: If no snapshot found in range, get the latest one available before this range
    if (!latest) {
      latest = await (prisma.analyticsSnapshot as any).findFirst({
        where: { date: { lt: startDate } },
        orderBy: { date: 'desc' },
      })
    }

    // Parse latest topCourses, courseDistribution
    let topCourses = []
    let courseDistribution = []
    let demographics = null
    if (latest) {
      try { topCourses = JSON.parse(latest.topCourses || '[]') } catch {}
      try { courseDistribution = JSON.parse(latest.courseDistribution || '[]') } catch {}
    }

    // Compute live demographics to ensure up-to-the-minute correctness and include new fields
    try {
      let allUsers;
      if (courseId && courseId !== 'all') {
        allUsers = await prisma.user.findMany({
          where: {
            role: 'STUDENT',
            isTerminated: false,
            enrollments: {
              some: { courseId: courseId }
            }
          },
          select: { id: true, gender: true, state: true, age: true, iitmJoinYear: true, iitmJoinMonth: true, iitmLevel: true, iitmUserType: true }
        })
      } else {
        allUsers = await prisma.user.findMany({
          where: { role: 'STUDENT', isTerminated: false },
          select: { id: true, gender: true, state: true, age: true, iitmJoinYear: true, iitmJoinMonth: true, iitmLevel: true, iitmUserType: true }
        })
      }
      
      const liveDemographics: any = {
        gender: { MALE: 0, FEMALE: 0, OTHER: 0, UNSPECIFIED: 0 },
        state: {},
        age: { 'Under 18': 0, '18-24': 0, '25-34': 0, '35+': 0, 'Unknown': 0 },
        iitmJoinYear: {},
        iitmJoinMonth: {},
        iitmLevel: {},
        iitmUserType: {}
      }

      for (const u of allUsers) {
        const g = u.gender || 'UNSPECIFIED'
        if (liveDemographics.gender[g] !== undefined) liveDemographics.gender[g]++
        else liveDemographics.gender['UNSPECIFIED']++

        const s = u.state || 'Unknown'
        liveDemographics.state[s] = (liveDemographics.state[s] || 0) + 1

        if (u.age) {
          if (u.age < 18) liveDemographics.age['Under 18']++
          else if (u.age <= 24) liveDemographics.age['18-24']++
          else if (u.age <= 34) liveDemographics.age['25-34']++
          else liveDemographics.age['35+']++
        } else {
          liveDemographics.age['Unknown']++
        }

        if (u.iitmJoinYear) {
          liveDemographics.iitmJoinYear[u.iitmJoinYear] = (liveDemographics.iitmJoinYear[u.iitmJoinYear] || 0) + 1
        }
        if (u.iitmJoinMonth) {
          liveDemographics.iitmJoinMonth[u.iitmJoinMonth] = (liveDemographics.iitmJoinMonth[u.iitmJoinMonth] || 0) + 1
        }
        if (u.iitmLevel) {
          liveDemographics.iitmLevel[u.iitmLevel] = (liveDemographics.iitmLevel[u.iitmLevel] || 0) + 1
        }
        if (u.iitmUserType) {
          liveDemographics.iitmUserType[u.iitmUserType] = (liveDemographics.iitmUserType[u.iitmUserType] || 0) + 1
        }
      }
      demographics = liveDemographics
    } catch (e) {
      console.error('[Analytics Summary] Failed to compute live demographics, fallback to snapshot', e)
      if (latest) {
        try { demographics = JSON.parse(latest.demographics || 'null') } catch {}
      }
    }

    // ─── Filter out disabled/expired courses ──────────────────────────
    const disabledClasses = await (prisma.course as any).findMany({
      where: {
        OR: [
          { isDisabled: true },
          { expiresAt: { lte: new Date() } },
        ],
      },
      select: { id: true, name: true },
    })
    const disabledIds = new Set(disabledClasses.map(c => c.id))
    const disabledNames = new Set(disabledClasses.map(c => (c.name || '').trim().toLowerCase()).filter(Boolean))

    // ─── Build course growth data ────────────────────────────────────
    // Group by courseId, take the latest entry for each
    const courseGrowthMap = new Map<string, any>()
    for (const cd of courseDaily) {
      if (disabledIds.has(cd.courseId) || disabledNames.has((cd.courseName || '').trim().toLowerCase())) {
        continue
      }
      courseGrowthMap.set(cd.courseId, {
        courseId: cd.courseId,
        courseName: cd.courseName,
        enrollmentCount: cd.enrollmentCount,
        totalEnrollments: cd.totalEnrollments,
        growthDelta: cd.growthDelta,
      })
    }
    let courseGrowth = Array.from(courseGrowthMap.values())
      .sort((a, b) => b.totalEnrollments - a.totalEnrollments)

    if (courseId && courseId !== 'all') {
      courseGrowth = courseGrowth.filter((cg: any) => cg.courseId === courseId)
    }

    const filteredTopCourses = topCourses.filter((c: any) => 
      !disabledIds.has(c.id || c.courseId) && !disabledNames.has((c.name || c.courseName || '').trim().toLowerCase())
    )
    const filteredCourseDist = courseDistribution.filter((c: any) => 
      !disabledIds.has(c.id || c.courseId) && !disabledNames.has((c.name || c.courseName || '').trim().toLowerCase())
    )

    // ─── Build daily trend data ──────────────────────────────────────
    let dailyTrend = snapshots.map((s: any) => ({
      date: s.date,
      enrollments: s.totalEnrollments,
      newUsers: s.newUsers,
      activeUsers: s.activeUsers,
    }))

    if (courseId && courseId !== 'all') {
      const dailyActivity = await prisma.$queryRaw<Array<{ day: Date; activeUsers: bigint }>>`
        SELECT date_trunc('day', a."timestamp") AS day,
          COUNT(DISTINCT a."userId")::bigint AS "activeUsers"
        FROM "ActivityLog" a
        JOIN "User" u ON u."id" = a."userId"
        WHERE a."timestamp" >= ${startDate} AND a."timestamp" <= ${today}
          AND u."role" = 'STUDENT' AND u."isTerminated" = false
          AND EXISTS (
            SELECT 1 FROM "Enrollment" e
            WHERE e."userId" = a."userId" AND e."classId" = ${courseId}
          )
        GROUP BY 1
      `

      const courseDailyStats = courseDaily.filter((cd: any) => cd.courseId === courseId)
      const activeUsersPerDay = new Map(
        dailyActivity.map(row => [
          row.day.toISOString().split('T')[0],
          Number(row.activeUsers),
        ])
      )

      dailyTrend = snapshots.map((s: any) => {
        const snapDateStr = new Date(s.date).toISOString().split('T')[0]
        const activeCount = activeUsersPerDay.get(snapDateStr) || 0
        
        const match = courseDailyStats.find((cd: any) => 
          new Date(cd.date).toISOString().split('T')[0] === snapDateStr
        )
        
        return {
          date: s.date,
          enrollments: match?.totalEnrollments || 0,
          newUsers: match?.enrollmentCount || 0,
          activeUsers: activeCount,
        }
      })
    }

    // ─── Compute Batch Type Distribution (Live vs Recorded) ───────────
    let batchStats = {
      liveStudents: 0,
      recordedStudents: 0,
      bothStudents: 0,
      totalLiveEnrollments: 0,
      totalRecordedEnrollments: 0,
      totalEnrolledStudents: 0,
      liveOnlyStudents: 0,
      recordedOnlyStudents: 0,
      notEnrolledStudents: 0,
      totalStudents: 0,
      demoStudents: 0,
    }

    try {
      if (courseId && courseId !== 'all') {
        const courseEnrollments = await prisma.enrollment.findMany({
          where: {
            courseId,
            user: { role: 'STUDENT', isTerminated: false }
          },
          select: { type: true }
        })

        let liveCount = 0
        let recordedCount = 0
        let demoCount = 0

        for (const enr of courseEnrollments) {
          if (enr.type === 'LIVE') liveCount++
          else if (enr.type === 'RECORDED') recordedCount++
          else if (enr.type === 'DEMO') demoCount++
        }

        batchStats = {
          liveStudents: liveCount,
          recordedStudents: recordedCount,
          bothStudents: 0,
          totalLiveEnrollments: liveCount,
          totalRecordedEnrollments: recordedCount,
          totalEnrolledStudents: courseEnrollments.length,
          liveOnlyStudents: liveCount,
          recordedOnlyStudents: recordedCount,
          notEnrolledStudents: 0,
          totalStudents: courseEnrollments.length,
          demoStudents: demoCount,
        }
      } else {
        // Keep this dashboard summary in Postgres. Loading every student ID and
        // every enrollment with its related course can create a large transient
        // heap spike on the web instance as the historical dataset grows.
        const [totalStudentsCount, enrollmentGroups] = await Promise.all([
          prisma.user.count({
            where: { role: 'STUDENT', isTerminated: false }
          }),
          prisma.enrollment.groupBy({
            by: ['userId', 'type'],
            where: {
              user: { role: 'STUDENT', isTerminated: false },
              course: {
                isDemo: false,
                isFree: false,
                isGlobal: false,
                NOT: [
                  { name: { contains: 'general', mode: 'insensitive' } },
                  { name: { contains: 'demo', mode: 'insensitive' } },
                  { name: { contains: 'free', mode: 'insensitive' } },
                ],
              },
            },
            _count: { _all: true },
          }),
        ])

        const userBatchMap = new Map<string, Set<string>>()
        let liveEnrollmentsCount = 0
        let recordedEnrollmentsCount = 0

        for (const group of enrollmentGroups) {
          if (!userBatchMap.has(group.userId)) {
            userBatchMap.set(group.userId, new Set())
          }

          userBatchMap.get(group.userId)!.add(group.type)
          if (group.type === 'LIVE') liveEnrollmentsCount += group._count._all
          else if (group.type === 'RECORDED') recordedEnrollmentsCount += group._count._all
        }

        let liveStudents = 0
        let recordedStudents = 0
        let bothStudents = 0
        let liveOnlyStudents = 0
        let recordedOnlyStudents = 0
        let notEnrolledStudents = 0

        userBatchMap.forEach((types) => {
          const hasLive = types.has('LIVE')
          const hasRecorded = types.has('RECORDED')

          if (hasLive && hasRecorded) {
            bothStudents++
            liveStudents++
            recordedStudents++
          } else if (hasLive) {
            liveStudents++
            liveOnlyStudents++
          } else if (hasRecorded) {
            recordedStudents++
            recordedOnlyStudents++
          }
        })

        notEnrolledStudents = totalStudentsCount - userBatchMap.size

        batchStats = {
          liveStudents,
          recordedStudents,
          bothStudents,
          totalLiveEnrollments: liveEnrollmentsCount,
          totalRecordedEnrollments: recordedEnrollmentsCount,
          totalEnrolledStudents: totalStudentsCount - notEnrolledStudents,
          liveOnlyStudents,
          recordedOnlyStudents,
          notEnrolledStudents,
          totalStudents: totalStudentsCount,
          demoStudents: 0,
        }
      }
    } catch (e) {
      console.error('[Analytics Summary] Failed to compute batch stats:', e)
    }

    // ─── Compute Demo Stats ──────────────────────────────────────────
    let demoStats = {
      totalUsersWithDemo: 0,
      totalDemoEnrollments: 0,
      courseBreakdown: [] as Array<{ courseId: string; courseName: string; count: number; color: string }>,
      mostPopularDemoCourse: 'None'
    }

    try {
      const demoEnrollments = await prisma.enrollment.findMany({
        where: {
          type: 'DEMO',
          user: { role: 'STUDENT', isTerminated: false }
        },
        select: {
          userId: true,
          courseId: true,
          course: {
            select: {
              name: true,
              color: true
            }
          }
        }
      })

      const filteredDemos = (courseId && courseId !== 'all')
        ? demoEnrollments.filter(e => e.courseId === courseId)
        : demoEnrollments

      const uniqueDemoUsers = new Set(filteredDemos.map(e => e.userId))
      
      const courseCountsMap = new Map<string, { name: string; color: string; count: number }>()
      for (const e of filteredDemos) {
        if (!e.course) continue
        const current = courseCountsMap.get(e.courseId) || { name: e.course.name, color: e.course.color || '#6366f1', count: 0 }
        current.count++
        courseCountsMap.set(e.courseId, current)
      }

      const breakdown = Array.from(courseCountsMap.entries()).map(([cid, data]) => ({
        courseId: cid,
        courseName: data.name,
        count: data.count,
        color: data.color
      })).sort((a, b) => b.count - a.count)

      const mostPopular = breakdown.length > 0 ? breakdown[0].courseName : 'None'

      demoStats = {
        totalUsersWithDemo: uniqueDemoUsers.size,
        totalDemoEnrollments: filteredDemos.length,
        courseBreakdown: breakdown,
        mostPopularDemoCourse: mostPopular
      }
    } catch (err) {
      console.error('[Analytics Summary] Failed to compute demo stats:', err)
    }

    // ─── Compute Term Analytics ────────────────────────────────────────
    let termAnalytics = null
    try {
      const termFilter = searchParams.get('termId') || null
      termAnalytics = await computeTermAnalytics(termFilter)
    } catch (err) {
      console.error('[Analytics Summary] Failed to compute term analytics:', err)
    }

    return NextResponse.json({
      range,
      timer: {
        lastUpdatedAt: config.lastUpdatedAt,
        cronIntervalHours: config.cronIntervalHours,
      },
      summary: {
        totalUsers: courseId && courseId !== 'all' ? totalEnrollments : (latest?.totalUsers || 0),
        newUsers: totalNewUsers,
        returningUsers: totalReturningUsers,
        activeUsers: totalActiveUsers,
        totalEnrollments,
        avgCoursesPerStudent: courseId && courseId !== 'all' ? 1 : (latest?.avgCoursesPerStudent || 0),
      },
      dailyTrend,
      hourlyActivity: mergedHourly,
      topCourses: filteredTopCourses,
      courseDistribution: filteredCourseDist,
      courseGrowth,
      demographics,
      batchStats,
      demoStats,
      termAnalytics,
    })
  } catch (error) {
    console.error('[Analytics Summary] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
