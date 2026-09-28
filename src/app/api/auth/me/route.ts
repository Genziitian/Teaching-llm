import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { hasCompleteProfileFields } from '@/lib/profile-completion'

const COOKIE_NAME = 'teaching_llm_token'

export async function GET() {
  // Step 1: Extract JWT token (same logic as getTokenFromRequest in auth.ts)
  let token: string | undefined = undefined

  try {
    const cookieStore = await cookies()
    token = cookieStore.get(COOKIE_NAME)?.value
  } catch (e) {}

  if (!token) {
    try {
      const headerStore = await headers()
      const authHeader = headerStore.get('Authorization') || headerStore.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    } catch (e) {}
  }

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Step 2: Verify JWT (no DB call)
  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Step 3: DB query — covers user fields + settings
  const [user, settings] = await Promise.all([
    (prisma.user as any).findUnique({
      where: { id: payload.userId },
      select: {
        id: true, name: true, email: true, role: true, avatar: true, gender: true, createdAt: true,
        firstName: true, lastName: true, mobileNumber: true, previousMobileNumber: true,
        age: true, state: true, isProfileComplete: true,
        hasUpdatedProgressSept26: true,
        instagramUrl: true, linkedinUrl: true,
        appTourCompleted: true, appTourCompletedAt: true, completedTourVersion: true,
        isIdentityUpdated: true, iitmJoinYear: true, iitmJoinMonth: true, iitmLevel: true, iitmUserType: true,
        isTerminated: true, tokenVersion: true,
        canTerminate: true, canCreateStudents: true,
        isSuperManager: true,
        enrollments: {
          select: {
            course: {
              select: { id: true, name: true, subject: true }
            }
          }
        },
        instructorAssignments: {
          select: {
            course: {
              select: { id: true, name: true, subject: true }
            }
          }
        }
      },
    }),
    prisma.updateSystemSettings.findUnique({
      where: { id: 'singleton' },
      select: { sept26ProgressUpdateActive: true },
    }).catch(() => null),
  ])

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Security: check termination + token version
  if (user.isTerminated) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const inferredProfileComplete = hasCompleteProfileFields(user)
  const isProfileComplete = user.isProfileComplete || inferredProfileComplete

  if (!user.isProfileComplete && inferredProfileComplete) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isProfileComplete: true },
    })
  }

  const isSept26ProgressUpdateActive = Boolean(settings?.sept26ProgressUpdateActive)

  const transformedUser = {
    ...user,
    isProfileComplete,
    isSuperManager: user.isSuperManager || user.email === 'lkiitmng2428@gmail.com',
    isSept26ProgressUpdateActive,
  }

  // Remove internal fields from response
  delete transformedUser.isTerminated
  delete transformedUser.tokenVersion

  return NextResponse.json({
    user: transformedUser,
    isSept26ProgressUpdateActive: Boolean(settings?.sept26ProgressUpdateActive),
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  })
}
