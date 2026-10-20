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
      name, description, recordedOriginalPrice, recordedDiscountPrice, 
      liveOriginalPrice, liveDiscountPrice,
      championOriginalPrice, championDiscountPrice, championSubtitle,
      allowIndividualPurchase, forceClassType, courseIds,
      enableBundleDiscount, bundleDiscountType, bundleDiscountValue, bundleDiscountApplicability, requireAllCourses,
      coursePrices, startingPrice, startingFromText, bannerText, courseHeadline,
      category, highlights
    } = data

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (recordedOriginalPrice !== undefined) updateData.recordedOriginalPrice = recordedOriginalPrice ? Number(recordedOriginalPrice) : null
    if (recordedDiscountPrice !== undefined) updateData.recordedDiscountPrice = recordedDiscountPrice ? Number(recordedDiscountPrice) : null
    if (liveOriginalPrice !== undefined) updateData.liveOriginalPrice = liveOriginalPrice ? Number(liveOriginalPrice) : null
    if (liveDiscountPrice !== undefined) updateData.liveDiscountPrice = liveDiscountPrice ? Number(liveDiscountPrice) : null
    if (championOriginalPrice !== undefined) updateData.championOriginalPrice = championOriginalPrice ? Number(championOriginalPrice) : null
    if (championDiscountPrice !== undefined) updateData.championDiscountPrice = championDiscountPrice ? Number(championDiscountPrice) : null
    if (championSubtitle !== undefined) updateData.championSubtitle = championSubtitle || null
    if (allowIndividualPurchase !== undefined) updateData.allowIndividualPurchase = !!allowIndividualPurchase
    if (forceClassType !== undefined) updateData.forceClassType = forceClassType || null
    if (enableBundleDiscount !== undefined) updateData.enableBundleDiscount = !!enableBundleDiscount
    if (bundleDiscountType !== undefined) updateData.bundleDiscountType = bundleDiscountType
    if (bundleDiscountValue !== undefined) updateData.bundleDiscountValue = bundleDiscountValue ? Number(bundleDiscountValue) : null
    if (bundleDiscountApplicability !== undefined) updateData.bundleDiscountApplicability = bundleDiscountApplicability
    if (requireAllCourses !== undefined) updateData.requireAllCourses = !!requireAllCourses
    if (coursePrices !== undefined) updateData.coursePrices = coursePrices || '[]'
    if (startingPrice !== undefined) updateData.startingPrice = startingPrice ? Number(startingPrice) : null
    if (startingFromText !== undefined) updateData.startingFromText = startingFromText
    if (bannerText !== undefined) updateData.bannerText = bannerText
    if (courseHeadline !== undefined) updateData.courseHeadline = courseHeadline
    if (category !== undefined) updateData.category = category
    if (highlights !== undefined) {
      updateData.highlights = String(highlights || '').split('\n').map((x: string) => x.trim()).filter(Boolean).slice(0, 30).join('\n') || null
    }

    // If courseIds provided, update the course relations
    if (Array.isArray(courseIds)) {
      // Delete existing and recreate
      await prisma.bundleOfferingCourse.deleteMany({ where: { bundleOfferingId: params.id } })
      await prisma.bundleOfferingCourse.createMany({
        data: courseIds.map((cid: string) => ({ bundleOfferingId: params.id, courseId: cid }))
      })
    }

    const bundle = await prisma.bundleOffering.update({
      where: { id: params.id },
      data: updateData,
      include: { courses: { include: { course: true } } }
    })

    return NextResponse.json(bundle)
  } catch (error) {
    console.error('[bundle-offerings] PUT Error:', error)
    return NextResponse.json({ error: 'Failed to update bundle offering' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.bundleOffering.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[bundle-offerings] DELETE Error:', error)
    return NextResponse.json({ error: 'Failed to delete bundle offering' }, { status: 500 })
  }
}
