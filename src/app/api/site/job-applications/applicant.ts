import { storefrontDb } from '@/lib/storefront/db'

export const APPLICANT_MAX_ADDITIONS = 25
export const APPLICANT_LIMITS: Record<string, number> = { note: 1000, link: 500, subject: 120 }

export function sanitizeApplicationForApplicant(app: any) {
  const meta = app.metadata || {}
  return {
    id: app.id, role: app.role, role_title: app.role_title, status: app.status || 'PENDING',
    subject: app.subject || null, language: app.language || null, resume_link: app.resume_link || null,
    group_link: app.group_link || null, created_at: app.created_at, updated_at: app.updated_at,
    additions: Array.isArray(meta.user_additions) ? meta.user_additions : [],
  }
}

export async function findApplicationsForEmail(email: string): Promise<any[]> {
  const { data } = await storefrontDb().from('job_applications').select('*').eq('email', email).order('created_at', { ascending: false })
  return Array.isArray(data) ? data : []
}
