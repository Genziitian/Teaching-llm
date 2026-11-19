import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import CallCenter from '@/components/support/CallCenter'

export default async function SupportCallsPage() {
  const session = await getSession()
  if (session?.role !== 'MANAGER') redirect('/support')
  return <CallCenter />
}
