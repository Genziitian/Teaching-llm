import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'
import { getSession } from '@/lib/auth'
import { logActivity, MODULE, ACTION } from '@/lib/activity-log'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Update all bookings linked to this order with a transaction to ensure integrity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current bookings
      const currentBookings = await tx.mentorshipBooking.findMany({
        where: { razorpayOrderId: razorpay_order_id },
        include: {
          user: { select: { email: true, name: true } },
          mentorship: { select: { mentorName: true } }
        }
      })

      // 2. Double check for any conflicting PAID bookings
      for (const b of currentBookings) {
        const conflict = await tx.mentorshipBooking.findFirst({
          where: {
            id: { not: b.id },
            mentorshipId: b.mentorshipId,
            slotDate: b.slotDate,
            slotTime: b.slotTime,
            status: 'PAID'
          }
        })
        if (conflict) {
          throw new Error(`Slot ${b.slotDate} ${b.slotTime} was just booked by someone else.`)
        }
      }

      // 3. Mark as PAID
      await tx.mentorshipBooking.updateMany({
        where: { razorpayOrderId: razorpay_order_id },
        data: {
          status: 'PAID',
          orderId: razorpay_payment_id
        }
      })

      return currentBookings
    })

    // Trigger confirmation email and log activity for each booking
    const { sendEmailNotification } = require('@/lib/email-service')
    const { sendPaymentMail } = require('@/lib/payment-mail')
    const { user: userSession } = session as any;
    for (const booking of result) {
      logActivity({
        userId: userSession.id,
        userName: userSession.name || userSession.email || 'User',
        userRole: userSession.role,
        actionType: ACTION.PURCHASE_COMPLETED,
        actionDescription: `Booked mentorship session with ${booking.mentorship.mentorName} for ${booking.slotDate} at ${booking.slotTime}`,
        moduleName: MODULE.STORE,
        targetId: booking.id,
        metadata: {
          itemType: 'MENTORSHIP',
          amount: booking.amount,
          razorpayPaymentId: razorpay_payment_id
        }
      })

      sendPaymentMail({
        status: 'SUCCESS', itemType: 'MENTORSHIP', name: booking.user.name, email: booking.user.email,
        itemName: `Mentorship with ${booking.mentorship.mentorName} - ${booking.slotDate}, ${booking.slotTime}`,
        amount: booking.amount, paymentId: razorpay_payment_id, orderId: booking.id,
      }).catch(console.error)

      sendEmailNotification('mentorship_confirmed', {
        userEmail: booking.user.email,
        userName: booking.user.name,
        mentorName: booking.mentorship.mentorName,
        slotDate: booking.slotDate,
        slotTime: booking.slotTime,
        instruction: 'Please be available at the scheduled time.',
        note: 'A Google Meet invite will be shared with you soon. Please wait for it.',
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/courses/explore?view=mentorship`
      }).catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Payment verification error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
