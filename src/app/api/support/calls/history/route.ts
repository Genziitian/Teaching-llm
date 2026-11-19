import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { callListSelect, expireRingingCalls } from '@/lib/support-calls'

export const dynamic = 'force-dynamic'

// Manager-only call log: ?userId= narrows it to one student. managerId = who picked up / handled it.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    if (auth.session!.role !== 'MANAGER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await expireRingingCalls()

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const page = Math.max(0, Number(searchParams.get('page')) || 0)
    const calls = await prisma.supportCall.findMany({
      where: userId ? { callerId: userId } : {},
      select: callListSelect,
      orderBy: { createdAt: 'desc' },
      skip: page * 50,
      take: 50,
    })
    return NextResponse.json(calls)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
