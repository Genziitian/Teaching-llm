import { NextRequest, NextResponse } from 'next/server'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { sendNewLiveChatNotificationToManagers } from '@/lib/system-notifications'
import { db, sweep, validImageUrl, GENIE_TYPE } from '@/lib/genie/server'
import { GENIE_MAX_MESSAGE, MAX_REQUESTS_PER_DAY, WAIT_FALLBACK_MS } from '@/lib/genie/limits'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    const me = auth.session!
    if (me.role !== 'STUDENT') return NextResponse.json({ error: 'Only students can request an agent' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const message = String(body.message || '').trim().slice(0, GENIE_MAX_MESSAGE)
    const imageUrl = validImageUrl(body.imageUrl)
    const context = String(body.context || '').slice(0, 3000) || null
    if (!message && !imageUrl) return NextResponse.json({ error: 'Please describe your problem' }, { status: 400 })

    await sweep(true)

    const active = await db.chatSession.findFirst({
      where: { type: GENIE_TYPE, studentId: me.userId, status: { in: ['WAITING', 'LIVE'] } },
      select: { id: true },
    })
    if (active) return NextResponse.json({ error: 'You already have a chat with an agent', sessionId: active.id }, { status: 409 })

    const since = new Date(); since.setHours(0, 0, 0, 0)
    const today = await db.chatSession.count({ where: { type: GENIE_TYPE, studentId: me.userId, createdAt: { gte: since } } })
    if (today >= MAX_REQUESTS_PER_DAY) {
      return NextResponse.json({ error: `You can request an agent ${MAX_REQUESTS_PER_DAY} times a day. Please try again tomorrow.` }, { status: 429 })
    }

    const s = await db.chatSession.create({
      data: {
        studentId: me.userId, type: GENIE_TYPE, status: 'WAITING', context,
        expiresAt: new Date(Date.now() + WAIT_FALLBACK_MS),
        messages: { create: [{ senderId: me.userId, content: message, imageUrl }] },
      },
      select: { id: true },
    })
    sendNewLiveChatNotificationToManagers(s.id, me.name, message || '(photo)').catch(() => {})
    return NextResponse.json({ id: s.id })
  } catch (e) {
    console.error('genie request', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
