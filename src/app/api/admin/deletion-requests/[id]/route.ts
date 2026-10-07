import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/deletion-requests/[id]
 * Returns full details and entire timeline events for a single deletion request.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'MANAGER' && (session.role !== 'ADMIN' && session.role !== 'MODERATOR'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    const deletionRequest = await prisma.accountDeletionRequest.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            securityNumber: true,
            avatar: true,
            isTerminated: true,
            enrollments: {
              select: {
                courseId: true,
                type: true,
                course: { select: { id: true, name: true, color: true } },
              },
            },
          },
        },
      },
    })

    if (!deletionRequest) {
      return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 })
    }

    return NextResponse.json(deletionRequest)
  } catch (error) {
    console.error('Error fetching deletion request details:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
