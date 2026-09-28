import { NextResponse } from 'next/server'
import { processSyncQueue, cleanupOldSyncQueue } from '@/lib/sync-queue'
import { processProgressQueue, cleanupOldProgressQueue } from '@/lib/progress-processor'
import { processScheduledCampaigns } from '@/lib/campaign-processor'
import { processScheduledClassStartAlerts, sendDailyScheduleNotification, processPendingLectureAlerts, processHomeworkDueReminders } from '@/lib/system-notifications'
import { prisma } from '@/lib/db'
import { syncAllExistingTopics } from '@/lib/fcm'
import { autoCleanupCommunityAttachments } from '@/lib/community-cleanup'

// This endpoint should be called by a cron job every 10 seconds
// Configure in vercel.json or use an external cron service

export async function POST(req: Request) {
  try {
    // CRON_SECRET is REQUIRED — reject all requests if not configured
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('[Cron] CRON_SECRET environment variable is not set. Rejecting request.')
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 })
    }

    const authToken = req.headers.get('x-cron-secret')
    if (authToken !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Process pending sync jobs
    const result = await processSyncQueue()
    
    // Process lecture progress queue
    const progressResult = await processProgressQueue()

    // Process scheduled rich push campaigns
    await processScheduledCampaigns().catch((err) =>
      console.error('[Sync Queue Scheduler] Error processing campaigns:', err)
    )

    // Process automated live class start alerts (starts 5m before start time)
    await processScheduledClassStartAlerts().catch((err) =>
      console.error('[Sync Queue Scheduler] Error processing auto class start alerts:', err)
    )

    // Process batched lecture notifications (15m debounce)
    await processPendingLectureAlerts().catch((err) =>
      console.error('[Sync Queue Scheduler] Error processing pending lecture alerts:', err)
    )

    // Process homework due reminders (2 hours left)
    await processHomeworkDueReminders().catch((err) =>
      console.error('[Sync Queue Scheduler] Error processing homework due reminders:', err)
    )

    // One-time FCM topics migration for existing database device tokens
    try {
      const settings = await prisma.updateSystemSettings.findUnique({
        where: { id: 'singleton' }
      })
      if (!settings?.isTopicMigrationDone) {
        console.log('[Cron] Initiating one-time FCM topics migration...')
        await syncAllExistingTopics()
        await prisma.updateSystemSettings.upsert({
          where: { id: 'singleton' },
          update: { isTopicMigrationDone: true },
          create: { id: 'singleton', isTopicMigrationDone: true },
        })
        console.log('[Cron] FCM topics migration completed and registered in singleton settings!')
      }
    } catch (err) {
      console.error('[Cron] Error running FCM topics migration:', err)
    }

    // Trigger daily 1 PM IST schedule notifications
    try {
      const now = new Date()
      const istTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      })
      const [istHour, istMinute] = istTimeStr.split(':').map(Number)

      if (istHour === 13 && istMinute >= 0 && istMinute < 5) {
        const todayDateStr = now.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
        })
        const settings = await prisma.updateSystemSettings.findUnique({
          where: { id: 'singleton' }
        })

        if (settings?.lastDailyNotifDate !== todayDateStr) {
          await prisma.updateSystemSettings.upsert({
            where: { id: 'singleton' },
            update: { lastDailyNotifDate: todayDateStr },
            create: { id: 'singleton', lastDailyNotifDate: todayDateStr },
          })
          sendDailyScheduleNotification().catch((err) =>
            console.error('[Sync Queue Scheduler] Error sending daily schedule notifications:', err)
          )
        }
      }
    } catch (err) {
      console.error('[Sync Queue Scheduler] Error in daily notification scheduling check:', err)
    }

    // Daily check for Community Attachments cleanup (older than 100 days)
    try {
      const now = new Date()
      const todayDateStr = now.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
      })
      const settings = await prisma.updateSystemSettings.findUnique({
        where: { id: 'singleton' }
      })

      if (settings?.lastCommunityCleanupDate !== todayDateStr) {
        await prisma.updateSystemSettings.upsert({
          where: { id: 'singleton' },
          update: { lastCommunityCleanupDate: todayDateStr },
          create: { id: 'singleton', lastCommunityCleanupDate: todayDateStr },
        })
        autoCleanupCommunityAttachments().catch((err) =>
          console.error('[Sync Queue Scheduler] Error in autoCleanupCommunityAttachments:', err)
        )
      }
    } catch (err) {
      console.error('[Sync Queue Scheduler] Error in community cleanup daily check:', err)
    }

    // Cleanup old jobs every 10th run (approximately hourly)
    if (Math.random() < 0.1) {
      await cleanupOldSyncQueue()
      await cleanupOldProgressQueue()
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      progressProcessed: progressResult.processed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Sync queue processor error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET for monitoring/debugging — also requires auth
export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 })
    }

    const authToken = req.headers.get('x-cron-secret')
    if (authToken !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      message: 'Sync queue processor is running. Send POST request to process queue.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
