import { prisma } from '@/lib/db'
import { RING_SECONDS } from '@/lib/support-limits'

// type CALL = student → support (rings every manager); CALL_OUT = manager → one student;
// SCHEDULED = student asks for a call later. callerId is always the student.
// Media is a mesh: every participant connects to every other one; SDP goes through SupportCallSignal.
export const RING_TIMEOUT_MS = RING_SECONDS * 1000
export const callInclude = {
  caller: { select: { id: true, name: true, avatar: true } },
  manager: { select: { id: true, name: true } },
} as const

const participantSelect = {
  select: { userId: true, joinedAt: true, leftAt: true, video: true, user: { select: { id: true, name: true, role: true } } },
  orderBy: { joinedAt: 'asc' as const },
}

// List views skip SDP; participants show who joined (and so who picked up).
export const callListSelect = {
  id: true, type: true, status: true, note: true, scheduledFor: true, answeredAt: true, endedAt: true,
  createdAt: true, updatedAt: true, ...callInclude, participants: participantSelect,
} as const

/** Calls nobody picked up within the ring window become MISSED (missed student calls show up for managers to call back). */
export function expireRingingCalls() {
  return prisma.supportCall.updateMany({
    where: { status: 'RINGING', createdAt: { lt: new Date(Date.now() - RING_TIMEOUT_MS) } },
    data: { status: 'MISSED' },
  })
}

export const validSdp = (s: unknown): s is string => typeof s === 'string' && s.startsWith('v=0') && s.length <= 30000

/** (Re)join a call. joinedAt decides who sends the offer: the later joiner offers to everyone already in. */
export function joinCall(callId: string, userId: string) {
  return prisma.supportCallParticipant.upsert({
    where: { callId_userId: { callId, userId } },
    create: { callId, userId },
    update: { joinedAt: new Date(), leftAt: null, video: 'off' },
  })
}

/**
 * Hang up. The call ends for everyone when the student leaves or fewer than two people remain;
 * otherwise the rest stay connected (e.g. one manager drops, another stays with the student).
 */
export async function leaveCall(call: { id: string; callerId: string }, userId: string) {
  const now = new Date()
  await prisma.supportCallParticipant.updateMany({ where: { callId: call.id, userId, leftAt: null }, data: { leftAt: now } })
  const remaining = await prisma.supportCallParticipant.count({ where: { callId: call.id, leftAt: null } })
  if (userId === call.callerId || remaining < 2) {
    await prisma.$transaction([
      prisma.supportCallParticipant.updateMany({ where: { callId: call.id, leftAt: null }, data: { leftAt: now } }),
      prisma.supportCall.update({ where: { id: call.id }, data: { status: 'ENDED', endedAt: now } }),
      prisma.supportCallSignal.deleteMany({ where: { callId: call.id } }),
    ])
  }
}
