'use client'

import useSWR from 'swr'

/**
 * Hosts the genziitian.in manager panel (built from /storefront-panel, same design as the
 * original) inside class genz. Same origin, so the class login cookie is used by its API calls.
 * tab = one of: users, 1on1, applications, employees, logs, courses, boxes, booklets,
 * discounts, payments, followups, referrals, blogs, faqs, reviews, settings.
 * embed = hide the panel's own tab menu (used when a single tab is placed inside class genz).
 */
export default function StorefrontPanelFrame({ tab = 'users', embed = false }: { tab?: string; embed?: boolean }) {
  const { data, error } = useSWR('/api/auth/me', (u: string) => fetch(u).then(r => (r.ok ? r.json() : Promise.reject(new Error('auth')))))
  const role = data?.user?.role

  if (error || (data && role !== 'MANAGER')) {
    return <div style={{ padding: 24, color: 'var(--text-secondary)', fontSize: 14 }}>Only managers can open this page.</div>
  }
  if (!data) {
    return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
  }

  const safeTab = tab.replace(/[^a-z0-9-]/gi, '')
  const src = `/storefront-panel/index.html#/manager/${safeTab}${embed ? '?embed=1' : ''}`
  return (
    <iframe
      key={src}
      src={src}
      title="Storefront manager"
      style={{ width: '100%', height: 'calc(100vh - 120px)', minHeight: 560, border: 0, borderRadius: 12, background: 'transparent' }}
    />
  )
}
