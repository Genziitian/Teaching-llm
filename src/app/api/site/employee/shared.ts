import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { escapeLike } from '@/lib/site/http'
import { storefrontDb } from '@/lib/storefront/db'

/** JSON response that must never be cached (per-user or audit data). */
export function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** Lower-cased email of the signed-in class genz user, or null. */
export async function sessionEmail(): Promise<string | null> {
  const session = await getSession()
  const email = session?.email?.trim().toLowerCase()
  return email || null
}

/** Best-effort client IP for rate-limit keys. */
export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Fields the employee's own ID card shows (their own email included). */
export const OWN_EMPLOYEE_COLUMNS = 'employee_id, full_name, email, department, role, tenure, status'

/** The only fields the public Verify page displays. Never add email/phone/documents/birth date here. */
export const PUBLIC_EMPLOYEE_COLUMNS = 'employee_id, full_name, department, role, tenure, status'

export type PublicEmployee = {
  employee_id: string
  full_name: string
  department: string
  role: string
  tenure: string
  status: string
}

/** Pick only public fields, so a select('*') or schema change can never leak private columns. */
export function toPublicEmployee(row: any): PublicEmployee {
  return {
    employee_id: String(row?.employee_id ?? ''),
    full_name: String(row?.full_name ?? ''),
    department: String(row?.department ?? ''),
    role: String(row?.role ?? ''),
    tenure: String(row?.tenure ?? ''),
    status: String(row?.status ?? ''),
  }
}

/** The employee record whose email matches the given (session) email, or null. */
export async function findEmployeeByEmail(email: string, columns: string = OWN_EMPLOYEE_COLUMNS) {
  const { data, error } = await storefrontDb()
    .from('employees')
    .select(columns)
    .ilike('email', escapeLike(email))
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as any) || null
}

/** Normalise an Employee ID query value; null when missing or implausible. */
export function normaliseEmployeeId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const id = raw.trim()
  if (!id || id.length > 64) return null
  if (!/^[A-Za-z0-9._\-\/]+$/.test(id)) return null
  return id
}

/** Normalise a name for case/whitespace-insensitive comparison. */
export function normaliseName(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').toLowerCase() : ''
}

/** Look up one employee by exact Employee ID, returning only public fields. */
export async function findPublicEmployeeById(employeeId: string): Promise<PublicEmployee | null> {
  const { data, error } = await storefrontDb()
    .from('employees')
    .select(PUBLIC_EMPLOYEE_COLUMNS)
    .eq('employee_id', employeeId)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? toPublicEmployee(data) : null
}
