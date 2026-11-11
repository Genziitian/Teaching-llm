import { NextRequest, NextResponse } from 'next/server'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { bumpTree, loadGraph, MAX_OPTIONS, resetToDefault, wouldCycle } from '@/lib/genie/store'
import { db } from '@/lib/genie/server'

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })
const str = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.slice(0, max) : null)
const href = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, 300) : ''
  if (!s) return null
  return /^(\/[^\s]*|https:\/\/[^\s]+)$/.test(s) ? s : null
}

// One endpoint for every edit made on the Genie map (managers only).
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    if (auth.session!.role !== 'MANAGER') return bad('Managers only', 403)
    const b = await req.json().catch(() => ({}))
    const op = String(b.op || '')

    if (op === 'moveNodes') {
      const items = Array.isArray(b.items) ? b.items.slice(0, 500) : []
      await db.$transaction(items.filter((i: any) => i && typeof i.id === 'string' && Number.isFinite(i.x) && Number.isFinite(i.y))
        .map((i: any) => db.genieNode.update({ where: { id: i.id }, data: { x: i.x, y: i.y } })))
      return NextResponse.json({ ok: true })
    }

    if (op === 'createNode') {
      const kind = b.kind === 'answer' ? 'answer' : 'menu'
      const id = `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      const node = await db.genieNode.create({
        data: {
          id, kind,
          questionEn: kind === 'menu' ? str(b.questionEn, 300) || 'New question' : null,
          questionHi: kind === 'menu' ? str(b.questionHi, 300) || str(b.questionEn, 300) || 'New question' : null,
          answerEn: kind === 'answer' ? str(b.answerEn, 3000) || 'New answer' : null,
          answerHi: kind === 'answer' ? str(b.answerHi, 3000) || str(b.answerEn, 3000) || 'New answer' : null,
          x: Number.isFinite(b.x) ? b.x : null, y: Number.isFinite(b.y) ? b.y : null,
        },
      })
      bumpTree()
      return NextResponse.json({ node })
    }

    if (op === 'saveNode') {
      const id = String(b.id || '')
      const p = b.patch || {}
      const cur = await db.genieNode.findUnique({ where: { id } })
      if (!cur) return bad('Node not found', 404)
      const data: any = {}
      if ('questionEn' in p) data.questionEn = str(p.questionEn, 300)
      if ('questionHi' in p) data.questionHi = str(p.questionHi, 300)
      if ('answerEn' in p) data.answerEn = str(p.answerEn, 3000)
      if ('answerHi' in p) data.answerHi = str(p.answerHi, 3000)
      if ('linkLabelEn' in p) data.linkLabelEn = str(p.linkLabelEn, 80)
      if ('linkLabelHi' in p) data.linkLabelHi = str(p.linkLabelHi, 80)
      if ('linkHref' in p) { data.linkHref = href(p.linkHref); if (p.linkHref && !data.linkHref) return bad('Link must start with / or https://') }
      if ('needsAgent' in p) data.needsAgent = !!p.needsAgent
      if ('ticketType' in p) data.ticketType = p.ticketType === 'SUBJECT' ? 'SUBJECT' : p.ticketType === 'GENERAL' ? 'GENERAL' : null
      if ('kind' in p && id !== 'root' && (p.kind === 'menu' || p.kind === 'answer') && p.kind !== cur.kind) {
        if (p.kind === 'answer') {
          const out = await db.genieOption.count({ where: { fromId: id } })
          if (out > 0) return bad('Remove its options first before turning it into an answer')
        }
        data.kind = p.kind
        if (p.kind === 'answer') { data.answerEn = cur.answerEn || cur.questionEn || 'New answer'; data.answerHi = cur.answerHi || cur.questionHi || data.answerEn }
        else { data.questionEn = cur.questionEn || 'New question'; data.questionHi = cur.questionHi || data.questionEn }
      }
      await db.genieNode.update({ where: { id }, data })
      bumpTree()
      return NextResponse.json({ ok: true })
    }

    if (op === 'deleteNode') {
      const id = String(b.id || '')
      if (id === 'root') return bad('The start node cannot be deleted')
      await db.genieNode.delete({ where: { id } }).catch(() => null)
      bumpTree()
      return NextResponse.json({ ok: true })
    }

    if (op === 'createEdge') {
      const fromId = String(b.fromId || ''), toId = String(b.toId || '')
      const labelEn = (str(b.labelEn, 80) || '').trim()
      const labelHi = (str(b.labelHi, 80) || '').trim() || labelEn
      if (!labelEn) return bad('Give the option a label')
      const g = await loadGraph()
      const from = g.nodes.find(n => n.id === fromId), to = g.nodes.find(n => n.id === toId)
      if (!from || !to) return bad('Node not found', 404)
      if (from.kind !== 'menu') return bad('Only a question node can have options. Turn it into a question first.')
      if (toId === 'root') return bad('Nothing can link back to the start')
      if (g.edges.some(e => e.fromId === fromId && e.toId === toId)) return bad('These two are already linked')
      const count = g.edges.filter(e => e.fromId === fromId).length
      if (count >= MAX_OPTIONS) return bad(`A screen can show at most ${MAX_OPTIONS} options`)
      if (wouldCycle(g.edges, fromId, toId)) return bad('That link would make a loop')
      const edge = await db.genieOption.create({ data: { fromId, toId, labelEn, labelHi, sortOrder: count } })
      bumpTree()
      return NextResponse.json({ edge })
    }

    if (op === 'saveEdge') {
      const id = String(b.id || '')
      const data: any = {}
      const en = str(b.labelEn, 80), hi = str(b.labelHi, 80)
      if (en !== null) { if (!en.trim()) return bad('Label cannot be empty'); data.labelEn = en }
      if (hi !== null) data.labelHi = hi
      if (Number.isInteger(b.sortOrder)) data.sortOrder = b.sortOrder
      await db.genieOption.update({ where: { id }, data })
      bumpTree()
      return NextResponse.json({ ok: true })
    }

    if (op === 'reconnectEdge') {
      const id = String(b.id || ''), toId = String(b.toId || '')
      const g = await loadGraph()
      const e = g.edges.find(x => x.id === id)
      if (!e) return bad('Option not found', 404)
      if (!g.nodes.some(n => n.id === toId) || toId === 'root') return bad('Cannot link there')
      if (g.edges.some(x => x.id !== id && x.fromId === e.fromId && x.toId === toId)) return bad('These two are already linked')
      if (wouldCycle(g.edges.filter(x => x.id !== id), e.fromId, toId)) return bad('That link would make a loop')
      await db.genieOption.update({ where: { id }, data: { toId } })
      bumpTree()
      return NextResponse.json({ ok: true })
    }

    if (op === 'deleteEdge') {
      await db.genieOption.delete({ where: { id: String(b.id || '') } }).catch(() => null)
      bumpTree()
      return NextResponse.json({ ok: true })
    }

    if (op === 'reset') {
      if (b.confirm !== 'RESET') return bad('Confirmation missing')
      await resetToDefault()
      return NextResponse.json({ ok: true })
    }

    return bad('Unknown operation')
  } catch (e: any) {
    console.error('genie op', e)
    return NextResponse.json({ error: e?.code === 'P2002' ? 'Already exists' : 'Could not save' }, { status: 500 })
  }
}
