// Job tasks: managers assign tasks (with a deadline) to applicants; applicants submit work and talk to the manager.
// Rows live in the website tables job_tasks / job_task_submissions / job_messages (see lib/site-db).
import { storefrontDb } from '@/lib/storefront/db'
import { notifyEmails, notifyManagers } from '@/lib/jobs/notify'

export type Task = {
  id: string; title: string; description: string; deadline: string | null
  mode: 'ALL' | 'ROLE' | 'SELECTED'; role?: string; emails?: string[]
  created_by: string; created_at: string
}
export type Submission = { id: string; task_id: string; email: string; name: string; text: string; link: string; status: 'SUBMITTED' | 'APPROVED' | 'CHANGES'; review_note?: string; created_at: string; updated_at?: string }
export type Message = { id: string; email: string; sender: 'APPLICANT' | 'MANAGER'; sender_name: string; text: string; created_at: string }

const lc = (s: unknown) => String(s || '').trim().toLowerCase()
const rows = async (table: string, build: (q: any) => any = (q) => q): Promise<any[]> => {
  const { data, error } = await build(storefrontDb().from(table).select('*'))
  if (error) throw new Error(error.message)
  return data || []
}

export async function applicationsOf(email: string) {
  const all = await rows('job_applications', (q) => q.ilike('email', email))
  return all.filter((a) => lc(a.email) === lc(email))
}

export const isAssigned = (t: Task, email: string, apps: any[]) =>
  apps.length > 0 && (t.mode === 'ALL' || (t.mode === 'ROLE' && apps.some((a) => a.role === t.role)) || (t.mode === 'SELECTED' && (t.emails || []).map(lc).includes(lc(email))))

/** Everything one person sees (or a manager sees about that person). */
export async function loadWorkspace(email: string) {
  const [applications, allTasks, subs, msgs] = await Promise.all([
    applicationsOf(email),
    rows('job_tasks', (q) => q.order('created_at', { ascending: false })),
    rows('job_task_submissions', (q) => q.ilike('email', email)),
    rows('job_messages', (q) => q.ilike('email', email).order('created_at', { ascending: true })),
  ])
  const submissions = subs.filter((s) => lc(s.email) === lc(email)) as Submission[]
  const messages = msgs.filter((m) => lc(m.email) === lc(email)) as Message[]
  const tasks = (allTasks as Task[]).filter((t) => isAssigned(t, email, applications)).map((t) => ({ ...t, submission: submissions.find((s) => s.task_id === t.id) || null }))

  const timeline = [
    ...applications.map((a) => ({ at: a.created_at, type: 'applied', text: `Applied for ${a.role_title || a.role}` })),
    ...tasks.map((t) => ({ at: t.created_at, type: 'task', text: `Task assigned: ${t.title}${t.deadline ? ` (due ${t.deadline})` : ''}` })),
    ...submissions.flatMap((s) => {
      const t = allTasks.find((x: any) => x.id === s.task_id)
      return [
        { at: s.created_at, type: 'submitted', text: `Submitted: ${t?.title || 'task'}` },
        ...(s.status !== 'SUBMITTED' && s.updated_at ? [{ at: s.updated_at, type: 'review', text: `${s.status === 'APPROVED' ? 'Approved' : 'Changes requested'}: ${t?.title || 'task'}${s.review_note ? `. ${s.review_note}` : ''}` }] : []),
      ]
    }),
    ...messages.map((m) => ({ at: m.created_at, type: 'message', text: `${m.sender === 'MANAGER' ? 'Manager' : 'You'}: ${m.text}` })),
  ].filter((e) => e.at).sort((a, b) => String(a.at).localeCompare(String(b.at)))

  return { applications, tasks, messages, timeline }
}

export async function addMessage(email: string, sender: Message['sender'], senderName: string, text: string) {
  const clean = text.trim().slice(0, 2000)
  if (!clean) throw new Error('Message is empty')
  const { error } = await storefrontDb().from('job_messages').insert({ email: lc(email), sender, sender_name: senderName, text: clean, created_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  // The other side is told. Managers get a ping for applicant messages; applicants for manager messages.
  if (sender === 'APPLICANT') await notifyManagers(`${senderName} sent a message`, clean)
  else await notifyEmails([email], 'New message from the manager', clean)
}

/** Applicant submits (or re-submits until approved). */
export async function submitTask(email: string, name: string, taskId: string, text: string, link: string) {
  const ws = await loadWorkspace(email)
  const task = ws.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error('This task is not assigned to you')
  if (task.submission?.status === 'APPROVED') throw new Error('This task is already approved')
  if (!text.trim() && !link.trim()) throw new Error('Add some text or a link')
  const now = new Date().toISOString()
  const body = { task_id: taskId, email: lc(email), name, text: text.trim().slice(0, 4000), link: link.trim().slice(0, 500), status: 'SUBMITTED' as const, review_note: '', updated_at: now }
  const db = storefrontDb()
  const res = task.submission
    ? await db.from('job_task_submissions').update(body).eq('id', task.submission.id)
    : await db.from('job_task_submissions').insert({ ...body, created_at: now })
  if (res.error) throw new Error(res.error.message)
  await notifyManagers(`${name} submitted a task`, task.title)
}
