import { randomBytes, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { readBody, jsonRes } from '@/lib/site/http'

export const dynamic = 'force-dynamic'

/**
 * POST /api/site/partner-coupons
 * Called server-to-server by partner platforms to issue a personal discount coupon.
 * The partner decides the discount and expiry; we fix: min order, max 1 use, locked to the email.
 *
 * Headers: x-api-key: <partner key>
 * Body:    {
 *   "email": "student@example.com",
 *   "discountType": "percentage" | "fixed",
 *   "discountValue": 20,                    // % or rupees (whole number)
 *   "expiresAt": "2026-11-30T18:29:59Z",    // ISO date-time  (or "validDays": 7)
 *   "maxDiscountAmount": 500                // optional, only meaningful for percentage
 * }
 * Returns: { code, expiresAt, discountType, discountValue, minOrderValue, reused }
 */

const DAY_MS = 24 * 60 * 60 * 1000

// 31-char alphabet without look-alikes (no 0/O/1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const randomChunk = (len: number) => {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

const generateCode = () => `GZ-${randomChunk(4)}-${randomChunk(4)}`

const envNumber = (name: string, fallback: number) => {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

// PARTNER_API_KEYS="partnerA:key1,partnerB:key2"
const resolvePartner = (providedKey: string): string | null => {
  const raw = process.env.PARTNER_API_KEYS || ''
  const provided = Buffer.from(providedKey)
  for (const entry of raw.split(',')) {
    const idx = entry.indexOf(':')
    if (idx < 1) continue
    const name = entry.slice(0, idx).trim()
    const key = Buffer.from(entry.slice(idx + 1).trim())
    if (name && key.length > 0 && key.length === provided.length && timingSafeEqual(key, provided)) {
      return name
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  const res = jsonRes(true)

  const apiKey = String(request.headers.get('x-api-key') || '').trim()
  const partner = apiKey ? resolvePartner(apiKey) : null
  if (!partner) {
    return res.status(401).json({ error: 'Invalid or missing API key' })
  }

  const body = await readBody(request)

  const email = String(body?.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'A valid email is required' })
  }

  // ---- discount terms (decided by the partner) ----
  const discountType = String(body?.discountType || '').toLowerCase()
  if (discountType !== 'percentage' && discountType !== 'fixed') {
    return res.status(400).json({ error: 'discountType must be "percentage" or "fixed"' })
  }

  const discountValue = Number(body?.discountValue)
  if (!Number.isInteger(discountValue) || discountValue < 1) {
    return res.status(400).json({ error: 'discountValue must be a whole number of at least 1' })
  }
  const maxPercent = envNumber('PARTNER_MAX_PERCENT', 100)
  if (discountType === 'percentage' && discountValue > maxPercent) {
    return res.status(400).json({ error: `Percentage cannot exceed ${maxPercent}` })
  }
  const maxFixed = envNumber('PARTNER_MAX_FIXED_AMOUNT', 0)
  if (discountType === 'fixed' && maxFixed > 0 && discountValue > maxFixed) {
    return res.status(400).json({ error: `Fixed amount cannot exceed ₹${maxFixed}` })
  }

  let maxDiscountAmount: number | null = null
  if (body?.maxDiscountAmount !== undefined && body?.maxDiscountAmount !== null) {
    maxDiscountAmount = Number(body.maxDiscountAmount)
    if (discountType !== 'percentage' || !Number.isInteger(maxDiscountAmount) || maxDiscountAmount < 1) {
      return res.status(400).json({ error: 'maxDiscountAmount must be a whole number and is only for percentage coupons' })
    }
  }

  const maxValidDays = envNumber('PARTNER_MAX_VALID_DAYS', 365)
  let expiresAtMs: number
  if (body?.expiresAt) {
    expiresAtMs = new Date(String(body.expiresAt)).getTime()
  } else if (body?.validDays) {
    expiresAtMs = Date.now() + Number(body.validDays) * DAY_MS
  } else {
    return res.status(400).json({ error: 'Provide expiresAt (ISO date-time) or validDays' })
  }
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 60 * 1000) {
    return res.status(400).json({ error: 'Expiry must be a valid time in the future' })
  }
  if (expiresAtMs > Date.now() + maxValidDays * DAY_MS) {
    return res.status(400).json({ error: `Expiry cannot be more than ${maxValidDays} days away` })
  }
  const expiresAt = new Date(expiresAtMs).toISOString()

  if (!isStorefrontConfigured()) {
    return res.status(500).json({ error: 'Server configuration error' })
  }
  const supabase = storefrontDb()
  const minOrderValue = envNumber('PARTNER_COUPON_MIN_ORDER', 350)

  const isPercent = discountType === 'percentage'
  const shape = (c: any, reused: boolean) => ({
    code: c.code,
    expiresAt: c.expires_at,
    discountType: c.discount_percentage ? 'percentage' : 'fixed',
    discountValue: c.discount_percentage || c.discount_amount,
    minOrderValue: c.min_order_value,
    reused,
  })

  try {
    // Live, unused coupons this partner already issued to this student
    const { data: live, error: liveError } = await supabase
      .from('discount_coupons')
      .select('code, expires_at, discount_percentage, discount_amount, min_order_value')
      .eq('partner_id', partner)
      .eq('issued_to_email', email)
      .eq('active', true)
      .eq('used_count', 0)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (liveError) throw liveError

    // Same discount already issued -> return it (student may have already copied it)
    const same = (live || []).find((c: any) =>
      isPercent
        ? Number(c.discount_percentage) === discountValue
        : Number(c.discount_amount) === discountValue && !c.discount_percentage
    )
    if (same) return res.status(200).json(shape(same, true))

    // Different terms -> issue an additional coupon. Older coupons are left active:
    // a student may hold several live coupons at once.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode()
      const row = {
        code,
        discount_percentage: isPercent ? discountValue : null,
        discount_amount: isPercent ? null : discountValue,
        max_discount_amount: maxDiscountAmount,
        applies_to: 'ALL',
        expires_at: expiresAt,
        max_uses: 1,
        min_order_value: minOrderValue,
        single_use_per_user: true,
        hidden: true,
        active: true,
        allowed_emails: [email],
        partner_id: partner,
        issued_to_email: email,
      }
      const { error } = await supabase.from('discount_coupons').insert(row)

      if (!error) {
        console.log(`[Partner Coupon] issued ${code} (${discountType} ${discountValue}) via ${partner}`)
        return res.status(201).json(shape(row, false))
      }
      if (error.code !== '23505') throw error // only retry on code collision
    }

    return res.status(500).json({ error: 'Could not generate a unique code, try again' })
  } catch (err: any) {
    console.error('[Partner Coupon] error:', err?.message || err)
    return res.status(500).json({ error: 'Failed to issue coupon' })
  }
}
