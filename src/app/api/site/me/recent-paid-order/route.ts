import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { escapeLike } from '@/lib/site/http'
import { NO_STORE_HEADERS } from '@/lib/site/me'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 10 * 60 * 1000

/**
 * GET /api/site/me/recent-paid-order
 * The signed-in user's most recent PAID storefront order from the last 10 minutes (mobile
 * payment auto-recovery), or { order: null }. Scoped to the session email.
 */
export async function GET() {
  if (!isStorefrontConfigured()) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
  }
  const session = await getSession()
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
  }

  try {
    const since = new Date(Date.now() - WINDOW_MS).toISOString()
    const { data, error } = await storefrontDb()
      .from('website_orders')
      .select('*')
      .ilike('user_email', escapeLike(session.email.trim()))
      .eq('status', 'PAID')
      .gt('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw error

    const row: any = data?.[0]
    const order = row
      ? {
          order_id: row.order_id ?? null,
          status: row.status,
          course_ids: Array.isArray(row.course_ids) ? row.course_ids : Array.isArray(row.courses) ? row.courses : [],
          created_at: row.created_at,
        }
      : null
    return NextResponse.json({ order }, { headers: NO_STORE_HEADERS })
  } catch (err: any) {
    console.error('[site:me/recent-paid-order] error:', err?.message || 'unknown')
    return NextResponse.json({ error: 'Failed to check recent orders' }, { status: 500 })
  }
}
