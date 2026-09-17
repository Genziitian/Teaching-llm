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
      courseId, name, thumbnail, 
      hasRecorded, recordedOriginalPrice, recordedDiscountPrice,
      hasLive, liveOriginalPrice, liveDiscountPrice,
      championOriginalPrice, championDiscountPrice, championSubtitle,
      detailsLink, category
    } = data

    const offering = await prisma.courseOffering.update({
      where: { id: params.id },
      data: {
        courseId,
        name,
        thumbnail,
        hasRecorded: !!hasRecorded,
        recordedOriginalPrice: recordedOriginalPrice ? Number(recordedOriginalPrice) : null,
        recordedDiscountPrice: recordedDiscountPrice ? Number(recordedDiscountPrice) : null,
        hasLive: !!hasLive,
        liveOriginalPrice: liveOriginalPrice ? Number(liveOriginalPrice) : null,
        liveDiscountPrice: liveDiscountPrice ? Number(liveDiscountPrice) : null,
        championOriginalPrice: championOriginalPrice ? Number(championOriginalPrice) : null,
        championDiscountPrice: championDiscountPrice ? Number(championDiscountPrice) : null,
        championSubtitle: championSubtitle || null,
        detailsLink: detailsLink || null,
        category: category || undefined,
      }
    })

    return NextResponse.json(offering)
  } catch (error) {
    console.error('[course-offerings] PUT Error:', error)
    return NextResponse.json({ error: 'Failed to update course offering' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.courseOffering.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[course-offerings] DELETE Error:', error)
    return NextResponse.json({ error: 'Failed to delete course offering' }, { status: 500 })
  }
}
