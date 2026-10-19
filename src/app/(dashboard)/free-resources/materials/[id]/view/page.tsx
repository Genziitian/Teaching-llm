import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import MaterialDownloadPage from '@/components/materials/MaterialDownloadPage'

interface PageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function MaterialViewPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login?next=/free-resources/materials')

  const { id } = await params

  const material = await prisma.material.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      fileUrl: true,
      fileType: true,
      isFree: true,
      isGlobal: true,
      courseId: true,
      course: { select: { name: true } },
    },
  })
  if (!material) return notFound()

  return (
    <MaterialDownloadPage
      downloadUrl={`/api/drive-material/${material.id}`}
      title={material.title}
      backHref="/free-resources/materials"
    />
  )
}
