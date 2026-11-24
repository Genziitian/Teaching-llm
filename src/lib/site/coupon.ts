import { prisma } from '@/lib/db'
import { checkCoupon, type CouponCheckResult } from '@/lib/coupon-rules'

/** Storefront course ids -> LMS course ids (bundles expand to their member courses; plain ids already are LMS ids). */
export async function toLmsCourseIds(supabase: any, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const { data } = await supabase.from('courses').select('id, bundleCourses').in('id', ids)
  const out = ids.flatMap((id) => {
    const row = (data || []).find((c: any) => c.id === id)
    const kids = Array.isArray(row?.bundleCourses) ? row.bundleCourses : []
    return kids.length > 0 ? kids.flatMap((bc: any) => [bc?.courseId, bc?.courseId2, bc?.courseId3].filter(Boolean).map(String)) : [id]
  })
  return Array.from(new Set(out))
}

/**
 * Website checkout coupon check against the one coupon list (Prisma "Coupon", same rules as the app).
 * Website bundles are class BundleOfferings (see bundleToRow), so bundle-targeted coupons work the same here.
 */
export async function checkSiteCoupon(input: {
  supabase: any
  code: string
  userId: string
  email: string
  courseIds: string[]
  bundleId?: string | null
  subtotal: number
}): Promise<CouponCheckResult> {
  return checkCoupon({
    code: input.code,
    userId: input.userId,
    email: input.email,
    bundleOfferingId: input.bundleId || null,
    courseIds: await toLmsCourseIds(input.supabase, input.courseIds),
    subtotal: input.subtotal,
  })
}

/** Records a paid website order's coupon use (same as the app's orders/verify). Non-fatal for the caller. */
export async function recordSiteCouponUse(code: string, email: string, orderId: string, revenue: number) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() }, select: { id: true } })
  if (!coupon) return // e.g. a storefront bundle's own bundleDiscountCode
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } })
  await prisma.$transaction([
    prisma.coupon.update({
      where: { id: coupon.id },
      data: { currentUses: { increment: 1 }, totalRevenueGenerated: { increment: revenue } },
    }),
    ...(user ? [prisma.couponUsage.create({ data: { couponId: coupon.id, userId: user.id, orderId, revenue } })] : []),
  ])
}
