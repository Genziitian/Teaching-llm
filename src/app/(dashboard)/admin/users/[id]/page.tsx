'use client'

import { useParams, useRouter } from 'next/navigation'
import ManagerUserModal from '@/components/ManagerUserModal'

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : null

  if (!id) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        User ID not found in route.
      </div>
    )
  }

  return (
    <ManagerUserModal
      userId={id}
      mode="page"
      onClose={() => router.push('/admin')}
      onUpdate={() => router.refresh()}
    />
  )
}
