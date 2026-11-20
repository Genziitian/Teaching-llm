'use client'

import { Suspense } from 'react'
import useSWR from 'swr'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import CareersJobsBoard from '@/components/storefront/native/CareersJobsBoard'
import CareersManageTabs from '@/components/storefront/native/CareersManageTabs'
import JobsWorkspace, { useHasWork } from '@/components/storefront/native/JobsWorkspace'

const fetcher = (url: string) => fetch(url).then(r => r.json())

/** Everyone sees the job board; managers also get a "Manage" view (roles and applications). */
function JobsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { data } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false })
  const isManager = data?.user?.role === 'MANAGER'
  const hasWork = useHasWork()
  const tab = params?.get('view') === 'work' ? 'work' : 'board'

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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {hasWork && (['board', 'work'] as const).map((t) => (
            <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => router.push(t === 'work' ? '/jobs?view=work' : '/jobs')}>
              {t === 'board' ? 'Open roles' : 'My work'}
            </button>
          ))}
        </div>
        {isManager && <button className="btn btn-secondary" onClick={() => router.push('/jobs?view=manage')}>Manage</button>}
      </div>
      {tab === 'work' && hasWork ? <JobsWorkspace /> : <CareersJobsBoard />}
    </>
  )
}

export default function JobsPage() {
  return <Suspense fallback={null}><JobsContent /></Suspense>
}
