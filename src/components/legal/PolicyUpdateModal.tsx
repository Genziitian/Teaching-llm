'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'genz_policy_update_oct_2026'

export default function PolicyUpdateModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (!seen) {
        setIsOpen(true)
      }
    } catch {}
  }, [])

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {}
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--surface-2, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          borderRadius: '24px',
          border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.35)',
          padding: '28px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          animation: 'fadeInScale 0.25s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'rgba(54, 54, 232, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3636e8',
              fontSize: '22px',
              flexShrink: 0,
            }}
          >
            📋
          </div>
          <div>
            <span
              style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#3636e8',
                marginBottom: '2px',
              }}
            >
              Policy Update • October 2026
            </span>
            <h2
              id="policy-modal-title"
              style={{
                margin: 0,
                fontSize: '19px',
                fontWeight: 800,
                lineHeight: 1.25,
                color: 'inherit',
              }}
            >
              We've Updated Our Policies
            </h2>
          </div>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: 1.55,
            color: 'var(--text-secondary, #475569)',
          }}
        >
          We have updated our <strong>Terms &amp; Conditions</strong>, <strong>Privacy Policy</strong>, and <strong>Return &amp; Refund Policy</strong> to include comprehensive terms for Google Play In-App Purchases:
        </p>

        <div
          style={{
            background: 'var(--surface-1, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '16px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            fontSize: '13px',
            lineHeight: 1.45,
            color: 'var(--text-secondary, #334155)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
            <div><strong>Google Play In-App Purchases:</strong> Official terms for digital notes and study materials purchased inside the Android app.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
            <div><strong>Pricing &amp; Validity:</strong> Transparent pricing in INR (₹) and 90-day digital access validity terms.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
            <div><strong>Cross-Platform Access:</strong> Content purchased in-app syncs seamlessly with your web account.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
            <div><strong>Refund &amp; Support:</strong> Clear refund guidelines governed by Google Play Billing policies.</div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12.5px',
          }}
        >
          <Link
            href="/company/terms-and-conditions"
            target="_blank"
            style={{ color: '#3636e8', fontWeight: 600, textDecoration: 'underline' }}
          >
            Terms &amp; Conditions →
          </Link>
          <Link
            href="/company/privacy-policy"
            target="_blank"
            style={{ color: '#3636e8', fontWeight: 600, textDecoration: 'underline' }}
          >
            Privacy Policy →
          </Link>
          <Link
            href="/company/refund-policy"
            target="_blank"
            style={{ color: '#3636e8', fontWeight: 600, textDecoration: 'underline' }}
          >
            Refund Policy →
          </Link>
        </div>

        <button
          type="button"
          onClick={handleAccept}
          style={{
            marginTop: '4px',
            width: '100%',
            height: '46px',
            border: 'none',
            borderRadius: '14px',
            background: '#3636e8',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'opacity 0.2s ease',
          }}
        >
          I Understand &amp; Agree
        </button>
      </div>
    </div>
  )
}
