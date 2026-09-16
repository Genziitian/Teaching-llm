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

    const body = await request.json()
    const { question, answer, order } = body

    const updateData: Record<string, any> = {}
    if (question !== undefined && question.trim()) {
      updateData.question = question.trim()
    }
    if (answer !== undefined && answer.trim()) {
      updateData.answer = answer.trim()
    }
    if (order !== undefined && typeof order === 'number') {
      updateData.order = order
    }

    const faq = await prisma.faq.update({
      where: { id: params.id },
      data: updateData,
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.FAQ_UPDATED,
      actionDescription: `${session.name} updated FAQ "${faq.question}"`,
      moduleName: MODULE.FAQ,
      targetId: params.id,
    })

    return NextResponse.json(faq)
  } catch (error) {
    console.error('Error updating FAQ:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const faq = await prisma.faq.findUnique({
      where: { id: params.id },
      select: { question: true },
    })

    if (!faq) {
      return NextResponse.json({ error: 'FAQ not found' }, { status: 404 })
    }

    await prisma.faq.delete({ where: { id: params.id } })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.FAQ_DELETED,
      actionDescription: `${session.name} deleted FAQ "${faq?.question}"`,
      moduleName: MODULE.FAQ,
      targetId: params.id,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting FAQ:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
