'use client'

import useSWR from 'swr'
import MailAssignerPageContent from '@/components/MailAssignerPanel'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function MailAssignerPage() {
  const { data: authData, isLoading } = useSWR('/api/auth/me', fetcher)
  const role = authData?.user?.role
  const allowed = role === 'MANAGER' || role === 'ADMIN'

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--text-muted)' }}>
        Loading…
      </div>
    )
  }

  if (!allowed) {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Mail Assigner</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manager access required.</p>
      </div>
    )
  }

  return <MailAssignerPageContent />
}
