import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const freeCourses = await (prisma.course.findMany as any)({
      where: {
        isFree: true,
        isDisabled: false,
      },
      include: {
        enrollments: {
          where: {
            userId: session.userId,
          },
        },
        createdBy: { select: { name: true } },
        _count: {
          select: {
            lectures: true,
            materials: true,
            topics: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const coursesWithEnrollmentStatus = freeCourses.map((course) => {
      const { enrollments, ...rest } = course
      return {
        ...rest,
        isEnrolled: enrollments.length > 0,
      }
    })

    return NextResponse.json(coursesWithEnrollmentStatus, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error fetching free courses:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
