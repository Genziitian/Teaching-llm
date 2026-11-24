import { supabase } from './storefrontDb'

/** Row of the storefront `blogs` table (see storefront-panel blogs-schema.sql). */
export interface BlogRow {
  id?: number
  title: string
  slug: string
  category: string
  content: string
  image: string
  date: string
  read_time: string
  published: number
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  created_at?: string
}

/** Public website that renders the posts (the storefront's /blog/:slug route). */
export const BLOGS_SITE_ORIGIN = '' // the public blog is served by this app at /blog

export function blogsSlugify(value: string): string {
  if (!value || typeof value !== 'string') return ''
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const blogsTodayLabel = () =>
  new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })

export const emptyBlog = (): BlogRow => ({
  title: '',
  slug: '',
  category: 'General',
  content: '',
  image: '',
  date: blogsTodayLabel(),
  read_time: '5 min read',
  published: 1,
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
})

export async function fetchBlogs(): Promise<{ data: BlogRow[]; error: string | null }> {
  const { data, error } = await supabase.from('blogs').select('*').order('created_at', { ascending: false })
  if (error) return { data: [], error: error.message || 'Could not load blogs.' }
  return { data: (data as BlogRow[]) || [], error: null }
}

/** Validates, normalises and writes a post. Returns an error message, or null on success. */
export async function saveBlog(blog: BlogRow): Promise<string | null> {
  if (!blog.title?.trim()) return 'Title is required.'
  const slug = (blog.slug?.trim() || blogsSlugify(blog.title)).trim()
  if (!slug) return 'A valid slug is required.'

  const payload = {
    title: blog.title.trim(),
    slug,
    category: blog.category?.trim() || 'General',
    content: blog.content || '',
    image: blog.image?.trim() || '',
    date: blog.date?.trim() || blogsTodayLabel(),
    read_time: blog.read_time?.trim() || '5 min read',
    published: Number(blog.published) ? 1 : 0,
    seo_title: blog.seo_title?.trim() || null,
    seo_description: blog.seo_description?.trim() || null,
    seo_keywords: blog.seo_keywords?.trim() || null,
  }

  const { error } = blog.id
    ? await supabase.from('blogs').update(payload).eq('id', blog.id)
    : await supabase.from('blogs').insert(payload)

  if (error) {
    return error.code === '23505' ? 'That slug is already used by another post. Pick a unique slug.' : error.message || 'Could not save the post.'
  }
  return null
}

export async function deleteBlog(id: number): Promise<string | null> {
  const { error } = await supabase.from('blogs').delete().eq('id', id)
  return error ? error.message || 'Could not delete the post.' : null
}

export async function setBlogPublished(id: number, published: boolean): Promise<string | null> {
  const { error } = await supabase.from('blogs').update({ published: published ? 1 : 0 }).eq('id', id)
  return error ? error.message || 'Could not update the post.' : null
}
