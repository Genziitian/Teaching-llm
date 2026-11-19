'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { GENIE_MAX_MESSAGE, GENIE_NAME, GENIE_TREE, UI } from '@/lib/genie/tree'
import type { GenieLang, GenieNode, L } from '@/lib/genie/tree'
import { MAX_IMAGE_BYTES, POLL_MS, SEND_GAP_MS } from '@/lib/genie/limits'
import { isSupportOpen } from '@/lib/support-limits'
import { startSupportCall } from '@/components/support/SupportCall'

/**
 * Genie — guided support helper in the bottom-right corner.
 * Lives in the dashboard layout, so the open chat follows the student from page to page.
 * Tap-through answers (English / Hinglish), WhatsApp button, and live chat with an agent
 * (waiting → live → moved to ticket / ended). The agent's name is never shown.
 */

type Stage = 'lang' | 'browse' | 'solved' | 'handoff' | 'describe' | 'callback' | 'closed'
interface Msg { from: 'bot' | 'me'; text: L; link?: { label: L; href: string } }
interface StackItem { id: string; msgLen: number; chosen?: L }
interface AgentSession {
  id: string
  status: 'WAITING' | 'LIVE' | 'TICKET' | 'ENDED'
  joinedAt: string | null
  rating: number | null
  ticket: { id: string; no: number; status: string } | null
}
interface AgentMsg { id: string; from: 'me' | 'agent'; content: string; imageUrl: string | null; at: string }

const STORE_KEY = 'genie-chat-v1'
const LANG_KEY = 'genie-lang'
const HELLO_KEY = 'genie-hello-seen-v1'
const REQ_KEY = 'genie-req-v1'

// Index every node by id so a saved chat can be restored.
function indexTree(root: GenieNode): Record<string, GenieNode> {
  const map: Record<string, GenieNode> = {}
  ;(function walk(n: GenieNode) {
    map[n.id] = n
    n.options?.forEach(o => walk(o.next))
  })(root)
  return map
}

const fill = (l: L, vars: Record<string, string | number>): L => {
  const f = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
  return { en: f(l.en), hi: f(l.hi) }
}

function isHidden(pathname: string): boolean {
  if (pathname === '/community' || pathname.startsWith('/community/')) return true
  if (pathname.startsWith('/materials/recordings')) return true
  if (/^\/courses\/[^/]+\/lectures\/[^/]+/.test(pathname)) return true
  return false
}

function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
    if (!/^https?:\/\//.test(part)) return part
    const url = part.replace(/[.,;:!?)]+$/, '')
    const tail = part.slice(url.length)
    return (
      <span key={i}>
        <a href={url} target="_blank" rel="noopener noreferrer" className="genie-a">{url.replace(/^https?:\/\//, '')}</a>
        {tail}
      </span>
    )
  })
}

function softBeep() {
  try {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!C) return
    const c = new C(), o = c.createOscillator(), g = c.createGain()
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.04
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.15)
    window.setTimeout(() => c.close?.(), 400)
  } catch {}
}

function Sparkle({ size = 24 }: { size?: number }) {
  // Robot face — Genie is a bot
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="3" x2="12" y2="6.5" />
      <circle cx="12" cy="2.6" r="1" />
      <rect x="4" y="6.5" width="16" height="12" rx="4" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      <line x1="9.5" y1="15.4" x2="14.5" y2="15.4" />
      <line x1="2" y1="11" x2="2" y2="14" />
      <line x1="22" y1="11" x2="22" y2="14" />
    </svg>
  )
}

