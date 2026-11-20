'use client'

import useSWR from 'swr'
import ReferralsManager from '@/components/storefront/native/ReferralsManager'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ReferralsPage() {
  const { data, isLoading } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false })

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--text-muted)' }}>Loading…</div>
  }
  if (data?.user?.role !== 'MANAGER') {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>Referrals</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manager access required.</p>
      </div>
    )
  }
  return <ReferralsManager />
}
