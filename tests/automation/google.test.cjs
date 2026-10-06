const { test } = require('node:test')
const assert = require('node:assert/strict')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { GoogleClient, ImportError, safeError } = require('../../src/lib/automation/google')
function client() {
  for (const key of ['AUTOMATION_GOOGLE_CLIENT_ID', 'AUTOMATION_GOOGLE_CLIENT_SECRET', 'AUTOMATION_GOOGLE_REFRESH_TOKEN', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY']) process.env[key] = 'test-placeholder'
  return new GoogleClient()
}
test('typed import errors retain their retry classification under ES5 compilation', () => {
  const e = new ImportError('GOOGLE_RETRY', 'Temporary failure', true)
  assert.equal(safeError(e), e)
  assert.equal(safeError(e).retryable, true)
  assert.equal(safeError(new Error('secret-token')).message.includes('secret-token'), false)
})
test('conference space strings and both pagination levels are supported', async () => {
  const google = client(), calls = []
  google.request = async raw => {
    const url = new URL(raw); calls.push(raw)
    if (url.pathname === '/v2/conferenceRecords') return url.searchParams.has('pageToken') ? { conferenceRecords: [{ name: 'conferenceRecords/b', space: 'spaces/shared' }] } : { conferenceRecords: [{ name: 'conferenceRecords/a', space: 'spaces/shared' }], nextPageToken: 'next' }
    if (url.pathname === '/v2/spaces/shared') return { meetingCode: 'abc-defg-hij' }
    const r = { name: `${url.pathname.slice(4)}/r`, startTime: '2026-10-05T08:30:00Z', endTime: '2026-10-05T09:30:00Z', state: 'FILE_GENERATED', driveDestination: { file: 'drive-file' } }
    if (url.pathname.includes('/a/recordings') && !url.searchParams.has('pageToken')) return { recordings: [r], nextPageToken: 'second' }
    return { recordings: [r] }
  }
  const result = []
  for await (const r of google.recordings(new Date('2026-10-01'), new Date('2026-10-06'))) result.push(r)
  assert.equal(result.length, 3)
  assert.ok(result.every(r => r.meetCode === 'abc-defg-hij'))
  assert.ok(calls.some(u => u.includes('pageToken=second')))
})
test('notes folder pagination discovers every file', async () => {
  const google = client()
  google.request = async raw => new URL(raw).searchParams.has('pageToken') ? { files: [{ id: 'b' }] } : { files: [{ id: 'a' }], nextPageToken: 'next' }
  const ids = []; for await (const f of google.notes('folder123')) ids.push(f.id)
  assert.deepEqual(ids, ['a', 'b'])
})
test('validation uses playback identity and performs a bounded media probe', async () => {
  const google = client(), calls = []
  google.request = async (url, playback, probe) => { calls.push({ url, playback, probe }); return probe ? null : { id: 'file', mimeType: 'video/mp4', capabilities: { canDownload: true } } }
  await google.verify('file', 'video')
  assert.ok(calls.every(c => c.playback === true))
  assert.equal(calls[1].probe, true)
  assert.ok(calls[1].url.includes('alt=media'))
})
test('strict Drive playback never falls back to anonymous fetching without credentials', async () => {
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  const { fetchDriveFileStream } = require('../../src/lib/drive')
  const original = global.fetch
  let calls = 0
  global.fetch = async () => { calls++; throw new Error('Unexpected public fetch') }
  try { await assert.rejects(() => fetchDriveFileStream('file', null, true), /credentials are missing/); assert.equal(calls, 0) }
  finally { global.fetch = original }
})
