import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { callListSelect, expireRingingCalls, joinCall } from '@/lib/support-calls'
import { isSupportOpen } from '@/lib/support-limits'
import { getManagerIds, sendSupportCallNotice, sendSupportCallNotificationToManagers, sendSupportCallNotificationToStudent } from '@/lib/system-notifications'

export const dynamic = 'force-dynamic'

// Managers: incoming + missed student calls, open scheduled requests, their own live calls.
// Students: calls ringing them, their recent calls and their open scheduled requests.
export async function GET() {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const session = auth.session!
    await expireRingingCalls()

    const where = session.role === 'MANAGER'
      ? { OR: [
          { type: 'CALL', status: { in: ['RINGING', 'MISSED'] } },
          { type: 'SCHEDULED', status: { in: ['REQUESTED', 'ACCEPTED'] } },
          { status: 'ACTIVE' }, // live calls any manager can join
          { managerId: session.userId, status: 'RINGING' },
        ] }
      : { callerId: session.userId, OR: [
          { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
          { type: 'SCHEDULED', status: { in: ['REQUESTED', 'ACCEPTED'] } },
        ] }

    const calls = await prisma.supportCall.findMany({ where, select: callListSelect, orderBy: { createdAt: 'desc' }, take: 50 })
    return NextResponse.json(calls)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Student: {} rings support, or { type: 'SCHEDULED', scheduledFor, reason } asks for a call later.
// Manager: { userId } rings that student. The caller joins right away; media starts when the callee joins.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const session = auth.session!
    const body = await request.json().catch(() => ({}))

    if (body.type === 'SCHEDULED') {
      if (session.role !== 'STUDENT') return NextResponse.json({ error: 'Only students can schedule a call' }, { status: 403 })
      const when = new Date(body.scheduledFor)
      const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
      if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000 || when.getTime() > Date.now() + 30 * 86400000) {
        return NextResponse.json({ error: 'Pick a time within the next 30 days' }, { status: 400 })
      }
      if (!isSupportOpen(when)) return NextResponse.json({ error: 'Please pick a time between 10 AM and 10 PM.' }, { status: 400 })
      if (reason.length < 3 || reason.length > 500) return NextResponse.json({ error: 'Tell us briefly why you need the call' }, { status: 400 })
      const open = await prisma.supportCall.count({ where: { callerId: session.userId, type: 'SCHEDULED', status: { in: ['REQUESTED', 'ACCEPTED'] } } })
      if (open) return NextResponse.json({ error: 'You already have a scheduled call. Cancel it to pick a new time.' }, { status: 400 })
      const call = await prisma.supportCall.create({
        data: { type: 'SCHEDULED', status: 'REQUESTED', callerId: session.userId, scheduledFor: when, note: reason },
        select: callListSelect,
      })
      getManagerIds().then(ids => sendSupportCallNotice(ids, 'Call scheduled 📅', `${session.name} asked for a call: "${reason.slice(0, 60)}"`)).catch(console.error)
      return NextResponse.json(call, { status: 201 })
    }

    if (session.role === 'MANAGER') {
      const student = typeof body.userId === 'string'
        ? await prisma.user.findFirst({ where: { id: body.userId, role: 'STUDENT', isTerminated: false }, select: { id: true } })
        : null
      if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      const busy = await prisma.supportCall.count({ where: { callerId: student.id, status: { in: ['RINGING', 'ACTIVE'] } } })
      if (busy) return NextResponse.json({ error: 'This student is already on a call' }, { status: 409 })
      // Calling a student back clears their missed calls and approved scheduled call from the queue.
      await prisma.supportCall.updateMany({ where: { callerId: student.id, type: 'CALL', status: 'MISSED' }, data: { status: 'ENDED' } })
      await prisma.supportCall.updateMany({ where: { callerId: student.id, type: 'SCHEDULED', status: 'ACCEPTED' }, data: { status: 'DONE', managerId: session.userId } })
      const call = await prisma.supportCall.create({
        data: { type: 'CALL_OUT', status: 'RINGING', callerId: student.id, managerId: session.userId },
        select: { id: true, status: true },
      })
      await joinCall(call.id, session.userId)
      sendSupportCallNotificationToStudent(call.id, student.id).catch(console.error)
      return NextResponse.json(call, { status: 201 })
    }

    if (!isSupportOpen()) {
      return NextResponse.json({ error: 'Support calls are open 10 AM – 10 PM. Ask GenZie to book a call back instead.' }, { status: 400 })
    }
    // One live call per student: anything older from them is abandoned.
    await prisma.supportCall.updateMany({
      where: { callerId: session.userId, status: { in: ['RINGING', 'ACTIVE'] } },
      data: { status: 'ENDED', endedAt: new Date() },
    })
    const call = await prisma.supportCall.create({
      data: { type: 'CALL', status: 'RINGING', callerId: session.userId },
      select: { id: true, status: true },
    })
    await joinCall(call.id, session.userId)
    sendSupportCallNotificationToManagers(call.id, session.name).catch(console.error)
    return NextResponse.json(call, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
