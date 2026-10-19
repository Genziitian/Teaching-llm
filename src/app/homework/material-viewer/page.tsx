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

  const title = params?.title || 'Homework Material'

  return (
    <main className="page-container" style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px' }}>
      <section className="card" style={{ padding: '28px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '20px', margin: '0 0 8px', color: 'var(--text-primary)' }}>{title}</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px' }}>
          PDF preview is unavailable on the website. Download the file to open it, or use the mobile app to read it there.
        </p>
        <a
          href={fileUrl.toString()}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 18px', borderRadius: '10px', background: 'var(--accent)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}
        >
          Open or download material
        </a>
      </section>
    </main>
  )
}
