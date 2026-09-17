import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireTicketAccess } from '@/lib/support-ticket-access'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { sendSupportReplyNotification, sendTicketReplyNotificationToManagers } from '@/lib/system-notifications'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireTicketAccess(params.id)
    if (access.error) return access.error
    const replies = await prisma.ticketReply.findMany({
      where: { ticketId: params.id },
      include: { sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(replies)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireTicketAccess(params.id)
    if (access.error) return access.error
    const session = access.session!

    const { content, imageUrl } = await request.json()

    if ((content !== undefined && (typeof content !== 'string' || content.length > 10000)) ||
        (imageUrl !== undefined && imageUrl !== null && (typeof imageUrl !== 'string' || imageUrl.length > 4000)) ||
        (!content?.trim() && !imageUrl)) {
      return NextResponse.json({ error: 'Enter a message or attach an image' }, { status: 400 })
    }
    // Lock/update the parent in the same transaction as the reply so a closed
    // ticket cannot be reopened by a simultaneous send.
    const reply = await prisma.$transaction(async tx => {
      const ticket = await tx.supportTicket.findUnique({
        where: { id: params.id },
        select: { id: true, status: true },
      })
      if (!ticket || ticket.status === 'CLOSED') return null

      const nextStatus = session.role === 'MANAGER'
        ? 'IN_PROGRESS'
        : (ticket.status === 'RESOLVED' ? 'OPEN' : undefined)

      const updated = await tx.supportTicket.updateMany({
        where: { id: params.id, status: { not: 'CLOSED' } },
        data: {
          updatedAt: new Date(),
          ...(nextStatus ? { status: nextStatus } : {}),
        },
      })
      if (!updated.count) return null
      return tx.ticketReply.create({
        data: { ticketId: params.id, senderId: session.userId, content: content?.trim() || '', imageUrl: imageUrl || null },
        include: { sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } } },
      })
    })
    if (!reply) return NextResponse.json({ error: 'This ticket is closed. Create a new ticket if you need more help.' }, { status: 409 })

    // Trigger support reply notification (non-blocking)
    if (session.role !== 'STUDENT') {
      sendSupportReplyNotification(params.id, session.name, reply.content).catch(console.error)
    } else {
      sendTicketReplyNotificationToManagers(params.id, session.name, reply.content).catch(console.error)
    }

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.TICKET_REPLY_SENT,
      actionDescription: `${session.name} replied to support ticket`,
      moduleName: MODULE.SUPPORT,
      targetId: params.id,
    })

    return NextResponse.json(reply, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireTicketAccess(params.id)
    if (access.error) return access.error
    const session = access.session!

    const { replyId, content } = await request.json()
    if (!replyId) return NextResponse.json({ error: 'replyId is required' }, { status: 400 })

    const reply = await prisma.ticketReply.findUnique({
      where: { id: replyId }
    })

    if (!reply || reply.ticketId !== params.id) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 })
    }

    if (session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Only managers can edit support replies' }, { status: 403 })
    }

    if (reply.senderId !== session.userId) {
      return NextResponse.json({ error: 'You can only edit your own replies' }, { status: 403 })
    }

    if (typeof content !== 'string' || content.length > 10000 || (!content.trim() && !reply.imageUrl)) {
      return NextResponse.json({ error: 'Enter a valid reply' }, { status: 400 })
    }
    const updated = await prisma.ticketReply.update({
      where: { id: replyId },
      data: { content: content || '' },
      include: { sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } } },
    })

    await prisma.supportTicket.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.TICKET_UPDATED,
      actionDescription: `${session.name} edited their reply in ticket ${params.id}`,
      moduleName: MODULE.SUPPORT,
      targetId: params.id,
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating reply:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireTicketAccess(params.id)
    if (access.error) return access.error
    const session = access.session!

    const { replyId } = await request.json()
    if (!replyId) return NextResponse.json({ error: 'replyId is required' }, { status: 400 })

    const reply = await prisma.ticketReply.findUnique({
      where: { id: replyId }
    })

    if (!reply || reply.ticketId !== params.id) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 })
    }

    if (session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Only managers can delete support replies' }, { status: 403 })
    }

    if (reply.senderId !== session.userId) {
      return NextResponse.json({ error: 'You can only delete your own replies' }, { status: 403 })
    }

    await prisma.ticketReply.delete({
      where: { id: replyId }
    })

    await prisma.supportTicket.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.TICKET_UPDATED,
      actionDescription: `${session.name} deleted their reply in ticket ${params.id}`,
      moduleName: MODULE.SUPPORT,
      targetId: params.id,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting reply:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

