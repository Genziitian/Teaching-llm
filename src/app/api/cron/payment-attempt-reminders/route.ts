import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ATTEMPT_WINDOW_MS, REMINDER_EVERY_MS, boughtLater, notifyAttemptOutcome, sendAttemptReminder } from '@/lib/payment-attempt-notify'

export const dynamic = 'force-dynamic'

// Runs every 4 hours: reminds abandoned checkouts, times them out after 24h.
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const okCron = Boolean(cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`)
    const session = await getSession()
    const staff = session?.role === 'MANAGER' || session?.role === 'ADMIN'
    if (!okCron && !staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = Date.now()
    const open = await prisma.paymentAttempt.findMany({ where: { status: 'STARTED' }, take: 500 })
    let reminded = 0, timedOut = 0
    for (const a of open) {
      if (await boughtLater(a)) {
        await prisma.paymentAttempt.update({ where: { id: a.id }, data: { status: 'SUPERSEDED', followUpStatus: 'RESOLVED', reason: 'Student purchased this later' } })
        continue
      }
      const age = now - a.createdAt.getTime()
      if (age >= ATTEMPT_WINDOW_MS) {
        const u = await prisma.paymentAttempt.update({ where: { id: a.id }, data: { status: 'TIMED_OUT', reason: a.reason ?? 'Checkout not completed in 24 hours' } })
        await notifyAttemptOutcome(u)
        timedOut++
      } else if (now - (a.lastReminderAt?.getTime() ?? a.createdAt.getTime()) >= REMINDER_EVERY_MS) {
        await sendAttemptReminder(a)
        reminded++
      }
    }
    return NextResponse.json({ success: true, reminded, timedOut })
  } catch (e) {
    console.error('payment-attempt-reminders failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
