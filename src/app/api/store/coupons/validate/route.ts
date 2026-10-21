import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { checkCoupon, roundForPlay } from '@/lib/coupon-rules'
import { getAppCouponsEnabled } from '@/lib/app-flags'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { code, bundleOfferingId, subtotal, perCourseAccessTypes, courseIds, playMode, originalSubtotal } = await request.json()

    if (!code) return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 })

    if (playMode === true && !(await getAppCouponsEnabled())) {
      return NextResponse.json({ error: 'Coupons are not available in the app yet.' }, { status: 403 })
    }

    const orderSubtotal = Number(subtotal) || 0
    const result = await checkCoupon({
      code,
      userId: session.userId,
      email: session.email,
      bundleOfferingId,
      courseIds: Array.isArray(courseIds) ? courseIds : perCourseAccessTypes ? Object.keys(perCourseAccessTypes) : [],
      accessTypes: perCourseAccessTypes ? (Object.values(perCourseAccessTypes) as string[]) : undefined,
      subtotal: orderSubtotal,
    })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { coupon, discountAmount } = result
    const body: Record<string, unknown> = {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount ?? null,
      discountAmount,
      message: `Coupon applied! You save ₹${discountAmount}`,
    }
    if (playMode === true) {
      const base = Number(originalSubtotal) || orderSubtotal
      const payable = roundForPlay(base, orderSubtotal - discountAmount, true)
      body.payable = payable
      body.discountAmount = Math.max(0, orderSubtotal - payable)
      body.message = `Coupon applied! You save ₹${body.discountAmount}`
    }
    return NextResponse.json(body)
  } catch (error) {
    console.error('[coupon-validate] Error:', error)
    return NextResponse.json({ error: 'Failed to validate coupon' }, { status: 500 })
  }
}
