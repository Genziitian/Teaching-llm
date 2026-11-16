'use client'

import { useState } from 'react'
import CareersRolesAdmin from './CareersRolesAdmin'
import CareersApplicationsAdmin from './CareersApplicationsAdmin'

export default function CareersManageTabs() {
  const [tab, setTab] = useState<'roles' | 'applications'>('roles')
  const t = (id: typeof tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{ padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: tab === id ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom: tab === id ? '2px solid var(--text-primary)' : '2px solid transparent' }}
    >{label}</button>
  )
  return (
    <div style={{ width: '100%', padding: '8px 0 48px' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border, #e5e7eb)', marginBottom: 16 }}>
        {t('roles', 'Open roles')}{t('applications', 'Applications')}
      </div>
      {tab === 'roles' ? <CareersRolesAdmin /> : <CareersApplicationsAdmin />}
    </div>
  )
}
