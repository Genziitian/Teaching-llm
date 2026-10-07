import { NextResponse } from 'next/server'
import { computeDailyAnalytics } from '@/lib/lms-analytics'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

/**
 * POST /api/analytics/compute
 *
 * Cron endpoint to precompute daily analytics.
 * Auth: x-cron-secret header (same pattern as /api/sync-queue).
 * Should be called by an external cron service once every 24 hours.
 */
export async function POST(req: Request) {
  try {
    // ─── 1. Authenticate Request ─────────────────────────────────────
    const cronSecret = process.env.CRON_SECRET
    const authToken = req.headers.get('x-cron-secret')
    
    let isAuthorized = false

    if (cronSecret && authToken === cronSecret) {
      isAuthorized = true
    } else {
      // Fallback: Check if request is manually triggered by a Manager
      const { getSession } = await import('@/lib/auth')
      const session = await getSession()
      if (session && ['MANAGER', 'ADMIN', 'MODERATOR'].includes(session.role)) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      // Log unauthorized attempt
      console.error('[Analytics Cron] Unauthorized attempt')
      logActivity({
        userId: 'SYSTEM',
        userName: 'SYSTEM',
        userRole: 'SYSTEM',
        actionType: 'ANALYTICS_CRON_UNAUTHORIZED',
        actionDescription: 'Unauthorized analytics cron attempt — invalid CRON_SECRET',
        moduleName: MODULE.AUTH,
        isFailure: true,
        priority: 2,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ─── 2. Run aggregation ──────────────────────────────────────────
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')
    const targetDate = dateParam ? new Date(dateParam) : new Date()

    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date parameter' }, { status: 400 })
    }

    const result = await computeDailyAnalytics(targetDate)

    // ─── 3. Log success ──────────────────────────────────────────────
    logActivity({
      userId: 'SYSTEM',
      userName: 'SYSTEM',
      userRole: 'SYSTEM',
      actionType: 'ANALYTICS_CRON_SUCCESS',
      actionDescription: `Analytics computed for ${result.date}`,
      moduleName: 'Analytics',
      metadata: result.metrics as Record<string, unknown>,
    })

    return NextResponse.json({
      success: true,
      date: result.date,
      metrics: result.metrics,
      computedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Analytics Cron] Error:', error)

    logActivity({
      userId: 'SYSTEM',
      userName: 'SYSTEM',
      userRole: 'SYSTEM',
      actionType: 'ANALYTICS_CRON_FAILURE',
      actionDescription: `Analytics cron failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      moduleName: 'Analytics',
      isFailure: true,
      priority: 2,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
