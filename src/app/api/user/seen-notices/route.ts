import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const KEY_PATTERN = /^[a-z0-9_]{3,64}$/i

/** Which one-time notices has this account already seen? */
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await (prisma.user as any).findUnique({
      where: { id: session.userId },
      select: { seenNotices: true },
    })
    return NextResponse.json(
      { seen: Array.isArray(user?.seenNotices) ? user.seenNotices : [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Error reading seen notices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Marks one notice as seen for good. Safe to call more than once. */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const key = typeof body?.key === 'string' ? body.key : ''
    if (!KEY_PATTERN.test(key)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }
    const user = await (prisma.user as any).findUnique({
      where: { id: session.userId },
      select: { seenNotices: true },
    })
    const current: string[] = Array.isArray(user?.seenNotices) ? user.seenNotices : []
    if (!current.includes(key)) {
      await (prisma.user as any).update({
        where: { id: session.userId },
        data: { seenNotices: { push: key } },
      })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving seen notice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
