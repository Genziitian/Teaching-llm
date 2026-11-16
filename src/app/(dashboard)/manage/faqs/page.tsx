'use client'

import useSWR from 'swr'
import FaqsManager from '@/components/storefront/native/FaqsManager'

type Access = { allowed: boolean; open: boolean; role: string | null }

const accessFetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('auth'))))

export default function ManageFaqsPage() {
  const { data, error, isLoading } = useSWR<Access>('/api/storefront/access', accessFetcher)

  if (isLoading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
  }
  if (error || !data?.allowed) {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Course FAQs</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manager access required.</p>
      </div>
    )
  }
  return (
    <>
      {data.open && data.role !== 'MANAGER' && (
        <div style={{ margin: '0 0 8px', padding: '8px 12px', borderRadius: 10, fontSize: 13, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
          Test mode: storefront tools are open to every signed-in user. Turn off STOREFRONT_PANEL_OPEN_TO_ALL before going live.
        </div>
      )}
      <FaqsManager />
    </>
  )
}
