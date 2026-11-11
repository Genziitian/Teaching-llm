'use client'

import useSWR from 'swr'

/**
 * Hosts the genziitian.in manager panel (built from /storefront-panel, same design as the
 * original) inside class genz. Same origin, so the class login cookie is used by its API calls.
 * tab = one of: users, 1on1, applications, employees, courses, boxes, booklets,
 * discounts, payments, followups, referrals, blogs, faqs, reviews, settings.
 * embed = hide the panel's own tab menu (used when a single tab is placed inside class genz).
 */
export default function StorefrontPanelFrame({ tab = 'users', embed = false }: { tab?: string; embed?: boolean }) {
  const { data, error } = useSWR('/api/storefront/access', (u: string) => fetch(u).then(r => (r.ok ? r.json() : Promise.reject(new Error('auth')))))

  if (error || (data && !data.allowed)) {
    return <div style={{ padding: 24, color: 'var(--text-secondary)', fontSize: 14 }}>Only managers can open this page.</div>
  }
  if (!data) {
    return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
  }

  const safeTab = tab.replace(/[^a-z0-9-]/gi, '')
  const src = `/storefront-panel/index.html#/manager/${safeTab}${embed ? '?embed=1' : ''}`
  return (
    <div>
      {data.open && data.role !== 'MANAGER' && (
        <div style={{ margin: '0 0 8px', padding: '8px 12px', borderRadius: 10, fontSize: 13, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
          Test mode: the storefront panel is open to every signed-in user. Turn off STOREFRONT_PANEL_OPEN_TO_ALL before going live.
        </div>
      )}
      <iframe
        key={src}
        src={src}
        title="Storefront manager"
        style={{ width: '100%', height: 'calc(100vh - 150px)', minHeight: 560, border: 0, borderRadius: 12, background: 'transparent' }}
      />
    </div>
  )
}
