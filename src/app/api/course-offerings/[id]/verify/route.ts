import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { queueGoogleGroupSyncJobs } from '@/lib/google-group-sync'
import crypto from 'crypto'
import { sendEmailNotification } from '@/lib/email-service'
import { sendCourseEnrollmentNotification } from '@/lib/system-notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const razorpayPaymentId = body.razorpayPaymentId || body.razorpay_payment_id
    const razorpayOrderId = body.razorpayOrderId || body.razorpay_order_id
    const razorpaySignature = body.razorpaySignature || body.razorpay_signature

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
    }

    // Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex')

    if (expectedSignature !== razorpaySignature) {
      // Mark order as failed
      await prisma.order.updateMany({
        where: { razorpayOrderId },
        data: { status: 'FAILED' },
      })
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    // Find the pending order
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
      include: { items: true }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.userId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden - order does not belong to you' }, { status: 403 })
    }

    if (order.status === 'SUCCESS') {
      return NextResponse.json({ error: 'Order already processed', orderId: order.id }, { status: 400 })
    }

    const orderItem = order.items[0]
    if (!orderItem) {
       return NextResponse.json({ error: 'Order items missing' }, { status: 400 })
    }

    const courseId = orderItem.courseId
    const accessType = orderItem.accessType
    const offeringId = orderItem.courseOfferingId

    // Verify course
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { name: true },
    })

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Get offering details to know what they're buying
    let offeringDetails = { hasRecorded: true, hasLive: false, offeringName: '' }
    if (offeringId) {
      const offering = await prisma.courseOffering.findUnique({
        where: { id: offeringId },
        select: { hasRecorded: true, hasLive: true, name: true }
      })
      if (offering) {
        offeringDetails = {
          hasRecorded: offering.hasRecorded,
          hasLive: offering.hasLive,
          offeringName: offering.name
        }
      }
    }

    // Check existing enrollment
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.userId,
          courseId,
        },
      },
    })

    if (existingEnrollment) {
      if (existingEnrollment.type !== accessType) {
         // Update to LIVE if they bought LIVE and had RECORDED
         if (accessType === 'LIVE') {
           await prisma.enrollment.update({
             where: { id: existingEnrollment.id },
             data: { type: 'LIVE' }
           })
         }
      }
    } else {
      // Create new enrollment
      await prisma.enrollment.create({
        data: {
          userId: session.userId,
          courseId: courseId,
          type: accessType as 'RECORDED' | 'LIVE'
        }
      })

      sendCourseEnrollmentNotification(session.userId, courseId, order.amount).catch(console.error)

      // Sync Google Group if needed
      await queueGoogleGroupSyncJobs(prisma, {
        userEmail: session.email,
        courseIds: [courseId],
        action: 'ADD',
      })
    }

    // Mark order as successful
    await prisma.order.update({
      where: { id: order.id },
      data: {
        razorpayPaymentId,
        razorpaySignature,
        status: 'SUCCESS',
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.EXTERNAL_ENROLLMENT,
      actionDescription: `${session.name} purchased course "${course.name}" (${accessType}) for ₹${order.amount} — Order: ${order.id}`,
      moduleName: MODULE.ENROLLMENT,
      targetId: courseId,
    })

    // Send email via unified email service
    try {
      const accessTierLabel = accessType === 'LIVE' ? 'Live + Recorded (Pro)' : 'Recorded (General)'
      await sendEmailNotification('purchase', {
        userEmail: session.email,
        userName: session.name,
        orderId: order.id,
        itemName: course.name,
        offeringName: offeringDetails.offeringName,
        accessType: accessType,
        accessTier: accessTierLabel,
        amount: order.amount,
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      })
    } catch (emailErr) {
      console.error('Failed to send purchase email:', emailErr)
    }

    return NextResponse.json({
      message: 'Successfully purchased course!',
      orderId: order.id,
    })
  } catch (error) {
    console.error('Error verifying purchase:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
