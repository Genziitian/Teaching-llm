import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isManager } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import {
  sendLiveClassNotification,
  sendClassRescheduledNotification,
  sendClassCanceledNotification,
} from '@/lib/system-notifications'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const event = await prisma.courseEvent.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, name: true, color: true, teacherName: true } },
        instructor: { select: { id: true, name: true } },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error fetching course event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      title, description, startTime, endTime, meetLink,
      type, courseId, classId, instructorId, status, isGlobal,
      recurrence, interval, originalStartTime, applyToFuture,
      streamProvider,
    } = body
    const resolvedCourseId = courseId ?? classId ?? null
    const normalizedProvider = streamProvider !== undefined
      ? (['MEET', 'YOUTUBE', 'DRIVE', 'AGORA'].includes(streamProvider) ? streamProvider : 'MEET')
      : undefined

    const existingEvent = await prisma.courseEvent.findUnique({
      where: { id },
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const isStartTimeChanged = startTime !== undefined && new Date(startTime).getTime() !== new Date(existingEvent.startTime).getTime()
    const isStatusChangedToCancelled = status === 'CANCELLED' && existingEvent.status !== 'CANCELLED'
    const isStatusChangedToRescheduled = status === 'RESCHEDULED' && existingEvent.status !== 'RESCHEDULED'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}
    if (isStartTimeChanged || isStatusChangedToRescheduled) {
      data.notified15mBefore = false
      data.notifiedAtStart = false
      data.notifiedStart = false
    }
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description || null
    if (startTime !== undefined) data.startTime = new Date(startTime)
    if (endTime !== undefined) data.endTime = new Date(endTime)
    if (meetLink !== undefined) data.meetLink = meetLink || null
    if (type !== undefined) data.type = type
    if (isGlobal !== undefined) data.isGlobal = !!isGlobal
    if (courseId !== undefined || classId !== undefined) data.courseId = isGlobal ? null : resolvedCourseId
    if (instructorId !== undefined) data.instructorId = instructorId || null
    if (status !== undefined) data.status = status
    if (recurrence !== undefined) data.recurrence = recurrence
    if (interval !== undefined) data.interval = interval ? parseInt(interval as string) : null
    if (originalStartTime !== undefined) {
      data.originalStartTime = originalStartTime ? new Date(originalStartTime) : null
    } else if (status === 'RESCHEDULED' && !existingEvent.originalStartTime) {
      data.originalStartTime = existingEvent.startTime
    }
    if (normalizedProvider !== undefined) {
      data.streamProvider = normalizedProvider
      if (normalizedProvider === 'AGORA') {
        // Pin the channel name on first switch to AGORA so /api/live/token
        // doesn't need to guess; keep existing channel name if it was set before.
        if (!existingEvent.agoraChannelName) data.agoraChannelName = `evt_${id}`
        // Clear meetLink when switching to AGORA so the UI doesn't show a stale link.
        if (meetLink === undefined) data.meetLink = null
      }
    }
    
    let updatedEvent

    const isRecurringSeriesEvent =
      !!existingEvent.parentId || (existingEvent.recurrence && existingEvent.recurrence !== 'ONETIME')

    if (applyToFuture && isRecurringSeriesEvent) {
      const chainRootId = existingEvent.parentId || existingEvent.id
      const nextStart = startTime !== undefined ? new Date(startTime) : existingEvent.startTime
      const nextEnd = endTime !== undefined ? new Date(endTime) : existingEvent.endTime
      const startShiftMs = nextStart.getTime() - existingEvent.startTime.getTime()
      const nextDurationMs = nextEnd.getTime() - nextStart.getTime()

      const futureEvents = await prisma.courseEvent.findMany({
        where: {
          OR: [
            { id: chainRootId },
            { parentId: chainRootId },
          ],
          startTime: { gte: existingEvent.startTime },
        },
        orderBy: { startTime: 'asc' },
      })

      const commonData: Record<string, any> = {}
      if (title !== undefined) commonData.title = title
      if (description !== undefined) commonData.description = description || null
      if (meetLink !== undefined) commonData.meetLink = meetLink || null
      if (type !== undefined) commonData.type = type
      if (isGlobal !== undefined) commonData.isGlobal = !!isGlobal
      if (courseId !== undefined || classId !== undefined) commonData.courseId = isGlobal ? null : resolvedCourseId
      if (instructorId !== undefined) commonData.instructorId = instructorId || null
      if (status !== undefined) commonData.status = status
      if (normalizedProvider !== undefined) commonData.streamProvider = normalizedProvider

      await prisma.$transaction(
        futureEvents.map((event) => {
          const shiftedStart = new Date(event.startTime.getTime() + startShiftMs)
          const shiftedEnd = new Date(shiftedStart.getTime() + nextDurationMs)
          const updateData: Record<string, any> = {
            ...commonData,
            startTime: shiftedStart,
            endTime: shiftedEnd,
          }

          if (isStartTimeChanged || isStatusChangedToRescheduled || startShiftMs !== 0) {
            updateData.notified15mBefore = false
            updateData.notifiedAtStart = false
            updateData.notifiedStart = false
          }

          if (event.id === chainRootId) {
            if (recurrence !== undefined) updateData.recurrence = recurrence
            if (interval !== undefined) updateData.interval = interval ? parseInt(interval as string) : null
          }

          return prisma.courseEvent.update({
            where: { id: event.id },
            data: updateData,
          })
        })
      )

      updatedEvent = await prisma.courseEvent.findUnique({ where: { id } })
    } else {
      updatedEvent = await prisma.courseEvent.update({
        where: { id },
        data,
      })
    }
    
    // Check if class status was transitioned to LIVE
    if (updatedEvent && updatedEvent.status === 'LIVE' && existingEvent.status !== 'LIVE' && updatedEvent.courseId) {
      await sendLiveClassNotification(updatedEvent.courseId, updatedEvent.title, updatedEvent.meetLink, updatedEvent.id)
    } else if (updatedEvent && isStatusChangedToCancelled && updatedEvent.courseId) {
      await sendClassCanceledNotification(updatedEvent.courseId, updatedEvent.title, updatedEvent.startTime, updatedEvent.id)
    } else if (updatedEvent && (isStartTimeChanged || isStatusChangedToRescheduled) && updatedEvent.courseId) {
      await sendClassRescheduledNotification(updatedEvent.courseId, updatedEvent.title, updatedEvent.startTime, updatedEvent.meetLink, updatedEvent.id)
    }

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.EVENT_UPDATED,
      actionDescription: `${session.name} updated course event "${updatedEvent?.title ?? existingEvent.title}"`,
      moduleName: MODULE.CALENDAR,
      targetId: id,
    })

    return NextResponse.json(updatedEvent)
  } catch (error) {
    console.error('Error updating course event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existingEvent = await prisma.courseEvent.findUnique({
      where: { id },
      select: { title: true, courseId: true, startTime: true },
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (existingEvent.courseId) {
      await sendClassCanceledNotification(existingEvent.courseId, existingEvent.title, existingEvent.startTime, id)
    }

    await prisma.courseEvent.delete({ where: { id } })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.EVENT_DELETED,
      actionDescription: `${session.name} deleted course event "${existingEvent?.title ?? ''}"`,
      moduleName: MODULE.CALENDAR,
      targetId: id,
    })

    return NextResponse.json({ message: 'Event deleted successfully' })
  } catch (error) {
    console.error('Error deleting course event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
