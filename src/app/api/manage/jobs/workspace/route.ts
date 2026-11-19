import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { storefrontDb } from '@/lib/storefront/db'
import { addMessage, loadWorkspace } from '@/lib/jobs/workspace'
import { notifyEmails } from '@/lib/jobs/notify'

export const dynamic = 'force-dynamic'

async function manager() {
  const s = await getSession()
  if (!s) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (s.role !== 'MANAGER') return { res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { s }
}
const noStore = { headers: { 'Cache-Control': 'no-store' } }

/** No query: tasks with submissions + the applicant list. ?email=: that person's whole workspace. */
export async function GET(req: NextRequest) {
  const m = await manager()
  if (m.res) return m.res
  try {
    const email = new URL(req.url).searchParams.get('email')
    if (email) return NextResponse.json(await loadWorkspace(email), noStore)
    const db = storefrontDb()
    const [tasks, subs, apps] = await Promise.all([
      db.from('job_tasks').select('*').order('created_at', { ascending: false }),
      db.from('job_task_submissions').select('*'),
      db.from('job_applications').select('*'),
    ])
    const people = new Map<string, { email: string; name: string; roles: string[] }>()
    for (const a of apps.data || []) {
      const k = String(a.email || '').toLowerCase()
      if (!k) continue
      const p = people.get(k) || { email: k, name: a.full_name || a.name || k, roles: [] }
      const r = a.role_title || a.role
      if (r && !p.roles.includes(r)) p.roles.push(r)
      people.set(k, p)
    }
    const roles = Array.from(new Map((apps.data || []).filter((a: any) => a.role).map((a: any) => [a.role, a.role_title || a.role])).entries()).map(([id, title]) => ({ id, title }))
    return NextResponse.json({ tasks: tasks.data || [], submissions: subs.data || [], applicants: Array.from(people.values()), roles }, noStore)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not load' }, { status: 500 })
  }
}

/** Body: createTask | deleteTask | message | review */
export async function POST(req: NextRequest) {
  const m = await manager()
  if (m.res) return m.res
  try {
    const b = await req.json()
    const db = storefrontDb()
    const now = new Date().toISOString()
    if (b.action === 'createTask') {
      const title = String(b.title || '').trim()
      if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
      const mode = ['ALL', 'ROLE', 'SELECTED'].includes(b.mode) ? b.mode : 'ALL'
      if (mode === 'SELECTED' && !(b.emails || []).length) return NextResponse.json({ error: 'Pick at least one person' }, { status: 400 })
      if (mode === 'ROLE' && !b.role) return NextResponse.json({ error: 'Pick a job' }, { status: 400 })
      const { error } = await db.from('job_tasks').insert({
        title, description: String(b.description || '').slice(0, 4000), deadline: b.deadline || null,
        mode, role: mode === 'ROLE' ? String(b.role) : null, emails: mode === 'SELECTED' ? (b.emails as string[]).map((e) => String(e).toLowerCase()) : [],
        created_by: m.s!.name, created_at: now,
      })
      if (error) throw new Error(error.message)
      // Tell everyone this task was assigned to.
      const { data: apps } = await db.from('job_applications').select('email, role')
      const to = mode === 'SELECTED' ? (b.emails as string[]) : (apps || []).filter((a: any) => mode === 'ALL' || a.role === b.role).map((a: any) => String(a.email))
      await notifyEmails(to, `New task: ${title}`, b.deadline ? `Due ${b.deadline}. Open Jobs → My work.` : 'Open Jobs → My work.')
    } else if (b.action === 'deleteTask') {
      await db.from('job_task_submissions').delete().eq('task_id', String(b.id))
      const { error } = await db.from('job_tasks').delete().eq('id', String(b.id))
      if (error) throw new Error(error.message)
    } else if (b.action === 'message') {
      await addMessage(String(b.email), 'MANAGER', m.s!.name, String(b.text || ''))
    } else if (b.action === 'review') {
      if (!['APPROVED', 'CHANGES'].includes(b.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      const { error } = await db.from('job_task_submissions').update({ status: b.status, review_note: String(b.note || '').slice(0, 1000), updated_at: now }).eq('id', String(b.id))
      if (error) throw new Error(error.message)
      const sub = (await db.from('job_task_submissions').select('*').eq('id', String(b.id)).maybeSingle()).data
      const task = sub ? (await db.from('job_tasks').select('title').eq('id', sub.task_id).maybeSingle()).data : null
      if (sub) await notifyEmails([sub.email], b.status === 'APPROVED' ? 'Task approved' : 'Changes requested', `${task?.title || 'Your task'}${b.note ? `: ${b.note}` : ''}`)
    } else return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Request failed' }, { status: 500 })
  }
}
