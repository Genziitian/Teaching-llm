import { redirect } from 'next/navigation'

import { getFullSession } from '@/lib/auth'
import AppleSurface from '@/components/ui/AppleSurface'

export default async function SupportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getFullSession()

  if (!session) {
    redirect('/login')
  }

  if (session.role !== 'STUDENT' && session.role !== 'MANAGER') {
    redirect('/dashboard')
  }

  return (
    <>
      <AppleSurface />
      {children}
    </>
  )
}
