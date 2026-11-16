import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { enrollPaidStorefrontOrder } from '@/lib/site/enroll-order'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/site/razorpay-webhook
 * Razorpay webhook for the storefront account (mobile reliability: enrolls the buyer even when the
 * browser never reaches verify-payment). Authenticated only by X-Razorpay-Signature, an HMAC-SHA256
 * of the raw body with STOREFRONT_RAZORPAY_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STOREFRONT_RAZORPAY_WEBHOOK_SECRET?.trim()
  const signature = request.headers.get('x-razorpay-signature')?.trim()

  if (!secret || !signature) {
    if (!secret) console.error('[razorpay-webhook] STOREFRONT_RAZORPAY_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Missing webhook secret or signature' }, { status: 400 })
  }

  const rawBody = await request.text()
  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBuf = Buffer.from(expectedSignature, 'utf8')
  const signatureBuf = Buffer.from(signature, 'utf8')
  if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const event = body?.event
  if (event !== 'order.paid' && event !== 'payment.captured') {
    return NextResponse.json({ status: 'ok' })
  }

  const payment = body?.payload?.payment?.entity
  const orderId: string | undefined = payment?.order_id || body?.payload?.order?.entity?.id
  if (!payment?.id || !orderId) {
    console.warn(`[razorpay-webhook] ${event} without payment/order id, ignoring`)
    return NextResponse.json({ status: 'ok' })
  }

  if (!isStorefrontConfigured()) {
    // Non-2xx so Razorpay retries once the database is connected.
    console.error('[razorpay-webhook] Storefront database not configured')
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
  }

  try {
    const { data: order, error } = await storefrontDb()
      .from('website_orders')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle()
    if (error) throw error

    if (order && order.status !== 'PAID') {
      // All order details (incl. class type) come from the stored row inside the shared helper;
      // payment notes are client-controlled and are never used for enrollment.
      const result = await enrollPaidStorefrontOrder(request, {
        razorpayOrderId: orderId,
        razorpayPaymentId: String(payment.id),
      })
      if (!result.success && !result.alreadyProcessed) {
        console.error(`[razorpay-webhook] Order ${orderId} marked PAID but enrollment failed:`, result.error || 'unknown')
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (err: any) {
    console.error('[razorpay-webhook] Processing error:', err?.message || 'unknown')
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