export default function GenieWidget({ userRole, userName }: { userRole: string; userName?: string }) {
  const pathname = usePathname() || ''
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isNative, setIsNative] = useState(false)
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<GenieLang>('en')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [stage, setStage] = useState<Stage>('browse')
  const [stack, setStack] = useState<StackItem[]>([{ id: 'root', msgLen: 1 }])
  const [leafId, setLeafId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [hello, setHello] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<L | string | null>(null)
  const [pendingImg, setPendingImg] = useState<string | null>(null)
  const [agent, setAgent] = useState<AgentSession | null>(null)
  const [agentMsgs, setAgentMsgs] = useState<AgentMsg[]>([])
  const [rated, setRated] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const lastSend = useRef(0)
  const reqId = useRef<string | null>(null)
  const seenAgent = useRef<number | null>(null)
  const prevStatus = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const hiddenRole = userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'MODERATOR'
  const t = useCallback((l: L) => l[lang], [lang])
  const en = (l: L) => l.en // buttons and labels (close, send, start over, footer…) stay English
  const firstName = (userName || '').trim().split(/\s+/)[0] || 'there'
  const langChosen = useRef(false)
  const [ticketMode, setTicketMode] = useState(false)
  const [callDay, setCallDay] = useState<0 | 1>(0)
  const [callAt, setCallAt] = useState('') // ISO time picked in the call-back list
  // The question/answer tree: built-in first, then the live one from the database (editable by managers)
  const [tree, setTree] = useState<GenieNode>(GENIE_TREE)
  const NODES = useMemo(() => indexTree(tree), [tree])
  const agentActive = !!agent && (agent.status === 'WAITING' || agent.status === 'LIVE')
  const agentEnded = !!agent && agent.status === 'ENDED' && (agent.rating == null || rated) && reqId.current === agent.id

  const greet = useCallback(() => fill(UI.greeting, { name: firstName }), [firstName])

  // Every new chat starts by asking the language; the last choice only sets the default UI text.
  const resetChat = useCallback(() => {
    setTicketMode(false)
    setMsgs([{ from: 'bot', text: UI.pickLang }])
    setStage('lang')
    setStack([{ id: 'root', msgLen: 1 }])
    setLeafId(null); setDraft(''); setPendingImg(null); setNotice(null)
  }, [greet])

  // ── start-up: restore language + the chat in progress ──
  useEffect(() => {
    setMounted(true)
    setIsNative(
      document.documentElement.classList.contains('is-native') ||
      !!(window as any).Capacitor?.isNativePlatform?.()
    )
    try { const l = localStorage.getItem(LANG_KEY); if (l === 'en' || l === 'hi') { setLang(l); langChosen.current = true } } catch {}
    try { reqId.current = sessionStorage.getItem(REQ_KEY) } catch {}
    let restored = false
    try {
      const raw = sessionStorage.getItem(STORE_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (Array.isArray(s.msgs) && s.msgs.length && !s.msgs.some((m: any) => m.kind === 'langAsk') && Array.isArray(s.stack) && s.stack.every((x: StackItem) => NODES[x.id])) {
          setMsgs(s.msgs); setStack(s.stack)
          setStage(s.stage === 'lang' || s.stage === 'solved' || s.stage === 'handoff' || s.stage === 'describe' || s.stage === 'callback' || s.stage === 'closed' ? s.stage : 'browse')
          setLeafId(s.leafId && NODES[s.leafId] ? s.leafId : null)
          setOpen(!!s.open)
          restored = true
        }
      }
    } catch {}
    if (!restored) resetChat()
  }, [resetChat])

  useEffect(() => {
    if (!mounted) return
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ open, msgs, stack, stage, leafId })) } catch {}
  }, [mounted, open, msgs, stack, stage, leafId])


  function setReq(id: string | null) {
    reqId.current = id
    try { id ? sessionStorage.setItem(REQ_KEY, id) : sessionStorage.removeItem(REQ_KEY) } catch {}
  }

  // ── live-chat polling ──
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/genie/session', { cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json()
      setAgent(d.session || null)
      setAgentMsgs(Array.isArray(d.messages) ? d.messages : [])
      setLoaded(true)
    } catch {}
  }, [])

  const polling = mounted && !hiddenRole && !isNative && !isHidden(pathname)
  useEffect(() => {
    if (!polling) return
    void refresh()
    const ms = agentActive ? POLL_MS : open ? 10000 : 30000
    const id = window.setInterval(() => { if (!document.hidden) void refresh() }, ms)
    return () => window.clearInterval(id)
  }, [polling, agentActive, open, refresh])

  // live tree from the database (falls back silently to the built-in one)
  useEffect(() => {
    if (!polling) return
    let dead = false
    fetch('/api/genie/tree', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!dead && d?.tree?.id === 'root' && Array.isArray(d.tree.options)) setTree(d.tree) })
      .catch(() => {})
    return () => { dead = true }
  }, [polling])

  // if the tree changed under an open chat and its path no longer exists, start the menu again
  useEffect(() => {
    if (stack.some(x => !NODES[x.id])) resetChat()
  }, [NODES]) // eslint-disable-line react-hooks/exhaustive-deps

  // status transitions
  useEffect(() => {
    if (!loaded) return
    const st = agent?.status || null
    const prev = prevStatus.current
    prevStatus.current = st
    if (agent && (st === 'WAITING' || st === 'LIVE') && reqId.current !== agent.id) setReq(agent.id)
    if (st === 'LIVE' && prev === 'WAITING' && !open) { softBeep(); setOpen(true) }
    if (reqId.current && (!agent || (agent.id === reqId.current && st === 'TICKET'))) {
      const tk = agent?.ticket
      setReq(null)
      if (tk?.no) {
        setMsgs(m => [...m, { from: 'bot', text: fill(UI.movedTicket, { n: tk.no }), link: { label: UI.viewTicket, href: `/support?ticket=${tk.id}` } }])
        setStage('closed')
      } else resetChat()
    }
  }, [agent, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // new agent message while the box is closed → soft sound + reopen
  useEffect(() => {
    const count = agentMsgs.filter(m => m.from === 'agent').length
    if (seenAgent.current === null) { seenAgent.current = count; return }
    if (count > seenAgent.current && agent?.status === 'LIVE' && !open) { softBeep(); setOpen(true) }
    seenAgent.current = count
  }, [agentMsgs]) // eslint-disable-line react-hooks/exhaustive-deps

  // One-time hello bubble
  useEffect(() => {
    if (!mounted || open || hiddenRole || isNative) return
    let seen = false
    try { seen = localStorage.getItem(HELLO_KEY) === '1' } catch {}
    if (seen) return
    const show = window.setTimeout(() => setHello(true), 2500)
    const hide = window.setTimeout(() => dismissHello(), 2500 + 9000)
    return () => { window.clearTimeout(show); window.clearTimeout(hide) }
  }, [mounted, open, hiddenRole, isNative]) // eslint-disable-line react-hooks/exhaustive-deps

  function dismissHello() {
    setHello(false)
    try { localStorage.setItem(HELLO_KEY, '1') } catch {}
  }

  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }) }, [msgs, stage, open, agentMsgs, agent?.status])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus({ preventScroll: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const node = NODES[stack[stack.length - 1].id] || NODES.root

  // The Support page's "Raise a ticket" button opens GenZie; tickets are only created from the bot's hand-off.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('genie:open', onOpen)
    return () => window.removeEventListener('genie:open', onOpen)
  }, [])

  // ── actions ──
  function chooseLang(l: GenieLang) {
    langChosen.current = true
    // Messages already on screen keep the language they were shown in; only new ones use the choice.
    const freeze = (x: L): L => ({ en: x[lang], hi: x[lang] })
    setMsgs(m => m.map(x => ({ ...x, text: freeze(x.text), ...(x.link ? { link: { ...x.link, label: freeze(x.link.label) } } : {}) })))
    setLang(l)
    try { localStorage.setItem(LANG_KEY, l) } catch {}
    const label: L = l === 'en' ? { en: 'English', hi: 'English' } : { en: 'Hinglish', hi: 'Hinglish' }
    const g = greet()
    setMsgs(m => [...m, { from: 'me', text: label }, { from: 'bot', text: g }])
    setStack([{ id: 'root', msgLen: msgs.length + 2 }])
    setStage('browse')
  }

  function choose(i: number) {
    const opt = node.options?.[i]
    if (!opt) return
    const next = opt.next
    const add: Msg[] = [{ from: 'me', text: opt.label }]
    if (next.options) {
      add.push({ from: 'bot', text: next.q || greet() })
      setStack(s => [...s, { id: next.id, msgLen: msgs.length, chosen: opt.label }])
      setMsgs(m => [...m, ...add])
      return
    }
    add.push({ from: 'bot', text: next.answer || UI.glad, link: next.link })
    setStack(s => [...s, { id: next.id, msgLen: msgs.length, chosen: opt.label }])
    setLeafId(next.id)
    if (next.needsAgent) {
      add.push({ from: 'bot', text: UI.needHuman })
      setStage('handoff')
    } else {
      add.push({ from: 'bot', text: UI.solved })
      setStage('solved')
    }
    setMsgs(m => [...m, ...add])
  }

  function goBack() {
    if (stack.length < 2) return
    const top = stack[stack.length - 1]
    setMsgs(m => m.slice(0, top.msgLen))
    setStack(s => s.slice(0, -1))
    setStage('browse'); setLeafId(null); setDraft('')
  }

  function answerSolved(ok: boolean) {
    if (ok) {
      const next: Msg[] = [...msgs, { from: 'me', text: UI.yes }, { from: 'bot', text: UI.glad }, { from: 'bot', text: greet() }]
      setMsgs(next)
      setStack([{ id: 'root', msgLen: next.length }])
      setStage('browse'); setLeafId(null)
    } else {
      setMsgs(m => [...m, { from: 'me', text: UI.no }, { from: 'bot', text: UI.needHuman }])
      setStage('handoff')
    }
  }

  function startAgent() {
    setTicketMode(false)
    setMsgs(m => [...m, { from: 'me', text: UI.agentHere }, { from: 'bot', text: UI.describe }])
    setStage('describe')
  }

  /** Outside team hours (or for proof-type problems): the description is saved straight as a ticket. */
  function startMessage() {
    setTicketMode(true)
    setMsgs(m => [...m, { from: 'me', text: UI.leaveMsg }, { from: 'bot', text: UI.describeTicket }])
    setStage('describe')
  }

  /** Live call during support hours: rings every manager (web + native ring on their phones). */
  function callNow() {
    setMsgs(m => [...m, { from: 'me', text: UI.callNow }, { from: 'bot', text: UI.calling }])
    setStage('closed')
    setOpen(false)
    startSupportCall()
  }

  function startCallBack() {
    setMsgs(m => [...m, { from: 'me', text: UI.callBack }, { from: 'bot', text: UI.callAsk }])
    setNotice(null); setCallAt(''); setCallDay(callTimes(0).length ? 0 : 1)
    setStage('callback')
  }

  const whenLabel = (d: Date) => {
    const day = new Date(); day.setHours(0, 0, 0, 0)
    const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - day.getTime()) / 86400000)
    const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    const dayName = diff === 0 ? (lang === 'hi' ? 'Aaj' : 'Today') : diff === 1 ? (lang === 'hi' ? 'Kal' : 'Tomorrow') : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    return `${dayName}, ${time}`
  }

  async function bookCall(when: Date) {
    if (busy) return
    const h = when.getHours() + when.getMinutes() / 60
    if (h < 10 || h > 22) { setNotice(UI.callHours); return }
    setBusy(true); setNotice(null)
    try {
      const topic = stack.slice(1).map(x => x.chosen?.en).filter(Boolean).join(' › ')
      const res = await fetch('/api/support/calls', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'SCHEDULED', scheduledFor: when.toISOString(), reason: `Call back requested from GenZie${topic ? `: ${topic}` : ''}`.slice(0, 500) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error || `Error ${res.status}`)
      const label = whenLabel(when)
      setMsgs(m => [...m, { from: 'me', text: { en: label, hi: label } }, { from: 'bot', text: fill(UI.callDone, { t: label }), link: { label: UI.goSupport, href: '/support' } }])
      setStage('closed')
    } catch (e) {
      setNotice(fill(UI.callFail, { e: e instanceof Error ? e.message : 'error' }))
    } finally { setBusy(false) }
  }

  // Call-back times every 15 min, 10:00 AM – 9:45 PM, for today (day 0) or tomorrow (day 1).
  // Today only lists times at least 15 minutes from now.
  function callTimes(day: 0 | 1): Date[] {
    const out: Date[] = []
    const earliest = Date.now() + 15 * 60000
    const d = new Date(); d.setDate(d.getDate() + day); d.setHours(10, 0, 0, 0)
    const end = new Date(d); end.setHours(21, 45, 0, 0)
    for (; d <= end; d.setMinutes(d.getMinutes() + 15)) if (d.getTime() >= earliest) out.push(new Date(d))
    return out
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > MAX_IMAGE_BYTES) { setNotice(UI.photoBad); return }
    setBusy(true); setNotice(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/genie/upload', { method: 'POST', body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) throw new Error(d?.error || 'Upload failed')
      setPendingImg(d.url)
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Upload failed') }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function submit() {
    const text = draft.trim()
    if ((!text && !pendingImg) || busy) return
    if (text.length > GENIE_MAX_MESSAGE) { setNotice(fill(UI.tooLong, { n: GENIE_MAX_MESSAGE })); return }
    if (Date.now() - lastSend.current < SEND_GAP_MS) { setNotice(UI.slowDown); return }
    lastSend.current = Date.now()
    setBusy(true); setNotice(null)
    try {
      let res: Response
      if (agentActive) {
        res = await fetch('/api/genie/message', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, imageUrl: pendingImg }),
        })
      } else {
        const tried = stack.slice(1).map(s => s.chosen?.en).filter(Boolean).join(' › ')
        const said = leafId ? NODES[leafId]?.answer?.en : ''
        const context = (tried ? `Path: ${tried}\n` : '') + (said ? `Genie told the student: ${said}\n` : '') + 'Student asked for an agent.'
        res = await fetch('/api/genie/request', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, imageUrl: pendingImg, context, ticketNow: ticketMode }),
        })
      }
      const d = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 409) throw new Error(d?.error || `Error ${res.status}`)
      if (!agentActive && d?.id) setReq(d.id)
      setDraft(''); setPendingImg(null)
      await refresh()
    } catch (e) {
      setNotice(fill(UI.ticketFail, { e: e instanceof Error ? e.message : 'error' }))
    } finally { setBusy(false) }
  }

  async function rate(v: 1 | -1) {
    if (!agent) return
    setRated(true)
    try {
      await fetch('/api/genie/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: agent.id, rating: v }) })
    } catch {}
    window.setTimeout(() => { setReq(null); setRated(false); setAgent(null); setAgentMsgs([]); resetChat(); void refresh() }, 1400)
  }

  const options = useMemo(() => (stage === 'browse' && !agentActive && !agentEnded ? node.options || [] : []), [stage, node, agentActive, agentEnded])

  if (!mounted || hiddenRole || isNative || isHidden(pathname)) return null

  const pinned = agent && agent.status === 'TICKET' && agent.ticket ? agent.ticket : null
  const joinedIdx = agent?.joinedAt ? (() => {
    const j = agentMsgs.findIndex(m => +new Date(m.at) >= +new Date(agent.joinedAt!))
    return j === -1 ? agentMsgs.length : j
  })() : -1
  const composerOn = (stage === 'describe' && !agentEnded) || agentActive

  return (
    <>
      <style>{CSS}</style>

      {open && (
        <div ref={panelRef} tabIndex={-1} role="dialog" aria-label={`${GENIE_NAME} support chat`} className="genie-panel">
          <div className="genie-head">
            <span className="genie-avatar"><Sparkle size={18} /></span>
            <div className="genie-title">{GENIE_NAME} <span className="genie-title-sub">the BOT</span></div>
            <button type="button" className="genie-x" onClick={() => setOpen(false)} aria-label={en(UI.close)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          {pinned && (
            <Link href={`/support?ticket=${pinned.id}`} className="genie-pin" onClick={() => setOpen(false)}>
              <span>{t(fill(UI.continueChat, { n: pinned.no }))}</span><span aria-hidden="true">→</span>
            </Link>
          )}

          <div ref={bodyRef} className="genie-body" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`genie-row ${m.from}`}>
                <div className={`genie-bubble ${m.from}`}>
                  {m.link && m.link.href.startsWith('http') && (
                    <a href={m.link.href} target="_blank" rel="noopener noreferrer" className="genie-go" style={{ marginTop: 0, marginBottom: 8 }}>{t(m.link.label)} →</a>
                  )}
                  {linkify(t(m.text))}
                  {m.link && !m.link.href.startsWith('http') && (
                    <Link href={m.link.href} className="genie-go">{t(m.link.label)} →</Link>
                  )}
                </div>
              </div>
            ))}

            {(agentActive || agentEnded) && agentMsgs.map((m, i) => (
              <div key={m.id}>
                {i === joinedIdx && <div className="genie-sys">{t(UI.joined)}</div>}
                <div className={`genie-row ${m.from === 'me' ? 'me' : 'bot'}`}>
                  <div className={`genie-bubble ${m.from === 'me' ? 'me' : 'bot'}`}>
                    {m.content && linkify(m.content)}
                    {m.imageUrl && (
                      <a href={m.imageUrl} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.imageUrl} alt="attachment" className="genie-img" loading="lazy" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(agentActive || agentEnded) && joinedIdx === agentMsgs.length && agent?.joinedAt && <div className="genie-sys">{t(UI.joined)}</div>}
            {agent?.status === 'WAITING' && <div className="genie-sys wait"><span className="genie-dots" aria-hidden="true" />{t(UI.connecting)}</div>}

            {agentEnded && (
              <div className="genie-sys end">
                <div>{t(UI.chatEnded)}</div>
                {rated ? <div className="genie-thanks">{t(UI.thanks)}</div> : (
                  <>
                    <div className="genie-rate-q">{t(UI.rateAsk)}</div>
                    <div className="genie-opts row" style={{ justifyContent: 'center' }}>
                      <button type="button" className="genie-opt ok" onClick={() => void rate(1)} aria-label="Helpful">👍</button>
                      <button type="button" className="genie-opt" onClick={() => void rate(-1)} aria-label="Not helpful">👎</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {stage === 'lang' && !agentActive && !agentEnded && (
              <div className="genie-opts">
                <button type="button" className="genie-opt" onClick={() => chooseLang('en')}>English</button>
                <button type="button" className="genie-opt" onClick={() => chooseLang('hi')}>Hinglish</button>
              </div>
            )}

            {options.length > 0 && (
              <div className="genie-opts">
                {options.map((o, i) => (
                  <button key={o.id} type="button" className={o.id === 'g-iitm' ? 'genie-opt tab' : 'genie-opt'} onClick={() => choose(i)}>{t(o.label)}</button>
                ))}
              </div>
            )}

            {stage === 'solved' && !agentActive && !agentEnded && (
              <div className="genie-opts row">
                <button type="button" className="genie-opt ok" onClick={() => answerSolved(true)}>{t(UI.yes)}</button>
                <button type="button" className="genie-opt" onClick={() => answerSolved(false)}>{t(UI.no)}</button>
              </div>
            )}

            {stage === 'handoff' && !agentActive && !agentEnded && (() => {
              // Who gets what: problems that need screenshots / payment proof go to chat or a ticket;
              // everything else can be sorted on a call. Live options only during team hours (10 AM – 10 PM IST).
              const open = isSupportOpen()
              const proof = !!leafId && (leafId.startsWith('pay.') || leafId === 'course.not-visible')
              return (
                <div className="genie-cards">
                  {open && !proof && (
                  <button type="button" className="genie-card" onClick={callNow}>
                    <span className="genie-card-ico" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94" /><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
                    </span>
                    <span><b>{t(UI.callNow)}</b><small>{t(UI.callNowSub)}</small></span>
                  </button>
                  )}
                  {open && (
                  <button type="button" className="genie-card" onClick={startAgent}>
                    <span className="genie-card-ico" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    </span>
                    <span><b>{t(UI.agentHere)}</b><small>{t(UI.agentHereSub)}</small></span>
                  </button>
                  )}
                  {!proof && (
                  <button type="button" className="genie-card" onClick={startCallBack}>
                    <span className="genie-card-ico" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
                    </span>
                    <span><b>{t(UI.callBack)}</b><small>{t(UI.callBackSub)}</small></span>
                  </button>
                  )}
                  {(!open || proof) && (
                  <button type="button" className="genie-card" onClick={startMessage}>
                    <span className="genie-card-ico" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                    </span>
                    <span><b>{t(UI.leaveMsg)}</b><small>{t(UI.leaveMsgSub)}</small></span>
                  </button>
                  )}
                </div>
              )
            })()}

            {stage === 'callback' && !agentActive && !agentEnded && (() => {
              const today = callTimes(0)
              const times = callDay === 0 ? today : callTimes(1)
              const dayName = (n: 0 | 1) => n === 0 ? (lang === 'hi' ? 'Aaj' : 'Today') : (lang === 'hi' ? 'Kal' : 'Tomorrow')
              return (
                <div className="genie-cards">
                  <div className="genie-days" role="tablist" aria-label="Day">
                    {([0, 1] as const).map(n => {
                      const d = new Date(); d.setDate(d.getDate() + n)
                      return (
                        <button key={n} type="button" role="tab" aria-selected={callDay === n} className={callDay === n ? 'on' : ''}
                          disabled={n === 0 && today.length === 0} onClick={() => { setCallDay(n); setCallAt(''); setNotice(null) }}>
                          {dayName(n)}<small>{d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small>
                        </button>
                      )
                    })}
                  </div>
                  <div className="genie-times" role="listbox" aria-label="Time">
                    {times.map(d => {
                      const iso = d.toISOString()
                      return (
                        <button key={iso} type="button" role="option" aria-selected={callAt === iso} className={callAt === iso ? 'on' : ''}
                          onClick={() => { setCallAt(iso); setNotice(null) }}>
                          {d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                        </button>
                      )
                    })}
                  </div>
                  <button type="button" className="genie-send genie-book" disabled={!callAt || busy} onClick={() => void bookCall(new Date(callAt))}>
                    {busy ? en(UI.sending) : callAt ? `${en(UI.callConfirm)} · ${whenLabel(new Date(callAt))}` : en(UI.callConfirm)}
                  </button>
                  {notice && <div className="genie-notice">{typeof notice === 'string' ? notice : t(notice)}</div>}
                </div>
              )
            })()}
          </div>

          {composerOn && (
            <div className="genie-compose">
              {pendingImg && (
                <div className="genie-chip">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pendingImg} alt="" />
                  <button type="button" onClick={() => setPendingImg(null)} aria-label="Remove photo">×</button>
                </div>
              )}
              {notice && <div className="genie-notice">{typeof notice === 'string' ? notice : t(notice)}</div>}
              <textarea
                value={draft}
                maxLength={GENIE_MAX_MESSAGE}
                placeholder={en(UI.describePh)}
                rows={2}
                onChange={e => { setDraft(e.target.value); if (notice) setNotice(null) }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() } }}
                disabled={busy}
                aria-label={en(UI.describePh)}
              />
              <div className="genie-compose-row">
                <button type="button" className="genie-attach" onClick={() => fileRef.current?.click()} disabled={busy || !!pendingImg} aria-label={en(UI.attach)} title={en(UI.attach)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => void pickPhoto(e.target.files?.[0])} />
                <span className="genie-count">{draft.length}/{GENIE_MAX_MESSAGE}</span>
                <button type="button" className="genie-send" onClick={() => void submit()} disabled={(!draft.trim() && !pendingImg) || busy}>
                  {busy ? en(UI.sending) : en(UI.send)}
                </button>
              </div>
            </div>
          )}

          <div className="genie-foot">
            <div className="genie-nav">
              {stack.length > 1 && !agentActive && !agentEnded
                ? <button type="button" onClick={goBack}>← {en(UI.back)}</button> : <span />}
              {msgs.length > 1 && !agentActive && !agentEnded
                ? <button type="button" onClick={resetChat}>{en(UI.startOver)}</button> : <span />}
            </div>
            <div className="genie-note">{en(UI.mistakes)}</div>
          </div>
        </div>
      )}

      {!open && hello && (
        <div className="genie-hello" role="status">
          <button type="button" className="genie-hello-x" onClick={dismissHello} aria-label="Dismiss">×</button>
          <div className="genie-hello-t">{UI.hello.en}</div>
          <div className="genie-hello-s">{UI.helloSub.en}</div>
        </div>
      )}

      <button
        type="button"
        className="genie-fab"
        onClick={() => { setOpen(o => !o); if (hello) dismissHello() }}
        aria-label={open ? 'Close GenZie' : 'Ask GenZie'}
        aria-expanded={open}
      >
        {open
          ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
          : <Sparkle size={24} />}
        {!open && <span className="genie-fab-label">Ask GenZie</span>}
      </button>
    </>
  )
}

const CSS = `
.genie-fab{position:fixed;right:24px;bottom:24px;z-index:1000;width:52px;height:52px;border-radius:16px;border:1px solid var(--gz-line,#e7e7e3);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gz-panel,#fff);background:var(--gz-ink,#171717);box-shadow:0 4px 14px rgba(0,0,0,.18);transition:transform .15s}
.genie-fab:hover{transform:translateY(-2px)}
.genie-fab:focus-visible{outline:2px solid var(--gz-ink,#171717);outline-offset:3px}
.genie-fab-label{position:absolute;right:68px;white-space:nowrap;padding:7px 12px;border-radius:50px;font-size:12.5px;font-weight:700;background:var(--surface,#161618);color:var(--text-primary,#fff);border:1px solid var(--border,#2a2a2e);opacity:0;transform:translateX(6px);pointer-events:none;transition:opacity .15s,transform .15s}
@media (hover:hover){.genie-fab:hover .genie-fab-label{opacity:1;transform:none}}
/* Get out of the way while any modal / side panel is open over the page. */
body:has(.gz-notif,.modal-overlay,.manager-profile-overlay,[aria-modal="true"],[role="dialog"]:not(.genie-panel):not(.genie-hello)) :is(.genie-fab,.genie-hello){display:none}
.genie-hello{position:fixed;right:24px;bottom:92px;z-index:1000;max-width:230px;padding:12px 30px 12px 14px;border-radius:16px;background:var(--surface,#161618);color:var(--text-primary,#fff);border:1px solid var(--border,#2a2a2e);box-shadow:0 8px 24px rgba(0,0,0,.35);animation:genieIn .25s ease}
.genie-hello-t{font-size:13.5px;font-weight:800}
.genie-hello-s{font-size:12px;color:var(--text-secondary,#a1a1aa);margin-top:2px}
.genie-hello-x{position:absolute;top:6px;right:8px;background:none;border:none;color:var(--text-muted,#71717a);font-size:18px;line-height:1;cursor:pointer}
.genie-panel{--surface:#ffffff;--surface-2:#f3f4f8;--border:#e3e4ea;--text-primary:#17171c;--text-secondary:#555560;--text-muted:#8a8a96;position:fixed;right:24px;bottom:92px;z-index:1000;width:380px;max-width:calc(100vw - 24px);height:min(560px,calc(100vh - 120px));display:flex;flex-direction:column;border-radius:22px;overflow:hidden;background:var(--surface,#0f0f10);color:var(--text-primary,#f4f4f5);border:1px solid var(--border,#2a2a2e);box-shadow:0 16px 48px rgba(0,0,0,.35);animation:genieIn .2s ease;outline:none}
.genie-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border,#2a2a2e)}
.genie-avatar{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:var(--gz-panel,#fff);background:var(--gz-ink,#171717);flex-shrink:0}
.genie-title{font-size:14.5px;font-weight:800;flex:1}
.genie-title-sub{font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--gz-ink-3,#6b6b68);margin-left:2px}
.genie-x{border:none;background:none;color:var(--text-muted,#71717a);cursor:pointer;padding:6px;display:flex}
.genie-x:hover{color:var(--text-primary,#fff)}
.genie-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px}
.genie-row{display:flex}
.genie-row.me{justify-content:flex-end}
.genie-bubble{max-width:86%;padding:9px 12px;border-radius:16px;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.genie-bubble.bot{background:var(--surface-2);border:none;border-bottom-left-radius:5px}
.genie-bubble.me{background:var(--gz-ink,#171717);color:var(--gz-panel,#fff);border-bottom-right-radius:5px}
.genie-a{color:inherit;text-decoration:underline;text-underline-offset:2px;word-break:break-all}
.genie-go{display:inline-block;margin-top:8px;padding:6px 12px;border-radius:50px;font-size:12px;font-weight:700;text-decoration:none;background:var(--text-primary,#fff);color:var(--surface,#000)}
.genie-opts{display:flex;flex-direction:row;flex-wrap:wrap;gap:6px;margin-top:2px}
.genie-opts.row{flex-direction:row;flex-wrap:wrap}
.genie-opt{display:inline-block;text-align:left;text-decoration:none;font:inherit;font-size:13px;font-weight:500;line-height:1.3;padding:7px 12px;border-radius:10px;cursor:pointer;color:var(--gz-ink,#171717);background:var(--gz-panel,#fff);border:1px solid var(--gz-line,#e7e7e3);transition:background .12s,border-color .12s}
.genie-opt:hover{background:color-mix(in srgb,var(--gz-ink,#171717) 6%,transparent);border-color:var(--gz-ink,#171717)}
.genie-opt:focus-visible{outline:2px solid var(--gz-ink,#171717);outline-offset:2px}
.genie-opt.ok{border-color:#34d399;color:#047857}
.genie-opt.ok:hover{background:#ecfdf5}
.genie-opt.agent{border-color:var(--gz-ink,#171717);background:var(--gz-ink,#171717);color:var(--gz-panel,#fff)}
.genie-opt.tab{border-color:var(--gz-ink,#171717);background:var(--gz-ink,#171717);color:var(--gz-panel,#fff)}
.genie-opt.tab:hover{opacity:.88}
.genie-opt.agent:hover{opacity:.88}
.genie-opt.wa{border-color:#86efac;color:#15803d}
.genie-opt:disabled{opacity:.5;cursor:default}
.genie-cards{display:flex;flex-direction:column;gap:8px;margin-top:2px}
.genie-card{display:flex;align-items:center;gap:12px;width:100%;text-align:left;font:inherit;padding:12px 14px;border-radius:12px;cursor:pointer;background:var(--gz-panel,#fff);border:1px solid var(--gz-line,#e7e7e3);color:var(--gz-ink,#171717);transition:border-color .12s,background .12s}
.genie-card:hover{border-color:var(--gz-ink,#171717);background:color-mix(in srgb,var(--gz-ink,#171717) 6%,transparent)}
.genie-card:focus-visible{outline:2px solid var(--gz-ink,#171717);outline-offset:2px}
.genie-card b{display:block;font-size:13.5px;font-weight:600}
.genie-card small{display:block;font-size:12px;color:var(--gz-ink-3,#6b6b68);margin-top:2px}
.genie-card-ico{flex-shrink:0;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,var(--gz-ink,#171717) 6%,transparent);color:var(--gz-ink,#171717)}
.genie-days{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:12px;background:color-mix(in srgb,var(--gz-ink,#171717) 6%,transparent)}
.genie-days button{font:inherit;font-size:13px;font-weight:600;padding:7px 8px;border:none;border-radius:9px;background:transparent;color:var(--gz-ink-3,#6b6b68);cursor:pointer;display:flex;flex-direction:column;align-items:center;line-height:1.2}
.genie-days button small{font-size:11px;font-weight:500;color:var(--gz-ink-3,#6b6b68)}
.genie-days button.on{background:var(--gz-panel,#fff);color:var(--gz-ink,#171717);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.genie-days button:disabled{opacity:.4;cursor:default}
.genie-times{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-height:172px;overflow-y:auto;padding:2px}
.genie-times button{font:inherit;font-size:12.5px;font-weight:500;padding:8px 4px;border-radius:10px;border:1px solid var(--gz-line,#e7e7e3);background:var(--gz-panel,#fff);color:var(--gz-ink,#171717);cursor:pointer}
.genie-times button:hover{border-color:var(--gz-ink,#171717)}
.genie-times button.on{background:var(--gz-ink,#171717);border-color:var(--gz-ink,#171717);color:var(--gz-panel,#fff)}
.genie-book{width:100%;justify-content:center}
.genie-opt.wa:hover{background:#f0fdf4}
.genie-compose{padding:10px 12px 0;border-top:1px solid var(--border,#2a2a2e)}
.genie-compose textarea{width:100%;resize:none;box-sizing:border-box;background:var(--surface-2,#161618)!important;color:var(--text-primary,#fff)!important;border:1.5px solid var(--border,#2a2a2e)!important;border-radius:12px;padding:9px 11px;font:inherit;font-size:13px;line-height:1.5;outline:none}
.genie-compose textarea:focus{border-color:var(--gz-ink,#171717)!important;box-shadow:none!important}
.genie-compose-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0 2px}
.genie-count{font-size:11px;color:var(--text-muted,#71717a)}
.genie-send{border:none;border-radius:10px;padding:7px 16px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;color:var(--gz-panel,#fff);background:var(--gz-ink,#171717)}
.genie-send:disabled{opacity:.45;cursor:not-allowed}
.genie-foot{padding:4px 14px 8px}
.genie-nav{display:flex;justify-content:space-between;min-height:22px}
.genie-nav button{border:none;background:none;color:var(--text-secondary,#a1a1aa);font:inherit;font-size:12px;font-weight:700;cursor:pointer;padding:3px 0}
.genie-nav button:hover{color:var(--text-primary,#fff)}
.genie-note{text-align:center;font-size:10.5px;color:var(--text-muted,#71717a);margin-top:2px}
.genie-pin{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;font-size:12.5px;font-weight:800;text-decoration:none;color:var(--text-primary,#fff);background:rgba(37,99,235,.10);border-bottom:1px solid var(--border,#2a2a2e)}
.genie-sys{align-self:center;text-align:center;font-size:12px;color:var(--text-secondary,#a1a1aa);padding:6px 10px;margin:4px 0}
.genie-sys.end{border:1px dashed var(--border,#2a2a2e);border-radius:14px;padding:12px}
.genie-rate-q{margin:6px 0;font-weight:700;color:var(--text-primary,#fff)}
.genie-thanks{margin-top:6px;font-weight:700;color:#34d399}
.genie-dots{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gz-ink-3,#6b6b68);margin-right:8px;animation:geniePulse 1.2s ease-in-out infinite}
@keyframes geniePulse{0%,100%{opacity:.3}50%{opacity:1}}
.genie-img{display:block;max-width:100%;max-height:180px;border-radius:10px;margin-top:6px}
.genie-chip{position:relative;display:inline-block;margin-bottom:6px}
.genie-chip img{height:54px;width:54px;object-fit:cover;border-radius:10px;border:1px solid var(--border,#2a2a2e)}
.genie-chip button{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:none;cursor:pointer;background:#ef4444;color:#fff;font-size:12px;line-height:1}
.genie-notice{font-size:11.5px;color:#fca5a5;margin-bottom:6px}
.genie-attach{border:none;background:none;color:var(--text-secondary,#a1a1aa);cursor:pointer;padding:4px;display:flex}
.genie-attach:hover:not(:disabled){color:var(--text-primary,#fff)}
.genie-attach:disabled{opacity:.4;cursor:not-allowed}
.genie-compose-row .genie-count{margin-left:auto;margin-right:10px}
@keyframes genieIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@media (max-width:767px){
  .genie-fab{right:16px;bottom:calc(76px + max(env(safe-area-inset-bottom,0px),var(--android-nav-bottom,0px)));width:52px;height:52px}
  .genie-panel{right:8px;left:8px;width:auto;max-width:none;bottom:calc(140px + max(env(safe-area-inset-bottom,0px),var(--android-nav-bottom,0px)));height:min(520px,calc(100vh - 220px))}
  .genie-hello{right:16px;bottom:calc(138px + max(env(safe-area-inset-bottom,0px),var(--android-nav-bottom,0px)))}
}
@media (prefers-reduced-motion:reduce){.genie-panel,.genie-hello,.genie-fab{animation:none;transition:none}}
`
