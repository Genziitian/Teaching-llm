import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager, isManager } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { isCourseExpired } from '@/lib/course-state'
import { queueGoogleGroupSyncJobs } from '@/lib/google-group-sync'
import { parseNotificationGroupEmails, queueNotificationGroupSyncJob, normalizeEmail } from '@/lib/notification-group-pool'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        mobileNumber: true,
        email: true,
        role: true,
        securityNumber: true,
        notificationGroupSerial: true,
        createdAt: true,
        gender: true,
        age: true,
        state: true,
        avatar: true,
        isGoogleUser: true,
        isTerminated: true,
        isIdentityUpdated: true,
        iitmJoinYear: true,
        iitmJoinMonth: true,
        iitmLevel: true,
        iitmUserType: true,
        notificationGroupEmails: true,
        isNotificationGroupPending: true,
        pendingPoolCategoryIds: true,
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
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const { name, firstName, lastName, mobileNumber, email, role, isTerminated, gender, age, state, classIds, courseIds, assignedClassIds, assignedCourseIds, bundleIds, enrollmentTypes, iitmJoinYear, iitmJoinMonth, iitmLevel, iitmUserType, isIdentityUpdated, notificationGroupEmails, notificationGroupEmail, deletionRequestedAt } = body
    const nextCourseIds = classIds !== undefined ? classIds : courseIds
    const nextAssignedCourseIds = assignedClassIds !== undefined ? assignedClassIds : assignedCourseIds
    const nextBundleIds = Array.isArray(bundleIds) ? Array.from(new Set(bundleIds.filter(Boolean))) : undefined

    const data: Record<string, any> = {}
    if (firstName !== undefined) data.firstName = firstName
    if (lastName !== undefined) data.lastName = lastName
    
    // Derived name update or explicit name update
    if (name !== undefined) {
      data.name = name
    } else if (firstName !== undefined || lastName !== undefined) {
      // Reconstruct name for legacy support
      const current = await prisma.user.findUnique({ where: { id }, select: { firstName: true, lastName: true, name: true } })
      const fn = firstName !== undefined ? firstName : (current?.firstName || '')
      const ln = lastName !== undefined ? lastName : (current?.lastName || '')
      data.name = `${fn} ${ln}`.trim()
    }

    if (mobileNumber !== undefined) {
      data.mobileNumber = mobileNumber
    }

    if (email !== undefined) data.email = email
    if (role !== undefined) {
      if (!isManager(session.role)) {
        return NextResponse.json({ error: 'Only Managers can assign or change roles' }, { status: 403 })
      }
      data.role = role
    }
    if (typeof isTerminated === 'boolean') {
      if (!isManager(session.role)) {
        return NextResponse.json({ error: 'Only Managers can terminate user accounts' }, { status: 403 })
      }
      data.isTerminated = isTerminated
      // Invalidate all existing sessions when terminating/restoring
      data.tokenVersion = { increment: 1 }
    }
    if (age !== undefined) data.age = age
    if (state !== undefined) data.state = state
    if (iitmJoinYear !== undefined) data.iitmJoinYear = iitmJoinYear
    if (iitmJoinMonth !== undefined) data.iitmJoinMonth = iitmJoinMonth
    if (iitmLevel !== undefined) data.iitmLevel = iitmLevel
    if (iitmUserType !== undefined) data.iitmUserType = iitmUserType
    if (typeof isIdentityUpdated === 'boolean') data.isIdentityUpdated = isIdentityUpdated
    if (deletionRequestedAt !== undefined) {
      data.deletionRequestedAt = deletionRequestedAt ? new Date(deletionRequestedAt) : null
      if (!deletionRequestedAt) {
        data.deletionRequestReason = null
      }
    }
    
    // Manager can update gender anytime
    if (gender !== undefined) {
      if (['MALE', 'FEMALE'].includes(gender.toUpperCase())) {
        data.gender = gender.toUpperCase()
      } else {
        return NextResponse.json(
          { error: 'Invalid gender value. Must be MALE or FEMALE' }, 
          { status: 400 }
        )
      }
    }

    const rawGroupInput = notificationGroupEmails !== undefined ? notificationGroupEmails : notificationGroupEmail
    const nextGroupEmails = rawGroupInput !== undefined
      ? (Array.isArray(rawGroupInput)
          ? Array.from(new Set(rawGroupInput.map((e: string) => normalizeEmail(e)).filter(Boolean)))
          : parseNotificationGroupEmails(rawGroupInput))
      : undefined

    const updatedUser = await prisma.$transaction(async (tx) => {
      if (nextGroupEmails !== undefined) {
        const existingUser = await tx.user.findUnique({
          where: { id },
          select: { notificationGroupEmails: true, email: true },
        })
        const prevGroups = parseNotificationGroupEmails(existingUser?.notificationGroupEmails)
        const addedGroups = nextGroupEmails.filter(e => !prevGroups.includes(e))
        const removedGroups = prevGroups.filter(e => !nextGroupEmails.includes(e))

        data.notificationGroupEmails = nextGroupEmails.join(',')
        data.isNotificationGroupPending = false

        if (existingUser) {
          for (const groupEmail of addedGroups) {
            await queueNotificationGroupSyncJob(tx, { userEmail: existingUser.email, groupEmail, action: 'ADD' })
          }
          for (const groupEmail of removedGroups) {
            await queueNotificationGroupSyncJob(tx, { userEmail: existingUser.email, groupEmail, action: 'REMOVE' })
          }
        }
      }

      const existingEnrollmentRows = (nextCourseIds !== undefined || nextBundleIds !== undefined)
        ? await tx.enrollment.findMany({
            where: { userId: id },
            select: { courseId: true, type: true },
          })
        : []

      const user = await tx.user.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          mobileNumber: true,
          email: true,
          role: true,
          gender: true,
          age: true,
          state: true,
          isTerminated: true,
          createdAt: true,
          isIdentityUpdated: true,
          iitmJoinYear: true,
          iitmJoinMonth: true,
          iitmLevel: true,
          iitmUserType: true,
        },
      })

      if (nextCourseIds !== undefined || nextBundleIds !== undefined) {
        const directCourseIds = Array.isArray(nextCourseIds) ? nextCourseIds : []
        const bundleCourseRows = nextBundleIds && nextBundleIds.length > 0
          ? await tx.courseBundleCourse.findMany({
              where: { bundleId: { in: nextBundleIds } },
              select: { courseId: true },
            })
          : []
        const effectiveCourseIds = Array.from(new Set([
          ...directCourseIds,
          ...bundleCourseRows.map(row => row.courseId),
        ]))
        const previousCourseIds = existingEnrollmentRows.map(row => row.courseId)

        const blockedCourses = effectiveCourseIds.length > 0
          ? await (tx.course.findMany as any)({
              where: { id: { in: effectiveCourseIds } },
              select: { id: true, name: true, isDisabled: true, expiresAt: true },
            })
          : []
        const unavailableCourses = blockedCourses.filter((course: any) => !previousCourseIds.includes(course.id) && (course.isDisabled || isCourseExpired(course)))
        if (unavailableCourses.length > 0) {
          throw new Error(`Disabled or expired courses cannot be assigned: ${unavailableCourses.map(course => course.name).join(', ')}`)
        }

        const addedCourseIds = effectiveCourseIds.filter(courseId => !previousCourseIds.includes(courseId))
        const removedCourseIds = previousCourseIds.filter(courseId => !effectiveCourseIds.includes(courseId))

        await tx.enrollment.deleteMany({ where: { userId: id } })
        if (effectiveCourseIds.length > 0) {
          // Preserve existing enrollment types, apply new ones from enrollmentTypes map
          const existingTypeMap = Object.fromEntries(
            existingEnrollmentRows.map((row: any) => [row.courseId, row.type || 'LIVE'])
          )
          const typeMap = enrollmentTypes && typeof enrollmentTypes === 'object' ? enrollmentTypes : {}

          await tx.enrollment.createMany({
            data: effectiveCourseIds.map((courseId: string) => ({
              userId: id,
              courseId,
              type: typeMap[courseId] || existingTypeMap[courseId] || 'LIVE',
            })),
          })
        }

        if (addedCourseIds.length > 0) {
          await queueGoogleGroupSyncJobs(tx, {
            userEmail: user.email,
            courseIds: addedCourseIds,
            action: 'ADD',
          })
        }
        if (removedCourseIds.length > 0) {
          await queueGoogleGroupSyncJobs(tx, {
            userEmail: user.email,
            courseIds: removedCourseIds,
            action: 'REMOVE',
          })
        }
      }

      // Handle instructor subject assignments (MANAGER only)
      if (nextAssignedCourseIds !== undefined) {
        const blockedInstructorCourses = nextAssignedCourseIds.length > 0
          ? await (tx.course.findMany as any)({
              where: { id: { in: nextAssignedCourseIds } },
              select: { name: true, isDisabled: true, expiresAt: true },
            })
          : []
        const unavailableInstructorCourses = blockedInstructorCourses.filter((course: any) => course.isDisabled || isCourseExpired(course))
        if (unavailableInstructorCourses.length > 0) {
          throw new Error(`Disabled or expired courses cannot be assigned: ${unavailableInstructorCourses.map(course => course.name).join(', ')}`)
        }
        await tx.instructorAssignment.deleteMany({ where: { instructorId: id } })
        if (nextAssignedCourseIds.length > 0) {
          await tx.instructorAssignment.createMany({
            data: nextAssignedCourseIds.map((courseId: string) => ({
              instructorId: id,
              courseId,
            })),
          })
        }
      }

      if (nextBundleIds !== undefined) {
        await tx.userCourseBundleAssignment.deleteMany({ where: { userId: id } })
        if (nextBundleIds.length > 0) {
          await tx.userCourseBundleAssignment.createMany({
            data: nextBundleIds.map((bundleId: string) => ({
              userId: id,
              bundleId,
              assignedById: session.userId,
            })),
          })
        }
      }

      // Re-fetch with enrollments and instructor assignments
      return tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          mobileNumber: true,
          email: true,
          role: true,
          gender: true,
          age: true,
          state: true,
          isTerminated: true,
          createdAt: true,
          isIdentityUpdated: true,
          iitmJoinYear: true,
          iitmJoinMonth: true,
          iitmLevel: true,
          iitmUserType: true,
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
        },
      })
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.USER_UPDATED,
      actionDescription: `${session.name} updated user ${updatedUser?.name || id}`,
      moduleName: MODULE.USER_MGMT,
      targetId: id,
      metadata: { changedFields: Object.keys(data) },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: error instanceof Error ? 400 : 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    if (id === session.userId) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        name: true,
        email: true,
        role: true,
        isSuperManager: true,
        notificationGroupEmails: true,
        enrollments: { select: { courseId: true } },
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (targetUser.isSuperManager) {
      return NextResponse.json({ error: 'Cannot delete a super manager' }, { status: 403 })
    }

    // Soft-delete instead of hard delete: students usually have community messages,
    // tickets, chat sessions, etc. without onDelete: Cascade, so prisma.user.delete()
    // throws a FK constraint error (500). Match the deletion-request flow.
    const originalEmail = targetUser.email
    const groupEmails = parseNotificationGroupEmails(targetUser.notificationGroupEmails)

    await prisma.$transaction(async (tx) => {
      if (originalEmail && targetUser.enrollments.length > 0) {
        await queueGoogleGroupSyncJobs(tx, {
          userEmail: originalEmail,
          courseIds: targetUser.enrollments.map(enrollment => enrollment.courseId),
          action: 'REMOVE',
        })
      }

      for (const groupEmail of groupEmails) {
        await queueNotificationGroupSyncJob(tx, {
          userEmail: originalEmail,
          groupEmail,
          action: 'REMOVE',
        })
      }

      await tx.user.update({
        where: { id },
        data: {
          isTerminated: true,
          tokenVersion: { increment: 1 },
          // Free the email unique constraint so they can re-register later
          email: `deleted_${id}_${Date.now()}@deleted.local`,
          avatar: null,
          aboutMe: null,
          mobileNumber: null,
          instagramUrl: null,
          linkedinUrl: null,
          notificationGroupEmails: null,
          isNotificationGroupPending: false,
          pendingPoolCategoryIds: null,
          deletionRequestedAt: null,
          deletionRequestReason: 'DELETED',
        },
      })
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.USER_DELETED,
      actionDescription: `${session.name} deleted user ${targetUser.name || id} (${originalEmail})`,
      moduleName: MODULE.USER_MGMT,
      targetId: id,
    })

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
