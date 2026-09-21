import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSession, isManagerOrSuperAdmin } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { isCourseExpired } from '@/lib/course-state'
import { queueGoogleGroupSyncJobs } from '@/lib/google-group-sync'
import { scheduleWelcomeSequence } from '@/lib/welcome-notifications'
import { getOrAssignPoolCategory } from '@/lib/notification-group-pool'

const normalizePhoneSearch = (value: string) => value.replace(/\D/g, '')

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isManagerOrSuperAdmin(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const courseId = searchParams.get('courseId')?.trim() || ''
    const iitmLevel = searchParams.get('iitmLevel')?.trim() || ''
    const state = searchParams.get('state')?.trim() || ''
    const iitmUserType = searchParams.get('iitmUserType')?.trim() || ''

    const profileFilters: Prisma.UserWhereInput[] = []
    if (iitmLevel) {
      profileFilters.push({ iitmLevel: { equals: iitmLevel, mode: 'insensitive' } })
    }
    if (state) {
      profileFilters.push({ state: { equals: state, mode: 'insensitive' } })
    }
    if (iitmUserType) {
      profileFilters.push({ iitmUserType: { equals: iitmUserType, mode: 'insensitive' } })
    }
    const hasProfileFilters = profileFilters.length > 0

    const courseFilter: Prisma.UserWhereInput | null =
      courseId && courseId !== 'all'
        ? {
            OR: [
              { enrollments: { some: { courseId } } },
              { instructorAssignments: { some: { courseId } } },
            ],
          }
        : null

    const userSelect = {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      mobileNumber: true,
      email: true,
      role: true,
      gender: true,
      state: true,
      avatar: true,
      securityNumber: true,
      notificationGroupSerial: true,
      isTerminated: true,
      isGoogleUser: true,
      isSuperManager: true,
      canTerminate: true,
      canCreateStudents: true,
      notificationGroupEmails: true,
      isNotificationGroupPending: true,
      deletionRequestedAt: true,
      deletionRequestReason: true,
      iitmLevel: true,
      iitmUserType: true,
      createdAt: true,
      enrollments: {
        select: {
          courseId: true,
          type: true,
          course: { select: { id: true, name: true, color: true, subject: true } },
        },
      },
      instructorAssignments: {
        select: {
          courseId: true,
          course: { select: { id: true, name: true, color: true, subject: true } },
        },
      },
      courseBundleAssignments: {
        select: {
          bundleId: true,
          bundle: {
            select: {
              id: true,
              name: true,
              courses: {
                select: {
                  course: { select: { id: true, name: true, color: true, subject: true } },
                },
              },
            },
          },
        },
      },
    }

    // Soft-deleted accounts stay in DB for FK safety but should not appear here.
    // SQL treats NULL != 'DELETED' as unknown, so `NOT reason = 'DELETED'` would
    // hide every normal user (reason is null). Explicitly keep nulls.
    const notSoftDeleted = {
      OR: [
        { deletionRequestReason: null },
        { deletionRequestReason: { not: 'DELETED' } },
      ],
    }

    // No search query: fetch all ADMIN, MANAGER, and INSTRUCTOR users,
    // plus the latest 500 STUDENT users, to avoid overloading.
    if (!search) {
      if (courseFilter || hasProfileFilters) {
        const users = await prisma.user.findMany({
          where: {
            AND: [
              notSoftDeleted,
              ...(courseFilter ? [courseFilter] : []),
              ...profileFilters,
            ],
          },
          select: userSelect,
          orderBy: { createdAt: 'desc' },
          ...(hasProfileFilters && !courseFilter ? { take: 500 } : {}),
        })
        return NextResponse.json({
          users,
          limited: hasProfileFilters && !courseFilter && users.length === 500,
        })
      }

      const staffUsers = await prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'MANAGER', 'INSTRUCTOR'] },
          ...notSoftDeleted,
        },
        select: userSelect,
        orderBy: { createdAt: 'desc' },
      })

      const studentUsers = await prisma.user.findMany({
        where: {
          role: 'STUDENT',
          ...notSoftDeleted,
        },
        select: userSelect,
        orderBy: { createdAt: 'desc' },
        take: 500,
      })

      const deletionRequestUsers = await prisma.user.findMany({
        where: {
          deletionRequestedAt: { not: null },
          ...notSoftDeleted,
        },
        select: userSelect,
        orderBy: { deletionRequestedAt: 'desc' },
      })

      // Combine and deduplicate users by ID
      const userMap = new Map<string, any>()
      for (const u of [...deletionRequestUsers, ...staffUsers, ...studentUsers]) {
        userMap.set(u.id, u)
      }
      const users = Array.from(userMap.values()).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      return NextResponse.json({ users, limited: true })
    }

    const normalizedMobileSearch = normalizePhoneSearch(search)
    const mobileMatchedUserIds = normalizedMobileSearch.length >= 3
      ? (await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT "id"
          FROM "User"
          WHERE regexp_replace(coalesce("mobileNumber", ''), '[^0-9]', '', 'g') LIKE ${`%${normalizedMobileSearch}%`}
          LIMIT 500
        `)).map(user => user.id)
      : []

    const searchFields: any[] = [
      { name: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { securityNumber: { contains: search, mode: 'insensitive' } },
      { mobileNumber: { contains: search, mode: 'insensitive' } },
    ]

    // Exact match on unique group serial (e.g. "1401" or "#1401")
    const serialSearch = Number(search.replace(/^#/, '').trim())
    if (Number.isInteger(serialSearch) && serialSearch > 0 && String(serialSearch) === search.replace(/^#/, '').trim()) {
      searchFields.push({ notificationGroupSerial: serialSearch })
    }

    if (mobileMatchedUserIds.length > 0) {
      searchFields.push({ id: { in: mobileMatchedUserIds } })
    }

    // Search query provided: search across all users, optionally filtering by courseId
    const whereClause: any = {
      AND: [
        notSoftDeleted,
        {
          OR: searchFields,
        }
      ]
    }

    if (courseFilter) {
      whereClause.AND.push(courseFilter)
    }

    if (hasProfileFilters) {
      whereClause.AND.push(...profileFilters)
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    return NextResponse.json({ users, limited: false })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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

    const {
      name,
      firstName,
      lastName,
      mobileNumber,
      email,
      role,
      gender = 'MALE',
      classIds = [],
      courseIds = [],
      assignedClassIds = [],
      bundleIds = [],
      enrollmentTypes = {},
    } = await request.json()
    const finalClassIds = classIds.length > 0 ? classIds : courseIds

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    const securityNumber = 'SEC' + Math.random().toString(36).substring(2, 9).toUpperCase()
    const uniqueBundleIds = Array.from(new Set((bundleIds || []).filter(Boolean))) as string[]

    const user = await prisma.$transaction(async (tx) => {
      const bundleCourseRows = uniqueBundleIds.length > 0
        ? await tx.courseBundleCourse.findMany({
            where: { bundleId: { in: uniqueBundleIds } },
            select: { courseId: true },
          })
        : []
      let effectiveCourseIds = Array.from(new Set([
        ...finalClassIds,
        ...bundleCourseRows.map(row => row.courseId),
      ]))

      // Auto-enroll in demo course if one exists and user is a STUDENT
      if (role === 'STUDENT') {
        const demoCourse = await (tx.course.findFirst as any)({
          where: { isDemo: true },
          select: { id: true }
        })
        if (demoCourse && !effectiveCourseIds.includes(demoCourse.id)) {
          effectiveCourseIds.push(demoCourse.id)
        }
      }

      const blockedCourses = effectiveCourseIds.length > 0
        ? await (tx.course.findMany as any)({
            where: { id: { in: effectiveCourseIds } },
            select: { name: true, isDisabled: true, expiresAt: true },
          })
        : []
      const unavailableCourses = blockedCourses.filter((course: any) => course.isDisabled || isCourseExpired(course))
      if (unavailableCourses.length > 0) {
        throw new Error(`Disabled or expired courses cannot be assigned: ${unavailableCourses.map(course => course.name).join(', ')}`)
      }

      if (role === 'INSTRUCTOR' && assignedClassIds.length > 0) {
        const blockedInstructorCourses = await (tx.course.findMany as any)({
          where: { id: { in: assignedClassIds } },
          select: { name: true, isDisabled: true, expiresAt: true },
        })
        const unavailableInstructorCourses = blockedInstructorCourses.filter((course: any) => course.isDisabled || isCourseExpired(course))
        if (unavailableInstructorCourses.length > 0) {
          throw new Error(`Disabled or expired courses cannot be assigned: ${unavailableInstructorCourses.map(course => course.name).join(', ')}`)
        }
      }

      const newUser = await tx.user.create({
        data: {
          name: name || `${firstName} ${lastName || ''}`.trim(),
          firstName: firstName || name?.split(' ')[0] || '',
          lastName: lastName || name?.split(' ').slice(1).join(' ') || '',
          mobileNumber,
          email: email.toLowerCase(),
          role,
          securityNumber,
          gender,
        },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true,
        },
      })

      // Auto-assign new user to default Notification Pool Category (or queue in Category Overflow)
      await getOrAssignPoolCategory(tx, newUser.email)

      if (effectiveCourseIds.length > 0) {
        await tx.enrollment.createMany({
          data: effectiveCourseIds.map((courseId: string) => ({
            userId: newUser.id,
            courseId,
            type: (enrollmentTypes && enrollmentTypes[courseId]) || 'LIVE'
          })),
        })
        await queueGoogleGroupSyncJobs(tx, {
          userEmail: newUser.email,
          courseIds: effectiveCourseIds,
          action: 'ADD',
        })
      }

      if (uniqueBundleIds.length > 0) {
        await tx.userCourseBundleAssignment.createMany({
          data: uniqueBundleIds.map((bundleId: string) => ({
            userId: newUser.id,
            bundleId,
            assignedById: session.userId,
          })),
        })
      }

      // Create instructor assignments if role is INSTRUCTOR
      if (role === 'INSTRUCTOR' && assignedClassIds.length > 0) {
        await tx.instructorAssignment.createMany({
          data: assignedClassIds.map((courseId: string) => ({
            instructorId: newUser.id,
            courseId,
          })),
        })
      }

      return newUser
    })

    // If a STUDENT is manually created, schedule the welcome drip notifications (non-blocking)
    if (role === 'STUDENT') {
      scheduleWelcomeSequence(user.id).catch(console.error)
    }

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.USER_CREATED,
      actionDescription: `${session.name} created ${role} account for ${name} (${email})`,
      moduleName: MODULE.USER_MGMT,
      targetId: user.id,
    })

    return NextResponse.json({
      ...user,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: error instanceof Error ? 400 : 500 })
  }
}
