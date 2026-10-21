'use client'

import { useEffect, useState } from 'react'
import { finishAttempt, startAttempt } from '@/lib/payments/attempts-client'

export type PaymentOutcome = 'success' | 'failed' | 'cancelled' | 'pending'

export interface PaymentResultDetail {
  outcome: PaymentOutcome
  title: string
  amount?: number
  orderId?: string
  paymentId?: string
  reason?: string
  grants?: string[]
}

const EVENT = 'genz:payment-result'
export function showPaymentResult(detail: PaymentResultDetail) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail }))
}

/* ───────────── Razorpay tracker ─────────────
 * Wraps window.Razorpay once, so EVERY checkout on the site records failed,
 * cancelled and unconfirmed attempts for managers and ends on the full-page
 * result screen, without touching each purchase flow. */
type Rzp = new (options: Record<string, any>) => any
const WRAPPED = '__genzWrapped'

function guessKind(text: string) {
  const t = text.toLowerCase()
  if (t.includes('protection')) return 'PROTECTION'
  if (t.includes('note')) return 'NOTE'
  if (t.includes('mentor')) return 'MENTORSHIP'
  if (t.includes('bundle')) return 'BUNDLE'
  return 'COURSE'
}

async function confirmedOnServer(orderRef?: string, paymentId?: string): Promise<boolean> {
  if (!orderRef && !paymentId) return false
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch('/api/my-transactions', { cache: 'no-store' })
      if (res.ok) {
        const { transactions = [] } = await res.json()
        const hit = transactions.find(
          (t: any) =>
            ['SUCCESS', 'PAID'].includes(String(t.status).toUpperCase()) &&
            ([t.orderId, t.paymentId].includes(orderRef) || (paymentId && [t.orderId, t.paymentId].includes(paymentId)))
        )
        if (hit) return true
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1500))
  }
  return false
}

function wrapRazorpay(Orig: Rzp): Rzp {
  if ((Orig as any)[WRAPPED]) return Orig
  function Wrapped(this: any, options: Record<string, any>) {
    const opts: Record<string, any> = { ...options }
    const title = String(opts.description || opts.name || 'Purchase')
    const amount = typeof opts.amount === 'number' ? opts.amount / 100 : undefined
    const orderRef: string | undefined = opts.order_id
    const attempt = startAttempt({ kind: guessKind(title), itemName: title, amount, orderRef })
    let succeeded = false
    let lastFailure: string | undefined

    const origHandler = opts.handler
    opts.handler = async (resp: any) => {
      succeeded = true
      try {
        await origHandler?.(resp)
      } catch {
        /* the original flow shows its own error; we verify with the server below */
      }
      const paymentId = resp?.razorpay_payment_id as string | undefined
      const ok = await confirmedOnServer(resp?.razorpay_order_id || orderRef, paymentId)
      const id = await attempt
      if (ok) {
        void finishAttempt(id, { status: 'SUCCESS', orderRef, paymentRef: paymentId })
        showPaymentResult({ outcome: 'success', title, amount, orderId: orderRef, paymentId })
      } else {
        void finishAttempt(id, { status: 'PENDING_VERIFY', reason: 'Paid but not confirmed yet', orderRef, paymentRef: paymentId })
        showPaymentResult({ outcome: 'pending', title, amount, orderId: orderRef, paymentId })
      }
    }

    const origDismiss = opts.modal?.ondismiss
    opts.modal = {
      ...(opts.modal || {}),
      ondismiss: (...args: any[]) => {
        try { origDismiss?.(...args) } catch {}
        if (succeeded) return
        void (async () => {
          const id = await attempt
          if (lastFailure) {
            void finishAttempt(id, { status: 'FAILED', reason: lastFailure, orderRef })
            showPaymentResult({ outcome: 'failed', title, amount, orderId: orderRef, reason: lastFailure })
          } else {
            void finishAttempt(id, { status: 'CANCELLED', reason: 'Closed checkout without paying', orderRef })
            showPaymentResult({ outcome: 'cancelled', title, amount, orderId: orderRef })
          }
        })()
      },
    }

    const inst = new Orig(opts)
    try {
      inst.on?.('payment.failed', (r: any) => {
        lastFailure = r?.error?.description || r?.error?.reason || 'Payment failed'
        void (async () => finishAttempt(await attempt, { status: 'FAILED', reason: lastFailure, orderRef, paymentRef: r?.error?.metadata?.payment_id }))()
      })
    } catch {}
    return inst
  }
  Object.assign(Wrapped, Orig)
  ;(Wrapped as any)[WRAPPED] = true
  ;(Wrapped as any).prototype = (Orig as any).prototype
  return Wrapped as unknown as Rzp
}

