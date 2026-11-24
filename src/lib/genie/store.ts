import { prisma } from '@/lib/db'
import { GENIE_TREE, UI } from './tree'
import type { GenieNode, GenieOption } from './tree'

// Tables are new, so the generated Prisma client may not know them until `prisma generate` runs.
const db: any = prisma

export interface NodeRow {
  id: string; kind: 'menu' | 'answer'
  questionEn: string | null; questionHi: string | null
  answerEn: string | null; answerHi: string | null
  linkLabelEn: string | null; linkLabelHi: string | null; linkHref: string | null
  needsAgent: boolean; ticketType: string | null
  x: number | null; y: number | null
}
export interface EdgeRow { id: string; fromId: string; toId: string; labelEn: string; labelHi: string; sortOrder: number }

export const MAX_OPTIONS = 5

/** Flatten the built-in tree (tree.ts) into rows: the starting content of the database. */
export function flattenTree(root: GenieNode = GENIE_TREE) {
  const nodes = new Map<string, NodeRow>()
  const edges: EdgeRow[] = []
  const walk = (n: GenieNode) => {
    if (nodes.has(n.id)) return
    nodes.set(n.id, {
      id: n.id, kind: n.options ? 'menu' : 'answer',
      questionEn: n.q?.en ?? null, questionHi: n.q?.hi ?? null,
      answerEn: n.answer?.en ?? null, answerHi: n.answer?.hi ?? null,
      linkLabelEn: n.link?.label.en ?? null, linkLabelHi: n.link?.label.hi ?? null, linkHref: n.link?.href ?? null,
      needsAgent: !!n.needsAgent, ticketType: n.ticketType ?? null, x: null, y: null,
    })
    n.options?.forEach((o: GenieOption, i: number) => {
      edges.push({ id: `${n.id}>${o.next.id}`, fromId: n.id, toId: o.next.id, labelEn: o.label.en, labelHi: o.label.hi, sortOrder: i })
      walk(o.next)
    })
  }
  walk(root)
  return { nodes: Array.from(nodes.values()), edges }
}

export async function seedIfEmpty(): Promise<boolean> {
  if ((await db.genieNode.count()) > 0) return false
  const { nodes, edges } = flattenTree()
  await db.$transaction([
    db.genieNode.createMany({ data: nodes, skipDuplicates: true }),
    db.genieOption.createMany({ data: edges, skipDuplicates: true }),
  ])
  return true
}

export async function resetToDefault() {
  const { nodes, edges } = flattenTree()
  await db.$transaction([
    db.genieOption.deleteMany({}),
    db.genieNode.deleteMany({}),
    db.genieNode.createMany({ data: nodes, skipDuplicates: true }),
    db.genieOption.createMany({ data: edges, skipDuplicates: true }),
  ])
  bumpTree()
}

export async function loadGraph(): Promise<{ nodes: NodeRow[]; edges: EdgeRow[] }> {
  const [nodes, edges] = await Promise.all([
    db.genieNode.findMany({ orderBy: { createdAt: 'asc' } }),
    db.genieOption.findMany({ orderBy: [{ fromId: 'asc' }, { sortOrder: 'asc' }] }),
  ])
  return { nodes, edges }
}

/** Turn the graph into the nested tree the student widget walks. A shared node is simply repeated. */
export function buildTree(nodes: NodeRow[], edges: EdgeRow[]): GenieNode | null {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const out = new Map<string, EdgeRow[]>()
  edges.forEach(e => { const a = out.get(e.fromId) || []; a.push(e); out.set(e.fromId, a) })
  const make = (id: string, trail: string[]): GenieNode | null => {
    const n = byId.get(id)
    if (!n || trail.includes(id) || trail.length > 8) return null
    const node: GenieNode = { id: n.id }
    if (n.needsAgent) node.needsAgent = true
    if (n.ticketType === 'GENERAL' || n.ticketType === 'SUBJECT') node.ticketType = n.ticketType
    if (n.kind === 'menu') {
      node.q = { en: n.questionEn || '', hi: n.questionHi || n.questionEn || '' }
      node.options = (out.get(id) || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(e => {
          const next = make(e.toId, [...trail, id])
          return next ? { id: e.id, label: { en: e.labelEn, hi: e.labelHi || e.labelEn }, next } : null
        })
        .filter(Boolean) as GenieOption[]
    } else {
      node.answer = { en: n.answerEn || '', hi: n.answerHi || n.answerEn || '' }
      if (n.linkHref) node.link = { label: { en: n.linkLabelEn || 'Open', hi: n.linkLabelHi || n.linkLabelEn || 'Open' }, href: n.linkHref }
    }
    return node
  }
  const root = make('root', [])
  if (root) root.q = UI.greeting
  return root
}

let cache: { at: number; tree: GenieNode } | null = null
export function bumpTree() { cache = null }

/** What students see: the database tree, or the built-in one if the tables are missing or empty. */
export async function getLiveTree(): Promise<{ tree: GenieNode; source: 'db' | 'default' }> {
  if (cache && Date.now() - cache.at < 15000) return { tree: cache.tree, source: 'db' }
  try {
    await seedIfEmpty()
    const { nodes, edges } = await loadGraph()
    const tree = buildTree(nodes, edges)
    if (tree && tree.options && tree.options.length) {
      cache = { at: Date.now(), tree }
      return { tree, source: 'db' }
    }
  } catch (e) {
    console.error('genie tree: falling back to built-in', (e as Error)?.message)
  }
  return { tree: GENIE_TREE, source: 'default' }
}

/** Would linking from -> to create a loop? */
export function wouldCycle(edges: EdgeRow[], fromId: string, toId: string): boolean {
  if (fromId === toId) return true
  const seen = new Set<string>()
  const stack = [toId]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === fromId) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    edges.filter(e => e.fromId === cur).forEach(e => stack.push(e.toId))
  }
  return false
}
