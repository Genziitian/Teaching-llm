import { NextResponse } from 'next/server'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { db, sweep, GENIE_TYPE } from '@/lib/genie/server'

export const dynamic = 'force-dynamic'

// Managers poll this on every page: waiting requests (popup) + live chats they own.
export async function GET() {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const me = auth.session!
    if (me.role !== 'MANAGER') return NextResponse.json({ waiting: [], live: [] })

    await sweep()
    const rows = await db.chatSession.findMany({
      where: { type: GENIE_TYPE, OR: [{ status: 'WAITING' }, { status: 'LIVE', agentId: me.userId }] },
      orderBy: { createdAt: 'asc' },
      take: 30,
      include: {
        student: { select: { name: true } },
        messages: { where: { isDeleted: false }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
    })
    const shape = (s: any) => ({
      id: s.id,
      studentName: s.student?.name || 'Student',
      firstMessage: s.messages[0]?.content || (s.messages[0]?.imageUrl ? '(photo)' : ''),
      hasImage: !!s.messages[0]?.imageUrl,
      context: s.context || '',
      createdAt: s.createdAt,
      ticketId: s.ticketId || null,
    })
    return NextResponse.json({
      waiting: rows.filter((r: any) => r.status === 'WAITING').map(shape),
      live: rows.filter((r: any) => r.status === 'LIVE').map(shape),
    })
  } catch (e) {
    console.error('genie queue', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
