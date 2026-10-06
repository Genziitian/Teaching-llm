const { test } = require('node:test')
const assert = require('node:assert/strict')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { meetCode, notesKey, parseNotesName, matchRecording, discoveryStart, fieldsUnchanged } = require('../../src/lib/automation/matching')
const at = time => new Date(`2026-10-05T${time}:00+05:30`)
const event = (id, start, end) => ({ id, courseId: id, title: id, startTime: at(start), endTime: at(end), meetLink: 'https://meet.google.com/abc-defg-hij' })
test('same room selects individual classes by recording interval', () => {
  const events = [event('math', '14:00', '15:00'), event('physics', '15:00', '16:00')]
  assert.deepEqual(matchRecording({ meetCode: 'abc-defg-hij', startTime: at('15:05'), endTime: at('15:55') }, events).map(x => x.id), ['physics'])
})
test('overlapping classes remain ambiguous and boundaries do not overlap', () => {
  const events = [event('math', '14:00', '15:00'), event('physics', '15:00', '16:00')]
  assert.equal(matchRecording({ meetCode: 'abc-defg-hij', startTime: at('14:55'), endTime: at('15:15') }, events).length, 2)
  assert.equal(matchRecording({ meetCode: 'abc-defg-hij', startTime: at('14:00'), endTime: at('15:00') }, events).length, 1)
})
test('filenames use valid calendar dates and IST scheduled time', () => {
  assert.equal(notesKey(at('14:00')), '2026-10-05_1400')
  assert.equal(parseNotesName('2026-10-05_1400_Integration.pdf'), '2026-10-05_1400')
  for (const bad of ['2026-02-30_1400_Notes.pdf', '2026-10-05_2460_N.pdf', 'notes.pdf']) assert.equal(parseNotesName(bad), null)
})
test('normalize only real Google Meet links', () => {
  assert.equal(meetCode('https://meet.google.com/abc-defg-hij?authuser=0'), 'abc-defg-hij')
  assert.equal(meetCode('https://evil.example/abc-defg-hij'), null)
})
test('discovery recovers downtime and respects activation', () => {
  const now = new Date('2026-10-20'), activation = new Date('2026-10-01'), watermark = new Date('2026-10-05')
  assert.equal(discoveryStart(activation, watermark, now).toISOString(), watermark.toISOString())
  assert.equal(discoveryStart(new Date('2026-10-18'), watermark, now).toISOString(), new Date('2026-10-18').toISOString())
})
test('manual changes are detected only in automation-owned fields', () => {
  assert.equal(fieldsUnchanged({ title: 'Edited', description: 'anything' }, { title: 'Generated' }), false)
  assert.equal(fieldsUnchanged({ title: 'Generated', description: 'Edited' }, { title: 'Generated' }), true)
})
