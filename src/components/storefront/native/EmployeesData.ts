// Data access for the native Employees manager. All reads/writes go through /api/storefront/db
// (storefrontDb shim). employee_birth_dates and employee_identity_documents are super-manager-only
// tables: the server answers 403 for anyone else, and this module surfaces that as `forbidden`.
import { supabase } from './storefrontDb'
import type { Employee, EmployeePayload } from './EmployeesTypes'

type DbError = { message: string; code?: string } | null
type DbResult = { data: any; error: DbError; count: number | null; status: number }

const run = (q: any): Promise<DbResult> => q as Promise<DbResult>

export const isMissingTable = (error: DbError) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message || ''))

export async function loadEmployees(): Promise<{ employees: Employee[]; photos: Record<string, string>; error: DbError }> {
  const res = await run(supabase.from('employees').select('*').order('created_at', { ascending: false }))
  if (res.error) return { employees: [], photos: {}, error: res.error }
  const employees: Employee[] = Array.isArray(res.data) ? res.data.filter(Boolean) : []
  const photosRes = await run(supabase.from('employee_photos').select('employee_id, photo_url'))
  const photos: Record<string, string> = {}
  if (!photosRes.error && Array.isArray(photosRes.data)) {
    for (const p of photosRes.data) if (p?.employee_id && p?.photo_url) photos[p.employee_id] = p.photo_url
  }
  return { employees, photos, error: null }
}

/** True when the signed-in manager may read the private (DOB / ID document) tables. */
export async function probePrivateAccess(): Promise<boolean> {
  const res = await run(supabase.from('employee_birth_dates').select('employee_id').limit(1))
  return !(res.status === 401 || res.status === 403)
}

export async function loadPrivateDetails(employeeId: string): Promise<{ dateOfBirth: string; documentType: string; documentNumber: string; forbidden: boolean; error: DbError }> {
  const [birth, doc] = await Promise.all([
    run(supabase.from('employee_birth_dates').select('date_of_birth').eq('employee_id', employeeId).maybeSingle()),
    run(supabase.from('employee_identity_documents').select('document_type, document_number').eq('employee_id', employeeId).maybeSingle()),
  ])
  const forbidden = [birth.status, doc.status].some((s) => s === 401 || s === 403)
  return {
    dateOfBirth: birth.data?.date_of_birth ? String(birth.data.date_of_birth).slice(0, 10) : '',
    documentType: doc.data?.document_type || '',
    documentNumber: doc.data?.document_number || '',
    forbidden,
    error: forbidden ? null : birth.error || doc.error,
  }
}

export async function loadPhoto(employeeId: string): Promise<string> {
  const res = await run(supabase.from('employee_photos').select('photo_url').eq('employee_id', employeeId).maybeSingle())
  return res.error ? '' : res.data?.photo_url || ''
}

export async function savePhoto(employeeId: string, photoUrl: string): Promise<DbError> {
  const existing = await run(supabase.from('employee_photos').select('employee_id').eq('employee_id', employeeId).maybeSingle())
  if (existing.error) return existing.error
  const res = existing.data
    ? await run(supabase.from('employee_photos').update({ photo_url: photoUrl }).eq('employee_id', employeeId))
    : await run(supabase.from('employee_photos').insert({ employee_id: employeeId, photo_url: photoUrl }))
  return res.error
}

export async function updateEmployee(id: string, payload: EmployeePayload): Promise<DbError> {
  const res = await run(supabase.from('employees').update(payload).eq('id', id))
  return res.error
}

export async function insertEmployee(payload: EmployeePayload): Promise<{ id: string | null; error: DbError }> {
  const res = await run(supabase.from('employees').insert([payload]).select('id').single())
  return { id: res.data?.id || null, error: res.error }
}

export async function savePrivateDetails(employeeId: string, dateOfBirth: string, documentType: string, documentNumber: string): Promise<DbError> {
  const birth = await run(supabase.from('employee_birth_dates').upsert({ employee_id: employeeId, date_of_birth: dateOfBirth }, { onConflict: 'employee_id' }))
  if (birth.error) return birth.error
  const doc = await run(
    supabase.from('employee_identity_documents').upsert({ employee_id: employeeId, document_type: documentType, document_number: documentNumber }, { onConflict: 'employee_id' }),
  )
  return doc.error
}

export async function deleteEmployee(id: string): Promise<DbError> {
  const res = await run(supabase.from('employees').delete().eq('id', id))
  return res.error
}

let actorEmailPromise: Promise<string> | null = null
export function getActorEmail(): Promise<string> {
  if (!actorEmailPromise) {
    actorEmailPromise = fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => String(j?.user?.email || 'unknown'))
      .catch(() => 'unknown')
  }
  return actorEmailPromise
}

/** Best-effort audit trail in employee_logs; failures never block the main action. */
export async function insertAuditLog(action: 'CREATE' | 'UPDATE' | 'DELETE', employeeId: string, employeeName: string, details: string): Promise<void> {
  try {
    const actorEmail = await getActorEmail()
    const res = await run(
      supabase.from('employee_logs').insert([{ action_type: action, actor_email: actorEmail, employee_id: employeeId, employee_name: employeeName, details }]),
    )
    if (res.error) console.warn('Employee audit log insert failed:', res.error.message)
  } catch (err) {
    console.warn('Employee audit log insert failed:', err)
  }
}
