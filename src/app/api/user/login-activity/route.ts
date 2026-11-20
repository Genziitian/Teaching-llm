import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * "Where you're logged in": one row per device (latest login first) with place and login count.
 * Own activity for anyone; ?userId= for managers/admins looking at a user (they also see the IP).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const asked = new URL(request.url).searchParams.get('userId')
    const staff = isAdminOrManager(session.role)
    if (asked && asked !== session.userId && !staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const userId = asked || session.userId

    const logs = await prisma.loginLog.findMany({
      where: { userId, deviceId: { not: null } },
      orderBy: { timestamp: 'desc' },
      take: 300,
    })
    const current = request.headers.get('x-device-id') || request.cookies.get('gz_did')?.value
    const devices = new Map<string, any>()
    for (const l of logs) {
      const d = devices.get(l.deviceId!)
      if (d) { d.logins++; continue }
      devices.set(l.deviceId!, {
        deviceId: l.deviceId,
        deviceName: l.deviceName,
        platform: l.platform,
        os: l.os,
        appVersion: l.appVersion,
        city: l.city,
        region: l.region,
        country: l.country,
        lastLoginAt: l.timestamp,
        logins: 1,
        isCurrent: userId === session.userId && l.deviceId === current,
        ...(staff ? { ip: l.ip } : {}),
      })
    }
    return NextResponse.json({ devices: Array.from(devices.values()) })
  } catch (error) {
    console.error('login-activity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
