import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, subId } = await params

    const submission = await prisma.homeworkSubmission.findFirst({
      where: {
        id: subId,
        homeworkId: id,
      },
      include: {
        student: { select: { name: true } },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    await prisma.homeworkSubmission.delete({
      where: { id: subId },
    })

    try {
      logActivity({
        userId: session.userId,
        userName: session.email || 'Admin',
        userRole: session.role,
        actionType: 'HOMEWORK_SUBMISSION_DELETED',
        actionDescription: `Deleted submission for student ${submission.student?.name || 'Unknown'}`,
        moduleName: MODULE.COURSES,
        targetId: subId,
      })
    } catch (_) {}

    return NextResponse.json({ success: true, message: 'Submission deleted' })
  } catch (error: any) {
    console.error('Error deleting submission:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
