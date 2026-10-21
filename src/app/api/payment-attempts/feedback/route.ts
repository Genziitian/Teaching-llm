import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { boughtLater } from '@/lib/payment-attempt-notify'

export const dynamic = 'force-dynamic'

const REASONS = ['PRICE', 'ASK_FAMILY', 'PAYMENT_PROBLEM', 'NOT_SURE_WHICH', 'WANT_DISCOUNT', 'JUST_LOOKING', 'NEED_MORE_INFO', 'BUY_LATER', 'OTHER']
const HOUR = 3600 * 1000

/** Next unpaid attempt to ask "what is stopping you?" about, or null. */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ attempt: null })
    const now = Date.now()
    const justNow = new URL(request.url).searchParams.get('now') === '1'

    // Answered once -> stay quiet for 24 hours.
    const answered = await prisma.paymentAttempt.findFirst({
      where: { userId: session.userId, feedbackAt: { gte: new Date(now - 24 * HOUR) } },
      select: { id: true },
    })
    if (answered) return NextResponse.json({ attempt: null })

    const a = await prisma.paymentAttempt.findFirst({
      where: {
        userId: session.userId,
        status: { in: ['STARTED', 'CANCELLED', 'FAILED', 'TIMED_OUT'] },
        feedbackAskedAt: null,
        createdAt: { gte: new Date(now - 72 * HOUR) },
        ...(justNow ? {} : { updatedAt: { lte: new Date(now - 5 * 60 * 1000) } }),
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!a) return NextResponse.json({ attempt: null })
    if (await boughtLater(a)) {
      await prisma.paymentAttempt.update({ where: { id: a.id }, data: { status: 'SUPERSEDED', followUpStatus: 'RESOLVED', reason: 'Student purchased this later' } })
      return NextResponse.json({ attempt: null })
    }
    return NextResponse.json({ attempt: { id: a.id, itemName: a.itemName } })
  } catch (e) {
    console.error('payment feedback GET failed:', e)
    return NextResponse.json({ attempt: null })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const b = await request.json().catch(() => ({}))
    if (typeof b.id !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const a = await prisma.paymentAttempt.findUnique({ where: { id: b.id } })
    if (!a || a.userId !== session.userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const reasons = Array.isArray(b.reasons) ? b.reasons.filter((r: unknown) => typeof r === 'string' && REASONS.includes(r)).slice(0, 9) : []
    const note = typeof b.note === 'string' ? b.note.trim().slice(0, 600) : ''
    const answered = !b.dismissed && (reasons.length > 0 || note.length > 0)
    await prisma.paymentAttempt.update({
      where: { id: a.id },
      data: {
        feedbackAskedAt: new Date(),
        ...(answered ? { feedbackAt: new Date(), stopReasons: reasons.join('|') || null, stopNote: note || null } : {}),
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('payment feedback POST failed:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
