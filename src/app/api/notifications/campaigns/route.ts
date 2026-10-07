import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager, canEditCourseContent, getAccessibleCourseIds } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { sendNotificationCampaign, processScheduledCampaigns } from '@/lib/campaign-processor'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Run failsafe trigger so pending campaigns process when viewing dashboard
    await processScheduledCampaigns().catch((err) =>
      console.error('[Failsafe Campaign Process] Error:', err)
    )

    // Moderators only see campaigns sent to their assigned courses
    let campaignWhere: Record<string, any> = {}
    if (session.role === 'MODERATOR') {
      const accessible = await getAccessibleCourseIds(session.userId, session.role)
      if (accessible !== null) campaignWhere = { targetType: 'COURSE', targetId: { in: accessible } }
    }

    const campaigns = await prisma.notificationCampaign.findMany({
      where: campaignWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { name: true, email: true, avatar: true } },
      },
    })

    return NextResponse.json(campaigns)
  } catch (error) {
    console.error('Error fetching notification campaigns:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const {
      title,
      body,
      imageUrl,
      ctaText,
      ctaLink,
      targetType,
      targetId,
      scheduledFor,
    } = await request.json()

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and Body message are required' }, { status: 400 })
    }

    if (targetType && !['ALL', 'COURSE', 'BUNDLE'].includes(targetType)) {
      return NextResponse.json({ error: 'Invalid audience target type' }, { status: 400 })
    }

    // Moderators can only notify one of their assigned courses
    if (session.role === 'MODERATOR' && (targetType !== 'COURSE' || !(await canEditCourseContent(session, [targetId])))) {
      return NextResponse.json({ error: 'You can only manage your assigned courses' }, { status: 403 })
    }

    const scheduledDate = scheduledFor ? new Date(scheduledFor) : null
    const isScheduledInFuture = scheduledDate && scheduledDate.getTime() > Date.now()

    // 1. Create the campaign in PENDING state
    const campaign = await prisma.notificationCampaign.create({
      data: {
        title,
        body,
        imageUrl: imageUrl || null,
        ctaText: ctaText || null,
        ctaLink: ctaLink || null,
        targetType: targetType || 'ALL',
        targetId: targetId || null,
        scheduledFor: scheduledDate,
        status: 'PENDING',
        createdById: session.userId,
      },
      include: {
        createdBy: { select: { name: true, email: true } },
      },
    })

    // 2. If it is immediate, send it right now!
    if (!isScheduledInFuture) {
      await sendNotificationCampaign(campaign.id)
    }

    // 3. Log manager activity
    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.ANNOUNCEMENT_CREATED,
      actionDescription: `${session.name} ${
        isScheduledInFuture ? 'scheduled' : 'sent'
      } push notification campaign "${title}" targeting ${targetType || 'ALL'}`,
      moduleName: MODULE.ANNOUNCEMENTS,
      targetId: campaign.id,
    })

    // Refresh the campaign state from DB to return accurate status
    const updatedCampaign = await prisma.notificationCampaign.findUnique({
      where: { id: campaign.id },
      include: {
        createdBy: { select: { name: true, email: true, avatar: true } },
      },
    })

    return NextResponse.json(updatedCampaign, { status: 201 })
  } catch (error) {
    console.error('Error creating notification campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
