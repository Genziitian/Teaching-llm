import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getSession, canManageContent } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { GoogleClient, safeError } from '@/lib/automation/google'
import { meetCode, notesKey } from '@/lib/automation/matching'
import { LEASE } from '@/lib/automation/lease'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
class HttpError extends Error { constructor(public status: number, message: string) { super(message); Object.setPrototypeOf(this, new.target.prototype) } }
const responseError = (error: unknown) => error instanceof SyntaxError ? NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) : error instanceof HttpError ? NextResponse.json({ error: error.message }, { status: error.status }) : NextResponse.json({ error: safeError(error).message }, { status: 500 })
async function manager() {
  const session = await getSession()
  if (!session) throw new HttpError(401, 'Sign in required.')
  // This application reserves content management to MANAGER (ADMIN is course-scoped).
  if (!canManageContent(session.role)) throw new HttpError(403, 'Content manager access required.')
  return session
}
async function idle(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ active: boolean }>>`SELECT ("expiresAt" > NOW()) AS active FROM "AutomationLease" WHERE name=${LEASE} FOR UPDATE`
  if (rows[0]?.active) throw new HttpError(409, 'An import is running. Try this change after it finishes.')
}
function page(req: NextRequest) {
  const n = Number(req.nextUrl.searchParams.get('page') || 1)
  if (!Number.isSafeInteger(n) || n < 1) throw new HttpError(400, 'Invalid page.')
  return { skip: (n - 1) * 50, take: 50, page: n }
}
export async function GET(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    await manager()
    const path = (await context.params).path || []
    if (path[0] === 'settings') {
      const [configs, courses, lastRun] = await Promise.all([
        prisma.courseAutomationConfig.findMany(),
        prisma.course.findMany({ select: { id: true, name: true, topics: { select: { id: true, title: true } } }, orderBy: { name: 'asc' } }),
        prisma.automationRun.findFirst({ orderBy: { startedAt: 'desc' } }),
      ])
      const required = ['AUTOMATION_GOOGLE_CLIENT_ID', 'AUTOMATION_GOOGLE_CLIENT_SECRET', 'AUTOMATION_GOOGLE_REFRESH_TOKEN', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY']
      return NextResponse.json({ configs, courses, credentialsConfigured: required.every(key => !!process.env[key]), missingSettings: required.filter(key => !process.env[key]), lastRun })
    }
    if (path[0] === 'runs') {
      if (path[1]) {
        const run = await prisma.automationRun.findUnique({ where: { id: path[1] } })
        if (!run) throw new HttpError(404, 'Run not found.')
        return NextResponse.json(run)
      }
      const p = page(req)
      const [items, total] = await Promise.all([prisma.automationRun.findMany({ skip: p.skip, take: p.take, orderBy: { startedAt: 'desc' } }), prisma.automationRun.count()])
      return NextResponse.json({ items, total, page: p.page })
    }
    if (path[0] === 'imports') {
      const kind = req.nextUrl.searchParams.get('kind') || 'recording'
      if (!['recording', 'note'].includes(kind)) throw new HttpError(400, 'Invalid import kind.')
      const p = page(req), state = req.nextUrl.searchParams.get('state') || undefined, courseId = req.nextUrl.searchParams.get('courseId') || undefined
      if (kind === 'note') {
        const where = { state, courseId }
        const [items, total] = await Promise.all([prisma.noteImport.findMany({ where, skip: p.skip, take: p.take, orderBy: { firstSeenAt: 'desc' } }), prisma.noteImport.count({ where })])
        return NextResponse.json({ items, total, page: p.page })
      }
      const sessions = courseId ? await prisma.importedSession.findMany({ where: { courseId }, select: { id: true } }) : null
      const where = { state, ...(sessions ? { sessionId: { in: sessions.map(s => s.id) } } : {}) }
      const [items, total] = await Promise.all([prisma.recordingImport.findMany({ where, skip: p.skip, take: p.take, orderBy: { firstSeenAt: 'desc' } }), prisma.recordingImport.count({ where })])
      return NextResponse.json({ items, total, page: p.page })
    }
    if (path[0] === 'events') {
      const courseId = req.nextUrl.searchParams.get('courseId')
      if (!courseId) throw new HttpError(400, 'Select a course.')
      return NextResponse.json(await prisma.courseEvent.findMany({ where: { courseId, type: 'class', streamProvider: 'MEET', status: { not: 'CANCELLED' }, endTime: { lte: new Date() } }, select: { id: true, title: true, startTime: true }, orderBy: { startTime: 'desc' }, take: 200 }))
    }
    if (path[0] === 'pending') {
      const sessions = await prisma.importedSession.findMany({ where: { endTime: { lt: new Date(Date.now() - 7 * 86400000) } }, orderBy: { endTime: 'desc' }, take: 500 })
      const recordings = await prisma.recordingImport.findMany({ where: { sessionId: { in: sessions.map(s => s.id) }, contentId: { not: null } }, select: { sessionId: true } })
      const notes = await prisma.noteImport.findMany({ where: { primarySessionId: { in: sessions.map(s => s.id) } }, select: { primarySessionId: true } })
      const recorded = new Set(recordings.map(r => r.sessionId)), annotated = new Set(notes.map(n => n.primarySessionId))
      return NextResponse.json(sessions.filter(s => !recorded.has(s.id) || !annotated.has(s.id)).map(s => ({ ...s, warning: recorded.has(s.id) ? 'Notes overdue' : 'Recording missing' })))
    }
    throw new HttpError(404, 'Unknown automation endpoint.')
  } catch (e) { return responseError(e) }
}
export async function PUT(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    const actor = await manager(), path = (await context.params).path || []
    if (path[0] !== 'courses' || !path[1]) throw new HttpError(404, 'Unknown endpoint.')
    const body = await req.json()
    if (typeof body.enabled !== 'boolean' || typeof body.notesFolderId !== 'string' || !/^[\w-]{10,200}$/.test(body.notesFolderId) || typeof body.activationDate !== 'string') throw new HttpError(400, 'Provide enabled, Drive folder ID and activation date.')
    const activationDate = new Date(body.activationDate)
    if (!Number.isFinite(activationDate.getTime())) throw new HttpError(400, 'Invalid activation date.')
    if (body.enabled) await new GoogleClient().folder(body.notesFolderId)
    const config = await prisma.$transaction(async tx => {
      await idle(tx)
      const course = await tx.course.findUnique({ where: { id: path[1] } })
      if (!course) throw new HttpError(404, 'Course not found.')
      let topic = typeof body.destinationTopicId === 'string' && body.destinationTopicId ? await tx.topic.findUnique({ where: { id: body.destinationTopicId } }) : null
      if (body.destinationTopicId && topic?.courseId !== course.id) throw new HttpError(400, 'Topic must belong to this course.')
      if (!topic) {
        await tx.$queryRaw`SELECT id FROM "Class" WHERE id=${course.id} FOR UPDATE`
        topic = await tx.topic.findFirst({ where: { courseId: course.id, title: 'Daily Recordings' } })
        if (!topic) {
          const max = await tx.topic.aggregate({ where: { courseId: course.id }, _max: { order: true } })
          topic = await tx.topic.create({ data: { courseId: course.id, title: 'Daily Recordings', order: (max._max.order ?? -1) + 1 } })
        }
      }
      const data = { enabled: body.enabled, notesFolderId: body.notesFolderId, destinationTopicId: topic.id, activationDate }
      const result = await tx.courseAutomationConfig.upsert({ where: { courseId: course.id }, create: { courseId: course.id, ...data }, update: data })
      await tx.activityLog.create({ data: { userId: actor.userId, userName: actor.name, userRole: actor.role, actionType: 'AUTOMATION_CONFIGURED', actionDescription: `Updated automation for ${course.name}`, moduleName: 'Content', targetId: course.id } })
      return result
    })
    return NextResponse.json(config)
  } catch (e) { return responseError(e) }
}
export async function POST(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    const actor = await manager(), path = (await context.params).path || [], body = await req.json()
    if (path[0] !== 'imports' || !path[1] || !['resolve', 'retry', 'ignore'].includes(path[2])) throw new HttpError(404, 'Unknown endpoint.')
    if (!['recording', 'note'].includes(body.kind)) throw new HttpError(400, 'Specify recording or note.')
    if (path[2] === 'ignore' && (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 1000)) throw new HttpError(400, 'Provide a reason (maximum 1000 characters).')
    await prisma.$transaction(async tx => {
      await idle(tx)
      const item = body.kind === 'recording' ? await tx.recordingImport.findUnique({ where: { id: path[1] } }) : await tx.noteImport.findUnique({ where: { id: path[1] } })
      if (!item) throw new HttpError(404, 'Import not found.')
      let data: Record<string, unknown> = { nextAttemptAt: null, errorCode: null, errorMessage: null }
      if (path[2] === 'resolve') {
        if (item.contentId) throw new HttpError(409, 'Published associations cannot be reassigned. Existing content is preserved.')
        if (typeof body.eventId !== 'string') throw new HttpError(400, 'Select a timetable occurrence.')
        const event = await tx.courseEvent.findUnique({ where: { id: body.eventId } })
        const config = event?.courseId && await tx.courseAutomationConfig.findUnique({ where: { courseId: event.courseId } })
        if (!event || !config?.enabled || event.status === 'CANCELLED' || event.type !== 'class' || event.streamProvider !== 'MEET' || event.endTime > new Date() || event.startTime < config.activationDate || !meetCode(event.meetLink)) throw new HttpError(400, 'Select an ended Meet class in an enabled course.')
        if (body.kind === 'note' && (item as any).courseId !== event.courseId) throw new HttpError(400, 'Notes must stay in their configured course.')
        const session = await tx.importedSession.upsert({ where: { sourceEventId: event.id }, update: {}, create: { sourceEventId: event.id, courseId: event.courseId!, title: event.title, startTime: event.startTime, endTime: event.endTime, meetCode: meetCode(event.meetLink)!, notesKey: notesKey(event.startTime) } })
        data = { ...data, sessionId: session.id, matchMethod: 'ADMIN', state: 'DISCOVERED' }
      } else if (path[2] === 'ignore') data = { ...data, state: 'IGNORED', errorCode: 'ADMIN_IGNORED', errorMessage: body.reason.trim() }
      else data = { ...data, state: 'DISCOVERED' }
      if (body.kind === 'recording') await tx.recordingImport.update({ where: { id: item.id }, data })
      else await tx.noteImport.update({ where: { id: item.id }, data })
      await tx.activityLog.create({ data: { userId: actor.userId, userName: actor.name, userRole: actor.role, actionType: `AUTOMATION_${path[2].toUpperCase()}`, actionDescription: `${path[2]} ${body.kind} import`, moduleName: 'Content', targetId: item.id, metadata: JSON.stringify({ eventId: body.eventId, reason: body.reason }) } })
    })
    return NextResponse.json({ message: 'Saved. The next worker run will process eligible items. Use Trigger Run in Render to process now.' })
  } catch (e) { return responseError(e) }
}
