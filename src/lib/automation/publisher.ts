import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { createContentInTransaction } from '../content-publisher'
import { assertLease } from './lease'
import { ImportError } from './google'
import { fieldsUnchanged, lectureTitle, meetCode } from './matching'
async function validateSession(tx: Prisma.TransactionClient, session: { sourceEventId: string; courseId: string; startTime: Date; endTime: Date; meetCode: string }) {
  const event = await tx.courseEvent.findUnique({ where: { id: session.sourceEventId } })
  if (!event || event.courseId !== session.courseId || event.status === 'CANCELLED' || event.streamProvider !== 'MEET' || event.type !== 'class' || event.startTime.getTime() !== session.startTime.getTime() || event.endTime.getTime() !== session.endTime.getTime() || meetCode(event.meetLink) !== session.meetCode) throw new ImportError('TIMETABLE_CHANGED', 'Scheduled occurrence changed or was removed. Saved content is preserved; review required.')
}
const driveUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`

async function configuration(tx: Prisma.TransactionClient, courseId: string) {
  const config = await tx.courseAutomationConfig.findUnique({ where: { courseId } })
  const topic = config && await tx.topic.findUnique({ where: { id: config.destinationTopicId } })
  const course = await tx.course.findUnique({ where: { id: courseId } })
  if (!config?.enabled || topic?.courseId !== courseId || !course || course.isDisabled || (course.expiresAt && course.expiresAt < new Date())) throw new ImportError('CONFIGURATION', 'Course or destination topic is unavailable.')
  return config
}
export async function publishRecording(id: string, runId: string) {
  return prisma.$transaction(async tx => {
    await assertLease(tx, runId)
    await tx.$queryRaw`SELECT id FROM "RecordingImport" WHERE id=${id} FOR UPDATE`
    const item = await tx.recordingImport.findUniqueOrThrow({ where: { id } })
    if (['IGNORED', 'NEEDS_REVIEW'].includes(item.state)) return false
    if (!item.sessionId || !item.driveFileId) throw new ImportError('MATCH_REQUIRED', 'Recording has not been matched.')
    const session = await tx.importedSession.findUniqueOrThrow({ where: { id: item.sessionId } })
    await validateSession(tx, session)
    const config = await configuration(tx, session.courseId)
    if (item.contentId) {
      const existing = await tx.content.findUnique({ where: { id: item.contentId } })
      if (!existing) throw new ImportError('CONTENT_DELETED', 'Published lecture was deleted; it will not be recreated.')
      if (!fieldsUnchanged(existing, (item.lastPublishedValues || {}) as Record<string, unknown>)) throw new ImportError('MANUAL_EDIT', 'Published lecture has manual edits. These have been preserved.')
      return false
    }
    const siblings = await tx.recordingImport.findMany({ where: { sessionId: session.id, state: { not: 'IGNORED' } }, orderBy: [{ startTime: 'asc' }, { googleRecordingName: 'asc' }] })
    const index = siblings.findIndex(s => s.id === id)
    const values = { title: lectureTitle(session.title, session.startTime, siblings.length > 1 ? index + 1 : undefined), videoUrl: driveUrl(item.driveFileId), videoSource: 'GOOGLE_DRIVE', topicId: config.destinationTopicId }
    const content = await createContentInTransaction(tx, { ...values, youtubeUrl: null, strictDriveAccess: true, isDemo: false, duration: item.endTime ? `${Math.max(0, Math.round((item.endTime.getTime() - item.startTime.getTime()) / 60000))} min` : null })
    await tx.recordingImport.update({ where: { id }, data: { contentId: content.id, state: 'PUBLISHED', publishedAt: new Date(), lastPublishedValues: values, errorCode: null, errorMessage: null, nextAttemptAt: null } })
    return true
  })
}
export async function publishNote(id: string, runId: string) {
  return prisma.$transaction(async tx => {
    await assertLease(tx, runId)
    await tx.$queryRaw`SELECT id FROM "NoteImport" WHERE id=${id} FOR UPDATE`
    const item = await tx.noteImport.findUniqueOrThrow({ where: { id } })
    if (['IGNORED', 'NEEDS_REVIEW'].includes(item.state)) return false
    if (!item.sessionId) throw new ImportError('MATCH_REQUIRED', 'Notes have not been matched.')
    await tx.$queryRaw`SELECT id FROM "ImportedSession" WHERE id=${item.sessionId} FOR UPDATE`
    const session = await tx.importedSession.findUniqueOrThrow({ where: { id: item.sessionId } })
    await validateSession(tx, session)
    const config = await configuration(tx, session.courseId)
    if (item.contentId) {
      const existing = await tx.content.findUnique({ where: { id: item.contentId } })
      if (!existing) throw new ImportError('CONTENT_DELETED', 'Published notes were deleted; they will not be recreated.')
      if (!fieldsUnchanged(existing, (item.lastPublishedValues || {}) as Record<string, unknown>)) throw new ImportError('MANUAL_EDIT', 'Published notes have manual edits. These have been preserved.')
      await tx.noteImport.update({ where: { id }, data: { state: 'ATTACHED', errorCode: null, errorMessage: null, nextAttemptAt: null } })
      return false
    }
    const first = await tx.recordingImport.findFirst({ where: { sessionId: session.id, state: { not: 'IGNORED' } }, orderBy: [{ startTime: 'asc' }, { googleRecordingName: 'asc' }] })
    if (!first?.contentId) {
      await tx.noteImport.update({ where: { id }, data: { state: 'WAITING_FOR_RECORDING' } }); return false
    }
    const primary = await tx.noteImport.findUnique({ where: { primarySessionId: session.id } })
    let contentId: string
    let values: Record<string, string>
    if (!primary) {
      const content = await tx.content.findUnique({ where: { id: first.contentId } })
      if (!content) throw new ImportError('CONTENT_DELETED', 'Primary lecture was deleted.')
      if (content.pptUrl) throw new ImportError('MANUAL_EDIT', 'Lecture already has manually attached notes.')
      values = { pptUrl: driveUrl(item.driveFileId) }
      await tx.content.update({ where: { id: content.id }, data: { ...values, strictDriveAccess: true } })
      contentId = content.id
    } else {
      values = { pptUrl: driveUrl(item.driveFileId), topicId: config.destinationTopicId, title: `${lectureTitle(session.title, session.startTime)} — ${item.fileName}` }
      const content = await createContentInTransaction(tx, { topicId: values.topicId, title: values.title, pptUrl: values.pptUrl, strictDriveAccess: true, isDemo: false })
      contentId = content.id
    }
    await tx.noteImport.update({ where: { id }, data: { contentId, attachmentRole: primary ? 'ADDITIONAL' : 'PRIMARY', primarySessionId: primary ? null : session.id, state: 'ATTACHED', attachedAt: new Date(), lastPublishedValues: values, errorCode: null, errorMessage: null, nextAttemptAt: null } })
    return true
  })
}

// Discovery can reveal an earlier segment on a later day. Reconcile only values
// still owned by automation; never move a manually changed notes attachment.
export async function reconcileParts(sessionId: string, runId: string) {
  await prisma.$transaction(async tx => {
    await assertLease(tx, runId)
    await tx.$queryRaw`SELECT id FROM "ImportedSession" WHERE id=${sessionId} FOR UPDATE`
    const session = await tx.importedSession.findUniqueOrThrow({ where: { id: sessionId } })
    const parts = await tx.recordingImport.findMany({ where: { sessionId, state: { not: 'IGNORED' } }, orderBy: [{ startTime: 'asc' }, { googleRecordingName: 'asc' }] })
    if (!parts.length) return
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]
      if (!part.contentId || part.state !== 'PUBLISHED') continue
      const content = await tx.content.findUnique({ where: { id: part.contentId } })
      const previous = (part.lastPublishedValues || {}) as Record<string, any>
      const title = lectureTitle(session.title, session.startTime, parts.length > 1 ? index + 1 : undefined)
      if (content && content.title === previous.title && title !== content.title) {
        await tx.content.update({ where: { id: content.id }, data: { title } })
        await tx.recordingImport.update({ where: { id: part.id }, data: { lastPublishedValues: { ...previous, title } } })
      }
    }
    const primary = await tx.noteImport.findUnique({ where: { primarySessionId: sessionId } })
    if (primary?.state !== 'ATTACHED' || !parts[0].contentId || parts[0].state !== 'PUBLISHED' || primary.contentId === parts[0].contentId) return
    const old = primary.contentId && await tx.content.findUnique({ where: { id: primary.contentId } })
    const target = await tx.content.findUnique({ where: { id: parts[0].contentId } })
    if (!old || !target || target.pptUrl || old.pptUrl !== (primary.lastPublishedValues as any)?.pptUrl) throw new ImportError('MANUAL_EDIT', 'Earlier recording appeared but primary notes cannot be moved without overriding an edit.')
    await tx.content.update({ where: { id: old.id }, data: { pptUrl: null } })
    await tx.content.update({ where: { id: target.id }, data: { pptUrl: old.pptUrl, strictDriveAccess: true } })
    await tx.noteImport.update({ where: { id: primary.id }, data: { contentId: target.id } })
  })
}
