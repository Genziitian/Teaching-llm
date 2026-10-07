import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sseEmitter } from '@/lib/sse'
import { logActivity, MODULE } from '@/lib/activity-log'

export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string; messageId: string } }
) {
  try {
    const { courseId, messageId } = params
    if (!courseId || !messageId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { action, reaction } = body

    if (!['pin', 'unpin', 'like', 'react', 'highlight', 'unhighlight'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be pin, unpin, like, react, highlight, or unhighlight' }, { status: 400 })
    }

    // Only managers/admins can pin/unpin/highlight messages
    if (['pin', 'unpin', 'highlight', 'unhighlight'].includes(action) && session.role !== 'MANAGER' && (session.role !== 'ADMIN' && session.role !== 'MODERATOR')) {
      return NextResponse.json({ error: 'Only managers can manage message highlights or pins' }, { status: 403 })
    }

    const message = await prisma.communityMessage.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (message.courseId !== courseId) {
      return NextResponse.json({ error: 'Message does not belong to this community' }, { status: 400 })
    }

    if (message.isDeleted || message.isSystemDeleted) {
      return NextResponse.json({ error: 'Cannot interact with a deleted message' }, { status: 400 })
    }

    if (action === 'pin') {
      // Unpin all other messages in this course, then pin the targeted message
      await prisma.$transaction([
        prisma.communityMessage.updateMany({
          where: { courseId, isPinned: true },
          data: { isPinned: false },
        }),
        prisma.communityMessage.update({
          where: { id: messageId },
          data: { isPinned: true },
        }),
      ])

      logActivity({
        userId: session.userId,
        userName: session.name,
        userRole: session.role,
        actionType: 'MESSAGE_PINNED',
        actionDescription: `${session.name} pinned a message in community chat`,
        moduleName: MODULE.COMMUNITY,
        targetId: messageId,
      })

      // Emit real-time SSE pin event
      sseEmitter.emit(`chat:${courseId}:pin`, { messageId })
    } else if (action === 'unpin') {
      // Unpin the targeted message
      await prisma.communityMessage.update({
        where: { id: messageId },
        data: { isPinned: false },
      })

      logActivity({
        userId: session.userId,
        userName: session.name,
        userRole: session.role,
        actionType: 'MESSAGE_UNPINNED',
        actionDescription: `${session.name} unpinned a message in community chat`,
        moduleName: MODULE.COMMUNITY,
        targetId: messageId,
      })

      // Emit real-time SSE pin event (null indicates no pinned message)
      sseEmitter.emit(`chat:${courseId}:pin`, { messageId: null })
    } else if (action === 'like') {
      let likes: string[] = []
      try {
        likes = JSON.parse(message.likes || '[]')
        if (!Array.isArray(likes)) likes = []
      } catch (e) {
        likes = []
      }

      if (likes.includes(session.userId)) {
        likes = likes.filter(id => id !== session.userId)
      } else {
        likes.push(session.userId)
      }

      const updated = await prisma.communityMessage.update({
        where: { id: messageId },
        data: { likes: JSON.stringify(likes) },
        include: {
          sender: { select: { id: true, name: true, role: true } },
          replyTo: {
            include: {
              sender: { select: { id: true, name: true } }
            }
          }
        }
      })

      // Emit real-time SSE update event
      sseEmitter.emit(`chat:${courseId}:update`, updated)
    } else if (action === 'highlight' || action === 'unhighlight') {
      let reactions: Record<string, string[]> = {}
      try {
        reactions = JSON.parse(message.reactions || '{}')
        if (typeof reactions !== 'object' || reactions === null) reactions = {}
      } catch (e) {
        reactions = {}
      }

      if (action === 'highlight') {
        reactions.__highlight = ['manager']
      } else {
        delete reactions.__highlight
      }

      const updated = await prisma.communityMessage.update({
        where: { id: messageId },
        data: { reactions: JSON.stringify(reactions) },
        include: {
          sender: { select: { id: true, name: true, role: true } },
          replyTo: {
            include: {
              sender: { select: { id: true, name: true } }
            }
          }
        }
      })

      sseEmitter.emit(`chat:${courseId}:update`, updated)
    } else if (action === 'react') {
      if (!reaction || typeof reaction !== 'string') {
        return NextResponse.json({ error: 'Missing reaction emoji' }, { status: 400 })
      }

      let reactions: Record<string, string[]> = {}
      try {
        reactions = JSON.parse(message.reactions || '{}')
        if (typeof reactions !== 'object' || reactions === null) reactions = {}
      } catch (e) {
        reactions = {}
      }

      if (!reactions[reaction]) {
        reactions[reaction] = []
      }

      if (reactions[reaction].includes(session.userId)) {
        reactions[reaction] = reactions[reaction].filter(id => id !== session.userId)
      } else {
        // Toggle off from other reactions first, or allow multiple? Let's toggle off from other emojis to prevent reaction spamming
        Object.keys(reactions).forEach(emoji => {
          reactions[emoji] = (reactions[emoji] || []).filter(id => id !== session.userId)
        })
        reactions[reaction].push(session.userId)
      }

      // Cleanup empty reaction categories
      Object.keys(reactions).forEach(emoji => {
        if (reactions[emoji].length === 0) {
          delete reactions[emoji]
        }
      })

      const updated = await prisma.communityMessage.update({
        where: { id: messageId },
        data: { reactions: JSON.stringify(reactions) },
        include: {
          sender: { select: { id: true, name: true, role: true } },
          replyTo: {
            include: {
              sender: { select: { id: true, name: true } }
            }
          }
        }
      })

      // Emit real-time SSE update event
      sseEmitter.emit(`chat:${courseId}:update`, updated)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
