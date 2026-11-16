'use client'

import { Suspense } from 'react'
import useSWR from 'swr'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import CareersJobsBoard from '@/components/storefront/native/CareersJobsBoard'
import CareersManageTabs from '@/components/storefront/native/CareersManageTabs'

const fetcher = (url: string) => fetch(url).then(r => r.json())

/** Everyone sees the job board; managers also get a "Manage" view (roles and applications). */
function JobsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { data } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false })
  const isManager = data?.user?.role === 'MANAGER'

  if (isManager && params?.get('view') === 'manage') {
    return (
      <div style={{ width: '100%' }}>
        <button
          onClick={() => router.push('/jobs')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '4px 0' }}
        >
          <ArrowLeft size={14} /> Jobs
        </button>
        <CareersManageTabs />
      </div>
    )
  }

  return (
    <>
      {isManager && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn btn-secondary" onClick={() => router.push('/jobs?view=manage')}>Manage</button>
        </div>
      )}
      <CareersJobsBoard />
    </>
  )
}

export default function JobsPage() {
  return <Suspense fallback={null}><JobsContent /></Suspense>
}
