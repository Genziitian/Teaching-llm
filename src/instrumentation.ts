export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureSchema } = await import('./lib/ensure-schema')
    await ensureSchema()
    const { startScheduler } = await import('./lib/scheduler')
    startScheduler()
  }
}
