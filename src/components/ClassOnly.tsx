'use client'
import { usePathname } from 'next/navigation'
import { isLandingPage } from '@/lib/landing-paths'

/** Renders children only on class-app pages (hidden on the public landing site). */
export default function ClassOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (isLandingPage(pathname)) return null
  return <>{children}</>
}
