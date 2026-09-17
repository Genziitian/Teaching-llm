import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager, isManagerOrSuperAdmin } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { isCourseEffectivelyDisabled, isCourseExpired } from '@/lib/course-state'
import { queueExplicitGoogleGroupSyncJobs, validateGoogleGroupEmail, parseGoogleGroupEmails, reSyncCourseGroupMembers } from '@/lib/google-group-sync'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const courseState = await (prisma.course.findUnique as any)({
      where: { id },
      select: { id: true, isDisabled: true, expiresAt: true },
    })

    if (!courseState) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const hasManagerLevelAccess = isManagerOrSuperAdmin(session.role)
    const hasPrivilegedCourseAccess = hasManagerLevelAccess || isAdminOrManager(session.role)

    if (isCourseEffectivelyDisabled(courseState) && !hasManagerLevelAccess) {
      return NextResponse.json({ error: 'Course is currently disabled' }, { status: 403 })
    }

    if (!hasPrivilegedCourseAccess) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: session.userId,
            courseId: id,
          },
        },
      })

      if (!enrollment) {
        return NextResponse.json({ error: 'Access denied. You are not enrolled in this course.' }, { status: 403 })
      }
    }

    const courseData = await prisma.course.findUnique({
      where: { id },
      include: {
        lectures: {
          include: { uploadedBy: { select: { name: true } } },
          orderBy: { uploadedAt: 'desc' },
        },
        materials: {
          orderBy: { uploadedAt: 'desc' },
        },
        courseEvents: {
          where: { status: { not: 'CANCELLED' } },
          include: { instructor: { select: { name: true } } },
          orderBy: { startTime: 'asc' },
        },
        topics: {
          include: {
            content: {
              select: {
                isDemo: true,
                videoUrl: true,
                youtubeUrl: true,
                pptUrl: true,
              },
            },
            sharedContentLinks: {
              include: {
                content: {
                  select: {
                    isDemo: true,
                    videoUrl: true,
                    youtubeUrl: true,
                    pptUrl: true,
                  },
                },
              },
            },
          },
        },
        createdBy: { select: { name: true } },
        _count: {
          select: {
            courseEvents: true,
          },
        },
      },
    })

    if (!courseData) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Get user's enrollment to filter content based on access type
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.userId,
          courseId: id,
        },
      },
    })

    const userEnrollmentType = courseData.isDemo ? 'DEMO' : courseData.isFree ? 'FREE' : (enrollment?.type || (hasPrivilegedCourseAccess ? 'LIVE' : null))

    // Filter courseEvents based on enrollment type
    // Only LIVE enrollment users can see live sessions
    // Managers/Admins can see everything
    let filteredCourseEvents = courseData.courseEvents
    if (!hasPrivilegedCourseAccess && userEnrollmentType === 'RECORDED') {
      filteredCourseEvents = [] // RECORDED users cannot see live events
    }

    // Calculate dynamic counts and check demo availability
    const cData = courseData as any
    const topicsCount = cData.topics.length
    let lecturesCount = 0
    let materialsCount = 0
    let hasDemoLectures = false

    cData.topics.forEach((topic: any) => {
      // Count direct content
      topic.content.forEach((content: any) => {
        if (content.isDemo) hasDemoLectures = true
        if (content.videoUrl || content.youtubeUrl) lecturesCount++
        if (content.pptUrl) materialsCount++
      })
      // Count shared content
      topic.sharedContentLinks?.forEach((link: any) => {
        if (link.content?.isDemo) hasDemoLectures = true
        if (link.content?.videoUrl || link.content?.youtubeUrl) lecturesCount++
        if (link.content?.pptUrl) materialsCount++
      })
    })
    if (cData.lectures?.some((l: any) => l.isDemo)) hasDemoLectures = true

    let hasSubmittedFeedback = false
    if (session.role === 'STUDENT') {
      const feedbackCount = await prisma.feedback.count({
        where: {
          studentId: session.userId,
          courseId: id,
        },
      })
      hasSubmittedFeedback = feedbackCount > 0
    }

    const result = {
      ...cData,
      courseEvents: filteredCourseEvents, // Use filtered events based on enrollment type
      enrollmentType: userEnrollmentType,
      hasSubmittedFeedback,
      enrollment: enrollment ? {
        id: enrollment.id,
        createdAt: enrollment.createdAt,
        type: enrollment.type,
      } : null,
      hasDemoLectures,
      isExpired: hasManagerLevelAccess ? false : isCourseExpired(cData),
      isEffectivelyDisabled: hasManagerLevelAccess ? false : isCourseEffectivelyDisabled(cData),
      _count: {
        ...cData._count,
        topics: topicsCount,
        lectures: lecturesCount,
        materials: materialsCount,
        // Show actual count of available events to the user
        courseEvents: filteredCourseEvents.length,
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching course:', error)
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

    if (session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { name, description, subject, color, icon, courseIconType, expiresAt, teacherName, isCommunityActive, isDisabled, googleGroupEmail, liveGoogleGroupEmail, liveUpgradePrice, requireFeedback, aboutUs, startDate, endDate } = await request.json()

    if (isDisabled !== undefined && !isManagerOrSuperAdmin(session.role)) {
      return NextResponse.json({ error: 'Only managers can enable or disable courses' }, { status: 403 })
    }

    const existingCourse = await (prisma.course.findUnique as any)({ where: { id } })
    if (!existingCourse) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Validate expiresAt if provided
    if (expiresAt) {
      const expiryDate = new Date(expiresAt)
      if (expiryDate.toString() === 'Invalid Date') {
        return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 })
      }
      if (expiryDate <= new Date() && !existingCourse.expiresAt) {
        return NextResponse.json({ error: 'Expiry date must be in the future' }, { status: 400 })
      }
    }

    // Demo state and Free state are immutable on edit.
    const normalizedGoogleGroupEmail = validateGoogleGroupEmail(googleGroupEmail)
    const normalizedLiveGoogleGroupEmail = validateGoogleGroupEmail(liveGoogleGroupEmail)

    const updatedCourse = await prisma.$transaction(async (tx) => {
      const updated = await (tx.course.update as any)({
        where: { id },
        data: {
          name: name !== undefined ? name : undefined,
          description: description !== undefined ? (description || null) : undefined,
          subject: subject !== undefined ? subject : undefined,
          color: color !== undefined ? color : undefined,
          icon: icon || existingCourse.icon || 'BookOpen',
          courseIconType: courseIconType || existingCourse.courseIconType || 'book_open',
          teacherName: teacherName !== undefined ? (teacherName ? String(teacherName).trim() : null) : undefined,
          liveUpgradePrice: liveUpgradePrice !== undefined ? (liveUpgradePrice === '' || liveUpgradePrice === null ? null : Number(liveUpgradePrice)) : undefined,
          googleGroupEmail: normalizedGoogleGroupEmail !== undefined ? normalizedGoogleGroupEmail : undefined,
          liveGoogleGroupEmail: normalizedLiveGoogleGroupEmail !== undefined ? normalizedLiveGoogleGroupEmail : undefined,
          isDemo: existingCourse.isDemo,
          isFree: existingCourse.isFree,
          isCommunityActive: isCommunityActive !== undefined ? !!isCommunityActive : undefined,
          isDisabled: isDisabled !== undefined ? !!isDisabled : undefined,
          requireFeedback: requireFeedback !== undefined ? !!requireFeedback : undefined,
          expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : undefined,
          aboutUs: aboutUs !== undefined ? (aboutUs || null) : undefined,
          startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
          endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
        },
      })

      // Re-sync members if Google Group configuration changed
      if (
        existingCourse.googleGroupEmail !== updated.googleGroupEmail ||
        existingCourse.liveGoogleGroupEmail !== updated.liveGoogleGroupEmail ||
        existingCourse.isDisabled !== updated.isDisabled
      ) {
        await reSyncCourseGroupMembers(tx, id)
      }

      return updated
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.COURSE_UPDATED,
      actionDescription: `${session.name} updated course "${updatedCourse.name}"`,
      moduleName: MODULE.COURSES,
      targetId: id,
    })

    return NextResponse.json(updatedCourse)
  } catch (error) {
    console.error('Error updating course:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    const courseToDelete = await prisma.course.findUnique({
      where: { id },
      select: { name: true, isDemo: true },
    })

    if (!courseToDelete) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    if (courseToDelete.isDemo) {
      return NextResponse.json({ 
        error: 'Cannot delete the Demo Course. It is required for new student enrollment.' 
      }, { status: 400 })
    }

    await prisma.course.delete({ where: { id } })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.COURSE_DELETED,
      actionDescription: `${session.name} deleted course "${courseToDelete?.name ?? id}"`,
      moduleName: MODULE.COURSES,
      targetId: id,
    })

    return NextResponse.json({ message: 'Course deleted successfully' })
  } catch (error) {
    console.error('Error deleting course:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
