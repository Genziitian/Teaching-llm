import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isManager } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

const VALID_CATEGORIES = new Set(['NOTE', 'PYQ', 'ASSIGNMENT', 'OTHER'])

/**
 * GET /api/free-resources/materials
 *
 * Lists free, course-unscoped materials. Optional filters drive the Flutter
 * Free Materials browser (Level → Subject → 3 category tabs):
 *
 *   ?level=Foundation         — match exact level (case-insensitive)
 *   ?subject=Math%201         — match exact subject (case-insensitive)
 *   ?category=PYQ             — NOTE | PYQ | ASSIGNMENT | OTHER
 *
 * Filters are ANDed together; absent filters mean "no constraint" so the
 * default response is the full catalogue (preserves prior behaviour).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level')?.trim()
    const subject = searchParams.get('subject')?.trim()
    const category = searchParams.get('category')?.trim()?.toUpperCase()

    const where: any = { isFree: true, courseId: null }
    if (level) where.level = { equals: level, mode: 'insensitive' }
    if (subject) where.subject = { equals: subject, mode: 'insensitive' }
    if (category && VALID_CATEGORIES.has(category)) where.category = category

    const materials = await (prisma.material.findMany as any)({
      where,
      include: {
        uploadedBy: { select: { name: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json(materials)
  } catch (error) {
    console.error('Error fetching free materials:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const {
      title,
      description,
      fileUrl,
      fileType,
      fileSize,
      sourceType,
      category,
      level,
      subject,
      term,
    } = await request.json()

    if (!title || !fileUrl) {
      return NextResponse.json({ error: 'Title and file URL are required' }, { status: 400 })
    }

    const validSourceType = sourceType === 'LINK' ? 'LINK' : 'FILE'
    const normalisedCategory =
      typeof category === 'string' && VALID_CATEGORIES.has(category.toUpperCase())
        ? category.toUpperCase()
        : 'NOTE'

    const material = await (prisma.material.create as any)({
      data: {
        courseId: null,
        title,
        description,
        fileUrl,
        fileType: validSourceType === 'LINK' ? 'link' : (fileType || 'unknown'),
        fileSize,
        sourceType: validSourceType,
        isFree: true,
        isGlobal: false,
        uploadedById: session.userId,
        category: normalisedCategory,
        level: typeof level === 'string' && level.trim() ? level.trim() : null,
        subject: typeof subject === 'string' && subject.trim() ? subject.trim() : null,
        term: typeof term === 'string' && term.trim() ? term.trim() : null,
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.MATERIAL_CREATED,
      actionDescription: `${session.name} created free ${normalisedCategory.toLowerCase()} "${title}"`,
      moduleName: MODULE.MATERIALS,
      targetId: material.id,
    })

    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    console.error('Error creating free material:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
