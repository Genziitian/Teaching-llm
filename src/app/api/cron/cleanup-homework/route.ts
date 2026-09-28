import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const RETENTION_DAYS_AFTER_DUE = 7

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isAuthorizedCron = Boolean(
      cronSecret && authHeader === `Bearer ${cronSecret}`
    )

    const session = await getSession()
    const isManager = session?.role === 'MANAGER' || session?.role === 'ADMIN'

    if (!isAuthorizedCron && !isManager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cutoff = new Date(Date.now() - RETENTION_DAYS_AFTER_DUE * 24 * 60 * 60 * 1000)

    // Delete homework whose deadline was more than 7 days ago.
    // Cascade deletes all associated HomeworkSubmission records.
    const deletedHomework = await prisma.homework.deleteMany({
      where: {
        dueAt: { lt: cutoff },
      },
    })

    return NextResponse.json({
      success: true,
      retentionDays: RETENTION_DAYS_AFTER_DUE,
      cutoff: cutoff.toISOString(),
      deletedHomeworkCount: deletedHomework.count,
    })
  } catch (error: any) {
    console.error('Error during homework cleanup cron:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
