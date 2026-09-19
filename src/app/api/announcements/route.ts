import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager, getAccessibleCourseIds, canCreateAnnouncements } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { sseEmitter } from '@/lib/sse'
import { sendPushToUsers, sendPushToAllStudents } from '@/lib/push'
import { sendFcmToUsers } from '@/lib/fcm'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessibleCourseIds = await getAccessibleCourseIds(session.userId, session.role)

    // MANAGER sees all announcements; others see global + their enrolled course announcements.
    // No date cutoff here — matches dashboard widget; cron handles hard-delete of old rows.
    const where = accessibleCourseIds === null
      ? {}
      : {
          OR: [
            { courseId: null },
            { courseId: { in: accessibleCourseIds } },
          ],
        }

    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, role: true, avatar: true, gender: true } },
        course: { select: { id: true, name: true, color: true } },
      },
    })

    const mapped = announcements.map(a => ({
      ...a,
      classId: a.courseId,
    }))
    return NextResponse.json(mapped)
  } catch (error) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canCreateAnnouncements(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { title, content, type, courseId, classId, imageUrl } = await request.json()
    const targetCourseId = courseId || classId

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        type: type || 'info',
        courseId: targetCourseId || null,
        createdById: session.userId,
        imageUrl: imageUrl || null,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true, avatar: true, gender: true } },
        course: { select: { id: true, name: true, color: true } },
      },
    })

    // Fan-out notifications: if targetCourseId is provided, notify only enrolled students;
    // otherwise notify all users
    let targetUsers: { id: string }[] = []

    if (targetCourseId) {
      // Notify only STUDENT-role users enrolled in the specified course
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: targetCourseId, user: { role: 'STUDENT' } },
        select: { userId: true },
      })
      targetUsers = enrollments.map(e => ({ id: e.userId }))
    } else {
      // Global announcement - notify all students
      const students = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: { id: true },
      })
      targetUsers = students.map(s => ({ id: s.id }))
    }

    // Also include all managers/super managers
    const managers = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'MANAGER' },
          { isSuperManager: true },
        ],
      },
      select: { id: true },
    })

    // De-duplicate users
    const combinedMap = new Map<string, { id: string }>()
    targetUsers.forEach(u => combinedMap.set(u.id, u))
    managers.forEach(m => combinedMap.set(m.id, { id: m.id }))
    targetUsers = Array.from(combinedMap.values())

    if (targetUsers.length > 0) {
      // Parse hidden metadata if any (for ctaText and ctaLink)
      const metaRegex = /<!-- fcm_meta:({.*?}) -->$/
      const match = content.match(metaRegex)
      let ctaText = ''
      let ctaLink = ''
      let parsedBody = content
      
      if (match) {
        try {
          const metadata = JSON.parse(match[1])
          ctaText = metadata.ctaText || ''
          ctaLink = metadata.ctaLink || ''
          parsedBody = content.replace(metaRegex, '').trim()
        } catch {
          // Ignore parse errors
        }
      }

      const truncatedContent = parsedBody.length > 100
        ? parsedBody.slice(0, 97) + '...'
        : parsedBody

      await prisma.notification.createMany({
        data: targetUsers.map(u => ({
          userId: u.id,
          title: `New Announcement: ${title}`,
          content: truncatedContent,
          type: type?.toUpperCase() || 'INFO',
          announcementId: announcement.id,
        })),
      })

      // Notify connected clients via SSE
      targetUsers.forEach(u => sseEmitter.emit(`user:${u.id}:notify`))

      // Fire browser push notifications (works even when browser tab is closed)
      const targetUserIds = targetUsers.map(u => u.id)
      const pushBody = parsedBody.length > 120 ? parsedBody.slice(0, 117) + '...' : parsedBody
      
      let importance: 'high' | 'default' = 'high'
      let sound: 'default' | 'none' = 'default'
      if (match) {
        try {
          const metadata = JSON.parse(match[1])
          if (metadata.importance) importance = metadata.importance
          if (metadata.sound) sound = metadata.sound
        } catch {}
      }

      const pushPayload = {
        title,
        body: pushBody,
        url: ctaLink || '/announcements',
        tag: `announcement-${announcement.id}`,
        imageUrl: imageUrl || undefined,
        ctaText: ctaText || undefined,
        ctaLink: ctaLink || undefined,
        importance,
        sound,
      }
      
      // Per-user opt-out for the Announcements category. In-app notifications
      // above still fire (the bell badge is the source of truth); only the
      // push channel is filtered here so a muted user can still see history.
      const subscribedUsers = await prisma.user.findMany({
        where: {
          id: { in: targetUserIds },
          notifAnnouncementsEnabled: true,
        },
        select: { id: true },
      })
      const pushTargetIds = subscribedUsers.map(u => u.id)

      if (pushTargetIds.length > 0) {
        if (targetCourseId) {
          sendPushToUsers(pushTargetIds, pushPayload).catch(console.error)
          sendFcmToUsers(pushTargetIds, pushPayload).catch(console.error)
        } else {
          // Global announcement: web push still goes to all (no per-user pref
          // wired on the web subscription table yet); FCM uses the filtered
          // list so the Flutter toggle takes effect immediately.
          sendPushToAllStudents(pushPayload).catch(console.error)
          sendFcmToUsers(pushTargetIds, pushPayload).catch(console.error)
        }
      }
    }

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.ANNOUNCEMENT_CREATED,
      actionDescription: `${session.name} created announcement "${title}"`,
      moduleName: MODULE.ANNOUNCEMENTS,
      targetId: announcement.id,
    })

    return NextResponse.json({
      ...announcement,
      classId: announcement.courseId,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating announcement:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
