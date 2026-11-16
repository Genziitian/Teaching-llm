import { storefrontDb } from '@/lib/storefront/db'
import { escapeLike } from '@/lib/site/http'

export type AutomatedEmailType = 'abandoned' | 'nudge' | 'missyou'

export interface AutomatedEmailReport {
  abandonedSent: string[]
  nudgeSent: string[]
  missyouSent: string[]
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
/** Pause between sends so the Apps Script / Gmail quota is not hammered (as in the original). */
const SEND_GAP_MS = 2000

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()

/** True if the email has a real (non-auto, non-free) PAID storefront order. */
async function hasRealPaidPurchase(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false

  const { data, error } = await storefrontDb()
    .from('website_orders')
    .select('order_id')
    .ilike('user_email', escapeLike(normalized))
    .eq('status', 'PAID')
    .not('order_id', 'like', 'AUTO_%')
    .gt('total_amount', 0)
    .limit(1)

  if (error) {
    console.error('[Automated Emails] Purchase check failed:', error.message)
    // Unknown -> treat as purchased so a buyer is never sent a "you haven't bought yet" email.
    return true
  }
  return Array.isArray(data) && data.length > 0
}

async function alreadySent(email: string, type: AutomatedEmailType): Promise<boolean> {
  const { data, error } = await storefrontDb()
    .from('activity_logs')
    .select('id')
    .eq('email', email)
    .eq('action', 'EMAIL_SENT')
    .contains('metadata', { type })
    .limit(1)
  if (error) {
    console.error(`[Automated Emails] Sent-log check failed (${type}):`, error.message)
    return true // fail closed: never risk a duplicate email
  }
  return Array.isArray(data) && data.length > 0
}

async function sendAndRecord(
  webhookUrl: string,
  email: string,
  type: AutomatedEmailType,
  extra: Record<string, unknown>
): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...extra, type, timestamp: new Date().toISOString() }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`)
    } finally {
      clearTimeout(timeout)
    }

    const { error } = await storefrontDb()
      .from('activity_logs')
      .insert({ email, action: 'EMAIL_SENT', metadata: { type, timestamp: new Date().toISOString() } })
    if (error) console.error(`[Automated Emails] Failed to record ${type} send:`, error.message)
    return true
  } catch (err: any) {
    console.error(`[Automated Emails] Failed to trigger ${type} email:`, err?.message || 'unknown')
    return false
  }
}

/**
 * Port of the storefront's automated email job (api/cron-check-emails.ts):
 *  1. abandoned: CREATED orders 2 hours to 7 days old, buyer has no real paid purchase
 *  2. nudge:     profiles 4 hours to 7 days old with no real paid purchase
 *  3. missyou:   profiles 7 to 30 days old with no real paid purchase
 * Each type is sent at most once per email (ledger: activity_logs EMAIL_SENT).
 */
export async function processAutomatedEmails(webhookUrl: string): Promise<AutomatedEmailReport> {
  const supabase = storefrontDb()
  const report: AutomatedEmailReport = { abandonedSent: [], nudgeSent: [], missyouSent: [] }

  const now = Date.now()
  const twoHoursAgo = new Date(now - 2 * HOUR_MS).toISOString()
  const fourHoursAgo = new Date(now - 4 * HOUR_MS).toISOString()
  const sevenDaysAgo = new Date(now - 7 * DAY_MS).toISOString()
  const thirtyDaysAgo = new Date(now - 30 * DAY_MS).toISOString()

  // 1. Abandoned checkout recovery
  const { data: abandonedOrders, error: abandonedError } = await supabase
    .from('website_orders')
    .select('user_email, course_ids, created_at')
    .eq('status', 'CREATED')
    .gte('created_at', sevenDaysAgo)
    .lte('created_at', twoHoursAgo)
  if (abandonedError) throw abandonedError

  const handledAbandoned = new Set<string>()
  for (const order of abandonedOrders || []) {
    const email = String(order.user_email || '').trim()
    if (!email || handledAbandoned.has(email.toLowerCase())) continue
    handledAbandoned.add(email.toLowerCase())

    if (await alreadySent(email, 'abandoned')) continue
    if (await hasRealPaidPurchase(email)) continue

    let courseNames = 'your course'
    if (Array.isArray(order.course_ids) && order.course_ids.length > 0) {
      const { data: coursesData } = await supabase.from('courses').select('name').in('id', order.course_ids)
      if (coursesData && coursesData.length > 0) {
        courseNames = coursesData.map((c: any) => c.name).join(', ')
      }
    }

    if (await sendAndRecord(webhookUrl, email, 'abandoned', { name: email.split('@')[0], courseName: courseNames })) {
      report.abandonedSent.push(email)
    }
    await delay(SEND_GAP_MS)
  }

  // 2. Nudge and 3. Miss you: recent sign-ups with no purchase
  const profileWindows: { type: 'nudge' | 'missyou'; from: string; to: string; list: string[] }[] = [
    { type: 'nudge', from: sevenDaysAgo, to: fourHoursAgo, list: report.nudgeSent },
    { type: 'missyou', from: thirtyDaysAgo, to: sevenDaysAgo, list: report.missyouSent },
  ]

  for (const window of profileWindows) {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('email, name, created_at')
      .gte('created_at', window.from)
      .lte('created_at', window.to)
    if (error) throw error

    for (const profile of profiles || []) {
      const email = String(profile.email || '').trim()
      if (!email) continue

      if (await alreadySent(email, window.type)) continue
      if (await hasRealPaidPurchase(email)) continue

      if (await sendAndRecord(webhookUrl, email, window.type, { name: profile.name })) {
        window.list.push(email)
      }
      await delay(SEND_GAP_MS)
    }
  }

  return report
}
