import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { studentId, managerId } = await request.json()

    if (session.role === 'MANAGER') {
      if (!studentId) return NextResponse.json({ error: 'studentId is required' }, { status: 400 })

      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, name: true, role: true, isTerminated: true, avatar: true, gender: true },
      })
      if (!student || student.isTerminated) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }
      if (student.role === 'MANAGER') {
        return NextResponse.json({ error: 'Cannot start a direct chat with another manager' }, { status: 400 })
      }

      const existing = await prisma.chatSession.findFirst({
        where: {
          studentId,
          agentId: session.userId,
          type: 'DIRECT',
          status: { not: 'CLOSED' },
        },
      })
      if (existing) {
        return NextResponse.json({ chatId: `dm_${existing.id}`, existing: true })
      }

      const chat = await prisma.chatSession.create({
        data: {
          studentId,
          agentId: session.userId,
          status: 'ACTIVE',
          type: 'DIRECT',
        },
      })

      logActivity({
        userId: session.userId,
        userName: session.name,
        userRole: session.role,
        actionType: ACTION.CHAT_STARTED,
        actionDescription: `${session.name} started a direct chat with ${student.name}`,
        moduleName: MODULE.COMMUNITY,
        targetId: chat.id,
      })

      return NextResponse.json({ chatId: `dm_${chat.id}`, existing: false }, { status: 201 })
    }

    if (!managerId) return NextResponse.json({ error: 'managerId is required' }, { status: 400 })
    if (managerId === session.userId) {
      return NextResponse.json({ error: 'Cannot start a direct chat with yourself' }, { status: 400 })
    }

    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, name: true, role: true, isTerminated: true },
    })
    if (!manager || manager.isTerminated || !['MANAGER', 'ADMIN', 'MODERATOR'].includes(manager.role)) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 })
    }

    const existing = await prisma.chatSession.findFirst({
      where: {
        studentId: session.userId,
        agentId: manager.id,
        type: 'DIRECT',
        status: { not: 'CLOSED' },
      },
    })
    if (existing) {
      return NextResponse.json({ chatId: `dm_${existing.id}`, existing: true })
    }

    const chat = await prisma.chatSession.create({
      data: {
        studentId: session.userId,
        agentId: manager.id,
        status: 'ACTIVE',
        type: 'DIRECT',
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.CHAT_STARTED,
      actionDescription: `${session.name} started a direct chat with ${manager.name}`,
      moduleName: MODULE.COMMUNITY,
      targetId: chat.id,
    })

    return NextResponse.json({ chatId: `dm_${chat.id}`, existing: false }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
