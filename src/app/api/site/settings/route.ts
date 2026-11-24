import { storefrontDb } from '@/lib/storefront/db'
import { notConfigured, publicJson, readError } from '../public-read'

export const dynamic = 'force-dynamic'

// GET /api/site/settings — storefront settings as { key: value } (same as the original public endpoint).
export async function GET() {
  const nc = notConfigured({}); if (nc) return nc
  try {
    const { data, error } = await storefrontDb().from('settings').select('key, value')
    if (error) throw error
    const config: Record<string, unknown> = {}
    for (const s of data || []) config[s.key] = s.value
    return publicJson(config)
  } catch (err) { return readError('settings', err) }
}
