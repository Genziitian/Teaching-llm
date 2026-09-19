import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isManager } from '@/lib/auth'
import { ACTION, MODULE } from '@/lib/activity-log'

// GET: Return transcript data for a community (courseId query param)
// Manager-only — includes ALL messages, including deleted ones with original content
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!isManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden: Manager access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')

    // If no courseId, return list of all classes with message counts
    if (!courseId) {
      const classes = await prisma.course.findMany({
        where: { id: { not: 'general-discussion' } },
        select: {
          id: true,
          name: true,
          subject: true,
          color: true,
          _count: { select: { communityMessages: true } },
        },
        orderBy: { name: 'asc' },
      })

      const classesWithStats = await Promise.all(
        classes.map(async (cls) => {
          const deletedCount = await prisma.communityMessage.count({
            where: { courseId: cls.id, isDeleted: true },
          })
          return {
            id: cls.id,
            name: cls.name,
            subject: cls.subject,
            color: cls.color,
            totalMessages: cls._count.communityMessages,
            deletedMessages: deletedCount,
          }
        })
      )

      return NextResponse.json({ classes: classesWithStats })
    }

    // Fetch all messages for this class
    const messages = await prisma.communityMessage.findMany({
      where: { courseId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
            securityNumber: true,
          },
        },
        course: {
          select: {
            name: true,
            subject: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // For deleted messages, try to surface original content from activity logs (if available)
    const deletedIds = messages.filter(m => m.isDeleted).map(m => m.id)
    let logMap: Record<string, any> = {}
    if (deletedIds.length > 0) {
      try {
        const logs = await prisma.activityLog.findMany({
          where: {
            actionType: ACTION.MESSAGE_DELETED,
            moduleName: MODULE.COMMUNITY,
            targetId: { in: deletedIds },
          },
          orderBy: { timestamp: 'asc' },
        })
        logs.forEach(l => {
          try {
            logMap[l.targetId || ''] = l.metadata ? JSON.parse(l.metadata) : null
          } catch (e) {
            logMap[l.targetId || ''] = null
          }
        })
      } catch (err) {
        console.error('Failed to load activity logs for transcripts', err)
      }
    }

    const enriched = messages.map(m => {
      if (m.isDeleted) {
        const meta = logMap[m.id]
        const original = meta && meta.originalContent ? meta.originalContent : m.content
        return { ...m, content: original }
      }
      return m
    })

    return NextResponse.json({ messages: enriched })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
