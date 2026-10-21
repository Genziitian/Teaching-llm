import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    const updateData: any = {}
    if (code !== undefined) updateData.code = code.toUpperCase()
    if (discountType !== undefined) updateData.discountType = discountType
    if (discountValue !== undefined) updateData.discountValue = Number(discountValue)
    if (applicability !== undefined) updateData.applicability = applicability
    if (targetBundleIds !== undefined) updateData.targetBundleIds = targetBundleIds || null
    if (targetUserEmails !== undefined) updateData.targetUserEmails = targetUserEmails || null
    if (targetSubjects !== undefined) updateData.targetSubjects = targetSubjects || null
    if (minOrderValue !== undefined) updateData.minOrderValue = minOrderValue ? Number(minOrderValue) : null
    if (maxDiscount !== undefined) updateData.maxDiscount = maxDiscount ? Number(maxDiscount) : null
    if (isFirstPurchaseOnly !== undefined) updateData.isFirstPurchaseOnly = !!isFirstPurchaseOnly
    if (isSingleUsePerUser !== undefined) updateData.isSingleUsePerUser = !!isSingleUsePerUser
    if (isHidden !== undefined) updateData.isHidden = !!isHidden
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null
    if (maxUses !== undefined) updateData.maxUses = maxUses ? Number(maxUses) : null
    if (isActive !== undefined) updateData.isActive = !!isActive

    const coupon = await prisma.coupon.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json(coupon)
  } catch (error) {
    console.error('[coupons] PUT Error:', error)
    return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.coupon.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[coupons] DELETE Error:', error)
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 })
  }
}
