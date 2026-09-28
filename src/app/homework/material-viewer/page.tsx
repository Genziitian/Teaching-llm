import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Download, LifeBuoy } from 'lucide-react'
import { getSession } from '@/lib/auth'
import SecureWebPdfViewerLoader from '@/components/pdf/SecureWebPdfViewerLoader'

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
    <main style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <header style={{
        height: '72px',
        padding: '10px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        background: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'var(--text-primary)', minWidth: 0 }}>
          <img src="/mobile-login-logo.png" alt="GenZ IITian" style={{ width: '42px', height: '42px', objectFit: 'contain' }} />
          <span style={{ fontSize: '16px', fontWeight: 900, whiteSpace: 'nowrap' }}>GenZ IITian</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '999px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            <Download size={15} />
            Download Material
          </a>
          <Link
            href="/support"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '999px',
              background: 'var(--primary, #10b981)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 900,
              textDecoration: 'none',
            }}
          >
            <LifeBuoy size={15} />
            Need Help
          </Link>
        </div>
      </header>

      <section style={{ padding: '18px 24px 28px' }}>
        <SecureWebPdfViewerLoader
          fileUrl={url}
          fallbackUrl={url}
          watermarkEmail={session.email}
          title={title}
          initialFullscreen
        />
      </section>
    </main>
  )
}
