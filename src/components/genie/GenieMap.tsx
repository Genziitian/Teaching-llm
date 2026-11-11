'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Genie Map: an infinite, zoomable canvas of every question → option → answer.
 *  - drag the background to pan, scroll / pinch buttons to zoom
 *  - drag a card to move it
 *  - drag the dot on a question's right edge onto another card (or empty space) to link / create
 *  - click a card or an option to edit it; drag the dot on a selected option's arrow to re-link it
 * Every change is saved straight to the database and is live for students within ~15 seconds.
 */

interface N {
  id: string; kind: 'menu' | 'answer'
  questionEn: string | null; questionHi: string | null
  answerEn: string | null; answerHi: string | null
  linkLabelEn: string | null; linkLabelHi: string | null; linkHref: string | null
  needsAgent: boolean; ticketType: string | null
  x: number | null; y: number | null
}
interface E { id: string; fromId: string; toId: string; labelEn: string; labelHi: string; sortOrder: number }
interface Pos { x: number; y: number }

const W = 300
const H_MENU = 96
const H_ANS = 132
const MAX_OPTIONS = 5
const hOf = (n: N) => (n.kind === 'menu' ? H_MENU : H_ANS)

function autoLayout(nodes: N[], edges: E[]): Map<string, Pos> {
  const out = new Map<string, E[]>()
  edges.forEach(e => { const a = out.get(e.fromId) || []; a.push(e); out.set(e.fromId, a) })
  out.forEach(a => a.sort((p, q) => p.sortOrder - q.sortOrder))
  const pos = new Map<string, Pos>()
  const placed = new Set<string>()
  let slot = 0
  const place = (id: string, depth: number): number => {
    if (placed.has(id)) return pos.get(id)!.y
    placed.add(id)
    const ys = (out.get(id) || []).map(e => place(e.toId, depth + 1))
    const y = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : slot++ * 150
    pos.set(id, { x: depth * 440, y })
    return y
  }
  if (nodes.some(n => n.id === 'root')) place('root', 0)
  nodes.forEach(n => { if (!placed.has(n.id)) place(n.id, 0) })
  return pos
}

function textOf(n: N) {
  return n.kind === 'menu' ? (n.questionEn || '') : (n.answerEn || '')
}

