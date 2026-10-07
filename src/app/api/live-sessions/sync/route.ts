import { NextResponse } from 'next/server'
import { getSession, isManager, canManageEvents } from '@/lib/auth'
import { syncTodaySessions } from '@/lib/daily-session-sync'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { prisma } from '@/lib/db'
import { queueUsersForSync } from '@/lib/sync-queue'

export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageEvents(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await syncTodaySessions(session.userId)

    const now = new Date()

    // Queue all other users for staggered sync
    await queueUsersForSync(session.userId)

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.SESSION_UPDATED,
      actionDescription: `${session.name} synced today's live sessions from calendar`,
      moduleName: MODULE.LIVE_SESSIONS,
    })

    return NextResponse.json({
      message: 'Today sessions synced successfully',
      count: result.count,
      snapshotDate: result.snapshotDate.toISOString(),
      lastSyncAt: now.toISOString(),
    })
  } catch (error) {
    console.error('Error syncing live sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
