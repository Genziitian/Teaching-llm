'use client'

import { useEffect, useState } from 'react'

interface ShareLinkModalProps {
  open: boolean
  onClose: () => void
  title: string
  message: string
  url: string
}

export function ShareIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

export default function ShareLinkModal({ open, onClose, title, message, url }: ShareLinkModalProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const text = `${message}\n${url}`
  const enc = encodeURIComponent

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: message, url })
    } catch { /* cancelled */ }
  }

  const canNative = typeof navigator !== 'undefined' && typeof (navigator as Navigator & { share?: unknown }).share === 'function'

  const targets = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(text)}` },
    { label: 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(message)}` },
    { label: 'Email', href: `mailto:?subject=${enc(title)}&body=${enc(text)}` },
  ]

  const pill: React.CSSProperties = {
    flex: 1, textAlign: 'center', textDecoration: 'none', padding: '11px 8px',
    borderRadius: '12px', background: 'var(--surface-hover)', color: 'var(--text-primary)',
    fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share"
        style={{
          width: '100%', maxWidth: '400px', background: 'var(--surface)', borderRadius: '20px',
          padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>Share</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'var(--surface-hover)', color: 'var(--text-secondary)', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--surface-hover)', borderRadius: '12px', padding: '6px 6px 6px 12px' }}>
          <input
            readOnly
            value={url}
            onFocus={e => e.currentTarget.select()}
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: 'var(--text-primary)' }}
          />
          <button
            onClick={copy}
            style={{ border: 'none', borderRadius: '9px', padding: '8px 14px', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {targets.map(t => (
            <a key={t.label} href={t.href} target="_blank" rel="noopener noreferrer" style={pill}>{t.label}</a>
          ))}
        </div>

        {canNative && (
          <button onClick={nativeShare} style={{ ...pill, flex: 'none', width: '100%' }}>More options</button>
        )}
      </div>
    </div>
  )
}
