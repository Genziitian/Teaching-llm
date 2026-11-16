// Server-only helpers for the session-scoped /api/site/me/* routes.
// The storefront's `profiles` and `referral_profiles` rows are keyed by a Supabase auth user id
// (`id UUID PRIMARY KEY REFERENCES auth.users(id)`). Class genz users sign in with the class
// session, so the storefront identity is resolved from the session email, case-insensitively.
import { storefrontDb } from '@/lib/storefront/db'
import { escapeLike } from '@/lib/site/http'

export const NO_STOREFRONT_ACCOUNT = 'NO_STOREFRONT_ACCOUNT'

const MISS_TTL_MS = 10 * 60 * 1000
const AUTH_SCAN_PAGE_SIZE = 1000
const AUTH_SCAN_MAX_PAGES = 50
const missCache = new Map<string, number>()

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function idFromTable(table: 'profiles' | 'referral_profiles', email: string): Promise<string | null> {
  const { data, error } = await storefrontDb()
    .from(table)
    .select('id')
    .ilike('email', escapeLike(email))
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as any)?.id ? String((data as any).id) : null
}

async function idFromAuthUsers(email: string): Promise<string | null> {
  const admin = storefrontDb().auth.admin
  for (let page = 1; page <= AUTH_SCAN_MAX_PAGES; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: AUTH_SCAN_PAGE_SIZE })
    if (error) throw error
    const users = data?.users || []
    const hit = users.find((u) => (u.email || '').trim().toLowerCase() === email)
    if (hit) return hit.id
    if (users.length < AUTH_SCAN_PAGE_SIZE) break
  }
  return null
}

/**
 * The storefront auth user id for an email: an existing storefront profile / referral profile id,
 * else a storefront Supabase auth user with that email. Null when the email has no storefront
 * account (rows keyed by auth.users cannot be created for it then).
 */
export async function findStorefrontUserIdByEmail(rawEmail: string): Promise<string | null> {
  const email = normalizeEmail(rawEmail)
  if (!email) return null

  const fromProfile = await idFromTable('profiles', email)
  if (fromProfile) return fromProfile
  const fromReferral = await idFromTable('referral_profiles', email)
  if (fromReferral) return fromReferral

  const missedAt = missCache.get(email)
  if (missedAt && Date.now() - missedAt < MISS_TTL_MS) return null

  const fromAuth = await idFromAuthUsers(email)
  if (fromAuth) {
    missCache.delete(email)
    return fromAuth
  }
  if (missCache.size > 5000) missCache.clear()
  missCache.set(email, Date.now())
  return null
}

export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' }
