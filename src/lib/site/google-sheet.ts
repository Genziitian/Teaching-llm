import { storefrontDb } from '@/lib/storefront/db'

/**
 * Append a purchase / failure row to the storefront's Google Sheet (Apps Script webhook at
 * GOOGLE_SHEET_WEBHOOK_URL). Never throws: logging must not break the payment flow.
 */
export async function sendToGoogleSheet(payload: Record<string, unknown>, timeoutMs = 15000): Promise<void> {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL?.trim()
  if (!url) {
    console.warn('[site:google-sheet] GOOGLE_SHEET_WEBHOOK_URL not set, skipping sheet log.')
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error('[site:google-sheet] Sheet webhook failed:', res.status)
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.error(`[site:google-sheet] Sheet log timed out (${Math.round(timeoutMs / 1000)}s)`)
    } else {
      console.error('[site:google-sheet] Sheet log error:', err?.message || 'unknown')
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Human-readable course names and class types for a list of storefront course ids, as the
 * original server built them for the sheet: course_catalog names first, falling back to courses.
 */
export async function getCourseSummary(courseIds: unknown): Promise<{ courseNames: string; classTypes: string }> {
  let courseNames = 'Unknown Course'
  let classTypes = ''
  const ids = Array.isArray(courseIds) ? courseIds.filter((id): id is string => typeof id === 'string' && id.length > 0) : []
  if (ids.length === 0) return { courseNames, classTypes }

  const supabase = storefrontDb()
  const [{ data: catalog }, { data: fullCourses }] = await Promise.all([
    supabase.from('course_catalog').select('name').in('id', ids),
    supabase.from('courses').select('id, name, class_type').in('id', ids),
  ])

  if (catalog && catalog.length > 0) {
    courseNames = Array.from(new Set(catalog.map((c: any) => c.name).filter(Boolean))).join(', ') || courseNames
  } else if (fullCourses && fullCourses.length > 0) {
    courseNames = Array.from(new Set(fullCourses.map((c: any) => c.name).filter(Boolean))).join(', ') || courseNames
  }

  if (fullCourses && fullCourses.length > 0) {
    classTypes = Array.from(new Set(fullCourses.map((c: any) => c.class_type).filter(Boolean))).join(', ')
  }

  return { courseNames, classTypes }
}
