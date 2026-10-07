import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, canManageContent, canEditCourseContent } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { isCourseEffectivelyDisabled } from '@/lib/course-state'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const course = await (prisma.course.findUnique as any)({
      where: { id },
      select: { isDisabled: true, expiresAt: true },
    })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (isCourseEffectivelyDisabled(course) && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Course is currently disabled' }, { status: 403 })
    }

    // Course Access Control: Check enrollment for students
    let isDemoUser = false
    if (session.role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: session.userId,
            courseId: id,
          },
        },
      })

      if (!enrollment) {
        return NextResponse.json({ error: 'You are not enrolled in this course' }, { status: 403 })
      }
      if (enrollment.type === 'DEMO') {
        isDemoUser = true
      }
    }

    const topics = await (prisma.topic.findMany as any)({
      where: { courseId: id },
      orderBy: { order: 'asc' },
      include: {
        content: {
          where: {
            isRecordingOnly: false,
          },
          orderBy: { order: 'asc' },
        },
        sharedContentLinks: {
          include: {
            content: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    const mergedTopics = topics.map(topic => {
      const importedContent = topic.sharedContentLinks.map(link => ({
        ...link.content,
        order: link.order,
        isImported: true,
        importedIntoTopicId: topic.id,
        createdAt: link.createdAt,
      }))

      const allItems = [...topic.content.map(item => ({ ...item, isImported: false })), ...importedContent].sort((a, b) => a.order - b.order)

      const processedContent = allItems.map(item => {
        if (isDemoUser && !item.isDemo) {
          return {
            ...item,
            isDemoLocked: true,
            videoUrl: null,
            youtubeUrl: null,
            pptUrl: null,
            videoVariants: null,
          }
        }
        return {
          ...item,
          isDemoLocked: false,
        }
      })

      return {
        ...topic,
        content: processedContent,
      }
    })

    return NextResponse.json(mergedTopics)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const course = await (prisma.course.findUnique as any)({
      where: { id },
      select: { isDisabled: true, expiresAt: true },
    })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (isCourseEffectivelyDisabled(course) && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Course is currently disabled' }, { status: 403 })
    }

    // Course Access Control: Check enrollment for students
    // Admin/Manager can manage content regardless.
    if (session.role === 'STUDENT') {
       const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: session.userId, courseId: id } }
      })
      if (!enrollment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!canManageContent(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!(await canEditCourseContent(session, [id]))) {
      return NextResponse.json({ error: 'No access to this course' }, { status: 403 })
    }

    const { title } = await request.json()

    const count = await prisma.topic.count({ where: { courseId: id } })
    const topic = await prisma.topic.create({
      data: { courseId: id, title, order: count },
      include: { content: true, sharedContentLinks: true },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.TOPIC_CREATED,
      actionDescription: `${session.name} created topic "${title}"`,
      moduleName: MODULE.TOPICS,
      targetId: topic.id,
    })

    return NextResponse.json(topic)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
