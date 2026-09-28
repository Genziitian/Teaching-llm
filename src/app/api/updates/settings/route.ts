import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isManager } from '@/lib/auth'
import { setMaintenanceMode, setMaintenanceEndTime } from '@/lib/ratelimit'

/**
 * GET /api/updates/settings  - returns global welcomeEnabled / customEnabled
 * PUT /api/updates/settings  - updates global settings
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session || !isManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [settings, completedSept26Count] = await Promise.all([
      prisma.updateSystemSettings.upsert({
        where: { id: 'singleton' },
        create: { 
          id: 'singleton', 
          welcomeEnabled: true, 
          customEnabled: true,
          maintenanceMode: false,
          maintenanceEndsAt: null,
          sept26ProgressUpdateActive: false,
        },
        update: {},
      }),
      prisma.user.count({
        where: { hasUpdatedProgressSept26: true },
      }),
    ])

    return NextResponse.json({ settings, completedSept26Count })
  } catch (error) {
    console.error('Error fetching update settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !isManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { welcomeEnabled, customEnabled, maintenanceMode, maintenanceEndsAt, sept26ProgressUpdateActive } = body

    const endsAtDate = maintenanceEndsAt ? new Date(maintenanceEndsAt) : null

    const settings = await prisma.updateSystemSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        welcomeEnabled: welcomeEnabled ?? true,
        customEnabled: customEnabled ?? true,
        maintenanceMode: maintenanceMode ?? false,
        maintenanceEndsAt: endsAtDate,
        sept26ProgressUpdateActive: sept26ProgressUpdateActive ?? false,
      },
      update: {
        ...(welcomeEnabled !== undefined && { welcomeEnabled }),
        ...(customEnabled !== undefined && { customEnabled }),
        ...(maintenanceMode !== undefined && { maintenanceMode }),
        ...(maintenanceEndsAt !== undefined && { maintenanceEndsAt: endsAtDate }),
        ...(sept26ProgressUpdateActive !== undefined && { sept26ProgressUpdateActive }),
      },
    })

    if (maintenanceMode !== undefined) {
      await setMaintenanceMode(maintenanceMode)
    }

    if (maintenanceEndsAt !== undefined) {
      await setMaintenanceEndTime(endsAtDate ? endsAtDate.toISOString() : null)
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error updating update settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
