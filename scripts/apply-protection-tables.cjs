// ADDITIVE ONLY. Creates the six Exam Protection tables/indexes/FKs if absent, in one transaction.
// Never drops, alters or touches any existing table. Safe to re-run.
// Usage: node scripts/apply-protection-tables.cjs            (dry run: prints what is missing)
//        node scripts/apply-protection-tables.cjs --apply    (creates missing objects)
require('dotenv').config();
const fs = require('fs'), path = require('path');
const { PrismaClient } = require('@prisma/client');
const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261020150000_exam_protection/migration.sql'), 'utf8');
const stmts = sql.split(';').map(s => s.replace(/--.*$/gm, '').trim()).filter(Boolean).map(s => s
  .replace(/^CREATE TABLE "/, 'CREATE TABLE IF NOT EXISTS "')
  .replace(/^CREATE (UNIQUE )?INDEX "/, (m, u) => `CREATE ${u || ''}INDEX IF NOT EXISTS "`)
  .replace(/^ALTER TABLE ("\w+") ADD CONSTRAINT "(\w+)"([\s\S]*)$/, (m, t, c, rest) =>
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='${c}') THEN ALTER TABLE ${t} ADD CONSTRAINT "${c}"${rest}; END IF; END $$`));
const ALLOWED = /^(CREATE TABLE IF NOT EXISTS "Protection|CREATE (UNIQUE )?INDEX IF NOT EXISTS "Protection|DO \$\$ BEGIN IF NOT EXISTS \(SELECT 1 FROM pg_constraint WHERE conname='Protection)/;
if (stmts.length !== 22 || stmts.some(s => !ALLOWED.test(s) || /\b(DROP|TRUNCATE)\b/i.test(s))) throw new Error('Refusing: unexpected or non-additive statement');
(async () => {
  const p = new PrismaClient();
  try {
    const rows = await p.$queryRawUnsafe(`select table_name from information_schema.tables where table_schema='public' and table_name like 'Protection%'`);
    console.log('existing protection tables:', rows.map(r => r.table_name));
    if (!process.argv.includes('--apply')) { console.log(`dry run: ${stmts.length} idempotent statements ready. Re-run with --apply.`); return; }
    await p.$transaction(stmts.map(s => p.$executeRawUnsafe(s)));
    const after = await p.$queryRawUnsafe(`select count(*)::int n from information_schema.tables where table_schema='public' and table_name like 'Protection%'`);
    console.log('done. protection tables now:', after[0].n, '(expected 6)');
  } catch (e) { console.error('failed (transaction rolled back):', e.code || '', String(e.message).split('\n').pop()); process.exitCode = 1; }
  finally { await p.$disconnect(); }
})();
