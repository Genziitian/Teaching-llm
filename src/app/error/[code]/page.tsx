import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ErrorScreen from '@/components/desk-diorama/ErrorScreen'
import { ERROR_KINDS, isErrorKind } from '@/components/desk-diorama/errors'

// Only the codes in ERROR_KINDS exist; anything else falls through to the 404 page.
export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(ERROR_KINDS).map(code => ({ code }))
}

export function generateMetadata({ params }: { params: { code: string } }): Metadata {
  if (!isErrorKind(params.code)) return {}
  return {
    title: `${ERROR_KINDS[params.code].title.join(' ')} · GenZ IITIAN`,
    robots: { index: false, follow: false },
  }
}

export default function ErrorCodePage({ params }: { params: { code: string } }) {
  if (!isErrorKind(params.code)) notFound()
  return <ErrorScreen kind={params.code} />
}
