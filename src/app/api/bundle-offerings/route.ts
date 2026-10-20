import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const bundles = await prisma.bundleOffering.findMany({
      include: {
        createdBy: { select: { id: true, name: true } },
        courses: { include: { course: { select: { id: true, name: true, color: true, icon: true, courseIconType: true, teacherName: true, isDisabled: true, description: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Filter out disabled courses for non-managers
    const session = await getSession()
    const role = session?.role
    const filtered = bundles.map(b => ({
      ...b,
      courses: b.courses.filter(cc => {
        if (role === 'MANAGER') return true
        return !cc.course.isDisabled
      })
    }))

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('[bundle-offerings] GET Error:', error)
    return NextResponse.json({ error: 'Failed to fetch bundle offerings' }, { status: 500 })
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
      name, description, courseIds, 
      recordedOriginalPrice, recordedDiscountPrice, liveOriginalPrice, liveDiscountPrice, 
      championOriginalPrice, championDiscountPrice, championSubtitle,
      allowIndividualPurchase, forceClassType,
      enableBundleDiscount, bundleDiscountType, bundleDiscountValue, bundleDiscountApplicability, requireAllCourses,
      coursePrices, startingPrice, startingFromText, bannerText, courseHeadline,
      category, highlights
    } = data

    if (!name || !Array.isArray(courseIds) || courseIds.length === 0) {
      return NextResponse.json({ error: 'Bundle name and at least one course are required' }, { status: 400 })
    }

    // Validate courses exist
    const found = await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, isDisabled: true } })
    if (found.length !== courseIds.length) {
      return NextResponse.json({ error: 'Some selected courses were not found' }, { status: 400 })
    }

    const bundle = await prisma.bundleOffering.create({
      data: {
        name,
        description,
        highlights: String(highlights || '').split('\n').map((x: string) => x.trim()).filter(Boolean).slice(0, 30).join('\n') || null,
        createdById: session.userId,
        recordedOriginalPrice: recordedOriginalPrice ? Number(recordedOriginalPrice) : undefined,
        recordedDiscountPrice: recordedDiscountPrice ? Number(recordedDiscountPrice) : undefined,
        liveOriginalPrice: liveOriginalPrice ? Number(liveOriginalPrice) : undefined,
        liveDiscountPrice: liveDiscountPrice ? Number(liveDiscountPrice) : undefined,
        championOriginalPrice: championOriginalPrice ? Number(championOriginalPrice) : undefined,
        championDiscountPrice: championDiscountPrice ? Number(championDiscountPrice) : undefined,
        championSubtitle: championSubtitle || null,
        coursePrices: coursePrices || "[]",
        allowIndividualPurchase: allowIndividualPurchase == null ? true : !!allowIndividualPurchase,
        forceClassType: forceClassType || null,
        enableBundleDiscount: !!enableBundleDiscount,
        bundleDiscountType: bundleDiscountType || null,
        bundleDiscountValue: bundleDiscountValue ? Number(bundleDiscountValue) : null,
        bundleDiscountApplicability: bundleDiscountApplicability || null,
        requireAllCourses: requireAllCourses == null ? true : !!requireAllCourses,
        startingPrice: startingPrice ? Number(startingPrice) : null,
        startingFromText: startingFromText || "Courses start from",
        bannerText: bannerText || "Class starts from 1 June 2026",
        courseHeadline: courseHeadline || "Included Courses",
        category: category || "General",
        courses: {
          create: courseIds.map((cid: string) => ({ courseId: cid }))
        }
      },
      include: { courses: { include: { course: true } } }
    })

    return NextResponse.json(bundle)
  } catch (error: any) {
    console.error('[bundle-offerings] POST Error:', error?.message || error)
    console.error('[bundle-offerings] POST Error Meta:', JSON.stringify(error?.meta || {}))
    return NextResponse.json({ error: error?.message || 'Failed to create bundle offering' }, { status: 500 })
  }
}
