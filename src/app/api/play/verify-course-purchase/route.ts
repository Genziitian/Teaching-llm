import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { verifyPlayPurchase } from '@/lib/google-play'
import { logActivity, MODULE, ACTION } from '@/lib/activity-log'
import { sendCourseEnrollmentNotification } from '@/lib/system-notifications'
import { sendEmailNotification } from '@/lib/email-service'

// Verifies a Google Play purchase for a course / bundle order created with
// `playMode: true`, then enrolls the user exactly like the Razorpay verify flow.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { orderId, purchaseToken, productId } = await request.json()
    if (!orderId || !purchaseToken || !productId) {
      return NextResponse.json({ error: 'Missing orderId, purchaseToken or productId' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { course: true } } },
    })
    if (!order || order.userId !== session.userId) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.status === 'SUCCESS') {
      return NextResponse.json({ message: 'Already purchased', orderId: order.id })
    }

    const expectedProduct = `course_${Math.round(order.amount)}`
    if (productId !== expectedProduct) {
      return NextResponse.json(
        { error: `Wrong Play product (${productId}). Expected ${expectedProduct}.` },
        { status: 400 }
      )
    }

    const playData = await verifyPlayPurchase({ productId, token: purchaseToken })
    if (playData.purchaseState !== 0) {
      return NextResponse.json({ error: 'Purchase is not completed on Google Play' }, { status: 400 })
    }
    const playOrderId = playData.orderId || `play_${Date.now()}`

    // The same Play purchase can never unlock two orders.
    const reused = await prisma.order.findFirst({
      where: { razorpayPaymentId: playOrderId, NOT: { id: order.id } },
      select: { id: true },
    })
    if (reused) {
      return NextResponse.json({ error: 'This purchase was already used' }, { status: 400 })
    }

    for (const item of order.items) {
      const maybeBundle = await prisma.bundleOffering.findUnique({ where: { id: item.courseId } })
      if (maybeBundle) continue

      const isChampion = item.accessType === 'CHAMPION'
      const enrollType = isChampion ? 'LIVE' : (item.accessType as 'RECORDED' | 'LIVE')
      const packageName = isChampion ? 'CHAMPION' : null

      const existing = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: session.userId, courseId: item.courseId } },
      })
      if (existing) {
        await prisma.enrollment.update({
          where: { id: existing.id },
          data: { type: enrollType, packageName: packageName || existing.packageName, isFreeEnrollment: false },
        })
      } else {
        await prisma.enrollment.create({
          data: { userId: session.userId, courseId: item.courseId, type: enrollType, packageName },
        })
        sendCourseEnrollmentNotification(session.userId, item.courseId, order.amount).catch(console.error)
        logActivity({
          userId: session.userId,
          userName: session.name || session.email || 'User',
          userRole: session.role,
          actionType: ACTION.PURCHASE_COMPLETED,
          actionDescription: `Enrolled in course via Google Play: ${item.courseId} (${item.accessType})`,
          moduleName: MODULE.STORE,
          targetId: item.courseId,
          metadata: { orderId: order.id, accessType: item.accessType, packageName, googlePlayOrderId: playOrderId, productId },
        })
      }

      try {
        const { queueGoogleGroupSyncJobs } = await import('@/lib/google-group-sync')
        await queueGoogleGroupSyncJobs(prisma, {
          userEmail: session.email,
          courseIds: [item.courseId],
          action: 'ADD',
          enrollmentTypeMap: { [item.courseId]: enrollType },
        })
      } catch (syncErr) {
        console.error('[play verify-course-purchase] Google Group sync failed:', syncErr)
      }
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { razorpayPaymentId: playOrderId, status: 'SUCCESS' },
    })

    // Count the coupon only once the Play payment is verified.
    if (order.couponId && order.couponCode) {
      try {
        await prisma.$transaction([
          prisma.coupon.update({
            where: { id: order.couponId },
            data: { currentUses: { increment: 1 }, totalRevenueGenerated: { increment: order.amount } },
          }),
          prisma.couponUsage.create({
            data: { couponId: order.couponId, userId: session.userId, orderId: order.id, revenue: order.amount },
          }),
        ])
      } catch (couponError) {
        console.error('[play verify-course-purchase] Coupon usage tracking failed (non-critical):', couponError)
      }
    }

    sendEmailNotification('purchase', {
      userEmail: session.email,
      userName: session.name,
      orderId: order.id,
      itemName: order.items.map(i => i.course.name).join(', '),
      amount: order.amount,
      date: new Date().toLocaleDateString(),
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/courses/explore`,
    }).catch(console.error)

    return NextResponse.json({ message: 'Successfully purchased', orderId: order.id })
  } catch (error: any) {
    console.error('[play verify-course-purchase] Error:', error)
    return NextResponse.json({ error: error?.message || 'Verification failed' }, { status: 500 })
  }
}
