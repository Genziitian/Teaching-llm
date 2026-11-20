import { NextRequest } from 'next/server'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { findEmployeeByEmail, noStoreJson, sessionEmail } from '../shared'

export const dynamic = 'force-dynamic'

/**
 * GET /api/site/employee/me[?check=1]
 * The signed-in user's own employee record (matched by session email), their photo and their own
 * birth date. `?check=1` returns only { isEmployee } (used by the navbar / menu).
 * Nobody can read another person's record here: the email always comes from the session.
 */
export async function GET(request: NextRequest) {
  const checkOnly = request.nextUrl.searchParams.get('check') === '1'

  const email = await sessionEmail()
  if (!email) {
    return noStoreJson({ error: 'Unauthorized: Authentication required', isEmployee: false }, 401)
  }

  if (!isStorefrontConfigured()) {
    if (checkOnly) return noStoreJson({ isEmployee: false })
    return noStoreJson({ error: 'Employee records are not available right now.', isEmployee: false }, 503)
  }

  try {
    if (checkOnly) {
      const row = await findEmployeeByEmail(email, 'employee_id')
      return noStoreJson({ isEmployee: Boolean(row) })
    }

    const employee = await findEmployeeByEmail(email)
    if (!employee) {
      return noStoreJson({ isEmployee: false, employee: null, photoUrl: '', dateOfBirth: '', partial: false })
    }

    const db = storefrontDb()
    const [photoResult, birthResult] = await Promise.all([
      db.from('employee_photos').select('photo_url').eq('employee_id', employee.employee_id).maybeSingle(),
      db.from('employee_birth_dates').select('date_of_birth').eq('employee_id', employee.employee_id).maybeSingle(),
    ])
    if (photoResult.error) console.error('[site:employee/me] photo', photoResult.error.message)
    if (birthResult.error) console.error('[site:employee/me] birth date', birthResult.error.message)

    return noStoreJson({
      isEmployee: true,
      employee: {
        employee_id: String(employee.employee_id ?? ''),
        full_name: String(employee.full_name ?? ''),
        email: String(employee.email ?? ''),
        department: String(employee.department ?? ''),
        role: String(employee.role ?? ''),
        tenure: String(employee.tenure ?? ''),
        status: String(employee.status ?? ''),
      },
      photoUrl: (photoResult.data as any)?.photo_url || '',
      dateOfBirth: (birthResult.data as any)?.date_of_birth || '',
      partial: Boolean(photoResult.error || birthResult.error),
    })
  } catch (err) {
    console.error('[site:employee/me]', (err as Error)?.message || err)
    return noStoreJson({ error: 'Your employee record could not be loaded. Please try again later.' }, 500)
  }
}
