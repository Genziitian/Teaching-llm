import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { sendTicketReplyNotificationToManagers } from '@/lib/system-notifications'
import { db, sweep, validImageUrl, GENIE_TYPE } from '@/lib/genie/server'
import { GENIE_MAX_MESSAGE, SEND_GAP_MS } from '@/lib/genie/limits'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const me = auth.session!
    if (me.role !== 'STUDENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const content = String(body.message || '').trim()
    const imageUrl = validImageUrl(body.imageUrl)
    if (!content && !imageUrl) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    if (content.length > GENIE_MAX_MESSAGE) return NextResponse.json({ error: `Max ${GENIE_MAX_MESSAGE} characters` }, { status: 400 })

    await sweep()
    const s = await db.chatSession.findFirst({
      where: { type: GENIE_TYPE, studentId: me.userId, status: { in: ['WAITING', 'LIVE'] } },
      select: { id: true, status: true, ticketId: true },
    })
    if (!s) return NextResponse.json({ error: 'Chat is not active', ended: true }, { status: 409 })

    const gap = new Date(Date.now() - SEND_GAP_MS)
    if (s.status === 'WAITING') {
      const recent = await prisma.chatMessage.findFirst({ where: { chatId: s.id, senderId: me.userId, createdAt: { gte: gap } }, select: { id: true } })
      if (recent) return NextResponse.json({ error: 'Slow down a little' }, { status: 429 })
      const m = await prisma.chatMessage.create({ data: { chatId: s.id, senderId: me.userId, content, imageUrl } })
      return NextResponse.json({ id: m.id })
    }

    if (!s.ticketId) return NextResponse.json({ error: 'Chat is not active', ended: true }, { status: 409 })
    const recent = await prisma.ticketReply.findFirst({ where: { ticketId: s.ticketId, senderId: me.userId, createdAt: { gte: gap } }, select: { id: true } })
    if (recent) return NextResponse.json({ error: 'Slow down a little' }, { status: 429 })
    const r = await prisma.ticketReply.create({ data: { ticketId: s.ticketId, senderId: me.userId, content: content || '(photo)', imageUrl } })
    await prisma.supportTicket.update({ where: { id: s.ticketId }, data: { updatedAt: new Date() } })
    sendTicketReplyNotificationToManagers(s.ticketId, me.name, content || '(photo)').catch(() => {})
    return NextResponse.json({ id: r.id })
  } catch (e) {
    console.error('genie message', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
