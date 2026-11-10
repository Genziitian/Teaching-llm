import { prisma } from '@/lib/db'
import { WAIT_FALLBACK_MS, QUIET_AGENT_MS } from './limits'

// New ChatSession columns are not in the generated client until `prisma generate`
// runs in the real build, so access them untyped.
export const db: any = prisma

export const GENIE_TYPE = 'GENIE'

/** Only our own uploaded chat images (jpg/png/webp) are accepted as image URLs. */
export function validImageUrl(u: unknown): string | null {
  if (typeof u !== 'string' || !u || u.length > 600) return null
  if (!/^https:\/\/[^\s]+\/genie-files\/[^\s?#]+\.(jpe?g|png|webp)(\?[^\s]*)?$/i.test(u)) return null
  return u
}

/** Turn a Genie session into a normal support ticket, copying the whole history. */
export async function createTicketFromSession(sessionId: string, reason: string): Promise<string | null> {
  const s = await db.chatSession.findUnique({
    where: { id: sessionId },
    include: { messages: { where: { isDeleted: false }, orderBy: { createdAt: 'asc' } }, student: { select: { name: true } } },
  })
  if (!s || s.ticketId) return s?.ticketId ?? null

  const msgs: any[] = s.messages
  const first = msgs[0]
  const description = (first?.content || '(photo)').slice(0, 1000)
  const title = description.replace(/\s+/g, ' ').slice(0, 50) || 'Chat with Genie'
  const ctx = s.context ? `Genie conversation so far:\n${s.context}` : ''

  const ticketId = await prisma.$transaction(async (tx: any) => {
    const t = await tx.supportTicket.create({
      data: { title, description: ctx ? `${description}\n\n${ctx}`.slice(0, 4000) : description, type: 'GENERAL', studentId: s.studentId },
    })
    for (const m of msgs.slice(first ? 1 : 0)) {
      await tx.ticketReply.create({
        data: { ticketId: t.id, senderId: m.senderId, content: m.content || '', imageUrl: m.imageUrl || null, createdAt: m.createdAt },
      })
    }
    if (first?.imageUrl) {
      await tx.ticketReply.create({ data: { ticketId: t.id, senderId: s.studentId, content: '(photo)', imageUrl: first.imageUrl } })
    }
    await tx.chatSession.update({
      where: { id: s.id },
      data: { ticketId: t.id, status: s.status === 'LIVE' ? 'LIVE' : 'TICKET', movedReason: reason },
    })
    return t.id as string
  })
  return ticketId
}

let lastSweep = 0
/** Lazy housekeeping, throttled to once every 20 s per server instance. */
export async function sweep(force = false) {
  const now = Date.now()
  if (!force && now - lastSweep < 20000) return
  lastSweep = now

  // 1) waiting too long -> ticket
  const stale = await db.chatSession.findMany({
    where: { type: GENIE_TYPE, status: 'WAITING', createdAt: { lt: new Date(now - WAIT_FALLBACK_MS) } },
    select: { id: true },
    take: 50,
  })
  for (const s of stale) {
    try {
      await createTicketFromSession(s.id, 'timeout')
      await db.chatSession.update({ where: { id: s.id }, data: { status: 'TICKET' } })
    } catch (e) { console.error('genie sweep timeout', e) }
  }

  // 2) live chat where the agent went quiet -> ticket only (chat moves inside ticket)
  const live = await db.chatSession.findMany({
    where: { type: GENIE_TYPE, status: 'LIVE', ticketId: { not: null } },
    select: { id: true, studentId: true, agentId: true, ticketId: true, joinedAt: true },
    take: 100,
  })
  for (const s of live) {
    try {
      const last = await prisma.ticketReply.findFirst({
        where: { ticketId: s.ticketId! }, orderBy: { createdAt: 'desc' }, select: { senderId: true, createdAt: true },
      })
      const waitingSince = last ? last.createdAt : s.joinedAt
      const studentWaiting = last ? last.senderId === s.studentId : true
      if (studentWaiting && waitingSince && now - new Date(waitingSince).getTime() > QUIET_AGENT_MS) {
        await db.chatSession.update({ where: { id: s.id }, data: { status: 'TICKET', movedReason: 'quiet' } })
      }
    } catch (e) { console.error('genie sweep quiet', e) }
  }

  // 3) ticket resolved/closed -> chat ended
  const open = await db.chatSession.findMany({
    where: { type: GENIE_TYPE, status: { in: ['LIVE', 'TICKET'] }, ticketId: { not: null } },
    select: { id: true, ticketId: true },
    take: 200,
  })
  if (open.length) {
    const done = await prisma.supportTicket.findMany({
      where: { id: { in: open.map((o: any) => o.ticketId) }, status: { in: ['RESOLVED', 'CLOSED'] } },
      select: { id: true },
    })
    const ids = new Set(done.map(d => d.id))
    for (const o of open) if (ids.has(o.ticketId)) await db.chatSession.update({ where: { id: o.id }, data: { status: 'ENDED' } })
  }
}
