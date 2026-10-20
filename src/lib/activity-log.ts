import { prisma } from '@/lib/db'

export const MODULE = {
  AUTH: 'Authentication',
  USER_MGMT: 'User Management',
  COURSES: 'Courses',
  TOPICS: 'Topics',
  CONTENT: 'Content',
  LECTURES: 'Lectures',
  MATERIALS: 'Materials',
  LIVE_SESSIONS: 'Live Sessions',
  CALENDAR: 'Calendar',
  ANNOUNCEMENTS: 'Announcements',
  UPDATES: 'Updates',
  COMMUNITY: 'Community',
  SUPPORT: 'Support',
  EXAMS: 'Exams',
  PROFILE: 'Profile',
  FAQ: 'FAQ',
  ENROLLMENT: 'Enrollment',
  STORE: 'Store',
} as const

export const ACTION = {
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_CLICK: 'USER_CLICK',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  AVATAR_UPLOADED: 'AVATAR_UPLOADED',
  COURSE_CREATED: 'COURSE_CREATED',
  COURSE_UPDATED: 'COURSE_UPDATED',
  COURSE_DELETED: 'COURSE_DELETED',
  TOPIC_CREATED: 'TOPIC_CREATED',
  TOPIC_UPDATED: 'TOPIC_UPDATED',
  TOPIC_DELETED: 'TOPIC_DELETED',
  CONTENT_CREATED: 'CONTENT_CREATED',
  CONTENT_UPDATED: 'CONTENT_UPDATED',
  CONTENT_DELETED: 'CONTENT_DELETED',
  LECTURE_CREATED: 'LECTURE_CREATED',
  LECTURE_UPDATED: 'LECTURE_UPDATED',
  LECTURE_DELETED: 'LECTURE_DELETED',
  MATERIAL_CREATED: 'MATERIAL_CREATED',
  MATERIAL_UPDATED: 'MATERIAL_UPDATED',
  MATERIAL_DELETED: 'MATERIAL_DELETED',
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_UPDATED: 'SESSION_UPDATED',
  SESSION_DELETED: 'SESSION_DELETED',
  EVENT_CREATED: 'EVENT_CREATED',
  EVENT_UPDATED: 'EVENT_UPDATED',
  EVENT_DELETED: 'EVENT_DELETED',
  ANNOUNCEMENT_CREATED: 'ANNOUNCEMENT_CREATED',
  ANNOUNCEMENT_UPDATED: 'ANNOUNCEMENT_UPDATED',
  ANNOUNCEMENT_DELETED: 'ANNOUNCEMENT_DELETED',
  UPDATE_CREATED: 'UPDATE_CREATED',
  UPDATE_UPDATED: 'UPDATE_UPDATED',
  UPDATE_DELETED: 'UPDATE_DELETED',
  UPDATE_VIEWED: 'UPDATE_VIEWED',
  MESSAGE_SENT: 'MESSAGE_SENT',
  MESSAGE_DELETED: 'MESSAGE_DELETED',
  MESSAGE_EDITED: 'MESSAGE_EDITED',
  TRANSCRIPT_EXPORTED: 'TRANSCRIPT_EXPORTED',
  TICKET_CREATED: 'TICKET_CREATED',
  TICKET_UPDATED: 'TICKET_UPDATED',
  TICKET_DELETED: 'TICKET_DELETED',
  TICKET_REPLY_SENT: 'TICKET_REPLY_SENT',
  CHAT_STARTED: 'CHAT_STARTED',
  CHAT_JOINED: 'CHAT_JOINED',
  CHAT_CLOSED: 'CHAT_CLOSED',
  CHAT_HISTORY_DELETED: 'CHAT_HISTORY_DELETED',
  FAQ_CREATED: 'FAQ_CREATED',
  FAQ_UPDATED: 'FAQ_UPDATED',
  FAQ_DELETED: 'FAQ_DELETED',
  EXAM_CREATED: 'EXAM_CREATED',
  EXAM_UPDATED: 'EXAM_UPDATED',
  EXAM_DELETED: 'EXAM_DELETED',
  EXAM_SUBMITTED: 'EXAM_SUBMITTED',
  POLL_CREATED: 'POLL_CREATED',
  POLL_VOTED: 'POLL_VOTED',
  POLL_DELETED: 'POLL_DELETED',
  EXTERNAL_ENROLLMENT: 'EXTERNAL_ENROLLMENT',
  FREE_ENROLLMENT: 'FREE_ENROLLMENT',
  FREE_UNENROLLMENT: 'FREE_UNENROLLMENT',
  ENROLLED: 'FREE_ENROLLMENT',
  UNENROLLED: 'FREE_UNENROLLMENT',
  PURCHASE_COMPLETED: 'PURCHASE_COMPLETED',
  POLICY_ACCEPTED: 'POLICY_ACCEPTED',
  ACCOUNT_DELETION_REQUESTED: 'ACCOUNT_DELETION_REQUESTED',
  ACCOUNT_DELETION_CANCELLED: 'ACCOUNT_DELETION_CANCELLED',
} as const

interface LogActivityParams {
  userId: string
  userName: string
  userRole: string
  securityNumber?: string | null
  actionType: string
  actionDescription: string
  moduleName: string
  targetId?: string | null
  metadata?: Record<string, unknown> | null
  priority?: number
  isFailure?: boolean
}

export function logActivity(params: LogActivityParams): void {
  if (params.userRole === 'MANAGER') return
  if (params.actionDescription?.toLowerCase().includes('direct')) return

  prisma.activityLog
    .create({
      data: {
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        securityNumber: params.securityNumber || null,
        actionType: params.actionType,
        actionDescription: params.actionDescription,
        moduleName: params.moduleName,
        targetId: params.targetId || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        priority: params.priority ?? 0,
        isFailure: params.isFailure ?? false,
      },
    })
    .catch((error) => {
      console.error('Failed to log activity:', error)
    })
}
