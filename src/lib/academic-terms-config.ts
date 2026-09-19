/**
 * Academic terms config — persisted in Postgres so deletes/edits survive deploys.
 * The JSON file is only used as a one-time seed when the DB row does not exist yet.
 */

import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/db'

const CONFIG_ID = 'singleton'
const FILE_SEED_PATH = path.join(process.cwd(), 'src', 'data', 'academic-terms-config.json')

let ensured = false

async function ensureTable() {
  if (ensured) return
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AcademicTermsConfig" (
        "id" TEXT PRIMARY KEY DEFAULT 'singleton',
        "terms" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    ensured = true
  } catch (e) {
    console.error('[academic-terms-config] Failed to ensure table:', e)
  }
}

function readFileSeed(): any[] {
  try {
    if (fs.existsSync(FILE_SEED_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(FILE_SEED_PATH, 'utf-8'))
      if (Array.isArray(parsed.terms)) return parsed.terms
    }
  } catch (e) {
    console.error('[academic-terms-config] Failed to read seed file:', e)
  }
  return []
}

export async function getAcademicTerms(): Promise<any[]> {
  await ensureTable()

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ terms: any }>>(
      `SELECT "terms" FROM "AcademicTermsConfig" WHERE "id" = $1 LIMIT 1`,
      CONFIG_ID,
    )

    if (rows.length > 0) {
      const terms = rows[0].terms
      return Array.isArray(terms) ? terms : []
    }

    // First run: seed once from the committed JSON file, then DB is source of truth
    const seed = readFileSeed()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AcademicTermsConfig" ("id", "terms", "updatedAt")
       VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING`,
      CONFIG_ID,
      JSON.stringify(seed),
    )

    const after = await prisma.$queryRawUnsafe<Array<{ terms: any }>>(
      `SELECT "terms" FROM "AcademicTermsConfig" WHERE "id" = $1 LIMIT 1`,
      CONFIG_ID,
    )
    const terms = after[0]?.terms
    return Array.isArray(terms) ? terms : seed
  } catch (e) {
    console.error('[academic-terms-config] getAcademicTerms failed, falling back to file:', e)
    return readFileSeed()
  }
}

export async function saveAcademicTerms(terms: any[]): Promise<any[]> {
  await ensureTable()
  const sorted = [...terms].sort((a, b) => {
    if (a.year !== b.year) return Number(a.year) - Number(b.year)
    const order = ['JAN', 'MAY', 'SEP']
    return order.indexOf(a.termKey) - order.indexOf(b.termKey)
  })

  await prisma.$executeRawUnsafe(
    `INSERT INTO "AcademicTermsConfig" ("id", "terms", "updatedAt")
     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE SET
       "terms" = EXCLUDED."terms",
       "updatedAt" = CURRENT_TIMESTAMP`,
    CONFIG_ID,
    JSON.stringify(sorted),
  )

  return sorted
}
