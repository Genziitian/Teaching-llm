import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { normalizeFactRarity } from '@/lib/facts/loading-fact-rarity'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.loadingFact.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Fact not found' }, { status: 404 })
    }

    const data = await request.json()
    const updateData: {
      text?: string
      rarity?: string
      isCoupon?: boolean
      isActive?: boolean
    } = {}

    if (data.text !== undefined) {
      const text = String(data.text || '').trim()
      if (!text) return NextResponse.json({ error: 'Fact text is required' }, { status: 400 })
      updateData.text = text
    }
    if (data.rarity !== undefined) updateData.rarity = normalizeFactRarity(data.rarity)
    if (data.isCoupon !== undefined) updateData.isCoupon = !!data.isCoupon
    if (data.isActive !== undefined) updateData.isActive = !!data.isActive

    const fact = await prisma.loadingFact.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json(fact)
  } catch (error) {
    console.error('[manage/facts] PUT Error:', error)
    return NextResponse.json({ error: 'Failed to update fact' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.loadingFact.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[manage/facts] DELETE Error:', error)
    return NextResponse.json({ error: 'Failed to delete fact' }, { status: 500 })
  }
}
