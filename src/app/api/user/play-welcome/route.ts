import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

/** Has this account already seen the one-time Play Store welcome? */
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await (prisma.user as any).findUnique({
      where: { id: session.userId },
      select: { hasSeenPlayStoreWelcome: true },
    })
    return NextResponse.json(
      { seen: Boolean(user?.hasSeenPlayStoreWelcome) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Error reading play welcome status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Marks the welcome as seen for good (safe to call more than once). */
export async function POST() {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await (prisma.user as any).update({
      where: { id: session.userId },
      data: { hasSeenPlayStoreWelcome: true },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving play welcome status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
