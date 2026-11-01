'use client'

import { useEffect } from 'react'
import ErrorScreen from '@/components/desk-diorama/ErrorScreen'

export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return <ErrorScreen kind="500" />
}
