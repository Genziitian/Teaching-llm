import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { storefrontDb } from '@/lib/storefront/db'
import { readBody } from '@/lib/storefront/bookings/helpers'
import { APPLICANT_LIMITS, APPLICANT_MAX_ADDITIONS, findApplicationsForEmail, sanitizeApplicationForApplicant } from '../applicant'

export const dynamic = 'force-dynamic'

// Append-only: applicants can add notes / links / subjects to their own application.
export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.email) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  try {
    const email = session.email.trim().toLowerCase()
    const body = await readBody(request)
    const { id, type } = body
    let value = String(body.value ?? '').trim()
    if (!id || !['note', 'link', 'subject'].includes(type)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    if (!value) return NextResponse.json({ error: 'Please enter something to add.' }, { status: 400 })
    if (value.length > APPLICANT_LIMITS[type]) return NextResponse.json({ error: `Too long (max ${APPLICANT_LIMITS[type]} characters).` }, { status: 400 })
    if (type === 'link') {
      try {
        const u = new URL(value)
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad')
        value = u.toString()
      } catch {
        return NextResponse.json({ error: 'Enter a valid link starting with https://' }, { status: 400 })
      }
    }
    const label = String(body.label ?? '').trim().slice(0, 80)
    const target = (await findApplicationsForEmail(email)).find((a) => a.id === id)
    if (!target) return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
    const existing: any[] = Array.isArray(target.metadata?.user_additions) ? target.metadata.user_additions : []
    if (existing.length >= APPLICANT_MAX_ADDITIONS) return NextResponse.json({ error: `You can add up to ${APPLICANT_MAX_ADDITIONS} items per application.` }, { status: 400 })
    if (existing.some((a) => a.type === type && String(a.value).toLowerCase() === value.toLowerCase())) {
      return NextResponse.json({ error: 'You have already added this.' }, { status: 400 })
    }
    const entry = { id: `add-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, type, value, label: label || null, added_at: new Date().toISOString() }
    const nextMeta = { ...(target.metadata || {}), user_additions: [...existing, entry] }
    const updatedAt = new Date().toISOString()
    const db = storefrontDb()
    const { error } = await db.from('job_applications').update({ metadata: nextMeta, updated_at: updatedAt }).eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to save. Please try again.' }, { status: 500 })
    try { await db.from('activity_logs').insert({ email, action: 'JOB_APPLICATION_INFO_ADDED', metadata: { id, entry } }) } catch {}
    return NextResponse.json({ success: true, entry, application: sanitizeApplicationForApplicant({ ...target, metadata: nextMeta, updated_at: updatedAt }) })
  } catch (err) {
    console.error('[site:job-applications/add-info]', (err as Error).message)
    return NextResponse.json({ error: 'Failed to save. Please try again.' }, { status: 500 })
  }
}
