/**
 * One-off: copy website discount coupons (SiteRow "discount_coupons" + "coupon_uses") into the class "Coupon" /
 * "CouponUsage" tables, so the app and the website share one coupon list. Codes that already exist are skipped.
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/copy-storefront-coupons.ts --self-check
 *   npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/copy-storefront-coupons.ts            (dry run)
 *   npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/copy-storefront-coupons.ts --apply    (writes)
 *
 * Needs the migration 20261119180000_coupon_partner_fields applied first.
 */
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'

type Row = Record<string, any>

const date = (v: any) => (v ? new Date(v) : null)
const num = (v: any) => (v === null || v === undefined || v === '' || Number(v) === 0 ? null : Number(v))

/** Storefront discount_coupons row -> Prisma Coupon data (without createdById). bundleIds = BundleOffering ids. */
export function mapStorefrontCoupon(r: Row, bundleIds: Set<string>) {
  const pct = Number(r.discount_percentage || 0)
  const target = String(r.applies_to || 'ALL').trim()
  const isAll = !target || target.toUpperCase() === 'ALL'
  const isBundle = !isAll && bundleIds.has(target)
  const emails = Array.isArray(r.allowed_emails) ? r.allowed_emails.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean) : []
  return {
    code: String(r.code).trim().toUpperCase(),
    discountType: pct > 0 ? 'PERCENTAGE' : 'FIXED',
    discountValue: pct > 0 ? pct : Number(r.discount_amount || 0),
    applicability: isAll ? 'GLOBAL' : isBundle ? 'BUNDLE' : 'SUBJECT',
    targetBundleIds: isBundle ? JSON.stringify([target]) : null,
    // A plain storefront course id is the LMS course id, which SUBJECT coupons match on.
    targetSubjects: !isAll && !isBundle ? JSON.stringify([target]) : null,
    targetUserEmails: emails.length ? JSON.stringify(emails) : null,
    minOrderValue: num(r.min_order_value),
    maxDiscount: num(r.max_discount_amount ?? r.max_discount),
    maxUses: num(r.max_uses),
    currentUses: Number(r.used_count || 0),
    isFirstPurchaseOnly: Boolean(r.first_purchase_only),
    isSingleUsePerUser: r.single_use_per_user !== false, // storefront default was single use
    isHidden: Boolean(r.hidden),
    isActive: r.active !== false,
    startDate: date(r.start_date),
    expiresAt: date(r.expires_at),
    partnerId: r.partner_id || null,
    issuedToEmail: r.issued_to_email ? String(r.issued_to_email).toLowerCase() : null,
  }
}

function selfCheck() {
  const bundles = new Set(['bundle-1'])
  const a = mapStorefrontCoupon({ code: ' save10 ', discount_percentage: 10, max_discount_amount: 500, applies_to: 'ALL', allowed_emails: ['A@x.com'], used_count: 3 }, bundles)
  assert.equal(a.code, 'SAVE10')
  assert.equal(a.discountType, 'PERCENTAGE')
  assert.equal(a.discountValue, 10)
  assert.equal(a.maxDiscount, 500)
  assert.equal(a.applicability, 'GLOBAL')
  assert.equal(a.targetUserEmails, '["a@x.com"]')
  assert.equal(a.currentUses, 3)
  assert.equal(a.isSingleUsePerUser, true)
  assert.equal(a.isActive, true)
  const b = mapStorefrontCoupon({ code: 'B', discount_amount: 200, applies_to: 'bundle-1', single_use_per_user: false, active: false, max_uses: 0 }, bundles)
  assert.equal(b.discountType, 'FIXED')
  assert.equal(b.discountValue, 200)
  assert.equal(b.applicability, 'BUNDLE')
  assert.equal(b.targetBundleIds, '["bundle-1"]')
  assert.equal(b.targetSubjects, null)
  assert.equal(b.isSingleUsePerUser, false)
  assert.equal(b.isActive, false)
  assert.equal(b.maxUses, null)
  const c = mapStorefrontCoupon({ code: 'C', discount_percentage: 5, applies_to: 'course-xyz' }, bundles)
  assert.equal(c.applicability, 'SUBJECT')
  assert.equal(c.targetSubjects, '["course-xyz"]')
  console.log('self-check passed')
}

async function main() {
  if (process.argv.includes('--self-check')) return selfCheck()
  const apply = process.argv.includes('--apply')
  const prisma = new PrismaClient()
  try {
    const read = async (table: string) =>
      (await prisma.$queryRawUnsafe<{ data: Row }[]>(`SELECT "data" FROM "SiteRow" WHERE "tableName" = $1`, table)).map((r) => r.data)
    const [coupons, uses, bundles, creator] = await Promise.all([
      read('discount_coupons'),
      read('coupon_uses'),
      prisma.bundleOffering.findMany({ select: { id: true } }),
      prisma.user.findFirst({ where: { role: 'MANAGER' }, orderBy: { createdAt: 'asc' }, select: { id: true } }),
    ])
    if (!creator) throw new Error('No MANAGER user to own the copied coupons')
    const bundleIds = new Set(bundles.map((b) => b.id))

    let copied = 0, skipped = 0, usages = 0
    for (const r of coupons) {
      if (!r?.code) continue
      const data = mapStorefrontCoupon(r, bundleIds)
      if (await prisma.coupon.findUnique({ where: { code: data.code }, select: { id: true } })) {
        console.log(`skip ${data.code}: code already exists in class coupons`)
        skipped++
        continue
      }
      const rowUses = uses.filter((u) => String(u.code || '').trim().toUpperCase() === data.code)
      console.log(`${apply ? 'copy' : 'would copy'} ${data.code} (${data.applicability}, ${rowUses.length} uses)`)
      copied++
      if (!apply) continue
      const coupon = await prisma.coupon.create({ data: { ...data, createdById: creator.id } })
      for (const u of rowUses) {
        const user = u.user_email
          ? await prisma.user.findUnique({ where: { email: String(u.user_email).toLowerCase() }, select: { id: true } })
          : null
        if (!user) continue // usage by an email with no class account: count stays in currentUses only
        await prisma.couponUsage.create({ data: { couponId: coupon.id, userId: user.id, orderId: u.order_id || null, usedAt: date(u.created_at) || undefined } })
        usages++
      }
    }
    console.log(`${apply ? 'Copied' : 'Dry run:'} ${copied} coupons, ${usages} usages; skipped ${skipped}.${apply ? '' : ' Re-run with --apply to write.'}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
