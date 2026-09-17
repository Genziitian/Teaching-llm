import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { question, answer, category, appliesTo, order } = body

    if (!question || !question.trim() || !answer || !answer.trim()) {
      return NextResponse.json({ error: 'Question and answer are required.' }, { status: 400 })
    }

    const updated = await prisma.platformQuery.update({
      where: { id },
      data: {
        question: question.trim(),
        answer: answer.trim(),
        ...(category ? { category } : {}),
        ...(appliesTo ? { appliesTo } : {}),
        ...(typeof order === 'number' ? { order } : {}),
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.FAQ_UPDATED,
      actionDescription: `${session.name} updated platform query "${question.trim().slice(0, 50)}..."`,
      moduleName: MODULE.FAQ,
      targetId: id,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating platform query:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    const existing = await prisma.platformQuery.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Query not found' }, { status: 404 })
    }

    await prisma.platformQuery.delete({ where: { id } })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.FAQ_DELETED,
      actionDescription: `${session.name} deleted platform query "${existing.question.slice(0, 50)}..."`,
      moduleName: MODULE.FAQ,
      targetId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting platform query:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
