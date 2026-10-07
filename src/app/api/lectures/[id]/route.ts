import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, canManageContent, canEditCourseContent } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { sendNewLectureNotification } from '@/lib/system-notifications'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const lecture = await prisma.lecture.findUnique({
      where: { id },
      include: {
        course: true,
        uploadedBy: { select: { name: true } },
      },
    })

    if (!lecture) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 })
    }

    return NextResponse.json(lecture)
  } catch (error) {
    console.error('Error fetching lecture:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageContent(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { courseId, title, description, videoUrl, notesUrl, duration, thumbnail } =
      await request.json()

    const current = await prisma.lecture.findUnique({ where: { id }, select: { courseId: true } })
    if (!current) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 })
    if (!(await canEditCourseContent(session, courseId ? [current.courseId, courseId] : [current.courseId]))) {
      return NextResponse.json({ error: 'No access to this course' }, { status: 403 })
    }


    const updatedLecture = await prisma.lecture.update({
      where: { id },
      data: { courseId: courseId, title, description, videoUrl, notesUrl, duration, thumbnail },
    })

    if (updatedLecture.courseId) {
      sendNewLectureNotification(updatedLecture.courseId, updatedLecture.title).catch(console.error)
    }

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.LECTURE_UPDATED,
      actionDescription: `${session.name} updated lecture "${updatedLecture.title}"`,
      moduleName: MODULE.LECTURES,
      targetId: id,
    })

    return NextResponse.json(updatedLecture)
  } catch (error) {
    console.error('Error updating lecture:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageContent(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params


    const existing = await prisma.lecture.findUnique({ where: { id }, select: { title: true, courseId: true } })
    if (!existing) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 })
    if (!(await canEditCourseContent(session, [existing.courseId]))) {
      return NextResponse.json({ error: 'No access to this course' }, { status: 403 })
    }

    await prisma.lecture.delete({ where: { id } })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.LECTURE_DELETED,
      actionDescription: `${session.name} deleted lecture "${existing?.title}"`,
      moduleName: MODULE.LECTURES,
      targetId: id,
    })

    return NextResponse.json({ message: 'Lecture deleted successfully' })
  } catch (error) {
    console.error('Error deleting lecture:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
