import { prisma } from '../db'
import { GoogleClient, GoogleSource, ImportError, Recording, safeError } from './google'
import { acquireLease, heartbeat, releaseLease } from './lease'
import { discoveryStart, matchRecording, meetCode, NOTE_MIMES, notesKey, Occurrence, parseNotesName } from './matching'
import { publishNote, publishRecording, reconcileParts } from './publisher'

export type RunOptions = { dryRun?: boolean; from?: Date; to?: Date; courseId?: string; trigger?: string }
const STOP_CODES = ['AUTH_REQUIRED', 'LEASE_LOST', 'DEADLINE', 'AUTH_UNAVAILABLE']
export async function runImport(options: RunOptions = {}, source?: GoogleSource) {
  if (!!options.from !== !!options.to || (options.from && (!(options.from < options.to!) || !Number.isFinite(options.to!.getTime())))) throw new Error('Backfill requires valid --from and --to dates in ascending order.')
  const run = await prisma.automationRun.create({ data: { trigger: options.from ? 'BACKFILL' : options.trigger || 'SCHEDULED', dryRun: !!options.dryRun } })
  const previousLease = await prisma.automationLease.findUnique({ where: { name: 'class-material-import' } })
  if (!await acquireLease(run.id)) return prisma.automationRun.update({ where: { id: run.id }, data: { status: 'SKIPPED', finishedAt: new Date(), errorSummary: 'Another import is running.' } })
  if (previousLease?.ownerRunId) await prisma.automationRun.updateMany({ where: { id: previousLease.ownerRunId, status: 'RUNNING' }, data: { status: 'FAILED', finishedAt: new Date(), errorSummary: 'Previous worker stopped without completing; its expired lease was recovered.' } })
  const now = new Date(), deadline = Date.now() + 20 * 60000
  const counts = { recordingsDiscovered: 0, recordingsPublished: 0, notesDiscovered: 0, notesAttached: 0, needsReview: 0, deferred: 0, errors: 0 }
  const report: Array<Record<string, unknown>> = []
  const emit = (entry: Record<string, unknown>) => { if (report.length < 2000) report.push(entry) }
  let lost: unknown = null, beat: Promise<void> | null = null
  const timer = setInterval(() => { if (!beat) beat = heartbeat(run.id).catch(e => { lost = e }).finally(() => { beat = null }) }, 60000)
  const check = () => { if (lost) throw lost; if (Date.now() > deadline) throw new ImportError('DEADLINE', 'Run time limit reached; remaining work is pending.', true) }
  let status = 'SUCCEEDED', summary: string | null = null
  const persistError = async (kind: 'recording' | 'note', id: string, error: unknown) => {
    const e = safeError(error)
    if (STOP_CODES.includes(e.code)) throw e
    counts.errors++; if (!e.retryable) counts.needsReview++
    emit({ kind, id, errorCode: e.code, message: e.message })
    if (!options.dryRun) {
      const data = { state: e.retryable ? 'RETRY_PENDING' : 'NEEDS_REVIEW', errorCode: e.code, errorMessage: e.message, attemptCount: { increment: 1 }, nextAttemptAt: e.retryable ? e.retryAt || new Date(Date.now() + 3600000) : null }
      if (kind === 'recording') await prisma.recordingImport.update({ where: { id }, data })
      else await prisma.noteImport.update({ where: { id }, data })
    }
  }
  try {
    const configs = await prisma.courseAutomationConfig.findMany({ where: { enabled: true, ...(options.courseId ? { courseId: options.courseId } : {}) } })
    if (!configs.length) { emit({ message: 'No enabled courses; no Google calls made.' }) }
    else {
      const google = source || new GoogleClient(check)
      const configMap = new Map(configs.map(c => [c.courseId, c]))
      const events = await prisma.courseEvent.findMany({ where: { courseId: { not: null }, type: 'class', streamProvider: 'MEET', status: { not: 'CANCELLED' }, endTime: { lte: now } } })
      const eligible = events.filter(e => configMap.has(e.courseId!) && meetCode(e.meetLink) && e.startTime >= (options.from || configMap.get(e.courseId!)!.activationDate) && (!options.to || e.startTime < options.to))
      // Stable copies for late notes; dry runs never change live matching records.
      if (!options.dryRun) for (const e of eligible) {
        check()
        await prisma.importedSession.upsert({ where: { sourceEventId: e.id }, update: {}, create: { sourceEventId: e.id, courseId: e.courseId!, title: e.title, startTime: e.startTime, endTime: e.endTime, meetCode: meetCode(e.meetLink)!, notesKey: notesKey(e.startTime) } })
      }
      const start = options.from || new Date(Math.min(...configs.map(c => discoveryStart(c.activationDate, c.recordingWatermark, now).getTime())))
      const end = options.to || now
      let discoveryComplete = false
      const saveRecording = async (r: Recording) => {
        check(); counts.recordingsDiscovered++
        if (!Number.isFinite(r.startTime.getTime())) throw new ImportError('GOOGLE_METADATA', 'Recording has an invalid start time.')
        const previous = await prisma.recordingImport.findUnique({ where: { googleRecordingName: r.name } })
        const candidates = matchRecording({ ...r }, events)
        if (options.dryRun) {
          const inScope = candidates.length === 1 && eligible.some(e => e.id === candidates[0].id)
          const ready = r.state === 'FILE_GENERATED' && !!r.fileId
          if (ready && inScope) await google.verify(r.fileId!, 'video')
          emit({ kind: 'recording', googleName: r.name, candidates: candidates.map(c => c.id), proposed: candidates.length !== 1 ? 'REVIEW' : !inScope ? 'SKIP_OUTSIDE_SCOPE' : ready ? 'PUBLISH' : 'WAIT_FOR_FILE', googleState: r.state }); return
        }
        // Imports outside configured scope are not changed by course-specific runs.
        if (previous?.sessionId) {
          const oldSession = await prisma.importedSession.findUnique({ where: { id: previous.sessionId } })
          if (oldSession && !configMap.has(oldSession.courseId)) return
        }
        await prisma.recordingImport.upsert({ where: { googleRecordingName: r.name }, create: { googleRecordingName: r.name, conferenceName: r.conferenceName, meetCode: r.meetCode, driveFileId: r.fileId, startTime: r.startTime, endTime: r.endTime, googleState: r.state }, update: { googleState: r.state, driveFileId: r.fileId || previous?.driveFileId, endTime: r.endTime, lastSeenAt: new Date() } })
      }
      try {
        for await (const r of google.recordings(start, end)) await saveRecording(r)
        discoveryComplete = true
      } catch (error) {
        const e = safeError(error); if (STOP_CODES.includes(e.code)) throw e
        counts.errors++; emit({ phase: 'recording-discovery', errorCode: e.code, message: e.message })
      }
      if (discoveryComplete && !options.dryRun && !options.from) await prisma.courseAutomationConfig.updateMany({ where: { id: { in: configs.map(c => c.id) } }, data: { recordingWatermark: now } })
      if (!options.dryRun) {
        const items = await prisma.recordingImport.findMany({ where: { state: { notIn: ['IGNORED', 'NEEDS_REVIEW'] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, orderBy: [{ startTime: 'asc' }, { googleRecordingName: 'asc' }] })
        items.sort((a, b) => Number(!!a.contentId) - Number(!!b.contentId) || (a.lastValidatedAt?.getTime() || 0) - (b.lastValidatedAt?.getTime() || 0) || a.startTime.getTime() - b.startTime.getTime())
        for (let item of items) {
          check()
          const existingSession = item.sessionId && await prisma.importedSession.findUnique({ where: { id: item.sessionId } })
          if (existingSession && !configMap.has(existingSession.courseId)) continue
          if (options.from && (item.startTime < options.from || item.startTime >= options.to!)) continue
          if (!existingSession && item.startTime < start && item.firstSeenAt >= now) continue
          try {
            if (item.googleState !== 'FILE_GENERATED') {
              const fresh = await google.recording(item.googleRecordingName, item.conferenceName, item.meetCode)
              item = await prisma.recordingImport.update({ where: { id: item.id }, data: { googleState: fresh.state, driveFileId: fresh.fileId, endTime: fresh.endTime } })
            }
            if (item.googleState !== 'FILE_GENERATED' || !item.driveFileId) { counts.deferred++; await prisma.recordingImport.update({ where: { id: item.id }, data: { state: 'WAITING_FOR_FILE' } }); continue }
            if (!existingSession) {
              const matches = matchRecording(item, events)
              if (matches.length !== 1) throw new ImportError('AMBIGUOUS_CLASS', `Found ${matches.length} matching classes. Select a timetable occurrence.`)
              if (!eligible.some(e => e.id === matches[0].id)) continue
              const session = await prisma.importedSession.findUniqueOrThrow({ where: { sourceEventId: matches[0].id } })
              item = await prisma.recordingImport.update({ where: { id: item.id }, data: { sessionId: session.id } })
            }
            if (existingSession && item.matchMethod !== 'ADMIN') {
              const matches = matchRecording(item, events)
              if (matches.length !== 1 || matches[0].id !== existingSession.sourceEventId) throw new ImportError('TIMETABLE_CHANGED', 'Timetable no longer uniquely matches the saved class. Published association preserved.')
            }
            const meta = item.contentId && item.lastValidatedAt && item.lastValidatedAt > new Date(Date.now() - 7 * 86400000) ? { modifiedTime: item.fileModifiedAt?.toISOString() } : await google.verify(item.driveFileId, 'video')
            await prisma.recordingImport.update({ where: { id: item.id }, data: { lastValidatedAt: item.contentId && item.lastValidatedAt && item.lastValidatedAt > new Date(Date.now() - 7 * 86400000) ? item.lastValidatedAt : new Date(), fileModifiedAt: meta.modifiedTime ? new Date(meta.modifiedTime) : null, state: item.contentId ? 'PUBLISHED' : 'READY' } })
            if (await publishRecording(item.id, run.id)) counts.recordingsPublished++
          } catch (e) { await persistError('recording', item.id, e) }
        }
      }
      if (!options.dryRun) {
        const sessions = await prisma.importedSession.findMany({ where: { courseId: { in: configs.map(c => c.courseId) } } })
        for (const session of sessions) {
          check()
          try { await reconcileParts(session.id, run.id) }
          catch (error) { const e = safeError(error); if (STOP_CODES.includes(e.code)) throw e; counts.errors++; emit({ sessionId: session.id, errorCode: e.code, message: e.message }) }
        }
      }
      // Complete folder discovery before selecting a primary note, so API page order never decides it.
      for (const config of configs) {
        check()
        let complete = false
        try {
          for await (const file of google.notes(config.notesFolderId)) {
            check(); counts.notesDiscovered++
            const key = parseNotesName(file.name)
            if (options.dryRun) {
              const matches = eligible.filter(e => e.courseId === config.courseId && notesKey(e.startTime) === key)
              if (matches.length === 1 && NOTE_MIMES.includes(file.mimeType)) await google.verify(file.id, 'note')
              emit({ kind: 'note', fileId: file.id, name: file.name, candidates: matches.map(e => e.id), proposed: matches.length === 1 && NOTE_MIMES.includes(file.mimeType) ? 'ATTACH_WHEN_VIDEO_READY' : 'REVIEW' }); continue
            }
            const previous = await prisma.noteImport.findUnique({ where: { driveFileId: file.id } })
            if (previous && (previous.courseId !== config.courseId || (previous.notesKey !== key && previous.matchMethod !== 'ADMIN')) && (previous.sessionId || previous.contentId)) {
              if (previous.state !== 'IGNORED') await persistError('note', previous.id, new ImportError('FILE_MOVED', 'Notes now identify a different course/session; original attachment preserved.'))
              continue
            }
            await prisma.noteImport.upsert({ where: { driveFileId: file.id }, create: { driveFileId: file.id, courseId: config.courseId, fileName: file.name, mimeType: file.mimeType, notesKey: key, fileModifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : null }, update: { fileName: file.name, mimeType: file.mimeType, notesKey: key, lastSeenAt: new Date(), fileModifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : null } })
          }
          complete = true
        } catch (error) {
          const e = safeError(error); if (STOP_CODES.includes(e.code)) throw e
          counts.errors++; emit({ phase: 'notes-discovery', courseId: config.courseId, errorCode: e.code, message: e.message })
        }
        if (!complete || options.dryRun) continue
        await prisma.courseAutomationConfig.update({ where: { id: config.id }, data: { notesWatermark: now } })
        const notes = await prisma.noteImport.findMany({ where: { courseId: config.courseId, state: { notIn: ['IGNORED', 'NEEDS_REVIEW'] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, orderBy: [{ fileName: 'asc' }, { driveFileId: 'asc' }] })
        for (const note of notes) {
          check()
          try {
            if (options.from && note.notesKey) {
              const stamp = new Date(`${note.notesKey.slice(0,10)}T${note.notesKey.slice(11,13)}:${note.notesKey.slice(13,15)}:00+05:30`)
              if (stamp < options.from || stamp >= options.to!) continue
            }
            if (!NOTE_MIMES.includes(note.mimeType)) throw new ImportError('FILE_TYPE', 'Use PDF, Google Docs, or Google Slides.')
            if (!note.sessionId) {
              if (!note.notesKey) throw new ImportError('NOTES_NAME', 'Use YYYY-MM-DD_HHmm_Description in the filename.')
              const sessions = await prisma.importedSession.findMany({ where: { courseId: config.courseId, notesKey: note.notesKey } })
              if (sessions.length !== 1) throw new ImportError('AMBIGUOUS_CLASS', `Found ${sessions.length} matching classes for notes.`)
              await prisma.noteImport.update({ where: { id: note.id }, data: { sessionId: sessions[0].id, state: 'MATCHED' } })
            }
            await google.verify(note.driveFileId, 'note')
            await prisma.noteImport.update({ where: { id: note.id }, data: { lastValidatedAt: new Date() } })
            if (await publishNote(note.id, run.id)) counts.notesAttached++
          } catch (e) { await persistError('note', note.id, e) }
        }
      }
    }
    if (counts.errors) status = 'PARTIAL'
  } catch (error) {
    const e = safeError(error); status = e.code === 'DEADLINE' ? 'PARTIAL' : 'FAILED'; summary = `${e.code}: ${e.message}`
  } finally {
    clearInterval(timer); if (beat) await beat
    await releaseLease(run.id)
  }
  return prisma.automationRun.update({ where: { id: run.id }, data: { status, finishedAt: new Date(), counts, phaseResults: report as any, errorSummary: summary } })
}
