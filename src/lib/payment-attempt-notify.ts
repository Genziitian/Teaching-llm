import { prisma } from '@/lib/db'
import { sendPushToUsers } from '@/lib/push'
import { sendFcmToUsers } from '@/lib/fcm'
import { sendPaymentMail, paymentMailEnabled } from '@/lib/payment-mail'

export const ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000
export const REMINDER_EVERY_MS = 4 * 60 * 60 * 1000

type Att = { id: string; userId: string; itemName: string; status: string; remindersSent?: number }

const OUTCOME: Record<string, (n: string) => [string, string]> = {
  SUCCESS: n => ['Payment successful \u{1F389}', `You're in! ${n} is unlocked and ready for you.`],
  FAILED: n => ['Payment did not go through', `We could not complete your payment for ${n}. No worries - you can try again anytime from your history.`],
  CANCELLED: n => ['Payment cancelled', `You cancelled the payment for ${n}. Your spot is still waiting if you change your mind.`],
  PENDING_VERIFY: n => ['We are confirming your payment', `We are verifying your payment for ${n}. This usually takes a few minutes.`],
  TIMED_OUT: n => ['Payment window closed', `Your checkout for ${n} expired after 24 hours. Start again whenever you are ready.`],
}

// Every reminder is different, cycling through the list.
const REMINDERS: ((n: string) => [string, string])[] = [
  n => ['We are still waiting for you', `${n} is one step away. Finish your payment whenever you are ready.`],
  n => ['Your seat is on hold', `We saved ${n} for you. Complete the payment to unlock it.`],
  n => ['Quick reminder', `Your checkout for ${n} is still open. It takes under a minute.`],
  n => ['Did something go wrong?', `If payment for ${n} got stuck, try again or contact support - we will help.`],
  n => ['Do not lose your spot', `Other students are already learning. ${n} is waiting for you.`],
  n => ['Almost there', `You started ${n} but did not finish. Pick up right where you left off.`],
  n => ['Still thinking it over?', `Take your time - ${n} stays reserved for you for a little longer.`],
  n => ['Your checkout is waiting', `Tap to complete your payment for ${n}.`],
  n => ['A gentle nudge', `${n} could be yours today. Finish checkout when you can.`],
  n => ['Last stretch', `Your checkout for ${n} will expire soon. Complete it to keep your spot.`],
]

async function deliver(userId: string, title: string, body: string, type: string) {
  try {
    await prisma.notification.create({ data: { userId, title, content: body, type } })
    const payload = { title, body, url: '/my-transactions', tag: 'payment-attempt' }
    await Promise.allSettled([sendPushToUsers([userId], payload), sendFcmToUsers([userId], payload)])
  } catch (e) { console.error('payment notify failed:', e) }
}

/** One notification per outcome, never repeated for the same status. */
export async function notifyAttemptOutcome(a: Att & { notifiedStatus?: string | null }) {
  const make = OUTCOME[a.status]
  if (!make || a.notifiedStatus === a.status) return
  const [t, b] = make(a.itemName)
  await deliver(a.userId, t, b, a.status === 'SUCCESS' ? 'SUCCESS' : 'WARNING')
  await prisma.paymentAttempt.update({ where: { id: a.id }, data: { notifiedStatus: a.status } }).catch(() => {})
  if (a.status === 'FAILED' && paymentMailEnabled()) {
    const full = await prisma.paymentAttempt.findUnique({ where: { id: a.id }, include: { user: { select: { name: true, email: true, mobileNumber: true } } } }).catch(() => null)
    if (full) {
      await sendPaymentMail({
        status: 'FAILED',
        itemType: full.kind === 'NOTE' ? 'NOTE' : full.kind === 'PROTECTION' ? 'PROTECTION' : 'COURSE',
        name: full.user.name, email: full.user.email, phone: full.user.mobileNumber,
        itemName: full.itemName, amount: full.amount, orderId: full.orderRef, paymentId: full.paymentRef,
      })
    }
  }
}

export async function sendAttemptReminder(a: Att & { itemRef: string | null; kind: string; createdAt: Date }) {
  if (await boughtLater(a)) {
    await prisma.paymentAttempt.update({ where: { id: a.id }, data: { status: 'SUPERSEDED', followUpStatus: 'RESOLVED', reason: 'Student purchased this later' } })
    return
  }
  const [t, b] = REMINDERS[(a.remindersSent ?? 0) % REMINDERS.length](a.itemName)
  await deliver(a.userId, t, b, 'INFO')
  await prisma.paymentAttempt.update({
    where: { id: a.id },
    data: { remindersSent: { increment: 1 }, lastReminderAt: new Date() },
  })
}

/** A later successful purchase of the same item settles every earlier unpaid attempt. */
export async function settleEarlierAttempts(a: { id: string; userId: string; itemName: string; itemRef?: string | null; kind?: string }) {
  await prisma.paymentAttempt.updateMany({
    where: {
      userId: a.userId,
      id: { not: a.id },
      status: { in: ['STARTED', 'FAILED', 'CANCELLED', 'PENDING_VERIFY'] },
      ...(a.itemRef ? { itemRef: a.itemRef } : { itemName: a.itemName }),
    },
    data: { status: 'SUPERSEDED', followUpStatus: 'RESOLVED', reason: 'Student purchased this later' },
  }).catch(() => {})
}

/** True when the student already owns what this attempt was for (any route). */
export async function boughtLater(a: { userId: string; itemName: string; itemRef: string | null; kind: string; createdAt: Date }) {
  const since = { gte: a.createdAt }
  const paid = await prisma.paymentAttempt.findFirst({
    where: { userId: a.userId, status: 'SUCCESS', createdAt: since, ...(a.itemRef ? { itemRef: a.itemRef } : { itemName: a.itemName }) },
    select: { id: true },
  })
  if (paid) return true
  if (!a.itemRef) return false
  if (a.kind === 'NOTE') {
    return !!(await prisma.storeNoteAccess.findFirst({ where: { userId: a.userId, noteId: a.itemRef, createdAt: since }, select: { id: true } }))
  }
  if (a.kind === 'COURSE' || a.kind === 'BUNDLE') {
    const ids = a.itemRef.split(',').filter(Boolean)
    const order = await prisma.order.findFirst({
      where: { userId: a.userId, status: { in: ['PAID', 'SUCCESS', 'COMPLETED'] }, createdAt: since,
        items: { some: { OR: [{ courseId: { in: ids } }, { courseOfferingId: { in: ids } }] } } },
      select: { id: true },
    })
    if (order) return true
    return !!(await prisma.enrollment.findFirst({ where: { userId: a.userId, courseId: { in: ids }, createdAt: since }, select: { id: true } }))
  }
  return false
}
