import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { getStorefrontRazorpaySecret } from '@/lib/site/razorpay'
import { enrollPaidStorefrontOrder } from '@/lib/site/enroll-order'
import { readBody, jsonRes } from '@/lib/site/http'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const res = jsonRes();

  try {
    const razorpaySecret = getStorefrontRazorpaySecret();
    // Only the Razorpay triple is read from the body. Email, courses, coupon, referral, coins and
    // class type all come from the stored website_orders row (written server-side by create-order).
    // Older clients still send those fields; they are ignored.
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await readBody(request);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(body)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const signatureBuf = Buffer.from(String(razorpay_signature || ''), 'utf8');
    if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
      return res.status(400).json({ error: 'Signature mismatch' });
    }

    // Shared with the Razorpay webhook: atomically claims the order (CREATED -> PAID). Whichever of
    // verify-payment / webhook wins runs every side effect (LMS enrollment, sheet log, coupon usage,
    // referral reward, coin deduction) exactly once; the other (or a replay) just gets success.
    const result = await enrollPaidStorefrontOrder(request, {
      razorpayOrderId: String(razorpay_order_id),
      razorpayPaymentId: String(razorpay_payment_id),
    });

    if (result.notFound) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // As before, the payment is confirmed even if LMS enrollment failed (failures are logged for follow-up).
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('verify-payment error:', error?.message || 'unknown');
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
