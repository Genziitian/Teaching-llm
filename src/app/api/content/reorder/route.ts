import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, canManageContent, canEditCourseContent } from '@/lib/auth'

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    // STRICTLY MANAGER ONLY
    if (!session || !canManageContent(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // STRICT RULE: Only allow updating 'order', strictly forbid 'topicId' updates.
    // Ensure we fetch current parent topic to validate they aren't trying to change parents.
    const ids = items.map((i: any) => i.id)
    const existing = await prisma.content.findMany({
      where: { id: { in: ids } },
      select: { id: true, topicId: true }
    })

    if (session.role !== 'MANAGER') {
      // Every topic being reordered (own or imported-into) must be in an assigned course
      const scopeTopicIds = Array.from(new Set(
        items.map((i: any) => (i.isImported ? i.topicId : existing.find(e => e.id === i.id)?.topicId))
      ))
      if (scopeTopicIds.some(t => !t)) {
        return NextResponse.json({ error: 'No access to this course' }, { status: 403 })
      }
      const scopeTopics = await prisma.topic.findMany({
        where: { id: { in: scopeTopicIds as string[] } },
        select: { courseId: true },
      })
      const scopeCourseIds = Array.from(new Set(scopeTopics.map(t => t.courseId)))
      if (scopeTopics.length !== scopeTopicIds.length || !(await canEditCourseContent(session, scopeCourseIds))) {
        return NextResponse.json({ error: 'No access to this course' }, { status: 403 })
      }
    }
    
    const existingMap = new Map(existing.map(e => [e.id, e.topicId]))

    const updates = []
    for (const item of items) {
      if (item.isImported) {
        // Safe update: update order in TopicSharedContent
        updates.push(
          prisma.topicSharedContent.update({
            where: { topicId_contentId: { topicId: item.topicId, contentId: item.id } },
            data: { order: item.order },
          })
        )
        continue
      }

      const currentTopicId = existingMap.get(item.id)
      if (!currentTopicId) continue

      // If client requests changing parent topic for standard content, strictly reject
      if (item.topicId && item.topicId !== currentTopicId) {
        return NextResponse.json({ 
          error: 'Moving lectures between topics is strictly prohibited.' 
        }, { status: 400 })
      }

      // Safe update: only 'order' is mutated
      updates.push(
        prisma.content.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    }

    await prisma.$transaction(updates)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error reordering lectures:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
