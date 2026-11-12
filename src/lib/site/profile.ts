import { storefrontDb } from '@/lib/storefront/db'
import { escapeLike } from '@/lib/site/http'

/**
 * Find the storefront `profiles` row for an email (case-insensitive).
 * The storefront's profiles table is keyed by Supabase auth user id; class genz users have no
 * Supabase auth user, so every lookup is by email. No profile is ever created here: the storefront
 * SQL files contain no profile trigger (profiles are written by the storefront signup flow), and
 * the original server code only ever read profiles.
 */
export async function findProfileByEmail(email: string, columns: string): Promise<any | null> {
  const { data } = await storefrontDb()
    .from('profiles')
    .select(columns)
    .ilike('email', escapeLike(email.trim()))
    .limit(1)
    .maybeSingle()
  return data || null
}
