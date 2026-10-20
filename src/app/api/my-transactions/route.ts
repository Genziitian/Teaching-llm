import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { paymentSource } from '@/lib/payment-source'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const upgrades = await prisma.upgradeTransaction.findMany({
      where: { userId: session.userId },
      include: {
        course: { select: { id: true, name: true, subject: true } },
      },
      orderBy: { createdAt: 'desc' }
    })

    const orders = await prisma.order.findMany({
      where: { userId: session.userId },
      include: {
        items: {
          include: {
            course: { select: { id: true, name: true, subject: true } },
            courseOffering: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const mentorships = await prisma.mentorshipBooking.findMany({
      where: { userId: session.userId, status: 'PAID' },
      include: { mentorship: { select: { mentorName: true } } },
      orderBy: { createdAt: 'desc' }
    })

    const testSeries = await prisma.testSeriesAccess.findMany({
      where: { userId: session.userId },
      include: { testSeries: { select: { title: true } } },
      orderBy: { createdAt: 'desc' }
    })

    const notes = await prisma.storeNoteAccess.findMany({
      where: { userId: session.userId },
      include: { note: { select: { title: true, price: true } } },
      orderBy: { createdAt: 'desc' }
    })

    const transactions = [
      ...upgrades.map(u => ({
        id: u.id,
        orderId: u.orderId,
        paymentId: u.razorpayPaymentId,
        amount: u.amount,
        status: u.status,
        createdAt: u.createdAt,
        type: 'UPGRADE',
        source: paymentSource(u.razorpayPaymentId, u.orderId),
        isExternal: false,
        courses: [
          {
            id: u.course.id,
            name: u.course.name,
            subject: u.course.subject,
            accessType: 'LIVE'
          }
        ]
      })),
      ...orders.map(o => {
        const firstItem = o.items[0]
        return {
          id: o.id,
          orderId: o.razorpayOrderId || o.id,
          paymentId: o.razorpayPaymentId,
          amount: o.amount,
          status: o.status,
          createdAt: o.createdAt,
          type: 'PURCHASE',
          source: paymentSource(o.razorpayPaymentId),
          isExternal: o.isExternal,
          courses: o.items.map(item => ({
            id: item.course.id,
            name: item.course.name,
            subject: item.course.subject,
            accessType: item.accessType
          }))
        }
      }),
      ...mentorships.map(m => ({
        id: m.id,
        orderId: m.razorpayOrderId || m.id,
        paymentId: m.orderId,
        amount: m.amount,
        status: 'SUCCESS',
        createdAt: m.createdAt,
        type: 'MENTORSHIP',
        source: paymentSource(m.orderId, m.razorpayOrderId),
        courses: [{ id: '', name: `Mentorship: ${m.mentorship.mentorName}`, subject: 'Mentorship', accessType: 'LIVE' }]
      })),
      ...testSeries.map(ts => ({
        id: ts.id,
        orderId: ts.razorpayPaymentId || ts.id,
        paymentId: ts.razorpayPaymentId,
        amount: ts.amount,
        status: 'SUCCESS',
        createdAt: ts.createdAt,
        type: 'TEST_SERIES',
        source: paymentSource(ts.razorpayPaymentId),
        courses: [{ id: '', name: `Test Series: ${ts.testSeries.title}`, subject: 'Test Series', accessType: 'RECORDED' }]
      })),
      ...notes.map(n => ({
        id: n.id,
        orderId: n.orderId || n.id,
        paymentId: n.orderId,
        amount: n.note.price,
        status: 'SUCCESS',
        createdAt: n.createdAt,
        type: 'STUDY_NOTE',
        source: paymentSource(n.orderId),
        courses: [{ id: '', name: `Study Note: ${n.note.title}`, subject: 'Study Notes', accessType: 'RECORDED' }]
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('Error fetching user transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
