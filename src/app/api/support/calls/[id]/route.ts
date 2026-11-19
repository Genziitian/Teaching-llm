import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { callInclude, callListSelect, expireRingingCalls, joinCall, leaveCall } from '@/lib/support-calls'
import { cancelSupportCallRing, sendSupportCallNotice } from '@/lib/system-notifications'

export const dynamic = 'force-dynamic'

async function load(id: string) {
  const auth = await requireSupportSession()
  if (auth.error) return { error: auth.error }
  const session = auth.session!
  await expireRingingCalls()
  const call = await prisma.supportCall.findUnique({ where: { id }, include: callInclude })
  if (!call || (session.role !== 'MANAGER' && call.callerId !== session.userId)) {
    return { error: NextResponse.json({ error: 'Call not found' }, { status: 404 }) }
  }
  return { session, call }
}

/**
 * Polled by everyone in the call: status, who is in it, and the offers/answers addressed to me
 * (consumed: each signal is returned once).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const r = await load(params.id)
    if (r.error) return r.error
    const me = r.session.userId
    const [call, signals] = await Promise.all([
      prisma.supportCall.findUnique({ where: { id: params.id }, select: callListSelect }),
      prisma.supportCallSignal.findMany({ where: { callId: params.id, toId: me }, orderBy: { createdAt: 'asc' } }),
    ])
    if (signals.length) await prisma.supportCallSignal.deleteMany({ where: { id: { in: signals.map(s => s.id) } } })
    return NextResponse.json({
      ...call,
      participants: call!.participants.filter(p => !p.leftAt),
      signals: signals.map(s => ({ fromId: s.fromId, type: s.type, sdp: s.sdp })),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Body: { action: 'accept' } pick up | { action: 'join' } manager joins a live call | { action: 'end' } hang up
// | { action: 'media', video: 'off' | 'camera' | 'screen' } tell the others what I'm sending
// | { action: 'done' } manager clears a missed/scheduled call
// | { action: 'approve' | 'decline' } manager, scheduled request | { action: 'cancel' } student, own scheduled request.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const r = await load(params.id)
    if (r.error) return r.error
    const { session, call } = r
    const body = await request.json().catch(() => ({}))
    const isManager = session.role === 'MANAGER'

    if (call.type === 'SCHEDULED') {
      const open = call.status === 'REQUESTED' || call.status === 'ACCEPTED'
      let status: string
      if ((body.action === 'approve' || body.action === 'decline') && isManager && call.status === 'REQUESTED') {
        status = body.action === 'approve' ? 'ACCEPTED' : 'DECLINED'
        const when = call.scheduledFor?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
        sendSupportCallNotice([call.callerId],
          status === 'ACCEPTED' ? 'Call confirmed ✅' : 'Call request declined',
          status === 'ACCEPTED' ? `Support will call you in the app on ${when}.` : 'Support could not take your scheduled call. Please ask GenZie for help.',
        ).catch(console.error)
      } else if (body.action === 'done' && isManager && open) {
        status = 'DONE'
      } else if (body.action === 'cancel' && call.callerId === session.userId && open) {
        status = 'CANCELLED'
      } else {
        return NextResponse.json({ error: 'Invalid action for this request' }, { status: 400 })
      }
      const updated = await prisma.supportCall.update({
        where: { id: call.id },
        data: { status, ...(isManager ? { managerId: session.userId } : {}) },
        include: callInclude,
      })
      return NextResponse.json(updated)
    }

    if (body.action === 'accept') {
      // Student calls are answered by any manager; manager calls only by that student.
      const allowed = call.type === 'CALL' ? isManager : call.callerId === session.userId
      if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      // Conditional update so two managers can't both pick up (others can still join afterwards).
      const res = await prisma.supportCall.updateMany({
        where: { id: call.id, status: 'RINGING' },
        data: { status: 'ACTIVE', answeredAt: new Date(), ...(call.type === 'CALL' ? { managerId: session.userId } : {}) },
      })
      if (res.count === 0) return NextResponse.json({ error: 'Call is no longer ringing' }, { status: 409 })
      await joinCall(call.id, session.userId)
      // Support and this student are now talking: their missed calls and booked call-backs are handled.
      const managerId = call.type === 'CALL' ? session.userId : call.managerId
      await prisma.supportCall.updateMany({ where: { callerId: call.callerId, id: { not: call.id }, type: 'CALL', status: 'MISSED' }, data: { status: 'ENDED' } })
      await prisma.supportCall.updateMany({ where: { callerId: call.callerId, type: 'SCHEDULED', status: { in: ['REQUESTED', 'ACCEPTED'] } }, data: { status: 'DONE', managerId } })
      // Other managers' phones stop ringing once someone picks up.
      if (call.type === 'CALL') cancelSupportCallRing(call.id, call.type, call.callerId, session.userId).catch(console.error)
    } else if (body.action === 'join') {
      if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (call.status !== 'ACTIVE') return NextResponse.json({ error: 'This call is not live' }, { status: 409 })
      await joinCall(call.id, session.userId)
    } else if (body.action === 'media') {
      if (!['off', 'camera', 'screen'].includes(body.video)) return NextResponse.json({ error: 'Invalid video mode' }, { status: 400 })
      await prisma.supportCallParticipant.updateMany({ where: { callId: call.id, userId: session.userId, leftAt: null }, data: { video: body.video } })
      return NextResponse.json({ ok: true })
    } else if (body.action === 'end') {
      if (call.status === 'RINGING') {
        // A student call declined by a manager stays MISSED so it shows up to call back; others end it.
        const declinedByManager = call.type === 'CALL' && isManager && session.userId !== call.callerId
        await prisma.supportCall.update({ where: { id: call.id }, data: { status: declinedByManager ? 'MISSED' : 'ENDED' } })
        await prisma.supportCallParticipant.updateMany({ where: { callId: call.id, leftAt: null }, data: { leftAt: new Date() } })
        cancelSupportCallRing(call.id, call.type, call.callerId, session.userId).catch(console.error)
      } else if (call.status === 'ACTIVE') {
        await leaveCall(call, session.userId)
      }
    } else if (body.action === 'done') {
      if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      await prisma.supportCall.update({ where: { id: call.id }, data: { status: 'ENDED', managerId: call.managerId ?? session.userId } })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    const updated = await prisma.supportCall.findUnique({ where: { id: call.id }, select: callListSelect })
    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
