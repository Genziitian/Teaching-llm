'use client'

import useSWR from 'swr'
import GenieMap from '@/components/genie/GenieMap'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function GenieMapPage() {
  const { data, isLoading } = useSWR('/api/auth/me', fetcher)
  const role = data?.user?.role

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--text-muted)' }}>Loading…</div>
  }
  if (role !== 'MANAGER') {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Genie Map</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manager access required.</p>
      </div>
    )
  }
  return <GenieMap />
}
