import pino from 'pino'

const isDev = process.env.NODE_ENV === 'development'

/**
 * Universal structured logger for Teaching LLM.
 * - In Development: Pretty prints colored, human-readable logs to the terminal.
 * - In Production: Emits high-speed JSON logs with ISO timestamps and metadata.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  base: {
    env: process.env.NODE_ENV || 'production',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:HH:MM:ss',
        },
      }
    : undefined,
})

/**
 * Creates a scoped sub-logger with module context.
 * 
 * Example:
 *   const log = createScopedLogger('Payments')
 *   log.info({ orderId: 'ord_123', amount: 500 }, 'Order created successfully')
 */
export function createScopedLogger(moduleName: string) {
  return logger.child({ module: moduleName })
}
