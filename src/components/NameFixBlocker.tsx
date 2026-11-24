'use client'

import React, { useState } from 'react'
import type { FullSession } from '@/lib/auth'
import { NAME_DIGIT_ERROR, nameHasDigit } from '@/lib/name-validation'

// Shown to existing users whose saved name contains digits; they cannot enter the app until fixed.
export default function NameFixBlocker({ user }: { user: FullSession }) {
  const parts = (user.name || '').trim().split(/\s+/)
  const [firstName, setFirstName] = useState(parts[0] || '')
  const [lastName, setLastName] = useState(parts.slice(1).join(' '))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fn = firstName.trim(), ln = lastName.trim()
    if (!fn || !ln) return setError('Please enter both your first and last name.')
    if (nameHasDigit(fn, ln)) return setError(NAME_DIGIT_ERROR)
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: fn, lastName: ln, name: `${fn} ${ln}` }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to update name')
      window.location.reload()
    } catch (err: any) {
      setError(err.message || 'Failed to update name')
      setLoading(false)
    }
  }

  const input: React.CSSProperties = { width: '100%' }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-fix-title"
      style={{ position: 'fixed', inset: 0, background: 'url(/auth-bg.svg) center/cover no-repeat, #f3f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: '16px', overflowY: 'auto' }}
    >
      <div className="fade-in" style={{ background: 'var(--surface)', width: '100%', maxWidth: '460px', padding: '28px', borderRadius: '14px', boxShadow: '0 20px 45px rgba(0,0,0,0.08)', margin: 'auto' }}>
        <h1 id="name-fix-title" style={{ fontSize: '21px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Your name is incorrect
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
          Your name <strong>&ldquo;{user.name}&rdquo;</strong> contains numbers. We take this seriously. You have to change it to your real name now, otherwise we can&rsquo;t let you in.
        </p>

        {error && (
          <div role="alert" style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 600, marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="nf-first">First name</label>
            <input id="nf-first" className="form-input" style={input} value={firstName} onChange={e => { setFirstName(e.target.value); setError('') }} autoFocus />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="nf-last">Last name</label>
            <input id="nf-last" className="form-input" style={input} value={lastName} onChange={e => { setLastName(e.target.value); setError('') }} />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: '15px', fontWeight: 600, borderRadius: '12px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving...' : 'Update name'}
          </button>
        </form>
      </div>
    </div>
  )
}
