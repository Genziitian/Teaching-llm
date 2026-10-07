import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signToken, getCookieConfig } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

// One-tap "Quick login as Student" used by the Capacitor APK as a
// backup when native Google sign-in is unavailable. Signs in as the
// user whose email is configured in STUDENT_QUICK_LOGIN_EMAIL. The
// endpoint returns 403 when the env var is unset, so production stays
// inert by default — set the env var only when testers need access.
export async function POST(_request: NextRequest) {
  const targetEmail = process.env.STUDENT_QUICK_LOGIN_EMAIL?.trim().toLowerCase()
  if (!targetEmail) {
    return NextResponse.json({ error: 'Quick login is disabled.' }, { status: 403 })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: targetEmail } })
    if (!user) {
      return NextResponse.json({ error: 'Configured quick-login account not found.' }, { status: 404 })
    }
    if (user.isTerminated) {
      return NextResponse.json({ error: 'This account has been deactivated.' }, { status: 403 })
    }

    // Read current tokenVersion (don't increment — allows multi-device sessions)
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenVersion: true },
    })

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'MANAGER' | 'MODERATOR' | 'ADMIN' | 'STUDENT',
      name: user.name,
      canTerminate: user.canTerminate,
      canCreateStudents: user.canCreateStudents,
      tokenVersion: currentUser?.tokenVersion ?? 0,
    })

    const { name: cookieName, options } = getCookieConfig()
    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    })
    response.cookies.set(cookieName, token, options)

    await prisma.loginLog.create({ data: { userId: user.id } })
    logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      securityNumber: user.securityNumber,
      actionType: ACTION.USER_LOGIN,
      actionDescription: `${user.name} logged in via APK quick-login`,
      moduleName: MODULE.AUTH,
    })

    return response
  } catch (error: any) {
    console.error('Quick login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
