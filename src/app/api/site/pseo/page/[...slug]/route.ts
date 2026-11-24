import { NextRequest } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { notConfigured, publicJson, readError } from '../../../public-read'

export const dynamic = 'force-dynamic'

const parse = (v: unknown, fb: unknown) => {
  if (typeof v !== 'string') return v ?? fb
  try { return JSON.parse(v || '') } catch { return fb }
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string[] } }) {
  const nc = notConfigured({ error: 'Page not found' }); if (nc) return publicJson({ error: 'Page not found' }, 404)
  try {
    const slug = (params.slug || []).map(decodeURIComponent).join('/')
    const { data: page, error } = await storefrontDb().from('pseo_pages').select('*').eq('slug', slug).eq('published', true).maybeSingle()
    if (error) throw error
    if (!page) return publicJson({ error: 'Page not found' }, 404)
    page.sections = parse(page.sections, [])
    page.faq = parse(page.faq, [])
    page.secondary_keywords = parse(page.secondary_keywords, [])
    page.internal_links = parse(page.internal_links, [])
    page.related_pages = parse(page.related_pages, [])
    page.schema_data = parse(page.schema_data, {})
    return publicJson(page)
  } catch (err) { return readError('pseo/page', err) }
}
