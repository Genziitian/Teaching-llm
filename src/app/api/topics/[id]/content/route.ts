import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, canManageContent, canEditCourseContent } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

export async function POST(
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


    const { title, description, videoUrl, youtubeUrl, pptUrl, videoSource, isDemo, duration } = await request.json()

    const count = await prisma.content.count({ where: { topicId: id } })
    const content = await prisma.content.create({
      data: {
        topicId: id,
        title,
        description,
        videoUrl,
        youtubeUrl,
        pptUrl,
        videoSource: videoSource || 'GOOGLE_DRIVE',
        isDemo: !!isDemo,
        duration: duration || null,
        order: count,
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.CONTENT_CREATED,
      actionDescription: `${session.name} created content "${title}"`,
      moduleName: MODULE.CONTENT,
      targetId: content.id,
    })

    return NextResponse.json(content)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
