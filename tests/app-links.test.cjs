const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../src/lib/app-links.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const helper = {}
new Function('exports', compiled)(helper)
const { androidAppIntent } = helper

test('app button preserves the shared course and lecture destination', () => {
  const intent = androidAppIntent('https://class.genziitian.in/courses/course1/lectures/lecture1?courseId=shared1#comments')
  assert.ok(intent.startsWith('intent://class.genziitian.in/courses/course1/lectures/lecture1?courseId=shared1#Intent;'))
  assert.ok(intent.includes('package=com.teaching.lms;'))
  assert.ok(intent.includes(`S.browser_fallback_url=${encodeURIComponent('https://play.google.com/store/apps/details?id=com.teaching.lms')};end`))
  assert.ok(!intent.includes('#comments'))
})

test('login page opens its original destination in the app', () => {
  assert.ok(androidAppIntent('/login?next=%2Fcourses%2Fcourse1%3Ftab%3Dnotes')
    .startsWith('intent://class.genziitian.in/courses/course1?tab=notes#Intent;'))
})

test('external and malformed destinations cannot change the app host or inject intent fields', () => {
  for (const input of ['https://evil.test/courses/1', '/login?next=%2F%2Fevil.test', '/login?next=%2F%5Cevil.test', 'https://[invalid']) {
    const intent = androidAppIntent(input)
    assert.ok(intent.startsWith('intent://class.genziitian.in/'))
    assert.ok(!intent.includes('intent://evil.test'))
  }
  const intent = androidAppIntent('/courses/1#Intent;package=evil;end')
  assert.equal(intent.split('#Intent;').length, 2)
  assert.ok(!intent.includes('package=evil'))
})

test('website association identifies the official app and all supplied signing certificates', () => {
  const statements = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/.well-known/assetlinks.json'), 'utf8'))
  assert.equal(statements.length, 1)
  const { target, relation } = statements[0]
  assert.deepEqual(relation, ['delegate_permission/common.handle_all_urls'])
  assert.equal(target.namespace, 'android_app')
  assert.equal(target.package_name, 'com.teaching.lms')
  assert.equal(new Set(target.sha256_cert_fingerprints).size, 3)
  for (const fingerprint of target.sha256_cert_fingerprints) {
    assert.match(fingerprint, /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/)
  }
})
