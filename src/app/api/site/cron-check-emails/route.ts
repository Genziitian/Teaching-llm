import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured } from '@/lib/storefront/db'
import { processAutomatedEmails } from '@/lib/site/automated-emails'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = request.headers.get('authorization') || ''
  if (!cronSecret) return false
  const expected = Buffer.from(`Bearer ${cronSecret}`)
  const provided = Buffer.from(authHeader)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

/**
 * GET /api/site/cron-check-emails
 * Storefront automated emails (abandoned checkout, nudge, miss-you). Run once a day by a cron
 * service with `Authorization: Bearer $CRON_SECRET`; managers/admins may also trigger it manually.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    const session = await getSession()
    if (session?.role !== 'MANAGER' && session?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
    }
  }

  const welcomeWebhookUrl = process.env.WELCOME_WEBHOOK_URL?.trim()
  if (!welcomeWebhookUrl || !isStorefrontConfigured()) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
  }

  try {
    const report = await processAutomatedEmails(welcomeWebhookUrl)
    console.log(
      `[site:cron-check-emails] sent abandoned=${report.abandonedSent.length} nudge=${report.nudgeSent.length} missyou=${report.missyouSent.length}`
    )
    return NextResponse.json({ success: true, report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    console.error('[site:cron-check-emails] error:', err?.message || 'unknown')
    return NextResponse.json({ error: 'Failed to process automated emails' }, { status: 500 })
  }
}
