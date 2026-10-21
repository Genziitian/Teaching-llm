import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeHidden = searchParams.get('includeHidden') === 'true'

    const coupons = await prisma.coupon.findMany({
      where: includeHidden ? undefined : { isHidden: false },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(coupons)
  } catch (error) {
    console.error('[coupons] GET Error:', error)
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { 
      code, discountType, discountValue, applicability, 
      targetBundleIds, targetUserEmails, targetSubjects,
      minOrderValue, maxDiscount, isFirstPurchaseOnly, isSingleUsePerUser, isHidden,
      startDate, expiresAt, maxUses, isActive 
    } = data

    if (!code || !discountType || discountValue == null || !applicability) {
      return NextResponse.json({ error: 'Missing required coupon fields' }, { status: 400 })
    }

    const existing = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 400 })
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        applicability,
        targetBundleIds: targetBundleIds || null,
        targetUserEmails: targetUserEmails || null,
        targetSubjects: targetSubjects || null,
        minOrderValue: minOrderValue ? Number(minOrderValue) : null,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        isFirstPurchaseOnly: !!isFirstPurchaseOnly,
        isSingleUsePerUser: !!isSingleUsePerUser,
        isHidden: !!isHidden,
        startDate: startDate ? new Date(startDate) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        isActive: isActive == null ? true : !!isActive,
        createdById: session.userId
      }
    })

    return NextResponse.json(coupon)
  } catch (error: any) {
    console.error('[coupons] POST Error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create coupon' }, { status: 500 })
  }
}
