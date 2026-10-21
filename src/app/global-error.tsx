'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import ErrorScreen from '@/components/desk-diorama/ErrorScreen'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <ErrorScreen kind="500" />
      </body>
    </html>
  )
}
