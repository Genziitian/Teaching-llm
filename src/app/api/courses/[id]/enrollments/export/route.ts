import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isManagerOrSuperAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function csvEscape(value: unknown): string {
  const raw = value == null ? '' : String(value)
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

/**
 * GET — download CSV backup of all students enrolled in this course (manager only).
 * Use before clearing enrollments when reusing a course.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || !isManagerOrSuperAdmin(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: courseId } = await params

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, name: true },
    })

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            mobileNumber: true,
            securityNumber: true,
            role: true,
            iitmLevel: true,
            iitmUserType: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const headers = [
      'enrollmentId',
      'enrolledAt',
      'enrollmentType',
      'isFreeEnrollment',
      'packageName',
      'userId',
      'name',
      'firstName',
      'lastName',
      'email',
      'mobileNumber',
      'securityNumber',
      'role',
      'iitmLevel',
      'iitmUserType',
      'userCreatedAt',
      'courseId',
      'courseName',
      'exportedAt',
    ]

    const exportedAt = new Date().toISOString()
    const rows = enrollments.map((e) => [
      e.id,
      e.createdAt.toISOString(),
      e.type,
      e.isFreeEnrollment ? 'true' : 'false',
      e.packageName || '',
      e.user?.id || e.userId,
      e.user?.name || '',
      e.user?.firstName || '',
      e.user?.lastName || '',
      e.user?.email || '',
      e.user?.mobileNumber || '',
      e.user?.securityNumber || '',
      e.user?.role || '',
      e.user?.iitmLevel || '',
      e.user?.iitmUserType || '',
      e.user?.createdAt ? e.user.createdAt.toISOString() : '',
      course.id,
      course.name,
      exportedAt,
    ])

    const csv =
      headers.join(',') +
      '\n' +
      rows.map((row) => row.map(csvEscape).join(',')).join('\n') +
      '\n'

    const safeName = course.name
      .replace(/[^a-zA-Z0-9-_]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 60)
    const dateStamp = exportedAt.slice(0, 10)
    const filename = `course-enrollments-${safeName || course.id}-${dateStamp}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Enrollment-Count': String(enrollments.length),
      },
    })
  } catch (error: any) {
    console.error('[course-enrollments-export] GET failed:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
