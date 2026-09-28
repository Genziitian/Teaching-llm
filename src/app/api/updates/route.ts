import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isManager } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || !isManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [updates, settings, completedSept26Count] = await Promise.all([
      prisma.systemUpdate.findMany({
        where: { type: { in: ['WELCOME', 'CUSTOM'] } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          _count: { select: { views: true } },
          createdBy: { select: { name: true } },
        },
      }),
      prisma.updateSystemSettings.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', welcomeEnabled: true, customEnabled: true, sept26ProgressUpdateActive: false },
        update: {},
      }),
      prisma.user.count({
        where: { hasUpdatedProgressSept26: true },
      }),
    ])

    return NextResponse.json({ updates, settings, completedSept26Count })
  } catch (error) {
    console.error('Error fetching updates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !isManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title, content, type, imageUrl, isActive, priority,
      showDelay, frequency, intervalDays, courseIds,
      ctaText, ctaLink, startDate, endDate, animation,
    } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const validTypes = ['WELCOME', 'CUSTOM']
    if (type && !validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid update type. Must be WELCOME or CUSTOM.' }, { status: 400 })
    }

    const update = await prisma.systemUpdate.create({
      data: {
        title,
        content,
        type: type || 'CUSTOM',
        imageUrl: imageUrl || null,
        isActive: isActive !== false,
        priority: priority || 0,
        showDelay: showDelay || 0,
        frequency: frequency || 'ONCE',
        intervalDays: intervalDays || 0,
        courseIds: Array.isArray(courseIds) ? courseIds.join(',') : (courseIds || ''),
        ctaText: ctaText || null,
        ctaLink: ctaLink || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        animation: animation || null,
        createdById: session.userId,
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.UPDATE_CREATED,
      actionDescription: `Created ${update.type} update: ${update.title}`,
      moduleName: MODULE.UPDATES,
      targetId: update.id,
      priority: 1,
    })

    return NextResponse.json({ update }, { status: 201 })
  } catch (error) {
    console.error('Error creating update:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
