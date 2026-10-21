import { prisma } from '@/lib/db'

/** Manager switch: are coupon codes accepted in the Google Play app? Defaults to OFF (also if the table doesn't exist yet). */
export async function getAppCouponsEnabled(): Promise<boolean> {
  try {
    const row = await (prisma as any).appFlags.findUnique({ where: { id: 'singleton' } })
    return !!row?.couponsEnabled
  } catch {
    return false
  }
}
