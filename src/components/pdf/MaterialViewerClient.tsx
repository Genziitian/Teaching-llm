'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import SecureWebPdfViewerLoader from '@/components/pdf/SecureWebPdfViewerLoader'

interface MaterialViewerClientProps {
  contentId: string
  contentType: 'LECTURE_NOTE' | 'STUDY_MATERIAL'
  downloadUrl: string
  fallbackUrl?: string
  title: string
  courseId?: string | null
  courseName?: string | null
  watermarkEmail: string
  userId: string
  backHref?: string
}

export default function MaterialViewerClient({
  contentId,
  contentType,
  downloadUrl,
  fallbackUrl,
  title,
  courseId,
  courseName,
  watermarkEmail,
  userId,
  backHref = '/dashboard',
}: MaterialViewerClientProps) {
  const targetLink = fallbackUrl || downloadUrl

  return (
    <div className="page-container fade-in" style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <Link
          href={backHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} />
          Back
        </Link>

        {targetLink && (
          <a
            href={targetLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={15} />
            Download Material
          </a>
        )}
      </div>

      <SecureWebPdfViewerLoader
        fileUrl={downloadUrl}
        fallbackUrl={fallbackUrl}
        watermarkEmail={watermarkEmail}
        title={title}
      />
    </div>
  )
}
