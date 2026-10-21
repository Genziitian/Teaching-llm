import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { notifyAttemptOutcome, settleEarlierAttempts } from '@/lib/payment-attempt-notify'

const KINDS = ['COURSE', 'BUNDLE', 'NOTE', 'PROTECTION', 'MENTORSHIP', 'OTHER']
const STATUSES = ['STARTED', 'FAILED', 'CANCELLED', 'PENDING_VERIFY', 'SUCCESS', 'TIMED_OUT', 'SUPERSEDED']
const FOLLOW_UPS = ['NEW', 'CONTACTED', 'RESOLVED', 'NO_RESPONSE']

function isStaff(role: string) {
  return role === 'MANAGER' || role === 'ADMIN' || role === 'MODERATOR'
}

const clean = (v: unknown, max = 300) =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null

/** Student: own attempts. Staff with ?all=1: every attempt, with the student's contact details. */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)

    if (searchParams.get('all') === '1') {
      if (!isStaff(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const status = searchParams.get('status')
      const follow = searchParams.get('followUp')
      const attempts = await prisma.paymentAttempt.findMany({
        where: {
          ...(status && status !== 'all' ? { status } : { status: { notIn: ['SUCCESS', 'SUPERSEDED'] } }),
          ...(follow && follow !== 'all' ? { followUpStatus: follow } : {}),
        },
        include: { user: { select: { id: true, name: true, email: true, mobileNumber: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      })
      return NextResponse.json({ attempts })
    }

    const attempts = await prisma.paymentAttempt.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    // Feedback and follow-up notes are for managers only.
    return NextResponse.json({
      attempts: attempts.map(({ stopReasons, stopNote, feedbackAt, followUpNote, ...rest }) => rest),
    })
  } catch (error) {
    console.error('payment-attempts GET failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Create or update (by id) one of the signed-in user's own attempts. */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const b = await request.json().catch(() => ({}))

    const status = STATUSES.includes(b.status) ? b.status : 'STARTED'
    const data = {
      status,
      reason: clean(b.reason, 500),
      orderRef: clean(b.orderRef, 120),
      paymentRef: clean(b.paymentRef, 120),
    }

    if (typeof b.id === 'string' && b.id) {
      const existing = await prisma.paymentAttempt.findUnique({ where: { id: b.id } })
      if (!existing || existing.userId !== session.userId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      // Never downgrade a confirmed payment.
      if (existing.status === 'SUCCESS') return NextResponse.json({ attempt: existing })
      const attempt = await prisma.paymentAttempt.update({
        where: { id: b.id },
        data: {
          status: data.status,
          reason: data.reason ?? existing.reason,
          orderRef: data.orderRef ?? existing.orderRef,
          paymentRef: data.paymentRef ?? existing.paymentRef,
        },
      })
      if (attempt.status !== 'STARTED') await notifyAttemptOutcome(attempt)
      if (attempt.status === 'SUCCESS') await settleEarlierAttempts(attempt)
      return NextResponse.json({ attempt })
    }

    const itemName = clean(b.itemName, 200)
    if (!itemName) return NextResponse.json({ error: 'itemName required' }, { status: 400 })
    const attempt = await prisma.paymentAttempt.create({
      data: {
        userId: session.userId,
        kind: KINDS.includes(b.kind) ? b.kind : 'OTHER',
        itemName,
        itemRef: clean(b.itemRef, 120),
        amount: typeof b.amount === 'number' && isFinite(b.amount) ? b.amount : null,
        gateway: b.gateway === 'PLAY' ? 'PLAY' : 'RAZORPAY',
        platform: b.platform === 'APP' ? 'APP' : 'WEB',
        ...data,
      },
    })
    return NextResponse.json({ attempt })
  } catch (error) {
    console.error('payment-attempts POST failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Staff: record follow-up (contacted / resolved / no response) and a note. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isStaff(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const b = await request.json().catch(() => ({}))
    if (typeof b.id !== 'string' || !FOLLOW_UPS.includes(b.followUpStatus)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const attempt = await prisma.paymentAttempt.update({
      where: { id: b.id },
      data: {
        followUpStatus: b.followUpStatus,
        followUpNote: clean(b.followUpNote, 500),
        followedUpBy: session.userId,
        followedUpAt: new Date(),
      },
    })
    return NextResponse.json({ attempt })
  } catch (error) {
    console.error('payment-attempts PATCH failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
