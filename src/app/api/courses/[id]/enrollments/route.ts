import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isManagerOrSuperAdmin } from '@/lib/auth'
import { queueGoogleGroupSyncJobs } from '@/lib/google-group-sync'

export const dynamic = 'force-dynamic'

const CONFIRM_PHRASE = 'REMOVE ALL ENROLLMENTS'

/**
 * GET — enrollment summary for a course (manager only).
 * Used by the clear-enrollments confirmation flow.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || !isManagerOrSuperAdmin(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: courseId } = await params

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, name: true, isDemo: true },
    })

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const count = await prisma.enrollment.count({ where: { courseId } })

    return NextResponse.json({
      courseId: course.id,
      courseName: course.name,
      isDemo: course.isDemo,
      count,
      confirmPhrase: CONFIRM_PHRASE,
    })
  } catch (error: any) {
    console.error('[course-enrollments] GET failed:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE — permanently remove ALL enrollments for this course (manager only).
 * Requires typed confirmations in the body so accidental wipes are hard.
 *
 * Body: { confirmCourseName: string, confirmPhrase: "REMOVE ALL ENROLLMENTS" }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || !isManagerOrSuperAdmin(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: courseId } = await params
    const body = await request.json().catch(() => ({}))
    const confirmCourseName = typeof body.confirmCourseName === 'string' ? body.confirmCourseName.trim() : ''
    const confirmPhrase = typeof body.confirmPhrase === 'string' ? body.confirmPhrase.trim() : ''

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, name: true, isDemo: true },
    })

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    if (course.isDemo) {
      return NextResponse.json(
        { error: 'Cannot clear enrollments on the system Demo Course.' },
        { status: 400 }
      )
    }

    if (confirmCourseName.toLowerCase() !== course.name.trim().toLowerCase()) {
      return NextResponse.json(
        { error: 'Course name confirmation does not match.' },
        { status: 400 }
      )
    }

    if (confirmPhrase.toUpperCase() !== CONFIRM_PHRASE) {
      return NextResponse.json(
        { error: `You must type "${CONFIRM_PHRASE}" exactly to confirm.` },
        { status: 400 }
      )
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    })

    if (enrollments.length === 0) {
      return NextResponse.json({
        success: true,
        removedCount: 0,
        queuedGoogleGroupRemovals: 0,
        message: 'No enrollments to remove.',
      })
    }

    let queuedGoogleGroupRemovals = 0
    for (const enrollment of enrollments) {
      if (!enrollment.user?.email) continue
      try {
        await queueGoogleGroupSyncJobs(prisma, {
          userEmail: enrollment.user.email,
          courseIds: [courseId],
          action: 'REMOVE',
        })
        queuedGoogleGroupRemovals++
      } catch (err) {
        console.error(
          `[course-enrollments] Google group REMOVE failed for ${enrollment.user.email}:`,
          err
        )
      }
    }

    const deleted = await prisma.enrollment.deleteMany({ where: { courseId } })

    console.info(
      `[course-enrollments] Manager ${session.userId} cleared ${deleted.count} enrollment(s) from course ${courseId} (${course.name})`
    )

    return NextResponse.json({
      success: true,
      removedCount: deleted.count,
      queuedGoogleGroupRemovals,
      courseId: course.id,
      courseName: course.name,
      message: `Removed ${deleted.count} enrollment(s) from "${course.name}". Old students no longer have access.`,
    })
  } catch (error: any) {
    console.error('[course-enrollments] DELETE failed:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
