import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { runAssignNotificationGroups } from '@/lib/scheduler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Manual trigger. The same job already runs every 10 minutes from lib/scheduler.ts. */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET?.trim()
    const isAuthorizedCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)
    const session = await getSession()
    const isStaff = session?.role === 'MANAGER' || session?.role === 'ADMIN'
    if (!isAuthorizedCron && !isStaff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ success: true, ...(await runAssignNotificationGroups()) })
  } catch (error) {
    console.error('[assign-notification-groups] failed:', error)
    return NextResponse.json({ error: 'Failed to assign notification groups' }, { status: 500 })
  }
}
