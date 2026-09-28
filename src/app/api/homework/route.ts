import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager, getAccessibleCourseIds } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { ensureHomeworkTables } from '@/lib/homework-schema-sync'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureHomeworkTables()

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')

    const isManager = isAdminOrManager(session.role)
    const accessibleCourseIds = await getAccessibleCourseIds(session.userId, session.role)

    if (courseId && !isManager) {
      if (accessibleCourseIds && !accessibleCourseIds.includes(courseId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    const where: any = {}
    if (courseId) {
      where.courseId = courseId
    } else if (!isManager && accessibleCourseIds) {
      where.courseId = { in: accessibleCourseIds }
    }

    const homeworkList = await prisma.homework.findMany({
      where,
      orderBy: { dueAt: 'asc' },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true },
        },
        course: {
          select: { id: true, name: true, color: true },
        },
        _count: {
          select: { submissions: true },
        },
        submissions: {
          where: { studentId: session.userId },
          select: {
            id: true,
            fileUrls: true,
            note: true,
            submittedAt: true,
          },
        },
      },
    })

    const result = homeworkList.map((hw: any) => {
      const mySubmission = hw.submissions && hw.submissions.length > 0 ? hw.submissions[0] : null
      const isPastDue = new Date(hw.dueAt).getTime() < Date.now()
      return {
        id: hw.id,
        courseId: hw.courseId,
        courseName: hw.course?.name,
        courseColor: hw.course?.color,
        title: hw.title,
        description: hw.description,
        fileUrls: hw.fileUrls || [],
        dueAt: hw.dueAt,
        createdAt: hw.createdAt,
        updatedAt: hw.updatedAt,
        createdBy: hw.createdBy,
        submissionsCount: hw._count?.submissions || 0,
        isSubmitted: !!mySubmission,
        mySubmission,
        isPastDue,
        isOpen: hw.isOpen ?? true,
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching homework:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureHomeworkTables()

    const body = await request.json()
    const { courseId, title, description, fileUrls, dueAt, isOpen } = body

    if (!courseId || !title || !dueAt) {
      return NextResponse.json({ error: 'courseId, title, and dueAt are required' }, { status: 400 })
    }

    const dueDate = new Date(dueAt)
    if (isNaN(dueDate.getTime())) {
      return NextResponse.json({ error: 'Invalid dueAt date' }, { status: 400 })
    }

    const homework = await prisma.homework.create({
      data: {
        courseId,
        title: title.trim(),
        description: description ? description.trim() : null,
        fileUrls: Array.isArray(fileUrls) ? fileUrls : [],
        dueAt: dueDate,
        isOpen: isOpen === undefined ? true : Boolean(isOpen),
        createdById: session.userId,
      },
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
        actionType: 'HOMEWORK_CREATED',
        actionDescription: `Created homework: ${homework.title}`,
        moduleName: MODULE.COURSES,
        targetId: homework.id,
      })
    } catch (_) {}

    return NextResponse.json(homework, { status: 201 })
  } catch (error: any) {
    console.error('Error creating homework:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
