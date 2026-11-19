// Self-check for the community matcher. Run:
// npx ts-node --compiler-options '{"module":"CommonJS"}' src/lib/genie/match.check.ts
import assert from 'node:assert'
import { GENIE_TREE } from './tree'
import { bestMatch, looksLikeQuestion, treeDocs, type KnowledgeDoc } from './match'

const docs = treeDocs(GENIE_TREE)
assert.ok(docs.length > 10, 'tree should produce docs')

const learned: KnowledgeDoc[] = [{ key: 'learned:1', text: 'When is the quiz 1 for maths 2?', answer: 'Quiz 1 is on 5 Dec.', source: 'learned' }]
const all = [...learned, ...docs]

const cases: [string, string | null][] = [
  ["I bought a course but it's not showing?", 'tree:course.not-visible:en'],
  ['maine course kharida par dikh nahi raha', 'tree:course.not-visible:hi'],
  ['bhai maths 2 ka quiz 1 kab hai?', 'learned:1'],
  ['what is the meaning of life?', null],
  ['hello', null],
]
for (const [q, want] of cases) {
  const m = bestMatch(q, all)
  console.log(JSON.stringify(q), '->', m ? `${m.doc.key} ${m.score.toFixed(2)} [${m.shared}]` : 'none')
  assert.strictEqual(m?.doc.key ?? null, want, q)
}
assert.ok(looksLikeQuestion('kaise karu'))
assert.ok(!looksLikeQuestion('thanks sir'))
console.log('match.check ok')
