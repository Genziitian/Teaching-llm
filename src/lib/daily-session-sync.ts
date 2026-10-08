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
  const { startOfDay, endOfDay } = getISTDayBoundaries()

  const where: Record<string, unknown> = {
    snapshotDate: startOfDay,
  }

  const snapshots = await (prisma as any).dailySessionSnapshot.findMany({
    where,
    include: {
      course: { select: { id: true, name: true, color: true, subject: true, teacherName: true, liveUpgradePrice: true } },
      instructor: { select: { id: true, name: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  // Snapshots are used for per-user visibility, but CourseEvent is the source
  // of truth for schedule details. Calendar edits and deletions must show up
  // immediately in Live Sessions even if the background snapshot sync has not
  // run yet.
  const sourceEventIds: string[] = snapshots
    .map((s: any) => s.sourceEventId)
    .filter((id: any): id is string => !!id)
  const sourceEventsById = sourceEventIds.length === 0 ? new Map() : new Map(
    (await prisma.courseEvent.findMany({
      where: { id: { in: sourceEventIds } },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        meetLink: true,
        status: true,
        type: true,
        courseId: true,
        isGlobal: true,
        instructorId: true,
        streamProvider: true,
        streamStatus: true,
        agoraChannelName: true,
        startedLiveAt: true,
        endedLiveAt: true,
        course: { select: { id: true, name: true, color: true, subject: true, teacherName: true, liveUpgradePrice: true } },
        instructor: { select: { id: true, name: true } },
      },
    })).map(ev => [ev.id, ev]),
  )

  return snapshots.flatMap((snapshot: any) => {
    const liveEvent = snapshot.sourceEventId ? sourceEventsById.get(snapshot.sourceEventId) : null

    // A deleted event leaves an old snapshot behind until the next sync.
    // Ignore it, and use the current event fields for reschedules/edits.
    if (!liveEvent || liveEvent.type !== 'class') return []
    if (liveEvent.startTime < startOfDay || liveEvent.startTime > endOfDay) return []
    if (
      session.accessibleCourseIds !== null &&
      !liveEvent.isGlobal &&
      liveEvent.courseId &&
      !session.accessibleCourseIds.includes(liveEvent.courseId)
    ) return []

    // Backend enforcement: strip meetLink for RECORDED enrollments
    // Global sessions always keep their meetLink
    const courseId = liveEvent.courseId
    const enrollmentType = courseId ? session.enrollmentTypes[courseId] : null
    const isRecordedOnly = enrollmentType === 'RECORDED'
    const isGlobal = liveEvent.isGlobal || !courseId

    // Managers see everything; for students, hide meetLink if RECORDED and not global
    const effectiveMeetLink = (isRecordedOnly && !isGlobal) ? null : liveEvent.meetLink

    return {
      id: snapshot.id,
      sourceEventId: snapshot.sourceEventId,
      title: liveEvent.title,
      description: liveEvent.description,
      startTime: liveEvent.startTime.toISOString(),
      endTime: liveEvent.endTime.toISOString(),
      date: formatISTDate(liveEvent.startTime),
      time: formatIST(liveEvent.startTime, { hour: 'numeric', minute: '2-digit', hour12: true }),
      meetLink: effectiveMeetLink,
      status: getEventStatus(liveEvent.startTime, liveEvent.endTime, liveEvent.status),
      manualStatus: liveEvent.status,
      courseId: liveEvent.courseId,
      course: liveEvent.course,
      instructor: liveEvent.instructor,
      // instructorId from the live event is authoritative — students can't host
      // even if the snapshot's instructor relation lags behind a reassignment.
      instructorId: liveEvent.instructorId,
      isGlobal,
      isRecordedOnly, // Pass to frontend so it knows to hide UI elements
      enrollmentType,
      snapshotDate: snapshot.snapshotDate.toISOString(),
      syncedAt: snapshot.syncedAt.toISOString(),
      // Agora live-stream fields — always read from the live CourseEvent so
      // streamStatus reflects the host's most recent Go-Live/End action.
      streamProvider: liveEvent.streamProvider,
      streamStatus: liveEvent.streamStatus,
      agoraChannelName: liveEvent.agoraChannelName,
      startedLiveAt: liveEvent.startedLiveAt ? liveEvent.startedLiveAt.toISOString() : null,
      endedLiveAt: liveEvent.endedLiveAt ? liveEvent.endedLiveAt.toISOString() : null,
    }
  }).sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
}
