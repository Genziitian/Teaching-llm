import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendFcmToUsers } from '@/lib/fcm'
import { sendPushToUsers } from '@/lib/push'
import { processHomeworkDueReminders } from '@/lib/system-notifications'

export const dynamic = 'force-dynamic'

// Expose CRON GET handler
export async function GET(request: NextRequest) {
  try {
    // ─── Security Check ──────────────────────────────────────────────────────
    // To prevent arbitrary users from hitting this, we check for a CRON_SECRET key
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const secretParam = searchParams.get('secret')
    
    const cronSecret = process.env.CRON_SECRET || 'teaching_lms_cron_secret_key_123'
    const providedSecret = secretParam || authHeader?.replace('Bearer ', '')

    if (providedSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // 1. Fetch all pending notifications that are due
    const pendingNotifications = await prisma.scheduledUserNotification.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: now },
      },
      include: {
        user: {
          select: {
            id: true,
            isTerminated: true,
            isProfileComplete: true,
            enrollments: { select: { id: true } },
          },
        },
      },
      take: 50, // Process in batches of 50 to keep it lightweight
    })

    if (pendingNotifications.length === 0) {
      return NextResponse.json({ processedCount: 0, message: 'No pending due notifications.' })
    }

    let sentCount = 0
    let cancelledCount = 0

    await Promise.allSettled(
      pendingNotifications.map(async (noti) => {
        const student = noti.user

        // ─── Conversion Check: Stop if already completed registration/enrollment ──
        const isConverted = student.isProfileComplete || student.enrollments.length > 1 // enrolled in more than just the default demo course
        const isInactive = student.isTerminated

        if (isConverted || isInactive) {
          // User already completed actions — cancel this and future drip notifications
          await prisma.scheduledUserNotification.update({
            where: { id: noti.id },
            data: { status: 'CANCELLED' },
          })
          cancelledCount++
          return
        }

        // ─── Fire Notification ───
        try {
          const pushPayload = {
            title: noti.title,
            body: noti.content,
            url: noti.ctaLink || '/',
            tag: 'welcome_onboarding',
            ctaText: noti.ctaText || undefined,
            ctaLink: noti.ctaLink || undefined,
            importance: 'high' as const,
            sound: 'default' as const,
          }

          await Promise.allSettled([
            sendFcmToUsers([student.id], pushPayload),
            sendPushToUsers([student.id], pushPayload),
          ])

          await prisma.scheduledUserNotification.update({
            where: { id: noti.id },
            data: { status: 'SENT' },
          })
          sentCount++
        } catch (err) {
          console.error(`[cron-notifications] Error sending welcome notification ${noti.id}:`, err)
        }
      })
    )

    await processHomeworkDueReminders().catch((err) =>
      console.error('[cron-notifications] Error processing homework due reminders:', err)
    )

    return NextResponse.json({
      processedCount: pendingNotifications.length,
      sentCount,
      cancelledCount,
      message: 'Scheduled notifications processed successfully!',
    })
  } catch (error: any) {
    console.error('[cron-notifications] Processing failed:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
