import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ensureCourseColumns } from '@/lib/course-schema-sync'

function isAdminOrManager(role: string) {
  return role === 'MANAGER' || role === 'ADMIN'
}

const SUCCESSFUL_ORDER_STATUSES = ['SUCCESS', 'PAID']

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensureCourseColumns()

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const termId = searchParams.get('termId') || 'all'
    const examCycle = searchParams.get('examCycle') || 'all'

    // Load academic terms config for date window lookups
    let termConfig: any = null
    try {
      const configPath = path.join(process.cwd(), 'src', 'data', 'academic-terms-config.json')
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        if (termId !== 'all') {
          termConfig = (parsed.terms || []).find((t: any) => t.id === termId)
        }
      }
    } catch {}

    // Build date filter
    const now = new Date()
    let dateFilter: { gte?: Date; lte?: Date } | undefined

    switch (filter) {
      case 'today': {
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        dateFilter = { gte: start }
        break
      }
      case 'yesterday': {
        const start = new Date(now)
        start.setDate(start.getDate() - 1)
        start.setHours(0, 0, 0, 0)
        const end = new Date(now)
        end.setHours(0, 0, 0, 0)
        dateFilter = { gte: start, lte: end }
        break
      }
      case 'last7days': {
        const start = new Date(now)
        start.setDate(start.getDate() - 7)
        start.setHours(0, 0, 0, 0)
        dateFilter = { gte: start }
        break
      }
      case 'last30days': {
        const start = new Date(now)
        start.setDate(start.getDate() - 30)
        start.setHours(0, 0, 0, 0)
        dateFilter = { gte: start }
        break
      }
      case 'last3months': {
        const start = new Date(now)
        start.setMonth(start.getMonth() - 3)
        start.setHours(0, 0, 0, 0)
        dateFilter = { gte: start }
        break
      }
      default:
        dateFilter = undefined
    }

    const where: Record<string, unknown> = {}
    if (dateFilter) {
      where.createdAt = dateFilter
    }

    const [upgradeTransactions, orders, mentorships, testSeries, notes] = await Promise.all([
      prisma.upgradeTransaction.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, mobileNumber: true } },
          course: {
            select: {
              id: true,
              name: true,
              subject: true,
              academicTerm: true,
              academicYear: true,
              examCycle: true,
            }
          },
        },
      }),
      prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, mobileNumber: true } },
          items: {
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  subject: true,
                  academicTerm: true,
                  academicYear: true,
                  examCycle: true,
                }
              },
              courseOffering: { select: { name: true } }
            }
          }
        },
      }),
      prisma.mentorshipBooking.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, mobileNumber: true } },
          mentorship: { select: { mentorName: true } }
        }
      }),
      prisma.testSeriesAccess.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, mobileNumber: true } },
          testSeries: { select: { title: true } }
        }
      }),
      prisma.storeNoteAccess.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, mobileNumber: true } },
          note: { select: { title: true, price: true } }
        }
      })
    ])

    const transactions = [
      ...upgradeTransactions.map(u => ({
        id: u.id,
        orderId: u.orderId,
        amount: u.amount,
        status: u.status,
        createdAt: u.createdAt,
        type: 'UPGRADE',
        isExternal: false,
        course: u.course,
        courses: [{ ...u.course, accessType: 'LIVE', price: u.amount }],
        user: u.user,
        academicTerm: (u.course as any)?.academicTerm || null,
        academicYear: (u.course as any)?.academicYear || null,
        examCycle: (u.course as any)?.examCycle || null,
      })),
      ...orders.map(o => {
        const courses = o.items.map(item => ({
          id: item.course.id,
          name: item.course.name,
          subject: item.course.subject,
          academicTerm: (item.course as any)?.academicTerm || null,
          academicYear: (item.course as any)?.academicYear || null,
          examCycle: (item.course as any)?.examCycle || null,
          accessType: item.accessType,
          price: item.price,
          offeringName: item.courseOffering?.name ?? null,
        }))
        const firstCourse = courses[0] ?? { id: '', name: 'Unknown', subject: null, accessType: null, price: 0, offeringName: null, academicTerm: null, academicYear: null, examCycle: null }
        return {
          id: o.id,
          orderId: o.razorpayOrderId || o.id,
          amount: o.amount,
          status: o.status === 'PAID' ? 'SUCCESS' : o.status,
          rawStatus: o.status,
          createdAt: o.createdAt,
          type: 'PURCHASE',
          isExternal: o.isExternal,
          course: { id: firstCourse.id, name: firstCourse.name, subject: firstCourse.subject },
          courses,
          bundleName: firstCourse.offeringName ?? undefined,
          accessType: firstCourse.accessType ?? undefined,
          user: o.user,
          academicTerm: firstCourse.academicTerm || null,
          academicYear: firstCourse.academicYear || null,
          examCycle: firstCourse.examCycle || null,
        }
      }),
      ...mentorships.map(m => ({
        id: m.id,
        orderId: m.razorpayOrderId || m.id,
        amount: m.amount,
        status: m.status === 'PAID' ? 'SUCCESS' : m.status,
        createdAt: m.createdAt,
        type: 'MENTORSHIP',
        course: { id: '', name: `Mentorship: ${m.mentorship.mentorName}`, subject: 'Mentorship' },
        courses: [{ id: '', name: `Mentorship: ${m.mentorship.mentorName}`, subject: 'Mentorship', accessType: 'LIVE', price: m.amount }],
        user: m.user,
        academicTerm: null,
        academicYear: null,
        examCycle: null,
      })),
      ...testSeries.map(ts => ({
        id: ts.id,
        orderId: ts.razorpayPaymentId || ts.id,
        amount: ts.amount,
        status: 'SUCCESS',
        createdAt: ts.createdAt,
        type: 'TEST_SERIES',
        course: { id: '', name: `Test Series: ${ts.testSeries.title}`, subject: 'Test Series' },
        courses: [{ id: '', name: `Test Series: ${ts.testSeries.title}`, subject: 'Test Series', accessType: 'RECORDED', price: ts.amount }],
        user: ts.user,
        academicTerm: null,
        academicYear: null,
        examCycle: null,
      })),
      ...notes.map(n => ({
        id: n.id,
        orderId: n.orderId || n.id,
        amount: n.note.price,
        status: 'SUCCESS',
        createdAt: n.createdAt,
        type: 'STUDY_NOTE',
        course: { id: '', name: `Study Note: ${n.note.title}`, subject: 'Study Notes' },
        courses: [{ id: '', name: `Study Note: ${n.note.title}`, subject: 'Study Notes', accessType: 'RECORDED', price: n.note.price }],
        user: n.user,
        academicTerm: null,
        academicYear: null,
        examCycle: null,
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Apply Term & Exam Cycle filters
    let filteredTransactions = transactions

    if (termId !== 'all') {
      filteredTransactions = filteredTransactions.filter(tx => {
        const courses = (tx.courses || [tx.course]).filter(Boolean)
        // 1. Explicit tag match: course.academicTerm-course.academicYear === termId
        const hasTagMatch = courses.some((c: any) => c.academicTerm && c.academicYear && `${c.academicTerm}-${c.academicYear}` === termId)
        if (hasTagMatch) return true

        // 2. Date window fallback if term dates configured
        if (termConfig?.startDate && termConfig?.endDate) {
          const txTime = new Date(tx.createdAt).getTime()
          const sTime = new Date(termConfig.startDate).getTime()
          const eDate = new Date(termConfig.endDate)
          eDate.setHours(23, 59, 59, 999)
          const eTime = eDate.getTime()
          if (txTime >= sTime && txTime <= eTime) return true
        }

        return false
      })
    }

    if (examCycle !== 'all') {
      filteredTransactions = filteredTransactions.filter(tx => {
        const courses = (tx.courses || [tx.course]).filter(Boolean)
        // 1. Explicit exam cycle match on course
        const hasCycleMatch = courses.some((c: any) => c.examCycle === examCycle)
        if (hasCycleMatch) return true

        // 2. Date window fallback if exam cycle dates configured within this term
        if (termConfig?.examCycles?.[examCycle]?.startDate && termConfig?.examCycles?.[examCycle]?.endDate) {
          const txTime = new Date(tx.createdAt).getTime()
          const sTime = new Date(termConfig.examCycles[examCycle].startDate).getTime()
          const eDate = new Date(termConfig.examCycles[examCycle].endDate)
          eDate.setHours(23, 59, 59, 999)
          const eTime = eDate.getTime()
          if (txTime >= sTime && txTime <= eTime) return true
        }

        return false
      })
    }

    // Dynamic summary based on filtered transactions
    const successful = filteredTransactions.filter(t => t.status === 'SUCCESS' || t.status === 'PAID')
    const totalRevenue = successful.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    const totalSuccessful = successful.length
    const totalRecords = filteredTransactions.length

    return NextResponse.json({
      transactions: filteredTransactions,
      summary: {
        totalRevenue,
        totalSuccessful,
        totalRecords,
      },
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
