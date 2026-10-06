import { Prisma } from '@prisma/client'
import { prisma } from './db'

export async function createContentInTransaction(tx: Prisma.TransactionClient, data: Omit<Prisma.ContentUncheckedCreateInput, 'order'>) {
  const topics = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Topic" WHERE id = ${data.topicId} FOR UPDATE`
  if (!topics.length) throw new Error('Destination topic no longer exists')
  const max = await tx.content.aggregate({ where: { topicId: data.topicId }, _max: { order: true } })
  return tx.content.create({ data: { ...data, order: (max._max.order ?? -1) + 1 } })
}
export function createContent(data: Omit<Prisma.ContentUncheckedCreateInput, 'order'>) {
  return prisma.$transaction(tx => createContentInTransaction(tx, data))
}