function installTracker() {
  if (typeof window === 'undefined') return
  const w = window as any
  if (w.__genzRzpInstalled) return
  w.__genzRzpInstalled = true
  let current: Rzp | undefined = w.Razorpay ? wrapRazorpay(w.Razorpay) : undefined
  Object.defineProperty(w, 'Razorpay', {
    configurable: true,
    get: () => current,
    set: (v: Rzp) => { current = v ? wrapRazorpay(v) : v },
  })
}
installTracker()

/* ───────────── Result screen ───────────── */
const COLORS: Record<PaymentOutcome, string> = {
  success: '#30c46f',
  failed: '#ff453a',
  cancelled: '#ff9f0a',
  pending: '#0a84ff',
}

const TIPS: Record<Exclude<PaymentOutcome, 'success'>, string[]> = {
  failed: [
    'Check your internet connection and try again.',
    'Try another UPI app, card or net banking.',
    'If money was deducted, your bank usually returns it within 5 to 7 working days. Contact us if it does not arrive.',
  ],
  cancelled: ['Nothing was charged. Your cart is still there.', 'Press the buy button again whenever you are ready.'],
  pending: [
    'Keep this page open for a minute, then check your purchase history.',
    'If money was deducted and access does not appear, contact us with the order ID above.',
  ],
}

function Buddy({ mood }: { mood: PaymentOutcome }) {
  const c = COLORS[mood]
  return (
    <svg viewBox="0 0 200 200" className={`pr-buddy pr-${mood}`} aria-hidden>
      <defs>
        <linearGradient id="pr-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="1" />
          <stop offset="1" stopColor={c} stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <ellipse className="pr-shadow" cx="100" cy="182" rx="46" ry="7" fill="#000" opacity=".14" />
      <g className="pr-bob">
        <ellipse cx="78" cy="176" rx="15" ry="8" fill={c} opacity=".7" />
        <ellipse cx="122" cy="176" rx="15" ry="8" fill={c} opacity=".7" />
        {mood === 'success' && (<>
          <line className="pr-armL" x1="48" y1="120" x2="22" y2="76" stroke={c} strokeWidth="11" strokeLinecap="round" opacity=".85" />
          <line className="pr-armR" x1="152" y1="120" x2="178" y2="76" stroke={c} strokeWidth="11" strokeLinecap="round" opacity=".85" />
        </>)}
        {mood === 'failed' && (<>
          <line x1="48" y1="120" x2="34" y2="150" stroke={c} strokeWidth="11" strokeLinecap="round" opacity=".85" />
          <line x1="152" y1="120" x2="166" y2="150" stroke={c} strokeWidth="11" strokeLinecap="round" opacity=".85" />
        </>)}
        {mood === 'cancelled' && (<>
          <line x1="48" y1="122" x2="22" y2="118" stroke={c} strokeWidth="11" strokeLinecap="round" opacity=".85" />
          <line x1="152" y1="122" x2="178" y2="118" stroke={c} strokeWidth="11" strokeLinecap="round" opacity=".85" />
        </>)}
        {mood === 'pending' && (<>
          <line x1="48" y1="122" x2="32" y2="142" stroke={c} strokeWidth="11" strokeLinecap="round" opacity=".85" />
          <line x1="152" y1="120" x2="168" y2="86" stroke={c} strokeWidth="11" strokeLinecap="round" opacity=".85" />
        </>)}
        <g className={mood === 'failed' ? 'pr-tilt' : ''}>
          <rect x="52" y="54" width="96" height="120" rx="46" fill="url(#pr-g)" />
          <ellipse cx="76" cy="72" rx="13" ry="7" fill="#fff" opacity=".28" />
          {mood === 'success' ? (<>
            <path d="M68 100 q10 -14 20 0" stroke="#1c1c1e" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M112 100 q10 -14 20 0" stroke="#1c1c1e" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M80 124 q20 30 40 0 z" fill="#1c1c1e" />
            <ellipse cx="100" cy="136" rx="9" ry="4" fill="#ff6b7a" />
            <circle cx="64" cy="122" r="6" fill="#fff" opacity=".3" />
            <circle cx="136" cy="122" r="6" fill="#fff" opacity=".3" />
          </>) : (<>
            <g className="pr-eyes">
              <circle cx="78" cy="102" r="11" fill="#fff" />
              <circle cx="122" cy="102" r="11" fill="#fff" />
              <circle className="pr-pupil" cx="78" cy={mood === 'failed' ? 105 : 102} r="6" fill="#1c1c1e" />
              <circle className="pr-pupil" cx="122" cy={mood === 'failed' ? 105 : 102} r="6" fill="#1c1c1e" />
            </g>
            {mood === 'failed' && (<>
              <line x1="64" y1="82" x2="86" y2="88" stroke="#1c1c1e" strokeWidth="4" strokeLinecap="round" />
              <line x1="136" y1="82" x2="114" y2="88" stroke="#1c1c1e" strokeWidth="4" strokeLinecap="round" />
              <path d="M84 142 q16 -16 32 0" stroke="#1c1c1e" strokeWidth="5" fill="none" strokeLinecap="round" />
              <path className="pr-drop" d="M146 78 q8 12 0 18 q-8 -6 0 -18z" fill="#64d2ff" />
            </>)}
            {mood === 'cancelled' && (<>
              <path d="M86 140 q7 -4 14 0 t14 0" stroke="#1c1c1e" strokeWidth="5" fill="none" strokeLinecap="round" />
              <line x1="112" y1="84" x2="134" y2="80" stroke="#1c1c1e" strokeWidth="4" strokeLinecap="round" />
              <text className="pr-q" x="140" y="60" fontSize="30" fontWeight="800" fill={c}>?</text>
            </>)}
            {mood === 'pending' && (<>
              <ellipse cx="100" cy="138" rx="7" ry="9" fill="none" stroke="#1c1c1e" strokeWidth="4" />
              <g className="pr-orbit"><circle cx="76" cy="44" r="5" fill={c} /><circle cx="100" cy="38" r="5" fill={c} opacity=".7" /><circle cx="124" cy="44" r="5" fill={c} opacity=".45" /></g>
            </>)}
          </>)}
        </g>
      </g>
    </svg>
  )
}

