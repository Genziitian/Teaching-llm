import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { findProfileByEmail } from '@/lib/site/profile'
import { readBody } from '@/lib/site/http'
import { getCourseSummary, sendToGoogleSheet } from '@/lib/site/google-sheet'

export const dynamic = 'force-dynamic'

const MAX_COURSE_IDS = 20

/**
 * POST /api/site/log-payment-failure
 * Body: { order_id?, failure_source?, courseIds? } (a client-sent `email` is ignored).
 * Logs a checkout the browser reported as failed to the storefront Google Sheet. Signed-in users
 * only; the row always uses the session email, and an order id is only used if it is theirs.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isStorefrontConfigured()) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
  }

  const body = await readBody(request)
  const email = session.email.trim().toLowerCase()
  const orderId = typeof body.order_id === 'string' ? body.order_id.trim().slice(0, 100) : ''
  const failureSource =
    typeof body.failure_source === 'string' && body.failure_source.trim()
      ? body.failure_source.trim().slice(0, 64)
      : 'FRONTEND_RAZORPAY'

  try {
    let orderAmount = 0
    let courseIds: string[] = Array.isArray(body.courseIds)
      ? body.courseIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100).slice(0, MAX_COURSE_IDS)
      : []

    if (orderId) {
      const { data: order, error } = await storefrontDb()
        .from('website_orders')
        .select('user_email, total_amount, course_ids')
        .eq('order_id', orderId)
        .maybeSingle()
      if (error) throw error
      if (!order || String(order.user_email || '').trim().toLowerCase() !== email) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      orderAmount = Number(order.total_amount || 0)
      if (Array.isArray(order.course_ids) && order.course_ids.length > 0) courseIds = order.course_ids
    }

    const [profile, { courseNames, classTypes }] = await Promise.all([
      findProfileByEmail(email, 'name, phone'),
      getCourseSummary(courseIds),
    ])

    await sendToGoogleSheet({
      name: profile?.name || session.name || 'Student',
      email,
      phone: profile?.phone || 'N/A',
      course_name: courseNames,
      price: orderAmount,
      status: 'FAILED',
      payment_id: 'failed_manual',
      order_id: orderId || null,
      failure_source: failureSource,
      referral_code: 'N/A',
      discount_code: 'N/A',
      coins_applied: 0,
      class_type: classTypes,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[site:log-payment-failure] error:', err?.message || 'unknown')
    return NextResponse.json({ error: 'Failed to log payment failure' }, { status: 500 })
  }
}
