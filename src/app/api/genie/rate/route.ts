import { NextRequest, NextResponse } from 'next/server'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { db, GENIE_TYPE } from '@/lib/genie/server'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const me = auth.session!
    const { sessionId, rating } = await req.json().catch(() => ({}))
    const r = rating === 1 ? 1 : rating === -1 ? -1 : 0
    if (!sessionId || !r) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    const res = await db.chatSession.updateMany({
      where: { id: String(sessionId), studentId: me.userId, type: GENIE_TYPE, status: 'ENDED', rating: null },
      data: { rating: r },
    })
    return NextResponse.json({ ok: res.count > 0 })
  } catch (e) {
    console.error('genie rate', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
