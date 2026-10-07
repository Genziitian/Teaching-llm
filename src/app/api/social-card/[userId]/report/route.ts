import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager } from '@/lib/auth'

const REPORT_REASONS = new Set([
  'SPAM',
  'HARASSMENT_BULLYING',
  'ABUSIVE_LANGUAGE',
  'INAPPROPRIATE_CONTENT',
  'IMPERSONATION',
  'SCAM_FRAUD',
  'UNWANTED_MESSAGES',
  'ACADEMIC_MISCONDUCT',
  'OTHER',
])

const REPORT_SUB_REASONS: Record<string, Set<string>> = {
  SPAM: new Set([
    'Repeated unwanted messages',
    'Advertising / promotion',
    'Irrelevant repeated content',
    'Suspicious links',
    'Mass messaging',
    'Other spam',
  ]),
  HARASSMENT_BULLYING: new Set([
    'Personal attacks',
    'Threatening behavior',
    'Repeated targeting',
    'Humiliation / mocking',
    'Other',
  ]),
  ABUSIVE_LANGUAGE: new Set([
    'Insults',
    'Hate/derogatory language',
    'Sexual/obscene language',
    'Repeated abusive messages',
    'Other',
  ]),
  INAPPROPRIATE_CONTENT: new Set([
    'Sexual content',
    'Graphic/disturbing content',
    'Offensive material',
    'NSFW content',
    'Other',
  ]),
  IMPERSONATION: new Set([
    'Pretending to be another student',
    'Pretending to be Manager/Admin',
    'Fake identity/profile',
    'Other',
  ]),
  SCAM_FRAUD: new Set([
    'Asking for money',
    'Fake course/payment claim',
    'Suspicious link',
    'Fake offer',
    'Other',
  ]),
  UNWANTED_MESSAGES: new Set([
    'Repeated DMs',
    'Unwanted personal messages',
    'Excessive mentions',
    'Other',
  ]),
  ACADEMIC_MISCONDUCT: new Set([
    'Sharing answers',
    'Cheating-related content',
    'Selling/sharing restricted material',
    'Other',
  ]),
}

function reasonLabel(reason: string) {
  return reason
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.userId === params.userId) {
      return NextResponse.json({ error: 'You cannot report yourself' }, { status: 400 })
    }
    if (isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Staff accounts manage reports through Support tools' }, { status: 403 })
    }

    const { reason, subReason, details } = await request.json()
    const normalizedReason = typeof reason === 'string' ? reason.trim().toUpperCase() : ''
    const cleanSubReason = typeof subReason === 'string' ? subReason.trim().slice(0, 160) : ''
    const cleanDetails = typeof details === 'string' ? details.trim().slice(0, 2000) : ''

    if (!REPORT_REASONS.has(normalizedReason)) {
      return NextResponse.json({ error: 'Please select a valid report reason' }, { status: 400 })
    }
    if (normalizedReason === 'OTHER') {
      if (!cleanDetails) {
        return NextResponse.json({ error: 'Please explain the issue for Other reports' }, { status: 400 })
      }
    } else if (!cleanSubReason || !REPORT_SUB_REASONS[normalizedReason]?.has(cleanSubReason)) {
      return NextResponse.json({ error: 'Please select a valid specific reason' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, name: true, role: true, isTerminated: true },
    })
    if (!target || target.isTerminated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (target.role === 'MANAGER' || (target.role === 'ADMIN' || target.role === 'MODERATOR')) {
      return NextResponse.json({ error: 'Managers cannot be reported from Social Cards' }, { status: 403 })
    }

    const duplicateCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const existing = await prisma.userReport.findFirst({
      where: {
        reportedUserId: target.id,
        reporterId: session.userId,
        reason: normalizedReason,
        status: { in: ['NEW', 'UNDER_REVIEW'] },
        createdAt: { gte: duplicateCutoff },
      },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json({ error: 'You already submitted this report recently' }, { status: 409 })
    }

    const report = await prisma.userReport.create({
      data: {
        reportedUserId: target.id,
        reporterId: session.userId,
        reason: normalizedReason,
        subReason: normalizedReason === 'OTHER' ? null : cleanSubReason,
        details: cleanDetails || null,
        audits: {
          create: {
            actorId: session.userId,
            action: 'CREATED',
            toStatus: 'NEW',
          },
        },
      },
      select: {
        id: true,
        reason: true,
        subReason: true,
        details: true,
        createdAt: true,
      },
    })

    await prisma.notification.create({
      data: {
        userId: target.id,
        title: 'Your account received a user report.',
        content: `Reason: ${reasonLabel(report.reason)}${report.subReason ? `\nSpecific reason: ${report.subReason}` : ''}${report.details ? `\nAdditional details: ${report.details}` : ''}\nDate: ${report.createdAt.toLocaleDateString('en-GB')}`,
        type: 'USER_REPORT',
      },
    })

    return NextResponse.json({ ok: true, reportId: report.id }, { status: 201 })
  } catch (error) {
    console.error('Error creating user report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
