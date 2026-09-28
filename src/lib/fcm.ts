import { prisma } from '@/lib/db'
import { firebaseAdmin } from '@/lib/firebase-admin'

interface FcmPayload {
  title: string
  body: string
  icon?: string
  url?: string   // deep-link path inside the app
  tag?: string   // collapse key for duplicate notifications
  imageUrl?: string
  ctaText?: string
  ctaLink?: string
  importance?: 'high' | 'default'
  sound?: 'default' | 'none' | string
  channelId?: string
}

type FcmTokenRecord = {
  id: string
  token: string
}

export function isStaleFcmTokenError(err: any) {
  const code = err?.code || err?.errorInfo?.code
  const message = err?.message || err?.errorInfo?.message || ''

  return (
    code === 'messaging/invalid-registration-token' ||
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/mismatched-credential' ||
    /SenderId mismatch/i.test(message)
  )
}

async function deleteStaleFcmTokens(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids))
  if (uniqueIds.length === 0) return

  await prisma.fcmDeviceToken.deleteMany({ where: { id: { in: uniqueIds } } })
  console.log(`[FCM] Cleaned up ${uniqueIds.length} stale device token(s).`)
}

function staleIdsFromTopicResponse(response: any, tokens: FcmTokenRecord[]) {
  return response.errors
    .filter((failure: any) => isStaleFcmTokenError(failure.error))
    .map((failure: any) => tokens[failure.index]?.id)
    .filter(Boolean)
}

function logTopicSubscriptionFailures(label: string, response: any) {
  if (response.failureCount === 0) return

  const realFailures = response.errors.filter((failure: any) => !isStaleFcmTokenError(failure.error))
  if (realFailures.length > 0) {
    console.warn(`[FCM-Topics] ${label}:`, JSON.stringify(realFailures))
  } else {
    console.log(`[FCM-Topics] ${label}: ${response.failureCount} stale token(s) queued for cleanup`)
  }
}

async function removeStaleTopicTokens(tokens: FcmTokenRecord[], staleIds: string[]) {
  const uniqueIds = Array.from(new Set(staleIds))
  if (uniqueIds.length === 0) return tokens

  await deleteStaleFcmTokens(uniqueIds)
  const staleIdSet = new Set(uniqueIds)
  return tokens.filter((token) => !staleIdSet.has(token.id))
}

/**
 * Sends an FCM push notification to a list of user IDs.
 * Silently removes expired/invalid tokens from DB.
 */
export async function sendFcmToUsers(userIds: string[], payload: FcmPayload) {
  if (!firebaseAdmin) {
    console.warn('Firebase Admin not initialised — skipping FCM notifications')
    return
  }

  const tokens = await prisma.fcmDeviceToken.findMany({
    where: { userId: { in: userIds } },
  })

  if (tokens.length === 0) return

  const isSilent = payload.importance === 'default'
  const isMuted  = payload.sound === 'none'
  const hasCustomSound = payload.sound && payload.sound !== 'default' && payload.sound !== 'none'
  const channelId = payload.channelId || (isSilent ? 'silent_updates' : 'class_updates')

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
      ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
    },
    data: {
      url: payload.url || payload.ctaLink || '/announcements',
      tag: payload.tag || 'general',
      ctaText: payload.ctaText || '',
      ctaLink: payload.ctaLink || '',
      imageUrl: payload.imageUrl || '',
    },
    android: {
      priority: (isSilent ? 'normal' : 'high') as 'normal' | 'high',
      notification: {
        icon: 'ic_launcherh',
        color: '#4F46E5',
        channelId,
        defaultSound: !isMuted && !hasCustomSound,
        sound: hasCustomSound ? payload.sound : (isMuted ? '' : 'default'),
        defaultVibrateTimings: !isSilent,
        notificationPriority: (isSilent ? 'PRIORITY_DEFAULT' : 'PRIORITY_MAX') as 'PRIORITY_DEFAULT' | 'PRIORITY_MAX',
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
      },
    },
    apns: {
      payload: {
        aps: {
          sound: hasCustomSound ? `${payload.sound}.mp3` : (isMuted ? '' : 'default'),
        },
      },
    },
  }

  const staleIds: string[] = []

  await Promise.allSettled(
    tokens.map(async (t) => {
      try {
        await firebaseAdmin.messaging().send({
          ...message,
          token: t.token,
        })
      } catch (err: any) {
        // Token is invalid/expired — mark for cleanup
        if (isStaleFcmTokenError(err)) {
          staleIds.push(t.id)
        } else {
          console.error('FCM send error:', err.message || err.code)
        }
      }
    })
  )

  // Clean up dead tokens
  await deleteStaleFcmTokens(staleIds)
}

/**
/**
 * Sends an FCM notification to ALL students (global announcement) using Topics.
 */
export async function sendFcmToAllStudents(payload: FcmPayload) {
  await sendFcmToTopic('student_announcements', payload)
}

/**
 * Sends an FCM push notification to a specific topic.
 */
