import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { ImportError } from './google'
export const LEASE = 'class-material-import'
export async function acquireLease(runId: string) {
  const count = await prisma.$executeRaw`INSERT INTO "AutomationLease" (name,"ownerRunId","expiresAt","heartbeatAt") VALUES (${LEASE},${runId},NOW() + INTERVAL '5 minutes',NOW()) ON CONFLICT (name) DO UPDATE SET "ownerRunId"=EXCLUDED."ownerRunId", "expiresAt"=EXCLUDED."expiresAt", "heartbeatAt"=NOW() WHERE "AutomationLease"."expiresAt" < NOW()`
  return count === 1
}
export async function heartbeat(runId: string) {
  const count = await prisma.$executeRaw`UPDATE "AutomationLease" SET "expiresAt"=NOW()+INTERVAL '5 minutes', "heartbeatAt"=NOW() WHERE name=${LEASE} AND "ownerRunId"=${runId} AND "expiresAt">NOW()`
  if (count !== 1) throw new ImportError('LEASE_LOST', 'Worker lease lost.')
}
export async function assertLease(tx: Prisma.TransactionClient, runId: string) {
  const rows = await tx.$queryRaw<Array<{ name: string }>>`SELECT name FROM "AutomationLease" WHERE name=${LEASE} AND "ownerRunId"=${runId} AND "expiresAt">NOW() FOR UPDATE`
  if (!rows.length) throw new ImportError('LEASE_LOST', 'Worker lease lost.')
}
export async function releaseLease(runId: string) {
  await prisma.automationLease.updateMany({ where: { name: LEASE, ownerRunId: runId }, data: { expiresAt: new Date(0) } })
}
