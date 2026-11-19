// GenZie's community matcher: plain word overlap (no outside service), so every match is explainable.
// Pure functions only, so match.check.ts can run them without a database.
import type { GenieNode, GenieLang } from './tree'

/** Cosine of the two word sets. 0.55 ≈ "most of the words are the same". */
export const MATCH_THRESHOLD = 0.55
const MIN_SHARED_WORDS = 2

const STOP = new Set((
  'a an the is are was were be been am i im me my we our you your u ur he she it its they them this that these those ' +
  'to of in on at for from with by and or but if so do does did done can could will would should shall may might must ' +
  'how what why when where which who whom whose please pls plz sir mam maam madam hi hello hey bhai bro yaar guys anyone ' +
  'any some about there here have has had get got also just still very really one ' +
  'kya kyu kyun kaise kab kaha kahan kaun kitna kitne hai hain ho hoga hogi tha thi the ka ki ke ko se me mein main mai ' +
  'mujhe mera meri mere hum humein aap ap tum ye yeh wo woh koi kuch bhi to toh na hi ek aur par pe isme iska uska'
).split(' '))

const stem = (w: string) =>
  w.length > 5 && w.endsWith('ing') ? w.slice(0, -3)
    : w.length > 4 && w.endsWith('ed') ? w.slice(0, -2)
      : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1)
        : w

export function tokens(text: string): Set<string> {
  const words = (text || '')
    .toLowerCase()
    .replace(/&[a-z#0-9]+;/g, ' ') // sanitizeInput HTML entities
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')
    .split(' ')
    .filter(w => w.length > 1 && !STOP.has(w))
    .map(stem)
  return new Set(words)
}

export function similarity(a: Set<string>, b: Set<string>): { score: number; shared: string[] } {
  if (!a.size || !b.size) return { score: 0, shared: [] }
  const shared = Array.from(a).filter(w => b.has(w))
  return { score: shared.length / Math.sqrt(a.size * b.size), shared }
}

export function looksLikeQuestion(text: string): boolean {
  if (!text) return false
  if (text.includes('?')) return true
  return /\b(how|what|why|when|where|which|can|could|is|are|does|do|kya|kaise|kyu|kyun|kab|kaha|kahan|kaun|kitna|kitne|doubt)\b/i.test(text)
}

export interface KnowledgeDoc { key: string; text: string; answer: string; source: 'tree' | 'learned' }

/** Tree answers indexed by the option labels that lead to them (one doc per language). */
export function treeDocs(root: GenieNode): KnowledgeDoc[] {
  const docs: KnowledgeDoc[] = []
  const walk = (n: GenieNode, labels: { en: string; hi: string }[]) => {
    if (n.answer && !n.needsAgent) {
      const path = labels.slice(-2)
      for (const lang of ['en', 'hi'] as GenieLang[]) {
        const answer = n.answer[lang] || n.answer.en
        if (answer) docs.push({ key: `tree:${n.id}:${lang}`, text: path.map(l => l[lang]).join(' '), answer, source: 'tree' })
      }
    }
    n.options?.forEach(o => walk(o.next, [...labels, o.label]))
  }
  walk(root, [])
  return docs
}

export interface Match { doc: KnowledgeDoc; score: number; shared: string[] }

/** Best doc for a question, or null if nothing clears the threshold. */
export function bestMatch(question: string, docs: KnowledgeDoc[]): Match | null {
  const q = tokens(question)
  if (q.size < MIN_SHARED_WORDS) return null
  let best: Match | null = null
  for (const doc of docs) {
    const { score, shared } = similarity(q, tokens(doc.text))
    if (shared.length < MIN_SHARED_WORDS || score < MATCH_THRESHOLD) continue
    if (!best || score > best.score) best = { doc, score, shared }
  }
  return best
}
