// Run with: node --test tests/support-community.test.cjs
// Execute the real route handlers with an in-memory database boundary. No live
// accounts, notifications, or database writes are used.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')

function harness(role = 'STUDENT', userId = 'student-a') {
  const state = { session: role ? { role, userId, name: 'Test', accessibleCourseIds: ['course-a'] } : null, writes: 0 }
  const tickets = [{ id: 'ticket-a', studentId: 'student-a', title: 'Help', status: 'OPEN', updatedAt: new Date(), replies: [] }]
  const replies = [{ id: 'reply-a', ticketId: 'ticket-a', senderId: 'manager-a', content: 'Hello' }]
  const visible = (ticket, where) => (!where.id || where.id === ticket.id) && (!where.studentId || where.studentId === ticket.studentId) &&
    (!where.OR || !['CLOSED', 'RESOLVED'].includes(ticket.status) || ticket.updatedAt >= where.OR[1].updatedAt.gte)
  const db = {
    supportTicket: {
      findFirst: async ({ where }) => tickets.find(t => visible(t, where)) ?? null,
      findUnique: async ({ where }) => tickets.find(t => t.id === where.id),
      findMany: async ({ where }) => tickets.filter(t => visible(t, where)),
      create: async ({ data }) => { state.writes++; state.created = data; return { id: 'new-ticket', ...data } },
      update: async ({ where, data }) => { state.writes++; return Object.assign(tickets.find(t => t.id === where.id), data) },
      count: async ({ where } = {}) => {
        if (!where) return tickets.length
        return tickets.filter(t => {
          if (where.studentId && t.studentId !== where.studentId) return false
          if (where.status?.notIn && where.status.notIn.includes(t.status)) return false
          if (where.status?.in && !where.status.in.includes(t.status)) return false
          if (where.status && typeof where.status === 'string' && t.status !== where.status) return false
          return true
        }).length
      },
      updateMany: async ({ where, data }) => {
        let count = 0
        for (const t of tickets) {
          if (where.id && t.id !== where.id) continue
          if (where.status?.not && t.status === where.status.not) continue
          if (where.status?.notIn && where.status.notIn.includes(t.status)) continue
          if (where.updatedAt?.lt && !(t.updatedAt < where.updatedAt.lt)) continue
          Object.assign(t, data)
          state.writes++
          count++
        }
        return { count }
      },
      delete: async () => { state.writes++ },
    },
    ticketReply: {
      findMany: async () => replies,
      findUnique: async ({ where }) => replies.find(r => r.id === where.id),
      create: async ({ data }) => { state.writes++; return { id: 'new-reply', ...data } },
      update: async ({ data }) => { state.writes++; return data },
      delete: async () => { state.writes++ },
    },
    user: { findFirst: async ({ where }) => where.id === 'manager-a' && where.role === 'MANAGER' ? { id: 'manager-a' } : null },
    course: { findUnique: async () => ({ isCommunityActive: state.active !== false }) },
  }
  db.$transaction = callback => callback(db)
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => ({ status: options?.status || 200, body }) } },
    '@/lib/db': { prisma: db },
    '@/lib/auth': { getSession: async () => state.session, getFullSession: async () => state.session, getAccessibleCourseIds: async () => ['course-a'] },
    '@/lib/activity-log': { logActivity: () => {}, ACTION: {}, MODULE: {} },
    '@/lib/system-notifications': new Proxy({}, { get: () => async () => {} }),
    '@/lib/community-notifications': {}, '@/lib/validation': {}, '@/lib/sse': {},
  }
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const exports = {}
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    vm.runInNewContext(source, {
      exports, URL, Date, console,
      require: name => {
        if (mocks[name]) return mocks[name]
        if (name === '@/lib/support-ticket-access') return load('src/lib/support-ticket-access.ts')
        throw new Error(`Unexpected dependency: ${name}`)
      },
    }, { filename: file })
    cache.set(file, exports)
    return exports
  }
  return { state, db, tickets, replies, load }
}
const request = (body = {}, url = 'https://example.test/api/support/tickets') => ({ url, json: async () => body })
const params = { params: { id: 'ticket-a' } }
const collection = 'src/app/api/support/tickets/route.ts'
const detail = 'src/app/api/support/tickets/[id]/route.ts'
const replyRoute = 'src/app/api/support/tickets/[id]/replies/route.ts'

