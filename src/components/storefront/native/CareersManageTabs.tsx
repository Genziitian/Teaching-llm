'use client'

import { useState } from 'react'
import PageShell from '../PageShell'
import CareersRolesAdmin from './CareersRolesAdmin'
import CareersApplicationsAdmin from './CareersApplicationsAdmin'

export default function CareersManageTabs() {
  const [tab, setTab] = useState<'roles' | 'applications'>('roles')
  const t = (id: typeof tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{ padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: tab === id ? '#2563eb' : 'var(--text-secondary)', borderBottom: tab === id ? '2px solid #2563eb' : '2px solid transparent' }}
    >{label}</button>
  )
  return (
    <PageShell title="Careers" description="Manage open roles and review job applications.">
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border, #e5e7eb)', marginBottom: 16 }}>
        {t('roles', 'Open roles')}{t('applications', 'Applications')}
      </div>
      {tab === 'roles' ? <CareersRolesAdmin /> : <CareersApplicationsAdmin />}
    </PageShell>
  )
}
