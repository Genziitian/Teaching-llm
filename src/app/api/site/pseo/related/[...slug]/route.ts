import { NextRequest } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { notConfigured, publicJson, readError } from '../../../public-read'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { slug: string[] } }) {
  const nc = notConfigured([]); if (nc) return nc
  try {
    const slug = (params.slug || []).map(decodeURIComponent).join('/')
    const db = storefrontDb()
    const { data: page } = await db.from('pseo_pages').select('cluster_topic, playbook_type').eq('slug', slug).maybeSingle()
    if (!page) return publicJson([])
    const { data, error } = await db.from('pseo_pages')
      .select('slug, title, playbook_type, meta_description, cluster_topic')
      .eq('published', true).neq('slug', slug).limit(60)
    if (error) throw error
    const pool = (data || []).filter((p: any) => p.cluster_topic === page.cluster_topic || p.playbook_type === page.playbook_type)
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
    return publicJson(pool.slice(0, 6).map(({ cluster_topic, ...rest }: any) => rest))
  } catch (err) { return readError('pseo/related', err) }
}