for (const role of [null, 'ADMIN', 'INSTRUCTOR']) {
  test(`${role || 'anonymous'} cannot use ticket list, detail, creation, or replies`, async () => {
    const h = harness(role)
    const status = role ? 403 : 401
    for (const [file, methods] of [[collection, ['GET', 'POST']], [detail, ['GET', 'PUT', 'DELETE']], [replyRoute, ['GET', 'POST', 'PUT', 'DELETE']]]) {
      for (const method of methods) assert.equal((await h.load(file)[method](request(), params)).status, status)
    }
    assert.equal(h.state.writes, 0)
  })
}

test('student can read and reply to their own ticket, but cannot manage it', async () => {
  const h = harness()
  assert.equal((await h.load(collection).GET(request())).body.length, 1)
  assert.equal((await h.load(detail).GET(request(), params)).status, 200)
  assert.equal((await h.load(replyRoute).GET(request(), params)).status, 200)
  assert.equal((await h.load(replyRoute).POST(request({ content: 'More details' }), params)).status, 201)
  for (const method of ['PUT', 'DELETE']) {
    assert.equal((await h.load(detail)[method](request({ status: 'CLOSED' }), params)).status, 403)
    assert.equal((await h.load(replyRoute)[method](request({ replyId: 'reply-a', content: 'Edit' }), params)).status, 403)
  }
  assert.equal(h.tickets[0].status, 'OPEN')
})

test('student cannot read, reply to, or mutate another student ticket', async () => {
  const h = harness('STUDENT', 'student-b')
  assert.equal((await h.load(collection).GET(request())).body.length, 0)
  for (const [file, methods] of [[detail, ['GET', 'PUT', 'DELETE']], [replyRoute, ['GET', 'POST', 'PUT', 'DELETE']]]) {
    for (const method of methods) assert.equal((await h.load(file)[method](request({ content: 'Leak?', replyId: 'reply-a' }), params)).status, 404)
  }
  assert.equal(h.state.writes, 0)
})

test('student visibility consistently applies the existing 15-day closed/resolved retention', async () => {
  for (const status of ['CLOSED', 'RESOLVED']) {
    const h = harness()
    Object.assign(h.tickets[0], { status, updatedAt: new Date(Date.now() - 16 * 86400000) })
    assert.equal((await h.load(collection).GET(request())).body.length, 0)
    assert.equal((await h.load(detail).GET(request(), params)).status, 404)
    assert.equal((await h.load(replyRoute).GET(request(), params)).status, 404)
    h.state.session.role = 'MANAGER'
    assert.equal((await h.load(detail).GET(request(), params)).status, 200)
  }
})

test('closed tickets reject sends for both students and managers without writes', async () => {
  for (const role of ['STUDENT', 'MANAGER']) {
    const h = harness(role)
    h.tickets[0].status = 'CLOSED'
    assert.equal((await h.load(replyRoute).POST(request({ content: 'More' }), params)).status, 409)
    assert.equal(h.state.writes, 0)
  }
})

test('manager can manage queue and own replies, but not another manager reply', async () => {
  const h = harness('MANAGER', 'manager-a')
  assert.equal((await h.load(collection).GET(request())).body.length, 1)
  assert.equal((await h.load(detail).PUT(request({ status: 'RESOLVED', assignedToId: 'manager-a' }), params)).status, 200)
  assert.equal((await h.load(replyRoute).POST(request({ content: 'Following up' }), params)).status, 201)
  assert.equal(h.tickets[0].status, 'IN_PROGRESS')
  assert.equal((await h.load(replyRoute).PUT(request({ replyId: 'reply-a', content: 'Edited' }), params)).status, 200)
  h.replies[0].senderId = 'manager-b'
  for (const method of ['PUT', 'DELETE']) assert.equal((await h.load(replyRoute)[method](request({ replyId: 'reply-a', content: 'Other' }), params)).status, 403)
  assert.equal((await h.load(detail).DELETE(request(), params)).status, 200)
})

