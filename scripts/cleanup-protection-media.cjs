// Run hourly with the server's DATABASE_URL. Only proof media rows are removed.
require('@next/env').loadEnvConfig(process.cwd())
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
async function main() {
  const result = await db.protectionProof.deleteMany({ where: { expiresAt: { lte: new Date() } } })
  console.log(JSON.stringify({ deletedProofMedia: result.count, deletedClaims: 0, deletedPurchases: 0 }))
}
main().catch(error => { console.error('Protection proof cleanup failed:', error.code || error.name); process.exitCode = 1 }).finally(() => db.$disconnect())
