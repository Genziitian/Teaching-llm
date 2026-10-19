import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'

interface MaterialDownloadPageProps {
  downloadUrl: string
  title: string
  backHref: string
}

export default function MaterialDownloadPage({
  downloadUrl,
  title,
  backHref,
}: MaterialDownloadPageProps) {
  return (
    <main className="page-container" style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px' }}>
      <Link
        href={backHref}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '28px' }}
      >
        <ArrowLeft size={16} /> Back
      </Link>

      <section className="card" style={{ padding: '28px', textAlign: 'center' }}>
        <Download size={32} style={{ color: 'var(--accent)', marginBottom: '12px' }} />
        <h1 style={{ fontSize: '20px', margin: '0 0 8px', color: 'var(--text-primary)' }}>{title}</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px' }}>
          PDF preview is unavailable on the website. Download the file to open it, or use the mobile app to read it there.
        </p>
        <a
          href={downloadUrl}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px 18px', borderRadius: '10px', background: 'var(--accent)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}
        >
          <Download size={16} /> Download PDF
        </a>
      </section>
    </main>
  )
}
