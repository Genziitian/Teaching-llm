import { NextResponse } from 'next/server'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { CAREERS_ROLES_KEY, DEFAULT_CAREERS_ROLES, parseCareersRoles } from '@/components/storefront/native/CareersTypes'

export const dynamic = 'force-dynamic'

// Public read of the open careers roles (stored in storefront settings, falls back to the landing defaults).
export async function GET() {
  let roles = DEFAULT_CAREERS_ROLES
  if (isStorefrontConfigured()) {
    try {
      const { data } = await storefrontDb().from('settings').select('value').eq('key', CAREERS_ROLES_KEY).maybeSingle()
      if (data?.value) roles = parseCareersRoles(data.value)
    } catch {}
  }
  return NextResponse.json({ roles: roles.filter((r) => r.open) })
}