const fmtMoney = (n?: number) => (typeof n === 'number' ? `₹${Math.round(n)}` : null)

export default function PaymentResultHost() {
  const [d, setD] = useState<PaymentResultDetail | null>(null)
  const [when, setWhen] = useState<Date>(new Date())
  const [copied, setCopied] = useState('')

  useEffect(() => {
    const on = (e: Event) => { setD((e as CustomEvent<PaymentResultDetail>).detail); setWhen(new Date()) }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  useEffect(() => {
    if (!d) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [d])

  if (!d) return null
  const color = COLORS[d.outcome]
  const ok = d.outcome === 'success'
  const head = { success: 'Payment successful', failed: 'Payment failed', cancelled: 'Payment cancelled', pending: 'We are confirming your payment' }[d.outcome]
  const sub = ok
    ? `You now have access to ${d.title}.`
    : d.outcome === 'failed'
      ? (d.reason || 'Something went wrong while paying.')
      : d.outcome === 'cancelled'
        ? 'You closed checkout before paying, so nothing was charged.'
        : 'This can take a few minutes. Your access appears on its own once it is confirmed.'
  const status = { success: 'Paid', failed: 'Failed', cancelled: 'Cancelled', pending: 'Confirming' }[d.outcome]
  const grants = ok ? (d.grants?.length ? d.grants : ['Your purchase is unlocked and ready to use', 'Available on the website and the app', 'Find it any time in your purchase history']) : TIPS[d.outcome as Exclude<PaymentOutcome, 'success'>]
  const money = fmtMoney(d.amount)
  const rows: [string, string, boolean?][] = [
    ['Item', d.title],
    ...(money ? [[ok ? 'Amount paid' : 'Amount', ok ? money : `${money} (not charged)`, true] as [string, string, boolean]] : []),
    ['Date and time', when.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })],
    ['Paid with', 'Razorpay'],
    ...(d.orderId ? [['Order ID', d.orderId] as [string, string]] : []),
    ...(d.paymentId ? [['Payment ID', d.paymentId] as [string, string]] : []),
  ]
  const close = () => {
    if (d && d.outcome !== 'success') window.dispatchEvent(new Event('payment-result-closed'))
    setD(null)
  }
  const go = (href: string) => { setD(null); window.location.assign(href) }

  return (
    <div className="pr-overlay" role="dialog" aria-modal="true" aria-label={head} style={{ ['--pr' as string]: color }}>
      <style>{CSS}</style>
      {ok && <div className="pr-confetti" aria-hidden>{Array.from({ length: 34 }).map((_, i) => <i key={i} style={{ left: `${(i * 29) % 100}%`, animationDelay: `${(i % 9) * -0.7}s`, animationDuration: `${4 + (i % 5)}s`, background: ['#30c46f', '#ffd60a', '#0a84ff', '#ff453a', '#bf5af2', '#ff9f0a'][i % 6] }} />)}</div>}
      <div className="pr-wrap">
        <div className="pr-hero">
          <div className="pr-buddywrap"><Buddy mood={d.outcome} /></div>
          <h1>{head}</h1>
          <p>{sub}</p>
        </div>
        <div className="pr-side">
          <div className="pr-card">
            <div className="pr-cardhead"><span className="pr-ico">🧾</span><strong>{ok ? 'Receipt' : 'Attempt receipt'}</strong><span className="pr-chip">{status}</span></div>
            <div className="pr-perf" />
            <div className="pr-rows">
              {rows.map(([k, v, strong]) => (
                <button key={k} type="button" className="pr-row" onClick={() => { if (k.endsWith('ID')) { navigator.clipboard?.writeText(v); setCopied(k); setTimeout(() => setCopied(''), 1500) } }}>
                  <span>{k}</span><b className={strong ? 'strong' : ''}>{copied === k ? 'Copied' : v}</b>
                </button>
              ))}
            </div>
          </div>
          <div className="pr-info">
            <strong>{ok ? '🔓 Access granted' : '💡 What you can do'}</strong>
            <ul>{grants.map(g => <li key={g}>{g}</li>)}</ul>
          </div>
          <div className="pr-actions">
            <button className="pr-primary" onClick={close}>{ok ? 'Start learning' : d.outcome === 'pending' ? 'Done' : 'Try again'}</button>
            <button className="pr-secondary" onClick={() => go(ok ? '/my-transactions' : d.outcome === 'cancelled' ? '/courses/explore' : '/support')}>
              {ok ? 'View purchase history' : d.outcome === 'cancelled' ? 'Back to store' : 'Get help'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.pr-overlay{position:fixed;inset:0;z-index:100000;background:var(--bg,#fff);color:var(--text-primary,#111);overflow-y:auto;overscroll-behavior:contain;display:flex;animation:pr-in .32s cubic-bezier(.23,1,.32,1)}
@keyframes pr-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.pr-wrap{margin:auto;width:100%;max-width:1020px;padding:clamp(16px,4vw,40px);display:grid;gap:clamp(16px,3vw,40px);grid-template-columns:1fr;align-items:center;box-sizing:border-box}
@media(min-width:860px){.pr-wrap{grid-template-columns:1fr 1fr}}
.pr-hero{text-align:center}
.pr-hero h1{margin:6px 0 8px;font-size:clamp(26px,4.2vw,36px);line-height:1.1;letter-spacing:-.025em;font-weight:800}
.pr-hero p{margin:0 auto;max-width:420px;font-size:15px;line-height:1.45;color:var(--text-secondary,#666)}
.pr-buddywrap{width:clamp(140px,34vw,300px);margin:0 auto;animation:pr-pop .9s cubic-bezier(.34,1.56,.64,1) both}
@keyframes pr-pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
@media(max-height:640px){.pr-buddywrap{width:clamp(110px,22vh,170px)}}
.pr-buddy{width:100%;height:auto;overflow:visible}
.pr-bob{animation:pr-bob 3.2s ease-in-out infinite}
@keyframes pr-bob{50%{transform:translateY(-7px)}}
.pr-shadow{animation:pr-sh 3.2s ease-in-out infinite;transform-origin:100px 182px}
@keyframes pr-sh{50%{transform:scaleX(.9);opacity:.09}}
.pr-armL{transform-origin:48px 120px;animation:pr-wl 1.1s ease-in-out infinite}
.pr-armR{transform-origin:152px 120px;animation:pr-wr 1.1s ease-in-out infinite}
@keyframes pr-wl{50%{transform:rotate(-16deg)}}
@keyframes pr-wr{50%{transform:rotate(16deg)}}
.pr-tilt{transform-origin:100px 174px;animation:pr-tilt 3.2s ease-in-out infinite;transform:rotate(-4deg)}
@keyframes pr-tilt{50%{transform:rotate(-1deg)}}
.pr-eyes{transform-origin:100px 102px;animation:pr-blink 3.4s infinite}
@keyframes pr-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
.pr-pending .pr-pupil{animation:pr-look 2.4s ease-in-out infinite}
@keyframes pr-look{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
.pr-drop{animation:pr-drop 1.6s ease-in infinite}
@keyframes pr-drop{0%{transform:translateY(0);opacity:1}100%{transform:translateY(46px);opacity:0}}
.pr-q{animation:pr-q 1.8s ease-out infinite}
@keyframes pr-q{0%{transform:translateY(8px);opacity:0}30%{opacity:1}100%{transform:translateY(-8px);opacity:0}}
.pr-orbit{transform-origin:100px 42px;animation:pr-orb 2.4s linear infinite}
@keyframes pr-orb{to{transform:rotate(360deg)}}
.pr-side{display:flex;flex-direction:column;gap:14px;min-width:0}
.pr-card{background:var(--card-background,var(--surface,#fff));border:1px solid var(--border,#e5e5ea);border-radius:24px;box-shadow:0 10px 28px rgba(0,0,0,.08);overflow:hidden}
.pr-cardhead{display:flex;align-items:center;gap:12px;padding:16px 18px}
.pr-cardhead strong{flex:1;font-size:17px;letter-spacing:-.02em}
.pr-ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--pr) 16%,transparent)}
.pr-chip{font-size:12.5px;font-weight:800;padding:5px 12px;border-radius:999px;color:var(--pr);background:color-mix(in srgb,var(--pr) 15%,transparent)}
.pr-perf{border-top:1.5px dashed var(--border,#d4d4d8);margin:0 14px}
.pr-rows{padding:8px 18px 12px}
.pr-row{all:unset;box-sizing:border-box;width:100%;display:flex;justify-content:space-between;gap:16px;padding:7px 0;font-size:13.5px;cursor:default}
.pr-row span{color:var(--text-secondary,#666);flex:none}
.pr-row b{font-weight:600;text-align:right;word-break:break-word}
.pr-row b.strong{font-size:17px;font-weight:800}
.pr-info{border-radius:22px;padding:16px 18px;background:color-mix(in srgb,var(--pr) 8%,transparent);border:1px solid color-mix(in srgb,var(--pr) 22%,transparent)}
.pr-info ul{margin:8px 0 0;padding-left:20px;font-size:13.5px;line-height:1.45}
.pr-info li{margin-bottom:5px}
.pr-actions{display:flex;flex-direction:column;gap:10px}
.pr-primary,.pr-secondary{all:unset;box-sizing:border-box;text-align:center;cursor:pointer;border-radius:999px;font-weight:700;transition:transform .1s ease-out}
.pr-primary:active,.pr-secondary:active{transform:scale(.98)}
.pr-primary{height:54px;line-height:54px;font-size:17px;color:#fff;background:var(--pr);box-shadow:0 8px 20px color-mix(in srgb,var(--pr) 38%,transparent)}
.pr-secondary{height:48px;line-height:48px;font-size:15.5px;background:color-mix(in srgb,var(--text-muted,#888) 14%,transparent)}
.pr-confetti{position:fixed;inset:0;pointer-events:none;overflow:hidden}
.pr-confetti i{position:absolute;top:-20px;width:9px;height:15px;border-radius:2px;opacity:.85;animation:pr-fall linear infinite}
@keyframes pr-fall{to{transform:translateY(110vh) rotate(540deg)}}
@media(prefers-reduced-motion:reduce){.pr-overlay *,.pr-overlay{animation:none!important}.pr-confetti{display:none}}
`
