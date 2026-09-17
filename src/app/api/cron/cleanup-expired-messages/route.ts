import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { autoCloseInactiveTickets } from '@/lib/support-ticket-access'

export const dynamic = 'force-dynamic'

const RETENTION_DAYS = 30

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isAuthorizedCron = Boolean(
      cronSecret && authHeader === `Bearer ${cronSecret}`
    )

    const session = await getSession()
    const isManager = session?.role === 'MANAGER' || session?.role === 'ADMIN'

    if (!isAuthorizedCron && !isManager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const closedTickets = await autoCloseInactiveTickets()

    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    )

    const result = await prisma.$transaction(async tx => {
      // Remove dependent/user-specific records first. announcementId is not a
      // Prisma relation today, but this order also remains safe if it becomes one.
      const notifications = await tx.notification.deleteMany({
        where: { createdAt: { lt: cutoff } },
      })
      const announcements = await tx.announcement.deleteMany({
        where: { createdAt: { lt: cutoff } },
      })

      return {
        deletedNotifications: notifications.count,
        deletedAnnouncements: announcements.count,
      }
    })

    return NextResponse.json({
      success: true,
      retentionDays: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      autoClosedTickets: closedTickets?.count ?? 0,
      ...result,
    })
  } catch (error) {
    console.error('[expired-messages-cleanup] Cleanup failed:', error)
    return NextResponse.json(
      { error: 'Failed to clean up expired announcements and notifications' },
      { status: 500 }
    )
  }
}
