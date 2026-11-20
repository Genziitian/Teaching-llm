import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

// Manager-only. Records that a paid order was refunded (or undoes that). It does NOT move money:
// the actual refund is done in Razorpay. Optionally removes course access the order gave.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'MANAGER') return NextResponse.json({ error: 'Only managers can change refunds' }, { status: 403 })

    const { id, refunded, removeAccess } = await request.json()
    if (!id || typeof refunded !== 'boolean') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const order = await prisma.order.findUnique({ where: { id }, include: { items: { select: { courseId: true } }, user: { select: { name: true } } } })
    if (!order) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    const from = refunded ? 'PAID' : 'REFUNDED'
    if (order.status !== from) return NextResponse.json({ error: refunded ? 'Only paid orders can be marked refunded' : 'This order is not marked refunded' }, { status: 400 })

    await prisma.order.update({ where: { id }, data: { status: refunded ? 'REFUNDED' : 'PAID' } })

    let removed = 0
    if (refunded && removeAccess) {
      for (const { courseId } of order.items) {
        // Keep access if the student paid for the same course in another order.
        const other = await prisma.orderItem.count({ where: { courseId, order: { userId: order.userId, status: 'PAID', id: { not: id } } } })
        if (other > 0) continue
        const r = await prisma.enrollment.deleteMany({ where: { userId: order.userId, courseId } })
        removed += r.count
      }
    }

    logActivity({
      userId: session.userId, userName: session.name, userRole: session.role,
      actionType: ACTION.COURSE_UPDATED,
      actionDescription: `${session.name} marked ${order.user?.name || 'a student'}'s order ₹${order.amount} as ${refunded ? 'refunded' : 'paid again'}${removed ? ` and removed ${removed} enrollment(s)` : ''}`,
      moduleName: MODULE.COURSES, targetId: id,
    })
    return NextResponse.json({ ok: true, status: refunded ? 'REFUNDED' : 'PAID', removed })
  } catch (error) {
    console.error('[transactions/refund] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
