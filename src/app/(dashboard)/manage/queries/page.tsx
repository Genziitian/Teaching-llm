'use client'

import { ManagePageInner } from '../ManagePageContent'
import { Suspense } from 'react'

export default function QueriesPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--accent)' }}>
        <div className="animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    }>
      <ManagePageInner forcedTab="queries" />
    </Suspense>
  )
}
