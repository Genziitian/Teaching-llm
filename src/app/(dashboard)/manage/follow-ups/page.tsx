'use client'

import useSWR from 'swr'
import FollowUpsManager from '@/components/storefront/native/FollowUpsManager'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function FollowUpsPage() {
  const { data, isLoading } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false })
  const user = data?.user

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--text-muted)' }}>Loading…</div>
  }
  if (user?.role !== 'MANAGER') {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Follow-ups</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manager access required.</p>
      </div>
    )
  }
  return <FollowUpsManager userEmail={typeof user?.email === 'string' ? user.email : null} />
}
