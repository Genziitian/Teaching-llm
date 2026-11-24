import { NextRequest } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { notConfigured, publicJson, readError } from '../public-read'

export const dynamic = 'force-dynamic'

// GET /api/site/resources?level=&subject=&type= — published storefront resources.
export async function GET(request: NextRequest) {
  const nc = notConfigured([]); if (nc) return nc
  try {
    const sp = request.nextUrl.searchParams
    let q = storefrontDb().from('resources').select('*').eq('published', true)
    const level = sp.get('level'); const subject = sp.get('subject'); const type = sp.get('type')
    if (level) q = q.eq('level', level)
    if (subject) q = q.eq('subject', subject)
    if (type) q = q.eq('resource_type', type)
    const { data, error } = await q.order('level').order('subject').order('id', { ascending: false })
    if (error) throw error
    return publicJson(data || [])
  } catch (err) { return readError('resources', err) }
}
