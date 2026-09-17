import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getFullSession, FullSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const ticketInclude = {
  user: { select: { id: true, name: true, role: true, avatar: true, gender: true } },
  course: { select: { id: true, name: true, color: true } },
  assignedTo: { select: { id: true, name: true, role: true, avatar: true, gender: true } },
  replies: {
    include: { sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.SupportTicketInclude

export async function requireSupportSession() {
  const session = await getFullSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (session.role !== 'STUDENT' && session.role !== 'MANAGER') {
    return { error: NextResponse.json({ error: 'Support is available to students and managers' }, { status: 403 }) }
  }
  return { session }
}

export function ticketVisibilityWhere(session: FullSession): Prisma.SupportTicketWhereInput {
  if (session.role === 'MANAGER') return {}
  return {
    studentId: session.userId,
    OR: [
      { status: { notIn: ['CLOSED', 'RESOLVED'] } },
      { status: { in: ['CLOSED', 'RESOLVED'] }, updatedAt: { gte: new Date(Date.now() - 15 * 86400000) } },
    ],
  }
}

export async function requireTicketAccess(id: string) {
  const auth = await requireSupportSession()
  if (auth.error) return { error: auth.error }
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, ...ticketVisibilityWhere(auth.session!) },
    include: ticketInclude,
  })
  if (!ticket) return { error: NextResponse.json({ error: 'Ticket not found' }, { status: 404 }) }
  return { session: auth.session!, ticket }
}

export const TICKET_AUTO_CLOSE_DAYS = 10

export async function autoCloseInactiveTickets() {
  try {
    const cutoff = new Date(Date.now() - TICKET_AUTO_CLOSE_DAYS * 86400000)
    return await prisma.supportTicket.updateMany({
      where: {
        status: { not: 'CLOSED' },
        updatedAt: { lt: cutoff },
      },
      data: {
        status: 'CLOSED',
      },
    })
  } catch (error) {
    console.error('Failed to auto-close inactive tickets:', error)
    return { count: 0 }
  }
}

