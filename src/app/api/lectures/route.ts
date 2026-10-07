import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, canManageContent, canEditCourseContent } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { sendNewLectureNotification } from '@/lib/system-notifications'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId') || searchParams.get('courseId')

    const where = courseId ? { courseId } : {}

    const lectures = await prisma.lecture.findMany({
      where,
      include: {
        course: { select: { name: true } },
        uploadedBy: { select: { name: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json(lectures)
  } catch (error) {
    console.error('Error fetching lectures:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageContent(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { courseId, title, description, videoUrl, notesUrl, duration, thumbnail } =
      await request.json()

    if (!(await canEditCourseContent(session, [courseId]))) {
      return NextResponse.json({ error: 'No access to this course' }, { status: 403 })
    }


    const lecture = await prisma.lecture.create({
      data: {
        courseId: courseId,
        title,
        description,
        videoUrl,
        notesUrl,
        duration,
        thumbnail,
        uploadedById: session.userId,
      },
    })

    // Notify all enrolled students (non-blocking)
    if (lecture.courseId) {
      sendNewLectureNotification(lecture.courseId, lecture.title).catch(console.error)
    }

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.LECTURE_CREATED,
      actionDescription: `${session.name} created lecture "${title}"`,
      moduleName: MODULE.LECTURES,
      targetId: lecture.id,
    })

    return NextResponse.json(lecture, { status: 201 })
  } catch (error) {
    console.error('Error creating lecture:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
