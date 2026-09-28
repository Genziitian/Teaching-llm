import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import MaterialViewerClient from '@/components/pdf/MaterialViewerClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams?: Promise<{
    url?: string
    title?: string
  }>
}

export default async function HomeworkMaterialViewerPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const url = params?.url
  const title = params?.title || 'Homework Material'

  if (!url) redirect('/courses')

  return (
    <MaterialViewerClient
      contentId="homework-material"
      contentType="STUDY_MATERIAL"
      downloadUrl={url}
      fallbackUrl={url}
      title={title}
      watermarkEmail={session.email}
      userId={session.userId}
      backHref="/courses"
    />
  )
}
