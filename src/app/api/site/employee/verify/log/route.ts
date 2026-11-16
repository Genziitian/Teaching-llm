import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { readBody } from '@/lib/site/http'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { clientIp, findPublicEmployeeById, noStoreJson, normaliseEmployeeId, normaliseName, sessionEmail } from '../../shared'

export const dynamic = 'force-dynamic'

const STATUS_RE = /^[A-Za-z _-]{1,32}$/

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
}

/**
 * POST /api/site/employee/verify/log  { employeeId, fullName, found, status? }
 * Records a VERIFY action in employee_logs. The actor is the session email or 'anonymous' —
 * never taken from the body. The outcome text is derived server-side from the registry; the
 * client's claim is only used (and labelled as such) for records not in the registry.
 */
export async function POST(request: NextRequest) {
  const email = await sessionEmail()
  const actor = email || 'anonymous'

  const limit = await checkRateLimit(`site-employee-verify-log:${email || `ip:${clientIp(request)}`}`, 'general')
  if (!limit.success) return noStoreJson({ ok: false, error: 'Too many requests.' }, 429)

  const body = await readBody(request)
  const rawId = clip(body.employeeId, 64)
  const fullName = clip(body.fullName, 120)
  if (!rawId) return noStoreJson({ ok: false, error: 'employeeId is required.' }, 400)

  if (!isStorefrontConfigured()) return noStoreJson({ ok: true, logged: false })

  try {
    const id = normaliseEmployeeId(rawId)
    const registry = id ? await findPublicEmployeeById(id) : null
    const registryMatch = Boolean(registry && fullName && normaliseName(registry.full_name) === normaliseName(fullName))

    let employeeId = rawId
    let employeeName = fullName
    let details: string
    if (registry && registryMatch) {
      employeeId = registry.employee_id
      employeeName = registry.full_name
      details = `Verified record — Status: ${registry.status}`
    } else if (body.found === true) {
      const status = typeof body.status === 'string' && STATUS_RE.test(body.status.trim()) ? body.status.trim() : 'UNKNOWN'
      details = `Verified record (directory fallback, not in registry) — Status: ${status}`
    } else {
      details = 'Verification failed — No matching record found'
    }

    const { error } = await storefrontDb().from('employee_logs').insert({
      action_type: 'VERIFY',
      actor_email: actor,
      employee_id: employeeId,
      employee_name: employeeName || null,
      details,
    })
    if (error) throw error
    return noStoreJson({ ok: true, logged: true })
  } catch (err) {
    console.error('[site:employee/verify/log]', (err as Error)?.message || err)
    return noStoreJson({ ok: false, error: 'Could not record verification.' }, 500)
  }
}
