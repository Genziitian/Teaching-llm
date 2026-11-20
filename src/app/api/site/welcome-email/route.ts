import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { readBody } from '@/lib/site/http'

export const dynamic = 'force-dynamic'

/**
 * POST /api/site/welcome-email
 * Body: { name? } (a client-sent `email` is ignored). Sends the storefront welcome email to the
 * signed-in user through the WELCOME_WEBHOOK_URL Apps Script. Sent at most once per email: the send
 * is recorded in activity_logs (EMAIL_SENT / type welcome), the same ledger the email cron uses.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = session.email.trim().toLowerCase()
  const body = await readBody(request)
  const name =
    (typeof body.name === 'string' && body.name.trim() ? body.name.trim() : session.name || email.split('@')[0]).slice(0, 100)

  const url = process.env.WELCOME_WEBHOOK_URL?.trim()
  if (!url) {
    console.warn('[site:welcome-email] WELCOME_WEBHOOK_URL not set, skipping welcome email.')
    return NextResponse.json({ success: true })
  }

  try {
    const supabase = isStorefrontConfigured() ? storefrontDb() : null

    if (supabase) {
      const { data: sent, error } = await supabase
        .from('activity_logs')
        .select('id')
        .eq('email', email)
        .eq('action', 'EMAIL_SENT')
        .contains('metadata', { type: 'welcome' })
        .limit(1)
      if (error) throw error
      if (sent && sent.length > 0) return NextResponse.json({ success: true, skipped: true })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, type: 'welcome', timestamp: new Date().toISOString() }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Welcome webhook returned ${res.status}`)
    } finally {
      clearTimeout(timeout)
    }

    if (supabase) {
      const { error: logError } = await supabase.from('activity_logs').insert({
        email,
        action: 'EMAIL_SENT',
        metadata: { type: 'welcome', timestamp: new Date().toISOString() },
      })
      if (logError) console.error('[site:welcome-email] Failed to record send:', logError.message)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[site:welcome-email] error:', err?.message || 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
