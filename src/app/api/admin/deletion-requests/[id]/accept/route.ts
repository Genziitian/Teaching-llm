import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { DELETION_STATUS, DELETION_EVENT_TYPE } from '@/lib/deletion-reasons'
import { sendDeletionAcceptedEmail } from '@/lib/email-service'

/**
 * POST /api/admin/deletion-requests/[id]/accept
 * Allows a Manager to accept a deletion request.
 * Sets status to APPROVED, logs a timeline event, and triggers an email notification to the user.
 * Deletion will proceed after the 24-hour cancellation timer expires.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'MANAGER' && (session.role !== 'ADMIN' && session.role !== 'MODERATOR'))) {
      return NextResponse.json({ error: 'Unauthorized — Managers only' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { note } = body

    const deletionRequest = await prisma.accountDeletionRequest.findUnique({
      where: { id },
    })

    if (!deletionRequest) {
      return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 })
    }

    if (deletionRequest.status === DELETION_STATUS.DELETED) {
      return NextResponse.json({ error: 'Account is already deleted.' }, { status: 400 })
    }

    if (
      deletionRequest.status === DELETION_STATUS.CANCELLED_BY_USER ||
      deletionRequest.status === DELETION_STATUS.CANCELLED_BY_MANAGER
    ) {
      return NextResponse.json({ error: 'Cannot accept a cancelled request.' }, { status: 400 })
    }

    const acceptedAt = new Date()
    const customNote = note ? String(note).trim().slice(0, 500) : null
    const noteText = customNote
      ? `Request accepted by Manager (${session.name}): "${customNote}". Deletion will proceed after the 24-hour cancellation window expires.`
      : `Request accepted by Manager (${session.name}). Deletion will proceed after the 24-hour cancellation window expires.`

    await prisma.$transaction(async (tx) => {
      // 1. Update status to APPROVED
      await tx.accountDeletionRequest.update({
        where: { id },
        data: {
          status: DELETION_STATUS.APPROVED,
        },
      })

      // 2. Append timeline event
      await tx.accountDeletionEvent.create({
        data: {
          requestId: id,
          eventType: DELETION_EVENT_TYPE.ACCOUNT_DELETION_APPROVED,
          actorType: 'MANAGER',
          actorId: session.userId,
          actorName: session.name || 'Manager',
          note: noteText,
          createdAt: acceptedAt,
        },
      })
    })

    // 3. Send email to the user asynchronously
    sendDeletionAcceptedEmail({
      userEmail: deletionRequest.userEmail,
      userName: deletionRequest.userName,
      cancelUntil: new Date(deletionRequest.cancelUntil),
    }).catch((err) => console.error('[EMAIL_DELIVERY_ERR]', err))

    // 4. Log global activity
    logActivity({
      userId: session.userId,
      userName: session.name || 'Manager',
      userRole: session.role || 'MANAGER',
      actionType: ACTION.ACCOUNT_DELETION_REQUESTED,
      actionDescription: `${session.name} accepted deletion request for user ${deletionRequest.userName} (${deletionRequest.userEmail})`,
      moduleName: MODULE.USER_MGMT,
      targetId: deletionRequest.userId,
      metadata: { requestId: id, note: customNote },
    })

    return NextResponse.json({
      success: true,
      message: 'Deletion request accepted. User has been notified via email.',
    })
  } catch (error) {
    console.error('Error accepting deletion request:', error)
    return NextResponse.json({ error: 'Failed to accept deletion request' }, { status: 500 })
  }
}
