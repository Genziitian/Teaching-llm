import { redirect } from 'next/navigation'
import { getFullSession } from '@/lib/auth'
import { UserDataProvider } from '@/components/UserDataProvider'

// Standalone layout: no sidebar, header or logo. Same sign-in guards as the dashboard.
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const session = await getFullSession()
  if (!session) redirect('/login')
  if (session.isTerminated) redirect('/terminated')
  if (session.isMaintenanceMode) redirect('/maintenance')
  return <UserDataProvider><div style={{ height: '100dvh', overflowY: 'auto', overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', background: 'var(--bg)' }}>{children}</div></UserDataProvider>
}
