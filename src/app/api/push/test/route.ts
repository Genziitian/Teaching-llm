import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import webpush from 'web-push'

// GET /api/push/test — Test push notification delivery (Manager only)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'MANAGER' && (session.role !== 'ADMIN' && session.role !== 'MODERATOR'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pubKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_KEY
    const privKey = process.env.VAPID_PRIVATE_KEY

    if (!pubKey || !privKey) {
      return NextResponse.json({
        error: 'VAPID keys not configured on server',
        debug: {
          hasPublicKey: !!process.env.VAPID_PUBLIC_KEY,
          hasPrivateKey: !!process.env.VAPID_PRIVATE_KEY,
          hasNextPublicKey: !!process.env.NEXT_PUBLIC_VAPID_KEY,
        }
      }, { status: 500 })
    }

    webpush.setVapidDetails('mailto:admin@genz-iitian.com', pubKey, privKey)

    // Get all subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      include: { user: { select: { name: true, role: true } } },
    })

    if (subscriptions.length === 0) {
      return NextResponse.json({
        error: 'No push subscriptions found in database',
        message: 'No users have enabled Browser Push Alerts yet. Ask users to go to Settings → Notifications → turn ON "Browser Push Alerts".',
        totalSubscriptions: 0,
      })
    }

    const payload = JSON.stringify({
      title: '🔔 Test Notification',
      body: 'Push notifications are working! You will receive alerts like this for new announcements.',
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      url: '/announcements',
      tag: 'test-notification',
    })

    const results: any[] = []
    const staleIds: string[] = []

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        results.push({
          user: sub.user.name,
          role: sub.user.role,
          status: 'SENT',
          endpoint: sub.endpoint.slice(0, 50) + '...',
        })
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleIds.push(sub.id)
        }
        results.push({
          user: sub.user.name,
          role: sub.user.role,
          status: 'FAILED',
          error: err.message || err.statusCode || 'Unknown error',
          endpoint: sub.endpoint.slice(0, 50) + '...',
        })
      }
    }

    // Clean stale subscriptions
    if (staleIds.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } })
    }

    return NextResponse.json({
      totalSubscriptions: subscriptions.length,
      staleCleaned: staleIds.length,
      results,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
