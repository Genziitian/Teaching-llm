import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { findEmployeeByEmail, noStoreJson, sessionEmail } from '../../shared'

export const dynamic = 'force-dynamic'

/** Max stored photo value (data URL or URL), in characters. The crop dialog produces ~50–200 KB. */
const MAX_PHOTO_CHARS = Math.floor(1.5 * 1024 * 1024)
const MAX_URL_CHARS = 2048
const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/

type PhotoCheck = { ok: boolean; value: string; error: string }

function validatePhoto(raw: unknown): PhotoCheck {
  if (typeof raw !== 'string') return { ok: false, value: '', error: 'A photo is required.' }
  const value = raw.trim()
  if (!value) return { ok: false, value: '', error: 'A photo is required.' }
  if (value.length > MAX_PHOTO_CHARS) return { ok: false, value: '', error: 'Photo is too large. Choose a smaller image.' }

  if (value.startsWith('data:')) {
    const m = DATA_URL_RE.exec(value)
    if (!m || m[2].length < 16 || m[2].length % 4 !== 0) return { ok: false, value: '', error: 'Photo must be a valid image.' }
    return { ok: true, value, error: '' }
  }

  if (value.length > MAX_URL_CHARS) return { ok: false, value: '', error: 'Photo URL is too long.' }
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return { ok: false, value: '', error: 'Photo URL must use https.' }
    if (url.username || url.password) return { ok: false, value: '', error: 'Photo URL is not allowed.' }
    return { ok: true, value: url.toString(), error: '' }
  } catch {
    return { ok: false, value: '', error: 'Photo must be an image.' }
  }
}

/**
 * POST /api/site/employee/me/photo  { photoUrl }
 * Saves the photo for the signed-in user's OWN employee record (resolved from the session email).
 * The body cannot name a different employee.
 */
export async function POST(request: NextRequest) {
  const email = await sessionEmail()
  if (!email) return noStoreJson({ error: 'Unauthorized: Authentication required' }, 401)

  if (!isStorefrontConfigured()) {
    return noStoreJson({ error: 'Employee records are not available right now.' }, 503)
  }

  const limit = await checkRateLimit(`site-employee-photo:${email}`, 'general')
  if (!limit.success) return noStoreJson({ error: 'Too many requests. Please wait a minute and try again.' }, 429)

  const declared = Number(request.headers.get('content-length') || 0)
  if (declared && declared > MAX_PHOTO_CHARS + 4096) {
    return noStoreJson({ error: 'Photo is too large. Choose a smaller image.' }, 413)
  }

  let text: string
  try {
    text = await request.text()
  } catch {
    return noStoreJson({ error: 'Invalid request.' }, 400)
  }
  if (text.length > MAX_PHOTO_CHARS + 4096) {
    return noStoreJson({ error: 'Photo is too large. Choose a smaller image.' }, 413)
  }

  let body: any
  try {
    body = JSON.parse(text)
  } catch {
    return noStoreJson({ error: 'Invalid request.' }, 400)
  }

  const checked = validatePhoto(body?.photoUrl)
  if (!checked.ok) return noStoreJson({ error: checked.error }, 400)

  try {
    const employee = await findEmployeeByEmail(email, 'employee_id')
    if (!employee) return noStoreJson({ error: 'No employee record is linked to your account.' }, 403)

    const { error } = await storefrontDb()
      .from('employee_photos')
      .upsert({ employee_id: employee.employee_id, photo_url: checked.value }, { onConflict: 'employee_id' })
    if (error) throw error

    return noStoreJson({ ok: true, photoUrl: checked.value })
  } catch (err) {
    console.error('[site:employee/me/photo]', (err as Error)?.message || err)
    return noStoreJson({ error: 'Photo could not be saved.' }, 500)
  }
}
