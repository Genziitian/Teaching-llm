// Server-only access to the genziitian.in storefront database (Supabase).
// Interim data layer: the storefront tools in class genz read/write the storefront's own
// Supabase project so the public genziitian pages keep working with no data migration.
// When the databases are merged, only this file and the repositories built on it change.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export class StorefrontNotConfiguredError extends Error {
  constructor() {
    super('The storefront database is not connected yet. Set STOREFRONT_SUPABASE_URL and STOREFRONT_SUPABASE_SERVICE_ROLE_KEY.')
    this.name = 'StorefrontNotConfiguredError'
  }
}

let cached: SupabaseClient | null = null

export function isStorefrontConfigured(): boolean {
  return Boolean(process.env.STOREFRONT_SUPABASE_URL?.trim() && process.env.STOREFRONT_SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export function storefrontDb(): SupabaseClient {
  const url = process.env.STOREFRONT_SUPABASE_URL?.trim()
  const key = process.env.STOREFRONT_SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new StorefrontNotConfiguredError()
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return cached
}
