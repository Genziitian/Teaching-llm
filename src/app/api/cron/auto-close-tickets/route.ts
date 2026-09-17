import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { autoCloseInactiveTickets, TICKET_AUTO_CLOSE_DAYS } from '@/lib/support-ticket-access'

export const dynamic = 'force-dynamic'

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

    const result = await autoCloseInactiveTickets()

    return NextResponse.json({
      success: true,
      autoCloseDays: TICKET_AUTO_CLOSE_DAYS,
      closedTicketsCount: result?.count ?? 0,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[auto-close-tickets] Cron failed:', error)
    return NextResponse.json(
      { error: 'Failed to auto-close inactive tickets' },
      { status: 500 }
    )
  }
}
