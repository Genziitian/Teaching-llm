import { NextRequest } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { notConfigured, publicJson, readError } from '../../public-read'

export const dynamic = 'force-dynamic'

const COLS = 'id, slug, playbook_type, title, meta_description, primary_keyword, cluster_topic, word_count, updated_at'

// GET /api/site/pseo/pages?type=&cluster=&page=&limit=&search=
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') || '1') || 1)
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20') || 20))
  const nc = notConfigured({ pages: [], pagination: { page, limit, total: 0, totalPages: 0 } }); if (nc) return nc
  try {
    let q = storefrontDb().from('pseo_pages').select(COLS, { count: 'exact' }).eq('published', true)
    const type = sp.get('type'); const cluster = sp.get('cluster')
    const search = (sp.get('search') || '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 100)
    if (type) q = q.eq('playbook_type', type)
    if (cluster) q = q.eq('cluster_topic', cluster)
    if (search) q = q.or(`title.ilike.%${search}%,primary_keyword.ilike.%${search}%`)
    const from = (page - 1) * limit
    const { data, count, error } = await q.order('updated_at', { ascending: false }).range(from, from + limit - 1)
    if (error) throw error
    const total = count || 0
    return publicJson({ pages: data || [], pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
  } catch (err) { return readError('pseo/pages', err) }
}
