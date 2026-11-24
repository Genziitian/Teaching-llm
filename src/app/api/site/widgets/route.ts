import { storefrontDb } from '@/lib/storefront/db'
import { notConfigured, publicJson, readError } from '../public-read'

export const dynamic = 'force-dynamic'

export async function GET() {
  const nc = notConfigured([]); if (nc) return nc
  try {
    const { data, error } = await storefrontDb().from('widgets').select('*').eq('published', true).order('position', { ascending: true })
    if (error) throw error
    return publicJson(data || [])
  } catch (err) { return readError('widgets', err) }
}
