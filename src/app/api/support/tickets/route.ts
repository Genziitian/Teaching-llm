import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSupportSession, ticketInclude, ticketVisibilityWhere, autoCloseInactiveTickets } from '@/lib/support-ticket-access'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { sendNewTicketNotificationToManagers } from '@/lib/system-notifications'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const session = auth.session!

    await autoCloseInactiveTickets()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let where = ticketVisibilityWhere(session)

    if (status) where = { ...where, status }

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(tickets)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const session = auth.session!

    const body = await request.json()
    const { title, description } = body
    const type = body.type || 'GENERAL'
    const courseId = body.courseId || body.classId
    if (session.role !== 'STUDENT') return NextResponse.json({ error: 'Only students can create tickets' }, { status: 403 })
    if (typeof description !== 'string' || !description.trim() || description.length > 10000 ||
        (title !== undefined && (typeof title !== 'string' || title.length > 200)) ||
        !['GENERAL', 'SUBJECT'].includes(type)) {
      return NextResponse.json({ error: 'Enter a valid description and ticket type' }, { status: 400 })
    }
    if (type === 'SUBJECT' && (typeof courseId !== 'string' || !session.accessibleCourseIds?.includes(courseId))) {
      return NextResponse.json({ error: 'Choose a course you have access to' }, { status: 403 })
    }

    await autoCloseInactiveTickets()

    const activeTicketCount = await prisma.supportTicket.count({
      where: {
        studentId: session.userId,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
    })
    if (activeTicketCount >= 3) {
      return NextResponse.json(
        { error: 'You already have 3 active tickets. Please wait until your existing tickets are resolved or closed before submitting a new one.' },
        { status: 400 }
      )
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        title: title?.trim() || description.trim().slice(0, 50),
        description: description.trim(),
        type: type || 'GENERAL',
        courseId: type === 'SUBJECT' ? courseId : null,
        priority: 'MEDIUM',
        studentId: session.userId,
      },
      include: ticketInclude,
    })

    sendNewTicketNotificationToManagers(ticket.id, session.name, ticket.title).catch(console.error)

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.TICKET_CREATED,
      actionDescription: `${session.name} created support ticket "${ticket.title}"`,
      moduleName: MODULE.SUPPORT,
      targetId: ticket.id,
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
