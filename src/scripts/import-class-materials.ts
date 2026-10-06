import { runImport } from '../lib/automation/coordinator'
import { prisma } from '../lib/db'
const args = process.argv.slice(2)
const value = (key: string) => { const index = args.indexOf(key); return index < 0 ? undefined : args[index + 1] }
async function main() {
  const allowed = ['--dry-run', '--from', '--to', '--course', '--manual']
  for (let i = 0; i < args.length; i++) {
    if (!allowed.includes(args[i])) throw new Error(`Unknown argument: ${args[i]}`)
    if (['--from', '--to', '--course'].includes(args[i]) && (!args[++i] || args[i].startsWith('--'))) throw new Error('Missing argument value')
  }
  const from = value('--from'), to = value('--to')
  const result = await runImport({ dryRun: args.includes('--dry-run'), from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined, courseId: value('--course'), trigger: args.includes('--manual') ? 'MANUAL' : 'SCHEDULED' })
  console.log(JSON.stringify({ runId: result.id, status: result.status, counts: result.counts, errorSummary: result.errorSummary }))
  if (result.status === 'FAILED' || result.status === 'PARTIAL') process.exitCode = 1
}
main().catch(() => { console.error('Automation failed. Check configuration and database availability.'); process.exitCode = 1 }).finally(() => prisma.$disconnect())
