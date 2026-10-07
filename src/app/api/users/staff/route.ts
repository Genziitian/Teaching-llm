import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isStaff = isAdminOrManager(session.role)
    const selectFields: any = {
      id: true,
      name: true,
      role: true,
      avatar: true,
      gender: true,
      enrollments: {
        select: {
          courseId: true
        }
      },
      instructorAssignments: {
        select: {
          courseId: true
        }
      }
    }
    if (isStaff) {
      selectFields.email = true
    }

    const staff = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MODERATOR', 'MANAGER'] },
        isTerminated: false
      },
      select: selectFields,
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ staff })
  } catch (error: any) {
    console.error('Error fetching staff list:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
