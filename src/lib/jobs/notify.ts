// In-app + push notifications for the job task workflow. Never throws: a failed notification must not fail the action.
import { prisma } from '@/lib/db'
import { sendFcmToUsers } from '@/lib/fcm'
import { sendPushToUsers } from '@/lib/push'
import { sseEmitter } from '@/lib/sse'
import { getManagerIds } from '@/lib/system-notifications'

async function notifyUsers(userIds: string[], title: string, body: string, url: string) {
  try {
    const ids = Array.from(new Set(userIds))
    if (!ids.length) return
    await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, title, content: body.slice(0, 200), type: 'INFO' })) })
    ids.forEach((id) => sseEmitter.emit(`user:${id}:notify`))
    const payload = { title, body: body.slice(0, 120), url, tag: 'job_task', importance: 'high' as const, sound: 'default' as const }
    await Promise.allSettled([sendPushToUsers(ids, payload), sendFcmToUsers(ids, payload)])
  } catch (err) {
    console.error('[jobs-notify]', (err as Error)?.message || err)
  }
}

export async function notifyEmails(emails: string[], title: string, body: string) {
  const list = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)))
  if (!list.length) return
  const users = await prisma.user.findMany({ where: { email: { in: list, mode: 'insensitive' } }, select: { id: true } })
  await notifyUsers(users.map((u) => u.id), title, body, '/jobs?view=work')
}

export async function notifyManagers(title: string, body: string) {
  await notifyUsers(await getManagerIds(), title, body, '/jobs?view=manage')
}
