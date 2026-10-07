import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { autoCleanupCommunityAttachments } from '@/lib/community-cleanup'

export const dynamic = 'force-dynamic'

/**
 * GET route to trigger cleanup of community attachments older than 100 days
 */
export async function GET(request: NextRequest) {
  try {
    // ─── Authorization Check ──────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const secretParam = searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET || 'teaching_lms_cron_secret_key_123'
    const providedSecret = secretParam || authHeader?.replace('Bearer ', '')

    const session = await getSession()
    const isManager = session?.role === 'MANAGER' || (session?.role === 'ADMIN' || session?.role === 'MODERATOR')
    const isAuthorizedCron = providedSecret === cronSecret

    if (!isAuthorizedCron && !isManager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run cleanup
    const result = await autoCleanupCommunityAttachments()

    return NextResponse.json({
      success: true,
      ...result,
      message: result.success 
        ? `Successfully cleaned up community attachments older than 100 days. Count: ${result.count}`
        : `Cleanup failed: ${result.error}`
    })

  } catch (error: any) {
    console.error('[cron-community-cleanup] Processing failed:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
