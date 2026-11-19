import { NextRequest, NextResponse } from 'next/server'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { prisma } from '@/lib/db'
import { db } from '@/lib/genie/server'

export const dynamic = 'force-dynamic'

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED']

// Manager review queue for Q&A GenZie picked up from community chats.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    if (auth.session!.role !== 'MANAGER') return NextResponse.json({ error: 'Managers only' }, { status: 403 })

    const status = new URL(request.url).searchParams.get('status')?.toUpperCase() || 'PENDING'
    if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Bad status' }, { status: 400 })

    const [rows, pending] = await Promise.all([
      db.genieLearnedQA.findMany({ where: { status }, orderBy: { createdAt: 'desc' }, take: 200 }),
      db.genieLearnedQA.count({ where: { status: 'PENDING' } }),
    ])
    const userIds = Array.from(new Set(rows.flatMap((r: any) => [r.askedById, r.answeredById]).filter(Boolean))) as string[]
    const courseIds = Array.from(new Set(rows.map((r: any) => r.courseId).filter(Boolean))) as string[]
    const [users, courses] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
      prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, name: true } }),
    ])
    const userName = new Map(users.map(u => [u.id, u.name]))
    const courseName = new Map(courses.map(c => [c.id, c.name]))
    return NextResponse.json({
      pending,
      items: rows.map((r: any) => ({
        id: r.id, question: r.question, answer: r.answer, status: r.status, source: r.source,
        courseName: courseName.get(r.courseId) || null,
        askedBy: userName.get(r.askedById) || null,
        answeredBy: userName.get(r.answeredById) || null,
        createdAt: r.createdAt, reviewedAt: r.reviewedAt,
      })),
    })
  } catch (e) {
    console.error('genie learned list', e)
    return NextResponse.json({ error: 'GenZie learning table is not ready. Run the database migration first.' }, { status: 500 })
  }
}
