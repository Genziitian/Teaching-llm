import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager } from '@/lib/auth'
import { ensureHomeworkTables } from '@/lib/homework-schema-sync'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || !isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureHomeworkTables()

    const { id } = await params
    const homework = await prisma.homework.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, name: true },
        },
      },
    })

    if (!homework) {
      return NextResponse.json({ error: 'Homework not found' }, { status: 404 })
    }

    // Get all enrolled students for this course
    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId: homework.courseId,
        user: { role: 'STUDENT', isTerminated: false },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
            avatar: true,
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    })

    // Get all submissions for this homework
    const submissions = await prisma.homeworkSubmission.findMany({
      where: { homeworkId: id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
            avatar: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    })

    const submissionMap = new Map<string, any>()
    submissions.forEach(sub => {
      submissionMap.set(sub.studentId, sub)
    })

    const students = enrollments.map(e => {
      const sub = submissionMap.get(e.userId)
      return {
        studentId: e.user.id,
        name: e.user.name,
        email: e.user.email,
        mobileNumber: e.user.mobileNumber,
        avatar: e.user.avatar,
        isSubmitted: !!sub,
        submission: sub
          ? {
              id: sub.id,
              fileUrls: sub.fileUrls,
              note: sub.note,
              submittedAt: sub.submittedAt,
            }
          : null,
      }
    })

    // Also include any submissions from students whose enrollment might be special or demo
    for (const sub of submissions) {
      if (!students.some(s => s.studentId === sub.studentId)) {
        students.push({
          studentId: sub.student.id,
          name: sub.student.name,
          email: sub.student.email,
          mobileNumber: sub.student.mobileNumber,
          avatar: sub.student.avatar,
          isSubmitted: true,
          submission: {
            id: sub.id,
            fileUrls: sub.fileUrls,
            note: sub.note,
            submittedAt: sub.submittedAt,
          },
        })
      }
    }

    const totalStudents = students.length
    const submittedCount = submissions.length
    const pendingCount = Math.max(0, totalStudents - submittedCount)

    return NextResponse.json({
      homework: {
        id: homework.id,
        title: homework.title,
        dueAt: homework.dueAt,
        courseName: homework.course.name,
      },
      stats: {
        totalStudents,
        submittedCount,
        pendingCount,
      },
      students,
    })
  } catch (error: any) {
    console.error('Error fetching submissions:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
