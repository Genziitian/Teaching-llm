import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { validSdp } from '@/lib/support-calls'

export const dynamic = 'force-dynamic'

// Body: { toId, type: 'offer' | 'answer', sdp } — both sides must be in the call right now.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const me = auth.session!.userId
    const body = await request.json().catch(() => ({}))
    if ((body.type !== 'offer' && body.type !== 'answer') || typeof body.toId !== 'string' || !validSdp(body.sdp)) {
      return NextResponse.json({ error: 'Invalid signal' }, { status: 400 })
    }
    const inCall = await prisma.supportCallParticipant.count({
      where: { callId: params.id, userId: { in: [me, body.toId] }, leftAt: null, call: { status: { in: ['RINGING', 'ACTIVE'] } } },
    })
    if (inCall !== 2) return NextResponse.json({ error: 'Not in this call' }, { status: 403 })
    await prisma.supportCallSignal.create({ data: { callId: params.id, fromId: me, toId: body.toId, type: body.type, sdp: body.sdp } })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
