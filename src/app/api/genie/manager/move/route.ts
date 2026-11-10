import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { db, createTicketFromSession, GENIE_TYPE } from '@/lib/genie/server'

// "Move to ticket": from the request popup (WAITING) or inside a live chat (LIVE).
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const me = auth.session!
    if (me.role !== 'MANAGER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { sessionId } = await req.json().catch(() => ({}))
    const s = await db.chatSession.findFirst({
      where: { id: String(sessionId || ''), type: GENIE_TYPE, status: { in: ['WAITING', 'LIVE'] } },
      select: { id: true, status: true },
    })
    if (!s) return NextResponse.json({ error: 'Already moved or ended' }, { status: 409 })

    const ticketId = await createTicketFromSession(s.id, 'manager')
    if (!ticketId) return NextResponse.json({ error: 'Could not create ticket' }, { status: 500 })
    await db.chatSession.update({ where: { id: s.id }, data: { status: 'TICKET', movedReason: 'manager' } })
    if (s.status === 'WAITING') {
      await prisma.supportTicket.update({ where: { id: ticketId }, data: { assignedToId: me.userId } }).catch(() => {})
    }
    return NextResponse.json({ ticketId })
  } catch (e) {
    console.error('genie move', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
