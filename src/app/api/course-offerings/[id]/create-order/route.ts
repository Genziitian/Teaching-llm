import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import Razorpay from 'razorpay'
import { checkCoupon, roundForPlay } from '@/lib/coupon-rules'
import { getAppCouponsEnabled } from '@/lib/app-flags'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const body = await request.json()
    const { accessType } = body // 'RECORDED' or 'LIVE'

    if (!['RECORDED', 'LIVE', 'CHAMPION'].includes(accessType)) {
      return NextResponse.json({ error: 'Invalid access type' }, { status: 400 })
    }

    const offering = await prisma.courseOffering.findUnique({
      where: { id: params.id },
      include: { course: { select: { id: true, name: true } } }
    })

    if (!offering) {
      return NextResponse.json({ error: 'Course offering not found' }, { status: 404 })
    }

    let price = 0
    if (accessType === 'RECORDED') {
      if (!offering.hasRecorded || offering.recordedDiscountPrice == null) {
        return NextResponse.json({ error: 'Recorded access is not available' }, { status: 400 })
      }
      price = offering.recordedDiscountPrice
    } else if (accessType === 'CHAMPION') {
      price = offering.championDiscountPrice ?? offering.championOriginalPrice ?? offering.liveDiscountPrice ?? 0
      if (price === 0) {
         return NextResponse.json({ error: 'Champion access is not available' }, { status: 400 })
      }
    } else {
      if (!offering.hasLive || offering.liveDiscountPrice == null) {
        return NextResponse.json({ error: 'Live access is not available' }, { status: 400 })
      }
      price = offering.liveDiscountPrice
    }

    // Check if user is already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.userId,
          courseId: offering.courseId
        }
      }
    })

    if (existingEnrollment) {
      if (existingEnrollment.type === 'LIVE') {
        return NextResponse.json({ error: 'You are already enrolled in the LIVE batch of this course.' }, { status: 400 })
      }
      // If they have RECORDED and are buying something, let it proceed (it will be an upgrade)
    }

    // Coupons are used in the Google Play app only (web checkout for single courses is unchanged).
    const subtotal = price
    let couponDiscountAmount = 0
    let appliedCouponId: string | null = null
    let appliedCouponCode: string | null = null
    if (body.playMode === true && body.couponCode && (await getAppCouponsEnabled())) {
      const checked = await checkCoupon({
        code: body.couponCode,
        userId: session.userId,
        email: session.email,
        courseIds: [offering.courseId],
        accessTypes: [accessType],
        subtotal: price,
      })
      if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: checked.status })
      const rounded = roundForPlay(subtotal, price - checked.discountAmount, true)
      couponDiscountAmount = Math.max(0, subtotal - rounded)
      price = rounded
      appliedCouponId = checked.coupon.id
      appliedCouponCode = checked.coupon.code
    }

    const amountInPaise = Math.round(price * 100)
    
    // Create pending order locally
    const order = await prisma.order.create({
      data: {
        userId: session.userId,
        amount: price,
        subtotalAmount: subtotal,
        couponDiscountAmount,
        couponCode: appliedCouponCode,
        couponId: appliedCouponId,
        status: 'PENDING',
        items: {
          create: {
            courseOfferingId: offering.id,
            courseId: offering.courseId,
            accessType,
            price: subtotal
          }
        }
      }
    })

    if (body.playMode === true) {
      return NextResponse.json({
        orderId: order.id,
        amount: amountInPaise,
        amountRupees: price,
        playProductId: `course_${Math.round(price)}`,
        subtotal,
        couponDiscountAmount,
        couponCode: appliedCouponCode,
        bundleName: offering.name,
        courseName: offering.course.name,
      })
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: order.id,
      notes: {
        orderId: order.id,
        courseOfferingId: offering.id,
        courseId: offering.courseId,
        userId: session.userId,
        userName: session.name || 'Student',
        type: 'COURSE_PURCHASE',
      },
    })

    // Update local order with Razorpay ID
    await prisma.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: razorpayOrder.id }
    })

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      courseName: offering.course.name,
      bundleName: offering.name,
      userName: session.name,
      userEmail: session.email,
    })
  } catch (error) {
    console.error('[create-order] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
