import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { sendNewLiveChatNotificationToManagers } from '@/lib/system-notifications'

const CHAT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

async function autoExpireChats() {
  const now = new Date()
  // Only auto-expire SUPPORT chats — DIRECT chats have no expiration
  await prisma.chatSession.updateMany({
    where: {
      type: 'SUPPORT',
      status: { not: 'CLOSED' },
      expiresAt: { lte: now },
    },
    data: { status: 'CLOSED' },
  })
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await autoExpireChats()

    // ONLY show SUPPORT chats — never DIRECT (community DMs)
    let where: any = { type: 'SUPPORT' }
    if (session.role === 'STUDENT' || (session.role === 'ADMIN' || session.role === 'MODERATOR')) {
      where.studentId = session.userId
    } else {
      // Managers only see support chats that have at least one message
      where.messages = { some: {} }
    }

    const chats = await prisma.chatSession.findMany({
      where: { ...where, status: { not: 'CLOSED' } },
      include: {
        student: { select: { id: true, name: true, avatar: true, gender: true } },
        agent: { select: { id: true, name: true, role: true, avatar: true, gender: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(chats)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'STUDENT' && (session.role !== 'ADMIN' && session.role !== 'MODERATOR')) {
      return NextResponse.json({ error: 'Only students and admins can start a chat' }, { status: 403 })
    }

    const { initialMessage } = await request.json().catch(() => ({}))

    // Always create a new SUPPORT session (each support chat is separate)
    const expiresAt = new Date(Date.now() + CHAT_TTL_MS)
    const chat = await prisma.chatSession.create({
      data: { 
        studentId: session.userId, 
        status: 'WAITING', 
        type: 'SUPPORT',
        expiresAt,
        ...(initialMessage ? {
          messages: {
            create: {
              content: initialMessage,
              senderId: session.userId
            }
          }
        } : {})
      },
      include: {
        student: { select: { id: true, name: true, avatar: true, gender: true } },
        agent: { select: { id: true, name: true, role: true, avatar: true, gender: true } },
      },
    })

    sendNewLiveChatNotificationToManagers(chat.id, session.name, initialMessage).catch(console.error)

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.CHAT_STARTED,
      actionDescription: `${session.name} started a live chat session`,
      moduleName: MODULE.SUPPORT,
      targetId: chat.id,
    })

    return NextResponse.json(chat, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
