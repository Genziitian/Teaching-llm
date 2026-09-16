import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager, getAccessibleCourseIds, isManager } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { formatIST, getEventStatus } from '@/lib/date-utils'
import { sendClassScheduledNotification, sendClassCanceledNotification } from '@/lib/system-notifications'

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

// Compute status dynamically from time
// Status calculation now handled by getEventStatus in @/lib/date-utils

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const type = searchParams.get('type')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}

    // Filter by month (YYYY-MM)
    if (month) {
      const [y, m] = month.split('-').map(Number)
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0, 23, 59, 59, 999)
      where.startTime = { gte: start, lte: end }
    }

    if (type) where.type = type

    // Role-based course filtering
    const accessibleCourseIds = await getAccessibleCourseIds(session.userId, session.role)
    if (accessibleCourseIds !== null) {
      where.OR = [
        { courseId: null },   // GLOBAL events visible to everyone
        { courseId: { in: accessibleCourseIds } },
      ]
    }

    // Get user enrollments for meetLink security
    const userEnrollments = session.role === 'STUDENT'
      ? await prisma.enrollment.findMany({
          where: { userId: session.userId },
          select: { courseId: true },
        })
      : null
    const enrolledCourseIds = userEnrollments?.map(e => e.courseId) || []

    const events = await prisma.courseEvent.findMany({
      where,
      include: {
        course: { select: { id: true, name: true, color: true, teacherName: true } },
        instructor: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
    })

    // FETCH MENTORSHIP BOOKINGS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mentorshipWhere: Record<string, any> = { status: 'PAID' }
    if (month) {
      const [y, m] = month.split('-').map(Number)
      const startStr = `${y}-${String(m).padStart(2, '0')}-01`
      const lastDay = new Date(y, m, 0).getDate()
      const endStr = `${y}-${String(m).padStart(2, '0')}-${lastDay}`
      mentorshipWhere.slotDate = { gte: startStr, lte: endStr }
    }

    if (session.role === 'STUDENT') {
      mentorshipWhere.userId = session.userId
    } else if (session.role === 'INSTRUCTOR') {
      // Find mentorships where this instructor is the mentor
      const mentorOfferings = await prisma.mentorshipOffering.findMany({
        where: { mentorId: session.userId },
        select: { id: true }
      })
      mentorshipWhere.mentorshipId = { in: mentorOfferings.map(o => o.id) }
    }
    // Managers see all mentorship bookings

    const mentorshipBookings = await prisma.mentorshipBooking.findMany({
      where: mentorshipWhere,
      include: {
        user: { select: { name: true } },
        mentorship: { select: { mentorName: true, slotDuration: true } }
      }
    })

    // Map events with computed status and meetLink security
    const mapped = events.map(ev => {
      const status = getEventStatus(ev.startTime, ev.endTime, ev.status)
      const isGlobal = ev.isGlobal || !ev.courseId
      const isEnrolled = isGlobal || enrolledCourseIds.includes(ev.courseId || '')
      const canSeeMeetLink = isAdminOrManager(session.role) || session.role === 'INSTRUCTOR' || isEnrolled

      return {
        id: ev.id,
        title: ev.title,
        description: ev.description,
        startTime: ev.startTime.toISOString(),
        date: ev.startTime.toISOString().split('T')[0],
        time: formatIST(ev.startTime, { hour: '2-digit', minute: '2-digit', hour12: false }),
        endTime: formatIST(ev.endTime, { hour: '2-digit', minute: '2-digit', hour12: false }),
        meetLink: canSeeMeetLink ? ev.meetLink : null,
        meetingLink: canSeeMeetLink ? ev.meetLink : null, // alias
        type: ev.type,
        status,
        internalStatus: ev.status, // SCHEDULED, CANCELLED, RESCHEDULED
        courseId: ev.courseId,
        classId: ev.courseId,
        course: ev.course,
        class: ev.course,
        instructorId: ev.instructorId,
        instructor: ev.instructor,
        isGlobal: ev.isGlobal || !ev.courseId,
        recurrence: ev.recurrence,
        interval: ev.interval,
        parentId: ev.parentId,
        originalStartTime: ev.originalStartTime ? ev.originalStartTime.toISOString() : null,
        createdAt: ev.createdAt.toISOString(),
        streamProvider: ev.streamProvider,
        streamStatus: ev.streamStatus,
        agoraChannelName: ev.agoraChannelName,
        startedLiveAt: ev.startedLiveAt ? ev.startedLiveAt.toISOString() : null,
        endedLiveAt: ev.endedLiveAt ? ev.endedLiveAt.toISOString() : null,
      }
    })

    const mappedMentorships = mentorshipBookings.map(b => {
      const start = new Date(`${b.slotDate}T${b.slotTime}:00`)
      const duration = b.mentorship?.slotDuration || 30
      const end = new Date(start.getTime() + duration * 60000)
      
      return {
        id: b.id,
        title: `Mentorship: ${b.mentorship?.mentorName}${session.role === 'MANAGER' ? ` with ${b.user?.name}` : ''}`,
        description: `Mentorship session with ${b.mentorship?.mentorName}`,
        startTime: start.toISOString(),
        date: b.slotDate,
        time: b.slotTime,
        endTime: formatIST(end, { hour: '2-digit', minute: '2-digit', hour12: false }),
        meetLink: b.meetLink,
        type: 'event', // Using event type for consistent coloring
        status: 'SCHEDULED',
        courseId: null,
        isGlobal: false,
        createdAt: b.createdAt.toISOString(),
      }
    })

    return NextResponse.json([...mapped, ...mappedMentorships], {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  } catch (error) {
    console.error('Error fetching course events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title, description, startTime, endTime, meetLink,
      type, courseId, classId, courseIds, instructorId, status, isGlobal,
      recurrence, interval, customDates, repeatUntil,
      streamProvider,
    } = body

    if (!title || !startTime || !endTime) {
      return NextResponse.json({ error: 'Title, startTime, and endTime are required' }, { status: 400 })
    }

    // Determine list of course targets (multiple courses support)
    // If isGlobal is true, single event with courseId = null
    let targetCourseIds: (string | null)[] = [null]
    if (!isGlobal) {
      if (Array.isArray(courseIds) && courseIds.length > 0) {
        targetCourseIds = courseIds
      } else {
        const singleId = courseId ?? classId ?? null
        targetCourseIds = [singleId]
      }
    }

    // Whitelist the stream provider; default to MEET so older clients keep working.
    const normalizedProvider = ['MEET', 'YOUTUBE', 'DRIVE', 'AGORA'].includes(streamProvider)
      ? streamProvider
      : 'MEET'

    const createdEvents = []

    for (const targetCid of targetCourseIds) {
      const event = await prisma.courseEvent.create({
        data: {
          title,
          description: description || null,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          meetLink: normalizedProvider === 'AGORA' ? null : (meetLink || null),
          type: type || 'class',
          courseId: isGlobal ? null : targetCid,
          isGlobal: !!isGlobal,
          instructorId: instructorId || null,
          status: status || 'SCHEDULED',
          recurrence: recurrence || 'ONETIME',
          interval: interval ? parseInt(interval) : null,
          createdById: session.userId,
          streamProvider: normalizedProvider,
        },
      })

      // For Agora-backed events, deterministically derive the channel name
      if (normalizedProvider === 'AGORA') {
        await prisma.courseEvent.update({
          where: { id: event.id },
          data: { agoraChannelName: `evt_${event.id}` },
        })
      }

      // Generate recurring instances
      if (recurrence && recurrence !== 'ONETIME') {
        const occurrences = []
        const start = new Date(startTime)
        const end = new Date(endTime)
        const duration = end.getTime() - start.getTime()
        const defaultMaxWindowEnd = addDays(start, 30)
        const effectiveMaxWindowEnd = repeatUntil
          ? new Date(new Date(repeatUntil).setHours(23, 59, 59, 999))
          : defaultMaxWindowEnd

        if (recurrence === 'CUSTOM_DATES' && Array.isArray(customDates) && customDates.length > 0) {
          // Specific custom dates chosen by the manager
          const initialDateStr = start.toISOString().split('T')[0]
          for (const dStr of customDates) {
            if (dStr === initialDateStr) continue // Already created as root event
            const [y, m, d] = dStr.split('-').map(Number)
            const nextStart = new Date(start)
            nextStart.setFullYear(y, m - 1, d)
            const nextEnd = new Date(nextStart.getTime() + duration)

            occurrences.push({
              title,
              description: description || null,
              startTime: nextStart,
              endTime: nextEnd,
              meetLink: normalizedProvider === 'AGORA' ? null : (meetLink || null),
              type: type || 'class',
              courseId: isGlobal ? null : targetCid,
              isGlobal: !!isGlobal,
              instructorId: instructorId || null,
              status: 'SCHEDULED',
              recurrence: 'ONETIME',
              parentId: event.id,
              createdById: session.userId,
              streamProvider: normalizedProvider,
            })
          }
        } else {
          // Interval, daily, weekly, or weekdays
          for (let i = 1; ; i++) {
            let nextStart = new Date(start)
            if (recurrence === 'DAILY') {
              nextStart.setDate(start.getDate() + i)
            } else if (recurrence === 'WEEKDAYS') {
              nextStart.setDate(start.getDate() + i)
              // Skip weekends: Sunday is 0, Saturday is 6
              const dayOfWeek = nextStart.getDay()
              if (dayOfWeek === 0 || dayOfWeek === 6) {
                if (nextStart > effectiveMaxWindowEnd) break
                continue
              }
            } else if (recurrence === 'WEEKLY') {
              nextStart.setDate(start.getDate() + i * 7)
            } else if (recurrence === 'CUSTOM') {
              nextStart.setDate(start.getDate() + i * (interval || 1))
            } else {
              break
            }

            if (nextStart > effectiveMaxWindowEnd) break

            occurrences.push({
              title,
              description: description || null,
              startTime: nextStart,
              endTime: new Date(nextStart.getTime() + duration),
              meetLink: normalizedProvider === 'AGORA' ? null : (meetLink || null),
              type: type || 'class',
              courseId: isGlobal ? null : targetCid,
              isGlobal: !!isGlobal,
              instructorId: instructorId || null,
              status: 'SCHEDULED',
              recurrence: 'ONETIME',
              parentId: event.id,
              createdById: session.userId,
              streamProvider: normalizedProvider,
            })
          }
        }

        if (occurrences.length > 0) {
          await prisma.courseEvent.createMany({ data: occurrences })
        }
      }

      if (event.courseId && event.type === 'class' && event.status !== 'CANCELLED') {
        try {
          await sendClassScheduledNotification(
            event.courseId,
            event.title,
            event.startTime,
            event.meetLink,
            event.id
          )
        } catch (notifErr) {
          console.error('Failed to send class scheduled notification:', notifErr)
        }
      }

      createdEvents.push(event)
    }

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.EVENT_CREATED,
      actionDescription: `${session.name} created calendar event "${title}" (${createdEvents.length} course instance(s))`,
      moduleName: MODULE.CALENDAR,
      targetId: createdEvents[0]?.id,
    })

    return NextResponse.json(createdEvents.length === 1 ? createdEvents[0] : createdEvents, { status: 201 })
  } catch (error) {
    console.error('Error creating course event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { eventIds, notifyStudents } = body

    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json({ error: 'eventIds array is required' }, { status: 400 })
    }

    const eventsToDelete = await prisma.courseEvent.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, title: true, courseId: true, startTime: true },
    })

    if (notifyStudents) {
      for (const ev of eventsToDelete) {
        if (ev.courseId) {
          try {
            await sendClassCanceledNotification(ev.courseId, ev.title, ev.startTime, ev.id)
          } catch (notifErr) {
            console.error('Failed to send class cancelled notification for bulk delete:', notifErr)
          }
        }
      }
    }

    const result = await prisma.courseEvent.deleteMany({
      where: { id: { in: eventIds } },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.EVENT_DELETED,
      actionDescription: `${session.name} bulk deleted ${result.count} calendar events`,
      moduleName: MODULE.CALENDAR,
    })

    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Error bulk deleting course events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
