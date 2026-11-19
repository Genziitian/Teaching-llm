import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { addMessage, loadWorkspace, submitTask } from '@/lib/jobs/workspace'

export const dynamic = 'force-dynamic'

// The signed-in person's own job workspace: tasks, submissions, messages, timeline.
export async function GET() {
  const s = await getSession()
  if (!s?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await loadWorkspace(s.email), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not load' }, { status: 500 })
  }
}

/** Body: { action: 'submit', taskId, text?, link? } | { action: 'message', text } */
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const b = await req.json()
    if (b.action === 'submit') await submitTask(s.email, s.name || s.email, String(b.taskId || ''), String(b.text || ''), String(b.link || ''))
    else if (b.action === 'message') await addMessage(s.email, 'APPLICANT', s.name || s.email, String(b.text || ''))
    else return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Request failed' }, { status: 400 })
  }
}
