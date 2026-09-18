import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = getDatabaseUrl()

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return undefined

  try {
    const url = new URL(databaseUrl)
    // For Supabase pooler on port 6543 (transaction mode), pgbouncer=true is required by Prisma
    if (url.port === '6543' && !url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true')
    }
    if (!url.searchParams.has('connection_limit')) {
      // Default to 5 to prevent exceeding Supabase connection pool limits in multi-process/burst environments
      url.searchParams.set('connection_limit', process.env.PRISMA_CONNECTION_LIMIT || '5')
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', process.env.PRISMA_POOL_TIMEOUT || '10')
    }
    return url.toString()
  } catch {
    return databaseUrl
  }
}

const isDev = process.env.NODE_ENV === 'development'

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: databaseUrl
      ? { db: { url: databaseUrl } }
      : undefined,
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' },
    ],
  })

// Attach query performance listener once per process
if (!globalForPrisma.prisma) {
  // Flag any database query taking longer than 200ms
  const SLOW_QUERY_THRESHOLD_MS = 200

  // @ts-ignore Prisma query event typing
  prisma.$on('query', (e: { query: string; params: string; duration: number; timestamp: Date }) => {
    if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(
        {
          module: 'PrismaDB',
          durationMs: e.duration,
          query: e.query.slice(0, 300),
        },
        `Slow database query detected (${e.duration}ms)`
      )
    }
  })
}

globalForPrisma.prisma = prisma

