import { prisma } from '@/lib/db'
import {
  assignAllUsersToPoolCategory,
  flushCategoryOverflowQueue,
  ensureDefaultPoolCategory,
} from '@/lib/notification-group-pool'
import { triggerGoogleGroupSyncProcessing } from '@/lib/google-group-sync'
import { autoCloseInactiveTickets } from '@/lib/support-ticket-access'

const NOTIFICATION_RETENTION_DAYS = 90
const ANNOUNCEMENT_RETENTION_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

/** Give every user who has no group mail yet one and queue the Google adds. Safe to repeat. */
export async function runAssignNotificationGroups() {
  const category = await ensureDefaultPoolCategory(prisma)
  const flushed = await flushCategoryOverflowQueue(prisma, category.id, { limitRetries: true })
  const assigned = await assignAllUsersToPoolCategory(prisma, category.id, { limitRetries: true })
  triggerGoogleGroupSyncProcessing()
  return {
    pendingFlushed: flushed.assigned,
    newlyAssigned: assigned.count,
    message: assigned.message,
  }
}

/** Delete notifications + announcements older than 90 days, and auto-close idle support tickets. */
export async function runExpiredMessagesCleanup() {
  const closedTickets = await autoCloseInactiveTickets()
  const notificationCutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * DAY_MS)
  const announcementCutoff = new Date(Date.now() - ANNOUNCEMENT_RETENTION_DAYS * DAY_MS)

  const result = await prisma.$transaction(async tx => {
    const notifications = await tx.notification.deleteMany({
      where: { createdAt: { lt: notificationCutoff } },
    })
    const announcements = await tx.announcement.deleteMany({
      where: { createdAt: { lt: announcementCutoff } },
    })
    return {
      deletedNotifications: notifications.count,
      deletedAnnouncements: announcements.count,
    }
  })

  return {
    notificationRetentionDays: NOTIFICATION_RETENTION_DAYS,
    announcementRetentionDays: ANNOUNCEMENT_RETENTION_DAYS,
    notificationCutoff: notificationCutoff.toISOString(),
    announcementCutoff: announcementCutoff.toISOString(),
    autoClosedTickets: closedTickets?.count ?? 0,
    ...result,
  }
}

type Job = { name: string; everyMs: number; firstRunMs: number; run: () => Promise<unknown> }

const JOBS: Job[] = [
  { name: 'assign-notification-groups', everyMs: 10 * 60 * 1000, firstRunMs: 60 * 1000, run: runAssignNotificationGroups },
  { name: 'cleanup-expired-messages', everyMs: DAY_MS, firstRunMs: 5 * 60 * 1000, run: runExpiredMessagesCleanup },
]

const g = globalThis as unknown as { __schedulerStarted?: boolean }

/**
 * Runs the background jobs inside the web server itself (no external cron needed).
 * Started once from instrumentation.ts. Skipped in dev; set ENABLE_SCHEDULER=false to turn off.
 */
export function startScheduler() {
  if (g.__schedulerStarted) return
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SCHEDULER === 'false') return
  g.__schedulerStarted = true

  for (const job of JOBS) {
    let running = false
    const tick = async () => {
      if (running) return
      running = true
      try {
        await job.run()
      } catch (err) {
        console.error(`[scheduler] ${job.name} failed:`, err instanceof Error ? err.message : err)
      } finally {
        running = false
      }
    }
    setTimeout(() => {
      tick()
      setInterval(tick, job.everyMs).unref?.()
    }, job.firstRunMs).unref?.()
  }
  console.log('[scheduler] started:', JOBS.map(j => j.name).join(', '))
}
