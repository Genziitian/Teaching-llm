import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { MASTER_QUERIES } from '@/lib/queries-master'

// Ensure table exists safely in PostgreSQL
let tableEnsured = false
async function ensurePlatformQueryTable() {
  if (tableEnsured) return
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PlatformQuery" (
        "id" TEXT NOT NULL,
        "question" TEXT NOT NULL,
        "answer" TEXT NOT NULL,
        "category" TEXT NOT NULL DEFAULT 'GENERAL',
        "appliesTo" TEXT NOT NULL DEFAULT 'BOTH',
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PlatformQuery_pkey" PRIMARY KEY ("id")
      );
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PlatformQuery_category_idx" ON "PlatformQuery"("category");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PlatformQuery_order_idx" ON "PlatformQuery"("order");`)
    tableEnsured = true
  } catch (err) {
    // If DB is offline or read-only, log warning
    console.warn('[PlatformQuery] Failed to verify/create table:', err)
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensurePlatformQueryTable()

    try {
      let queries = await prisma.platformQuery.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      })

      // Auto-seed default master queries if database table is empty
      if (queries.length === 0) {
        await prisma.platformQuery.createMany({
          data: MASTER_QUERIES.map((item, idx) => ({
            question: item.question,
            answer: item.answer,
            category: item.category,
            appliesTo: item.appliesTo,
            order: item.order ?? idx,
          })),
        })
        queries = await prisma.platformQuery.findMany({
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        })
      }

      return NextResponse.json(queries)
    } catch (dbError) {
      console.warn('[PlatformQuery] DB read failed, using fallback MASTER_QUERIES:', dbError)
      // Graceful fallback to in-memory master queries
      const fallback = MASTER_QUERIES.map((item, idx) => ({
        ...item,
        id: `master-${idx}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
      return NextResponse.json(fallback)
    }
  } catch (error) {
    console.error('Error fetching platform queries:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensurePlatformQueryTable()

    const body = await request.json()

    // Restore master defaults
    if (body.action === 'RESET_DEFAULTS') {
      try {
        await prisma.platformQuery.deleteMany({})
        await prisma.platformQuery.createMany({
          data: MASTER_QUERIES.map((item, idx) => ({
            question: item.question,
            answer: item.answer,
            category: item.category,
            appliesTo: item.appliesTo,
            order: item.order ?? idx,
          })),
        })
        const queries = await prisma.platformQuery.findMany({
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        })

        logActivity({
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          actionType: ACTION.FAQ_UPDATED,
          actionDescription: `${session.name} reset Manager Platform Queries to master defaults`,
          moduleName: MODULE.FAQ,
        })

        return NextResponse.json({ success: true, queries })
      } catch (err: any) {
        console.error('Error resetting platform queries:', err)
        return NextResponse.json({ error: 'Failed to reset queries in database' }, { status: 500 })
      }
    }

    const { question, answer, category, appliesTo, order } = body
    if (!question || !question.trim() || !answer || !answer.trim()) {
      return NextResponse.json({ error: 'Question and answer are required.' }, { status: 400 })
    }

    const newQuery = await prisma.platformQuery.create({
      data: {
        question: question.trim(),
        answer: answer.trim(),
        category: category || 'GENERAL',
        appliesTo: appliesTo || 'BOTH',
        order: typeof order === 'number' ? order : 0,
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.FAQ_CREATED,
      actionDescription: `${session.name} created platform query: "${question.trim().slice(0, 50)}..."`,
      moduleName: MODULE.FAQ,
      targetId: newQuery.id,
    })

    return NextResponse.json(newQuery, { status: 201 })
  } catch (error) {
    console.error('Error saving platform query:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
