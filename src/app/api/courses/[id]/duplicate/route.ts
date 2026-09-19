import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { checkRateLimit } from '@/lib/ratelimit'
import { ensureCourseColumns } from '@/lib/course-schema-sync'

export async function POST(
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

    await ensureCourseColumns()

    const { id } = await params

    // Rate limiting
    const rateLimit = await checkRateLimit(session.userId, 'general')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'You are doing this too fast, please wait.' },
        { status: 429 }
      )
    }

    // Fetch source course with all related data
    const sourceCourse = await prisma.course.findUnique({
      where: { id },
      include: {
        topics: {
          include: {
            content: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        materials: {
          where: { courseId: id },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    })

    if (!sourceCourse) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Create duplicate course in transaction - all-or-nothing atomic operation
    const duplicatedCourse = await prisma.$transaction(async (tx) => {
      // 1. Create new course with same metadata
      const newCourse = await (tx.course.create as any)({
        data: {
          name: sourceCourse.name,
          description: sourceCourse.description,
          subject: sourceCourse.subject,
          color: sourceCourse.color,
          icon: sourceCourse.icon,
          courseIconType: (sourceCourse as any).courseIconType || 'book_open',
          teacherName: sourceCourse.teacherName,
          isCommunityActive: sourceCourse.isCommunityActive,
          // Note: we don't copy isDemo, isFree, isDisabled, expiresAt as these are administrative flags
          createdById: session.userId,
        },
      })

      // 2. Duplicate all topics and their content (completely independent copies)
      for (const topic of sourceCourse.topics) {
        const newTopic = await tx.topic.create({
          data: {
            courseId: newCourse.id,
            title: topic.title,
            order: topic.order,
          },
        })

        // 3. Create NEW content records with same video/ppt URLs (independent but storage-efficient)
        for (const content of topic.content) {
          await tx.content.create({
            data: {
              topicId: newTopic.id,
              title: content.title,
              description: content.description,
              videoUrl: content.videoUrl,      // Reuse video URL (don't re-upload)
              youtubeUrl: content.youtubeUrl,  // Reuse YouTube URL
              pptUrl: content.pptUrl,          // Reuse PPT URL (don't re-upload)
              isRecordingOnly: content.isRecordingOnly,
              videoSource: content.videoSource,
              order: content.order,
              // New Content ID is auto-generated, making this completely independent
            },
          })
        }
      }

      // 4. Create NEW material records with same file URLs (independent but storage-efficient)
      for (const material of sourceCourse.materials) {
        await tx.material.create({
          data: {
            courseId: newCourse.id,
            title: material.title,
            description: material.description,
            fileUrl: material.fileUrl,        // Reuse file URL (don't re-upload)
            fileType: material.fileType,
            fileSize: material.fileSize,
            isGlobal: material.isGlobal,
            uploadedById: session.userId,
            // New Material ID is auto-generated, making this completely independent
          },
        })
      }

      return newCourse
    })

    // Log activity
    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.COURSE_CREATED,
      actionDescription: `${session.name} duplicated course "${sourceCourse.name}" to create "${duplicatedCourse.name}"`,
      moduleName: MODULE.COURSES,
      targetId: duplicatedCourse.id,
    })

    return NextResponse.json(
      {
        id: duplicatedCourse.id,
        name: duplicatedCourse.name,
        message: 'Course duplicated successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error duplicating course:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