test('invalid status and non-manager assignment are rejected', async () => {
  const h = harness('MANAGER')
  for (const body of [{ status: 'INVALID' }, { assignedToId: 'student-a' }, { assignedToId: {} }]) {
    assert.equal((await h.load(detail).PUT(request(body), params)).status, 400)
  }
  assert.equal(h.state.writes, 0)
})

test('creation uses authenticated owner, default priority and validated course; accepts web classId alias', async () => {
  const h = harness()
  assert.equal((await h.load(collection).POST(request({ description: 'Help', type: 'SUBJECT', classId: 'course-a', studentId: 'other', priority: 'HIGH' }))).status, 201)
  assert.equal(h.state.created.studentId, 'student-a')
  assert.equal(h.state.created.priority, 'MEDIUM')
  assert.equal(h.state.created.courseId, 'course-a')
  assert.equal((await h.load(collection).POST(request({ description: 'Help', type: 'SUBJECT', courseId: 'private-course' }))).status, 403)
  assert.equal((await h.load(collection).POST(request({ description: '' }))).status, 400)
  h.state.session.role = 'MANAGER'
  assert.equal((await h.load(collection).POST(request({ description: 'Help' }))).status, 403)
})

test('discussion feed returns ten parent posts with all comments and a working next page', async () => {
  const h = harness()
  const posts = Array.from({ length: 12 }, (_, i) => ({ id: `post-${i}`, courseId: 'general-discussion', replyToId: null, createdAt: new Date(1000 - i), isDeleted: false, isSystemDeleted: false, deletedAt: null, sender: { id: 'user' } }))
  const comments = Array.from({ length: 30 }, (_, i) => ({ ...posts[0], id: `comment-${i}`, replyToId: 'post-0', createdAt: new Date(2000 + i) }))
  const hidden = [{ ...posts[0], id: 'deleted-post', isDeleted: true }, { ...posts[0], id: 'removed-post', isSystemDeleted: true }, { ...comments[0], id: 'deleted-comment', isDeleted: true }]
  const all = [...posts, ...comments, ...hidden]
  h.db.communityMessage = { findMany: async ({ where, take, cursor, orderBy }) => {
    let list = all.filter(m => m.courseId === where.courseId && (!('isDeleted' in where) || m.isDeleted === where.isDeleted) && (!('isSystemDeleted' in where) || m.isSystemDeleted === where.isSystemDeleted))
    if (where.replyToId === null) list = list.filter(m => m.replyToId === null)
    else if (where.replyToId?.in) list = list.filter(m => where.replyToId.in.includes(m.replyToId))
    list.sort((a, b) => orderBy[0]?.createdAt === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt)
    if (cursor) list = list.slice(list.findIndex(m => m.id === cursor.id) + 1)
    return take ? list.slice(0, take) : list
  } }
  const route = h.load('src/app/api/community/[courseId]/messages/route.ts')
  const p = { params: { courseId: 'general-discussion' } }
  const first = (await route.GET(request({}, 'https://example.test/messages?view=feed&limit=10'), p)).body
  assert.equal(first.messages.filter(m => !m.replyToId).length, 10)
  assert.equal(first.messages.filter(m => m.replyToId).length, 30)
  assert.equal(first.hasMore, true)
  assert.equal(first.messages.some(m => m.isDeleted || m.isSystemDeleted), false)
  const second = (await route.GET(request({}, `https://example.test/messages?view=feed&limit=10&cursor=${first.nextCursor}`), p)).body
  assert.equal(second.messages.length, 2)
  assert.equal(second.hasMore, false)
  assert.equal(new Set([...first.messages, ...second.messages].filter(m => !m.replyToId).map(m => m.id)).size, 12)
  const legacy = await route.GET(request({}, 'https://example.test/messages?limit=50'), p)
  assert.ok(Array.isArray(legacy.body), 'existing Flutter/chat API remains an array')
  h.state.active = false
  assert.equal((await route.GET(request({}, 'https://example.test/messages?view=feed'), p)).status, 403)
  h.state.session = null
  assert.equal((await route.GET(request({}, 'https://example.test/messages?view=feed'), p)).status, 401)
})

