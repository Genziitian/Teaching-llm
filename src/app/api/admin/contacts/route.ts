import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { queueGoogleGroupSyncJobs } from '@/lib/google-group-sync'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const studentId = searchParams.get('studentId')?.trim() || ''
    const exportFormat = searchParams.get('export')?.toLowerCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const skip = (page - 1) * limit

    const whereClause: any = {}

    if (studentId) {
      whereClause.studentId = studentId
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { student: { name: { contains: search, mode: 'insensitive' } } },
        { student: { email: { contains: search, mode: 'insensitive' } } },
        { student: { mobileNumber: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // CSV Export Flow
    if (exportFormat === 'csv') {
      const allContacts = await prisma.studentContact.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              mobileNumber: true,
            },
          },
        },
      })

      const csvRows: string[] = [
        ['Contact Name', 'Phone Number', 'Email', 'Source', 'Synced By Student', 'Student Email', 'Student Phone', 'Sync Date'].map(escapeCsv).join(','),
      ]

      for (const c of allContacts) {
        csvRows.push([
          c.name || 'Unnamed',
          c.phoneNumber || '',
          c.email || '',
          c.source || 'APP',
          c.student?.name || 'Unknown',
          c.student?.email || '',
          c.student?.mobileNumber || '',
          new Date(c.createdAt).toISOString(),
        ].map(escapeCsv).join(','))
      }

      const csvContent = csvRows.join('\n')
      const fileName = `contacts_export_${new Date().toISOString().slice(0, 10)}.csv`

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      })
    }

    // Paginated List, Summary Metrics & Students List
    const [total, contacts, studentGroups, totalUniquePhones] = await Promise.all([
      prisma.studentContact.count({ where: whereClause }),
      prisma.studentContact.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              gender: true,
              mobileNumber: true,
            },
          },
        },
      }),
      prisma.studentContact.groupBy({
        by: ['studentId'],
        _count: { id: true },
      }),
      prisma.studentContact.groupBy({
        by: ['phoneNumber'],
      }).then(r => r.length),
    ])

    // Load student user details for the student dropdown
    const studentUserIds = studentGroups.map(s => s.studentId).filter(Boolean)
    const studentUsers = studentUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: studentUserIds } },
          select: { id: true, name: true, email: true, avatar: true },
        })
      : []

    const studentUsersMap = new Map(studentUsers.map(u => [u.id, u]))
    const studentsList = studentGroups.map(g => {
      const u = studentUsersMap.get(g.studentId)
      return {
        id: g.studentId,
        name: u?.name || 'Unknown Student',
        email: u?.email || '',
        avatar: u?.avatar || null,
        contactCount: g._count.id,
      }
    }).sort((a, b) => b.contactCount - a.contactCount)

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalContacts: total,
        totalStudentsWithContacts: studentGroups.length,
        uniquePhoneNumbers: totalUniquePhones,
      },
      studentsList,
    })
  } catch (error) {
    console.error('Error fetching admin contacts:', error)
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let contactId = searchParams.get('contactId')?.trim() || searchParams.get('id')?.trim() || ''
    let studentId = searchParams.get('studentId')?.trim() || ''
    let deleteUserAccount = searchParams.get('deleteUserAccount') === 'true'

    // Also check JSON body if not passed in query params
    if (!contactId && !studentId) {
      try {
        const body = await request.json()
        if (body.contactId || body.id) contactId = String(body.contactId || body.id).trim()
        if (body.studentId) studentId = String(body.studentId).trim()
        if (body.deleteUserAccount) deleteUserAccount = Boolean(body.deleteUserAccount)
      } catch {}
    }

    if (!contactId && !studentId) {
      return NextResponse.json({ error: 'Either contactId or studentId is required' }, { status: 400 })
    }

    // ── 1. Single Contact Deletion ──
    if (contactId) {
      const contact = await prisma.studentContact.findUnique({
        where: { id: contactId },
        include: { student: { select: { id: true, name: true, email: true } } },
      })

      if (!contact) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
      }

      await prisma.studentContact.delete({
        where: { id: contactId },
      })

      logActivity({
        userId: session.userId,
        userName: session.name,
        userRole: session.role,
        actionType: ACTION.CONTENT_DELETED,
        actionDescription: `${session.name} deleted synced contact ${contact.name || contact.phoneNumber || contactId} (synced by ${contact.student?.name || 'unknown'})`,
        moduleName: MODULE.USER_MGMT,
        targetId: contactId,
      })

      return NextResponse.json({
        success: true,
        message: `Deleted contact ${contact.name || contact.phoneNumber || ''}`,
      })
    }

    // ── 2. Whole User Contacts / Data Deletion ──
    if (studentId) {
      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          enrollments: { select: { courseId: true } },
        },
      })

      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }

      const count = await prisma.studentContact.count({
        where: { studentId },
      })

      // If user account deletion is requested as well
      if (deleteUserAccount) {
        if (session.role !== 'MANAGER') {
          return NextResponse.json({ error: 'Only managers can delete user accounts' }, { status: 403 })
        }
        if (student.id === session.userId) {
          return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
        }

        await prisma.$transaction(async (tx) => {
          if (student.email && student.enrollments.length > 0) {
            await queueGoogleGroupSyncJobs(tx, {
              userEmail: student.email,
              courseIds: student.enrollments.map(e => e.courseId),
              action: 'REMOVE',
            })
          }
          await tx.user.delete({ where: { id: studentId } })
        })

        logActivity({
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          actionType: ACTION.USER_DELETED,
          actionDescription: `${session.name} deleted user ${student.name} (${student.email}) and all ${count} synced contacts`,
          moduleName: MODULE.USER_MGMT,
          targetId: studentId,
        })

        return NextResponse.json({
          success: true,
          userDeleted: true,
          count,
          message: `Deleted user ${student.name} and removed ${count} synced contacts`,
        })
      }

      // Default: delete all contacts synced by this student
      const deleteResult = await prisma.studentContact.deleteMany({
        where: { studentId },
      })

      logActivity({
        userId: session.userId,
        userName: session.name,
        userRole: session.role,
        actionType: ACTION.CONTENT_DELETED,
        actionDescription: `${session.name} removed all ${deleteResult.count} synced contacts for student ${student.name} (${student.email})`,
        moduleName: MODULE.USER_MGMT,
        targetId: studentId,
      })

      return NextResponse.json({
        success: true,
        count: deleteResult.count,
        message: `Successfully removed all ${deleteResult.count} contacts synced by ${student.name}`,
      })
    }
  } catch (error) {
    console.error('Error deleting contact(s):', error)
    return NextResponse.json({ error: 'Failed to delete contact(s)' }, { status: 500 })
  }
}

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}
