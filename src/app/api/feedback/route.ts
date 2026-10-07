import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, getAccessibleCourseIds } from '@/lib/auth'
import { checkRateLimit } from '@/lib/ratelimit'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')
    const studentId = searchParams.get('studentId')

    const where: any = {}
    
    if (session.role === 'STUDENT') {
      where.studentId = session.userId
    } else if (session.role === 'MANAGER') {
      if (courseId && courseId !== 'APP' && courseId !== 'WEBSITE') {
        where.courseId = courseId
      }
      if (studentId) {
        where.studentId = studentId
      }
    } else if ((session.role === 'ADMIN' || session.role === 'MODERATOR') || session.role === 'INSTRUCTOR') {
      const accessibleCourseIds = await getAccessibleCourseIds(session.userId, session.role) || []
      if (courseId) {
        if (courseId === 'APP' || courseId === 'WEBSITE') {
          return NextResponse.json({ error: 'Unauthorized to view platform feedback' }, { status: 403 })
        }
        if (!accessibleCourseIds.includes(courseId)) {
          return NextResponse.json({ error: 'Unauthorized to view feedback for this course' }, { status: 403 })
        }
        where.courseId = courseId
      } else {
        where.courseId = { in: accessibleCourseIds }
      }
      if (studentId) {
        where.studentId = studentId
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only load course feedback if courseId is NOT filtering for APP or WEBSITE specifically
    let courseFeedbacks: any[] = []
    if (!courseId || (courseId !== 'APP' && courseId !== 'WEBSITE')) {
      const selectStudent = (session.role === 'MANAGER' || session.role === 'STUDENT')
        ? { id: true, name: true, email: true, securityNumber: true }
        : { securityNumber: true }

      courseFeedbacks = await prisma.feedback.findMany({
        where,
        include: {
          student: { select: selectStudent },
          course: { select: { id: true, name: true } },
        },
      })
    }

    // Load App/Website feedback for manager, or for the student themselves
    let appFeedbacks: any[] = []
    if (session.role === 'MANAGER') {
      const appWhere: any = {}
      if (studentId) appWhere.studentId = studentId
      if (courseId === 'APP') appWhere.platform = 'APP'
      if (courseId === 'WEBSITE') appWhere.platform = 'WEB'
      
      if (!courseId || courseId === 'APP' || courseId === 'WEBSITE') {
        appFeedbacks = await (prisma as any).appFeedback.findMany({
          where: appWhere,
          include: {
            student: { select: { id: true, name: true, email: true, securityNumber: true } },
          },
        })
      }
    } else if (session.role === 'STUDENT') {
      appFeedbacks = await (prisma as any).appFeedback.findMany({
        where: { studentId: session.userId },
        include: {
          student: { select: { id: true, name: true, email: true, securityNumber: true } },
        },
      })
    }

    const isManagerOrStudent = session.role === 'MANAGER' || session.role === 'STUDENT'
    const formattedCourse = courseFeedbacks.map(f => ({
      id: f.id,
      type: 'COURSE',
      courseId: f.courseId,
      studentId: isManagerOrStudent ? f.studentId : undefined,
      student: isManagerOrStudent ? f.student : { securityNumber: f.student.securityNumber },
      course: f.course,
      teacherRating: f.teacherRating,
      conceptRating: f.conceptRating,
      materialRating: f.materialRating,
      recommendScore: f.recommendScore,
      comment: f.comment,
      createdAt: f.createdAt,
    }))

    const formattedApp = appFeedbacks.map(f => ({
      id: f.id,
      type: f.platform === 'APP' ? 'APP' : 'WEBSITE',
      studentId: f.studentId,
      student: f.student,
      course: { id: f.platform, name: f.platform === 'APP' ? 'App Feedback' : 'Website Feedback' },
      teacherRating: f.rating,
      conceptRating: f.rating,
      materialRating: f.rating,
      recommendScore: f.rating,
      comment: f.comment,
      createdAt: f.createdAt,
    }))

    const allFeedbacks = [...formattedCourse, ...formattedApp].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json(allFeedbacks)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate Limiting
    const ip = request.ip ?? '127.0.0.1'
    const { success } = await checkRateLimit(`${session.userId}_${ip}`, 'feedback')
    if (!success) {
      return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 })
    }

    const {
      courseId,
      teacherRating,
      conceptRating,
      materialRating,
      recommendScore,
      comment,
    } = await request.json()

    if (!courseId || !teacherRating || !conceptRating || !materialRating || !recommendScore) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (comment && comment.length > 500) {
      return NextResponse.json({ error: 'Comment too long' }, { status: 400 })
    }

    // Check if feedback already exists for this course by this student
    const existingFeedback = await prisma.feedback.findUnique({
      where: {
        studentId_courseId: {
          studentId: session.userId,
          courseId,
        },
      },
    })

    if (existingFeedback) {
      return NextResponse.json({ error: 'Feedback already submitted for this course' }, { status: 400 })
    }

    const feedback = await prisma.feedback.create({
      data: {
        studentId: session.userId,
        courseId,
        teacherRating,
        conceptRating,
        materialRating,
        recommendScore,
        comment,
      },
    })

    return NextResponse.json(feedback, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      id,
      teacherRating,
      conceptRating,
      materialRating,
      recommendScore,
      comment,
    } = await request.json()

    if (!id || !teacherRating || !conceptRating || !materialRating || !recommendScore) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (comment && comment.length > 500) {
      return NextResponse.json({ error: 'Comment too long' }, { status: 400 })
    }

    // Make sure this feedback belongs to the logged-in student
    const existingFeedback = await prisma.feedback.findUnique({
      where: { id }
    })

    if (!existingFeedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    if (existingFeedback.studentId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.feedback.update({
      where: { id },
      data: {
        teacherRating,
        conceptRating,
        materialRating,
        recommendScore,
        comment,
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
