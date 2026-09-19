import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, getAccessibleCourseIds } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { validateLength, sanitizeInput } from '@/lib/validation'
import { sseEmitter } from '@/lib/sse'
import { sendCommunityNotification, sendDMNotification, sendTagNotification, sendReplyNotification } from '@/lib/community-notifications'
import { ensureCourseColumns } from '@/lib/course-schema-sync'

// ─── DM helpers ─────────────────────────────────────────────────────────────

function isDM(courseId: string) { return courseId.startsWith('dm_') }
function chatId(courseId: string) { return courseId.slice(3) }
function canModerateCommunity(role: string) { return role === 'MANAGER' || role === 'ADMIN' }

async function getDMSession(chatId: string, userId: string, role: string) {
  const chat = await prisma.chatSession.findUnique({
    where: { id: chatId },
    include: {
      student: { select: { id: true, name: true, role: true } },
      agent: { select: { id: true, name: true, role: true } },
    },
  })
  if (!chat) return null
  // Only the student OR the specific agent (manager) who owns this DM can access it
  if (chat.studentId !== userId && chat.agentId !== userId) return null
  return chat
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params
    if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 })
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureCourseColumns()

    // ── Direct Message path ──────────────────────────────────────────────────
    if (isDM(courseId)) {
      const id = chatId(courseId)
      const chat = await getDMSession(id, session.userId, session.role)
      if (!chat) return NextResponse.json({ error: 'Chat not found or forbidden' }, { status: 404 })

      const dmWhere: any = { chatId: id }
      if (session.role !== 'MANAGER') {
        dmWhere.isDeleted = false
      }

      const rawMessages = await prisma.chatMessage.findMany({
        where: dmWhere,
        include: {
          sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } },
          replyTo: {
            include: {
              sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } }
            }
          }
        },
        orderBy: { createdAt: 'asc' },
      })

      const messages = rawMessages.map(m => ({
        id: m.id,
        content: m.isDeleted ? '' : m.content,
        imageUrl: m.isDeleted ? null : m.imageUrl,
        createdAt: m.createdAt,
        isDeleted: m.isDeleted,
        sender: {
          id: m.sender.id,
          name: m.sender.name,
          role: m.sender.role,
          avatar: m.sender.avatar,
          gender: m.sender.gender,
          securityNumber: undefined,
        },
        replyTo: m.replyTo ? {
          id: m.replyTo.id,
          content: m.replyTo.content,
          imageUrl: m.replyTo.imageUrl,
          sender: {
            id: m.replyTo.sender.id,
            name: m.replyTo.sender.name,
            role: m.replyTo.sender.role,
            avatar: m.replyTo.sender.avatar,
            gender: m.replyTo.sender.gender,
          }
        } : undefined,
      }))
      return NextResponse.json(messages)
    }

    // ── Community path ───────────────────────────────────────────────────────
    if (courseId === 'general-discussion') {
      const exists = await prisma.course.findUnique({
        where: { id: 'general-discussion' },
        select: { id: true }
      })
      if (!exists) {
        const mgr = await prisma.user.findFirst({ where: { role: { in: ['MANAGER', 'ADMIN'] } } })
        if (mgr) {
          await prisma.course.create({
            data: {
              id: 'general-discussion',
              name: 'General Discussion',
              description: 'Public community posts and general questions',
              createdById: mgr.id,
              isCommunityActive: true,
            },
            select: { id: true }
          })
        }
      }
    } else {
      const accessibleCourseIds = await getAccessibleCourseIds(session.userId, session.role)
      if (accessibleCourseIds !== null && !accessibleCourseIds.includes(courseId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { isCommunityActive: true },
    })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (!course.isCommunityActive && !canModerateCommunity(session.role)) {
      return NextResponse.json({ error: 'This community is currently disabled' }, { status: 403 })
    }

    const { searchParams } = new URL(_request.url)
    const cursor = searchParams.get('cursor')
    const limit = parseInt(searchParams.get('limit') || '50')

    const whereClause: any = { courseId }
    if (session.role !== 'MANAGER' && session.role !== 'ADMIN') {
      whereClause.isDeleted = false
      whereClause.isSystemDeleted = false
    }

    // The discussion wall paginates top-level posts, not chat messages.
    // Otherwise a busy comment thread can crowd every post out of a page.
    if (courseId === 'general-discussion' && searchParams.get('view') === 'feed') {
      const pageSize = Number.isFinite(limit) ? Math.min(50, Math.max(1, limit)) : 10
      const visibleWhere = { courseId, isDeleted: false, isSystemDeleted: false, deletedAt: null }
      const include = {
        sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } },
      }
      const posts = await prisma.communityMessage.findMany({
        where: { ...visibleWhere, replyToId: null },
        take: pageSize + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
      const hasMore = posts.length > pageSize
      const page = posts.slice(0, pageSize)
      const replies = page.length ? await prisma.communityMessage.findMany({
        where: { ...visibleWhere, replyToId: { in: page.map(post => post.id) } },
        include,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }) : []
      return NextResponse.json({
        messages: [...page, ...replies],
        hasMore,
        nextCursor: hasMore ? page[page.length - 1].id : null,
      })
    }

    const messages = await prisma.communityMessage.findMany({
      where: whereClause,
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        sender: { select: { id: true, name: true, role: true, securityNumber: true, avatar: true, gender: true } },
        replyTo: {
          include: {
            sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })
    messages.reverse()

    const sanitized = messages.map(msg => {
      const isActuallyDeleted = msg.isDeleted || msg.isSystemDeleted
      return {
        ...msg,
        content: (isActuallyDeleted && !canModerateCommunity(session.role)) ? '' : msg.content,
        sender: {
          ...msg.sender,
          securityNumber: canModerateCommunity(session.role) ? msg.sender.securityNumber : undefined,
        },
      }
    })
    return NextResponse.json(sanitized)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureCourseColumns()

    const { content, imageUrl, replyToId } = await request.json()
    if ((!content || !content.trim()) && !imageUrl) {
      return NextResponse.json({ error: 'Message must have content or an image' }, { status: 400 })
    }
    if (content && !validateLength(content, 2000)) {
      return NextResponse.json({ error: 'Message content must be between 1 and 2,000 characters' }, { status: 400 })
    }
    const sanitizedContent = content ? sanitizeInput(content) : ''

    // ── Direct Message path ──────────────────────────────────────────────────
    if (isDM(params.courseId)) {
      const id = chatId(params.courseId)
      const chat = await getDMSession(id, session.userId, session.role)
      if (!chat) return NextResponse.json({ error: 'Chat not found or forbidden' }, { status: 404 })

      // Both sides can send messages in a DIRECT chat

      const msg = await prisma.chatMessage.create({
        data: { 
          chatId: id, 
          senderId: session.userId, 
          content: sanitizedContent, 
          imageUrl: imageUrl || null,
          replyToId: replyToId || null
        },
        include: {
          sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } },
          replyTo: {
            include: {
              sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } }
            }
          }
        },
      })

      // Bump chat updatedAt for sorting
      await prisma.chatSession.update({
        where: { id },
        data: { updatedAt: new Date() },
      })

      logActivity({
        userId: session.userId,
        userName: session.name,
        userRole: session.role,
        actionType: ACTION.MESSAGE_SENT,
        actionDescription: `${session.name} sent a direct message`,
        moduleName: MODULE.COMMUNITY,
        targetId: msg.id,
      })

      // Emit SSE to both DM channel participants
      const event = { 
        id: msg.id, 
        content: msg.content, 
        imageUrl: msg.imageUrl, 
        createdAt: msg.createdAt, 
        isDeleted: false, 
        sender: { id: msg.sender.id, name: msg.sender.name, role: msg.sender.role, avatar: msg.sender.avatar, gender: msg.sender.gender },
        replyTo: msg.replyTo ? {
          id: msg.replyTo.id,
          content: msg.replyTo.content,
          imageUrl: msg.replyTo.imageUrl,
          sender: {
            id: msg.replyTo.sender.id,
            name: msg.replyTo.sender.name,
            role: msg.replyTo.sender.role,
            avatar: msg.replyTo.sender.avatar,
            gender: msg.replyTo.sender.gender,
          }
        } : undefined
      }
      sseEmitter.emit(`chat:dm_${id}:message`, event)

      // Notify the OTHER participant in the DM (non-blocking)
      const recipientId = chat.studentId === session.userId ? chat.agentId : chat.studentId
      sendDMNotification(id, { userId: session.userId, name: session.name }, recipientId, {
        content: msg.content,
        imageUrl: msg.imageUrl,
      }).catch(console.error)

      return NextResponse.json(event, { status: 201 })
    }

    // ── Community path ───────────────────────────────────────────────────────
    if (params.courseId !== 'general-discussion') {
      const accessibleCourseIds = await getAccessibleCourseIds(session.userId, session.role)
      if (accessibleCourseIds !== null && !accessibleCourseIds.includes(params.courseId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Enforce character limits: 500 for main posts, 300 for replies/comments
    const isComment = !!replyToId
    const maxChars = isComment ? 300 : 500
    if (content && content.length > maxChars) {
      return NextResponse.json({ error: `Message content exceeds character limit of ${maxChars}` }, { status: 400 })
    }

    if (session.role === 'STUDENT' && params.courseId !== 'general-discussion') {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: session.userId,
            courseId: params.courseId,
          },
        },
      })
      if (!enrollment || enrollment.type === 'DEMO') {
        return NextResponse.json(
          { error: 'Community chat is read-only in Demo mode. Unlock full course to send messages.' },
          { status: 403 }
        )
      }

      // Enforce posting rate limits for students (5 posts/day, 20 replies/day)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      if (isComment) {
        const repliesCount = await prisma.communityMessage.count({
          where: {
            senderId: session.userId,
            replyToId: { not: null },
            createdAt: { gte: oneDayAgo }
          }
        })
        if (repliesCount >= 20) {
          return NextResponse.json({ error: 'Daily reply limit of 20 replies reached' }, { status: 429 })
        }
      } else {
        const postsCount = await prisma.communityMessage.count({
          where: {
            senderId: session.userId,
            replyToId: null,
            createdAt: { gte: oneDayAgo }
          }
        })
        if (postsCount >= 5) {
          return NextResponse.json({ error: 'Daily post limit of 5 posts reached' }, { status: 429 })
        }
      }

      // Enforce file attachment limit (max 10 files/day) for students
      if (imageUrl) {
        const filesCount = await prisma.communityMessage.count({
          where: {
            senderId: session.userId,
            imageUrl: { not: null },
            createdAt: { gte: oneDayAgo }
          }
        })
        if (filesCount >= 10) {
          return NextResponse.json({ error: 'Daily attachment upload limit of 10 files reached' }, { status: 429 })
        }
      }
    }

    const course = await prisma.course.findUnique({
      where: { id: params.courseId },
      select: { name: true, isCommunityActive: true },
    })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (!course.isCommunityActive && !canModerateCommunity(session.role)) {
      return NextResponse.json({ error: 'This community is currently disabled' }, { status: 403 })
    }

    const message = await prisma.communityMessage.create({
      data: { 
        courseId: params.courseId, 
        senderId: session.userId, 
        content: sanitizedContent, 
        imageUrl: imageUrl || null,
        replyToId: replyToId || null
      },
      include: {
        sender: { select: { id: true, name: true, role: true, securityNumber: true, avatar: true, gender: true } },
        replyTo: {
          include: {
            sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } }
          }
        }
      },
    })

    await prisma.course.update({
      where: { id: params.courseId },
      data: { lastMessageAt: message.createdAt },
      select: { id: true },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.MESSAGE_SENT,
      actionDescription: `${session.name} sent a message in community chat`,
      moduleName: MODULE.COMMUNITY,
      targetId: message.id,
    })

    sseEmitter.emit(`chat:${params.courseId}:message`, message)

    // Parse tag notifications and reply notifications
    const courseName = course?.name || 'Community'
    let taggedUserIds: string[] = []

    if (sanitizedContent) {
      // Find all non-terminated admins/managers
      const staff = await prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'MANAGER'] },
          isTerminated: false,
        },
        select: { id: true, name: true },
      })
      const taggedStaff = staff.filter(user => {
        const tagStr = `@${user.name}`
        return sanitizedContent.toLowerCase().includes(tagStr.toLowerCase())
      })

      // Notify tagged staff members (excluding the sender themselves)
      const toNotify = taggedStaff.filter(user => user.id !== session.userId)
      taggedUserIds = toNotify.map(user => user.id)

      await Promise.all(
        toNotify.map(user =>
          sendTagNotification({
            courseId: params.courseId,
            courseName,
            senderName: session.name,
            senderId: session.userId,
            recipientId: user.id,
            messageContent: sanitizedContent,
            messageId: message.id,
          }).catch(console.error)
        )
      )
    }

    // Notify the original message sender if they were replied to
    if (replyToId && message.replyTo) {
      const originalSenderId = message.replyTo.sender.id
      // Send a reply notification if:
      // 1. The original sender is not the person replying
      // 2. The original sender was not already notified as a tagged user in this message
      if (originalSenderId !== session.userId && !taggedUserIds.includes(originalSenderId)) {
        sendReplyNotification({
          courseId: params.courseId,
          courseName,
          senderName: session.name,
          senderId: session.userId,
          recipientId: originalSenderId,
          messageContent: sanitizedContent || 'sent a photo',
          messageId: message.id,
        }).catch(console.error)
      }
    }

    // Notify all enrolled, unmuted users (non-blocking)
    sendCommunityNotification(params.courseId, {
      userId: session.userId,
      name: session.name,
      role: session.role,
    }, {
      content: message.content,
      imageUrl: message.imageUrl,
    }).catch(console.error)

    return NextResponse.json({
      ...message,
      sender: {
        ...message.sender,
        securityNumber: session.role === 'MANAGER' ? message.sender.securityNumber : undefined,
      },
    }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messageId } = await request.json()
    if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 })

    // ── Direct Message path ──────────────────────────────────────────────────
    if (isDM(params.courseId)) {
      const id = chatId(params.courseId)
      // Only managers can delete DM messages
      if (session.role !== 'MANAGER') {
        return NextResponse.json({ error: 'Only managers can delete messages in direct chats' }, { status: 403 })
      }

      const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } })
      if (!msg || msg.chatId !== id) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 })
      }

      await prisma.chatMessage.update({
        where: { id: messageId },
        data: { isDeleted: true, deletedAt: new Date(), content: '[Deleted by manager]' },
      })

      logActivity({
        userId: session.userId,
        userName: session.name,
        userRole: session.role,
        actionType: ACTION.MESSAGE_DELETED,
        actionDescription: `${session.name} deleted a direct message`,
        moduleName: MODULE.COMMUNITY,
        targetId: messageId,
      })

      sseEmitter.emit(`chat:dm_${id}:delete`, messageId)
      return NextResponse.json({ success: true })
    }

    // ── Community path ───────────────────────────────────────────────────────
    if (params.courseId !== 'general-discussion') {
      const accessibleCourseIds = await getAccessibleCourseIds(session.userId, session.role)
      if (accessibleCourseIds !== null && !accessibleCourseIds.includes(params.courseId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const course = await prisma.course.findUnique({
      where: { id: params.courseId },
      select: { isCommunityActive: true },
    })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (!course.isCommunityActive && !canModerateCommunity(session.role)) {
      return NextResponse.json({ error: 'This community is currently disabled' }, { status: 403 })
    }

    const message = await prisma.communityMessage.findUnique({ where: { id: messageId } })
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    if (message.courseId !== params.courseId) {
      return NextResponse.json({ error: 'Message does not belong to this course' }, { status: 400 })
    }
    if (session.role !== 'MANAGER' && message.senderId !== session.userId) {
      return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 })
    }
    if (session.role !== 'MANAGER' && Date.now() - message.createdAt.getTime() > 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Messages can only be deleted within 24 hours' }, { status: 403 })
    }
    if (message.isDeleted) return NextResponse.json({ error: 'Message already deleted' }, { status: 400 })

    await prisma.communityMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.MESSAGE_DELETED,
      actionDescription: `${session.name} deleted a message in community chat`,
      moduleName: MODULE.COMMUNITY,
      targetId: messageId,
      metadata: { originalContent: message.content },
    })

    sseEmitter.emit(`chat:${params.courseId}:delete`, messageId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH (Edit Message) ─────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messageId, content } = await request.json()
    if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 })
    }
    if (!validateLength(content, 2000)) {
      return NextResponse.json({ error: 'Message content must be between 1 and 2,000 characters' }, { status: 400 })
    }
    const sanitizedContent = sanitizeInput(content)

    // DMs do not support editing
    if (isDM(params.courseId)) {
      return NextResponse.json({ error: 'Editing is not supported in direct chats' }, { status: 400 })
    }

    // Community path
    if (params.courseId !== 'general-discussion') {
      const accessibleCourseIds = await getAccessibleCourseIds(session.userId, session.role)
      if (accessibleCourseIds !== null && !accessibleCourseIds.includes(params.courseId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const message = await prisma.communityMessage.findUnique({ where: { id: messageId } })
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    if (message.courseId !== params.courseId) {
      return NextResponse.json({ error: 'Message does not belong to this course' }, { status: 400 })
    }
    if (message.isDeleted || message.isSystemDeleted) {
      return NextResponse.json({ error: 'Cannot edit a deleted message' }, { status: 400 })
    }
    if (message.senderId !== session.userId) {
      return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 })
    }
    if (Date.now() - message.createdAt.getTime() > 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Messages can only be edited within 24 hours' }, { status: 403 })
    }

    const editedAt = new Date()
    const updated = await prisma.communityMessage.update({
      where: { id: messageId },
      data: {
        content: sanitizedContent,
        isEdited: true,
        editedAt,
      },
      include: {
        sender: { select: { id: true, name: true, role: true, securityNumber: true, avatar: true, gender: true } },
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.MESSAGE_EDITED,
      actionDescription: `${session.name} edited a message in community chat`,
      moduleName: MODULE.COMMUNITY,
      targetId: messageId,
      metadata: { originalContent: message.content },
    })

    sseEmitter.emit(`chat:${params.courseId}:edit`, {
      messageId,
      content: sanitizedContent,
      editedAt: editedAt.toISOString(),
    })

    return NextResponse.json({
      ...updated,
      sender: {
        ...updated.sender,
        securityNumber: session.role === 'MANAGER' ? updated.sender.securityNumber : undefined,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
