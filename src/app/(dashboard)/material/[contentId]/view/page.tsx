import { notFound, redirect } from 'next/navigation'
import { getSession, isAdminOrManager, isStudentEnrolledInContent } from '@/lib/auth'
import { prisma } from '@/lib/db'
import MaterialDownloadPage from '@/components/materials/MaterialDownloadPage'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ contentId: string }>
}

export default async function MaterialViewPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { contentId } = await params

  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      title: true,
      pptUrl: true,
      topic: {
        select: {
          courseId: true,
          course: { select: { id: true, name: true } },
        },
      },
    },
  })
  if (!content || !content.pptUrl) return notFound()

  // Enrollment gate — managers / admins / instructors bypass.
  const privileged =
    isAdminOrManager(session.role) || session.role === 'INSTRUCTOR'
  if (!privileged) {
    const isEnrolled = await isStudentEnrolledInContent(
      session.userId,
      content.id,
      content.topic?.courseId
    )
    if (!isEnrolled) redirect('/dashboard')
  }

  return (
    <MaterialDownloadPage
      downloadUrl={`/api/drive-doc/${content.id}`}
      title={content.title}
      backHref={content.topic?.courseId ? `/courses/${content.topic.courseId}` : '/courses'}
    />
  )
}
