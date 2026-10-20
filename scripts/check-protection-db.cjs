// READ-ONLY. Reports database identity and whether the six Exam Protection tables exist.
// Usage: node scripts/check-protection-db.cjs   (uses DATABASE_URL from env/.env)
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const TABLES = ['ProtectionSettings','ProtectionCourse','ProtectionPurchase','ProtectionClaim','ProtectionProof','ProtectionClaimEvent'];
(async () => {
  const p = new PrismaClient();
  try {
    const [id] = await p.$queryRawUnsafe(`select current_database() db, inet_server_addr()::text host, (select count(*)::int from "Class") classes, (select count(*)::int from "User") users`);
    console.log('database:', id);
    const rows = await p.$queryRawUnsafe(`select table_name from information_schema.tables where table_schema='public' and table_name = any($1)`, TABLES);
    const have = new Set(rows.map(r => r.table_name));
    for (const t of TABLES) console.log(have.has(t) ? 'present ' : 'MISSING ', t);
    try {
      const m = await p.$queryRawUnsafe(`select migration_name, finished_at from _prisma_migrations where migration_name like '%exam_protection%'`);
      console.log('_prisma_migrations entry:', m.length ? m : 'none');
    } catch { console.log('_prisma_migrations: table not present'); }
  } catch (e) { console.error('check failed:', e.code || '', String(e.message).split('\n').pop()); process.exitCode = 1; }
  finally { await p.$disconnect(); }
})();
