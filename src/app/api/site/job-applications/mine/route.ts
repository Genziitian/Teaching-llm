import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { findApplicationsForEmail, sanitizeApplicationForApplicant } from '../applicant'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.email) return NextResponse.json({ error: 'Please sign in to track your applications.' }, { status: 401 })
  try {
    const apps = await findApplicationsForEmail(session.email.trim().toLowerCase())
    return NextResponse.json({ success: true, applications: apps.map(sanitizeApplicationForApplicant) })
  } catch (err) {
    console.error('[site:job-applications/mine]', (err as Error).message)
    return NextResponse.json({ error: 'Failed to load your applications' }, { status: 500 })
  }
}
