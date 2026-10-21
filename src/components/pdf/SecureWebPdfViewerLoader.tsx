'use client'

import dynamic from 'next/dynamic'

// Code-splits the heavy PDF.js viewer (~600 KB) so only this route pays
// the bundle cost. Lives in a Client Component because Next 14 disallows
// `dynamic({ ssr: false })` in Server Components.
const SecureWebPdfViewer = dynamic(
  () => import('./SecureWebPdfViewer'),
  { ssr: false },
)

export default function SecureWebPdfViewerLoader(props: {
  fileUrl?: string
  fallbackUrl?: string
  fileBlob?: Blob
  watermarkEmail: string
  title?: string
  onBack?: () => void
  initialFullscreen?: boolean
}) {
  return <SecureWebPdfViewer {...props} />
}
