'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'genz_policy_update_oct_2026'

type Row = { title: string; text: string; color: string; icon: React.ReactNode }

const svgProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const ROWS: Row[] = [
  {
    title: 'Google Play In-App Purchases',
    text: 'Official terms for digital notes and study materials purchased inside the Android app.',
    color: '#30B368',
    icon: (
      <svg {...svgProps}>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    title: 'Pricing & Validity',
    text: 'Transparent pricing in INR (₹) and 90-day digital access validity terms.',
    color: '#0A84FF',
    icon: (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    title: 'Cross-Platform Access',
    text: 'Content purchased in-app syncs seamlessly with your web account.',
    color: '#FF9F0A',
    icon: (
      <svg {...svgProps}>
        <rect x="2" y="4" width="14" height="11" rx="2" />
        <rect x="14" y="9" width="8" height="12" rx="2" />
      </svg>
    ),
  },
  {
    title: 'Refund & Support',
    text: 'Clear refund guidelines governed by Google Play Billing policies.',
    color: '#BF5AF2',
    icon: (
      <svg {...svgProps}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
]

const LINKS = [
  { href: '/company/terms-and-conditions', label: 'Terms & Conditions' },
  { href: '/company/privacy-policy', label: 'Privacy Policy' },
  { href: '/company/refund-policy', label: 'Refund Policy' },
]

export default function PolicyUpdateModal() {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    let seenHere = false
    try {
      seenHere = Boolean(localStorage.getItem(STORAGE_KEY))
    } catch {}
    if (seenHere) return

    // Signed-in accounts remember it on every browser and in the app, so it
    // appears only once ever. Visitors who are not signed in fall back to
    // this browser's memory.
    fetch('/api/user/seen-notices', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled) return
        if (Array.isArray(data?.seen) && data.seen.includes(STORAGE_KEY)) {
          try {
            localStorage.setItem(STORAGE_KEY, 'true')
          } catch {}
          return
        }
        setIsOpen(true)
      })
      .catch(() => {
        if (!cancelled) setIsOpen(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (isOpen) buttonRef.current?.focus({ preventScroll: true })
  }, [isOpen])

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {}
    fetch('/api/user/seen-notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: STORAGE_KEY }),
    }).catch(() => {})
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
      className="policy-overlay"
    >
      <style>{`
        .policy-overlay {
          position: fixed; inset: 0; z-index: 2147483500;
          display: flex; align-items: center; justify-content: center;
          padding: 20px 16px; background: rgba(0,0,0,0.55);
          backdrop-filter: blur(10px) saturate(140%);
          -webkit-backdrop-filter: blur(10px) saturate(140%);
          animation: policyFade 260ms ease-out both;
        }
        .policy-card {
          width: 100%; max-width: 440px; max-height: calc(100dvh - 40px);
          overflow-y: auto; overscroll-behavior: contain;
          background: var(--surface-2, #fff); color: var(--text-primary, #0f172a);
          border: 1px solid var(--border, rgba(0,0,0,0.08));
          border-radius: 28px; padding: 32px 26px 24px;
          box-shadow: 0 30px 70px -20px rgba(0,0,0,0.5);
          animation: policyIn 420ms cubic-bezier(.2,.8,.2,1) both;
        }
        .policy-rise { animation: policyRise 480ms cubic-bezier(.2,.8,.2,1) backwards; }
        .policy-link {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 8px 13px; border-radius: 999px; text-decoration: none;
          background: var(--surface-hover, rgba(127,127,127,0.12));
          color: var(--text-primary, #0f172a);
          font-size: 13px; font-weight: 600; transition: transform 120ms ease, opacity 120ms ease;
        }
        .policy-link:active { transform: scale(0.96); }
        .policy-cta {
          width: 100%; height: 54px; border: none; border-radius: 18px; cursor: pointer;
          background: var(--accent, #3636e8); color: var(--button-text, #fff);
          font-size: 16px; font-weight: 700; letter-spacing: -0.1px;
          transition: transform 120ms ease, opacity 120ms ease;
        }
        .policy-cta:active { transform: scale(0.98); }
        .policy-cta:focus-visible { outline: 3px solid var(--accent, #3636e8); outline-offset: 3px; }
        @keyframes policyFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes policyIn { from { opacity: 0; transform: translateY(14px) scale(0.96) } to { opacity: 1; transform: none } }
        @keyframes policyRise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) {
          .policy-overlay, .policy-card, .policy-rise { animation: none !important; }
        }
      `}</style>

      <div className="policy-card">
        <div style={{ textAlign: 'center' }}>
          <div
            className="policy-rise"
            style={{
              width: 64, height: 64, margin: '0 auto 16px', borderRadius: 20,
              background: 'linear-gradient(145deg, #7D7AFF, #5E5CE6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              boxShadow: '0 12px 26px -8px rgba(94,92,230,0.55)',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" />
              <path d="M9 13h6M9 17h4" />
            </svg>
          </div>
          <div
            className="policy-rise"
            style={{
              animationDelay: '60ms', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-secondary, #64748b)', marginBottom: 6,
            }}
          >
            Policy Update • October 2026
          </div>
          <h2
            id="policy-modal-title"
            className="policy-rise"
            style={{
              animationDelay: '110ms', margin: 0, fontSize: 26, fontWeight: 800,
              lineHeight: 1.15, letterSpacing: '-0.03em',
            }}
          >
            We&apos;ve Updated Our Policies
          </h2>
          <p
            className="policy-rise"
            style={{
              animationDelay: '160ms', margin: '12px 0 0', fontSize: 15, lineHeight: 1.5,
              color: 'var(--text-secondary, #475569)',
            }}
          >
            We have updated our <strong style={{ color: 'var(--text-primary)' }}>Terms &amp; Conditions</strong>,{' '}
            <strong style={{ color: 'var(--text-primary)' }}>Privacy Policy</strong>, and{' '}
            <strong style={{ color: 'var(--text-primary)' }}>Return &amp; Refund Policy</strong> to include comprehensive terms for Google Play In-App Purchases:
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, margin: '26px 0 24px' }}>
          {ROWS.map((r, i) => (
            <div
              key={r.title}
              className="policy-rise"
              style={{ display: 'flex', gap: 14, alignItems: 'flex-start', animationDelay: `${220 + i * 70}ms` }}
            >
              <div
                style={{
                  width: 40, height: 40, flexShrink: 0, borderRadius: 12, color: r.color,
                  background: `${r.color}24`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {r.icon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{r.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary, #475569)', marginTop: 2 }}>
                  {r.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="policy-rise"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 22, animationDelay: '520ms' }}
        >
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} target="_blank" className="policy-link">
              {l.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>

        <button
          ref={buttonRef}
          type="button"
          onClick={handleAccept}
          className="policy-cta policy-rise"
          style={{ animationDelay: '580ms' }}
        >
          I Understand &amp; Agree
        </button>
      </div>
    </div>
  )
}
