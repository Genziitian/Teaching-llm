import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, getFullSession, canManageContent, isAdminOrManager, canEditCourseContent } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const session = await getFullSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')

    const where: any = { isFree: false }
    
    // If not manager/admin, restrict to global materials or enrolled courses.
    // Moderators also only see global materials plus their assigned courses.
    if (!isAdminOrManager(session.role) || session.role === 'MODERATOR') {
      const allowedIds = session.accessibleCourseIds || []
      where.OR = [
        { isGlobal: true },
        { courseId: { in: allowedIds } }
      ]
    }

    if (courseId) {
      where.courseId = courseId
    }

    const materials = await (prisma.material.findMany as any)({
      where,
      include: {
        course: { select: { id: true, name: true, color: true } },
        uploadedBy: { select: { name: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json(materials)
  } catch (error) {
    console.error('Error fetching materials:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageContent(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { courseId, title, description, fileUrl, fileType, fileSize, isGlobal, sourceType } =
      await request.json()

    // Moderators can only add materials to their assigned courses (no global materials)
    if (session.role !== 'MANAGER' && (isGlobal || !(await canEditCourseContent(session, [courseId])))) {
      return NextResponse.json({ error: 'No access to this course' }, { status: 403 })
    }

    // Validate sourceType
    const validSourceType = sourceType === 'LINK' ? 'LINK' : 'FILE'

    const material = await prisma.material.create({
      data: {
        courseId,
        title,
        description,
        fileUrl,
        fileType: validSourceType === 'LINK' ? 'link' : fileType,
        fileSize,
        sourceType: validSourceType,
        isGlobal: !!isGlobal,
        uploadedById: session.userId,
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.MATERIAL_CREATED,
      actionDescription: `${session.name} created material "${title}"`,
      moduleName: MODULE.MATERIALS,
      targetId: material.id,
    })

    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    console.error('Error creating material:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
