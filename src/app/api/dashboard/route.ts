import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getFullSession } from '@/lib/auth'
import { getTodaySessionSnapshots } from '@/lib/daily-session-sync'

// Compute status dynamically
// Status calculation now handled by getEventStatus in @/lib/date-utils

export async function GET() {
  try {
    const session = await getFullSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // NOTE: processProgressQueue() was removed from here — it was processing up to
    // 100 batch writes on EVERY dashboard load, blocking the response. It now runs
    // via the /api/sync-queue cron job instead (every 10 min via vercel.json).

    const { accessibleCourseIds } = session
    const courseFilter = accessibleCourseIds !== null
      ? { courseId: { in: accessibleCourseIds } }
      : {}
    const courseCountFilter = accessibleCourseIds !== null
      ? { id: { in: accessibleCourseIds } }
      : {}

    const now = new Date()

    const [
      totalCourses,
      totalLectures,
      totalStudents,
      totalMaterials,
      syncedSessions,
      recentViewedLecture,
      announcements,
      examCountdown,
      openTicketsCount,
      activeChatSessionsCount,
      activeAgentsCount
    ] = await Promise.all([
      prisma.course.count({ where: courseCountFilter }),
      prisma.content.count({ 
        where: { 
          topic: accessibleCourseIds !== null ? { courseId: { in: accessibleCourseIds } } : {},
          OR: [
            {
              videoUrl: { not: null },
              NOT: { videoUrl: "" }
            },
            {
              youtubeUrl: { not: null },
              NOT: { youtubeUrl: "" }
            }
          ]
        } 
      }),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.content.count({ 
        where: { 
          topic: accessibleCourseIds !== null ? { courseId: { in: accessibleCourseIds } } : {},
          pptUrl: { not: null },
          NOT: { pptUrl: "" }
        } 
      }),
      getTodaySessionSnapshots(session),
      prisma.lectureProgress.findFirst({
        where: {
          userId: session.userId,
          updatedAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
        },
        include: {
          content: {
            select: {
              id: true,
              title: true,
              videoUrl: true,
              youtubeUrl: true,
              videoSource: true,
              topic: {
                select: {
                  courseId: true,
                  course: {
                    select: { name: true, color: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3
      }),
      (prisma as any).examCountdown.findFirst(),
      prisma.supportTicket.count({
        where: { status: 'OPEN' }
      }),
      prisma.chatSession.count({
        where: { type: 'SUPPORT', status: { in: ['WAITING', 'ACTIVE'] } }
      }),
      prisma.user.count({
        where: {
          role: { in: ['MANAGER', 'ADMIN'] },
          updatedAt: { gt: new Date(Date.now() - 5 * 60 * 1000) }
        }
      })
    ])

    const filteredSessions = syncedSessions

    const upcomingSessionsCount = filteredSessions.filter((session: any) => session.status === 'upcoming').length
    const activeSessionsCount = filteredSessions.filter((session: any) => session.status === 'live').length

    // Calculate daysLeft from deadlineDate for examCountdown
    const examCountdownWithDays = examCountdown && examCountdown.deadlineDate
      ? {
          ...examCountdown,
          daysLeft: Math.max(0, Math.ceil((new Date(examCountdown.deadlineDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        }
      : examCountdown

    return NextResponse.json({
      stats: {
        totalCourses,
        totalLectures,
        totalStudents,
        upcomingSessions: upcomingSessionsCount,
        totalMaterials,
        activeSessions: activeSessionsCount,
      },
      liveSessions: filteredSessions,
      recentViewedLecture,
      announcements,
      upcomingExams: [],
      examCountdown: examCountdownWithDays,
      supportSummary: {
        openTickets: openTicketsCount,
        activeChats: activeChatSessionsCount,
        isSupportActive: activeAgentsCount > 0
      },
      user: {
        role: session.role,
        name: session.name,
        userId: session.userId,
        hasSeenWelcome: session.hasSeenWelcome || false,
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  } catch (error: any) {
    console.error('\n[DASHBOARD API ERROR] Failed to fetch dashboard data. A database schema mismatch is likely.')
    console.error('Raw Error:', error?.message || error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
