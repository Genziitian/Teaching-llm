'use client'

import { useCallback, useEffect, useState } from 'react'

const OPTIONS: [string, string][] = [
  ['PRICE', 'Price is too high'],
  ['ASK_FAMILY', 'I need to ask my family'],
  ['PAYMENT_PROBLEM', 'Payment did not work'],
  ['NOT_SURE_WHICH', 'Not sure which one to pick'],
  ['WANT_DISCOUNT', 'Waiting for a discount'],
  ['NEED_MORE_INFO', 'Need more information'],
  ['JUST_LOOKING', 'Just looking around'],
  ['BUY_LATER', 'Will buy later'],
  ['OTHER', 'Something else'],
]

/** "What is stopping you?" sheet shown once after an unfinished checkout. */
export default function PaymentFeedbackPrompt() {
  const [att, setAtt] = useState<{ id: string; itemName: string } | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)

  const check = useCallback(async (now: boolean) => {
    try {
      const r = await fetch(`/api/payment-attempts/feedback${now ? '?now=1' : ''}`, { cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json()
      if (d.attempt) { setPicked([]); setNote(''); setSent(false); setAtt(d.attempt) }
    } catch {}
  }, [])

  useEffect(() => {
    const t = setTimeout(() => check(false), 4000)
    const onClosed = () => setTimeout(() => check(true), 600)
    window.addEventListener('payment-result-closed', onClosed)
    return () => { clearTimeout(t); window.removeEventListener('payment-result-closed', onClosed) }
  }, [check])

  if (!att) return null
  const done = () => setAtt(null)
  const send = async (dismissed: boolean) => {
    const id = att.id
    if (!dismissed) setSent(true)
    try {
      await fetch('/api/payment-attempts/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ id, reasons: picked, note, dismissed }),
      })
    } catch {}
    if (dismissed) done(); else setTimeout(done, 1600)
  }
  const toggle = (k: string) => setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]))

  return (
    <div className="pf-back" onClick={() => send(true)}>
      <style>{`
        .pf-back{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;animation:pfIn .2s ease}
        .pf-sheet{width:min(520px,100%);max-height:92dvh;overflow:auto;background:var(--surface,#fff);color:var(--text-primary,#111);border-radius:24px 24px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom));animation:pfUp .32s cubic-bezier(.2,.9,.3,1)}
        @media(min-width:640px){.pf-back{align-items:center}.pf-sheet{border-radius:24px}}
        .pf-chip{padding:10px 14px;border-radius:999px;border:1px solid var(--border,#ddd);background:transparent;color:inherit;font-weight:600;font-size:13.5px;cursor:pointer}
        .pf-chip.on{background:var(--primary,#0a84ff);border-color:var(--primary,#0a84ff);color:#fff}
        @keyframes pfIn{from{opacity:0}}@keyframes pfUp{from{transform:translateY(40px);opacity:0}}
        @media(prefers-reduced-motion:reduce){.pf-back,.pf-sheet{animation:none}}
      `}</style>
      <div className="pf-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        {sent ? (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <div style={{ fontSize: 40 }}>💙</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 6 }}>Thank you!</div>
            <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>Our team will use this to help you.</div>
          </div>
        ) : (<>
          <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>What&apos;s stopping you?</div>
          <div style={{ fontSize: 14, opacity: 0.7, margin: '4px 0 14px' }}>You didn&apos;t finish buying <b>{att.itemName}</b>. Tell us why - pick any that fit.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {OPTIONS.map(([k, l]) => <button key={k} className={`pf-chip${picked.includes(k) ? ' on' : ''}`} onClick={() => toggle(k)}>{l}</button>)}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={600} rows={3} placeholder="Anything else you'd like us to know? (optional)"
            style={{ width: '100%', marginTop: 14, padding: 12, borderRadius: 14, border: '1px solid var(--border,#ddd)', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: 14, resize: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="pf-chip" style={{ flex: 1 }} onClick={() => send(true)}>Not now</button>
            <button className="pf-chip on" style={{ flex: 2, opacity: picked.length || note.trim() ? 1 : 0.5 }} disabled={!picked.length && !note.trim()} onClick={() => send(false)}>Send</button>
          </div>
        </>)}
      </div>
    </div>
  )
}
