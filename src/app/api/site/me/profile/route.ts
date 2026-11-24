import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { escapeLike, readBody } from '@/lib/site/http'
import { findStorefrontUserIdByEmail, NO_STOREFRONT_ACCOUNT, NO_STORE_HEADERS } from '@/lib/site/me'

export const dynamic = 'force-dynamic'

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  return v ? v.slice(0, max) : undefined
}

/**
 * POST /api/site/me/profile   Body: { name?, gender?, phone? }
 * Upserts the storefront `profiles` row of the signed-in user (session email, case-insensitive).
 * An existing row keeps its id; a new row needs the user's storefront auth id (profiles.id
 * references auth.users). With no storefront account nothing is written: { saved: false, reason }.
 */
export async function POST(request: NextRequest) {
  if (!isStorefrontConfigured()) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
  }
  const session = await getSession()
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
  }

  const body = await readBody(request)
  const name = cleanText(body.name, 100)
  const gender = cleanText(body.gender, 20)
  const phoneRaw = cleanText(body.phone, 20)
  const phone = phoneRaw ? phoneRaw.replace(/[^\d+]/g, '') : undefined
  if (phoneRaw && (!phone || phone.replace(/\D/g, '').length < 7 || phone.length > 15)) {
    return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 })
  }

  const fields: Record<string, string> = {}
  if (name) fields.name = name
  if (gender) fields.gender = gender
  if (phone) fields.phone = phone
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  }

  const email = session.email.trim().toLowerCase()
  const db = storefrontDb()

  try {
    const { data: existing, error: findError } = await db
      .from('profiles')
      .select('id')
      .ilike('email', escapeLike(email))
      .limit(1)
      .maybeSingle()
    if (findError) throw findError

    if (existing?.id) {
      const { error } = await db.from('profiles').update(fields).eq('id', existing.id)
      if (error) throw error
      return NextResponse.json({ saved: true }, { headers: NO_STORE_HEADERS })
    }

    const userId = await findStorefrontUserIdByEmail(email)
    if (!userId) {
      return NextResponse.json({ saved: false, reason: NO_STOREFRONT_ACCOUNT }, { headers: NO_STORE_HEADERS })
    }

    const { error } = await db.from('profiles').upsert({ id: userId, email, ...fields }, { onConflict: 'id' })
    if (error) throw error
    return NextResponse.json({ saved: true }, { headers: NO_STORE_HEADERS })
  } catch (err: any) {
    console.error('[site:me/profile] error:', err?.message || 'unknown')
    return NextResponse.json({ error: 'Could not save your profile. Please try again.' }, { status: 500 })
  }
}
