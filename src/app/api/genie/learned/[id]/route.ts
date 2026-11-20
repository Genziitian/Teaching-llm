import { NextRequest, NextResponse } from 'next/server'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { db } from '@/lib/genie/server'

export const dynamic = 'force-dynamic'

const MAX = 2000

// Approve (optionally with edited text) or reject one learned Q&A. Only APPROVED rows feed auto-replies.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const me = auth.session!
    if (me.role !== 'MANAGER') return NextResponse.json({ error: 'Managers only' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const action = body?.action
    if (action !== 'approve' && action !== 'reject') return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })

    const data: any = { status: action === 'approve' ? 'APPROVED' : 'REJECTED', reviewedById: me.userId, reviewedAt: new Date() }
    for (const field of ['question', 'answer'] as const) {
      if (body[field] === undefined) continue
      const v = typeof body[field] === 'string' ? body[field].trim() : ''
      if (!v || v.length > MAX) return NextResponse.json({ error: `${field} must be 1–${MAX} characters` }, { status: 400 })
      data[field] = v
    }

    const existing = await db.genieLearnedQA.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const row = await db.genieLearnedQA.update({ where: { id: params.id }, data })
    return NextResponse.json({ id: row.id, status: row.status, question: row.question, answer: row.answer })
  } catch (e) {
    console.error('genie learned review', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
