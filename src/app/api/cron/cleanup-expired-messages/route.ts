import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { runExpiredMessagesCleanup } from '@/lib/scheduler'

export const dynamic = 'force-dynamic'

/** Manual trigger. The same job already runs daily from lib/scheduler.ts. */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isAuthorizedCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)
    const session = await getSession()
    const isManager = session?.role === 'MANAGER' || session?.role === 'ADMIN' || session?.role === 'MODERATOR'
    if (!isAuthorizedCron && !isManager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ success: true, ...(await runExpiredMessagesCleanup()) })
  } catch (error) {
    console.error('[expired-messages-cleanup] Cleanup failed:', error)
    return NextResponse.json(
      { error: 'Failed to clean up expired announcements and notifications' },
      { status: 500 }
    )
  }
}