test('student cannot create a new ticket if they have 3 active tickets, but can once resolved/closed', async () => {
  const h = harness('STUDENT', 'student-limit-test')
  h.tickets.length = 0
  h.tickets.push(
    { id: 't-1', studentId: 'student-limit-test', title: 'T1', status: 'OPEN', updatedAt: new Date(), replies: [] },
    { id: 't-2', studentId: 'student-limit-test', title: 'T2', status: 'IN_PROGRESS', updatedAt: new Date(), replies: [] }
  )

  // 2 active tickets -> allowed to create a 3rd ticket
  const res1 = await h.load(collection).POST(request({ description: 'Third ticket' }))
  assert.equal(res1.status, 201)

  // Add the 3rd active ticket to h.tickets
  h.tickets.push({ id: 't-3', studentId: 'student-limit-test', title: 'T3', status: 'OPEN', updatedAt: new Date(), replies: [] })

  // 3 active tickets -> blocked from creating a 4th ticket
  const res2 = await h.load(collection).POST(request({ description: 'Fourth ticket spam' }))
  assert.equal(res2.status, 400)
  assert.match(res2.body.error, /3 active tickets/i)

  // If manager marks one ticket as RESOLVED
  h.tickets[0].status = 'RESOLVED'
  // Now 2 active tickets -> allowed again
  const res3 = await h.load(collection).POST(request({ description: 'New ticket after resolve' }))
  assert.equal(res3.status, 201)

  // If one ticket is CLOSED
  h.tickets[1].status = 'CLOSED'
  const res4 = await h.load(collection).POST(request({ description: 'New ticket after close' }))
  assert.equal(res4.status, 201)
})

test('replies bump ticket updatedAt and student reply reopens resolved ticket to OPEN', async () => {
  const h = harness('STUDENT', 'student-a')
  const oldDate = new Date(Date.now() - 5 * 86400000)
  h.tickets[0].updatedAt = oldDate
  h.tickets[0].status = 'RESOLVED'

  // Student replies to the resolved ticket
  const res = await h.load(replyRoute).POST(request({ content: 'Still having issues with this' }), params)
  assert.equal(res.status, 201)
  // Status should reopen to OPEN and updatedAt should be bumped
  assert.equal(h.tickets[0].status, 'OPEN')
  assert.ok(h.tickets[0].updatedAt.getTime() > oldDate.getTime(), 'Ticket timestamp must be updated')

  // Manager replies to an open ticket -> status becomes IN_PROGRESS and updatedAt bumped
  h.state.session.role = 'MANAGER'
  h.state.session.userId = 'manager-a'
  const beforeManagerReply = h.tickets[0].updatedAt
  const resManager = await h.load(replyRoute).POST(request({ content: 'Looking into this now' }), params)
  assert.equal(resManager.status, 201)
  assert.equal(h.tickets[0].status, 'IN_PROGRESS')
  assert.ok(h.tickets[0].updatedAt.getTime() >= beforeManagerReply.getTime())
})

test('tickets older than 10 days are auto-closed', async () => {
  const h = harness('STUDENT', 'student-a')
  const elevenDaysAgo = new Date(Date.now() - 11 * 86400000)
  h.tickets.push({
    id: 'old-ticket',
    studentId: 'student-a',
    title: 'Old query',
    status: 'OPEN',
    updatedAt: elevenDaysAgo,
    replies: [],
  })

  // Calling GET /api/support/tickets triggers autoCloseInactiveTickets
  await h.load(collection).GET(request())
  const oldTicket = h.tickets.find(t => t.id === 'old-ticket')
  assert.equal(oldTicket.status, 'CLOSED')
})

