import { NextResponse } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { requireManager, storefrontError } from '@/lib/storefront/guard'

export const dynamic = 'force-dynamic'

// GET: list all job applications (job_applications table merged with the activity_logs ledger).
export async function GET() {
  const g = await requireManager()
  if ('response' in g) return g.response
  try {
    const db = storefrontDb()
    const appMap = new Map<string, any>()

    try {
      const { data, error } = await db.from('job_applications').select('*').order('created_at', { ascending: false })
      if (!error && Array.isArray(data)) {
        for (const row of data) if (row && row.id) appMap.set(row.id, { ...(appMap.get(row.id) || {}), ...row })
      }
    } catch {}

    try {
      const { data: logs } = await db
        .from('activity_logs')
        .select('*')
        .eq('action', 'JOB_APPLICATION_SUBMITTED')
        .order('created_at', { ascending: false })
      if (Array.isArray(logs)) {
        for (const log of logs) {
          const meta = log.metadata || {}
          const bId = meta.id || `log-${log.id}`
          if (!appMap.has(bId)) {
            appMap.set(bId, {
              id: bId,
              role: meta.role || 'tutor',
              role_title: meta.role_title || 'Subject Tutor (Faculty)',
              full_name: meta.full_name || 'Candidate',
              email: (log.email || meta.email || '').trim().toLowerCase(),
              phone: meta.phone || '',
              is_iitm: meta.is_iitm,
              level: meta.level,
              subject: meta.subject,
              language: meta.language,
              cgpa: meta.cgpa,
              resume_link: meta.resume_link,
              official_email: meta.official_email,
              is_bs_student: meta.is_bs_student,
              is_group_owner: meta.is_group_owner,
              group_link: meta.group_link,
              group_members: meta.group_members,
              inquiries: meta.inquiries,
              metadata: meta,
              status: meta.status || 'PENDING',
              manager_notes: meta.manager_notes || '',
              created_at: log.created_at || meta.created_at || new Date().toISOString(),
              updated_at: log.created_at || meta.updated_at || new Date().toISOString(),
            })
          }
        }
      }
    } catch {}

    const applications = Array.from(appMap.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    )
    return NextResponse.json({ success: true, applications })
  } catch (error) {
    return storefrontError('job-applications:list', error)
  }
}
