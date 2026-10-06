const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const address = process.env.AUTOMATION_TEST_DATABASE_URL
if (!address) {
  test('database integration tests require AUTOMATION_TEST_DATABASE_URL', { skip: true }, () => {})
} else {
  const url = new URL(address)
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/class_genz_automation_test') throw new Error('Refusing to run destructive fixtures outside the isolated local class_genz_automation_test database')
  process.env.DATABASE_URL = address
  require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
  const { prisma } = require('../../src/lib/db')
  const { runImport } = require('../../src/lib/automation/coordinator')
  const { ImportError } = require('../../src/lib/automation/google')
  const { acquireLease, releaseLease, heartbeat } = require('../../src/lib/automation/lease')
  const { createContent } = require('../../src/lib/content-publisher')
  const { notesKey } = require('../../src/lib/automation/matching')
  const { publishRecording } = require('../../src/lib/automation/publisher')
  let fixtures
  before(async () => { await prisma.$connect() })
  after(async () => { await prisma.$disconnect() })
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "NoteImport", "RecordingImport", "ImportedSession", "AutomationRun", "AutomationLease", "CourseAutomationConfig", "User" CASCADE')
    const user = await prisma.user.create({ data: { id: 'manager', name: 'Test Manager', email: 'automation@example.invalid', role: 'MANAGER' } })
    const course = await prisma.course.create({ data: { id: 'course', name: 'Math', createdById: user.id } })
    const topic = await prisma.topic.create({ data: { id: 'topic', courseId: course.id, title: 'Daily Recordings' } })
    const start = new Date(Date.now() - 2 * 86400000); start.setUTCHours(8,30,0,0)
    const end = new Date(+start + 3600000)
    const event = await prisma.courseEvent.create({ data: { id: 'event', courseId: course.id, title: 'Integration', startTime: start, endTime: end, meetLink: 'https://meet.google.com/abc-defg-hij', createdById: user.id } })
    await prisma.courseAutomationConfig.create({ data: { courseId: course.id, enabled: true, notesFolderId: 'folder123456789', destinationTopicId: topic.id, activationDate: new Date(+start - 86400000) } })
    const recording = { name: 'conferenceRecords/c/recordings/r', conferenceName: 'conferenceRecords/c', meetCode: 'abc-defg-hij', startTime: new Date(+start + 300000), endTime: new Date(+end - 300000), state: 'FILE_GENERATED', fileId: 'video123456789012345' }
    const file = { id: 'notes123456789012345', name: `${notesKey(start)}_Integration.pdf`, mimeType: 'application/pdf', modifiedTime: new Date().toISOString() }
    fixtures = { course, topic, event, recording, file }
  })
  function source(recordings = [fixtures.recording], files = [fixtures.file], denied = []) {
    return {
      async *recordings() { for (const r of recordings) yield r },
      async recording(name) { return recordings.find(r => r.name === name) || { ...fixtures.recording, state: 'ENDED' } },
      async *notes() { for (const f of files) yield f },
      async verify(id, kind) { if (denied.includes(id)) throw new ImportError('FILE_ACCESS', 'Access denied'); return { id, name: id, mimeType: kind === 'video' ? 'video/mp4' : 'application/pdf' } },
      async folder() {},
    }
  }
  test('full import, private playback marker, and repeated-run idempotency', async () => {
    const first = await runImport({}, source())
    assert.equal(first.status, 'SUCCEEDED', first.errorSummary)
    assert.equal(first.counts.recordingsPublished, 1)
    assert.equal(first.counts.notesAttached, 1)
    const content = await prisma.content.findFirst()
    assert.equal(content.strictDriveAccess, true)
    assert.ok(content.pptUrl.includes(fixtures.file.id))
    const second = await runImport({}, source())
    assert.equal(second.status, 'SUCCEEDED', JSON.stringify(second.phaseResults))
    assert.equal(await prisma.content.count(), 1)
  })
  test('dry run validates without changing imports, content, sessions or watermarks', async () => {
    const report = await runImport({ dryRun: true }, source())
    assert.equal(report.status, 'SUCCEEDED')
    for (const model of [prisma.content, prisma.recordingImport, prisma.noteImport, prisma.importedSession]) assert.equal(await model.count(), 0)
    assert.equal((await prisma.courseAutomationConfig.findFirst()).recordingWatermark, null)
    assert.ok(report.phaseResults.length >= 2)
  })
  test('late notes attach to existing lecture and primary selection ignores API order', async () => {
    await runImport({}, source([fixtures.recording], []))
    const additional = { ...fixtures.file, id: 'additional123456789', name: `${notesKey(fixtures.event.startTime)}_ZPractice.pdf` }
    await runImport({}, source([fixtures.recording], [additional, fixtures.file]))
    assert.equal(await prisma.content.count(), 2)
    assert.equal((await prisma.noteImport.findUnique({ where: { driveFileId: fixtures.file.id } })).attachmentRole, 'PRIMARY')
    await runImport({}, source([fixtures.recording], [additional, fixtures.file]))
    assert.equal(await prisma.content.count(), 2)
  })
  test('shared link with 12 distinct classes matches all recordings correctly', async () => {
    const recordings = [fixtures.recording]
    for (let i = 1; i < 12; i++) {
      const start = new Date(+fixtures.event.startTime + i * 3600000), end = new Date(+start + 3600000)
      await prisma.courseEvent.create({ data: { courseId: 'course', title: `Lecture ${i}`, startTime: start, endTime: end, meetLink: fixtures.event.meetLink, createdById: 'manager' } })
      recordings.push({ ...fixtures.recording, name: `conferenceRecords/c/recordings/r${i}`, fileId: `video${i}123456789012345`, startTime: new Date(+start + 60000), endTime: new Date(+end - 60000) })
    }
    const result = await runImport({}, source(recordings, []))
    assert.equal(result.counts.recordingsPublished, 12, JSON.stringify(result.phaseResults))
    assert.equal(await prisma.content.count(), 12)
  })
  test('overlap with disabled course is reviewed instead of misassigned', async () => {
    const course = await prisma.course.create({ data: { name: 'Physics', createdById: 'manager' } })
    await prisma.courseEvent.create({ data: { courseId: course.id, title: 'Overlap', startTime: fixtures.event.startTime, endTime: fixtures.event.endTime, meetLink: fixtures.event.meetLink, createdById: 'manager' } })
    await runImport({}, source())
    assert.equal(await prisma.content.count(), 0)
    assert.equal((await prisma.recordingImport.findFirst()).errorCode, 'AMBIGUOUS_CLASS')
  })
  test('file permissions isolate one failure and prevent inaccessible publication', async () => {
    const result = await runImport({}, source(undefined, undefined, [fixtures.recording.fileId]))
    assert.equal(result.status, 'PARTIAL')
    assert.equal(await prisma.content.count(), 0)
    assert.equal((await prisma.recordingImport.findFirst()).state, 'NEEDS_REVIEW')
  })
  test('manual edits and deletions are preserved', async () => {
    await runImport({}, source())
    const content = await prisma.content.findFirst()
    await prisma.content.update({ where: { id: content.id }, data: { title: 'Teacher custom title' } })
    await runImport({}, source())
    assert.equal((await prisma.content.findUnique({ where: { id: content.id } })).title, 'Teacher custom title')
    await prisma.content.delete({ where: { id: content.id } })
    await prisma.recordingImport.updateMany({ data: { state: 'DISCOVERED' } })
    await runImport({}, source())
    assert.equal(await prisma.content.count(), 0)
    assert.equal((await prisma.recordingImport.findFirst()).errorCode, 'CONTENT_DELETED')
  })
  test('lease excludes other workers and expires safely', async () => {
    assert.equal(await acquireLease('first'), true)
    assert.equal(await acquireLease('second'), false)
    assert.equal((await runImport({}, source())).status, 'SKIPPED')
    await prisma.automationLease.updateMany({ data: { expiresAt: new Date(0) } })
    assert.equal(await acquireLease('second'), true)
    await assert.rejects(() => heartbeat('first'), /lease lost/i)
    await releaseLease('second')
  })
  test('manual and automated content share transaction-safe ordering', async () => {
    await runImport({}, source())
    await Promise.all(Array.from({ length: 8 }, (_, i) => createContent({ topicId: 'topic', title: `Manual ${i}` })))
    const content = await prisma.content.findMany()
    assert.equal(new Set(content.map(c => c.order)).size, content.length)
  })
  test('publication refuses a stale lease', async () => {
    await runImport({}, source())
    const item = await prisma.recordingImport.findFirst()
    await assert.rejects(() => publishRecording(item.id, 'not-the-owner'), /lease lost/i)
  })
  test('incomplete discovery does not advance watermark', async () => {
    const broken = source(); broken.recordings = async function* () { yield fixtures.recording; throw new ImportError('GOOGLE_RETRY', 'Temporary failure', true) }
    const result = await runImport({}, broken)
    assert.equal(result.status, 'PARTIAL')
    assert.equal((await prisma.courseAutomationConfig.findFirst()).recordingWatermark, null)
    assert.equal(await prisma.content.count(), 1)
  })
  test('new earlier recording reconciles part titles and primary notes', async () => {
    await runImport({}, source())
    const earlier = { ...fixtures.recording, name: 'conferenceRecords/c/recordings/earlier', fileId: 'earliervideo123456789', startTime: fixtures.event.startTime, endTime: new Date(+fixtures.event.startTime + 120000) }
    const result = await runImport({}, source([fixtures.recording, earlier]))
    assert.equal(result.status, 'SUCCEEDED', JSON.stringify(result.phaseResults))
    const first = await prisma.recordingImport.findUnique({ where: { googleRecordingName: earlier.name } })
    const primary = await prisma.noteImport.findFirst()
    assert.equal(primary.contentId, first.contentId)
    assert.match((await prisma.content.findUnique({ where: { id: first.contentId } })).title, /Part 1/)
  })
  test('admin API rejects unauthorized roles and creates a valid course configuration', async () => {
    const Module = require('node:module'), path = require('node:path')
    const originalLoad = Module._load
    let actor = null
    Module._load = function(name, parent, isMain) {
      if (name === '@/lib/auth') return { getSession: async () => actor, canManageContent: role => role === 'MANAGER' }
      if (name.startsWith('@/')) return originalLoad.call(this, path.join(process.cwd(), 'src', name.slice(2)), parent, isMain)
      return originalLoad.call(this, name, parent, isMain)
    }
    let routes
    try { routes = require('../../src/app/api/admin/automation/[[...path]]/route') } finally { Module._load = originalLoad }
    const { NextRequest } = require('next/server')
    const context = name => ({ params: Promise.resolve({ path: name.split('/') }) })
    assert.equal((await routes.GET(new NextRequest('http://localhost/api/admin/automation/settings'), context('settings'))).status, 401)
    actor = { userId: 'manager', name: 'Manager', role: 'STUDENT' }
    assert.equal((await routes.GET(new NextRequest('http://localhost/api/admin/automation/settings'), context('settings'))).status, 403)
    actor.role = 'MANAGER'
    const result = await routes.PUT(new NextRequest('http://localhost/api/admin/automation/courses/course', { method: 'PUT', body: JSON.stringify({ enabled: false, notesFolderId: 'folder123456789', activationDate: new Date().toISOString(), destinationTopicId: '' }) }), context('courses/course'))
    assert.equal(result.status, 200, JSON.stringify(await result.clone().json()))
    assert.equal((await result.json()).destinationTopicId, 'topic')
    assert.equal(await prisma.activityLog.count(), 1)
    await acquireLease('running')
    const blocked = await routes.PUT(new NextRequest('http://localhost/api/admin/automation/courses/course', { method: 'PUT', body: JSON.stringify({ enabled: false, notesFolderId: 'folder123456789', activationDate: new Date().toISOString() }) }), context('courses/course'))
    assert.equal(blocked.status, 409)
    await releaseLease('running')
  })
  test('student streaming keeps enrollment checks and passes strict private access', async () => {
    await runImport({}, source())
    const content = await prisma.content.findFirst()
    const Module = require('node:module'), path = require('node:path'), originalLoad = Module._load
    let actor = null, enrolled = false, strict = null
    Module._load = function(name, parent, isMain) {
      if (name === '@/lib/auth') return { getSession: async () => actor, isAdminOrManager: () => false, verifyStreamToken: () => null, isStudentEnrolledInContent: async () => enrolled }
      if (name === '@/lib/drive') return { extractDriveFileId: () => fixtures.recording.fileId, getDriveAuthMode: () => 'service-account', fetchDriveFileStream: async (id, range, privateOnly) => { strict = privateOnly; return { stream: new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])); c.close() } }), status: 206, headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-0/100' } } } }
      if (name.startsWith('@/')) return originalLoad.call(this, path.join(process.cwd(), 'src', name.slice(2)), parent, isMain)
      return originalLoad.call(this, name, parent, isMain)
    }
    let routes
    try { routes = require('../../src/app/api/drive-stream/[contentId]/route') } finally { Module._load = originalLoad }
    const { NextRequest } = require('next/server')
    const request = () => new NextRequest('http://localhost/api/drive-stream/' + content.id, { headers: { range: 'bytes=0-0' } })
    const context = { params: Promise.resolve({ contentId: content.id }) }
    assert.equal((await routes.GET(request(), context)).status, 401)
    actor = { userId: 'student', role: 'STUDENT' }
    assert.equal((await routes.GET(request(), context)).status, 403)
    enrolled = true
    const response = await routes.GET(request(), context)
    assert.equal(response.status, 206)
    assert.equal(strict, true)
    assert.equal(response.headers.get('content-range'), 'bytes 0-0/100')
    await response.arrayBuffer()
  })

  test('recording processing delay and transient failures resume without duplicates', async () => {
    const waiting = { ...fixtures.recording, state: 'ENDED', fileId: null }
    await runImport({}, source([waiting], []))
    assert.equal(await prisma.content.count(), 0)
    assert.equal((await prisma.recordingImport.findFirst()).state, 'WAITING_FOR_FILE')
    const failing = source()
    failing.verify = async () => { throw new ImportError('GOOGLE_RETRY', 'Retry later', true, new Date(Date.now() + 60000)) }
    await runImport({}, failing)
    assert.equal((await prisma.recordingImport.findFirst()).state, 'RETRY_PENDING')
    await prisma.recordingImport.updateMany({ data: { nextAttemptAt: new Date(0) } })
    await prisma.noteImport.updateMany({ data: { nextAttemptAt: new Date(0) } })
    await runImport({}, source())
    assert.equal(await prisma.content.count(), 1)
  })
  test('renamed notes keep their identity and changed class keys require review', async () => {
    await runImport({}, source())
    await runImport({}, source(undefined, [{ ...fixtures.file, name: `${notesKey(fixtures.event.startTime)}_Renamed.pdf` }]))
    assert.equal(await prisma.content.count(), 1)
    assert.equal(await prisma.noteImport.count(), 1)
    await runImport({}, source(undefined, [{ ...fixtures.file, name: '2026-01-01_1400_WrongClass.pdf' }]))
    assert.equal((await prisma.noteImport.findFirst()).errorCode, 'FILE_MOVED')
    assert.ok((await prisma.content.findFirst()).pptUrl.includes(fixtures.file.id))
  })
  test('Google authorization failure stops work and releases the lease', async () => {
    const denied = source()
    denied.recordings = async function* () { throw new ImportError('AUTH_REQUIRED', 'Reconnect organizer') }
    const run = await runImport({}, denied)
    assert.equal(run.status, 'FAILED')
    assert.match(run.errorSummary, /AUTH_REQUIRED/)
    assert.equal(await prisma.content.count(), 0)
    assert.equal(await acquireLease('next-run'), true)
    await releaseLease('next-run')
  })

}
