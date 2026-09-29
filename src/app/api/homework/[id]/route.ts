import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager, getAccessibleCourseIds } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { ensureHomeworkTables } from '@/lib/homework-schema-sync'
import { sendHomeworkUpdatedNotification } from '@/lib/system-notifications'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureHomeworkTables()

    const { id } = await params
    const homework = await prisma.homework.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        course: { select: { id: true, name: true, color: true } },
        _count: { select: { submissions: true } },
        submissions: {
          where: { studentId: session.userId },
          select: { id: true, fileUrls: true, note: true, submittedAt: true },
        },
      },
    })

    if (!homework) {
      return NextResponse.json({ error: 'Homework not found' }, { status: 404 })
    }

    const isManager = isAdminOrManager(session.role)
    if (!isManager) {
      const accessibleCourseIds = await getAccessibleCourseIds(session.userId, session.role)
      if (accessibleCourseIds && !accessibleCourseIds.includes(homework.courseId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    const isPastDue = new Date(homework.dueAt).getTime() <= Date.now()
    const mySubmission = homework.submissions && homework.submissions.length > 0 ? homework.submissions[0] : null
    return NextResponse.json({
      ...homework,
      isSubmitted: !!mySubmission,
      mySubmission,
      submissionsCount: homework._count.submissions,
      isPastDue,
      isOpen: !isPastDue && (homework.isOpen ?? true),
    })
  } catch (error: any) {
    console.error('Error fetching homework detail:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, description, fileUrls, dueAt, isOpen } = body

    const existing = await prisma.homework.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Homework not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (isOpen !== undefined) updateData.isOpen = Boolean(isOpen)
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description ? description.trim() : null
    if (fileUrls !== undefined && Array.isArray(fileUrls)) updateData.fileUrls = fileUrls
    if (dueAt !== undefined) {
      const dueDate = new Date(dueAt)
      if (isNaN(dueDate.getTime())) {
        return NextResponse.json({ error: 'Invalid dueAt date' }, { status: 400 })
      }
      updateData.dueAt = dueDate
    }

    const updated = await prisma.homework.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        course: { select: { id: true, name: true, color: true } },
      },
    })

    try {
      logActivity({
        userId: session.userId,
        userName: session.email || 'Admin',
        userRole: session.role,
        actionType: 'HOMEWORK_UPDATED',
        actionDescription: `Updated homework: ${updated.title}`,
        moduleName: MODULE.COURSES,
        targetId: id,
      })
    } catch (_) {}

    // Send notifications to enrolled students
    try {
      // If dueAt was updated, clear previous 2h reminder log so student gets reminder for new due date
      if (updateData.dueAt) {
        await prisma.notificationLog.deleteMany({
          where: {
            category: 'HOMEWORK_DUE_REMINDER',
            metadata: { contains: id },
          },
        }).catch(() => {})
      }

      await sendHomeworkUpdatedNotification(
        updated.courseId,
        updated.title,
        updated.dueAt,
        updated.id
      )
    } catch (notiErr) {
      console.error('[Homework] Failed to dispatch updated notification:', notiErr)
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating homework:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.homework.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Homework not found' }, { status: 404 })
    }

    await prisma.homework.delete({ where: { id } })

    try {
      logActivity({
        userId: session.userId,
        userName: session.email || 'Admin',
        userRole: session.role,
        actionType: 'HOMEWORK_DELETED',
        actionDescription: `Deleted homework: ${existing.title}`,
        moduleName: MODULE.COURSES,
        targetId: id,
      })
    } catch (_) {}

    return NextResponse.json({ success: true, message: 'Homework deleted' })
  } catch (error: any) {
    console.error('Error deleting homework:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
