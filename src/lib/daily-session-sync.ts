import { prisma } from '@/lib/db'
import { getISTDayBoundaries, getEventStatus, formatIST, formatISTDate } from '@/lib/date-utils'
import {
  sendClassScheduledNotification,
  sendClassRescheduledNotification,
  sendClassCanceledNotification,
} from './system-notifications'

type SessionRole = {
  userId: string
  role: string
  accessibleCourseIds: string[] | null
  enrollmentTypes: Record<string, string> // courseId → 'LIVE' | 'RECORDED'
}

export async function syncTodaySessions(createdById: string) {
  const { startOfDay, endOfDay } = getISTDayBoundaries()

  const events = await prisma.courseEvent.findMany({
    where: {
      type: 'class',
      startTime: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { startTime: 'asc' },
  })

  // Fetch old snapshots before deleting them to compare for changes
  const oldSnapshots = await (prisma as any).dailySessionSnapshot.findMany({
    where: { snapshotDate: startOfDay },
  })

  await prisma.$transaction(async (tx) => {
    await (tx as any).dailySessionSnapshot.deleteMany({
      where: { snapshotDate: startOfDay },
    })

    if (events.length === 0) return

    await (tx as any).dailySessionSnapshot.createMany({
      data: events.map((event) => ({
        snapshotDate: startOfDay,
        sourceEventId: event.id,
        title: event.title,
        description: event.description || null,
        startTime: event.startTime,
        endTime: event.endTime,
        meetLink: event.meetLink || null,
        status: event.status,
        courseId: event.courseId,
        isGlobal: event.isGlobal,
        instructorId: event.instructorId || null,
        createdById,
      })),
    })
  })

  // Compare oldSnapshots with current events to trigger notifications
  const oldMap = new Map((oldSnapshots as any[]).map(s => [s.sourceEventId, s]))
  const currentMap = new Map(events.map(e => [e.id, e]))

  const notificationTasks: Promise<any>[] = []

  // 1. Identify Cancelled or Deleted
  for (const oldSnapshot of (oldSnapshots as any[])) {
    if (!oldSnapshot.courseId) continue

    const currentEvent = currentMap.get(oldSnapshot.sourceEventId) as any
    // If it was deleted, or its status changed to CANCELLED but was not CANCELLED before
    if (!currentEvent || (currentEvent.status === 'CANCELLED' && oldSnapshot.status !== 'CANCELLED')) {
      notificationTasks.push(
        sendClassCanceledNotification(
          oldSnapshot.courseId,
          oldSnapshot.title,
          oldSnapshot.startTime,
          oldSnapshot.sourceEventId
        )
      )
    }
  }

  // 2. Identify New or Rescheduled
  for (const event of events) {
    if (event.status === 'CANCELLED' || !event.courseId) continue

    const oldSnapshot = oldMap.get(event.id) as any
    if (!oldSnapshot) {
      // New class scheduled for today
      notificationTasks.push(
        sendClassScheduledNotification(
          event.courseId,
          event.title,
          event.startTime,
          event.meetLink,
          event.id
        )
      )
    } else {
      // Was already scheduled. Check if start time changed, or if it transitioned to RESCHEDULED
      const timeChanged = event.startTime.getTime() !== oldSnapshot.startTime.getTime()
      const statusChangedToRescheduled = event.status === 'RESCHEDULED' && oldSnapshot.status !== 'RESCHEDULED'
      if (timeChanged || statusChangedToRescheduled) {
        notificationTasks.push(
          sendClassRescheduledNotification(
            event.courseId,
            event.title,
            event.startTime,
            event.meetLink,
            event.id
          )
        )
      }
    }
  }

  // Await all notifications so runtime doesn't cut them off mid-flight
  if (notificationTasks.length > 0) {
    await Promise.allSettled(notificationTasks)
  }

  return { snapshotDate: startOfDay, count: events.length }
}

export async function getTodaySessionSnapshots(session: SessionRole) {
  const { startOfDay } = getISTDayBoundaries()

  const where: Record<string, unknown> = {
    snapshotDate: startOfDay,
  }

  if (session.accessibleCourseIds !== null) {
    where.OR = [
      { isGlobal: true },
      { courseId: { in: session.accessibleCourseIds } },
    ]
  }

  const snapshots = await (prisma as any).dailySessionSnapshot.findMany({
    where,
    include: {
      course: { select: { id: true, name: true, color: true, subject: true, teacherName: true, liveUpgradePrice: true } },
      instructor: { select: { id: true, name: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  // streamProvider / streamStatus / instructorId live on CourseEvent and change
  // at runtime (e.g. host clicks Go Live → status flips to LIVE). Snapshotting
  // them at day-start would go stale. Batch-fetch the source events instead so
  // the live-sessions list always reflects current state.
  const sourceEventIds: string[] = snapshots
    .map((s: any) => s.sourceEventId)
    .filter((id: any): id is string => !!id)
  const sourceEventsById = sourceEventIds.length === 0 ? new Map() : new Map(
    (await prisma.courseEvent.findMany({
      where: { id: { in: sourceEventIds } },
      select: {
        id: true,
        instructorId: true,
        streamProvider: true,
        streamStatus: true,
        agoraChannelName: true,
        startedLiveAt: true,
        endedLiveAt: true,
      },
    })).map(ev => [ev.id, ev]),
  )

  return snapshots.map((snapshot: any) => {
    // Backend enforcement: strip meetLink for RECORDED enrollments
    // Global sessions always keep their meetLink
    const courseId = snapshot.courseId
    const enrollmentType = courseId ? session.enrollmentTypes[courseId] : null
    const isRecordedOnly = enrollmentType === 'RECORDED'
    const isGlobal = snapshot.isGlobal

    // Managers see everything; for students, hide meetLink if RECORDED and not global
    const effectiveMeetLink = (isRecordedOnly && !isGlobal) ? null : snapshot.meetLink

    const liveEvent = snapshot.sourceEventId ? sourceEventsById.get(snapshot.sourceEventId) : null

    return {
      id: snapshot.id,
      sourceEventId: snapshot.sourceEventId,
      title: snapshot.title,
      description: snapshot.description,
      startTime: snapshot.startTime.toISOString(),
      endTime: snapshot.endTime.toISOString(),
      date: formatISTDate(snapshot.startTime),
      time: formatIST(snapshot.startTime, { hour: 'numeric', minute: '2-digit', hour12: true }),
      meetLink: effectiveMeetLink,
      status: getEventStatus(snapshot.startTime, snapshot.endTime, snapshot.status),
      manualStatus: snapshot.status,
      courseId: snapshot.courseId,
      course: snapshot.course,
      instructor: snapshot.instructor,
      // instructorId from the live event is authoritative — students can't host
      // even if the snapshot's instructor relation lags behind a reassignment.
      instructorId: liveEvent?.instructorId ?? snapshot.instructorId ?? null,
      isGlobal: snapshot.isGlobal,
      isRecordedOnly, // Pass to frontend so it knows to hide UI elements
      enrollmentType,
      snapshotDate: snapshot.snapshotDate.toISOString(),
      syncedAt: snapshot.syncedAt.toISOString(),
      // Agora live-stream fields — always read from the live CourseEvent so
      // streamStatus reflects the host's most recent Go-Live/End action.
      streamProvider: liveEvent?.streamProvider ?? 'MEET',
      streamStatus: liveEvent?.streamStatus ?? 'SCHEDULED',
      agoraChannelName: liveEvent?.agoraChannelName ?? null,
      startedLiveAt: liveEvent?.startedLiveAt ? liveEvent.startedLiveAt.toISOString() : null,
      endedLiveAt: liveEvent?.endedLiveAt ? liveEvent.endedLiveAt.toISOString() : null,
    }
  })
}
