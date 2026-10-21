/**
 * Sends the payment emails (success / setup pending / failed) through the
 * Google Apps Script web app. Set PAYMENT_MAIL_WEBHOOK_URL to its URL.
 * Optional PAYMENT_MAIL_WEBHOOK_SECRET is sent as `secret` so the script can
 * reject anyone else. Never throws.
 */
export type PaymentMailItemType = 'COURSE' | 'NOTE' | 'PROTECTION' | 'MENTORSHIP'

export interface PaymentMailInput {
  status: 'SUCCESS' | 'ENROLLMENT_FAILED' | 'FAILED'
  itemType?: PaymentMailItemType
  name?: string | null
  email?: string | null
  phone?: string | null
  itemName: string
  amount?: number | null
  paymentId?: string | null
  orderId?: string | null
  classType?: string | null
  referralCode?: string | null
  discountCode?: string | null
  coinsApplied?: number | null
}

export function paymentMailEnabled() {
  return Boolean(process.env.PAYMENT_MAIL_WEBHOOK_URL)
}

export async function sendPaymentMail(i: PaymentMailInput): Promise<boolean> {
  const url = process.env.PAYMENT_MAIL_WEBHOOK_URL
  if (!url || !i.email) return false
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify({
        secret: process.env.PAYMENT_MAIL_WEBHOOK_SECRET || undefined,
        status: i.status,
        item_type: i.itemType || 'COURSE',
        name: i.name || 'Student',
        email: i.email,
        phone: i.phone || '',
        course_name: i.itemName,
        price: i.amount ?? 0,
        payment_id: i.paymentId || '',
        order_id: i.orderId || '',
        class_type: i.classType || '',
        referral_code: i.referralCode || '',
        discount_code: i.discountCode || '',
        coins_applied: i.coinsApplied || 0,
        timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      }),
    })
    if (!res.ok) console.error('[payment-mail] webhook responded', res.status)
    return res.ok
  } catch (e) {
    console.error('[payment-mail] failed:', e)
    return false
  }
}
