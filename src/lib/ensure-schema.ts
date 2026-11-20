// Additive, idempotent schema changes (same SQL as the matching prisma/migrations files).
// Runs once at server start so a deploy that is ahead of the database does not break the Store or website data.
import { prisma } from '@/lib/db'

const STATEMENTS = [
  // 20261117120000_offering_website
  `ALTER TABLE "CourseOffering" ADD COLUMN IF NOT EXISTS "website" JSONB`,
  // 20261118100000_course_type
  `ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "courseType" TEXT`,
  // 20261118120000_site_rows
  `CREATE TABLE IF NOT EXISTS "SiteRow" (
    "tableName" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteRow_pkey" PRIMARY KEY ("tableName", "rowKey")
  )`,
  `CREATE INDEX IF NOT EXISTS "SiteRow_tableName_idx" ON "SiteRow"("tableName")`,
  `CREATE INDEX IF NOT EXISTS "SiteRow_email_idx" ON "SiteRow"("tableName", (lower("data"->>'email')))`,
]

export async function ensureSchema() {
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql)
    } catch (err) {
      console.error('[ensure-schema] failed:', sql.split('\n')[0], (err as Error)?.message || err)
    }
  }
}