export default function GenieMap() {
  const [nodes, setNodes] = useState<N[]>([])
  const [edges, setEdges] = useState<E[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [vp, setVp] = useState({ x: 60, y: 60, k: 0.8 })
  const [sel, setSel] = useState<{ type: 'node' | 'edge'; id: string } | null>(null)
  const [query, setQuery] = useState('')
  const [linking, setLinking] = useState<{ fromId: string; edgeId?: string; x: number; y: number } | null>(null)
  const [dlg, setDlg] = useState<null | { fromId: string; toId?: string; at: Pos; labelEn: string; labelHi: string; newKind: 'menu' | 'answer' }>(null)
  const [busy, setBusy] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const vpRef = useRef(vp); vpRef.current = vp
  const nodesRef = useRef(nodes); nodesRef.current = nodes
  const dragRef = useRef<null | { kind: 'pan' | 'node'; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean }>(null)

  const say = (m: string) => { setToast(m); window.setTimeout(() => setToast(t => (t === m ? null : t)), 3500) }

  const api = useCallback(async (body: any) => {
    const r = await fetch('/api/genie/admin/op', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d?.error || `Error ${r.status}`)
    return d
  }, [])

  // ── load ──
  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch('/api/genie/admin/graph', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || `Error ${r.status}`)
      const ns: N[] = d.nodes, es: E[] = d.edges
      const need = ns.filter(n => n.x == null || n.y == null)
      if (need.length) {
        const lay = autoLayout(ns, es)
        need.forEach(n => { const p = lay.get(n.id); if (p) { n.x = p.x; n.y = p.y } })
        api({ op: 'moveNodes', items: need.map(n => ({ id: n.id, x: n.x, y: n.y })) }).catch(() => {})
      }
      setNodes(ns); setEdges(es)
      const root = ns.find(n => n.id === 'root')
      if (root) setVp({ x: 80 - (root.x || 0) * 0.8, y: 240 - (root.y || 0) * 0.8, k: 0.8 })
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load') }
    finally { setLoading(false) }
  }, [api])
  useEffect(() => { void load() }, [load])

  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  const outCount = useMemo(() => { const m = new Map<string, number>(); edges.forEach(e => m.set(e.fromId, (m.get(e.fromId) || 0) + 1)); return m }, [edges])
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => (q ? new Set(nodes.filter(n => [n.questionEn, n.questionHi, n.answerEn, n.answerHi, n.id].some(t => (t || '').toLowerCase().includes(q))).map(n => n.id)) : new Set<string>()), [q, nodes])

  // ── viewport helpers ──
  const toWorld = (cx: number, cy: number): Pos => {
    const r = wrapRef.current!.getBoundingClientRect()
    const v = vpRef.current
    return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k }
  }
  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const r = wrapRef.current!.getBoundingClientRect()
    const px = (cx ?? r.left + r.width / 2) - r.left, py = (cy ?? r.top + r.height / 2) - r.top
    setVp(v => {
      const k = Math.min(2.5, Math.max(0.08, v.k * factor))
      const f = k / v.k
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f }
    })
  }
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const fit = () => {
    if (!nodes.length || !wrapRef.current) return
    const xs = nodes.map(n => n.x || 0), ys = nodes.map(n => n.y || 0)
    const minX = Math.min(...xs), maxX = Math.max(...xs) + W, minY = Math.min(...ys), maxY = Math.max(...ys) + H_ANS
    const r = wrapRef.current.getBoundingClientRect()
    const k = Math.min(2, Math.max(0.08, Math.min((r.width - 80) / (maxX - minX), (r.height - 80) / (maxY - minY))))
    setVp({ k, x: (r.width - (maxX - minX) * k) / 2 - minX * k, y: (r.height - (maxY - minY) * k) / 2 - minY * k })
  }
  const centerOn = (n: N) => {
    const r = wrapRef.current!.getBoundingClientRect()
    setVp(v => ({ ...v, x: r.width / 2 - ((n.x || 0) + W / 2) * v.k, y: r.height / 2 - ((n.y || 0) + hOf(n) / 2) * v.k }))
  }

  // ── pointer handling (pan, move card, link) ──
  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: vp.x, oy: vp.y, moved: false }
  }
  const startNode = (e: React.PointerEvent, n: N) => {
    if (e.button !== 0) return
    e.stopPropagation()
    dragRef.current = { kind: 'node', id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x || 0, oy: n.y || 0, moved: false }
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (linking) { const p = toWorld(e.clientX, e.clientY); setLinking(l => (l ? { ...l, x: p.x, y: p.y } : l)); return }
      if (!d) return
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
      if (!d.moved) return
      if (d.kind === 'pan') setVp(v => ({ ...v, x: d.ox + dx, y: d.oy + dy }))
      else {
        const k = vpRef.current.k
        setNodes(ns => ns.map(n => (n.id === d.id ? { ...n, x: d.ox + dx / k, y: d.oy + dy / k } : n)))
      }
    }
    const up = (e: PointerEvent) => {
      if (linking) {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        const target = el?.closest('[data-node-id]') as HTMLElement | null
        const toId = target?.getAttribute('data-node-id') || undefined
        const l = linking
        setLinking(null)
        if (l.edgeId) {
          if (toId) void run(async () => { await api({ op: 'reconnectEdge', id: l.edgeId, toId }); await reloadQuiet(); say('Option re-linked') })
          return
        }
        if (toId && toId !== l.fromId) setDlg({ fromId: l.fromId, toId, at: { x: l.x, y: l.y }, labelEn: '', labelHi: '', newKind: 'menu' })
        else if (!toId) setDlg({ fromId: l.fromId, at: { x: l.x, y: l.y }, labelEn: '', labelHi: '', newKind: 'answer' })
        return
      }
      const d = dragRef.current
      dragRef.current = null
      if (!d) return
      if (d.kind === 'node' && d.id) {
        if (!d.moved) { setSel({ type: 'node', id: d.id }); return }
        const n = nodesRef.current.find(x => x.id === d.id)
        if (n) api({ op: 'moveNodes', items: [{ id: n.id, x: n.x, y: n.y }] }).catch(() => say('Could not save position'))
      } else if (d.kind === 'pan' && !d.moved) setSel(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [linking, api]) // eslint-disable-line react-hooks/exhaustive-deps

  const reloadQuiet = async () => {
    const r = await fetch('/api/genie/admin/graph', { cache: 'no-store' })
    const d = await r.json()
    if (!r.ok) return
    // keep local positions the manager just set
    const local = new Map(nodesRef.current.map(n => [n.id, n]))
    setNodes((d.nodes as N[]).map(n => { const l = local.get(n.id); return l && n.x == null ? { ...n, x: l.x, y: l.y } : n }))
    setEdges(d.edges)
  }
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e) { say(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  // ── actions ──
  const addNode = (kind: 'menu' | 'answer') => run(async () => {
    const r = wrapRef.current!.getBoundingClientRect()
    const c = toWorld(r.left + r.width / 2, r.top + r.height / 2)
    const d = await api({ op: 'createNode', kind, x: c.x - W / 2, y: c.y - 50 })
    await reloadQuiet(); setSel({ type: 'node', id: d.node.id }); say(kind === 'menu' ? 'Question added: drag it into place and link it' : 'Answer added: drag it into place and link it')
  })
  const submitDialog = () => {
    if (!dlg || !dlg.labelEn.trim()) return
    void run(async () => {
      let toId = dlg.toId
      if (!toId) {
        const d = await api({ op: 'createNode', kind: dlg.newKind, x: dlg.at.x + 40, y: dlg.at.y - 40 })
        toId = d.node.id as string
      }
      await api({ op: 'createEdge', fromId: dlg.fromId, toId, labelEn: dlg.labelEn.trim(), labelHi: dlg.labelHi.trim() })
      setDlg(null); await reloadQuiet(); setSel({ type: 'node', id: toId! }); say('Linked')
    })
  }

  // ── geometry ──
  const anchorOut = (n: N): Pos => ({ x: (n.x || 0) + W, y: (n.y || 0) + hOf(n) / 2 })
  const anchorIn = (n: N): Pos => ({ x: n.x || 0, y: (n.y || 0) + hOf(n) / 2 })
  const curve = (a: Pos, b: Pos) => {
    const dx = Math.max(70, Math.abs(b.x - a.x) / 2)
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
  }

  const selNode = sel?.type === 'node' ? byId.get(sel.id) : undefined
  const selEdge = sel?.type === 'edge' ? edges.find(e => e.id === sel.id) : undefined

  return (
    <div className="gm-root">
      <style>{CSS}</style>

      <div className="gm-bar">
        <div className="gm-title">Genie Map</div>
        <input className="gm-search" placeholder="Search questions & answers…" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && matches.size) { const n = byId.get(Array.from(matches)[0]); if (n) { centerOn(n); setSel({ type: 'node', id: n.id }) } } }} />
        {q && <span className="gm-count">{matches.size} found · Enter to jump</span>}
        <span className="gm-spacer" />
        <button onClick={() => addNode('menu')} disabled={busy}>+ Question</button>
        <button onClick={() => addNode('answer')} disabled={busy}>+ Answer</button>
        <button onClick={() => zoomAt(1.25)} aria-label="Zoom in">＋</button>
        <button onClick={() => zoomAt(0.8)} aria-label="Zoom out">－</button>
        <button onClick={fit}>Fit all</button>
        <button className="gm-danger" onClick={() => { if (window.confirm('Reset Genie to the built-in questions and answers? Your edits will be lost.') && window.prompt('Type RESET to confirm') === 'RESET') void run(async () => { await api({ op: 'reset', confirm: 'RESET' }); await load(); say('Reset to default') }) }}>Reset</button>
      </div>

      {loading && <div className="gm-msg">Loading the map…</div>}
      {err && <div className="gm-msg err">{err}</div>}

      {!loading && !err && (
        <div ref={wrapRef} className="gm-canvas" onPointerDown={startPan}>
          <div className="gm-world" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.k})` }}>
            <svg className="gm-svg" width="1" height="1" style={{ overflow: 'visible' }}>
              <defs>
                <marker id="gm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#71717a" /></marker>
                <marker id="gm-arrow-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#2563eb" /></marker>
              </defs>
              {edges.map(e => {
                const a = byId.get(e.fromId), b = byId.get(e.toId)
                if (!a || !b) return null
                const on = sel?.type === 'edge' && sel.id === e.id
                const d = curve(anchorOut(a), anchorIn(b))
                return (
                  <g key={e.id}>
                    <path d={d} fill="none" stroke={on ? '#2563eb' : '#52525b'} strokeWidth={on ? 3 : 1.6} markerEnd={`url(#${on ? 'gm-arrow-sel' : 'gm-arrow'})`} />
                    <path d={d} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                      onPointerDown={ev => { ev.stopPropagation(); setSel({ type: 'edge', id: e.id }) }} />
                  </g>
                )
              })}
              {linking && (() => { const a = byId.get(linking.fromId); if (!a) return null; return <path d={curve(anchorOut(a), { x: linking.x, y: linking.y })} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeDasharray="6 5" /> })()}
            </svg>

            {edges.map(e => {
              const a = byId.get(e.fromId), b = byId.get(e.toId)
              if (!a || !b) return null
              const p = anchorOut(a), t = anchorIn(b)
              const on = sel?.type === 'edge' && sel.id === e.id
              return (
                <div key={'l' + e.id} className={`gm-elabel${on ? ' on' : ''}`} style={{ left: (p.x + t.x) / 2, top: (p.y + t.y) / 2 }}
                  onPointerDown={ev => { ev.stopPropagation(); setSel({ type: 'edge', id: e.id }) }}>
                  {e.labelEn.length > 30 ? e.labelEn.slice(0, 29) + '…' : e.labelEn}
                </div>
              )
            })}

            {selEdge && (() => { const b = byId.get(selEdge.toId); if (!b) return null; const t = anchorIn(b)
              return <div className="gm-endknob" style={{ left: t.x, top: t.y }} title="Drag onto another card to re-link"
                onPointerDown={ev => { ev.stopPropagation(); setLinking({ fromId: selEdge.fromId, edgeId: selEdge.id, x: t.x, y: t.y }) }} /> })()}

            {nodes.map(n => {
              const isSel = sel?.type === 'node' && sel.id === n.id
              const full = (outCount.get(n.id) || 0) >= MAX_OPTIONS
              const empty = n.kind === 'menu' && !(outCount.get(n.id))
              return (
                <div key={n.id} data-node-id={n.id}
                  className={`gm-node ${n.kind}${isSel ? ' sel' : ''}${matches.has(n.id) ? ' hit' : ''}${n.id === 'root' ? ' root' : ''}`}
                  style={{ left: n.x || 0, top: n.y || 0, width: W, height: hOf(n) }}
                  onPointerDown={ev => startNode(ev, n)}>
                  <div className="gm-tag">
                    {n.id === 'root' ? 'START' : n.kind === 'menu' ? 'QUESTION' : 'ANSWER'}
                    {n.kind === 'menu' && <span className={`gm-n${full ? ' full' : ''}`}>{outCount.get(n.id) || 0}/{MAX_OPTIONS}</span>}
                    {n.needsAgent && <span className="gm-agent">agent</span>}
                    {empty && <span className="gm-warn">no options</span>}
                  </div>
                  <div className="gm-text">{textOf(n) || (n.id === 'root' ? 'Greeting (set in code)' : '—')}</div>
                  {n.kind === 'menu' && (
                    <div className="gm-handle" title="Drag to another card to add an option"
                      onPointerDown={ev => { ev.stopPropagation(); const o = anchorOut(n); setLinking({ fromId: n.id, x: o.x, y: o.y }) }} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="gm-hint">Drag background to pan · scroll to zoom · drag the dot on a question to link it · click anything to edit</div>
        </div>
      )}

      {toast && <div className="gm-toast">{toast}</div>}

      {(selNode || selEdge) && (
        <aside className="gm-panel" onPointerDown={e => e.stopPropagation()}>
          {selNode && <NodeEditor key={selNode.id} node={selNode} outs={edges.filter(e => e.fromId === selNode.id).length} ins={edges.filter(e => e.toId === selNode.id).length} busy={busy}
            onClose={() => setSel(null)}
            onSave={patch => run(async () => { await api({ op: 'saveNode', id: selNode.id, patch }); await reloadQuiet(); say('Saved') })}
            onDelete={() => { if (window.confirm('Delete this card and its links?')) void run(async () => { await api({ op: 'deleteNode', id: selNode.id }); setSel(null); await reloadQuiet(); say('Deleted') }) }} />}
          {selEdge && <EdgeEditor key={selEdge.id} edge={selEdge} from={byId.get(selEdge.fromId)} to={byId.get(selEdge.toId)} busy={busy}
            onClose={() => setSel(null)}
            onSave={(en, hi) => run(async () => { await api({ op: 'saveEdge', id: selEdge.id, labelEn: en, labelHi: hi }); await reloadQuiet(); say('Saved') })}
            onDelete={() => run(async () => { await api({ op: 'deleteEdge', id: selEdge.id }); setSel(null); await reloadQuiet(); say('Link removed') })} />}
        </aside>
      )}

      {dlg && (
        <div className="gm-modal" onPointerDown={e => e.stopPropagation()}>
          <div className="gm-card">
            <h3>New option</h3>
            <p className="gm-sub">{byId.get(dlg.fromId)?.questionEn} <b>→</b> {dlg.toId ? (textOf(byId.get(dlg.toId)!) || 'card').slice(0, 60) : 'a new card'}</p>
            {!dlg.toId && (
              <div className="gm-seg">
                <button className={dlg.newKind === 'answer' ? 'on' : ''} onClick={() => setDlg({ ...dlg, newKind: 'answer' })}>New answer</button>
                <button className={dlg.newKind === 'menu' ? 'on' : ''} onClick={() => setDlg({ ...dlg, newKind: 'menu' })}>New question</button>
              </div>
            )}
            <label>Button text (English)<input autoFocus value={dlg.labelEn} maxLength={80} onChange={e => setDlg({ ...dlg, labelEn: e.target.value })} /></label>
            <label>Button text (Hinglish)<input value={dlg.labelHi} maxLength={80} placeholder="same as English if empty" onChange={e => setDlg({ ...dlg, labelHi: e.target.value })} /></label>
            <div className="gm-row"><button onClick={() => setDlg(null)}>Cancel</button><button className="gm-primary" disabled={!dlg.labelEn.trim() || busy} onClick={submitDialog}>Add option</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function NodeEditor({ node, outs, ins, busy, onSave, onDelete, onClose }: { node: N; outs: number; ins: number; busy: boolean; onSave: (p: Partial<N>) => void; onDelete: () => void; onClose: () => void }) {
  const [f, setF] = useState({
    kind: node.kind, qEn: node.questionEn || '', qHi: node.questionHi || '', aEn: node.answerEn || '', aHi: node.answerHi || '',
    lEn: node.linkLabelEn || '', lHi: node.linkLabelHi || '', href: node.linkHref || '', agent: node.needsAgent,
  })
  const set = (k: string, v: any) => setF(s => ({ ...s, [k]: v }))
  const isRoot = node.id === 'root'
  return (
    <div className="gm-ed">
      <div className="gm-edhead"><b>{isRoot ? 'Start' : node.kind === 'menu' ? 'Question' : 'Answer'}</b><button onClick={onClose} aria-label="Close">×</button></div>
      <div className="gm-sub">{outs} option{outs === 1 ? '' : 's'} out · {ins} in</div>
      {!isRoot && (
        <div className="gm-seg">
          <button className={f.kind === 'menu' ? 'on' : ''} onClick={() => set('kind', 'menu')}>Question</button>
          <button className={f.kind === 'answer' ? 'on' : ''} onClick={() => set('kind', 'answer')}>Answer</button>
        </div>
      )}
      {f.kind === 'menu' ? (
        <>
          {isRoot ? <p className="gm-sub">The greeting at the start is set in code (it uses the student name).</p> : <>
            <label>Question (English)<textarea rows={3} value={f.qEn} maxLength={300} onChange={e => set('qEn', e.target.value)} /></label>
            <label>Question (Hinglish)<textarea rows={3} value={f.qHi} maxLength={300} onChange={e => set('qHi', e.target.value)} /></label></>}
        </>
      ) : (
        <>
          <label>Answer (English)<textarea rows={7} value={f.aEn} maxLength={3000} onChange={e => set('aEn', e.target.value)} /></label>
          <label>Answer (Hinglish)<textarea rows={7} value={f.aHi} maxLength={3000} onChange={e => set('aHi', e.target.value)} /></label>
          <label>Button link (optional, / or https://)<input value={f.href} onChange={e => set('href', e.target.value)} placeholder="/profile" /></label>
          {f.href && <><label>Button text (English)<input value={f.lEn} maxLength={80} onChange={e => set('lEn', e.target.value)} /></label>
            <label>Button text (Hinglish)<input value={f.lHi} maxLength={80} onChange={e => set('lHi', e.target.value)} /></label></>}
          <label className="gm-check"><input type="checkbox" checked={f.agent} onChange={e => set('agent', e.target.checked)} /> Only the team can fix this (skip &quot;Did this solve it?&quot; and offer the agent)</label>
        </>
      )}
      <div className="gm-row">
        {!isRoot && <button className="gm-danger" onClick={onDelete} disabled={busy}>Delete</button>}
        <button className="gm-primary" disabled={busy || isRoot && f.kind !== 'menu'} onClick={() => onSave(
          isRoot ? {} : f.kind === 'menu'
            ? { kind: 'menu', questionEn: f.qEn, questionHi: f.qHi, needsAgent: false }
            : { kind: 'answer', answerEn: f.aEn, answerHi: f.aHi, linkHref: f.href, linkLabelEn: f.lEn, linkLabelHi: f.lHi, needsAgent: f.agent }
        )}>Save</button>
      </div>
    </div>
  )
}

function EdgeEditor({ edge, from, to, busy, onSave, onDelete, onClose }: { edge: E; from?: N; to?: N; busy: boolean; onSave: (en: string, hi: string) => void; onDelete: () => void; onClose: () => void }) {
  const [en, setEn] = useState(edge.labelEn)
  const [hi, setHi] = useState(edge.labelHi)
  return (
    <div className="gm-ed">
      <div className="gm-edhead"><b>Option button</b><button onClick={onClose} aria-label="Close">×</button></div>
      <div className="gm-sub">{(from ? textOf(from) : '').slice(0, 50)} <b>→</b> {(to ? textOf(to) : '').slice(0, 50)}</div>
      <label>Button text (English)<input value={en} maxLength={80} onChange={e => setEn(e.target.value)} /></label>
      <label>Button text (Hinglish)<input value={hi} maxLength={80} onChange={e => setHi(e.target.value)} /></label>
      <p className="gm-sub">To point this button at a different card, drag the blue dot at the end of the arrow onto it.</p>
      <div className="gm-row">
        <button className="gm-danger" onClick={onDelete} disabled={busy}>Remove link</button>
        <button className="gm-primary" disabled={busy || !en.trim()} onClick={() => onSave(en, hi)}>Save</button>
      </div>
    </div>
  )
}

const CSS = `
.gm-root{position:relative;display:flex;flex-direction:column;height:calc(100vh - 110px);min-height:520px;margin:-8px;border:1px solid var(--border,#2a2a2e);border-radius:14px;overflow:hidden;background:var(--background,#0b0b0d);color:var(--text-primary,#f4f4f5)}
.gm-bar{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border,#2a2a2e);flex-wrap:wrap;background:var(--surface,#111113);z-index:5}
.gm-title{font-weight:800;font-size:15px;margin-right:6px}
.gm-search{width:260px;max-width:100%;padding:7px 12px;border-radius:50px;border:1px solid var(--border,#2a2a2e);background:var(--surface-2,#18181b);color:inherit;font:inherit;font-size:13px}
.gm-count{font-size:12px;color:var(--text-secondary,#a1a1aa)}
.gm-spacer{flex:1}
.gm-bar button,.gm-card button,.gm-ed button{font:inherit;font-size:12.5px;font-weight:700;padding:7px 12px;border-radius:50px;cursor:pointer;border:1px solid var(--border,#2a2a2e);background:var(--surface-2,#18181b);color:inherit}
.gm-bar button:hover,.gm-ed button:hover{border-color:#2563eb}
.gm-bar button:disabled,.gm-ed button:disabled,.gm-card button:disabled{opacity:.5;cursor:not-allowed}
.gm-primary{background:#2563eb!important;border-color:#2563eb!important;color:#fff!important}
.gm-danger{color:#f87171!important}
.gm-canvas{position:relative;flex:1;overflow:hidden;cursor:grab;touch-action:none;background-image:radial-gradient(circle,rgba(255,255,255,.07) 1px,transparent 1px);background-size:26px 26px}
.gm-canvas:active{cursor:grabbing}
.gm-world{position:absolute;left:0;top:0;transform-origin:0 0}
.gm-svg{position:absolute;left:0;top:0;pointer-events:none}
.gm-svg path{pointer-events:none}
.gm-node{position:absolute;box-sizing:border-box;padding:10px 12px;border-radius:14px;background:var(--surface,#161618);border:1.5px solid var(--border,#34343a);cursor:grab;user-select:none;overflow:visible}
.gm-node.answer{border-color:#166534;background:color-mix(in srgb,#16a34a 8%,var(--surface,#161618))}
.gm-node.root{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.25)}
.gm-node.sel{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.45)}
.gm-node.hit{outline:3px solid #f59e0b;outline-offset:2px}
.gm-tag{display:flex;gap:6px;align-items:center;font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--text-muted,#71717a);margin-bottom:5px}
.gm-n{margin-left:auto;font-size:10.5px;padding:1px 7px;border-radius:50px;background:var(--surface-2,#222);color:var(--text-secondary,#a1a1aa)}
.gm-n.full{background:#7c2d12;color:#fed7aa}
.gm-agent{padding:1px 7px;border-radius:50px;background:#1e3a8a;color:#bfdbfe;letter-spacing:0}
.gm-warn{padding:1px 7px;border-radius:50px;background:#7f1d1d;color:#fecaca;letter-spacing:0}
.gm-text{font-size:12.5px;line-height:1.4;font-weight:600;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden;word-break:break-word}
.gm-node.menu .gm-text{-webkit-line-clamp:3}
.gm-handle{position:absolute;right:-9px;top:50%;margin-top:-9px;width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid var(--background,#0b0b0d);cursor:crosshair}
.gm-handle:hover{transform:scale(1.25)}
.gm-endknob{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#2563eb;border:3px solid var(--background,#0b0b0d);cursor:crosshair;z-index:3}
.gm-elabel{position:absolute;transform:translate(-50%,-50%);max-width:210px;padding:3px 10px;border-radius:50px;font-size:11px;font-weight:700;white-space:nowrap;background:var(--surface-2,#222226);border:1px solid var(--border,#3a3a40);color:var(--text-secondary,#d4d4d8);cursor:pointer;z-index:2}
.gm-elabel.on{background:#2563eb;border-color:#2563eb;color:#fff}
.gm-hint{position:absolute;left:12px;bottom:10px;font-size:11.5px;color:var(--text-muted,#71717a);background:var(--surface,#111113);padding:5px 10px;border-radius:50px;border:1px solid var(--border,#2a2a2e);pointer-events:none}
.gm-msg{padding:40px;text-align:center;color:var(--text-secondary,#a1a1aa)}.gm-msg.err{color:#fca5a5}
.gm-toast{position:absolute;left:50%;bottom:48px;transform:translateX(-50%);padding:9px 16px;border-radius:50px;background:#111;color:#fff;font-size:13px;font-weight:600;z-index:20;border:1px solid #333}
.gm-panel{position:absolute;right:0;top:57px;bottom:0;width:340px;max-width:92%;overflow:auto;background:var(--surface,#111113);border-left:1px solid var(--border,#2a2a2e);padding:14px;z-index:10}
.gm-ed{display:flex;flex-direction:column;gap:10px}
.gm-edhead{display:flex;justify-content:space-between;align-items:center;font-size:14px}
.gm-sub{font-size:12px;color:var(--text-secondary,#a1a1aa);margin:0;line-height:1.45}
.gm-ed label,.gm-card label{display:flex;flex-direction:column;gap:4px;font-size:11.5px;font-weight:700;color:var(--text-secondary,#a1a1aa)}
.gm-ed textarea,.gm-ed input[type=text],.gm-ed input:not([type]),.gm-card input{font:inherit;font-size:13px;font-weight:500;padding:8px 10px;border-radius:10px;border:1px solid var(--border,#2a2a2e)!important;background:var(--surface-2,#18181b)!important;color:var(--text-primary,#fff)!important;resize:vertical;box-sizing:border-box;width:100%}
.gm-check{flex-direction:row!important;align-items:flex-start;gap:8px!important;font-weight:600!important}
.gm-row{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}
.gm-seg{display:flex;gap:6px}.gm-seg button.on{background:#2563eb;border-color:#2563eb;color:#fff}
.gm-modal{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:30}
.gm-card{width:380px;max-width:92%;padding:18px;border-radius:16px;background:var(--surface,#161618);border:1px solid var(--border,#2a2a2e);display:flex;flex-direction:column;gap:10px}
.gm-card h3{margin:0;font-size:15px}
`
