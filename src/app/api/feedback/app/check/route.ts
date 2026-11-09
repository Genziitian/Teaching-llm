import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || 'WEB'

    // Accounts younger than 7 days are never asked (server-side, so it can't be bypassed)
    const account = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { createdAt: true },
    })
    const ageMs = account ? Date.now() - new Date(account.createdAt).getTime() : 0
    if (!(ageMs >= 7 * 24 * 60 * 60 * 1000)) {
      return NextResponse.json({ submitted: true })
    }

    const existing = await (prisma as any).appFeedback.findFirst({
      where: { studentId: session.userId, platform }
    })

    return NextResponse.json({ submitted: !!existing })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
