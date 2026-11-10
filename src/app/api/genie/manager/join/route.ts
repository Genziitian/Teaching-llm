import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { db, createTicketFromSession, GENIE_TYPE } from '@/lib/genie/server'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const me = auth.session!
    if (me.role !== 'MANAGER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { sessionId } = await req.json().catch(() => ({}))
    if (!sessionId) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

    // Atomic claim: only one manager can join a waiting request.
    const claim = await db.chatSession.updateMany({
      where: { id: String(sessionId), type: GENIE_TYPE, status: 'WAITING' },
      data: { status: 'LIVE', agentId: me.userId, joinedAt: new Date() },
    })
    if (claim.count === 0) {
      return NextResponse.json({ error: 'Someone else already joined, or the request ended' }, { status: 409 })
    }
    const ticketId = await createTicketFromSession(String(sessionId), 'joined')
    if (!ticketId) {
      await db.chatSession.update({ where: { id: String(sessionId) }, data: { status: 'WAITING', agentId: null, joinedAt: null } })
      return NextResponse.json({ error: 'Could not create ticket' }, { status: 500 })
    }
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { assignedToId: me.userId } })
    return NextResponse.json({ ticketId })
  } catch (e) {
    console.error('genie join', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
