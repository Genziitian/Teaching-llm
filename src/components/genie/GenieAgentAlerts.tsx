'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Manager-side alerts for Genie live chats, shown on every dashboard page.
 *  - a popup per waiting request: Join / Move to ticket / Cancel (Cancel hides it only for this manager)
 *  - a small tray of live chats this manager owns: Open / Move to ticket
 */

interface Row { id: string; studentName: string; firstMessage: string; hasImage: boolean; context: string; createdAt: string; ticketId: string | null }

const DISMISS_KEY = 'genie-dismissed-v1'
const POLL_MS = 4000

function beep() {
  try {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!C) return
    const c = new C(), o = c.createOscillator(), g = c.createGain()
    o.frequency.value = 760; g.gain.value = 0.05
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.18)
    window.setTimeout(() => c.close?.(), 400)
  } catch {}
}

function loadDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]') } catch { return [] }
}

export default function GenieAgentAlerts({ userRole }: { userRole: string }) {
  const router = useRouter()
  const [waiting, setWaiting] = useState<Row[]>([])
  const [live, setLive] = useState<Row[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const known = useRef<Set<string> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/genie/manager/queue', { cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json()
      const w: Row[] = d.waiting || []
      if (known.current) { if (w.some(x => !known.current!.has(x.id))) beep() }
      known.current = new Set(w.map(x => x.id))
      setWaiting(w); setLive(d.live || [])
    } catch {}
  }, [])

  useEffect(() => {
    if (userRole !== 'MANAGER') return
    setDismissed(loadDismissed())
    void refresh()
    const id = window.setInterval(() => { if (!document.hidden) void refresh() }, POLL_MS)
    return () => window.clearInterval(id)
  }, [userRole, refresh])

  if (userRole !== 'MANAGER') return null

  const visible = waiting.filter(w => !dismissed.includes(w.id))

  function cancel(id: string) {
    const next = [...dismissed, id].slice(-100)
    setDismissed(next)
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)) } catch {}
  }

  async function act(kind: 'join' | 'move', id: string, openAfter: boolean) {
    setBusyId(id); setErr(null)
    try {
      const r = await fetch(`/api/genie/manager/${kind}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error || `Error ${r.status}`)
      await refresh()
      if (openAfter && d.ticketId) router.push(`/support?ticket=${d.ticketId}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      void refresh()
    } finally { setBusyId(null) }
  }

  if (visible.length === 0 && live.length === 0 && !err) return null

  return (
    <>
      <style>{CSS}</style>
      <div className="gaa-wrap" role="region" aria-label="Live chat requests">
        {err && <div className="gaa-err" onClick={() => setErr(null)}>{err}</div>}
        {visible.slice(0, 3).map(w => (
          <div key={w.id} className="gaa-card">
            <div className="gaa-top"><b>{w.studentName}</b><span>wants to chat now</span></div>
            <div className="gaa-msg">{w.firstMessage || (w.hasImage ? '(photo)' : '')}</div>
            {w.context && <div className="gaa-ctx">{w.context.split('\n')[0]}</div>}
            <div className="gaa-btns">
              <button className="gaa-join" disabled={busyId === w.id} onClick={() => void act('join', w.id, true)}>Join</button>
              <button disabled={busyId === w.id} onClick={() => void act('move', w.id, false)}>Move to ticket</button>
              <button className="gaa-ghost" disabled={busyId === w.id} onClick={() => cancel(w.id)}>Cancel</button>
            </div>
          </div>
        ))}
        {visible.length > 3 && <div className="gaa-more">+{visible.length - 3} more waiting</div>}
        {live.map(l => (
          <div key={l.id} className="gaa-live">
            <span className="gaa-dot" />
            <span className="gaa-name">Live: {l.studentName}</span>
            <button onClick={() => l.ticketId && router.push(`/support?ticket=${l.ticketId}`)}>Open</button>
            <button className="gaa-ghost" disabled={busyId === l.id} onClick={() => void act('move', l.id, false)}>Move to ticket</button>
          </div>
        ))}
      </div>
    </>
  )
}

const CSS = `
.gaa-wrap{position:fixed;left:20px;bottom:20px;z-index:1100;display:flex;flex-direction:column;gap:10px;width:340px;max-width:calc(100vw - 24px)}
.gaa-card{padding:14px;border-radius:16px;background:var(--surface,#161618);color:var(--text-primary,#fff);border:1.5px solid #6366f1;box-shadow:0 12px 32px rgba(0,0,0,.5);animation:gaaIn .2s ease}
.gaa-top{display:flex;gap:6px;align-items:baseline;font-size:13px}.gaa-top span{color:var(--text-secondary,#a1a1aa);font-size:12px}
.gaa-msg{margin-top:6px;font-size:13px;line-height:1.45;max-height:64px;overflow:hidden;word-break:break-word}
.gaa-ctx{margin-top:4px;font-size:11.5px;color:var(--text-muted,#71717a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gaa-btns{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.gaa-btns button,.gaa-live button{font:inherit;font-size:12px;font-weight:800;padding:7px 12px;border-radius:50px;cursor:pointer;border:1.5px solid var(--border,#2a2a2e);background:var(--surface-2,#1f1f23);color:var(--text-primary,#fff)}
.gaa-btns button.gaa-join{background:linear-gradient(135deg,#8b5cf6,#6366f1);border-color:transparent;color:#fff}
.gaa-btns button:disabled,.gaa-live button:disabled{opacity:.5;cursor:not-allowed}
.gaa-ghost{color:var(--text-secondary,#a1a1aa)!important}
.gaa-live{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:50px;background:var(--surface,#161618);border:1px solid var(--border,#2a2a2e);color:var(--text-primary,#fff);font-size:12.5px}
.gaa-name{flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gaa-dot{width:8px;height:8px;border-radius:50%;background:#34d399}
.gaa-more{font-size:12px;color:var(--text-secondary,#a1a1aa);padding-left:6px}
.gaa-err{padding:8px 12px;border-radius:12px;background:#7f1d1d;color:#fff;font-size:12px;cursor:pointer}
@keyframes gaaIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (max-width:767px){.gaa-wrap{left:8px;right:8px;width:auto;bottom:calc(76px + env(safe-area-inset-bottom,0px))}}
`
