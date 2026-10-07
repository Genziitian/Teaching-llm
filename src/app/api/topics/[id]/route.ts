import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, canManageContent, canEditCourseContent } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canManageContent(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    const scopeTopic = await prisma.topic.findUnique({ where: { id }, select: { courseId: true } })
    if (!scopeTopic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    if (!(await canEditCourseContent(session, [scopeTopic.courseId]))) {
      return NextResponse.json({ error: 'No access to this course' }, { status: 403 })
    }

    const { title, order } = await request.json()

    const topic = await prisma.topic.update({
      where: { id },
      data: { ...(title !== undefined && { title }), ...(order !== undefined && { order }) },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.TOPIC_UPDATED,
      actionDescription: `${session.name} updated topic "${topic.title}"`,
      moduleName: MODULE.TOPICS,
      targetId: id,
    })

    return NextResponse.json(topic)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canManageContent(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    const scopeTopic = await prisma.topic.findUnique({ where: { id }, select: { courseId: true } })
    if (!scopeTopic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    if (!(await canEditCourseContent(session, [scopeTopic.courseId]))) {
      return NextResponse.json({ error: 'No access to this course' }, { status: 403 })
    }

    const topicToDelete = await prisma.topic.findUnique({
      where: { id },
      select: { title: true },
    })

    await prisma.topic.delete({ where: { id } })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.TOPIC_DELETED,
      actionDescription: `${session.name} deleted topic "${topicToDelete?.title ?? id}"`,
      moduleName: MODULE.TOPICS,
      targetId: id,
    })

    return NextResponse.json({ message: 'Topic deleted' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
