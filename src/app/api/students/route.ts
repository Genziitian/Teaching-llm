import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, getAccessibleCourseIds } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !['MANAGER', 'ADMIN', 'MODERATOR'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')

    let targetCourseIds: string[] = []

    if ((session.role === 'ADMIN' || session.role === 'MODERATOR')) {
      const adminCourseIds = await getAccessibleCourseIds(session.userId, session.role) || []

      if (courseId) {
        if (!adminCourseIds.includes(courseId)) {
           return NextResponse.json([]) // Admin doesn't own this course
        }
        targetCourseIds = [courseId]
      } else {
        targetCourseIds = adminCourseIds
      }
    } else {
      // MANAGER
      if (courseId) {
        targetCourseIds = [courseId]
      }
    }

    let students;

    if (session.role === 'MANAGER' && !courseId) {
      students = await prisma.user.findMany({
        where: { role: 'STUDENT', isTerminated: false },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' }
      })
    } else {
      // Filter by enrollments in targetCourseIds
      if (targetCourseIds.length === 0 && (session.role === 'ADMIN' || session.role === 'MODERATOR')) {
        return NextResponse.json([])
      }
      
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: { in: targetCourseIds } },
        select: { user: { select: { id: true, name: true, email: true, isTerminated: true } } }
      })

      // Get unique students from enrollments
      const stdMap = new Map()
      enrollments.forEach(e => {
        if (e.user && e.user.isTerminated === false) {
           stdMap.set(e.user.id, { id: e.user.id, name: e.user.name, email: e.user.email })
        }
      })
      students = Array.from(stdMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    }

    return NextResponse.json(students)
  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
