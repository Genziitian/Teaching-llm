import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { queueGoogleGroupSyncJobs } from '@/lib/google-group-sync'

export const dynamic = 'force-dynamic'

/**
 * 3-Day Course Expiration Cleanup Cron
 * 
 * Rules:
 * 1. When a course passes its expiresAt date, a 3-day grace period starts.
 * 2. During this 3 days, managers can extend expiresAt to restore access.
 * 3. After 3 days past expiresAt (Now > expiresAt + 3 days):
 *    - All student enrollments & data for that course are purged.
 *    - Google Group Sync REMOVE jobs are queued for all enrolled users.
 *    - The course is automatically set to isDisabled = true.
 */
export async function GET(request: NextRequest) {
  try {
    // ─── Authorization Check ──────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const secretParam = searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET || 'teaching_lms_cron_secret_key_123'
    const providedSecret = secretParam || authHeader?.replace('Bearer ', '')

    const session = await getSession()
    const isManager = session?.role === 'MANAGER'
    const isAuthorizedCron = providedSecret === cronSecret

    if (!isAuthorizedCron && !isManager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    // Grace period cutoff: 3 days ago (72 hours)
    const graceCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    // Find all active (not yet disabled) courses whose expiration date is > 3 days past
    const expiredCourses = await prisma.course.findMany({
      where: {
        isDisabled: false,
        expiresAt: {
          not: null,
          lte: graceCutoff,
        },
      },
      include: {
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (expiredCourses.length === 0) {
      return NextResponse.json({
        success: true,
        processedCoursesCount: 0,
        message: 'No courses past the 3-day expiration grace period.',
      })
    }

    let totalArchivedEnrollments = 0
    let totalQueuedSyncJobs = 0
    const processedCourses = []

    for (const course of expiredCourses) {
      const courseId = course.id
      const enrollments = course.enrollments

      // 1. Queue Google Group REMOVE jobs for all enrolled users (external group access revoked)
      for (const enrollment of enrollments) {
        if (enrollment.user?.email) {
          try {
            await queueGoogleGroupSyncJobs(prisma, {
              userEmail: enrollment.user.email,
              courseIds: [courseId],
              action: 'REMOVE',
            })
            totalQueuedSyncJobs++
          } catch (err) {
            console.error(`[expired-courses-cron] Failed Google group sync for ${enrollment.user.email}:`, err)
          }
        }
      }

      // 2. Auto-disable the course (hides from student dashboards while preserving 100% historical data)
      await prisma.course.update({
        where: { id: courseId },
        data: {
          isDisabled: true,
        },
      })

      totalArchivedEnrollments += enrollments.length

      processedCourses.push({
        id: course.id,
        name: course.name,
        expiresAt: course.expiresAt,
        archivedEnrollmentsCount: enrollments.length,
      })
    }

    return NextResponse.json({
      success: true,
      processedCoursesCount: expiredCourses.length,
      totalArchivedEnrollments,
      totalQueuedSyncJobs,
      processedCourses,
      message: `Successfully archived & auto-disabled ${expiredCourses.length} course(s) past 3-day grace period. Historical enrollment data preserved.`,
    })
  } catch (error: any) {
    console.error('[expired-courses-cron] Processing failed:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
