import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { MASTER_FAQS } from '@/lib/faqs-master'

export async function GET() {
  try {
    let faqs = await prisma.faq.findMany({ orderBy: { order: 'asc' } })

    // Auto-seed master FAQs if database table is currently empty
    if (faqs.length === 0) {
      await prisma.faq.createMany({
        data: MASTER_FAQS.map(item => ({
          question: item.question,
          answer: item.answer,
          order: item.order,
        })),
      })
      faqs = await prisma.faq.findMany({ orderBy: { order: 'asc' } })
    }

    return NextResponse.json(faqs)
  } catch (error) {
    console.error('Error fetching FAQs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Option to restore master defaults
    if (body.action === 'RESET_DEFAULTS') {
      await prisma.faq.deleteMany({})
      await prisma.faq.createMany({
        data: MASTER_FAQS.map(item => ({
          question: item.question,
          answer: item.answer,
          order: item.order,
        })),
      })
      const faqs = await prisma.faq.findMany({ orderBy: { order: 'asc' } })
      logActivity({
        userId: session.userId,
        userName: session.name,
        userRole: session.role,
        actionType: ACTION.FAQ_UPDATED,
        actionDescription: `${session.name} reset FAQs to master defaults`,
        moduleName: MODULE.FAQ,
      })
      return NextResponse.json({ success: true, faqs })
    }

    const { question, answer, order } = body
    if (!question || !question.trim() || !answer || !answer.trim()) {
      return NextResponse.json({ error: 'Question and answer are required.' }, { status: 400 })
    }

    const faq = await prisma.faq.create({
      data: {
        question: question.trim(),
        answer: answer.trim(),
        order: typeof order === 'number' ? order : 0,
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.FAQ_CREATED,
      actionDescription: `${session.name} created FAQ "${question.trim()}"`,
      moduleName: MODULE.FAQ,
      targetId: faq.id,
    })

    return NextResponse.json(faq, { status: 201 })
  } catch (error) {
    console.error('Error saving FAQ:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
