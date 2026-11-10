import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { ticketNo } from '@/lib/support-limits'
import { db, sweep, GENIE_TYPE } from '@/lib/genie/server'

export const dynamic = 'force-dynamic'

// Student polls this: current Genie agent-chat state + messages.
export async function GET() {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const me = auth.session!
    if (me.role !== 'STUDENT') return NextResponse.json({ session: null })

    await sweep()

    // Latest session that is still relevant: active, pinned (ticket open) or ended-but-unrated.
    const s = await db.chatSession.findFirst({
      where: {
        type: GENIE_TYPE, studentId: me.userId,
        OR: [{ status: { in: ['WAITING', 'LIVE', 'TICKET'] } }, { status: 'ENDED', rating: null, updatedAt: { gte: new Date(Date.now() - 2 * 86400000) } }],
      },
      orderBy: { createdAt: 'desc' },
      include: { messages: { where: { isDeleted: false }, orderBy: { createdAt: 'asc' } } },
    })
    if (!s) return NextResponse.json({ session: null })

    let ticket: any = null
    let replies: any[] = []
    if (s.ticketId) {
      ticket = await db.supportTicket.findUnique({
        where: { id: s.ticketId },
        select: { id: true, ticketNumber: true, title: true, status: true, createdAt: true },
      })
      if (ticket) {
        replies = await prisma.ticketReply.findMany({
          where: { ticketId: ticket.id, createdAt: { gt: ticket.createdAt } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, senderId: true, content: true, imageUrl: true, createdAt: true },
        })
      }
    }

    const toMsg = (m: any) => ({
      id: m.id,
      from: m.senderId === me.userId ? 'me' : 'agent',   // agent name is never exposed
      content: m.content || '',
      imageUrl: m.imageUrl || null,
      at: m.createdAt,
    })
    const messages = [...s.messages.map(toMsg), ...replies.map(toMsg)]
      .sort((a, b) => +new Date(a.at) - +new Date(b.at))

    return NextResponse.json({
      session: {
        id: s.id,
        status: s.status,                 // WAITING | LIVE | TICKET | ENDED
        createdAt: s.createdAt,
        joinedAt: s.joinedAt,
        movedReason: s.movedReason,
        rating: s.rating,
        ticket: ticket ? { id: ticket.id, no: ticketNo(ticket), status: ticket.status } : null,
      },
      messages,
    })
  } catch (e) {
    console.error('genie session', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
