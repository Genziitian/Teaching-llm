import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams?: Promise<{
    url?: string
    title?: string
  }>
}

export default async function HomeworkMaterialDownloadPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const rawUrl = params?.url
  if (!rawUrl) redirect('/courses')

  let fileUrl: URL
  try {
    fileUrl = new URL(rawUrl)
  } catch {
    redirect('/courses')
  }
  if (fileUrl.protocol !== 'https:' && fileUrl.protocol !== 'http:') redirect('/courses')

  redirect(fileUrl.toString())
}
