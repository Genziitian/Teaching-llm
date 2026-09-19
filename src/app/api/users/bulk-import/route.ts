import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { queueGoogleGroupSyncJobs } from '@/lib/google-group-sync'
import { scheduleWelcomeSequence } from '@/lib/welcome-notifications'
import { getOrAssignPoolCategory } from '@/lib/notification-group-pool'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase()
}

function nameFromEmail(email: string) {
  const local = email.split('@')[0] || 'student'
  const parts = local
    .replace(/[._+-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))

  const firstName = parts[0] || 'Student'
  const lastName = parts.slice(1).join(' ')
  const name = `${firstName}${lastName ? ` ${lastName}` : ''}`.trim()
  return { name, firstName, lastName }
}

function generateSecurityNumber() {
  return 'SEC' + Math.random().toString(36).substring(2, 9).toUpperCase()
}

function parseEmails(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map(v => String(v)).map(normalizeEmail).filter(Boolean)
  }
  if (typeof input === 'string') {
    return input
      .split(/[\s,;]+/)
      .map(normalizeEmail)
      .filter(Boolean)
  }
  return []
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const emails = Array.from(new Set(parseEmails(body.emails ?? body.text ?? '')))

    if (emails.length === 0) {
      return NextResponse.json({ error: 'Paste at least one email address' }, { status: 400 })
    }
    if (emails.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 emails per import' }, { status: 400 })
    }

    const invalid = emails.filter(e => !EMAIL_RE.test(e))
    const validEmails = emails.filter(e => EMAIL_RE.test(e))

    const existing = validEmails.length > 0
      ? await prisma.user.findMany({
          where: { email: { in: validEmails } },
          select: { email: true },
        })
      : []
    const existingSet = new Set(existing.map(u => u.email.toLowerCase()))

    const toCreate = validEmails.filter(e => !existingSet.has(e))

    const demoCourse = await prisma.course.findFirst({
      where: { isDemo: true },
      select: { id: true },
    })

    const created: Array<{ email: string; id: string; securityNumber: string; name: string }> = []
    const failed: Array<{ email: string; error: string }> = []

    for (const email of toCreate) {
      try {
        const { name, firstName, lastName } = nameFromEmail(email)
        const securityNumber = generateSecurityNumber()

        const user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              name,
              firstName,
              lastName,
              email,
              role: 'STUDENT',
              securityNumber,
            },
            select: {
              id: true,
              email: true,
              name: true,
              securityNumber: true,
            },
          })

          await getOrAssignPoolCategory(tx, newUser.email)

          if (demoCourse) {
            await tx.enrollment.create({
              data: {
                userId: newUser.id,
                courseId: demoCourse.id,
                type: 'LIVE',
              },
            })
            await queueGoogleGroupSyncJobs(tx, {
              userEmail: newUser.email,
              courseIds: [demoCourse.id],
              action: 'ADD',
            })
          }

          return newUser
        })

        scheduleWelcomeSequence(user.id).catch(console.error)
        created.push({
          email: user.email,
          id: user.id,
          securityNumber: user.securityNumber || securityNumber,
          name: user.name,
        })
      } catch (err) {
        failed.push({
          email,
          error: err instanceof Error ? err.message : 'Failed to create',
        })
      }
    }

    if (created.length > 0) {
      logActivity({
        userId: session.userId,
        userName: session.name,
        userRole: session.role,
        actionType: ACTION.USER_CREATED,
        actionDescription: `${session.name} bulk-imported ${created.length} student(s)`,
        moduleName: MODULE.USER_MGMT,
      })
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: emails.length,
        created: created.length,
        skippedExisting: existingSet.size,
        invalid: invalid.length,
        failed: failed.length,
      },
      created,
      skippedExisting: Array.from(existingSet),
      invalid,
      failed,
    })
  } catch (error) {
    console.error('[bulk-import] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
