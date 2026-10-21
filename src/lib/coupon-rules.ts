import { prisma } from '@/lib/db'

export type CouponCheckInput = {
  code: string
  userId: string
  email: string
  bundleOfferingId?: string | null
  courseIds?: string[]
  accessTypes?: string[]
  /** Amount the coupon applies to (after any bundle discount). */
  subtotal: number
}

export type CouponCheckResult =
  | { ok: true; coupon: any; discountAmount: number }
  | { ok: false; error: string; status: number }

const fail = (error: string, status = 400): CouponCheckResult => ({ ok: false, error, status })

function parseList(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean)
  } catch { /* fall through to comma list */ }
  return String(raw).split(',').map(s => s.trim()).filter(Boolean)
}

export function computeCouponDiscount(coupon: any, subtotal: number): number {
  let d = 0
  if (coupon.discountType === 'PERCENTAGE') d = Math.round((subtotal * coupon.discountValue) / 100)
  else if (coupon.discountType === 'FIXED') d = coupon.discountValue
  if (coupon.maxDiscount != null && coupon.maxDiscount > 0) d = Math.min(d, coupon.maxDiscount)
  return Math.max(0, Math.min(d, subtotal))
}

/** Every coupon rule in one place (used by the app's checkout and the validate API). */
export async function checkCoupon(input: CouponCheckInput): Promise<CouponCheckResult> {
  const coupon: any = await prisma.coupon.findUnique({ where: { code: String(input.code).trim().toUpperCase() } })
  if (!coupon) return fail('Invalid coupon code', 404)

  if (coupon.code.includes('LIVE') && input.accessTypes && input.accessTypes.length > 0) {
    if (!input.accessTypes.every(t => t === 'LIVE')) {
      return fail('This LIVE coupon requires all subjects in the bundle to be set to LIVE.')
    }
  }
  if (!coupon.isActive) return fail('This coupon is no longer active')
  const now = new Date()
  if (coupon.startDate && now < new Date(coupon.startDate)) return fail('This coupon is not yet active')
  if (coupon.expiresAt && now > new Date(coupon.expiresAt)) return fail('This coupon has expired')
  if (coupon.maxUses != null && coupon.currentUses >= coupon.maxUses) return fail('This coupon has reached its usage limit')

  if (coupon.isSingleUsePerUser) {
    const used = await prisma.couponUsage.findFirst({ where: { couponId: coupon.id, userId: input.userId } })
    if (used) return fail('You have already used this coupon')
  }
  if (coupon.isFirstPurchaseOnly) {
    const prior = await prisma.order.findFirst({ where: { userId: input.userId, status: { in: ['PAID', 'SUCCESS'] } } })
    if (prior) return fail('This coupon is only valid for first-time purchases')
  }

  const emails = parseList(coupon.targetUserEmails).map(e => e.toLowerCase())
  if (emails.length > 0 && !emails.includes(String(input.email).toLowerCase())) {
    return fail('This coupon is not available for your account')
  }

  if (coupon.applicability === 'BUNDLE') {
    const ids = parseList(coupon.targetBundleIds)
    if (ids.length > 0 && input.bundleOfferingId && !ids.includes(input.bundleOfferingId)) {
      return fail('This coupon is not valid for this bundle')
    }
  }

  if (coupon.applicability === 'SUBJECT') {
    const wanted = parseList(coupon.targetSubjects).map(s => s.toLowerCase())
    if (wanted.length > 0) {
      const ids = input.courseIds || []
      const courses = ids.length
        ? await prisma.course.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, subject: true } })
        : []
      const matches = courses.some(c =>
        wanted.includes(c.id.toLowerCase()) ||
        wanted.includes((c.name || '').toLowerCase()) ||
        wanted.includes((c.subject || '').toLowerCase()))
      if (!matches) return fail('This coupon is not valid for this course')
    }
  }

  if (coupon.minOrderValue != null && input.subtotal < coupon.minOrderValue) {
    return fail(`Minimum order value of ₹${coupon.minOrderValue} required for this coupon`)
  }

  return { ok: true, coupon, discountAmount: computeCouponDiscount(coupon, input.subtotal) }
}

/** Google Play sells fixed ₹10-step products, so discounted app totals round UP to the next ₹10 (never above the undiscounted price). */
export function roundForPlay(subtotal: number, finalAmount: number, anyDiscount: boolean): number {
  if (!anyDiscount || finalAmount <= 0) return finalAmount
  return Math.min(Math.ceil(finalAmount / 10) * 10, Math.round(subtotal))
}
