// Server access to the website data (profiles, website_orders, settings, blogs, employees ...).
// This data now lives in the platform database (see src/lib/site-db/engine.ts); the supabase-style API is unchanged
// so all callers keep working. The old Supabase project is only used by the one-off import.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { siteClient } from '@/lib/site-db/engine'

export class StorefrontNotConfiguredError extends Error {
  constructor() {
    super('The old website database is not connected. Set STOREFRONT_SUPABASE_URL and STOREFRONT_SUPABASE_SERVICE_ROLE_KEY to import from it.')
    this.name = 'StorefrontNotConfiguredError'
  }
}

/** The website data always lives in the platform database now. */
export function isStorefrontConfigured(): boolean {
  return true
}

export function storefrontDb(): any {
  return siteClient()
}

// --- old Supabase project: import only ---------------------------------------------------------------
let legacy: SupabaseClient | null = null

export function isLegacyDbConfigured(): boolean {
  return Boolean(process.env.STOREFRONT_SUPABASE_URL?.trim() && process.env.STOREFRONT_SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export function legacyStorefrontDb(): SupabaseClient {
  const url = process.env.STOREFRONT_SUPABASE_URL?.trim()
  const key = process.env.STOREFRONT_SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new StorefrontNotConfiguredError()
  if (!legacy) legacy = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return legacy
}
