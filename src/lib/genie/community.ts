// GenZie in course community chats: answers student questions it knows confidently,
// and collects staff answers as PENDING Q&A for managers to approve.
import { prisma } from '@/lib/db'
import { sseEmitter } from '@/lib/sse'
import { sendReplyNotification } from '@/lib/community-notifications'
import { getLiveTree } from './store'
import { bestMatch, looksLikeQuestion, treeDocs, type KnowledgeDoc } from './match'

const db: any = prisma

export const GENZIE_BOT_EMAIL = 'genzie@bot.internal'
export const GENZIE_BOT_ROLE = 'BOT'
/** Staff replies shorter than this ("ok", "dm me") are not worth learning. */
const MIN_ANSWER_CHARS = 20

export async function loadKnowledge(): Promise<KnowledgeDoc[]> {
  const { tree } = await getLiveTree()
  let learned: { id: string; question: string; answer: string }[] = []
  try {
    learned = await db.genieLearnedQA.findMany({ where: { status: 'APPROVED' }, select: { id: true, question: true, answer: true } })
  } catch (e) {
    console.error('genzie: learned Q&A table not ready', (e as Error)?.message)
  }
  return [
    ...learned.map(r => ({ key: `learned:${r.id}`, text: r.question, answer: r.answer, source: 'learned' as const })),
    ...treeDocs(tree),
  ]
}

let botId: string | null = null
/** GenZie's sender identity. Terminated so it can never log in or show as an active user. */
export async function getBotUserId(): Promise<string> {
  if (botId) return botId
  const bot = await prisma.user.upsert({
    where: { email: GENZIE_BOT_EMAIL },
    update: {},
    create: { email: GENZIE_BOT_EMAIL, name: 'GenZie', role: GENZIE_BOT_ROLE, isTerminated: true },
    select: { id: true },
  })
  botId = bot.id
  return bot.id
}

const messageInclude = {
  sender: { select: { id: true, name: true, role: true, securityNumber: true, avatar: true, gender: true } },
  replyTo: { include: { sender: { select: { id: true, name: true, role: true, avatar: true, gender: true } } } },
}

/** Called after a student posts a top-level message in a course community chat. */
export async function genzieAutoReply(opts: {
  courseId: string; courseName: string; messageId: string; content: string; studentId: string
}) {
  if (!looksLikeQuestion(opts.content)) return
  const match = bestMatch(opts.content, await loadKnowledge())
  if (!match) return

  const bot = await getBotUserId()
  // At most one auto-reply per question.
  if (await prisma.communityMessage.findFirst({ where: { replyToId: opts.messageId, senderId: bot }, select: { id: true } })) return

  const reply = await prisma.communityMessage.create({
    data: { courseId: opts.courseId, senderId: bot, content: match.doc.answer, replyToId: opts.messageId },
    include: messageInclude,
  })
  console.log(`genzie: auto-replied ${reply.id} via ${match.doc.key} score=${match.score.toFixed(2)} words=${match.shared.join(',')}`)
  sseEmitter.emit(`chat:${opts.courseId}:message`, { ...reply, sender: { ...reply.sender, securityNumber: undefined } })
  sendReplyNotification({
    courseId: opts.courseId,
    courseName: opts.courseName,
    senderName: 'GenZie',
    senderId: bot,
    recipientId: opts.studentId,
    messageContent: match.doc.answer,
    messageId: reply.id,
  }).catch(console.error)
}

/** Called after a staff member replies to a student's message: queue the pair for manager review. */
export async function collectCandidate(opts: {
  courseId: string; question: { id: string; content: string; senderId: string }; answer: { id: string; content: string; senderId: string }
}) {
  if (!looksLikeQuestion(opts.question.content) || opts.answer.content.trim().length < MIN_ANSWER_CHARS) return
  const bot = await getBotUserId()
  const genzieAnswered = await prisma.communityMessage.findFirst({
    where: { replyToId: opts.question.id, senderId: bot }, select: { id: true },
  })
  try {
    await db.genieLearnedQA.create({
      data: {
        question: opts.question.content,
        answer: opts.answer.content,
        source: genzieAnswered ? 'STAFF_REPLY' : 'UNANSWERED',
        courseId: opts.courseId,
        questionMessageId: opts.question.id,
        answerMessageId: opts.answer.id,
        askedById: opts.question.senderId,
        answeredById: opts.answer.senderId,
      },
    })
  } catch (e: any) {
    if (e?.code !== 'P2002') throw e // same staff message already queued
  }
}
