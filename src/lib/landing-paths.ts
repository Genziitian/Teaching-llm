// Public storefront landing site paths. Shared by middleware and the root layout.
export const LANDING_PATHS = ['/about', '/contact', '/blog', '/docs', '/careers', '/one-to-one', '/1-on-1', '/ecosystem', '/explore', '/syllabus', '/resources', '/tools', '/access-pdf', '/newsletter', '/knowledge', '/cart', '/checkout', '/refer', '/terms', '/privacy', '/refund', '/payment-success', '/payment-failed', '/verify', '/employee', '/graded-assignment']

export function isLandingPage(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === '/') return true
  return LANDING_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}