export async function sendFcmToTopic(topic: string, payload: FcmPayload) {
  if (!firebaseAdmin) {
    console.warn('Firebase Admin not initialised — skipping FCM topic notification')
    return
  }

  const isSilent = payload.importance === 'default'
  const isMuted  = payload.sound === 'none'
  const hasCustomSound = payload.sound && payload.sound !== 'default' && payload.sound !== 'none'
  const channelId = payload.channelId || (isSilent ? 'silent_updates' : 'class_updates')

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
      ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
    },
    data: {
      url: payload.url || payload.ctaLink || '/announcements',
      tag: payload.tag || 'general',
      ctaText: payload.ctaText || '',
      ctaLink: payload.ctaLink || '',
      imageUrl: payload.imageUrl || '',
    },
    android: {
      priority: (isSilent ? 'normal' : 'high') as 'normal' | 'high',
      notification: {
        icon: 'ic_launcherh',
        color: '#4F46E5',
        channelId,
        defaultSound: !isMuted && !hasCustomSound,
        sound: hasCustomSound ? payload.sound : (isMuted ? '' : 'default'),
        defaultVibrateTimings: !isSilent,
        notificationPriority: (isSilent ? 'PRIORITY_DEFAULT' : 'PRIORITY_MAX') as 'PRIORITY_DEFAULT' | 'PRIORITY_MAX',
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
      },
    },
    apns: {
      payload: {
        aps: {
          sound: hasCustomSound ? `${payload.sound}.mp3` : (isMuted ? '' : 'default'),
        },
      },
    },
    topic: topic,
  }

  try {
    const res = await firebaseAdmin.messaging().send(message)
    console.log(`[FCM-Topics] Successfully sent message to topic ${topic}. Message ID:`, res)
  } catch (err: any) {
    console.error(`[FCM-Topics] Failed to send message to topic ${topic}:`, err.message || err)
  }
}

/**
 * Subscribes a user's registered FCM tokens to all their enrolled course topics,
 * plus a global student announcement topic if they are a student.
 */
export async function syncUserTopicSubscriptions(userId: string) {
  if (!firebaseAdmin) return

  try {
    const [user, enrollments, tokens] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
      prisma.enrollment.findMany({
        where: { userId },
        select: { courseId: true },
      }),
      prisma.fcmDeviceToken.findMany({
        where: { userId },
        select: { id: true, token: true },
      }),
    ])

    if (!user || tokens.length === 0) return

    let tokenRecords = tokens
    
    // 1. Subscribe to each enrolled course topic
    for (const enrollment of enrollments) {
      if (tokenRecords.length === 0) break

      const topicName = `course_${enrollment.courseId}`
      const deviceTokens = tokenRecords.map((t) => t.token)
      const response = await firebaseAdmin.messaging().subscribeToTopic(deviceTokens, topicName)
      console.log(`[FCM-Topics] Subscribed user ${userId} tokens to topic: ${topicName}. Success count: ${response.successCount}, Failure count: ${response.failureCount}`)

      logTopicSubscriptionFailures(`Subscription failures for ${topicName}`, response)
      tokenRecords = await removeStaleTopicTokens(tokenRecords, staleIdsFromTopicResponse(response, tokenRecords))
    }

    // 2. Subscribe to global announcements topic if user is a student
    if (user.role === 'STUDENT' && tokenRecords.length > 0) {
      const globalTopic = 'student_announcements'
      const deviceTokens = tokenRecords.map((t) => t.token)
      const response = await firebaseAdmin.messaging().subscribeToTopic(deviceTokens, globalTopic)
      console.log(`[FCM-Topics] Subscribed student ${userId} tokens to topic: ${globalTopic}. Success count: ${response.successCount}, Failure count: ${response.failureCount}`)

      logTopicSubscriptionFailures('Global subscription failures', response)
      await removeStaleTopicTokens(tokenRecords, staleIdsFromTopicResponse(response, tokenRecords))
    }
  } catch (err) {
    console.error('[FCM-Topics] Error syncing user topic subscriptions:', err)
  }
}

/**
 * One-time background sync for all existing device tokens in the database.
 */
export async function syncAllExistingTopics() {
  if (!firebaseAdmin) {
    console.warn('Firebase Admin not initialised — skipping FCM topic migration')
    return
  }

  try {
    console.log('[FCM-Topics] Starting migration of all existing active tokens to topics...')
    const tokens = await prisma.fcmDeviceToken.findMany({
      select: { id: true, userId: true, token: true }
    })

    if (tokens.length === 0) {
      console.log('[FCM-Topics] No tokens in database to migrate.')
      return
    }

    // Group tokens by userId
    const userTokensMap: Record<string, FcmTokenRecord[]> = {}
    for (const t of tokens) {
      if (!userTokensMap[t.userId]) {
        userTokensMap[t.userId] = []
      }
      userTokensMap[t.userId].push(t)
    }

    const userIds = Object.keys(userTokensMap)
    console.log(`[FCM-Topics] Found ${userIds.length} users with tokens. Syncing...`)

    for (const userId of userIds) {
      let userTokens = userTokensMap[userId]

      const [user, enrollments] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { role: true }
        }),
        prisma.enrollment.findMany({
          where: { userId },
          select: { courseId: true }
        })
      ])

      if (!user) continue

      // 1. Subscribe to each enrolled course topic
      for (const enrollment of enrollments) {
        if (userTokens.length === 0) break

        const deviceTokens = userTokens.map((t) => t.token)
        const response = await firebaseAdmin.messaging().subscribeToTopic(deviceTokens, `course_${enrollment.courseId}`)
        userTokens = await removeStaleTopicTokens(userTokens, staleIdsFromTopicResponse(response, userTokens))
      }

      // 2. Subscribe to student announcements if role is STUDENT
      if (user.role === 'STUDENT' && userTokens.length > 0) {
        const deviceTokens = userTokens.map((t) => t.token)
        const response = await firebaseAdmin.messaging().subscribeToTopic(deviceTokens, 'student_announcements')
        await removeStaleTopicTokens(userTokens, staleIdsFromTopicResponse(response, userTokens))
      }
    }
    console.log('[FCM-Topics] Migration completed successfully!')
  } catch (err) {
    console.error('[FCM-Topics] Error during syncAllExistingTopics migration:', err)
  }
}
