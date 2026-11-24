import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { isStorefrontConfigured } from '@/lib/storefront/db'
import { clientIp, findPublicEmployeeById, noStoreJson, normaliseEmployeeId, normaliseName, sessionEmail } from '../shared'

export const dynamic = 'force-dynamic'

/**
 * GET /api/site/employee/verify?id=GENZ-EMP-0000[&name=Full Name]
 * Public employment verification. Returns ONLY the fields the Verify page shows
 * (employee_id, full_name, department, role, tenure, status) — never email, phone,
 * identity documents, photo or birth date. When `name` is given, the record is returned
 * only if the name matches (case/whitespace-insensitive).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const id = normaliseEmployeeId(params.get('id'))
  if (!id) return noStoreJson({ error: 'A valid Employee ID is required.' }, 400)
  const name = normaliseName(params.get('name'))

  const actor = (await sessionEmail()) || `ip:${clientIp(request)}`
  const limit = await checkRateLimit(`site-employee-verify:${actor}`, 'general')
  if (!limit.success) return noStoreJson({ error: 'Too many verification attempts. Please wait a minute and try again.' }, 429)

  if (!isStorefrontConfigured()) return noStoreJson({ employee: null })

  try {
    const employee = await findPublicEmployeeById(id)
    if (!employee) return noStoreJson({ employee: null })
    if (name && normaliseName(employee.full_name) !== name) return noStoreJson({ employee: null })
    return noStoreJson({ employee })
  } catch (err) {
    console.error('[site:employee/verify]', (err as Error)?.message || err)
    return noStoreJson({ error: 'An error occurred while querying the registry. Please try again.' }, 500)
  }
}
