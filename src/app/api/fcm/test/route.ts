import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { firebaseAdmin } from '@/lib/firebase-admin'
import { isStaleFcmTokenError } from '@/lib/fcm'

// POST /api/fcm/test — Test native FCM notification delivery (Manager/Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'MANAGER' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!firebaseAdmin) {
      return NextResponse.json({
        error: 'Firebase Admin SDK not initialized on server',
        message: 'Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are configured in the server environment.'
      }, { status: 500 })
    }

    const { userId, token, title, body, url, imageUrl, ctaText, ctaLink } = await request.json()

    const notificationPayload = {
      notification: {
        title: title || '🔔 FCM Native Test',
        body: body || 'FCM notification delivered successfully to your device!',
        ...(imageUrl ? { image: imageUrl } : {}),
      },
      data: {
        url: url || ctaLink || '/announcements',
        tag: 'test-native',
        ctaText: ctaText || '',
        ctaLink: ctaLink || '',
        imageUrl: imageUrl || '',
      },
      android: {
        priority: 'high' as const,
        notification: {
          icon: 'ic_launcher',
          color: '#4F46E5',
          channelId: 'class_updates',
          defaultSound: true,
          defaultVibrateTimings: true,
          notificationPriority: 'PRIORITY_MAX' as const,
          ...(imageUrl ? { image: imageUrl } : {}),
        },
      },
    }

    // Scenario A: Test direct token
    if (token) {
      console.log(`[FCM Test] Sending test notification to direct token: ${token.slice(0, 15)}...`)
      try {
        const responseId = await firebaseAdmin.messaging().send({
          ...notificationPayload,
          token,
        })
        console.log(`[FCM Test] Direct send success: ${responseId}`)
        return NextResponse.json({
          success: true,
          mode: 'DIRECT_TOKEN',
          responseId,
          payload: notificationPayload,
        })
      } catch (err: any) {
        console.error('[FCM Test] Direct send error:', err)
        return NextResponse.json({
          success: false,
          mode: 'DIRECT_TOKEN',
          error: err.message || err.code || 'Unknown Firebase error',
          errorCode: err.code,
        }, { status: 500 })
      }
    }

    // Scenario B: Test targeted user
    const targetUserId = userId || session.userId
    console.log(`[FCM Test] Sending test notification to user ID: ${targetUserId}`)

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { name: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: `User with ID ${targetUserId} not found` }, { status: 404 })
    }

    const deviceTokens = await prisma.fcmDeviceToken.findMany({
      where: { userId: targetUserId },
    })

    if (deviceTokens.length === 0) {
      return NextResponse.json({
        success: false,
        mode: 'USER_TOKENS',
        message: `No registered FCM device tokens found for user ${user.name} (${user.email}).`,
        hint: 'Please open the mobile app, log in, and ensure notification permissions are granted so the device can register its token.',
      })
    }

    const results: any[] = []
    const staleIds: string[] = []

    for (const device of deviceTokens) {
      try {
        const responseId = await firebaseAdmin.messaging().send({
          ...notificationPayload,
          token: device.token,
        })
        results.push({
          deviceId: device.id,
          platform: device.platform,
          tokenSnippet: device.token.slice(0, 15) + '...',
          status: 'SUCCESS',
          responseId,
        })
      } catch (err: any) {
        console.error(`[FCM Test] Send failed for device ${device.id}:`, err)
        if (isStaleFcmTokenError(err)) {
          staleIds.push(device.id)
        }
        results.push({
          deviceId: device.id,
          platform: device.platform,
          tokenSnippet: device.token.slice(0, 15) + '...',
          status: 'FAILED',
          error: err.message || err.code || 'Unknown Firebase error',
          errorCode: err.code,
        })
      }
    }

    // Clean up stale tokens
    if (staleIds.length > 0) {
      console.log(`[FCM Test] Cleaning up ${staleIds.length} stale device tokens...`)
      await prisma.fcmDeviceToken.deleteMany({
        where: { id: { in: staleIds } },
      })
    }

    return NextResponse.json({
      success: true,
      mode: 'USER_TOKENS',
      targetUser: {
        id: targetUserId,
        name: user.name,
        email: user.email,
      },
      totalChecked: deviceTokens.length,
      staleCleanedCount: staleIds.length,
      results,
    })

  } catch (error: any) {
    console.error('[FCM Test] Main handler error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// GET /api/fcm/test — Convenient GET endpoint for testing (Manager/Admin only)
// Tests sending to the currently logged in manager's device tokens
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'MANAGER' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Construct a search param check for specific token or userId
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const userId = searchParams.get('userId')
    const title = searchParams.get('title')
    const body = searchParams.get('body')

    const mockRequest = {
      json: async () => ({
        token,
        userId,
        title,
        body,
      })
    } as any

    return POST(mockRequest)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
