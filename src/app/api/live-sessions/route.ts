import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getFullSession, getSession, isAdminOrManager, getAccessibleCourseIds } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { getTodaySessionSnapshots } from '@/lib/daily-session-sync'
import { sendClassScheduledNotification } from '@/lib/system-notifications'

export async function GET(request: NextRequest) {
  try {
    const session = await getFullSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const sessions = await getTodaySessionSnapshots(session)

    // Fetch today's mentorship bookings for this user
    const { startOfDay, endOfDay } = require('@/lib/date-utils').getISTDayBoundaries()
    const todayStr = startOfDay.toISOString().split('T')[0]
    
    const mentorshipBookings = await prisma.mentorshipBooking.findMany({
      where: {
        userId: session.userId,
        status: 'PAID',
        slotDate: todayStr
      },
      include: {
        mentorship: {
          select: {
            mentorName: true,
          }
        }
      }
    })

    const mentorshipSessions = mentorshipBookings.map(b => ({
      id: `mentorship-${b.id}`,
      title: `Mentorship: ${b.mentorship.mentorName}`,
      description: `1-on-1 Session with ${b.mentorship.mentorName}`,
      startTime: new Date(`${b.slotDate}T${b.slotTime}:00`).toISOString(),
      endTime: new Date(new Date(`${b.slotDate}T${b.slotTime}:00`).getTime() + 30 * 60000).toISOString(), // Default 30m if unknown
      meetLink: b.meetLink,
      type: 'mentorship',
      status: 'scheduled', // status will be recalculated by frontend
      course: { name: '1-on-1 Mentorship', color: '#f59e0b', teacherName: b.mentorship.mentorName },
      instructor: { name: b.mentorship.mentorName }
    }))

    const allSessions = [...sessions, ...mentorshipSessions]

    const filtered = !status
      ? allSessions
      : allSessions.filter((item) => {
          if (status === 'live') return item.status === 'live'
          if (status === 'scheduled') return item.status === 'upcoming' || item.status === 'rescheduled'
          if (status === 'completed') return item.status === 'completed' || item.status === 'cancelled'
          return true
        })

    return NextResponse.json(filtered, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  } catch (error) {
    console.error('Error fetching live sessions:', error)
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

    const { courseId, title, description, meetLink, instructorId, startTime, endTime } =
      await request.json()

    // Verify ADMIN has access to the target class
    if (session.role === 'ADMIN') {
      const accessibleCourseIds = await getAccessibleCourseIds(session.userId, session.role)
      if (accessibleCourseIds !== null && !accessibleCourseIds.includes(courseId)) {
        return NextResponse.json({ error: 'No access to this class' }, { status: 403 })
      }
    }

    const courseEvent = await prisma.courseEvent.create({
      data: {
        courseId: courseId || null,
        title,
        description: description || null,
        meetLink: meetLink || null,
        instructorId: instructorId || null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        type: 'class',
        status: 'SCHEDULED',
        createdById: session.userId,
      },
    })

    if (courseId) {
      await sendClassScheduledNotification(
        courseId,
        courseEvent.title,
        courseEvent.startTime,
        courseEvent.meetLink,
        courseEvent.id
      )
    }

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.SESSION_CREATED,
      actionDescription: `${session.name} created live session "${title}"`,
      moduleName: MODULE.LIVE_SESSIONS,
      targetId: courseEvent.id,
    })

    return NextResponse.json(courseEvent, { status: 201 })
  } catch (error) {
    console.error('Error creating live session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
