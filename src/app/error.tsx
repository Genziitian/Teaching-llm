'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import ErrorScreen from '@/components/desk-diorama/ErrorScreen'

export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return <ErrorScreen kind="500" />
}
